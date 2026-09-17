import type { AuditClassification } from './membershipConsistencyAudit';
import {
  auditClassifications,
  classifyMembershipConsistency,
  type AuditCategoryResult,
  type MembershipAuditSnapshot,
} from './membershipConsistencyAudit';

export interface AuditCollectionAvailability {
  required: boolean;
  available: boolean;
  count: number | null;
  source: 'collection' | 'embedded-in-matches';
}

export interface AuditReadResult {
  databaseName: string;
  collections: Record<string, AuditCollectionAvailability>;
  snapshot: MembershipAuditSnapshot;
}

export interface MembershipAuditDataSource {
  read(): Promise<AuditReadResult>;
}

export interface MembershipConsistencyAuditReport {
  schemaVersion: 1;
  database: {
    name: string;
    collections: Record<string, AuditCollectionAvailability>;
  };
  aggregateCounts: {
    records: {
      users: number;
      players: number;
      teams: number;
      matches: number;
    };
    findings: number;
    byClassification: Record<AuditClassification, number>;
  };
  categories: AuditCategoryResult[];
}

export class MembershipAuditError extends Error {
  constructor(
    public readonly code: 'MISSING_AUDIT_SALT' | 'READ_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'MembershipAuditError';
  }
}

export async function runMembershipConsistencyAudit(options: {
  salt?: string;
  dataSource: MembershipAuditDataSource;
}): Promise<MembershipConsistencyAuditReport> {
  if (!options.salt?.trim()) {
    throw new MembershipAuditError(
      'MISSING_AUDIT_SALT',
      'MEMBERSHIP_AUDIT_SALT is required; no audit was run.'
    );
  }

  let readResult: AuditReadResult;
  try {
    readResult = await options.dataSource.read();
  } catch (error) {
    if (error instanceof MembershipAuditError) throw error;
    throw new MembershipAuditError(
      'READ_FAILED',
      'Membership audit reads did not complete; no report was produced.'
    );
  }

  const categories = classifyMembershipConsistency(
    readResult.snapshot,
    options.salt
  );
  const byClassification = Object.fromEntries(
    auditClassifications.map((classification) => [classification, 0])
  ) as Record<AuditClassification, number>;

  for (const category of categories) {
    byClassification[category.classification] += category.count;
  }

  return {
    schemaVersion: 1,
    database: {
      name: readResult.databaseName,
      collections: readResult.collections,
    },
    aggregateCounts: {
      records: {
        users: readResult.snapshot.users.length,
        players: readResult.snapshot.players.length,
        teams: readResult.snapshot.teams.length,
        matches: readResult.snapshot.matches.length,
      },
      findings: categories.reduce(
        (total, category) => total + category.count,
        0
      ),
      byClassification,
    },
    categories,
  };
}

export function renderMembershipAuditSummary(
  report: MembershipConsistencyAuditReport
): string {
  const nonZeroCategories = report.categories.filter(
    (category) => category.count > 0
  );
  const unavailableCollections = Object.entries(report.database.collections)
    .filter(([, availability]) => !availability.available)
    .map(([name]) => name)
    .sort();

  const lines = [
    `Membership consistency audit: ${report.database.name}`,
    `Records: ${report.aggregateCounts.records.users} users, ${report.aggregateCounts.records.players} players, ${report.aggregateCounts.records.teams} teams, ${report.aggregateCounts.records.matches} matches`,
    `Findings: ${report.aggregateCounts.findings} across ${nonZeroCategories.length} reason codes`,
    ...auditClassifications.map(
      (classification) =>
        `- ${classification}: ${report.aggregateCounts.byClassification[classification]}`
    ),
  ];

  if (unavailableCollections.length > 0) {
    lines.push(
      `Unavailable optional collections: ${unavailableCollections.join(', ')}`
    );
  }

  return lines.join('\n');
}
