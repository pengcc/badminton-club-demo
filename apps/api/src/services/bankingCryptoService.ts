import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Domain } from '@club/shared-types/domain/membershipApplication';
import { bankingInfoDraftSchema } from '@club/shared-types/domain/membershipApplication';
import { AppError } from '../utils/errors';
import { config } from '../config';

export type BankingEncryptionPurpose =
  | 'membership-application'
  | 'member-banking-profile';

export interface BankingKeyRing {
  activeKeyVersion: string;
  keys: Record<string, string>;
}

function additionalData(
  purpose: BankingEncryptionPurpose,
  ownerId: string
): Buffer {
  return Buffer.from(`badminton-club:${purpose}:${ownerId}`, 'utf8');
}

export class BankingCryptoService {
  constructor(
    private readonly keyRing: BankingKeyRing = config.bankingEncryption
  ) {}

  encrypt(
    banking: Domain.BankingInfoDraft,
    purpose: BankingEncryptionPurpose,
    ownerId: string
  ): Domain.BankingEncryptionEnvelope {
    const key = this.keyFor(this.keyRing.activeKeyVersion);
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(additionalData(purpose, ownerId));
    const ciphertext = Buffer.concat([
      cipher.update(
        JSON.stringify(bankingInfoDraftSchema.parse(banking)),
        'utf8'
      ),
      cipher.final(),
    ]);
    return {
      keyVersion: this.keyRing.activeKeyVersion,
      nonce: nonce.toString('base64url'),
      ciphertext: ciphertext.toString('base64url'),
      authTag: cipher.getAuthTag().toString('base64url'),
    };
  }

  decrypt(
    envelope: Domain.BankingEncryptionEnvelope,
    purpose: BankingEncryptionPurpose,
    ownerId: string
  ): Domain.BankingInfoDraft {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.keyFor(envelope.keyVersion),
        Buffer.from(envelope.nonce, 'base64url')
      );
      decipher.setAAD(additionalData(purpose, ownerId));
      decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64url'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
      return bankingInfoDraftSchema.parse(JSON.parse(plaintext));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal('Stored banking data could not be decrypted');
    }
  }

  hasKeyVersion(version: string): boolean {
    const encoded = this.keyRing.keys[version];
    return (
      Boolean(version) &&
      typeof encoded === 'string' &&
      Buffer.from(encoded, 'base64').length === 32
    );
  }

  private keyFor(version: string): Buffer {
    const encoded = this.keyRing.keys[version];
    if (!encoded)
      throw AppError.internal('Stored banking key version is unavailable');
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32)
      throw AppError.internal('Configured banking encryption key is invalid');
    return key;
  }
}

export const bankingCryptoService = new BankingCryptoService();
