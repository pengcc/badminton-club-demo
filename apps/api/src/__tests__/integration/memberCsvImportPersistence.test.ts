import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import {
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  AccountKind,
  AccountOnboardingStatus,
  AuditEventType,
  Capability,
  Gender,
  MembershipStatus,
  MembershipType,
  PlayerType,
} from '@club/shared-types/core/enums';
import { MembershipLifecycleOperation } from '@club/shared-types/domain/membershipLifecycle';
import { MEMBER_CSV_HEADERS } from '@club/shared-types/api/memberCsv';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import { User } from '../../models/User';
import { Player } from '../../models/Player';
import { AuditLog } from '../../models/AuditLog';
import { MembershipLifecycleEvent } from '../../models/MembershipLifecycleEvent';
import { AccountOnboardingOperation } from '../../models/AccountOnboardingOperation';
import { MemberCsvImportService as service } from '../../services/memberCsvImportService';
import { accountOnboardingService } from '../../services/accountOnboardingService';
import { membershipLifecycleService } from '../../services/membershipLifecycleService';
import { UserService } from '../../services/userService';
import { AuditService } from '../../services/auditService';
import EmailService from '../../services/emailService';
let lease: MongoTestDatabaseLease;
const actor = {
  id: new mongoose.Types.ObjectId().toString(),
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
};
function csv(rows: string[][]) {
  return Buffer.from(
    [MEMBER_CSV_HEADERS.join(','), ...rows.map((row) => row.join(','))].join(
      '\n'
    )
  );
}
function row(email = 'ada@example.test', edits: Record<number, string> = {}) {
  const values = [
    'Ada',
    'Example',
    email,
    'female',
    '1990-01-01',
    '',
    '',
    '',
    '',
    'active',
    '',
    '',
  ];
  for (const [index, value] of Object.entries(edits))
    values[Number(index)] = value;
  return values;
}
async function previewApply(rows: string[][]) {
  const buffer = csv(rows);
  const preview = await service.preview(buffer, actor);
  return {
    preview,
    result: await service.apply(buffer, preview.previewContext, actor),
    buffer,
  };
}
async function person(overrides: Record<string, unknown> = {}) {
  return User.create({
    email: 'ada@example.test',
    firstName: 'Ada',
    lastName: 'Example',
    gender: Gender.FEMALE,
    dateOfBirth: '1990-01-01',
    accountKind: AccountKind.PERSON,
    membershipStatus: MembershipStatus.ACTIVE,
    accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    administratorDesignation: false,
    isPlayer: false,
    ...overrides,
  });
}
beforeAll(async () => {
  lease = await acquireMongoTestDatabase('member-csv-import');
  await Promise.all(
    [
      User,
      Player,
      AuditLog,
      MembershipLifecycleEvent,
      AccountOnboardingOperation,
    ].map((model) => model.createIndexes())
  );
});
beforeEach(async () => {
  lease.assertOwnedDatabase();
  await Promise.all([
    User.deleteMany({}),
    Player.deleteMany({}),
    AuditLog.deleteMany({}),
    MembershipLifecycleEvent.deleteMany({}),
    AccountOnboardingOperation.deleteMany({}),
  ]);
  vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await lease?.release();
});
describe('Member import persistence', () => {
  it('holds Super Admin and contradictory Member Player identities without mutation', async () => {
    await User.create({
      email: 'principal@example.test',
      accountKind: AccountKind.SUPER_ADMIN,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    });
    const member = await person();
    await Player.create({
      userId: member._id,
      type: PlayerType.EXTERNAL,
      isActivePlayer: true,
    });
    const { result } = await previewApply([
      row('principal@example.test', { 0: 'Principal' }),
      row(),
    ]);
    expect(result.rows.map((item) => item.reason)).toEqual([
      'protected_account',
      'player_state',
    ]);
    expect(await MembershipLifecycleEvent.countDocuments()).toBe(0);
  });

  it('converts an active External Player and re-enables an inactive Member Player only on positive request', async () => {
    const external = await accountOnboardingService.establish({
      targetKind: 'external_player',
      identity: {
        email: 'ada@example.test',
        firstName: 'Ada',
        lastName: 'Example',
        dateOfBirth: '1990-01-01',
        gender: Gender.FEMALE,
      },
      establishPlayer: true,
      actor,
      source: { kind: 'administrator' },
      idempotencyKey: randomUUID(),
    });
    expect((await previewApply([row()])).result.status).toBe('completed');
    expect(await Player.findById(external.playerId)).toMatchObject({
      type: PlayerType.MEMBER,
      isActivePlayer: true,
    });
    await Player.updateOne(
      { _id: external.playerId },
      { $set: { isActivePlayer: false } }
    );
    await User.updateOne(
      { _id: external.userId },
      { $set: { isPlayer: false } }
    );
    expect((await previewApply([row()])).result.counts.unchanged).toBe(1);
    expect(
      (await previewApply([row(undefined, { 11: 'true' })])).result.counts
        .update
    ).toBe(1);
    expect(await Player.findById(external.playerId)).toMatchObject({
      isActivePlayer: true,
    });
  });

  it('previews without writes, establishes canonical Members/Player without email, and converges without extra mutation audit on a fresh unchanged import', async () => {
    const buffer = csv([
      row('ADA@example.test', { 11: 'true' }),
      row('second@example.test', { 0: 'Other', 9: 'passive' }),
    ]);
    const preview = await service.preview(buffer, actor);
    expect(preview.counts.create).toBe(2);
    for (const model of [
      User,
      Player,
      AuditLog,
      MembershipLifecycleEvent,
      AccountOnboardingOperation,
    ])
      expect(await model.countDocuments()).toBe(0);
    const result = await service.apply(buffer, preview.previewContext, actor);
    expect(result.status).toBe('completed');
    expect(await User.findOne({ email: 'ada@example.test' })).toMatchObject({
      membershipStatus: MembershipStatus.ACTIVE,
      passwordSetupGeneration: 0,
    });
    expect(await Player.findOne()).toMatchObject({
      type: PlayerType.MEMBER,
      isActivePlayer: true,
    });
    expect(EmailService.sendFromTemplate).not.toHaveBeenCalled();
    const events = await MembershipLifecycleEvent.countDocuments();
    const fresh = await service.preview(buffer, actor);
    expect(
      (await service.apply(buffer, fresh.previewContext, actor)).counts
        .unchanged
    ).toBe(2);
    expect(await MembershipLifecycleEvent.countDocuments()).toBe(events);
    expect(await User.countDocuments()).toBe(2);
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.USERS_BATCH_UPDATED,
      })
    ).toBe(1);
    expect((await service.preview(buffer, actor)).counts.unchanged).toBe(2);
    const audit = await AuditLog.findOne({
      eventType: AuditEventType.USERS_BATCH_UPDATED,
    }).lean();
    const serialized = JSON.stringify(audit);
    for (const secret of [
      'ada@example',
      'Ada',
      '1990-01-01',
      JSON.parse(preview.previewContext).fileDigest,
    ])
      expect(serialized).not.toContain(secret);
  });
  it('updates profile, activity and Player atomically and keeps false/blank data non-destructive', async () => {
    const user = await person({ phone: '+49123456789' });
    const { result } = await previewApply([
      row(undefined, {
        3: 'male',
        5: '+49123456780',
        9: 'passive',
        11: 'true',
      }),
    ]);
    expect(result.status).toBe('completed');
    expect(await User.findById(user._id)).toMatchObject({
      gender: Gender.MALE,
      phone: '+49123456780',
      membershipStatus: MembershipStatus.PASSIVE,
      isPlayer: true,
    });
    expect(
      (await previewApply([row(undefined, { 3: 'male', 9: 'passive' })])).result
        .counts.unchanged
    ).toBe(1);
    expect(await Player.findOne()).toMatchObject({ isActivePlayer: true });
    await vi.waitFor(async () =>
      expect(
        await AuditLog.countDocuments({
          eventType: AuditEventType.USER_UPDATED,
        })
      ).toBe(1)
    );
    expect(
      (
        await AuditLog.findOne({ eventType: AuditEventType.USER_UPDATED })
      )?.changes?.map((change) => change.field)
    ).toEqual(['gender', 'phone']);
  });
  it.each([
    [{}, { 0: 'Different' }, 'identity_mismatch'],
    [
      { membershipType: MembershipType.REGULAR },
      { 10: 'student' },
      'membership_type',
    ],
    [
      {
        accountSuspension: {
          reason: 'Fixture',
          suspendedAt: new Date(),
          suspendedBy: new mongoose.Types.ObjectId(),
        },
      },
      { 3: 'male' },
      'protected_account',
    ],
    [{ membershipStatus: MembershipStatus.INACTIVE }, {}, 'inactive_person'],
  ] as const)('holds protected or incompatible rows untouched', async (overrides, changes, reason) => {
    const user = await person(overrides);
    const before = await User.findById(user._id).lean();
    const { result } = await previewApply([row(undefined, changes)]);
    expect(result.rows[0].reason).toBe(reason);
    expect(await User.findById(user._id).lean()).toEqual(before);
  });
  it.each([
    true,
    false,
  ])('converts compatible External Player preserving identity and inactive eligibility (%s)', async (ensure) => {
    const external = await accountOnboardingService.establish({
      targetKind: 'external_player',
      identity: {
        email: 'ada@example.test',
        firstName: 'Ada',
        lastName: 'Example',
        dateOfBirth: '1990-01-01',
        gender: Gender.FEMALE,
      },
      establishPlayer: true,
      actor,
      source: { kind: 'administrator' },
      idempotencyKey: randomUUID(),
    });
    await Player.updateOne(
      { _id: external.playerId },
      { $set: { isActivePlayer: false } }
    );
    await User.updateOne(
      { _id: external.userId },
      { $set: { membershipType: MembershipType.STUDENT, isPlayer: false } }
    );
    vi.mocked(EmailService.sendFromTemplate).mockClear();
    const { result } = await previewApply([
      row(undefined, { 11: String(ensure), 3: 'male' }),
    ]);
    expect(result.status).toBe('completed');
    expect(await Player.findById(external.playerId)).toMatchObject({
      type: PlayerType.MEMBER,
      isActivePlayer: ensure,
    });
    expect(await User.findById(external.userId)).toMatchObject({
      membershipType: MembershipType.STUDENT,
      gender: Gender.MALE,
    });
    expect(await User.countDocuments()).toBe(1);
    expect(EmailService.sendFromTemplate).not.toHaveBeenCalled();
  });
  it('holds a stale email identity and detects deletion instead of recreating', async () => {
    const user = await person();
    expect(
      (await service.preview(csv([row('old@example.test')]), actor)).rows[0]
        .reason
    ).toBe('identity_candidate');
    const buffer = csv([row(undefined, { 3: 'male' })]);
    const preview = await service.preview(buffer, actor);
    await User.deleteOne({ _id: user._id });
    expect(
      (await service.apply(buffer, preview.previewContext, actor)).rows[0]
        .reason
    ).toBe('stale');
    expect(await User.countDocuments()).toBe(0);
  });
  it('ignores generic version changes while detecting material changes', async () => {
    const user = await person();
    const buffer = csv([row(undefined, { 3: 'male' })]);
    const preview = await service.preview(buffer, actor);
    await User.updateOne(
      { _id: user._id },
      { $inc: { __v: 1, authSessionGeneration: 1 } }
    );
    expect(
      (await service.apply(buffer, preview.previewContext, actor)).counts.update
    ).toBe(1);
    const second = await service.preview(
      csv([row(undefined, { 5: '+49123456789' })]),
      actor
    );
    await User.updateOne(
      { _id: user._id },
      { $set: { membershipStatus: MembershipStatus.PASSIVE } }
    );
    expect(
      (
        await service.apply(
          csv([row(undefined, { 5: '+49123456789' })]),
          second.previewContext,
          actor
        )
      ).rows[0].reason
    ).toBe('stale');
  });
  it.each([
    '',
    'false',
  ])('retains omitted optional facts and non-affirmative Player changes (%s) without false stale', async (ensure) => {
    const user = await person({
      membershipType: MembershipType.REGULAR,
      isPlayer: true,
    });
    const player = await Player.create({
      userId: user._id,
      type: PlayerType.MEMBER,
      isActivePlayer: true,
    });
    const buffer = csv([row(undefined, { 9: 'passive', 11: ensure })]);
    const preview = await service.preview(buffer, actor);
    const retained = {
      phone: '+49123456789',
      address: {
        street: 'Example Street 1',
        postalCode: '10115',
        city: 'Berlin',
        country: 'Deutschland',
      },
    };
    await UserService.updatePersonProfile(user._id.toString(), retained);
    await User.updateOne(
      { _id: user._id },
      { $set: { membershipType: MembershipType.STUDENT } }
    );
    await membershipLifecycleService.execute({
      operation: MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY,
      userId: user._id.toString(),
      eligible: false,
      actor,
      reason: 'Independent eligibility correction',
      idempotencyKey: randomUUID(),
      occurredAt: new Date(),
    });
    const result = await service.apply(buffer, preview.previewContext, actor);
    expect(result.status).toBe('completed');
    expect(result.rows[0]).toMatchObject({
      outcome: 'update',
      changes: ['membership'],
    });
    expect(await User.findById(user._id)).toMatchObject({
      ...retained,
      membershipType: MembershipType.STUDENT,
      membershipStatus: MembershipStatus.PASSIVE,
    });
    expect(await Player.findById(player._id)).toMatchObject({
      type: PlayerType.MEMBER,
      isActivePlayer: false,
    });
  });

  it.each([
    'phone',
    'address',
    'membershipType',
    'player',
  ] as const)('holds a changed explicitly authorized %s fact while another approved mutation remains', async (field) => {
    const user = await person({
      membershipType: MembershipType.REGULAR,
      isPlayer: true,
    });
    await Player.create({
      userId: user._id,
      type: PlayerType.MEMBER,
      isActivePlayer: true,
    });
    const edits: Record<number, string> = { 9: 'passive' };
    if (field === 'phone') edits[5] = '+49123456789';
    if (field === 'address')
      Object.assign(edits, { 6: 'Example Street 1', 7: '10115', 8: 'Berlin' });
    if (field === 'membershipType') edits[10] = 'regular';
    if (field === 'player') edits[11] = 'true';
    const buffer = csv([row(undefined, edits)]);
    const preview = await service.preview(buffer, actor);
    if (field === 'player')
      await membershipLifecycleService.execute({
        operation: MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY,
        userId: user._id.toString(),
        eligible: false,
        actor,
        reason: 'Independent eligibility correction',
        idempotencyKey: randomUUID(),
        occurredAt: new Date(),
      });
    else if (field === 'membershipType')
      await User.updateOne(
        { _id: user._id },
        { $set: { membershipType: MembershipType.STUDENT } }
      );
    else
      await UserService.updatePersonProfile(
        user._id.toString(),
        field === 'phone'
          ? { phone: '+49123456780' }
          : {
              address: {
                street: 'Other Street 2',
                postalCode: '10115',
                city: 'Berlin',
                country: 'Deutschland',
              },
            }
      );
    const before = await User.findById(user._id).lean();
    const result = await service.apply(buffer, preview.previewContext, actor);
    expect(result.rows[0]).toMatchObject({
      outcome: 'review_required',
      reason: 'stale',
    });
    expect(await User.findById(user._id).lean()).toEqual(before);
  });

  it('rejects altered file, malformed previewContext, actor mismatch and unauthorized actors before writes', async () => {
    const buffer = csv([row()]);
    const preview = await service.preview(buffer, actor);
    for (const [bytes, previewContext, who] of [
      [
        Buffer.concat([buffer, Buffer.from('\n')]),
        preview.previewContext,
        actor,
      ],
      [buffer, '{}', actor],
      [
        buffer,
        preview.previewContext,
        { ...actor, id: new mongoose.Types.ObjectId().toString() },
      ],
      [buffer, preview.previewContext, { ...actor, capabilities: [] }],
    ] as const) {
      await expect(
        service.apply(bytes, previewContext, {
          ...who,
          capabilities: [...who.capabilities],
        })
      ).rejects.toThrow();
    }
    expect(await User.countDocuments()).toBe(0);
    expect(await AuditLog.countDocuments()).toBe(0);
  });
  it('rolls back a failed row while retaining earlier independent commits and safely retries', async () => {
    await person();
    const original = membershipLifecycleService.executeInSession.bind(
      membershipLifecycleService
    );
    const spy = vi
      .spyOn(membershipLifecycleService, 'executeInSession')
      .mockImplementation(async (command, session) => {
        if (
          command.userId ===
          (
            await User.findOne({ email: 'ada@example.test' }).session(session)
          )?._id.toString()
        )
          throw new Error('synthetic failure');
        return original(command, session);
      });
    const buffer = csv([
      row('new@example.test', { 0: 'New' }),
      row(undefined, { 3: 'male', 9: 'passive' }),
    ]);
    const preview = await service.preview(buffer, actor);
    expect(
      (await service.apply(buffer, preview.previewContext, actor)).status
    ).toBe('incomplete');
    expect(await User.findOne({ email: 'new@example.test' })).not.toBeNull();
    expect(await User.findOne({ email: 'ada@example.test' })).toMatchObject({
      gender: Gender.FEMALE,
      membershipStatus: MembershipStatus.ACTIVE,
    });
    spy.mockRestore();
    const fresh = await service.preview(buffer, actor);
    expect(fresh.rows.map((row) => row.outcome)).toEqual([
      'unchanged',
      'update',
    ]);
    expect(
      (await service.apply(buffer, fresh.previewContext, actor)).status
    ).toBe('completed');
    expect(await User.countDocuments()).toBe(2);
  });
  it('keeps business success when the supplemental aggregate audit fails', async () => {
    const write = AuditService.writeRequired.bind(AuditService);
    vi.spyOn(AuditService, 'writeRequired').mockImplementation(
      (params, session) => {
        if (params.eventType === AuditEventType.USERS_BATCH_UPDATED)
          throw new Error('synthetic summary failure');
        return write(params, session);
      }
    );
    const { buffer, result } = await previewApply([row()]);
    expect(result).toMatchObject({
      status: 'completed',
      auditSummary: 'failed',
    });
    expect(await User.countDocuments()).toBe(1);
    expect(await MembershipLifecycleEvent.countDocuments()).toBe(1);
    const fresh = await service.preview(buffer, actor);
    expect(fresh.counts.unchanged).toBe(1);
    expect(
      (await service.apply(buffer, fresh.previewContext, actor)).auditSummary
    ).toBe('not_attempted');
  });
  it('handles concurrent independently previewed creation as exact convergence', async () => {
    const buffer = csv([row(undefined, { 11: 'true' })]);
    const preview = await service.preview(buffer, actor);
    const secondPreview = await service.preview(buffer, actor);
    const results = await Promise.all([
      service.apply(buffer, preview.previewContext, actor),
      service.apply(buffer, secondPreview.previewContext, actor),
    ]);
    expect(results.every((result) => result.status === 'completed')).toBe(true);
    expect(await User.countDocuments()).toBe(1);
    expect(await Player.countDocuments()).toBe(1);
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.USERS_BATCH_UPDATED,
      })
    ).toBe(1);
  });
  it('continues independent eligible rows alongside invalid and review rows', async () => {
    await person();
    const { result } = await previewApply([
      row(undefined, { 0: 'Wrong' }),
      row('valid@example.test', { 0: 'Valid' }),
      row('invalid@example.test', { 4: 'bad' }),
    ]);
    expect(result.status).toBe('partial');
    expect(result.counts.create).toBe(1);
    expect(result.counts.invalid).toBe(1);
    expect(result.counts.review_required).toBe(1);
  });
  it('does not treat a profile-owner failure as a successful row', async () => {
    await person();
    vi.spyOn(UserService, 'updatePersonProfile').mockRejectedValueOnce(
      new Error('synthetic')
    );
    const { result } = await previewApply([row(undefined, { 3: 'male' })]);
    expect(result.status).toBe('incomplete');
    expect(await User.findOne()).toMatchObject({ gender: Gender.FEMALE });
  });
});
