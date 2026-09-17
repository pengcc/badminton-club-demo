import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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
import { Gender, MemberApplicationStatus } from '@club/shared-types/core/enums';
import { MembershipApplication } from '../../models/MembershipApplication';
import { MembershipApplicationDocumentService } from '../../services/membershipApplicationDocumentService';
import { MembershipApplicationService } from '../../services/membershipApplicationService';
import { MembershipSignedReceiptService } from '../../services/membershipSignedReceiptService';
import { MembershipStudentProofService } from '../../services/membershipStudentProofService';
import { MembershipStudentProofStore } from '../../services/membershipStudentProofStore';
import EmailService from '../../services/emailService';
import { SettingsService } from '../../services/settingsService';

let mongoLease: MongoTestDatabaseLease;
let privateRoot = '';
let proofService: MembershipStudentProofService;

async function makePending(
  email: string,
  options: { student?: boolean; banking?: boolean; phone?: boolean } = {}
) {
  const draft =
    await MembershipApplicationService.createDraftForVerifiedEmail(email);
  await MembershipApplicationService.saveApplicantData(draft.id, {
    personalInfo: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: options.phone === false ? undefined : '+49123456789',
      dateOfBirth: '1990-01-01',
      gender: Gender.FEMALE,
      address: {
        street: 'Test 1',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
      },
    },
    membershipType: options.student ? 'student' : 'regular',
    bankingInfo: options.banking
      ? {
          accountHolderType: 'same',
          bankName: 'Private Bank',
          iban: 'DE02120300000000202051',
          bic: 'BYLADEM1001',
          debitFrequency: 'quarterly',
        }
      : undefined,
  });
  return MembershipApplicationService.submitApplicantApplication(draft.id);
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('membershipApplicationDocuments');
  privateRoot = await mkdtemp(
    path.join(os.tmpdir(), 'membership-private-proof-')
  );
  proofService = new MembershipStudentProofService(
    new MembershipStudentProofStore(privateRoot)
  );
  mongoLease.assertOwnedDatabase();
  await MembershipApplication.syncIndexes();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await MembershipApplication.deleteMany({});
  await rm(privateRoot, { recursive: true, force: true });
  privateRoot = await mkdtemp(
    path.join(os.tmpdir(), 'membership-private-proof-')
  );
  proofService = new MembershipStudentProofService(
    new MembershipStudentProofStore(privateRoot)
  );
  vi.restoreAllMocks();
  vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
  vi.spyOn(SettingsService, 'getApplicationAlertRecipients').mockResolvedValue(
    []
  );
});

afterAll(async () => {
  try {
    await mongoLease.release();
  } finally {
    await rm(privateRoot, { recursive: true, force: true });
  }
});

