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
  AccountOnboardingStatus,
  Gender,
  MemberApplicationStatus,
  MembershipStatus,
  MembershipType,
  PlayerPosition,
  PlayerType,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';
import { AuditLog } from '../../models/AuditLog';
import { MembershipApplication } from '../../models/MembershipApplication';
import { MembershipApplicationAccessToken } from '../../models/MembershipApplicationAccessToken';
import { MembershipApplicantSession } from '../../models/MembershipApplicantSession';
import { MemberBankingProfile } from '../../models/MemberBankingProfile';
import { MembershipLifecycleEvent } from '../../models/MembershipLifecycleEvent';
import { Player } from '../../models/Player';
import { RegistrationApprovalEvent } from '../../models/RegistrationApprovalEvent';
import { RegistrationAccess } from '../../models/RegistrationAccess';
import { User } from '../../models/User';
import EmailService from '../../services/emailService';
import { PasswordSetupService } from '../../services/passwordSetupService';
import { RegistrationApprovalService } from '../../services/registrationApprovalService';
import { bankingCryptoService } from '../../services/bankingCryptoService';
import { MembershipApplicantAccessService } from '../../services/membershipApplicantAccessService';
import { MembershipApplicationService } from '../../services/membershipApplicationService';
import { MembershipSignedReceiptService } from '../../services/membershipSignedReceiptService';
import { RegistrationAccessService } from '../../services/registrationAccessService';
import { MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES } from '../../services/emailContracts/membershipApplication';

let mongoLease: MongoTestDatabaseLease;
const actor = {
  id: new mongoose.Types.ObjectId().toString(),
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  administratorDesignation: true,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
};

async function application(email: string) {
  const id = new mongoose.Types.ObjectId();
  const banking = {
    accountHolderType: 'same' as const,
    bankName: 'Bank',
    iban: 'DE02120300000000202051',
    bic: 'BYLADEM1001',
    debitFrequency: 'quarterly' as const,
  };
  return MembershipApplication.create({
    _id: id,
    verifiedEmail: email,
    personalInfo: {
      firstName: 'Existing',
      lastName: 'Identity',
      email,
      phone: '+49123456789',
      dateOfBirth: '1990-01-01',
      gender: Gender.FEMALE,
      address: {
        street: 'Main 1',
        city: 'Trossingen',
        postalCode: '78647',
        country: 'DE',
      },
    },
    membershipType: MembershipType.REGULAR,
    encryptedBanking: bankingCryptoService.encrypt(
      banking,
      'membership-application',
      id.toString()
    ),
    bankingSummary: { present: true, complete: true, ibanLastFour: '2051' },
    signedApplicationReceipt: {
      receivedAt: new Date(),
      receivedBy: new mongoose.Types.ObjectId(),
    },
    signedSepaReceipt: {
      receivedAt: new Date(),
      receivedBy: new mongoose.Types.ObjectId(),
    },
    status: MemberApplicationStatus.PENDING,
    submittedAt: new Date(),
    applicantDataUpdatedAt: new Date(),
  });
}

async function identity(
  email: string,
  isPlayer = false,
  onboarding = AccountOnboardingStatus.READY
) {
  return User.create({
    email,
    firstName: 'Existing',
    lastName: 'Identity',
    password:
      onboarding === AccountOnboardingStatus.READY
        ? 'ValidPassword1'
        : undefined,
    gender: Gender.FEMALE,
    dateOfBirth: '1990-01-01',
    accountKind: AccountKind.PERSON,
    administratorDesignation: false,
    membershipStatus: MembershipStatus.INACTIVE,
    accountOnboardingStatus: onboarding,
    isPlayer,
  });
}

