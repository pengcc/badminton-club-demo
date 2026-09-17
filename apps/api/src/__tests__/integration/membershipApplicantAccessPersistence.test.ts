import { createHash, randomUUID } from 'node:crypto';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import mongoose from 'mongoose';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  Gender,
  MemberApplicationStatus,
  MembershipStatus,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';
import { MembershipApplication } from '../../models/MembershipApplication';
import { MembershipApplicationAccessToken } from '../../models/MembershipApplicationAccessToken';
import { MembershipApplicantSession } from '../../models/MembershipApplicantSession';
import { RegistrationAccess } from '../../models/RegistrationAccess';
import { User } from '../../models/User';
import EmailService from '../../services/emailService';
import {
  APPLICANT_SESSION_COOKIE_PREFIX,
  APPLICANT_SESSION_TTL_MS,
  APPLICANT_TOKEN_TTL_MS,
  MAX_APPLICANT_SESSION_COOKIE_SLOTS,
  MembershipApplicantAccessService,
} from '../../services/membershipApplicantAccessService';
import {
  MEMBERSHIP_APPLICATION_POLICY_CODES,
  MembershipApplicationPolicy,
} from '../../services/membershipApplicationPolicy';
import { MembershipApplicationService } from '../../services/membershipApplicationService';
import { RegistrationAccessService } from '../../services/registrationAccessService';
import { MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES } from '../../services/emailContracts/membershipApplication';
import { SettingsService } from '../../services/settingsService';

let mongoLease: MongoTestDatabaseLease;

function tokenFromEmailSpy(spy: ReturnType<typeof vi.spyOn>): string {
  const variables = spy.mock.calls.at(-1)?.[3] as { accessUrl: string };
  return new URL(variables.accessUrl.replace('#', '?')).searchParams.get(
    'token'
  )!;
}

function tokenFromTemplate(
  spy: ReturnType<typeof vi.spyOn>,
  template: string
): string {
  const call = [...spy.mock.calls]
    .reverse()
    .find((candidate: unknown[]) => candidate[0] === template);
  const variables = call?.[3] as { accessUrl: string };
  return new URL(variables.accessUrl.replace('#', '?')).searchParams.get(
    'token'
  )!;
}

function cookieHeader(result: {
  cookieSlotId: string;
  sessionToken: string;
}): string {
  return `${APPLICANT_SESSION_COOKIE_PREFIX}${result.cookieSlotId}=${result.sessionToken}`;
}

async function resolvedApplicationId(result: {
  cookieSlotId: string;
  sessionToken: string;
}) {
  return (
    await MembershipApplicantAccessService.resolveSessionCookies(
      cookieHeader(result)
    )
  ).applicationId;
}

function accessEpochForTest(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

async function issueRegistrationToken(): Promise<string> {
  await RegistrationAccessService.issue(
    '30_days',
    new mongoose.Types.ObjectId().toString(),
    false
  );
  const path = (await RegistrationAccessService.getAdminState()).path;
  const token = path
    ? new URL(path, 'https://example.test').searchParams.get('k')
    : undefined;
  if (!token) throw new Error('Expected a retrievable registration token');
  return token;
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('membershipApplicantAccess');
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    MembershipApplication.syncIndexes(),
    MembershipApplicationAccessToken.syncIndexes(),
    MembershipApplicantSession.syncIndexes(),
    RegistrationAccess.syncIndexes(),
  ]);
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    MembershipApplication.deleteMany({}),
    MembershipApplicationAccessToken.deleteMany({}),
    MembershipApplicantSession.deleteMany({}),
    RegistrationAccess.deleteMany({}),
    User.deleteMany({}),
  ]);
  vi.restoreAllMocks();
  vi.spyOn(SettingsService, 'getApplicationAlertRecipients').mockResolvedValue([
    'admin@example.test',
  ]);
  await RegistrationAccess.create({
    _id: 'current',
    tokenDigest: 'irrelevant',
    expiryMode: '90_days',
    expiresAt: new Date(Date.now() + 60_000),
    generation: 4,
    updatedBy: new mongoose.Types.ObjectId(),
  });
});

afterAll(async () => {
  await mongoLease.release();
});

