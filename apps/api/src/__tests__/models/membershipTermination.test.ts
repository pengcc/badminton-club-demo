import { describe, expect, it } from 'vitest';
import {
  MembershipTerminationSource,
  MembershipTerminationStatus,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';
import { MembershipTermination } from '../../models/MembershipTermination';

const actor = {
  id: '64b000000000000000000001',
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  administratorDesignation: true,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
};

function baseRecord() {
  return {
    userId: '64b000000000000000000002',
    status: MembershipTerminationStatus.PENDING_REVIEW,
    isOpen: true,
    source: MembershipTerminationSource.ONLINE,
    requestedAt: new Date('2026-05-01T00:00:00.000Z'),
    requestedBy: actor,
    requestedEffectiveDate: '2026-06-30',
    requestIdempotencyKey: 'termination-request-test-key',
    requestIntentFingerprint: 'fingerprint',
  };
}

describe('MembershipTermination model', () => {
  it('defines one partial unique open-record index per User', () => {
    const index = MembershipTermination.schema
      .indexes()
      .find(([fields]) => fields.userId === 1 && fields.isOpen === 1);
    expect(index?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { isOpen: true },
    });
  });

  it('requires complete approval facts for approved state', async () => {
    const termination = new MembershipTermination({
      ...baseRecord(),
      status: MembershipTerminationStatus.APPROVED,
    });
    await expect(termination.validate()).rejects.toThrow(
      /complete approval facts/
    );
  });

  it('requires effective records to be closed', async () => {
    const termination = new MembershipTermination({
      ...baseRecord(),
      status: MembershipTerminationStatus.EFFECTIVE,
      approvedAt: new Date('2026-05-02T00:00:00.000Z'),
      approvedBy: actor,
      confirmedEffectiveDate: '2026-06-30',
      approvalIdempotencyKey: 'termination-approval-test-key',
      approvalIntentFingerprint: 'approval-fingerprint',
      effectiveAt: new Date('2026-06-30T02:00:00.000Z'),
      isOpen: true,
    });
    await expect(termination.validate()).rejects.toThrow(/must be closed/);
  });

  it('requires complete rejection facts and no approval outcome', async () => {
    const incomplete = new MembershipTermination({
      ...baseRecord(),
      status: MembershipTerminationStatus.REJECTED,
      isOpen: false,
    });
    await expect(incomplete.validate()).rejects.toThrow(
      /complete rejection facts/
    );

    const rejected = new MembershipTermination({
      ...baseRecord(),
      status: MembershipTerminationStatus.REJECTED,
      isOpen: false,
      rejectedAt: new Date('2026-05-02T00:00:00.000Z'),
      rejectedBy: actor,
      rejectionReason: 'Not approved',
      rejectionIdempotencyKey: 'termination-rejection-test-key',
      rejectionIntentFingerprint: 'rejection-fingerprint',
    });
    await expect(rejected.validate()).resolves.toBeUndefined();

    rejected.effectiveAt = new Date('2026-06-30T02:00:00.000Z');
    await expect(rejected.validate()).rejects.toThrow(/approval facts/);
  });
});
