import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountKind, Capability } from '@club/shared-types/core/enums';

const authState = vi.hoisted(() => ({ allowed: true }));
vi.mock('../../middleware/auth', () => ({
  protect: (req: any, res: any, next: any) => {
    if (!authState.allowed)
      return res.status(401).json({ error: 'Unauthorized' });
    req.user = {
      id: '507f1f77bcf86cd799439011',
      email: 'admin@example.test',
      accountKind: AccountKind.PERSON,
      displayName: 'Administrator',
      capabilities: ['administration'],
      firstName: 'Admin',
      lastName: 'User',
    };
    next();
  },
  authorizeCapability: () => (_req: any, _res: any, next: any) => next(),
}));

import routes from '../../routes/membershipApplications';
import { MembershipApplicantAccessService } from '../../services/membershipApplicantAccessService';
import { MembershipApplicationDocumentService } from '../../services/membershipApplicationDocumentService';
import { membershipStudentProofService } from '../../services/membershipStudentProofService';
import { MembershipApplicationService } from '../../services/membershipApplicationService';
import { MembershipSignedReceiptService } from '../../services/membershipSignedReceiptService';
import { MembershipApplicationApiTransformer } from '../../transformers/membershipApplication';
import { AuditService } from '../../services/auditService';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/membership', routes);
  instance.use((error: any, _req: any, res: any, _next: any) =>
    res.status(error.statusCode ?? 500).json({ error: error.message })
  );
  return instance;
}

describe('Membership Application private proof/document routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authState.allowed = true;
    vi.spyOn(
      MembershipApplicantAccessService,
      'resolveSessionCookies'
    ).mockResolvedValue({
      applicationId: '507f1f77bcf86cd799439012',
      observedCookieNames: [],
      clearCookieNames: [],
    });
    vi.spyOn(
      MembershipApplicantAccessService,
      'clearSessionCookies'
    ).mockImplementation(() => undefined);
    vi.spyOn(AuditService, 'writeBestEffort').mockReturnValue();
  });

  it('downloads a pending saved-data PDF without accepting a raw payload', async () => {
    const buffer = Buffer.from('%PDF-1.4\n%%EOF');
    const generate = vi
      .spyOn(MembershipApplicationDocumentService, 'generate')
      .mockResolvedValue({
        buffer,
        filename: 'membership-application-safe.pdf',
      });
    const response = await request(app())
      .get('/api/membership/applicant/application/documents/application')
      .set('Cookie', 'membership_applicant_session=raw-session');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(generate).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439012',
      'application'
    );
  });

  it('requires trusted Origin for PDF email and proof mutations', async () => {
    const email = vi
      .spyOn(MembershipApplicationDocumentService, 'emailCurrentDocuments')
      .mockResolvedValue();
    const denied = await request(app())
      .post('/api/membership/applicant/application/documents/email')
      .set('Cookie', 'membership_applicant_session=raw-session')
      .send({ documents: ['application'], locale: 'en' });
    expect(denied.status).toBe(403);
    const allowed = await request(app())
      .post('/api/membership/applicant/application/documents/email')
      .set('Cookie', 'membership_applicant_session=raw-session')
      .set('Origin', process.env.FRONTEND_URL!)
      .send({ documents: ['application'] });
    expect(allowed.status).toBe(202);
    expect(email).toHaveBeenCalledWith('507f1f77bcf86cd799439012', [
      'application',
    ]);

    const replace = vi
      .spyOn(membershipStudentProofService, 'replaceApplicantProofs')
      .mockResolvedValue([] as never);
    vi.spyOn(
      MembershipApplicationService,
      'getApplicantApplication'
    ).mockResolvedValue({
      application: { id: 'application-1' },
    } as never);
    vi.spyOn(MembershipApplicationApiTransformer, 'toApi').mockReturnValue({
      id: 'application-1',
    } as never);
    const proof = await request(app())
      .patch('/api/membership/applicant/application/student-proof')
      .set('Cookie', 'membership_applicant_session=raw-session')
      .set('Origin', process.env.FRONTEND_URL!)
      .field('retainedIds', '[]')
      .attach('proofs', Buffer.from('%PDF-1.4\n%%EOF'), {
        filename: 'proof.pdf',
        contentType: 'application/pdf',
      });
    expect(proof.status).toBe(200);
    expect(replace).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439012',
      [],
      expect.arrayContaining([
        expect.objectContaining({ originalname: 'proof.pdf' }),
      ])
    );
  });

  it('keeps administrator proof and signed-receipt actions authenticated', async () => {
    vi.spyOn(membershipStudentProofService, 'readForAdmin').mockResolvedValue({
      metadata: {
        id: 'proof.pdf',
        originalName: 'proof.pdf',
        mimeType: 'application/pdf',
        size: 5,
        createdAt: new Date(),
      },
      buffer: Buffer.from('%PDF-'),
    });
    const proof = await request(app()).get(
      '/api/membership/applications/507f1f77bcf86cd799439012/student-proof/proof.pdf?download=true'
    );
    expect(proof.status).toBe(200);
    expect(proof.headers['content-disposition']).toContain('attachment');

    vi.spyOn(MembershipSignedReceiptService, 'confirm').mockResolvedValue(
      {} as never
    );
    vi.spyOn(
      MembershipApplicationService,
      'getApplicationById'
    ).mockResolvedValue({ id: 'application-1' } as never);
    vi.spyOn(MembershipApplicationApiTransformer, 'toApi').mockReturnValue({
      id: 'application-1',
    } as never);
    const receipt = await request(app()).post(
      '/api/membership/applications/507f1f77bcf86cd799439012/signed-receipts/application/confirm'
    );
    expect(receipt.status).toBe(200);
    expect(MembershipSignedReceiptService.confirm).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439012',
      'application',
      '507f1f77bcf86cd799439011'
    );
    expect(AuditService.writeBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: '507f1f77bcf86cd799439012',
        changes: [{ field: 'applicationReceipt', newValue: 'confirmed' }],
      })
    );
  });

  it('denies administrator proof and receipt routes without an authenticated administrator', async () => {
    authState.allowed = false;
    const proof = await request(app()).get(
      '/api/membership/applications/507f1f77bcf86cd799439012/student-proof/proof.pdf'
    );
    const receipt = await request(app()).post(
      '/api/membership/applications/507f1f77bcf86cd799439012/signed-receipts/application/confirm'
    );
    expect(proof.status).toBe(401);
    expect(receipt.status).toBe(401);
  });
});
