import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import mongoose, {
  Types,
  type ClientSession,
  type FilterQuery,
} from 'mongoose';
import { MemberApplicationStatus } from '@club/shared-types/core/enums';
import { config } from '../config';
import { MembershipApplication } from '../models/MembershipApplication';
import {
  MembershipApplicationAccessToken,
  type MembershipApplicationTokenPurpose,
} from '../models/MembershipApplicationAccessToken';
import { MembershipApplicantSession } from '../models/MembershipApplicantSession';
import { User } from '../models/User';
import { AppError } from '../utils/errors';
import EmailService from './emailService';
import { MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES } from './emailContracts/membershipApplication';
import {
  MEMBERSHIP_APPLICATION_POLICY_CODES,
  MembershipApplicationPolicy,
} from './membershipApplicationPolicy';
import { RegistrationAccessService } from './registrationAccessService';
import { bankingCryptoService } from './bankingCryptoService';
import {
  captureMembershipDocumentInputs,
  resetChangedSignedDocumentReceipts,
} from './membershipApplicationDocumentInputs';

export const APPLICANT_TOKEN_TTL_MS = 30 * 60 * 1000;
export const APPLICANT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const APPLICANT_SESSION_COOKIE_PREFIX = 'membership_applicant_session_';
export const MAX_APPLICANT_SESSION_COOKIE_SLOTS = 8;

const APPLICANT_SESSION_SLOT_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const ACCESSIBLE_STATUSES = [
  MemberApplicationStatus.DRAFT,
  MemberApplicationStatus.PENDING,
  MemberApplicationStatus.APPROVED,
  MemberApplicationStatus.REJECTED,
];

type Locale = 'de' | 'en' | 'zh';

type ApplicantGuidanceKind = 'contact_club' | 'retry_later';

const APPLICANT_GUIDANCE: Record<
  ApplicantGuidanceKind,
  Record<Locale, string>
> = {
  contact_club: {
    de: 'Für diese E-Mail-Adresse kann kein neuer Mitgliedsantrag gestartet werden. Bitte wende dich unter info@club.invalid an den Verein.',
    en: 'A new membership application cannot be started for this email address. Please contact the club at info@club.invalid for help.',
    zh: '此电子邮箱无法开始新的会员申请。如需帮助，请通过 info@club.invalid 联系俱乐部。',
  },
  retry_later: {
    de: 'Ein neuer Mitgliedsantrag kann derzeit nicht gestartet werden. Bitte versuche es später erneut.',
    en: 'A new membership application cannot be started right now. Please try again later.',
    zh: '目前无法开始新的会员申请，请稍后再试。',
  },
};

interface ApplicantSessionCookieCandidate {
  name: string;
  slotId: string;
  token: string;
  tokenDigest: string;
}

export interface ApplicantSessionResolution {
  applicationId?: string;
  observedCookieNames: string[];
  clearCookieNames: string[];
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function accessUrl(token: string, locale: Locale): string {
  return `${config.frontendUrl.replace(/\/$/, '')}/${locale}/apply/continue#token=${encodeURIComponent(token)}`;
}

function accessEpoch(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function accessEpochFilter(expected: number): FilterQuery<unknown> {
  return expected === 0
    ? {
        $or: [
          { applicantAccessEpoch: 0 },
          { applicantAccessEpoch: { $exists: false } },
        ],
      }
    : { applicantAccessEpoch: expected };
}

function cookieName(slotId: string): string {
  if (!APPLICANT_SESSION_SLOT_PATTERN.test(slotId)) {
    throw AppError.internal('Applicant session cookie slot is invalid');
  }
  return `${APPLICANT_SESSION_COOKIE_PREFIX}${slotId}`;
}

function duplicateKey(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: number }).code === 11000
  );
}

export class MembershipApplicantAccessService {
  static hashRateLimitEmail(email: unknown): string {
    return digest(
      typeof email === 'string'
        ? MembershipApplicationPolicy.normalizeEmail(email)
        : 'invalid'
    );
  }

