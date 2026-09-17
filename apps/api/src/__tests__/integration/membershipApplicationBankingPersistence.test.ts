import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import { Gender } from '@club/shared-types/core/enums';
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
import { MembershipApplication } from '../../models/MembershipApplication';
import { MembershipApplicationApiTransformer } from '../../transformers/membershipApplication';
import { MembershipApplicationService } from '../../services/membershipApplicationService';
import EmailService from '../../services/emailService';
import { SettingsService } from '../../services/settingsService';

let mongoLease: MongoTestDatabaseLease;

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('membershipApplicationBanking');
  mongoLease.assertOwnedDatabase();
  await MembershipApplication.syncIndexes();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await MembershipApplication.deleteMany({});
  vi.restoreAllMocks();
  vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
  vi.spyOn(SettingsService, 'getApplicationAlertRecipients').mockResolvedValue(
    []
  );
});

afterAll(async () => {
  await mongoLease.release();
});

describe('Membership Application encrypted banking persistence', () => {
  it('persists complete banking only as ciphertext and exposes only an admin summary', async () => {
    const application = await MembershipApplicationService.createApplication({
      personalInfo: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.test',
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
        accountHolderType: 'different',
        accountHolderFirstName: 'Grace',
        accountHolderLastName: 'Hopper',
        accountHolderAddress: 'Other 2, 10115 Berlin',
        bankName: 'Secret Bank',
        iban: 'DE02120300000000202051',
        bic: 'BYLADEM1001',
        debitFrequency: 'quarterly',
      },
    });

    const raw = await MembershipApplication.collection.findOne({
      _id: new mongoose.Types.ObjectId(application.id),
    });
    const serialized = JSON.stringify(raw);
    expect(raw).not.toHaveProperty('bankingInfo');
    expect(serialized).not.toContain('DE02120300000000202051');
    expect(serialized).not.toContain('Grace');
    expect(serialized).not.toContain('Secret Bank');
    expect(raw?.bankingSummary).toEqual({
      present: true,
      complete: true,
      ibanLastFour: '2051',
    });

    const api = MembershipApplicationApiTransformer.toApi(application);
    expect(api).not.toHaveProperty('bankingInfo');
    expect(
      await MembershipApplicationService.getApplicantBanking(application.id)
    ).toMatchObject({ iban: 'DE02120300000000202051' });
  });

  it('allows partial encrypted banking on a draft without marking it complete', async () => {
    const draft =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        'draft@example.test'
      );
    const saved = await MembershipApplicationService.saveApplicantData(
      draft.id,
      {
        bankingInfo: {
          accountHolderType: 'same',
          iban: 'DE02',
          bankName: 'Partial',
        },
      }
    );
    expect(saved.bankingSummary).toEqual({ present: true, complete: false });
    const raw = await MembershipApplication.collection.findOne({
      _id: new mongoose.Types.ObjectId(draft.id),
    });
    expect(JSON.stringify(raw)).not.toContain('Partial');
    expect(JSON.stringify(raw)).not.toContain('DE02');
  });

  it('does not let an ordinary applicant save replace the verified email', async () => {
    const draft =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        'verified@example.test'
      );
    const saved = await MembershipApplicationService.saveApplicantData(
      draft.id,
      {
        personalInfo: { email: 'unverified@example.test', firstName: 'Ada' },
      }
    );
    expect(saved.verifiedEmail).toBe('verified@example.test');
    expect(saved.personalInfo.email).toBe('verified@example.test');
  });
});
