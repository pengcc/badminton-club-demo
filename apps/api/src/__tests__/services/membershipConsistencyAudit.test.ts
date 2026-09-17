import { describe, expect, it } from 'vitest';
import {
  auditReasonDefinitions,
  classifyMembershipConsistency,
  createAuditCaseKey,
  type AuditReasonCode,
  type MembershipAuditSnapshot,
} from '../../services/membershipConsistencyAudit';
import {
  renderMembershipAuditSummary,
  runMembershipConsistencyAudit,
} from '../../services/runMembershipConsistencyAudit';

const auditSalt = 'stable-membership-audit-test-salt';

const snapshot: MembershipAuditSnapshot = {
  users: [
    {
      id: 'u-flag',
      isPlayer: true,
      membershipStatus: 'active',
    },
    {
      id: 'u-false',
      isPlayer: false,
      membershipStatus: 'active',
    },
    {
      id: 'u-suspended',
      isPlayer: true,
      membershipStatus: 'suspended',
    },
    {
      id: 'u-inactive',
      isPlayer: true,
      membershipStatus: 'inactive',
    },
    {
      id: 'u-guest',
      isPlayer: true,
      membershipStatus: 'passive',
    },
    {
      id: 'u-pending',
      isPlayer: false,
      membershipStatus: 'pending',
    },
    {
      id: 'u-invalid',
      isPlayer: false,
      membershipStatus: 'archived',
    },
    {
      id: 'u-ineligible',
      isPlayer: true,
      membershipStatus: 'active',
    },
    {
      id: 'u-super-admin',
      accountKind: 'super_admin',
      isPlayer: false,
    },
  ],
  players: [
    { id: 'p-false', userId: 'u-false', isActivePlayer: true, teamIds: [] },
    {
      id: 'p-suspended',
      userId: 'u-suspended',
      type: 'member',
      isActivePlayer: true,
      teamIds: [],
    },
    {
      id: 'p-inactive',
      userId: 'u-inactive',
      isActivePlayer: true,
      teamIds: [],
    },
    { id: 'p-guest', userId: 'u-guest', isActivePlayer: true, teamIds: [] },
    {
      id: 'p-ineligible',
      userId: 'u-ineligible',
      isActivePlayer: false,
      teamIds: ['t-current'],
    },
    {
      id: 'p-orphan',
      userId: 'u-missing',
      isActivePlayer: true,
      teamIds: ['t-missing'],
    },
  ],
  teams: [{ id: 't-current', legacyPlayerIds: ['p-ineligible', 'p-missing'] }],
  matches: [
    {
      id: 'm-historical',
      startAt: '2020-01-01T00:00:00.000Z',
      lineupPlayerIds: ['p-deleted-historical'],
      availabilityPlayerIds: [],
    },
    {
      id: 'm-current',
      startAt: '2099-01-01T00:00:00.000Z',
      lineupPlayerIds: ['p-deleted-current', 'p-ineligible'],
      availabilityPlayerIds: ['p-deleted-availability'],
    },
  ],
};

function categoryMap(salt = auditSalt) {
  return new Map(
    classifyMembershipConsistency(snapshot, salt).map((category) => [
      category.reasonCode,
      category,
    ])
  );
}