  private static async issue(input: {
    purpose: MembershipApplicationTokenPurpose;
    email: string;
    applicationId?: string;
    applicantAccessEpoch?: number;
    locale: Locale;
  }): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const targetKey =
      input.purpose === 'initial_verification'
        ? digest(input.email)
        : (input.applicationId ?? digest(input.email));
    const now = Date.now();
    await MembershipApplicationAccessToken.findOneAndUpdate(
      { purpose: input.purpose, targetKey },
      {
        $set: {
          tokenDigest: digest(token),
          email: input.email,
          locale: input.locale,
          applicationId: input.applicationId
            ? new Types.ObjectId(input.applicationId)
            : undefined,
          applicantAccessEpoch: accessEpoch(input.applicantAccessEpoch),
          expiresAt: new Date(now + APPLICANT_TOKEN_TTL_MS),
          cleanupAt: new Date(now + APPLICANT_SESSION_TTL_MS),
        },
        $unset: {
          registrationGeneration: 1,
          registrationIssuedAt: 1,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return token;
  }

  static async requestInitialVerification(
    email: string,
    registrationToken: string | undefined,
    locale: Locale
  ): Promise<void> {
    const normalized = MembershipApplicationPolicy.normalizeEmail(email);
    if (!(await RegistrationAccessService.validate(registrationToken))) return;

    const existing = await MembershipApplication.findOne({
      verifiedEmail: normalized,
      status: {
        $in: [MemberApplicationStatus.DRAFT, MemberApplicationStatus.PENDING],
      },
    })
      .select('_id applicantAccessEpoch')
      .lean();
    if (existing) {
      const token = await this.issue({
        purpose: 'application_access',
        email: normalized,
        applicationId: existing._id.toString(),
        applicantAccessEpoch: accessEpoch(existing.applicantAccessEpoch),
        locale,
      });
      await EmailService.sendFromTemplate(
        MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.ACCESS,
        normalized,
        locale,
        { accessUrl: accessUrl(token, locale) }
      );
      return;
    }
    try {
      await MembershipApplicationPolicy.assertEmailAvailableForApplication(
        normalized
      );
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code ===
          MEMBERSHIP_APPLICATION_POLICY_CODES.CURRENT_APPLICATION &&
        (await this.sendCurrentApplicationAccessIfPresent(normalized, locale))
      ) {
        return;
      }
      const guidanceKind = this.guidanceKindFor(error);
      if (!guidanceKind) throw error;
      await this.sendGuidanceIfReachable(normalized, locale, guidanceKind);
      return;
    }
    const token = await this.issue({
      purpose: 'initial_verification',
      email: normalized,
      locale,
    });
    await EmailService.sendFromTemplate(
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.VERIFY_EMAIL,
      normalized,
      locale,
      { accessUrl: accessUrl(token, locale) }
    );
  }

  static async requestApplicationAccess(
    email: string,
    locale: Locale
  ): Promise<void> {
    const normalized = MembershipApplicationPolicy.normalizeEmail(email);
    const application =
      await MembershipApplicationPolicy.findAccessibleApplication(normalized);
    if (!application) return;
    const token = await this.issue({
      purpose: 'application_access',
      email: normalized,
      applicationId: application._id.toString(),
      applicantAccessEpoch: accessEpoch(application.applicantAccessEpoch),
      locale,
    });
    await EmailService.sendFromTemplate(
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.ACCESS,
      normalized,
      locale,
      { accessUrl: accessUrl(token, locale) }
    );
  }

  static async requestEmailChange(
    applicationId: string,
    email: string,
    locale: Locale
  ): Promise<void> {
    const application = await MembershipApplication.findOne({
      _id: applicationId,
      status: MemberApplicationStatus.PENDING,
    }).lean();
    if (!application) throw AppError.conflict('Application is not editable');
    const normalized = MembershipApplicationPolicy.normalizeEmail(email);
    await MembershipApplication.updateOne(
      { _id: applicationId, status: MemberApplicationStatus.PENDING },
      { $set: { communicationLocale: locale } }
    );
    await MembershipApplicationPolicy.assertEmailAvailableForApplication(
      normalized,
      {
        excludeApplicationId: applicationId,
        skipHistoricalLimits: true,
      }
    );
    const token = await this.issue({
      purpose: 'email_change',
      email: normalized,
      applicationId,
      applicantAccessEpoch: accessEpoch(application.applicantAccessEpoch),
      locale,
    });
    await EmailService.sendFromTemplate(
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.VERIFY_EMAIL_CHANGE,
      normalized,
      locale,
      { accessUrl: accessUrl(token, locale) }
    );
  }

  private static async createSession(
    applicationId: string,
    applicantAccessEpoch: number,
    session?: ClientSession
  ): Promise<{
    sessionToken: string;
    cookieSlotId: string;
    applicationId: string;
  }> {
    const sessionToken = randomBytes(32).toString('base64url');
    const cookieSlotId = randomBytes(16).toString('base64url');
    const applicantSession = new MembershipApplicantSession({
      tokenDigest: digest(sessionToken),
      cookieSlotId,
      applicationId,
      applicantAccessEpoch,
      expiresAt: new Date(Date.now() + APPLICANT_SESSION_TTL_MS),
    });
    await applicantSession.save({ session });
    return { sessionToken, cookieSlotId, applicationId };
  }

  private static staleEpochFilter(epoch: number): FilterQuery<unknown> {
    return {
      $or: [
        { applicantAccessEpoch: { $lte: epoch } },
        { applicantAccessEpoch: { $exists: false } },
      ],
    };
  }

  static async consume(token: string): Promise<{
    sessionToken: string;
    cookieSlotId: string;
    applicationId: string;
  }> {
    const record = await MembershipApplicationAccessToken.findOneAndDelete({
      tokenDigest: digest(token),
      expiresAt: { $gt: new Date() },
    }).select('+tokenDigest');
    if (!record)
      throw AppError.badRequest('The access link is invalid or expired');

    const tokenEpoch = accessEpoch(record.applicantAccessEpoch);
    let applicationId = record.applicationId?.toString();
    if (record.purpose === 'initial_verification') {
      const existing = await MembershipApplication.findOne({
        ...(applicationId ? { _id: applicationId } : {}),
        verifiedEmail: record.email,
        status: {
          $in: [MemberApplicationStatus.DRAFT, MemberApplicationStatus.PENDING],
        },
        ...accessEpochFilter(tokenEpoch),
      })
        .select('_id applicantAccessEpoch')
        .lean();
      if (existing) applicationId = existing._id.toString();
      else {
        if (applicationId || tokenEpoch !== 0) {
          throw AppError.badRequest('The access link is invalid or expired');
        }
        await MembershipApplicationPolicy.assertEmailAvailableForApplication(
          record.email
        );
        const created = await MembershipApplication.create({
          verifiedEmail: record.email,
          personalInfo: { email: record.email },
          bankingSummary: { present: false, complete: false },
          status: MemberApplicationStatus.DRAFT,
          communicationLocale: record.locale ?? 'de',
          applicantAccessEpoch: 0,
          applicantDataUpdatedAt: new Date(),
        });
        applicationId = created.id;
      }
    } else if (record.purpose === 'email_change') {
      if (!applicationId)
        throw AppError.badRequest('The access link is invalid or expired');
      const emailChangeApplicationId = applicationId;
      try {
        return await mongoose.connection.transaction(async (session) => {
          await MembershipApplicationPolicy.assertEmailAvailableForApplication(
            record.email,
            {
              excludeApplicationId: emailChangeApplicationId,
              skipHistoricalLimits: true,
              session,
            }
          );
          const switched = await MembershipApplication.findOne({
            _id: emailChangeApplicationId,
            status: MemberApplicationStatus.PENDING,
            ...accessEpochFilter(tokenEpoch),
          }).session(session);
          if (!switched) throw AppError.conflict('Application is not editable');
          const banking = switched.encryptedBanking
            ? bankingCryptoService.decrypt(
                switched.encryptedBanking,
                'membership-application',
                switched.id
              )
            : undefined;
          const beforeInputs = captureMembershipDocumentInputs(
            switched,
            banking
          );
          switched.verifiedEmail = record.email;
          switched.personalInfo.email = record.email;
          switched.communicationLocale = record.locale ?? 'de';
          switched.applicantAccessEpoch = tokenEpoch + 1;
          switched.applicantDataUpdatedAt = new Date();
          resetChangedSignedDocumentReceipts(
            switched,
            beforeInputs,
            captureMembershipDocumentInputs(switched, banking)
          );
          await switched.save({ session });
          const staleFilter = this.staleEpochFilter(tokenEpoch);
          await Promise.all([
            MembershipApplicantSession.deleteMany(
              { applicationId: emailChangeApplicationId, ...staleFilter },
              { session }
            ),
            MembershipApplicationAccessToken.deleteMany(
              { applicationId: emailChangeApplicationId, ...staleFilter },
              { session }
            ),
          ]);
          return this.createSession(
            emailChangeApplicationId,
            tokenEpoch + 1,
            session
          );
        });
      } catch (error) {
        if (duplicateKey(error)) {
          throw AppError.conflict(
            'A current membership application already exists'
          );
        }
        throw error;
      }
    }

    if (!applicationId)
      throw AppError.badRequest('The access link is invalid or expired');
    const allowed =
      record.purpose === 'application_access'
        ? await MembershipApplication.findOneAndUpdate(
            {
              _id: applicationId,
              verifiedEmail: record.email,
              status: { $in: ACCESSIBLE_STATUSES },
              ...accessEpochFilter(tokenEpoch),
            },
            { $set: { communicationLocale: record.locale ?? 'de' } },
            { new: false }
          )
        : await MembershipApplication.exists({
            _id: applicationId,
            verifiedEmail: record.email,
            status: { $in: ACCESSIBLE_STATUSES },
            ...accessEpochFilter(tokenEpoch),
          });
    if (!allowed)
      throw AppError.badRequest('The access link is invalid or expired');

    await MembershipApplicantSession.deleteMany({
      applicationId,
      ...this.staleEpochFilter(tokenEpoch),
    });
    return this.createSession(applicationId, tokenEpoch);
  }

  static setSessionCookie(res: Response, slotId: string, token: string): void {
    res.cookie(cookieName(slotId), token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: APPLICANT_SESSION_TTL_MS,
      path: '/api/membership/applicant',
    });
  }

