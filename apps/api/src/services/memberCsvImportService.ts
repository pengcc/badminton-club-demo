import { randomUUID } from 'node:crypto';
import mongoose, { type ClientSession } from 'mongoose';
import { z } from 'zod';
import {
  AccountKind,
  AuditEventType,
  Capability,
  EntityType,
  MembershipStatus,
  PlayerType,
} from '@club/shared-types/core/enums';
import type {
  MemberCsvApply,
  MemberCsvChange,
  MemberCsvOutcome,
  MemberCsvPreview,
  MemberCsvResult,
  MemberCsvRowResult,
} from '@club/shared-types/api/memberCsv';
import {
  MembershipLifecycleOperation,
  type MembershipLifecycleActor,
} from '@club/shared-types/domain/membershipLifecycle';
import type {
  AccountOnboardingPersonUserState,
  EstablishMemberCommand,
} from '@club/shared-types/domain/accountOnboarding';
import type { UpdateUserInput } from '@club/shared-types/schemas/user';
import {
  digest,
  parseMemberCsv,
  type MemberCsvRow,
} from '../lib/memberCsvImport';
import { User, type IUser } from '../models/User';
import { Player } from '../models/Player';
import { AppError } from '../utils/errors';
import {
  identityConsistencyMatches,
  planAccountEstablishment,
} from './accountOnboardingPolicy';
import { accountEstablishmentCore } from './accountOnboardingService';
import { membershipLifecycleService } from './membershipLifecycleService';
import { UserService } from './userService';
import { AuditService } from './auditService';