describe('membership consistency classification', () => {
  it('covers every required reason code with its approved classification', () => {
    const categories = categoryMap();

    expect([...categories.keys()]).toEqual(Object.keys(auditReasonDefinitions));
    for (const [reasonCode, definition] of Object.entries(
      auditReasonDefinitions
    )) {
      const category = categories.get(reasonCode as AuditReasonCode);
      expect(category?.classification).toBe(definition.classification);
      if (
        reasonCode === 'INACTIVE_USER_WITH_ACTIVE_MEMBER_PLAYER' ||
        reasonCode === 'GUEST_OR_TEMPORARY_PLAYER' ||
        reasonCode === 'ACTIVE_PASSIVE_EXTERNAL_CONTRADICTION' ||
        reasonCode === 'MISSING_PLAYER_TYPE_EXTERNAL_CANDIDATE'
      ) {
        expect(category?.count).toBe(0);
      } else {
        expect(category?.count, reasonCode).toBeGreaterThan(0);
      }
      expect(category?.caseKeys).toHaveLength(category?.count ?? 0);
    }
  });

  it('is repeatable for unchanged fixtures and salt', () => {
    expect(classifyMembershipConsistency(snapshot, auditSalt)).toEqual(
      classifyMembershipConsistency(snapshot, auditSalt)
    );
  });

  it('uses stable non-raw case keys with salt separation', () => {
    const first = createAuditCaseKey(
      auditSalt,
      'USER_PLAYER_FLAG_WITHOUT_PLAYER',
      ['user:507f1f77bcf86cd799439011']
    );
    const repeated = createAuditCaseKey(
      auditSalt,
      'USER_PLAYER_FLAG_WITHOUT_PLAYER',
      ['user:507f1f77bcf86cd799439011']
    );
    const differentSalt = createAuditCaseKey(
      'different-membership-audit-salt',
      'USER_PLAYER_FLAG_WITHOUT_PLAYER',
      ['user:507f1f77bcf86cd799439011']
    );

    expect(first).toBe(repeated);
    expect(first).not.toBe(differentSalt);
    expect(first).not.toContain('507f1f77bcf86cd799439011');
    expect(first).toMatch(/^membership-audit-v1-[a-f0-9]{24}$/);
  });

  it('distinguishes historical missing references from current missing and ineligible references', () => {
    const categories = categoryMap();

    expect(
      categories.get('HISTORICAL_MATCH_PLAYER_REFERENCE_MISSING')?.count
    ).toBe(1);
    expect(
      categories.get('CURRENT_MATCH_PLAYER_REFERENCE_MISSING')?.count
    ).toBe(2);
    expect(
      categories.get('CURRENT_MATCH_PLAYER_REFERENCE_INELIGIBLE')?.count
    ).toBe(1);
  });

  it('classifies inactive Users with active Players only as ambiguous external candidates', () => {
    const categories = categoryMap();
    const category = categories.get('INACTIVE_USER_EXTERNAL_CANDIDATE');

    expect(category).toEqual(
      expect.objectContaining({
        classification: 'ambiguous review',
        count: 1,
      })
    );
    expect(categories.get('INACTIVE_USER_WITH_ACTIVE_MEMBER_PLAYER')).toEqual(
      expect.objectContaining({
        classification: 'deterministic candidate',
        count: 0,
        caseKeys: [],
      })
    );
    expect(category).not.toHaveProperty('targetState');
  });

  it('uses an explicit member Player type for deterministic inactive-member findings', () => {
    const typedSnapshot: MembershipAuditSnapshot = {
      users: [
        {
          id: 'u-inactive-typed',
          isPlayer: true,
          membershipStatus: 'inactive',
        },
      ],
      players: [
        {
          id: 'p-inactive-typed',
          userId: 'u-inactive-typed',
          type: 'member',
          isActivePlayer: true,
          teamIds: [],
        },
      ],
      teams: [],
      matches: [],
    };
    const categories = new Map(
      classifyMembershipConsistency(typedSnapshot, auditSalt).map(
        (category) => [category.reasonCode, category]
      )
    );

    expect(
      categories.get('INACTIVE_USER_WITH_ACTIVE_MEMBER_PLAYER')?.count
    ).toBe(1);
    expect(categories.get('INACTIVE_USER_EXTERNAL_CANDIDATE')?.count).toBe(0);
  });

  it('does not diagnose the personless canonical Super Admin as invalid Membership', () => {
    const invalid = categoryMap().get('INVALID_MEMBERSHIP_STATUS');
    const withoutSuperAdmin = {
      ...snapshot,
      users: snapshot.users.filter((user) => user.id !== 'u-super-admin'),
    };
    const comparison = new Map(
      classifyMembershipConsistency(withoutSuperAdmin, auditSalt).map(
        (category) => [category.reasonCode, category]
      )
    );

    expect(invalid).toEqual(comparison.get('INVALID_MEMBERSHIP_STATUS'));
  });
});

describe('membership consistency report', () => {
  const readResult = {
    databaseName: 'safe-audit-database',
    collections: {
      users: {
        required: true,
        available: true,
        count: 9,
        source: 'collection' as const,
      },
      players: {
        required: true,
        available: true,
        count: 6,
        source: 'collection' as const,
      },
      teams: {
        required: true,
        available: true,
        count: 1,
        source: 'collection' as const,
      },
      matches: {
        required: true,
        available: true,
        count: 2,
        source: 'collection' as const,
      },
      lineups: {
        required: false,
        available: false,
        count: null,
        source: 'embedded-in-matches' as const,
      },
    },
    snapshot,
  };

  it('fails before reading when the audit salt is missing', async () => {
    let reads = 0;

    await expect(
      runMembershipConsistencyAudit({
        dataSource: {
          read: async () => {
            reads += 1;
            return readResult;
          },
        },
      })
    ).rejects.toMatchObject({ code: 'MISSING_AUDIT_SALT' });
    expect(reads).toBe(0);
  });

  it('produces deterministic safe JSON and a concise summary', async () => {
    const dataSource = { read: async () => readResult };
    const first = await runMembershipConsistencyAudit({
      salt: auditSalt,
      dataSource,
    });
    const second = await runMembershipConsistencyAudit({
      salt: auditSalt,
      dataSource,
    });
    const serialized = JSON.stringify(first);
    const summary = renderMembershipAuditSummary(first);

    expect(first).toEqual(second);
    expect(first.database).toEqual({
      name: 'safe-audit-database',
      collections: readResult.collections,
    });
    expect(first.aggregateCounts.findings).toBeGreaterThan(0);
    expect(summary).toContain(
      'Membership consistency audit: safe-audit-database'
    );
    expect(summary).toContain('Unavailable optional collections: lineups');

    for (const forbidden of [
      'email',
      'firstName',
      'lastName',
      'password',
      'token',
      'u-inactive',
      'p-inactive',
      'm-current',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('fails safely when any read is interrupted', async () => {
    await expect(
      runMembershipConsistencyAudit({
        salt: auditSalt,
        dataSource: {
          read: async () => {
            throw new Error('connection interrupted with unsafe details');
          },
        },
      })
    ).rejects.toMatchObject({
      code: 'READ_FAILED',
      message:
        'Membership audit reads did not complete; no report was produced.',
    });
  });
});
