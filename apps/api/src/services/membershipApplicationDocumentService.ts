import { MemberApplicationStatus } from '@club/shared-types/core/enums';
import {
  MembershipApplication,
  type IMembershipApplication,
} from '../models/MembershipApplication';
import { AppError } from '../utils/errors';
import { bankingCryptoService } from './bankingCryptoService';
import EmailService from './emailService';
import { MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES } from './emailContracts/membershipApplication';
import {
  mapMembershipApplicationPdfInput,
  mapSepaPdfInput,
} from './membershipApplicationDocumentInputs';
import { PDFService } from './pdfService';

export type MembershipApplicationDocumentKind = 'application' | 'sepa';

function fileName(kind: MembershipApplicationDocumentKind): string {
  return kind === 'application'
    ? 'membership-application.pdf'
    : 'sepa-mandate.pdf';
}

export class MembershipApplicationDocumentService {
  private static async loadPending(
    applicationId: string
  ): Promise<IMembershipApplication> {
    const application = await MembershipApplication.findOne({
      _id: applicationId,
      status: MemberApplicationStatus.PENDING,
    });
    if (!application)
      throw AppError.conflict(
        'Documents are available only while an application is pending'
      );
    return application;
  }

  private static async generateFromApplication(
    application: IMembershipApplication,
    kind: MembershipApplicationDocumentKind
  ) {
    if (kind === 'application') {
      const input = mapMembershipApplicationPdfInput(application);
      if (!input) throw AppError.conflict('Application data is incomplete');
      return {
        buffer: await PDFService.createMembershipApplicationPDF(input),
        filename: fileName(kind),
      };
    }

    const banking = application.encryptedBanking
      ? bankingCryptoService.decrypt(
          application.encryptedBanking,
          'membership-application',
          application.id
        )
      : undefined;
    const input = mapSepaPdfInput(application, banking);
    if (!input)
      throw AppError.conflict(
        'Complete banking information is required for the SEPA document'
      );
    return {
      buffer: await PDFService.createSEPAMandatePDF(input),
      filename: fileName(kind),
    };
  }

  static async generate(
    applicationId: string,
    kind: MembershipApplicationDocumentKind
  ) {
    return this.generateFromApplication(
      await this.loadPending(applicationId),
      kind
    );
  }

  static async emailCurrentDocuments(
    applicationId: string,
    kinds: MembershipApplicationDocumentKind[]
  ): Promise<void> {
    const uniqueKinds = [...new Set(kinds)];
    if (
      uniqueKinds.length === 0 ||
      uniqueKinds.length > 2 ||
      uniqueKinds.some((kind) => !['application', 'sepa'].includes(kind))
    ) {
      throw AppError.badRequest('Select one or both current documents');
    }
    const application = await this.loadPending(applicationId);
    const generated = await Promise.all(
      uniqueKinds.map((kind) => this.generateFromApplication(application, kind))
    );
    await EmailService.sendFromTemplate(
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.DOCUMENTS,
      application.verifiedEmail,
      application.communicationLocale ?? 'de',
      {
        firstName: application.personalInfo.firstName ?? '',
        documents: uniqueKinds
          .map((kind) => {
            if (application.communicationLocale === 'zh') {
              return kind === 'application' ? '会员申请表' : 'SEPA 授权书';
            }
            if (application.communicationLocale === 'en') {
              return kind === 'application'
                ? 'membership application'
                : 'SEPA mandate';
            }
            return kind === 'application' ? 'Mitgliedsantrag' : 'SEPA-Mandat';
          })
          .join(', '),
      },
      {
        attachments: generated.map(({ filename, buffer }) => ({
          filename,
          content: buffer,
        })),
      }
    );
  }
}