  static clearSessionCookies(res: Response, names: string[]): void {
    for (const name of names.slice(0, MAX_APPLICANT_SESSION_COOKIE_SLOTS)) {
      if (!name.startsWith(APPLICANT_SESSION_COOKIE_PREFIX)) continue;
      const slotId = name.slice(APPLICANT_SESSION_COOKIE_PREFIX.length);
      if (!APPLICANT_SESSION_SLOT_PATTERN.test(slotId)) continue;
      res.clearCookie(name, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        path: '/api/membership/applicant',
      });
    }
  }

  private static parseSessionCookies(cookieHeader: string | undefined): {
    candidates: ApplicantSessionCookieCandidate[];
    observedCookieNames: string[];
    exceeded: boolean;
  } {
    const observed = new Map<string, ApplicantSessionCookieCandidate>();
    for (const part of cookieHeader?.split(';') ?? []) {
      const separator = part.indexOf('=');
      if (separator < 1) continue;
      const name = part.slice(0, separator).trim();
      if (!name.startsWith(APPLICANT_SESSION_COOKIE_PREFIX)) continue;
      const slotId = name.slice(APPLICANT_SESSION_COOKIE_PREFIX.length);
      if (!APPLICANT_SESSION_SLOT_PATTERN.test(slotId)) continue;
      const token = part.slice(separator + 1).trim();
      if (!observed.has(name)) {
        observed.set(name, { name, slotId, token, tokenDigest: digest(token) });
      }
      if (observed.size > MAX_APPLICANT_SESSION_COOKIE_SLOTS) break;
    }
    const all = [...observed.values()];
    const exceeded = all.length > MAX_APPLICANT_SESSION_COOKIE_SLOTS;
    const bounded = all.slice(0, MAX_APPLICANT_SESSION_COOKIE_SLOTS);
    return {
      candidates: exceeded ? [] : bounded,
      observedCookieNames: bounded.map((candidate) => candidate.name),
      exceeded,
    };
  }

  static async resolveSessionCookies(
    cookieHeader: string | undefined
  ): Promise<ApplicantSessionResolution> {
    const parsed = this.parseSessionCookies(cookieHeader);
    if (parsed.exceeded || parsed.candidates.length === 0) {
      return {
        observedCookieNames: parsed.observedCookieNames,
        clearCookieNames: parsed.observedCookieNames,
      };
    }
    const candidatesByDigest = new Map<
      string,
      ApplicantSessionCookieCandidate[]
    >();
    for (const candidate of parsed.candidates) {
      const grouped = candidatesByDigest.get(candidate.tokenDigest) ?? [];
      grouped.push(candidate);
      candidatesByDigest.set(candidate.tokenDigest, grouped);
    }
    const sessions = await MembershipApplicantSession.find({
      tokenDigest: { $in: [...candidatesByDigest.keys()] },
    })
      .select(
        '+tokenDigest cookieSlotId applicationId applicantAccessEpoch expiresAt createdAt'
      )
      .lean();
    const applications = await MembershipApplication.find({
      _id: { $in: sessions.map((session) => session.applicationId) },
    })
      .select('_id applicantAccessEpoch status')
      .lean();
    const applicationsById = new Map(
      applications.map((application) => [
        application._id.toString(),
        application,
      ])
    );
    const now = Date.now();
    const valid = sessions
      .filter((session) => {
        const candidate = candidatesByDigest
          .get(session.tokenDigest)
          ?.find((item) => item.slotId === session.cookieSlotId);
        const application = applicationsById.get(
          session.applicationId.toString()
        );
        return Boolean(
          candidate &&
            application &&
            session.expiresAt.getTime() > now &&
            accessEpoch(session.applicantAccessEpoch) ===
              accessEpoch(application.applicantAccessEpoch) &&
            ACCESSIBLE_STATUSES.includes(application.status)
        );
      })
      .sort((left, right) => {
        const issuedDifference =
          right.createdAt.getTime() - left.createdAt.getTime();
        return (
          issuedDifference ||
          right._id.toString().localeCompare(left._id.toString())
        );
      });
    const selected = valid[0];
    const selectedName = selected
      ? cookieName(selected.cookieSlotId)
      : undefined;
    const matchedSessions = sessions.filter((session) =>
      candidatesByDigest
        .get(session.tokenDigest)
        ?.some((item) => item.slotId === session.cookieSlotId)
    );
    const staleSessionIds = matchedSessions
      .filter(
        (session) =>
          !selected || session._id.toString() !== selected._id.toString()
      )
      .map((session) => session._id);
    if (staleSessionIds.length > 0) {
      await MembershipApplicantSession.deleteMany({
        _id: { $in: staleSessionIds },
      });
    }
    return {
      applicationId: selected?.applicationId.toString(),
      observedCookieNames: parsed.observedCookieNames,
      clearCookieNames: parsed.observedCookieNames.filter(
        (name) => name !== selectedName
      ),
    };
  }

  static async revokeApplicationSessions(applicationId: string): Promise<void> {
    await MembershipApplicantSession.deleteMany({ applicationId });
    await MembershipApplicationAccessToken.deleteMany({ applicationId });
  }

  static async synchronizeCommunicationLocale(
    applicationId: string,
    locale: Locale
  ): Promise<void> {
    const updated = await MembershipApplication.updateOne(
      {
        _id: applicationId,
        status: {
          $in: [MemberApplicationStatus.DRAFT, MemberApplicationStatus.PENDING],
        },
      },
      { $set: { communicationLocale: locale } }
    );
    if (updated.matchedCount !== 1) {
      throw AppError.conflict('Application locale cannot be changed');
    }
  }

  private static async sendGuidanceIfReachable(
    email: string,
    locale: Locale,
    kind: ApplicantGuidanceKind
  ): Promise<void> {
    const [hasApplication, hasUser] = await Promise.all([
      MembershipApplication.exists({ verifiedEmail: email }),
      User.exists({ email }),
    ]);
    if (!hasApplication && !hasUser) return;
    await EmailService.sendFromTemplate(
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.ACCESS_GUIDANCE,
      email,
      locale,
      {
        message: APPLICANT_GUIDANCE[kind][locale],
      }
    );
  }

  private static guidanceKindFor(
    error: unknown
  ): ApplicantGuidanceKind | undefined {
    if (!(error instanceof AppError)) return undefined;
    if (error.code === MEMBERSHIP_APPLICATION_POLICY_CODES.EMAIL_UNAVAILABLE) {
      return 'contact_club';
    }
    if (error.code === MEMBERSHIP_APPLICATION_POLICY_CODES.RETRY_LATER) {
      return 'retry_later';
    }
    return undefined;
  }

  private static async sendCurrentApplicationAccessIfPresent(
    email: string,
    locale: Locale
  ): Promise<boolean> {
    const existing = await MembershipApplication.findOne({
      verifiedEmail: email,
      status: {
        $in: [MemberApplicationStatus.DRAFT, MemberApplicationStatus.PENDING],
      },
    })
      .select('_id applicantAccessEpoch')
      .lean();
    if (!existing) return false;
    const token = await this.issue({
      purpose: 'application_access',
      email,
      applicationId: existing._id.toString(),
      applicantAccessEpoch: accessEpoch(existing.applicantAccessEpoch),
      locale,
    });
    await EmailService.sendFromTemplate(
      MEMBERSHIP_APPLICATION_EMAIL_TEMPLATES.ACCESS,
      email,
      locale,
      { accessUrl: accessUrl(token, locale) }
    );
    return true;
  }
}
