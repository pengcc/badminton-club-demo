import { MemberApplicationStatus } from '@club/shared-types/core/enums';
import { getBankingSummary } from '@club/shared-types/domain/membershipApplication';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import { MemberBankingProfile } from '../../models/MemberBankingProfile';
import { MembershipApplication } from '../../models/MembershipApplication';
import {
  RegistrationApprovalEvent,
  RegistrationApprovalStatus,
} from '../../models/RegistrationApprovalEvent';
import { BankingCryptoService } from '../../services/bankingCryptoService';
import { MembershipApplicationBankingIntegrityService } from '../../services/membershipApplicationBankingIntegrityService';

let mongoLease: MongoTestDatabaseLease;
const crypto = new BankingCryptoService({
  activeKeyVersion: 'test-v1',
  keys: { 'test-v1': Buffer.alloc(32, 19).toString('base64') },
});

function banking() {
  return {
    accountHolderType: 'different',
    accountHolderFirstName: 'Current',
    accountHolderLastName: 'Payer',
    accountHolderAddress: 'Current 1, Berlin',
    bankName: 'Current Bank',
    iban: 'DE02120300000000202051',
    bic: 'BYLADEM1001',
    debitFrequency: 'quarterly',
  } as const;
}

async function recordCompletedApproval(
  applicationId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<void> {
  await RegistrationApprovalEvent.create({
    applicationId,
    idempotencyKey: `approval-${applicationId.toString()}`,
    intentFingerprint: 'fingerprint',
    status: RegistrationApprovalStatus.COMPLETED,
    result: {
      applicationId: applicationId.toString(),
      userId: userId.toString(),
      setupGeneration: 1,
      setupRequired: true,
    },
  });
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase(
    'membershipApplicationBankingIntegrity'
  );
  mongoLease.assertOwnedDatabase();
  await RegistrationApprovalEvent.syncIndexes();
  await MemberBankingProfile.syncIndexes();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await MembershipApplication.collection.deleteMany({});
  await RegistrationApprovalEvent.deleteMany({});
  await MemberBankingProfile.deleteMany({});
});

afterAll(async () => {
  await mongoLease.release();
});

