import { MemberApplicationStatus } from '@club/shared-types/core/enums';
import { Types } from 'mongoose';
import { MembershipApplication } from '../models/MembershipApplication';
import { AppError } from '../utils/errors';

export type SignedReceiptKind = 'application' | 'sepa';

export class MembershipSignedReceiptService {
  static async confirm(
    applicationId: string,
    kind: SignedReceiptKind,
    actorId: string
  ) {
    const application = await MembershipApplication.findOne({
      _id: applicationId,
      status: MemberApplicationStatus.PENDING,
    });
    if (!application) throw AppError.notFound('Pending application not found');
    if (kind === 'sepa' && !application.bankingSummary.complete) {
      throw AppError.conflict(
        'Complete banking information is required before confirming signed SEPA receipt'
      );
    }
    const receipt = {
      receivedAt: new Date(),
      receivedBy: new Types.ObjectId(actorId),
    };
    if (kind === 'application') application.signedApplicationReceipt = receipt;
    else application.signedSepaReceipt = receipt;
    await application.save();
    return application;
  }

  static async reset(applicationId: string, kind: SignedReceiptKind) {
    const application = await MembershipApplication.findOne({
      _id: applicationId,
      status: MemberApplicationStatus.PENDING,
    });
    if (!application) throw AppError.notFound('Pending application not found');
    const receipt =
      kind === 'application'
        ? application.signedApplicationReceipt
        : application.signedSepaReceipt;
    if (!receipt)
      throw AppError.conflict('Signed document receipt is not confirmed');
    receipt.resetAt = new Date();
    receipt.resetReason = 'administrator_reset';
    application.signedDocumentResetHistory.push({
      documentKind: kind,
      reasonCategory: 'administrator_reset',
      resetAt: receipt.resetAt,
    });
    await application.save();
    return application;
  }
}
