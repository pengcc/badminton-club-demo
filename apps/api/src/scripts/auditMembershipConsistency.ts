import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import {
  MongoMembershipAuditDataSource,
  type MembershipAuditDatabase,
} from '../services/membershipAuditMongoDataSource';
import {
  MembershipAuditError,
  renderMembershipAuditSummary,
  runMembershipConsistencyAudit,
  type MembershipConsistencyAuditReport,
} from '../services/runMembershipConsistencyAudit';

const auditSaltEnvironmentVariable = 'MEMBERSHIP_AUDIT_SALT';

export function membershipAuditExitCode(
  report: MembershipConsistencyAuditReport,
  failOnInvariant: boolean
): number {
  if (!failOnInvariant) return 0;

  const hasInvariant = report.categories.some(
    (category) =>
      category.count > 0 &&
      (category.classification === 'deterministic candidate' ||
        category.classification === 'referential-risk case')
  );
  return hasInvariant ? 2 : 0;
}

function loadEnvironment(): void {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const apiDirectory = path.resolve(scriptDirectory, '../..');
  const environmentFile =
    process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
  dotenv.config({
    path: path.join(apiDirectory, environmentFile),
    quiet: true,
  });
}

export function parseMembershipAuditArguments(args: string[]): {
  failOnInvariant: boolean;
} {
  const supportedArguments = new Set(['--', '--fail-on-invariant']);
  const unsupported = args.filter(
    (argument) => !supportedArguments.has(argument)
  );
  if (unsupported.length > 0) {
    throw new MembershipAuditError(
      'READ_FAILED',
      `Unsupported membership audit option: ${unsupported.join(', ')}`
    );
  }
  return { failOnInvariant: args.includes('--fail-on-invariant') };
}

async function runCli(): Promise<number> {
  loadEnvironment();
  const { failOnInvariant } = parseMembershipAuditArguments(
    process.argv.slice(2)
  );
  const mongoUri = process.env.MONGODB_URI;
  const salt = process.env[auditSaltEnvironmentVariable];

  if (!salt?.trim()) {
    throw new MembershipAuditError(
      'MISSING_AUDIT_SALT',
      'MEMBERSHIP_AUDIT_SALT is required; no audit was run.'
    );
  }

  if (!mongoUri) {
    throw new MembershipAuditError(
      'READ_FAILED',
      'MONGODB_URI is required; no audit was run.'
    );
  }

  await mongoose.connect(mongoUri, { autoIndex: false });
  const database = mongoose.connection.db;
  if (!database) {
    throw new MembershipAuditError(
      'READ_FAILED',
      'MongoDB connected without a resolved database; no audit was run.'
    );
  }

  const report = await runMembershipConsistencyAudit({
    salt,
    dataSource: new MongoMembershipAuditDataSource(
      database as unknown as MembershipAuditDatabase
    ),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.stderr.write(`${renderMembershipAuditSummary(report)}\n`);
  return membershipAuditExitCode(report, failOnInvariant);
}

function safeError(error: unknown): { code: string; message: string } {
  if (error instanceof MembershipAuditError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'AUDIT_FAILED',
    message:
      'Membership audit failed before a complete report could be produced.',
  };
}

const isMainModule = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMainModule) {
  runCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      process.stderr.write(
        `${JSON.stringify({ success: false, error: safeError(error) })}\n`
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