async function controlledPendingApplication(email: string) {
  await RegistrationAccessService.issue('30_days', actor.id, false);
  const registrationPath = (await RegistrationAccessService.getAdminState())
    .path;
  const registrationToken = registrationPath
    ? new URL(registrationPath, 'https://example.test').searchParams.get('k')
    : undefined;
  if (!registrationToken) {
    throw new Error('Expected a retrievable registration token');
  }
  await MembershipApplicantAccessService.requestInitialVerification(
    email,
    registrationToken,
    'en'
  );
  const verificationCall = [
    ...vi.mocked(EmailService.sendFromTemplate).mock.calls,
  ]
    .reverse()
    .find(
      (call) => call[0] === MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.VERIFY_EMAIL
    );
  const accessUrl = verificationCall?.[3].accessUrl as string;
  const verificationToken = new URL(
    accessUrl.replace('#', '?')
  ).searchParams.get('token')!;
  const { applicationId } =
    await MembershipApplicantAccessService.consume(verificationToken);
  await MembershipApplicationService.saveApplicantData(applicationId, {
    personalInfo: {
      firstName: 'Existing',
      lastName: 'Identity',
      phone: '+49123456789',
      dateOfBirth: '1990-01-01',
      gender: Gender.FEMALE,
      address: {
        street: 'Main 1',
        city: 'Trossingen',
        postalCode: '78647',
        country: 'DE',
      },
    },
    membershipType: MembershipType.REGULAR,
    bankingInfo: {
      accountHolderType: 'same',
      bankName: 'Bank',
      iban: 'DE02120300000000202051',
      bic: 'BYLADEM1001',
      debitFrequency: 'quarterly',
    },
  });
  await MembershipApplicationService.submitApplicantApplication(applicationId);
  await MembershipSignedReceiptService.confirm(
    applicationId,
    'application',
    actor.id
  );
  await MembershipSignedReceiptService.confirm(applicationId, 'sepa', actor.id);
  await vi.waitFor(() =>
    expect(
      vi
        .mocked(EmailService.sendFromTemplate)
        .mock.calls.some(
          (call) => call[0] === MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.RECEIVED
        )
    ).toBe(true)
  );
  return MembershipApplication.findById(applicationId).orFail();
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase(
    'registrationApprovalIdentityConversion'
  );
  mongoLease.assertOwnedDatabase();
  await User.syncIndexes();
  await Player.syncIndexes();
  await MembershipApplication.syncIndexes();
  await MembershipApplicationAccessToken.syncIndexes();
  await MembershipApplicantSession.syncIndexes();
  await RegistrationAccess.syncIndexes();
  await MemberBankingProfile.syncIndexes();
  await AuditLog.syncIndexes();
  await MembershipLifecycleEvent.syncIndexes();
  await RegistrationApprovalEvent.syncIndexes();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await User.deleteMany({});
  await Player.deleteMany({});
  await MembershipApplication.deleteMany({});
  await MembershipApplicationAccessToken.deleteMany({});
  await MembershipApplicantSession.deleteMany({});
  await RegistrationAccess.deleteMany({});
  await MemberBankingProfile.deleteMany({});
  await AuditLog.deleteMany({});
  await MembershipLifecycleEvent.deleteMany({});
  await RegistrationApprovalEvent.deleteMany({});
  process.env.FRONTEND_URL = 'https://club.example.test';
  vi.restoreAllMocks();
  vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
});

afterAll(async () => {
  await mongoLease.release();
});

