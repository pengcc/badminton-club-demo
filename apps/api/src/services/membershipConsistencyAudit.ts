import { createHmac } from 'node:crypto';

export const auditClassifications = [
  'deterministic candidate',
  'ambiguous review',
  'referential-risk case',
] as const;

export type AuditClassification = (typeof auditClassifications)[number];

export const auditReasonDefinitions = {
  USER_PLAYER_FLAG_WITHOUT_PLAYER: {
    classification: 'deterministic candidate',
  },
  USER_FLAG_FALSE_WITH_ACTIVE_PLAYER: {
    classification: 'deterministic candidate',
  },
  INACTIVE_USER_WITH_ACTIVE_MEMBER_PLAYER: {
    classification: 'deterministic candidate',
  },
  INACTIVE_USER_EXTERNAL_CANDIDATE: { classification: 'ambiguous review' },
  GUEST_OR_TEMPORARY_PLAYER: { classification: 'ambiguous review' },
  PLAYER_WITHOUT_VALID_USER: { classification: 'referential-risk case' },
  TEAM_REFERENCE_MISSING_PLAYER: { classification: 'referential-risk case' },
  TEAM_REFERENCE_INELIGIBLE_PLAYER: { classification: 'referential-risk case' },
  PLAYER_REFERENCE_MISSING_TEAM: { classification: 'referential-risk case' },
  HISTORICAL_MATCH_PLAYER_REFERENCE_MISSING: {
    classification: 'referential-risk case',
  },
  CURRENT_MATCH_PLAYER_REFERENCE_MISSING: {
    classification: 'referential-risk case',
  },
  CURRENT_MATCH_PLAYER_REFERENCE_INELIGIBLE: {
    classification: 'referential-risk case',
  },
  LEGACY_PENDING_MEMBERSHIP: { classification: 'ambiguous review' },
  INVALID_MEMBERSHIP_STATUS: { classification: 'ambiguous review' },
  ACTIVE_PASSIVE_EXTERNAL_CONTRADICTION: { classification: 'ambiguous review' },
  MISSING_PLAYER_TYPE_EXTERNAL_CANDIDATE: {
    classification: 'deterministic candidate',
  },
  MISSING_PLAYER_TYPE_REVIEW: { classification: 'ambiguous review' },
} as const satisfies Record<string, { classification: AuditClassification }>;

export type AuditReasonCode = keyof typeof auditReasonDefinitions;

export interface AuditUserRecord {
  id: string;
  accountKind?: string;
  isPlayer: boolean;
  membershipStatus?: string;
}

export interface AuditPlayerRecord {
  id: string;
  userId?: string;
  type?: string;
  isActivePlayer: boolean;
  teamIds: string[];
}

export interface AuditTeamRecord {
  id: string;
  legacyPlayerIds: string[];
}

export interface AuditMatchRecord {
  id: string;
  startAt?: string;
  lineupPlayerIds: string[];
  availabilityPlayerIds: string[];
}

export interface MembershipAuditSnapshot {
  users: AuditUserRecord[];
  players: AuditPlayerRecord[];
  teams: AuditTeamRecord[];
  matches: AuditMatchRecord[];
}

export interface AuditCategoryResult {
  reasonCode: AuditReasonCode;
  classification: AuditClassification;
  count: number;
  caseKeys: string[];
}

const supportedMembershipStatuses = new Set(['active', 'passive', 'inactive']);
const memberPlayerType = 'member';
const externalPlayerType = 'external';

function caseKey(
  salt: string,
  reasonCode: AuditReasonCode,
  identities: string[]
): string {
  const canonicalInput = [reasonCode, ...identities.sort()].join('\u0000');
  const digest = createHmac('sha256', salt)
    .update(canonicalInput)
    .digest('hex');
  return `membership-audit-v1-${digest.slice(0, 24)}`;
}

export function createAuditCaseKey(
  salt: string,
  reasonCode: AuditReasonCode,
  identities: string[]
): string {
  if (!salt.trim()) {
    throw new Error('Membership audit salt is required');
  }
  return caseKey(salt, reasonCode, identities);
}

