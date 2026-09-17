import type { NextFunction, Request, Response } from 'express';
import {
  applicantAccessConsumeSchema,
  applicantEmailRequestSchema,
  applicantLocaleSchema,
  applicantWithdrawSchema,
  saveMembershipApplicationSchema,
} from '@club/shared-types/api/membershipApplication';
import { MembershipApplicationApiTransformer } from '../transformers/membershipApplication';
import type { ApplicantRequest } from '../middleware/membershipApplicant';
import { MembershipApplicantAccessService } from '../services/membershipApplicantAccessService';
import { MembershipApplicationService } from '../services/membershipApplicationService';
import { membershipStudentProofService } from '../services/membershipStudentProofService';
import { MembershipApplicationDocumentService } from '../services/membershipApplicationDocumentService';
import { AppError } from '../utils/errors';

const GENERIC_MESSAGE =
  'If the request is eligible, an email will arrive shortly.';

export class MembershipApplicantController {
  static async requestInitial(req: Request, res: Response): Promise<void> {
    const parsed = applicantEmailRequestSchema.safeParse(req.body);
    if (parsed.success) {
      const registrationToken = req.get('x-registration-key');
      void MembershipApplicantAccessService.requestInitialVerification(
        parsed.data.email,
        registrationToken,
        parsed.data.locale
      ).catch(() => undefined);
    }
    res.status(202).json({ success: true, message: GENERIC_MESSAGE });
  }

  static async requestAccess(req: Request, res: Response): Promise<void> {
    const parsed = applicantEmailRequestSchema.safeParse(req.body);
    if (parsed.success) {
      void MembershipApplicantAccessService.requestApplicationAccess(
        parsed.data.email,
        parsed.data.locale
      ).catch(() => undefined);
    }
    res.status(202).json({ success: true, message: GENERIC_MESSAGE });
  }

  static async consume(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { token } = applicantAccessConsumeSchema.parse(req.body);
      const result = await MembershipApplicantAccessService.consume(token);
      MembershipApplicantAccessService.setSessionCookie(
        res,
        result.cookieSlotId,
        result.sessionToken
      );
      res
        .status(200)
        .json({ success: true, data: { applicationId: result.applicationId } });
    } catch (error) {
      next(error);
    }
  }

  static async getCurrent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = (req as ApplicantRequest).applicantApplicationId;
      const { application, bankingInfo } =
        await MembershipApplicationService.getApplicantApplication(id);
      res.json({
        success: true,
        data: MembershipApplicationApiTransformer.toApplicantApi(
          application,
          bankingInfo
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  static async save(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = (req as ApplicantRequest).applicantApplicationId;
      const application = await MembershipApplicationService.saveApplicantData(
        id,
        saveMembershipApplicationSchema.parse(req.body)
      );
      const bankingInfo =
        await MembershipApplicationService.getApplicantBanking(id);
      res.json({
        success: true,
        data: MembershipApplicationApiTransformer.toApplicantApi(
          application,
          bankingInfo
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  static async submit(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = (req as ApplicantRequest).applicantApplicationId;
      const application =
        await MembershipApplicationService.submitApplicantApplication(id);
      const bankingInfo =
        await MembershipApplicationService.getApplicantBanking(id);
      res.json({
        success: true,
        data: MembershipApplicationApiTransformer.toApplicantApi(
          application,
          bankingInfo
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  static async requestEmailChange(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = (req as ApplicantRequest).applicantApplicationId;
      const { email, locale } = applicantEmailRequestSchema.parse(req.body);
      await MembershipApplicantAccessService.requestEmailChange(
        id,
        email,
        locale
      );
      res.status(202).json({ success: true, message: GENERIC_MESSAGE });
    } catch (error) {
      next(error);
    }
  }

  static async synchronizeLocale(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = (req as ApplicantRequest).applicantApplicationId;
      const { locale } = applicantLocaleSchema.parse(req.body);
      await MembershipApplicantAccessService.synchronizeCommunicationLocale(
        id,
        locale
      );
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  }

  static async withdraw(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      applicantWithdrawSchema.parse(req.body);
      const id = (req as ApplicantRequest).applicantApplicationId;
      await MembershipApplicationService.withdrawApplicantApplication(id);
      MembershipApplicantAccessService.clearSessionCookies(
        res,
        (req as ApplicantRequest).applicantSessionCookieNames
      );
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  }

  static async replaceStudentProof(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = (req as ApplicantRequest).applicantApplicationId;
      let retainedIds: string[] = [];
      if (
        typeof req.body.retainedIds === 'string' &&
        req.body.retainedIds.trim()
      ) {
        const parsed = JSON.parse(req.body.retainedIds) as unknown;
        if (
          !Array.isArray(parsed) ||
          parsed.some((value) => typeof value !== 'string')
        ) {
          throw AppError.badRequest('retainedIds must be a string array');
        }
        retainedIds = parsed;
      }
      await membershipStudentProofService.replaceApplicantProofs(
        id,
        retainedIds,
        (req.files as Express.Multer.File[] | undefined) ?? []
      );
      const { application, bankingInfo } =
        await MembershipApplicationService.getApplicantApplication(id);
      res.json({
        success: true,
        data: MembershipApplicationApiTransformer.toApplicantApi(
          application,
          bankingInfo
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  static async downloadDocument(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const kind = req.params.kind;
      if (kind !== 'application' && kind !== 'sepa')
        throw AppError.notFound('Document not found');
      const id = (req as ApplicantRequest).applicantApplicationId;
      const document = await MembershipApplicationDocumentService.generate(
        id,
        kind
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${document.filename}"`
      );
      res.setHeader('Content-Length', document.buffer.length);
      res.status(200).send(document.buffer);
    } catch (error) {
      next(error);
    }
  }

  static async emailDocuments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = (req as ApplicantRequest).applicantApplicationId;
      const documents = Array.isArray(req.body.documents)
        ? req.body.documents
        : [];
      await MembershipApplicationDocumentService.emailCurrentDocuments(
        id,
        documents
      );
      res.status(202).json({
        success: true,
        message: 'Current documents were sent to the verified email.',
      });
    } catch (error) {
      next(error);
    }
  }
}
