import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { RegistrationAccess } from '../models/RegistrationAccess';
import type { RegistrationAccessExpiryMode } from '../models/RegistrationAccess';
import { AppError } from '../utils/errors';

const CURRENT_LINK_ID = 'current';
const EXPIRY_DAYS: Record<
  Exclude<RegistrationAccessExpiryMode, 'none'>,
  number
> = {
  '30_days': 30,
  '90_days': 90,
  '180_days': 180,
};

export interface RegistrationAccessMetadata {
  hasCurrentLink: boolean;
  isValid: boolean;
  expiryMode?: RegistrationAccessExpiryMode;
  expiresAt?: string;
  generation?: number;
  updatedAt?: string;
}
export interface RegistrationAccessAdminState
  extends RegistrationAccessMetadata {
  path?: string;
}

export interface RegistrationAccessValidation {
  generation: number;
  issuedAt: Date;
}

export class RegistrationAccessService {
  private static digest(token: string): Buffer {
    return createHash('sha256').update(token, 'utf8').digest();
  }

  private static expiry(
    mode: RegistrationAccessExpiryMode,
    now: Date
  ): Date | null {
    if (mode === 'none') return null;
    return new Date(now.getTime() + EXPIRY_DAYS[mode] * 24 * 60 * 60 * 1000);
  }

  private static toMetadata(
    record: {
      expiryMode: RegistrationAccessExpiryMode;
      expiresAt: Date | null;
      generation: number;
      updatedAt: Date;
    } | null
  ): RegistrationAccessMetadata {
    if (!record) return { hasCurrentLink: false, isValid: false };
    const isValid =
      record.expiresAt === null || record.expiresAt.getTime() > Date.now();
    return {
      hasCurrentLink: true,
      isValid,
      expiryMode: record.expiryMode,
      expiresAt: record.expiresAt?.toISOString(),
      generation: record.generation,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  static async getAdminState(): Promise<RegistrationAccessAdminState> {
    const record = await RegistrationAccess.findById(CURRENT_LINK_ID)
      .select('+tokenDigest +recoverableToken')
      .lean();
    const metadata = this.toMetadata(record);
    if (!record || !metadata.isValid) return metadata;

    const token = record.recoverableToken;
    if (!token || !/^[A-Za-z0-9_-]{12}$/.test(token)) return metadata;

    const expected = Buffer.from(record.tokenDigest, 'hex');
    const actual = this.digest(token);
    return expected.length === actual.length &&
      timingSafeEqual(expected, actual)
      ? { ...metadata, path: `/apply?k=${encodeURIComponent(token)}` }
      : metadata;
  }

  static async issue(
    mode: RegistrationAccessExpiryMode,
    actorId: string,
    requireNoValidLink: boolean
  ): Promise<RegistrationAccessMetadata> {
    if (!['30_days', '90_days', '180_days', 'none'].includes(mode)) {
      throw new AppError('Invalid registration link expiry mode', 400);
    }

    const current = await RegistrationAccess.findById(CURRENT_LINK_ID).lean();
    const currentValid =
      current &&
      (current.expiresAt === null || current.expiresAt.getTime() > Date.now());
    if (requireNoValidLink && currentValid) {
      throw new AppError('A current registration link already exists', 409);
    }

    const token = randomBytes(9).toString('base64url');
    const now = new Date();
    const updated = await RegistrationAccess.findOneAndUpdate(
      { _id: CURRENT_LINK_ID },
      {
        $set: {
          tokenDigest: this.digest(token).toString('hex'),
          recoverableToken: token,
          expiryMode: mode,
          expiresAt: this.expiry(mode, now),
          updatedBy: actorId,
        },
        $inc: { generation: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    if (!updated) throw new AppError('Failed to issue registration link', 500);
    return this.toMetadata(updated);
  }

  static async validate(token: string | undefined): Promise<boolean> {
    return (await this.validateAndGetContext(token)) !== undefined;
  }

  static async validateAndGetGeneration(
    token: string | undefined
  ): Promise<number | undefined> {
    return (await this.validateAndGetContext(token))?.generation;
  }

  static async validateAndGetContext(
    token: string | undefined
  ): Promise<RegistrationAccessValidation | undefined> {
    if (!token || !/^[A-Za-z0-9_-]{12}$/.test(token)) return undefined;
    const record = await RegistrationAccess.findById(CURRENT_LINK_ID)
      .select('+tokenDigest')
      .lean();
    if (
      !record ||
      (record.expiresAt && record.expiresAt.getTime() <= Date.now())
    )
      return undefined;

    const expected = Buffer.from(record.tokenDigest, 'hex');
    const actual = this.digest(token);
    return expected.length === actual.length &&
      timingSafeEqual(expected, actual)
      ? { generation: record.generation, issuedAt: record.updatedAt }
      : undefined;
  }

  static requireTokenHeader(
    headers: Record<string, unknown>
  ): string | undefined {
    const value = headers['x-registration-key'];
    return typeof value === 'string' ? value : undefined;
  }
}