export function classifyMembershipConsistency(
  snapshot: MembershipAuditSnapshot,
  salt: string,
  evaluatedAt = new Date()
): AuditCategoryResult[] {
  if (!salt.trim()) {
    throw new Error('Membership audit salt is required');
  }

  const findings = new Map<AuditReasonCode, Set<string>>(
    (Object.keys(auditReasonDefinitions) as AuditReasonCode[]).map(
      (reasonCode) => [reasonCode, new Set<string>()]
    )
  );
  const usersById = new Map(snapshot.users.map((user) => [user.id, user]));
  const playersById = new Map(
    snapshot.players.map((player) => [player.id, player])
  );
  const teamsById = new Map(snapshot.teams.map((team) => [team.id, team]));
  const playersByUserId = new Map<string, AuditPlayerRecord[]>();

  for (const player of snapshot.players) {
    if (!player.userId) continue;
    const linkedPlayers = playersByUserId.get(player.userId) ?? [];
    linkedPlayers.push(player);
    playersByUserId.set(player.userId, linkedPlayers);
  }

  const addFinding = (reasonCode: AuditReasonCode, identities: string[]) => {
    findings.get(reasonCode)?.add(caseKey(salt, reasonCode, identities));
  };

  for (const user of snapshot.users) {
    if (user.accountKind === 'super_admin') continue;

    const linkedPlayers = playersByUserId.get(user.id) ?? [];
    const activePlayers = linkedPlayers.filter(
      (player) => player.isActivePlayer
    );
    const hasExternalPlayer = linkedPlayers.some(
      (player) => player.type === externalPlayerType
    );

    if (user.isPlayer && linkedPlayers.length === 0) {
      addFinding('USER_PLAYER_FLAG_WITHOUT_PLAYER', [`user:${user.id}`]);
    }

    if (!user.isPlayer) {
      for (const player of activePlayers) {
        addFinding('USER_FLAG_FALSE_WITH_ACTIVE_PLAYER', [
          `user:${user.id}`,
          `player:${player.id}`,
        ]);
      }
    }

    if (user.membershipStatus === 'inactive') {
      for (const player of activePlayers) {
        const identities = [`user:${user.id}`, `player:${player.id}`];
        if (player.type === memberPlayerType) {
          addFinding('INACTIVE_USER_WITH_ACTIVE_MEMBER_PLAYER', identities);
        } else if (!player.type) {
          addFinding('INACTIVE_USER_EXTERNAL_CANDIDATE', identities);
        }
      }
    } else if (user.membershipStatus === 'pending') {
      addFinding('LEGACY_PENDING_MEMBERSHIP', [`user:${user.id}`]);
    } else if (
      !user.membershipStatus ||
      !supportedMembershipStatuses.has(user.membershipStatus)
    ) {
      addFinding('INVALID_MEMBERSHIP_STATUS', [`user:${user.id}`]);
    }

    if (
      hasExternalPlayer &&
      ['active', 'passive'].includes(user.membershipStatus ?? '')
    ) {
      addFinding('ACTIVE_PASSIVE_EXTERNAL_CONTRADICTION', [`user:${user.id}`]);
    }

    if (hasExternalPlayer) {
      for (const player of linkedPlayers) {
        if (player.type === externalPlayerType) {
          addFinding('GUEST_OR_TEMPORARY_PLAYER', [
            `user:${user.id}`,
            `player:${player.id}`,
          ]);
        }
      }
    }
  }

  for (const player of snapshot.players) {
    const linkedUser = player.userId ? usersById.get(player.userId) : undefined;
    if (!linkedUser) {
      addFinding('PLAYER_WITHOUT_VALID_USER', [`player:${player.id}`]);
    }

    if (!player.type) {
      addFinding(
        'MISSING_PLAYER_TYPE_REVIEW',
        linkedUser
          ? [`user:${linkedUser.id}`, `player:${player.id}`]
          : [`player:${player.id}`]
      );
    }

    for (const teamId of player.teamIds) {
      const identities = [`player:${player.id}`, `team:${teamId}`];
      if (!teamsById.has(teamId)) {
        addFinding('PLAYER_REFERENCE_MISSING_TEAM', identities);
      } else if (!player.isActivePlayer) {
        addFinding('TEAM_REFERENCE_INELIGIBLE_PLAYER', identities);
      }
    }
  }

  for (const team of snapshot.teams) {
    for (const playerId of team.legacyPlayerIds) {
      const identities = [`team:${team.id}`, `player:${playerId}`];
      const player = playersById.get(playerId);
      if (!player) {
        addFinding('TEAM_REFERENCE_MISSING_PLAYER', identities);
      } else if (!player.isActivePlayer) {
        addFinding('TEAM_REFERENCE_INELIGIBLE_PLAYER', identities);
      }
    }
  }

  for (const match of snapshot.matches) {
    const startAt = match.startAt ? Date.parse(match.startAt) : Number.NaN;
    const historical =
      Number.isFinite(startAt) && startAt <= evaluatedAt.getTime();
    const references = [
      ...match.lineupPlayerIds.map((playerId) => ({
        playerId,
        source: 'lineup',
      })),
      ...match.availabilityPlayerIds.map((playerId) => ({
        playerId,
        source: 'availability',
      })),
    ];

    for (const reference of references) {
      const identities = [
        `match:${match.id}`,
        `player:${reference.playerId}`,
        `source:${reference.source}`,
      ];
      const player = playersById.get(reference.playerId);
      if (!player) {
        addFinding(
          historical
            ? 'HISTORICAL_MATCH_PLAYER_REFERENCE_MISSING'
            : 'CURRENT_MATCH_PLAYER_REFERENCE_MISSING',
          identities
        );
      } else if (!historical && !player.isActivePlayer) {
        addFinding('CURRENT_MATCH_PLAYER_REFERENCE_INELIGIBLE', identities);
      }
    }
  }

  return (Object.keys(auditReasonDefinitions) as AuditReasonCode[]).map(
    (reasonCode) => {
      const caseKeys = [...(findings.get(reasonCode) ?? [])].sort();
      return {
        reasonCode,
        classification: auditReasonDefinitions[reasonCode].classification,
        count: caseKeys.length,
        caseKeys,
      };
    }
  );
}