describe('Membership Application banking integrity', () => {
  it('blocks current Draft and Pending envelopes that require an unavailable configured key version', async () => {
    const draftId = new mongoose.Types.ObjectId();
    const pendingId = new mongoose.Types.ObjectId();
    await MembershipApplication.collection.insertMany([
      {
        _id: draftId,
        status: MemberApplicationStatus.DRAFT,
        encryptedBanking: {
          keyVersion: 'missing',
          nonce: 'n',
          ciphertext: 'c',
          authTag: 't',
        },
      },
      {
        _id: pendingId,
        status: MemberApplicationStatus.PENDING,
        encryptedBanking: {
          keyVersion: 'missing',
          nonce: 'n',
          ciphertext: 'c',
          authTag: 't',
        },
      },
    ]);

    await expect(
      new MembershipApplicationBankingIntegrityService(
        crypto
      ).inspectReleaseCompatibility()
    ).resolves.toEqual({
      inspected: 2,
      referencedKeyVersionCount: 1,
      unavailableKeyVersionCount: 1,
      ready: false,
    });
  });

  it('keeps terminal banking and corrupt current ciphertext outside the key-version compatibility claim', async () => {
    const pendingId = new mongoose.Types.ObjectId();
    await MembershipApplication.collection.insertMany([
      {
        _id: pendingId,
        status: MemberApplicationStatus.PENDING,
        encryptedBanking: {
          keyVersion: 'test-v1',
          nonce: 'invalid',
          ciphertext: 'invalid',
          authTag: 'invalid',
        },
      },
      {
        _id: new mongoose.Types.ObjectId(),
        status: MemberApplicationStatus.APPROVED,
        encryptedBanking: {
          keyVersion: 'missing',
          nonce: 'n',
          ciphertext: 'c',
          authTag: 't',
        },
      },
    ]);
    const service = new MembershipApplicationBankingIntegrityService(crypto);

    await expect(service.inspectReleaseCompatibility()).resolves.toEqual({
      inspected: 1,
      referencedKeyVersionCount: 1,
      unavailableKeyVersionCount: 0,
      ready: true,
    });
    await expect(service.verifyReady()).resolves.toMatchObject({
      ready: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          applicationId: pendingId.toString(),
          flags: ['encrypted_banking_unreadable'],
        }),
      ]),
    });
  });

  it('accepts readable current encrypted banking', async () => {
    const applicationId = new mongoose.Types.ObjectId();
    await MembershipApplication.collection.insertOne({
      _id: applicationId,
      status: MemberApplicationStatus.PENDING,
      encryptedBanking: crypto.encrypt(
        banking(),
        'membership-application',
        applicationId.toString()
      ),
    });

    await expect(
      new MembershipApplicationBankingIntegrityService(crypto).verifyReady()
    ).resolves.toEqual({ inspected: 1, ready: true, findings: [] });
  });

  it('fails readiness for unreadable encrypted banking', async () => {
    const applicationId = new mongoose.Types.ObjectId();
    await MembershipApplication.collection.insertOne({
      _id: applicationId,
      status: MemberApplicationStatus.PENDING,
      encryptedBanking: {
        keyVersion: 'missing',
        nonce: 'n',
        ciphertext: 'c',
        authTag: 't',
      },
    });

    const report = await new MembershipApplicationBankingIntegrityService(
      crypto
    ).verifyReady();

    expect(report).toMatchObject({ inspected: 1, ready: false });
    expect(report.findings).toEqual([
      expect.objectContaining({
        applicationId: applicationId.toString(),
        flags: ['encrypted_banking_unreadable'],
      }),
    ]);
    await expect(
      new MembershipApplicationBankingIntegrityService(
        crypto
      ).inspectReleaseCompatibility()
    ).resolves.toEqual({
      inspected: 1,
      referencedKeyVersionCount: 1,
      unavailableKeyVersionCount: 1,
      ready: false,
    });
  });

  it('accepts approved banking with matching durable provenance and destination', async () => {
    const applicationId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    await MembershipApplication.collection.insertOne({
      _id: applicationId,
      status: MemberApplicationStatus.APPROVED,
      approvedUserId: userId,
      encryptedBanking: crypto.encrypt(
        banking(),
        'membership-application',
        applicationId.toString()
      ),
    });
    await recordCompletedApproval(applicationId, userId);
    await MemberBankingProfile.create({
      userId,
      sourceApplicationId: applicationId,
      encryptedBanking: crypto.encrypt(
        banking(),
        'member-banking-profile',
        userId.toString()
      ),
      bankingSummary: getBankingSummary(banking()),
    });

    await expect(
      new MembershipApplicationBankingIntegrityService(crypto).verifyReady()
    ).resolves.toEqual({ inspected: 1, ready: true, findings: [] });
  });

  it('fails readiness for approved banking without its member destination', async () => {
    const applicationId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    await MembershipApplication.collection.insertOne({
      _id: applicationId,
      status: MemberApplicationStatus.APPROVED,
      approvedUserId: userId,
      encryptedBanking: crypto.encrypt(
        banking(),
        'membership-application',
        applicationId.toString()
      ),
    });
    await recordCompletedApproval(applicationId, userId);

    const report = await new MembershipApplicationBankingIntegrityService(
      crypto
    ).verifyReady();

    expect(report).toMatchObject({ inspected: 1, ready: false });
    expect(report.findings).toEqual([
      expect.objectContaining({
        applicationId: applicationId.toString(),
        flags: ['member_banking_destination_missing'],
      }),
    ]);
    await expect(
      new MembershipApplicationBankingIntegrityService(
        crypto
      ).inspectReleaseCompatibility()
    ).resolves.toEqual({
      inspected: 0,
      referencedKeyVersionCount: 0,
      unavailableKeyVersionCount: 0,
      ready: true,
    });
  });

  it('fails readiness for an approved banking destination with conflicting provenance', async () => {
    const applicationId = new mongoose.Types.ObjectId();
    const otherApplicationId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    await MembershipApplication.collection.insertOne({
      _id: applicationId,
      status: MemberApplicationStatus.APPROVED,
      approvedUserId: userId,
      encryptedBanking: crypto.encrypt(
        banking(),
        'membership-application',
        applicationId.toString()
      ),
    });
    await recordCompletedApproval(applicationId, userId);
    await MemberBankingProfile.create({
      userId,
      sourceApplicationId: otherApplicationId,
      encryptedBanking: crypto.encrypt(
        banking(),
        'member-banking-profile',
        userId.toString()
      ),
      bankingSummary: getBankingSummary(banking()),
    });

    const report = await new MembershipApplicationBankingIntegrityService(
      crypto
    ).verifyReady();

    expect(report).toMatchObject({ inspected: 1, ready: false });
    expect(report.findings).toEqual([
      expect.objectContaining({
        applicationId: applicationId.toString(),
        flags: ['member_banking_destination_conflict'],
      }),
    ]);
  });
});
