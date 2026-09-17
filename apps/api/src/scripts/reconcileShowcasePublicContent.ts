import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApiEnvironment } from '../config/apiEnvironment';
import {
  auditShowcasePublicContent,
  reconcileShowcasePublicContent,
  ShowcaseReconciliationError,
} from '../services/showcasePublicContentReconciliationService';

export function parseShowcaseReconciliationArgs(args: string[]) {
  let apply = false;
  let auditOnly = false;
  const approvals = new Map<string, string>();
  for (const arg of args) {
    if (arg === '--') continue;
    if (arg === '--audit' && !auditOnly) {
      auditOnly = true;
      continue;
    }
    if (arg === '--apply' && !apply) {
      apply = true;
      continue;
    }
    const match = /^--approve-custom=([a-z-]+):([a-f0-9]{64})$/.exec(arg);
    if (!match || approvals.has(match[1]))
      throw new ShowcaseReconciliationError('CUSTOM_APPROVAL_INVALID');
    approvals.set(match[1], match[2]);
  }
  if (auditOnly && apply)
    throw new ShowcaseReconciliationError('CUSTOM_APPROVAL_INVALID');
  return { apply, approvals };
}

async function main(): Promise<void> {
  const { apply, approvals } = parseShowcaseReconciliationArgs(
    process.argv.slice(2)
  );
  const apiDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../'
  );
  loadApiEnvironment({ apiDirectory });
  const confirmed = process.env.SHOWCASE_PUBLIC_CONTENT_APPLY === 'confirmed';
  if (apply && !confirmed)
    throw new ShowcaseReconciliationError('APPLY_CONFIRMATION_REQUIRED');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new ShowcaseReconciliationError('PUBLIC_CONTENT_BLOCKED');
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  try {
    const report = apply
      ? await reconcileShowcasePublicContent({ confirmed, approvals })
      : await auditShowcasePublicContent(approvals);
    console.log(
      JSON.stringify({ mode: apply ? 'apply' : 'audit', ...report }, null, 2)
    );
    if (!report.converged) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error: unknown) => {
    // Never print database, transport, validation, or arbitrary error text.
    console.error(
      error instanceof ShowcaseReconciliationError
        ? error.code
        : 'PUBLIC_CONTENT_OPERATION_FAILED'
    );
    process.exitCode = 1;
  });
}