const outcomes = [
  'create',
  'update',
  'unchanged',
  'review_required',
  'conflict',
  'invalid',
] as const;
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const expectedValuesSchema = z
  .object({
    gender: z.string().optional(),
    phone: z.string().nullable().optional(),
    address: z
      .object({
        street: z.string().optional(),
        postalCode: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
      })
      .strict()
      .nullable()
      .optional(),
    membership: z.string().optional(),
    player: z
      .object({
        id: z.string(),
        type: z.string(),
        active: z.boolean().optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();
const snapshotSchema = z
  .object({
    rowNumber: z.number().int().min(2).max(1001),
    outcome: z.enum(outcomes),
    changes: z
      .array(z.enum(['gender', 'phone', 'address', 'membership', 'player']))
      .max(5),
    targetId: z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .optional(),
    expected: expectedValuesSchema,
  })
  .strict();
const previewContextSchema = z
  .object({
    actorId: z.string(),
    fileDigest: hashSchema,
    rows: z.array(snapshotSchema).min(1).max(1000),
  })
  .strict();
type Snapshot = z.infer<typeof snapshotSchema>;
type PreviewContext = z.infer<typeof previewContextSchema>;
interface PlannedRow {
  result: MemberCsvRowResult;
  snapshot: Snapshot;
  user?: IUser;
  profile: UpdateUserInput;
  establish: boolean;
}

function summarize(rows: MemberCsvRowResult[]): MemberCsvResult {
  const counts = Object.fromEntries(
    outcomes.map((outcome) => [outcome, 0])
  ) as Record<MemberCsvOutcome, number>;
  for (const row of rows) counts[row.outcome]++;
  return { rows, counts };
}
function authorize(actor: MembershipLifecycleActor): void {
  if (!actor.capabilities.includes(Capability.ADMINISTRATION))
    throw AppError.forbidden();
}
function userState(user: IUser): AccountOnboardingPersonUserState | null {
  if (
    user.accountKind !== AccountKind.PERSON ||
    !user.firstName ||
    !user.lastName ||
    !user.dateOfBirth ||
    !user.gender ||
    !user.membershipStatus
  )
    return null;
  return {
    id: user._id.toString(),
    accountKind: AccountKind.PERSON,
    firstName: user.firstName,
    lastName: user.lastName,
    dateOfBirth: user.dateOfBirth,
    email: user.email,
    gender: user.gender,
    phone: user.phone,
    address: user.address,
    membershipStatus: user.membershipStatus,
    membershipType: user.membershipType,
    administratorDesignation: user.administratorDesignation,
    accountOnboardingStatus: user.accountOnboardingStatus,
  };
}
function commandFor(
  row: MemberCsvRow,
  actor: MembershipLifecycleActor,
  key: string,
  user?: IUser
): EstablishMemberCommand {
  if (!row.input) throw AppError.validation('Invalid import row');
  return {
    ...row.input,
    membershipType: row.input.membershipType ?? user?.membershipType,
    targetKind: 'member',
    actor,
    idempotencyKey: key,
    source: { kind: 'administrator', reference: 'member_csv_import' },
    setupLocale: 'de',
    sendPasswordSetupEmailNow: false,
  };
}
function addressFacts(address: IUser['address']) {
  return address
    ? {
        street: address.street,
        postalCode: address.postalCode,
        city: address.city,
        country: address.country,
      }
    : null;
}
async function planRow(
  row: MemberCsvRow,
  actor: MembershipLifecycleActor,
  session: ClientSession | null = null
): Promise<PlannedRow> {
  const result = { ...row.result, changes: [] as MemberCsvChange[] };
  const snapshot: Snapshot = {
    rowNumber: result.rowNumber,
    outcome: result.outcome,
    changes: [],
    expected: {},
  };
  const planned: PlannedRow = {
    result,
    snapshot,
    profile: {},
    establish: false,
  };
  const finish = (
    outcome: MemberCsvOutcome,
    reason?: MemberCsvRowResult['reason']
  ) => {
    result.outcome = outcome;
    result.reason = reason;
    snapshot.outcome = outcome;
    snapshot.changes = [...result.changes];
    if (planned.user) {
      const user = planned.user;
      for (const change of result.changes) {
        if (change === 'gender') snapshot.expected.gender = user.gender;
        if (change === 'phone') snapshot.expected.phone = user.phone ?? null;
        if (change === 'address')
          snapshot.expected.address = addressFacts(user.address);
        if (change === 'membership')
          snapshot.expected.membership = user.membershipStatus;
      }
    }
    return planned;
  };
  if (!row.input || ['invalid', 'review_required'].includes(result.outcome))
    return finish(result.outcome, result.reason);
  const { identity, membershipType, initialMembershipStatus, establishPlayer } =
    row.input;
  const user = await User.findOne({ email: identity.email }).session(session);
  if (!user) {
    const candidates = await User.find({
      accountKind: AccountKind.PERSON,
      dateOfBirth: identity.dateOfBirth,
    }).session(session);
    if (
      candidates.some((candidate) => {
        const state = userState(candidate);
        return state && identityConsistencyMatches(state, identity);
      })
    )
      return finish('review_required', 'identity_candidate');
    planned.establish = true;
    return finish('create');
  }
  planned.user = user;
  const player = await Player.findOne({ userId: user._id }).session(session);
  snapshot.targetId = user._id.toString();
  if (user.accountKind === AccountKind.SUPER_ADMIN || user.accountSuspension)
    return finish('conflict', 'protected_account');
  const state = userState(user);
  if (!state || !identityConsistencyMatches(state, identity))
    return finish('review_required', 'identity_mismatch');
  if (
    user.membershipStatus !== MembershipStatus.INACTIVE &&
    membershipType !== undefined &&
    user.membershipType !== membershipType
  )
    return finish('review_required', 'membership_type');
  if (user.membershipStatus === MembershipStatus.INACTIVE) {
    if (!player || player.type !== PlayerType.EXTERNAL)
      return finish('review_required', 'inactive_person');
    const policy = planAccountEstablishment(
      commandFor(row, actor, 'preview-only', user),
      state,
      {
        id: player._id.toString(),
        type: player.type,
        isActivePlayer: player.isActivePlayer,
      }
    );
    if (policy.kind !== 'establish')
      return finish('review_required', 'player_state');
    planned.establish = true;
    result.changes.push('membership', 'player');
  } else {
    if (player && player.type !== PlayerType.MEMBER)
      return finish('review_required', 'player_state');
    if (
      ![MembershipStatus.ACTIVE, MembershipStatus.PASSIVE].includes(
        user.membershipStatus!
      )
    )
      return finish('conflict', 'protected_account');
    if (user.membershipStatus !== initialMembershipStatus)
      result.changes.push('membership');
    if (establishPlayer && (!player || !player.isActivePlayer))
      result.changes.push('player');
  }
  if (user.gender !== identity.gender) planned.profile.gender = identity.gender;
  if (identity.phone && identity.phone !== user.phone)
    planned.profile.phone = identity.phone;
  if (
    identity.address &&
    JSON.stringify(addressFacts(identity.address)) !==
      JSON.stringify(addressFacts(user.address))
  )
    planned.profile.address = identity.address;
  result.changes.push(...(Object.keys(planned.profile) as MemberCsvChange[]));
  if (result.changes.includes('player'))
    snapshot.expected.player = player
      ? {
          id: player._id.toString(),
          type: player.type,
          ...(establishPlayer ? { active: player.isActivePlayer } : {}),
        }
      : null;
  return finish(result.changes.length ? 'update' : 'unchanged');
}
function boundToPreview(current: PlannedRow, expected: Snapshot): PlannedRow {
  const result = current.result;
  if (!['create', 'update'].includes(expected.outcome))
    return {
      ...current,
      result: {
        ...result,
        outcome: expected.outcome,
        changes: [],
        reason: result.reason,
      },
    };
  const sameIdentity = expected.targetId
    ? current.snapshot.targetId === expected.targetId
    : true;
  // Exact convergence is allowed, but a deleted/replaced matched identity is never a new create.
  if (sameIdentity && result.outcome === 'unchanged') return current;
  if (
    sameIdentity &&
    current.snapshot.targetId === expected.targetId &&
    JSON.stringify(expectedValuesSchema.parse(current.snapshot.expected)) ===
      JSON.stringify(expected.expected) &&
    result.outcome === expected.outcome &&
    JSON.stringify([...result.changes].sort()) ===
      JSON.stringify([...expected.changes].sort())
  )
    return current;
  return {
    ...current,
    result: {
      ...result,
      outcome: 'review_required',
      changes: [],
      reason: 'stale',
    },
  };
}
export class MemberCsvImportService {
  static async preview(
    buffer: Buffer,
    actor: MembershipLifecycleActor
  ): Promise<MemberCsvPreview> {
    authorize(actor);
    const rows = parseMemberCsv(buffer);
    const planned: PlannedRow[] = [];
    for (const row of rows) planned.push(await planRow(row, actor));
    const previewContext: PreviewContext = {
      actorId: actor.id,
      fileDigest: digest(buffer),
      rows: planned.map((row) => row.snapshot),
    };
    return {
      ...summarize(planned.map((row) => row.result)),
      previewContext: JSON.stringify(previewContext),
    };
  }
  static async apply(
    buffer: Buffer,
    rawPreviewContext: string,
    actor: MembershipLifecycleActor
  ): Promise<MemberCsvApply> {
    authorize(actor);
    let previewContext: PreviewContext;
    try {
      if (
        typeof rawPreviewContext !== 'string' ||
        Buffer.byteLength(rawPreviewContext) > 512 * 1024
      )
        throw new Error();
      previewContext = previewContextSchema.parse(
        JSON.parse(rawPreviewContext)
      );
    } catch {
      throw AppError.validation('Member CSV preview context is invalid');
    }
    const rows = parseMemberCsv(buffer);
    if (
      previewContext.actorId !== actor.id ||
      previewContext.fileDigest !== digest(buffer) ||
      previewContext.rows.length !== rows.length ||
      rows.some(
        (row, i) => row.result.rowNumber !== previewContext.rows[i].rowNumber
      )
    )
      throw AppError.validation(
        'Member CSV preview does not match this request'
      );
    const results: MemberCsvRowResult[] = [];
    let mutated = false;
    for (const [index, row] of rows.entries()) {
      const expected = previewContext.rows[index];
      let committed: PlannedRow;
      let profileTarget: string | undefined;
      let profileFields: string[] = [];
      try {
        if (!['create', 'update'].includes(expected.outcome)) {
          committed = boundToPreview(await planRow(row, actor), expected);
        } else {
          const key = `member-csv:${randomUUID()}`;
          const session = await mongoose.startSession();
          try {
            committed = await session.withTransaction(async () => {
              profileTarget = undefined;
              profileFields = [];
              const current = boundToPreview(
                await planRow(row, actor, session),
                expected
              );
              if (!['create', 'update'].includes(current.result.outcome))
                return current;
              let userId = current.user?._id.toString();
              if (current.establish) {
                const established =
                  await accountEstablishmentCore.executeDirectInSession(
                    commandFor(row, actor, key, current.user),
                    session
                  );
                userId = established.userId;
              }
              if (!userId || !row.input)
                throw AppError.internal('Member CSV row was not established');
              if (Object.keys(current.profile).length) {
                await UserService.updatePersonProfile(
                  userId,
                  current.profile,
                  session
                );
                profileTarget = userId;
                profileFields = Object.keys(current.profile);
              }
              if (!current.establish) {
                if (current.result.changes.includes('membership'))
                  await membershipLifecycleService.executeInSession(
                    {
                      operation:
                        MembershipLifecycleOperation.TRANSITION_MEMBERSHIP,
                      userId,
                      expectedMembershipStatus: current.user!.membershipStatus,
                      targetMembershipStatus: row.input.initialMembershipStatus,
                      actor,
                      reason: 'Member CSV import',
                      idempotencyKey: `${key}:membership`,
                      occurredAt: new Date(),
                    },
                    session
                  );
                if (current.result.changes.includes('player'))
                  await membershipLifecycleService.executeInSession(
                    {
                      operation:
                        MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY,
                      userId,
                      expectedMembershipStatus:
                        row.input.initialMembershipStatus,
                      eligible: true,
                      playerTypeForCreation: PlayerType.MEMBER,
                      actor,
                      reason: 'Member CSV import',
                      idempotencyKey: `${key}:player`,
                      occurredAt: new Date(),
                    },
                    session
                  );
              }
              return current;
            });
          } finally {
            await session.endSession();
          }
        }
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 11000
        ) {
          // A unique-identity race succeeds only after exact current convergence.
          const converged = boundToPreview(await planRow(row, actor), expected);
          if (converged.result.outcome === 'unchanged') {
            committed = converged;
          } else
            return {
              ...summarize(results),
              status: 'incomplete',
              auditSummary: 'not_attempted',
            };
        } else
          return {
            ...summarize(results),
            status: 'incomplete',
            auditSummary: 'not_attempted',
          };
        profileTarget = undefined;
        profileFields = [];
      }
      if (profileTarget)
        AuditService.writeBestEffort({
          eventType: AuditEventType.USER_UPDATED,
          entityType: EntityType.USER,
          entityId: profileTarget,
          actor,
          changes: profileFields.map((field) => ({ field })),
        });
      results.push(committed.result);
      if (['create', 'update'].includes(committed.result.outcome))
        mutated = true;
    }
    let auditSummary: MemberCsvApply['auditSummary'] = 'not_attempted';
    if (mutated) {
      try {
        await AuditService.writeRequired({
          eventType: AuditEventType.USERS_BATCH_UPDATED,
          entityType: EntityType.USER,
          actor,
          reason: 'Member CSV import',
          changes: Object.entries(summarize(results).counts).map(
            ([field, newValue]) => ({ field, newValue })
          ),
        });
        auditSummary = 'written';
      } catch {
        auditSummary = 'failed';
      }
    }
    return {
      ...summarize(results),
      status: results.some((row) =>
        ['invalid', 'review_required', 'conflict'].includes(row.outcome)
      )
        ? 'partial'
        : 'completed',
      auditSummary,
    };
  }
}
