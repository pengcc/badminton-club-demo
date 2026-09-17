import { describe, expect, it } from 'vitest';
import { MemberApplicationStatus } from '@club/shared-types/core/enums';
import {
  DRAFT_RETENTION_MS,
  TERMINAL_RETENTION_MS,
  isMembershipApplicationRetentionDue,
} from '../../services/membershipApplicationRetentionPolicy';

const now = new Date('2026-08-07T12:00:00.000Z');

describe('Membership Application retention policy', () => {
  it('selects a draft exactly at 30 days of applicant-data inactivity, not one millisecond earlier', () => {
    expect(
      isMembershipApplicationRetentionDue(
        {
          status: MemberApplicationStatus.DRAFT,
          applicantDataUpdatedAt: new Date(now.getTime() - DRAFT_RETENTION_MS),
        },
        now
      )
    ).toBe(true);
    expect(
      isMembershipApplicationRetentionDue(
        {
          status: MemberApplicationStatus.DRAFT,
          applicantDataUpdatedAt: new Date(
            now.getTime() - DRAFT_RETENTION_MS + 1
          ),
        },
        now
      )
    ).toBe(false);
  });

  it('never selects a pending application by age', () => {
    expect(
      isMembershipApplicationRetentionDue(
        {
          status: MemberApplicationStatus.PENDING,
          applicantDataUpdatedAt: new Date(0),
        },
        now
      )
    ).toBe(false);
  });

  it.each([
    [MemberApplicationStatus.APPROVED, 'approvedAt'],
    [MemberApplicationStatus.REJECTED, 'rejectedAt'],
    [MemberApplicationStatus.WITHDRAWN, 'withdrawnAt'],
  ] as const)('selects %s only from its explicit terminal timestamp at 90 days', (status, field) => {
    expect(
      isMembershipApplicationRetentionDue(
        {
          status,
          [field]: new Date(now.getTime() - TERMINAL_RETENTION_MS),
          applicantDataUpdatedAt: new Date(0),
        },
        now
      )
    ).toBe(true);
    expect(
      isMembershipApplicationRetentionDue(
        {
          status,
          [field]: new Date(now.getTime() - TERMINAL_RETENTION_MS + 1),
          applicantDataUpdatedAt: new Date(0),
        },
        now
      )
    ).toBe(false);
  });
});