describe('registration approval identity conversion', () => {
  it('takes an inactive Applicant through controlled intake and reuses the same User without a Player', async () => {
    const user = await identity('applicant@example.test');
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          gender: Gender.MALE,
          phone: '+49 30 999',
          address: {
            street: 'Old 1',
            city: 'Berlin',
            postalCode: '10115',
            country: 'Deutschland',
          },
        },
      }
    );
    const source = await controlledPendingApplication(user.email);
    const deliveryCount = vi.mocked(EmailService.sendFromTemplate).mock.calls
      .length;
    const first = await RegistrationApprovalService.approve({
      applicationId: source._id.toString(),
      idempotencyKey: 'convert-ready-applicant',
      actor,
    });
    const replay = await RegistrationApprovalService.approve({
      applicationId: source._id.toString(),
      idempotencyKey: 'convert-ready-applicant',
      actor,
    });
    expect(first).toMatchObject({
      userId: user._id.toString(),
      replayed: false,
      setupRequired: false,
      setupGeneration: 0,
    });
    expect(replay.replayed).toBe(true);
    expect(EmailService.sendFromTemplate).toHaveBeenCalledTimes(
      deliveryCount + 1
    );
    expect(await User.findById(user._id)).toMatchObject({
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      firstName: 'Existing',
      lastName: 'Identity',
      dateOfBirth: '1990-01-01',
      gender: Gender.FEMALE,
      phone: '+49123456789',
      address: {
        street: 'Main 1',
        city: 'Trossingen',
        postalCode: '78647',
        country: 'Deutschland',
      },
    });
    expect(await Player.countDocuments({ userId: user._id })).toBe(0);
  });

  it('preserves an existing canonical phone when the approved application omitted phone', async () => {
    const user = await identity('no-phone@example.test');
    await User.updateOne({ _id: user._id }, { $set: { phone: '+49 30 777' } });
    const source = await application(user.email);
    await MembershipApplication.updateOne(
      { _id: source._id },
      { $unset: { 'personalInfo.phone': '' } }
    );

    await RegistrationApprovalService.approve({
      applicationId: source._id.toString(),
      idempotencyKey: 'preserve-existing-phone',
      actor,
    });

    expect((await User.findById(user._id))?.phone).toBe('+49 30 777');
    expect(await User.countDocuments({ email: user.email })).toBe(1);
  });

  it('uses one new setup generation for an existing pending applicant', async () => {
    const user = await identity(
      'pending@example.test',
      false,
      AccountOnboardingStatus.PASSWORD_SETUP_PENDING
    );
    const prior = await PasswordSetupService.issue(user._id.toString());
    const source = await application(user.email);
    const result = await RegistrationApprovalService.approve({
      applicationId: source._id.toString(),
      idempotencyKey: 'convert-pending-applicant',
      actor,
    });
    expect(result).toMatchObject({
      userId: user._id.toString(),
      setupRequired: true,
      setupGeneration: prior.generation + 1,
      replayed: false,
    });
    expect(EmailService.sendFromTemplate).toHaveBeenCalledTimes(2);
    await RegistrationApprovalService.approve({
      applicationId: source._id.toString(),
      idempotencyKey: 'convert-pending-applicant',
      actor,
    });
    expect((await User.findById(user._id))?.passwordSetupGeneration).toBe(
      prior.generation + 1
    );
    expect(EmailService.sendFromTemplate).toHaveBeenCalledTimes(2);
  });

  it('takes an External Player through controlled intake and preserves the same User and Player', async () => {
    const user = await identity('external@example.test', true);
    const teamId = new mongoose.Types.ObjectId();
    const player = await Player.create({
      userId: user._id,
      type: PlayerType.EXTERNAL,
      singlesRanking: 41,
      doublesRanking: 52,
      preferredPositions: [PlayerPosition.DOUBLES],
      isActivePlayer: false,
      teamIds: [teamId],
    });
    const source = await controlledPendingApplication(user.email);
    const result = await RegistrationApprovalService.approve({
      applicationId: source._id.toString(),
      idempotencyKey: 'convert-external-player',
      actor,
    });
    expect(result).toMatchObject({
      userId: user._id.toString(),
      playerId: player._id.toString(),
      setupRequired: false,
    });
    expect(await Player.findById(player._id)).toMatchObject({
      type: PlayerType.MEMBER,
      isActivePlayer: false,
      singlesRanking: 41,
      doublesRanking: 52,
      preferredPositions: [PlayerPosition.DOUBLES],
      teamIds: [teamId],
    });
  });

  it('preserves one compatible existing Member Player without duplication', async () => {
    const user = await User.create({
      email: 'member-player@example.test',
      firstName: 'Existing',
      lastName: 'Identity',
      password: 'Test-Only-Password-1!',
      gender: Gender.FEMALE,
      dateOfBirth: '1990-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.ACTIVE,
      membershipType: MembershipType.REGULAR,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
    });
    const player = await Player.create({
      userId: user._id,
      type: PlayerType.MEMBER,
      isActivePlayer: true,
      singlesRanking: 33,
      doublesRanking: 44,
    });
    const source = await application(user.email);
    const result = await RegistrationApprovalService.approve({
      applicationId: source.id,
      idempotencyKey: 'preserve-member-player',
      actor,
    });
    expect(result.playerId).toBe(player.id);
    expect(await Player.countDocuments({ userId: user._id })).toBe(1);
    expect(await Player.findById(player.id)).toMatchObject({
      singlesRanking: 33,
      doublesRanking: 44,
    });
  });

  it('rolls back an existing identity conversion and leaves the application retryable', async () => {
    const user = await identity('rollback@example.test');
    const source = await application(user.email);
    vi.spyOn(MembershipApplication.prototype, 'save').mockRejectedValueOnce(
      new Error('injected conversion failure')
    );
    await expect(
      RegistrationApprovalService.approve({
        applicationId: source._id.toString(),
        idempotencyKey: 'convert-rollback',
        actor,
      })
    ).rejects.toThrow('injected conversion failure');
    expect(await User.findById(user._id)).toMatchObject({
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.INACTIVE,
    });
    expect(await Player.countDocuments({ userId: user._id })).toBe(0);
    expect(await RegistrationApprovalEvent.countDocuments({})).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
    expect((await MembershipApplication.findById(source._id))?.status).toBe(
      MemberApplicationStatus.PENDING_REVIEW
    );
  });

  it('requires review without writes when an existing Member has a different Membership type', async () => {
    const user = await User.create({
      email: 'type-mismatch@example.test',
      firstName: 'Existing',
      lastName: 'Identity',
      password: 'Test-Only-Password-1!',
      gender: Gender.FEMALE,
      dateOfBirth: '1990-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.ACTIVE,
      membershipType: MembershipType.STUDENT,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      isPlayer: false,
    });
    const source = await application(user.email);

    await expect(
      RegistrationApprovalService.approve({
        applicationId: source._id.toString(),
        idempotencyKey: 'member-type-mismatch',
        actor,
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(await User.findById(user._id)).toMatchObject({
      membershipType: MembershipType.STUDENT,
      membershipStatus: MembershipStatus.ACTIVE,
    });
    expect(await Player.countDocuments({ userId: user._id })).toBe(0);
    expect(await RegistrationApprovalEvent.countDocuments({})).toBe(0);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
    expect(await MembershipApplication.findById(source._id)).toMatchObject({
      status: MemberApplicationStatus.PENDING_REVIEW,
      approvedUserId: undefined,
    });
  });

  it('commits one logical result under concurrent valid conversion', async () => {
    const user = await identity('concurrent@example.test');
    const source = await application(user.email);
    const command = {
      applicationId: source._id.toString(),
      idempotencyKey: 'convert-concurrently',
      actor,
    };
    const settled = await Promise.allSettled([
      RegistrationApprovalService.approve(command),
      RegistrationApprovalService.approve(command),
    ]);
    expect(settled.some((entry) => entry.status === 'fulfilled')).toBe(true);
    expect(
      await User.countDocuments({
        _id: user._id,
        accountKind: AccountKind.PERSON,
        administratorDesignation: false,
        membershipStatus: MembershipStatus.ACTIVE,
      })
    ).toBe(1);
    expect(await Player.countDocuments({ userId: user._id })).toBe(0);
    expect(await RegistrationApprovalEvent.countDocuments({})).toBe(1);
    expect(await AuditLog.countDocuments({})).toBe(2);
  });
});