describe('private proof, saved-data PDFs, and signed receipt persistence', () => {
  it('keeps proof private, owner-scoped, optional for submit, and unchanged by receipt policy', async () => {
    const draft =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        'student@example.test'
      );
    await MembershipApplicationService.saveApplicantData(draft.id, {
      personalInfo: {
        firstName: 'Student',
        lastName: 'Applicant',
        phone: '+49123456789',
        dateOfBirth: '2000-01-01',
        gender: Gender.FEMALE,
        address: {
          street: 'Test 1',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
      },
      membershipType: 'student',
    });
    const proofBuffer = Buffer.from('%PDF-1.4\nstudent proof\n%%EOF');
    const [proof] = await proofService.replaceApplicantProofs(
      draft.id,
      [],
      [
        {
          buffer: proofBuffer,
          mimetype: 'application/pdf',
          size: proofBuffer.length,
          originalname: '../enrollment.pdf',
        },
      ]
    );
    expect(proof.id).not.toContain('/');
    expect(
      JSON.stringify(await MembershipApplication.findById(draft.id).lean())
    ).not.toContain('/uploads/');
    await expect(
      proofService.readForAdmin(draft.id, proof.id)
    ).rejects.toMatchObject({ statusCode: 404 });

    await MembershipApplicationService.submitApplicantApplication(draft.id);
    const read = await proofService.readForAdmin(draft.id, proof.id);
    expect(read.buffer.toString()).toContain('student proof');
    await MembershipSignedReceiptService.confirm(
      draft.id,
      'application',
      new mongoose.Types.ObjectId().toString()
    );
    const updated = await proofService.replaceApplicantProofs(
      draft.id,
      [proof.id],
      [
        {
          buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
          mimetype: 'image/jpeg',
          size: 5,
          originalname: 'second.jpg',
        },
      ]
    );
    expect(updated).toHaveLength(2);
    expect(
      (await MembershipApplication.findById(draft.id).lean())!
        .signedApplicationReceipt?.resetAt
    ).toBeUndefined();
    await proofService.deleteForAdmin(draft.id, proof.id);
    await expect(
      proofService.readForAdmin(draft.id, proof.id)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('generates transient pending PDFs from saved data and emails only the verified address', async () => {
    const pending = await makePending('documents@example.test', {
      banking: true,
    });
    const send = vi.mocked(EmailService.sendFromTemplate);
    send.mockClear();
    const applicationPdf = await MembershipApplicationDocumentService.generate(
      pending.id,
      'application'
    );
    const sepaPdf = await MembershipApplicationDocumentService.generate(
      pending.id,
      'sepa'
    );
    expect(applicationPdf.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(sepaPdf.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(applicationPdf.filename).toBe('membership-application.pdf');
    expect(sepaPdf.filename).toBe('sepa-mandate.pdf');
    expect(applicationPdf.filename).not.toContain(pending.id);
    expect(sepaPdf.filename).not.toContain(pending.id);
    const raw = await MembershipApplication.collection.findOne({
      _id: new mongoose.Types.ObjectId(pending.id),
    });
    expect(raw).not.toHaveProperty('generatedDocuments');
    expect(JSON.stringify(raw)).not.toContain('DE02120300000000202051');

    await MembershipApplication.updateOne(
      { _id: pending.id },
      { $set: { communicationLocale: 'en' } }
    );
    await MembershipApplicationDocumentService.emailCurrentDocuments(
      pending.id,
      ['application', 'sepa']
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[1]).toBe('documents@example.test');
    expect(send.mock.calls[0]?.[2]).toBe('en');
    expect(send.mock.calls[0]?.[3]?.documents).toBe(
      'membership application, SEPA mandate'
    );
    expect(send.mock.calls[0]?.[3]).not.toHaveProperty('iban');
    expect(send.mock.calls[0]?.[4]?.attachments).toHaveLength(2);
    expect(
      send.mock.calls[0]?.[4]?.attachments?.map(({ filename }) => filename)
    ).toEqual(['membership-application.pdf', 'sepa-mandate.pdf']);
  });

  it('generates the membership application PDF when the optional phone is absent', async () => {
    const pending = await makePending('no-phone@example.test', {
      phone: false,
    });
    const applicationPdf = await MembershipApplicationDocumentService.generate(
      pending.id,
      'application'
    );

    expect(applicationPdf.buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('resets only signed receipts whose canonical generated input changed', async () => {
    const pending = await makePending('receipt@example.test', {
      banking: true,
    });
    const actorId = new mongoose.Types.ObjectId().toString();
    await MembershipSignedReceiptService.confirm(
      pending.id,
      'application',
      actorId
    );
    await MembershipSignedReceiptService.confirm(pending.id, 'sepa', actorId);

    await MembershipApplicationService.saveApplicantData(pending.id, {
      motivation: 'Review context only',
    });
    let stored = await MembershipApplication.findById(pending.id).lean();
    expect(stored!.signedApplicationReceipt?.resetAt).toBeUndefined();
    expect(stored!.signedSepaReceipt?.resetAt).toBeUndefined();

    await MembershipApplicationService.saveApplicantData(pending.id, {
      personalInfo: { firstName: 'Augusta' },
    });
    stored = await MembershipApplication.findById(pending.id).lean();
    expect(stored!.signedApplicationReceipt?.resetReason).toBe(
      'applicant_application_data_changed'
    );
    expect(stored!.signedSepaReceipt?.resetReason).toBe(
      'applicant_sepa_data_changed'
    );
    expect(
      stored!.signedDocumentResetHistory.map(
        ({ documentKind, reasonCategory }) => ({ documentKind, reasonCategory })
      )
    ).toEqual(
      expect.arrayContaining([
        {
          documentKind: 'application',
          reasonCategory: 'applicant_application_data_changed',
        },
        { documentKind: 'sepa', reasonCategory: 'applicant_sepa_data_changed' },
      ])
    );

    await MembershipSignedReceiptService.confirm(
      pending.id,
      'application',
      actorId
    );
    await MembershipSignedReceiptService.confirm(pending.id, 'sepa', actorId);
    await MembershipApplicationService.saveApplicantData(pending.id, {
      bankingInfo: {
        accountHolderType: 'same',
        bankName: 'Changed Bank',
        iban: 'DE02120300000000202051',
        bic: 'BYLADEM1001',
        debitFrequency: 'quarterly',
      },
    });
    stored = await MembershipApplication.findById(pending.id).lean();
    expect(stored!.signedApplicationReceipt?.resetAt).toBeUndefined();
    expect(stored!.signedSepaReceipt?.resetReason).toBe(
      'applicant_sepa_data_changed'
    );
    const recordedResetCount = stored!.signedDocumentResetHistory.length;

    await MembershipSignedReceiptService.confirm(pending.id, 'sepa', actorId);
    expect(
      (await MembershipApplication.findById(pending.id).lean())!
        .signedDocumentResetHistory
    ).toHaveLength(recordedResetCount);
    await MembershipApplicationService.saveApplicantData(pending.id, {
      bankingInfo: null,
    });
    stored = await MembershipApplication.findById(pending.id).lean();
    expect(stored!.bankingSummary).toMatchObject({
      present: false,
      complete: false,
    });
    expect(stored!.encryptedBanking).toBeUndefined();
    expect(stored!.signedSepaReceipt?.resetReason).toBe(
      'applicant_sepa_data_changed'
    );
  });

  it('blocks formal PDF generation outside pending and blocks incomplete SEPA', async () => {
    const draft =
      await MembershipApplicationService.createDraftForVerifiedEmail(
        'draft-doc@example.test'
      );
    await expect(
      MembershipApplicationDocumentService.generate(draft.id, 'application')
    ).rejects.toMatchObject({ statusCode: 409 });
    const pending = await makePending('no-bank@example.test');
    await expect(
      MembershipApplicationDocumentService.generate(pending.id, 'sepa')
    ).rejects.toMatchObject({ statusCode: 409 });
    await MembershipApplication.findByIdAndUpdate(pending.id, {
      $set: {
        status: MemberApplicationStatus.REJECTED,
        rejectedAt: new Date(),
      },
    });
    await expect(
      MembershipApplicationDocumentService.generate(pending.id, 'application')
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