describe('verified Membership Application applicant access', () => {
  it('persists a retrievable shared link while preserving digest-only validation and legacy state', async () => {
    const issuedToken = await issueRegistrationToken();
    const ordinary = await RegistrationAccess.findById('current').lean();
    expect(ordinary).not.toHaveProperty('tokenDigest');
    expect(ordinary).not.toHaveProperty('recoverableToken');

    const stored = await RegistrationAccess.findById('current')
      .select('+tokenDigest +recoverableToken')
      .lean();
    expect(stored?.recoverableToken).toBe(issuedToken);
    expect(stored?.tokenDigest).toBe(
      createHash('sha256').update(issuedToken).digest('hex')
    );
    expect((await RegistrationAccessService.getAdminState()).path).toBe(
      `/apply?k=${issuedToken}`
    );
    await expect(RegistrationAccessService.validate(issuedToken)).resolves.toBe(
      true
    );
    await expect(RegistrationAccessService.validate(issuedToken)).resolves.toBe(
      true
    );

    const legacyToken = 'LegacyLink_1';
    await RegistrationAccess.updateOne(
      { _id: 'current' },
      {
        $set: {
          tokenDigest: createHash('sha256').update(legacyToken).digest('hex'),
          expiryMode: '90_days',
          expiresAt: new Date(Date.now() + 60_000),
          generation: 8,
        },
        $unset: { recoverableToken: '' },
      },
      { timestamps: false }
    );
    const legacyBeforeRead = await RegistrationAccess.findById('current')
      .select('+tokenDigest +recoverableToken')
      .lean();

    await expect(RegistrationAccessService.validate(legacyToken)).resolves.toBe(
      true
    );
    await expect(
      RegistrationAccessService.getAdminState()
    ).resolves.toMatchObject({
      hasCurrentLink: true,
      isValid: true,
      generation: 8,
    });
    expect(await RegistrationAccessService.getAdminState()).not.toHaveProperty(
      'path'
    );
    const legacyAfterRead = await RegistrationAccess.findById('current')
      .select('+tokenDigest +recoverableToken')
      .lean();
    expect(legacyAfterRead).toEqual(legacyBeforeRead);

    const replacementToken = await issueRegistrationToken();
    expect(replacementToken).not.toBe(legacyToken);
    await expect(RegistrationAccessService.validate(legacyToken)).resolves.toBe(
      false
    );
    await expect(
      RegistrationAccessService.validate(replacementToken)
    ).resolves.toBe(true);
    expect((await RegistrationAccessService.getAdminState()).path).toBe(
      `/apply?k=${replacementToken}`
    );
  });

  it('stores only token/session digests, replaces old links, consumes once, and creates one draft', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const validate = vi
      .spyOn(RegistrationAccessService, 'validate')
      .mockResolvedValue(true);
    const send = vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();

    await MembershipApplicantAccessService.requestInitialVerification(
      'NEW@Example.test',
      'shared',
      'en'
    );
    const oldToken = tokenFromEmailSpy(send);
    await MembershipApplicantAccessService.requestInitialVerification(
      'new@example.test',
      'shared',
      'en'
    );
    const currentToken = tokenFromEmailSpy(send);
    expect(validate).toHaveBeenCalledTimes(2);
    expect(currentToken).not.toBe(oldToken);

    const stored = await MembershipApplicationAccessToken.collection.findOne(
      {}
    );
    expect(stored).not.toBeNull();
    expect(stored!.locale).toBe('en');
    expect(JSON.stringify(stored)).not.toContain(oldToken);
    expect(JSON.stringify(stored)).not.toContain(currentToken);
    expect(stored).not.toHaveProperty('registrationGeneration');
    expect(stored).not.toHaveProperty('registrationIssuedAt');
    expect(
      stored!.expiresAt.getTime() - stored!.createdAt.getTime()
    ).toBeGreaterThanOrEqual(APPLICANT_TOKEN_TTL_MS);
    expect(
      stored!.expiresAt.getTime() - stored!.createdAt.getTime()
    ).toBeLessThan(APPLICANT_TOKEN_TTL_MS + 1_000);

    await expect(
      MembershipApplicantAccessService.consume(oldToken)
    ).rejects.toThrow('invalid or expired');
    const result = await MembershipApplicantAccessService.consume(currentToken);
    expect(
      await MembershipApplication.countDocuments({
        verifiedEmail: 'new@example.test',
      })
    ).toBe(1);
    expect(
      (await MembershipApplication.findById(result.applicationId).lean())
        ?.communicationLocale
    ).toBe('en');
    expect(
      await MembershipApplicantSession.countDocuments({
        applicationId: result.applicationId,
      })
    ).toBe(1);
    const rawSession = await MembershipApplicantSession.collection.findOne({});
    expect(JSON.stringify(rawSession)).not.toContain(result.sessionToken);
    expect(
      rawSession!.expiresAt.getTime() - rawSession!.createdAt.getTime()
    ).toBeGreaterThanOrEqual(APPLICANT_SESSION_TTL_MS - 10);
    expect(
      rawSession!.expiresAt.getTime() - rawSession!.createdAt.getTime()
    ).toBeLessThanOrEqual(APPLICANT_SESSION_TTL_MS + 10);
    await expect(
      MembershipApplicantAccessService.consume(currentToken)
    ).rejects.toThrow('invalid or expired');

    await MembershipApplicantAccessService.requestApplicationAccess(
      'new@example.test',
      'zh'
    );
    const accessToken = tokenFromEmailSpy(send);
    expect(
      (await MembershipApplication.findById(result.applicationId).lean())
        ?.communicationLocale
    ).toBe('en');
    const rotated = await MembershipApplicantAccessService.consume(accessToken);
    expect(
      (await MembershipApplication.findById(result.applicationId).lean())
        ?.communicationLocale
    ).toBe('zh');
    expect(await resolvedApplicationId(result)).toBeUndefined();
    expect(await resolvedApplicationId(rotated)).toBe(result.applicationId);
    await MembershipApplicantSession.updateOne(
      { applicationId: result.applicationId },
      { $set: { expiresAt: new Date(Date.now() - 1) } }
    );
    expect(await resolvedApplicationId(rotated)).toBeUndefined();
    expect(log.mock.calls.flat().join(' ')).not.toContain(currentToken);
    expect(log.mock.calls.flat().join(' ')).not.toContain(accessToken);
  });

  it('uses application access for an existing draft and survives shared-link rotation', async () => {
    const send = vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
    const sharedToken = await issueRegistrationToken();
    const draft =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        'continue@example.test'
      );

    await MembershipApplicantAccessService.requestInitialVerification(
      draft.verifiedEmail,
      sharedToken,
      'en'
    );

    expect(send).toHaveBeenCalledWith(
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.ACCESS,
      draft.verifiedEmail,
      'en',
      expect.objectContaining({ accessUrl: expect.stringContaining('#token=') })
    );
    expect(send).not.toHaveBeenCalledWith(
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.VERIFY_EMAIL,
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    const continuationToken = tokenFromTemplate(
      send,
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.ACCESS
    );
    await RegistrationAccessService.issue(
      '90_days',
      new mongoose.Types.ObjectId().toString(),
      false
    );

    const continued =
      await MembershipApplicantAccessService.consume(continuationToken);

    expect(continued.applicationId).toBe(draft.id);
    expect(
      await MembershipApplication.countDocuments({
        verifiedEmail: draft.verifiedEmail,
      })
    ).toBe(1);
    expect(
      (await MembershipApplication.findById(draft.id).lean())
        ?.communicationLocale
    ).toBe('en');
  });

  it('synchronizes communication locale only through an explicit authenticated workflow action', async () => {
    const draft =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        'locale-sync@example.test'
      );
    expect(
      (await MembershipApplication.findById(draft.id).lean())
        ?.communicationLocale
    ).toBe('de');

    await MembershipApplicantAccessService.synchronizeCommunicationLocale(
      draft.id,
      'zh'
    );

    expect(
      (await MembershipApplication.findById(draft.id).lean())
        ?.communicationLocale
    ).toBe('zh');
    await MembershipApplication.findByIdAndUpdate(draft.id, {
      $set: {
        status: MemberApplicationStatus.REJECTED,
        rejectedAt: new Date(),
      },
    });
    await expect(
      MembershipApplicantAccessService.synchronizeCommunicationLocale(
        draft.id,
        'en'
      )
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      (await MembershipApplication.findById(draft.id).lean())
        ?.communicationLocale
    ).toBe('zh');
  });

  it('keeps a brand-new initial-verification link valid when shared registration rotates', async () => {
    const send = vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
    const sharedToken = await issueRegistrationToken();
    const sharedState = await RegistrationAccessService.getAdminState();
    await MembershipApplicantAccessService.requestInitialVerification(
      'rotate-new@example.test',
      sharedToken,
      'en'
    );
    const verificationToken = tokenFromTemplate(
      send,
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.VERIFY_EMAIL
    );
    await MembershipApplicationAccessToken.updateOne(
      { purpose: 'initial_verification' },
      {
        $set: {
          registrationGeneration: sharedState.generation,
          registrationIssuedAt: new Date(sharedState.updatedAt!),
        },
      }
    );
    await RegistrationAccessService.issue(
      '90_days',
      new mongoose.Types.ObjectId().toString(),
      false
    );

    const result =
      await MembershipApplicantAccessService.consume(verificationToken);
    expect(
      await MembershipApplication.countDocuments({
        verifiedEmail: 'rotate-new@example.test',
      })
    ).toBe(1);
    expect(result.applicationId).toBeTruthy();
  });

  it.each([
    [MemberApplicationStatus.REJECTED, 'rejectedAt'],
    [MemberApplicationStatus.WITHDRAWN, 'withdrawnAt'],
  ] as const)('allows the current shared link after an elapsed %s cooldown', async (status, terminalField) => {
    const send = vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
    const sharedToken = await issueRegistrationToken();
    const terminalAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await RegistrationAccess.updateOne(
      { _id: 'current' },
      { $set: { updatedAt: new Date(terminalAt.getTime() - 60 * 60 * 1000) } },
      { timestamps: false }
    );
    const email = `${status}-fresh-link@example.test`;
    await MembershipApplication.create({
      verifiedEmail: email,
      personalInfo: { email },
      bankingSummary: { present: false, complete: false },
      status,
      [terminalField]: terminalAt,
      applicantDataUpdatedAt: terminalAt,
      createdAt: new Date(terminalAt.getTime() - 60 * 60 * 1000),
    });

    await MembershipApplicantAccessService.requestInitialVerification(
      email,
      sharedToken,
      'en'
    );

    const freshToken = tokenFromTemplate(
      send,
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.VERIFY_EMAIL
    );
    const result = await MembershipApplicantAccessService.consume(freshToken);

    expect(
      await MembershipApplication.findById(result.applicationId).lean()
    ).toMatchObject({
      verifiedEmail: email,
      status: MemberApplicationStatus.DRAFT,
    });
  });

  it('rechecks the independent cooldown when initial verification is consumed', async () => {
    const send = vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
    const sharedToken = await issueRegistrationToken();
    const terminalAt = new Date();
    const email = 'consume-freshness@example.test';
    await MembershipApplicantAccessService.requestInitialVerification(
      email,
      sharedToken,
      'en'
    );
    const verificationToken = tokenFromTemplate(
      send,
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.VERIFY_EMAIL
    );
    await MembershipApplication.create({
      verifiedEmail: email,
      personalInfo: { email },
      bankingSummary: { present: false, complete: false },
      status: MemberApplicationStatus.REJECTED,
      rejectedAt: terminalAt,
      applicantDataUpdatedAt: terminalAt,
    });

    await expect(
      MembershipApplicantAccessService.consume(verificationToken)
    ).rejects.toMatchObject({
      statusCode: 429,
      code: MEMBERSHIP_APPLICATION_POLICY_CODES.RETRY_LATER,
    });
    expect(
      await MembershipApplication.countDocuments({
        verifiedEmail: email,
        status: MemberApplicationStatus.DRAFT,
      })
    ).toBe(0);
  });

  it.each([
    [
      'de',
      'Ein neuer Mitgliedsantrag kann derzeit nicht gestartet werden. Bitte versuche es später erneut.',
      'Für diese E-Mail-Adresse kann kein neuer Mitgliedsantrag gestartet werden. Bitte wende dich unter info@club.invalid an den Verein.',
    ],
    [
      'en',
      'A new membership application cannot be started right now. Please try again later.',
      'A new membership application cannot be started for this email address. Please contact the club at info@club.invalid for help.',
    ],
    [
      'zh',
      '目前无法开始新的会员申请，请稍后再试。',
      '此电子邮箱无法开始新的会员申请。如需帮助，请通过 info@club.invalid 联系俱乐部。',
    ],
  ] as const)('sends safe localized %s guidance for expected policy blocks', async (locale, retryLaterMessage, contactClubMessage) => {
    const send = vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
    const sharedToken = await issueRegistrationToken();
    const retryEmail = `retry-guidance-${locale}@example.test`;
    await MembershipApplication.create({
      verifiedEmail: retryEmail,
      personalInfo: { email: retryEmail },
      bankingSummary: { present: false, complete: false },
      status: MemberApplicationStatus.REJECTED,
      rejectedAt: new Date(),
      applicantDataUpdatedAt: new Date(),
    });

    await MembershipApplicantAccessService.requestInitialVerification(
      retryEmail,
      sharedToken,
      locale
    );

    expect(send).toHaveBeenLastCalledWith(
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.ACCESS_GUIDANCE,
      retryEmail,
      locale,
      { message: retryLaterMessage }
    );
    expect(JSON.stringify(send.mock.calls)).not.toMatch(
      /24|30|3|creation limit|terminal timestamp/i
    );

    send.mockClear();
    const contactEmail = `contact-guidance-${locale}@example.test`;
    await User.create({
      firstName: 'Existing',
      lastName: 'Member',
      email: contactEmail,
      password: 'Test-Only-Password-1!',
      gender: Gender.FEMALE,
      dateOfBirth: '1990-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.ACTIVE,
    });

    await MembershipApplicantAccessService.requestInitialVerification(
      contactEmail,
      sharedToken,
      locale
    );

    expect(send).toHaveBeenLastCalledWith(
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.ACCESS_GUIDANCE,
      contactEmail,
      locale,
      { message: contactClubMessage }
    );
    expect(JSON.stringify(send.mock.calls)).not.toMatch(
      /accountKind|membershipStatus|approved provenance/i
    );
  });

  it('does not present corrupt terminal data as ordinary applicant guidance', async () => {
    const send = vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
    const sharedToken = await issueRegistrationToken();
    const email = 'corrupt-terminal-guidance@example.test';
    await MembershipApplication.collection.insertOne({
      verifiedEmail: email,
      personalInfo: { email },
      bankingSummary: { present: false, complete: false },
      status: MemberApplicationStatus.REJECTED,
      applicantDataUpdatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      MembershipApplicantAccessService.requestInitialVerification(
        email,
        sharedToken,
        'en'
      )
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(send).not.toHaveBeenCalled();
  });

  it('enforces cooldown and rolling creation limits while reusing one active application', async () => {
    const active =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        'same@example.test'
      );
    const reused =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        'same@example.test'
      );
    expect(reused.id).toBe(active.id);
    const draftAdminAttempt =
      await MembershipApplicationService.getAllApplications({
        status: MemberApplicationStatus.DRAFT,
      });
    expect(draftAdminAttempt.applications).toEqual([]);
    expect(draftAdminAttempt.total).toBe(0);

    await MembershipApplication.create({
      verifiedEmail: 'cooldown@example.test',
      personalInfo: { email: 'cooldown@example.test' },
      bankingSummary: { present: false, complete: false },
      status: MemberApplicationStatus.WITHDRAWN,
      withdrawnAt: new Date(),
      applicantDataUpdatedAt: new Date(),
    });
    await expect(
      MembershipApplicationPolicy.assertEmailAvailableForApplication(
        'cooldown@example.test'
      )
    ).rejects.toMatchObject({ statusCode: 429 });

    for (let index = 0; index < 3; index += 1) {
      await MembershipApplication.create({
        verifiedEmail: 'limited@example.test',
        personalInfo: { email: 'limited@example.test' },
        bankingSummary: { present: false, complete: false },
        status: MemberApplicationStatus.REJECTED,
        rejectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        applicantDataUpdatedAt: new Date(),
        createdAt: new Date(Date.now() - (index + 2) * 24 * 60 * 60 * 1000),
      });
    }
    await expect(
      MembershipApplicationPolicy.assertEmailAvailableForApplication(
        'limited@example.test'
      )
    ).rejects.toMatchObject({
      statusCode: 429,
      code: MEMBERSHIP_APPLICATION_POLICY_CODES.RETRY_LATER,
    });

    const identity = {
      firstName: 'Existing',
      lastName: 'Identity',
      password: 'Test-Only-Password-1!',
      gender: Gender.FEMALE,
      dateOfBirth: '1990-01-01',
      membershipStatus: MembershipStatus.INACTIVE,
    };
    await User.create([
      {
        ...identity,
        email: 'applicant-identity@example.test',
        accountKind: AccountKind.PERSON,
        administratorDesignation: false,
      },
      {
        ...identity,
        email: 'external-identity@example.test',
        accountKind: AccountKind.PERSON,
        administratorDesignation: false,
        isPlayer: true,
      },
      {
        ...identity,
        email: 'member@example.test',
        accountKind: AccountKind.PERSON,
        administratorDesignation: false,
        membershipStatus: MembershipStatus.ACTIVE,
      },
      {
        ...identity,
        email: 'admin@example.test',
        accountKind: AccountKind.PERSON,
        administratorDesignation: true,
      },
      {
        ...identity,
        email: 'active-applicant@example.test',
        accountKind: AccountKind.PERSON,
        administratorDesignation: false,
        membershipStatus: MembershipStatus.ACTIVE,
      },
    ]);
    await expect(
      MembershipApplicationPolicy.assertEmailAvailableForApplication(
        'applicant-identity@example.test'
      )
    ).resolves.toBeUndefined();
    await expect(
      MembershipApplicationPolicy.assertEmailAvailableForApplication(
        'external-identity@example.test'
      )
    ).resolves.toBeUndefined();
    for (const blockedEmail of [
      'member@example.test',
      'admin@example.test',
      'active-applicant@example.test',
    ]) {
      await expect(
        MembershipApplicationPolicy.assertEmailAvailableForApplication(
          blockedEmail
        )
      ).rejects.toMatchObject({ statusCode: 409 });
    }

    await MembershipApplication.create({
      verifiedEmail: 'approved@example.test',
      personalInfo: {
        firstName: 'Approved',
        lastName: 'Member',
        email: 'approved@example.test',
        phone: '+49123456789',
        dateOfBirth: '1990-01-01',
        gender: Gender.FEMALE,
        address: {
          street: 'Test 1',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
      },
      membershipType: 'regular',
      bankingSummary: { present: false, complete: false },
      status: MemberApplicationStatus.APPROVED,
      approvedAt: new Date(),
      approvedUserId: new mongoose.Types.ObjectId(),
      applicantDataUpdatedAt: new Date(),
    });
    await expect(
      MembershipApplicationPolicy.assertEmailAvailableForApplication(
        'approved@example.test'
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: MEMBERSHIP_APPLICATION_POLICY_CODES.EMAIL_UNAVAILABLE,
    });
  });

  it('measures cooldown from the latest status-owned terminal transition and fails closed without it', async () => {
    const recentTerminalEmail = 'recent-terminal@example.test';
    await MembershipApplication.create({
      verifiedEmail: recentTerminalEmail,
      personalInfo: { email: recentTerminalEmail },
      bankingSummary: { present: false, complete: false },
      status: MemberApplicationStatus.WITHDRAWN,
      withdrawnAt: new Date(Date.now() - 60_000),
      applicantDataUpdatedAt: new Date(),
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });
    await expect(
      MembershipApplicationPolicy.assertEmailAvailableForApplication(
        recentTerminalEmail
      )
    ).rejects.toMatchObject({ statusCode: 429 });

    const elapsedEmail = 'elapsed-terminal@example.test';
    await MembershipApplication.create({
      verifiedEmail: elapsedEmail,
      personalInfo: { email: elapsedEmail },
      bankingSummary: { present: false, complete: false },
      status: MemberApplicationStatus.REJECTED,
      rejectedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      applicantDataUpdatedAt: new Date(),
    });
    await expect(
      MembershipApplicationPolicy.assertEmailAvailableForApplication(
        elapsedEmail
      )
    ).resolves.toBeUndefined();

    const competingEmail = 'competing-terminal@example.test';
    await MembershipApplication.create([
      {
        verifiedEmail: competingEmail,
        personalInfo: { email: competingEmail },
        bankingSummary: { present: false, complete: false },
        status: MemberApplicationStatus.WITHDRAWN,
        withdrawnAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        applicantDataUpdatedAt: new Date(),
      },
      {
        verifiedEmail: competingEmail,
        personalInfo: { email: competingEmail },
        bankingSummary: { present: false, complete: false },
        status: MemberApplicationStatus.REJECTED,
        rejectedAt: new Date(Date.now() - 60_000),
        applicantDataUpdatedAt: new Date(),
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      },
    ]);
    await expect(
      MembershipApplicationPolicy.assertEmailAvailableForApplication(
        competingEmail
      )
    ).rejects.toMatchObject({ statusCode: 429 });

    const invalidEmail = 'missing-terminal-time@example.test';
    await MembershipApplication.collection.insertOne({
      verifiedEmail: invalidEmail,
      personalInfo: { email: invalidEmail },
      bankingSummary: { present: false, complete: false },
      status: MemberApplicationStatus.REJECTED,
      applicantDataUpdatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(
      MembershipApplicationPolicy.assertEmailAvailableForApplication(
        invalidEmail
      )
    ).rejects.toMatchObject({
      statusCode: 500,
      message: 'Membership Application terminal timestamp is invalid',
    });
  });

  it('notifies only on submit, permits pending correction, and revokes all access on withdrawal', async () => {
    const send = vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
    const draft =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        'submit@example.test'
      );
    expect(send).not.toHaveBeenCalled();
    await expect(
      MembershipApplicationService.submitApplicantApplication(draft.id)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_FAILED',
      details: {
        fields: expect.arrayContaining([
          'firstName',
          'lastName',
          'dateOfBirth',
          'gender',
          'street',
          'city',
          'postalCode',
          'membershipType',
        ]),
      },
    });
    expect(
      await MembershipApplication.findById(draft.id)
        .select('status submittedAt')
        .lean()
    ).toMatchObject({
      status: MemberApplicationStatus.DRAFT,
    });
    await MembershipApplicationService.saveApplicantData(draft.id, {
      personalInfo: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '+49123456789',
        dateOfBirth: '1990-01-01',
        gender: Gender.FEMALE,
        address: {
          street: 'Test 1',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
      },
      membershipType: 'regular',
    });
    const submitted =
      await MembershipApplicationService.submitApplicantApplication(draft.id);
    expect(submitted.status).toBe(MemberApplicationStatus.PENDING);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([
        'application_received',
        'application_admin_alert',
      ])
    );
    const adminAlert = send.mock.calls.find(
      (call) => call[0] === 'application_admin_alert'
    );
    expect(adminAlert).toMatchObject([
      'application_admin_alert',
      'admin@example.test',
      'de',
      expect.objectContaining({
        membershipType: 'Reguläre Mitgliedschaft',
        applicationUrl: expect.stringMatching(
          /\/de\/dashboard\/applications\?application=[a-f0-9]{24}$/
        ),
      }),
    ]);
    expect(adminAlert?.[3].applicationUrl).not.toContain(
      `/dashboard/applications/${draft.id}`
    );
    const receivedCall = send.mock.calls.find(
      (call) => call[0] === 'application_received'
    );
    expect(receivedCall?.[3]).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(receivedCall?.[4]?.attachments).toBeUndefined();
    await MembershipApplicationService.saveApplicantData(draft.id, {
      bankingInfo: { accountHolderType: 'same', iban: 'DE02' },
    });
    const rawSession = 'test-applicant-session';
    const cookieSlotId = 'a'.repeat(22);
    await MembershipApplicantSession.create({
      tokenDigest: createHash('sha256').update(rawSession).digest('hex'),
      cookieSlotId,
      applicationId: draft.id,
      applicantAccessEpoch: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await MembershipApplicationAccessToken.create({
      purpose: 'application_access',
      tokenDigest: 'b'.repeat(64),
      targetKey: draft.id,
      email: 'submit@example.test',
      applicationId: draft.id,
      expiresAt: new Date(Date.now() + 60_000),
      cleanupAt: new Date(Date.now() + 120_000),
    });
    expect(
      (
        await MembershipApplicantAccessService.resolveSessionCookies(
          `${APPLICANT_SESSION_COOKIE_PREFIX}${cookieSlotId}=${rawSession}`
        )
      ).applicationId
    ).toBe(draft.id);
    const withdrawn =
      await MembershipApplicationService.withdrawApplicantApplication(draft.id);
    expect(withdrawn.status).toBe(MemberApplicationStatus.WITHDRAWN);
    expect(withdrawn.withdrawnAt).toBeInstanceOf(Date);
    expect(
      await MembershipApplicantSession.countDocuments({
        applicationId: draft.id,
      })
    ).toBe(0);
    expect(
      await MembershipApplicationAccessToken.countDocuments({
        applicationId: draft.id,
      })
    ).toBe(0);
    await expect(
      MembershipApplicationService.getApplicantApplication(draft.id)
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(
      (
        await MembershipApplicantAccessService.resolveSessionCookies(
          `${APPLICANT_SESSION_COOKIE_PREFIX}${cookieSlotId}=${rawSession}`
        )
      ).applicationId
    ).toBeUndefined();
  });

  it.each([
    { phone: 'abc', dateOfBirth: '1990-01-01' },
    { phone: '+49123456789', dateOfBirth: '2026-02-30' },
    { phone: '+49123456789', dateOfBirth: '9999-99-99' },
  ])('keeps invalid partial core data draft-saveable but rejects submission: $phone / $dateOfBirth', async ({
    phone,
    dateOfBirth,
  }) => {
    const draft =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        `${randomUUID()}@example.test`
      );
    await expect(
      MembershipApplicationService.saveApplicantData(draft.id, {
        personalInfo: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          phone,
          dateOfBirth,
          gender: Gender.FEMALE,
          address: {
            street: 'Test 1',
            city: 'Berlin',
            postalCode: '10115',
            country: 'DE',
          },
        },
        membershipType: 'regular',
      })
    ).resolves.toMatchObject({ status: MemberApplicationStatus.DRAFT });
    await expect(
      MembershipApplicationService.submitApplicantApplication(draft.id)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_FAILED',
      details: {
        fields: expect.arrayContaining([
          ...(phone === 'abc' ? ['phone'] : []),
          ...(dateOfBirth !== '1990-01-01' ? ['dateOfBirth'] : []),
        ]),
      },
    });
    expect(
      (await MembershipApplication.findById(draft.id).lean())?.status
    ).toBe(MemberApplicationStatus.DRAFT);
  });

  it('keeps unmapped persisted-data contradictions out of the applicant-correctable 400 contract', async () => {
    const draft =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        'unmapped-submission@example.test'
      );
    await MembershipApplication.findByIdAndUpdate(draft.id, {
      $set: {
        personalInfo: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'unmapped-submission@example.test',
          dateOfBirth: '1990-01-01',
          gender: Gender.FEMALE,
          address: {
            street: 'Test 1',
            city: 'Berlin',
            postalCode: '10115',
            country: 'France',
          },
        },
        membershipType: 'regular',
      },
    });

    await expect(
      MembershipApplicationService.submitApplicantApplication(draft.id)
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      details: undefined,
    });
  });

  it('keeps the old email authoritative until a single-use email-change link succeeds', async () => {
    const send = vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
    const draft =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        'old@example.test'
      );
    await MembershipApplication.findByIdAndUpdate(draft.id, {
      $set: {
        status: MemberApplicationStatus.PENDING,
        personalInfo: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'old@example.test',
          phone: '+49123456789',
          dateOfBirth: '1990-01-01',
          gender: 'female',
          address: {
            street: 'Test 1',
            city: 'Berlin',
            postalCode: '10115',
            country: 'DE',
          },
        },
        membershipType: 'regular',
        submittedAt: new Date(),
        signedApplicationReceipt: {
          receivedAt: new Date(),
          receivedBy: new mongoose.Types.ObjectId(),
        },
      },
    });
    await MembershipApplicantAccessService.requestEmailChange(
      draft.id,
      'new@example.test',
      'en'
    );
    const collidingToken = tokenFromEmailSpy(send);
    expect(
      (await MembershipApplication.findById(draft.id).lean())!
        .communicationLocale
    ).toBe('en');
    expect(
      (await MembershipApplication.findById(draft.id).lean())!.verifiedEmail
    ).toBe('old@example.test');
    const collision =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        'new@example.test'
      );
    await expect(
      MembershipApplicantAccessService.consume(collidingToken)
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      (await MembershipApplication.findById(draft.id).lean())!.verifiedEmail
    ).toBe('old@example.test');
    await MembershipApplication.findByIdAndDelete(collision.id);

    await MembershipApplicantAccessService.requestEmailChange(
      draft.id,
      'new@example.test',
      'zh'
    );
    const token = tokenFromEmailSpy(send);
    await MembershipApplicantAccessService.consume(token);
    const switched = await MembershipApplication.findById(draft.id).lean();
    expect(switched!.verifiedEmail).toBe('new@example.test');
    expect(switched!.personalInfo.email).toBe('new@example.test');
    expect(switched!.communicationLocale).toBe('zh');
    expect(switched!.signedApplicationReceipt?.resetReason).toBe(
      'applicant_application_data_changed'
    );
    await expect(
      MembershipApplicantAccessService.consume(token)
    ).rejects.toThrow('invalid or expired');

    send.mockClear();
    await MembershipApplicantAccessService.requestApplicationAccess(
      'old@example.test',
      'en'
    );
    expect(send).not.toHaveBeenCalled();
    await MembershipApplicantAccessService.requestApplicationAccess(
      'new@example.test',
      'en'
    );
    expect(send).toHaveBeenCalledWith(
      'application_access',
      'new@example.test',
      'en',
      expect.objectContaining({ accessUrl: expect.stringContaining('#token=') })
    );
  });

  it('keeps a new-epoch browser session usable when a stale consume response completes last', async () => {
    const send = vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
    const draft =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        'race-old@example.test'
      );
    await MembershipApplication.findByIdAndUpdate(draft.id, {
      $set: {
        status: MemberApplicationStatus.PENDING,
        personalInfo: {
          firstName: 'Race',
          lastName: 'Applicant',
          email: 'race-old@example.test',
          phone: '+49123456789',
          dateOfBirth: '1990-01-01',
          gender: Gender.FEMALE,
          address: {
            street: 'Test 1',
            city: 'Berlin',
            postalCode: '10115',
            country: 'DE',
          },
        },
        membershipType: 'regular',
        submittedAt: new Date(),
      },
    });
    await MembershipApplicantAccessService.requestApplicationAccess(
      'race-old@example.test',
      'en'
    );
    const staleToken = tokenFromEmailSpy(send);
    await MembershipApplicantAccessService.requestEmailChange(
      draft.id,
      'race-new@example.test',
      'en'
    );
    const switchToken = tokenFromEmailSpy(send);

    const originalSave = MembershipApplicantSession.prototype.save;
    let releaseStaleSave!: () => void;
    let staleSaveReached!: () => void;
    const staleSaveGate = new Promise<void>((resolve) => {
      releaseStaleSave = resolve;
    });
    const staleSaveStarted = new Promise<void>((resolve) => {
      staleSaveReached = resolve;
    });
    let paused = false;
    vi.spyOn(MembershipApplicantSession.prototype, 'save').mockImplementation(
      async function (options: any) {
        if (!paused && accessEpochForTest(this.applicantAccessEpoch) === 0) {
          paused = true;
          staleSaveReached();
          await staleSaveGate;
        }
        return originalSave.call(this, options) as never;
      }
    );

    const staleConsume = MembershipApplicantAccessService.consume(staleToken);
    await staleSaveStarted;
    const current = await MembershipApplicantAccessService.consume(switchToken);
    releaseStaleSave();
    const stale = await staleConsume;

    const application = await MembershipApplication.findById(draft.id).lean();
    expect(application?.verifiedEmail).toBe('race-new@example.test');
    expect(application?.applicantAccessEpoch).toBe(1);
    expect(stale.cookieSlotId).not.toBe(current.cookieSlotId);

    const resolved =
      await MembershipApplicantAccessService.resolveSessionCookies(
        `${cookieHeader(current)}; ${cookieHeader(stale)}`
      );
    expect(resolved.applicationId).toBe(draft.id);
    expect(resolved.clearCookieNames).toContain(
      `${APPLICANT_SESSION_COOKIE_PREFIX}${stale.cookieSlotId}`
    );
    expect(resolved.clearCookieNames).not.toContain(
      `${APPLICANT_SESSION_COOKIE_PREFIX}${current.cookieSlotId}`
    );
    expect(
      await MembershipApplicantSession.countDocuments({
        applicationId: draft.id,
      })
    ).toBe(1);
    expect(
      (
        await MembershipApplicantSession.findOne({
          applicationId: draft.id,
        }).lean()
      )?.applicantAccessEpoch
    ).toBe(1);
  });

  it('selects the newest valid opaque slot and fails closed above the candidate limit', async () => {
    const draft =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        'slots@example.test'
      );
    const older = {
      sessionToken: 'older-session-token',
      cookieSlotId: 'o'.repeat(22),
      applicationId: draft.id,
    };
    const newer = {
      sessionToken: 'newer-session-token',
      cookieSlotId: 'n'.repeat(22),
      applicationId: draft.id,
    };
    await MembershipApplicantSession.create([
      {
        tokenDigest: createHash('sha256')
          .update(older.sessionToken)
          .digest('hex'),
        cookieSlotId: older.cookieSlotId,
        applicationId: draft.id,
        applicantAccessEpoch: 0,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(Date.now() - 1_000),
      },
      {
        tokenDigest: createHash('sha256')
          .update(newer.sessionToken)
          .digest('hex'),
        cookieSlotId: newer.cookieSlotId,
        applicationId: draft.id,
        applicantAccessEpoch: 0,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      },
    ]);

    const selected =
      await MembershipApplicantAccessService.resolveSessionCookies(
        `${cookieHeader(older)}; ${cookieHeader(newer)}`
      );
    expect(selected.applicationId).toBe(draft.id);
    expect(selected.clearCookieNames).toEqual([
      `${APPLICANT_SESSION_COOKIE_PREFIX}${older.cookieSlotId}`,
    ]);
    expect(
      await MembershipApplicantSession.exists({
        cookieSlotId: newer.cookieSlotId,
      })
    ).not.toBeNull();

    const excessiveHeader = Array.from(
      { length: MAX_APPLICANT_SESSION_COOKIE_SLOTS + 1 },
      (_, index) =>
        `${APPLICANT_SESSION_COOKIE_PREFIX}${String(index).padStart(22, 'a')}=unused`
    ).join('; ');
    const query = vi.spyOn(MembershipApplicantSession, 'find');
    const rejected =
      await MembershipApplicantAccessService.resolveSessionCookies(
        excessiveHeader
      );
    expect(rejected.applicationId).toBeUndefined();
    expect(rejected.clearCookieNames).toHaveLength(
      MAX_APPLICANT_SESSION_COOKIE_SLOTS
    );
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    MemberApplicationStatus.APPROVED,
    MemberApplicationStatus.REJECTED,
  ])('keeps %s applications readable but immutable during retention', async (status) => {
    vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
    const email = `${status}@example.test`;
    const draft =
      await MembershipApplicationService.createDraftForVerifiedEmail(email);
    await MembershipApplicationService.saveApplicantData(draft.id, {
      personalInfo: {
        firstName: 'Terminal',
        lastName: 'Applicant',
        phone: '+49123456789',
        dateOfBirth: '1990-01-01',
        gender: Gender.FEMALE,
        address: {
          street: 'Test 1',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
      },
      membershipType: 'regular',
      bankingInfo: {
        accountHolderType: 'same',
        iban: 'DE02120300000000202051',
      },
    });
    await MembershipApplicationService.submitApplicantApplication(draft.id);
    await MembershipApplication.findByIdAndUpdate(draft.id, {
      $set:
        status === MemberApplicationStatus.APPROVED
          ? { status, approvedAt: new Date() }
          : { status, rejectedAt: new Date(), rejectionReason: 'Capacity' },
    });
    const result = await MembershipApplicationService.getApplicantApplication(
      draft.id
    );
    expect(result.application.status).toBe(status);
    expect(result.application.bankingSummary).toEqual({
      present: true,
      complete: false,
      ibanLastFour: '2051',
    });
    expect(result.bankingInfo).toBeUndefined();
    await expect(
      MembershipApplicationService.saveApplicantData(draft.id, {
        personalInfo: { firstName: 'Changed' },
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
