import { MemberApplicationStatus } from '@club/shared-types/core/enums';
import type { Domain } from '@club/shared-types/domain/membershipApplication';
import type { Types } from 'mongoose';
import { MemberBankingProfile } from '../models/MemberBankingProfile';
import { MembershipApplication } from '../models/MembershipApplication';
import {
  RegistrationApprovalEvent,
  RegistrationApprovalStatus,
} from '../models/RegistrationApprovalEvent';
import {
  bankingCryptoService,
  type BankingCryptoService,
} from './bankingCryptoService';

interface ApplicationBankingRecord {
  _id: Types.ObjectId;
  status: string;
  approvedUserId?: Types.ObjectId;
  encryptedBanking?: Domain.BankingEncryptionEnvelope;
}

export interface BankingIntegrityFinding {
  applicationId: string;
  status: string;
  flags: string[];
}

export interface BankingIntegrityReport {
  inspected: number;
  ready: boolean;
  findings: BankingIntegrityFinding[];
}

export interface BankingReleaseCompatibilityReport {
  inspected: number;
  referencedKeyVersionCount: number;
  unavailableKeyVersionCount: number;
  ready: boolean;
}

export class MembershipApplicationBankingIntegrityService {
  constructor(
    private readonly crypto: BankingCryptoService = bankingCryptoService
  ) {}

  async verifyReady(): Promise<BankingIntegrityReport> {
    const records = (await MembershipApplication.collection
      .find({
        $or: [
          { status: MemberApplicationStatus.APPROVED },
          { encryptedBanking: { $exists: true } },
        ],
      })
      .toArray()) as unknown as ApplicationBankingRecord[];
    const findings: BankingIntegrityFinding[] = [];

    for (const record of records) {
      const flags: string[] = [];
      if (record.encryptedBanking) {
        try {
          this.crypto.decrypt(
            record.encryptedBanking,
            'membership-application',
            record._id.toString()
          );
        } catch {
          flags.push('encrypted_banking_unreadable');
        }
      }
      if (record.status === MemberApplicationStatus.APPROVED) {
        if (!record.approvedUserId) flags.push('approved_user_missing');
        else if (
          !(await this.hasDurableApproval(record._id, record.approvedUserId))
        ) {
          flags.push('approval_provenance_missing');
        } else {
          const profile = await MemberBankingProfile.findOne({
            userId: record.approvedUserId,
          })
            .select('sourceApplicationId')
            .lean();
          if (
            profile &&
            profile.sourceApplicationId.toString() !== record._id.toString()
          ) {
            flags.push('member_banking_destination_conflict');
          } else if (!profile) {
            flags.push('member_banking_destination_missing');
          }
        }
      }
      if (flags.length) {
        findings.push({
          applicationId: record._id.toString(),
          status: record.status,
          flags,
        });
      }
    }

    return {
      inspected: records.length,
      ready: findings.length === 0,
      findings,
    };
  }

  async inspectReleaseCompatibility(): Promise<BankingReleaseCompatibilityReport> {
    const records = (await MembershipApplication.collection
      .find(
        {
          status: {
            $in: [
              MemberApplicationStatus.DRAFT,
              MemberApplicationStatus.PENDING,
            ],
          },
          encryptedBanking: { $type: 'object' },
        },
        { projection: { 'encryptedBanking.keyVersion': 1 } }
      )
      .toArray()) as unknown as ApplicationBankingRecord[];
    const referencedKeyVersions = new Set(
      records.flatMap((record) => {
        const keyVersion = record.encryptedBanking?.keyVersion;
        return typeof keyVersion === 'string' && keyVersion ? [keyVersion] : [];
      })
    );
    const unavailableKeyVersionCount = [...referencedKeyVersions].filter(
      (keyVersion) => !this.crypto.hasKeyVersion(keyVersion)
    ).length;

    return {
      inspected: records.length,
      referencedKeyVersionCount: referencedKeyVersions.size,
      unavailableKeyVersionCount,
      ready: unavailableKeyVersionCount === 0,
    };
  }

  private async hasDurableApproval(
    applicationId: Types.ObjectId,
    userId: Types.ObjectId
  ): Promise<boolean> {
    const event = await RegistrationApprovalEvent.findOne({
      applicationId,
      status: RegistrationApprovalStatus.COMPLETED,
      'result.userId': userId.toString(),
    }).lean();
    return Boolean(event);
  }
}

export const membershipApplicationBankingIntegrityService =
  new MembershipApplicationBankingIntegrityService();
