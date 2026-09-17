import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApiEnvironment } from '../config/apiEnvironment';
import {
  ensureTasterSessionIndexes,
  inspectTasterSessionReadiness,
  TasterSessionReadinessBlockedError,
} from '../services/tasterSessionReadinessService';

const currentFilePath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(currentFilePath);
const apiDir = path.resolve(scriptDir, '../../');

loadApiEnvironment({ apiDirectory: apiDir });

export async function checkTasterSessionReadiness(
  ensureIndex: boolean
): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(mongoUri, { autoIndex: false });
  try {
    const report = ensureIndex
      ? await ensureTasterSessionIndexes(mongoose.connection)
      : await inspectTasterSessionReadiness(mongoose.connection);
    console.log(JSON.stringify(report, null, 2));
    if (!ensureIndex && 'blockers' in report && report.blockers.length > 0) {
      throw new TasterSessionReadinessBlockedError(report);
    }
  } finally {
    await mongoose.disconnect();
  }
}

async function main(): Promise<void> {
  try {
    await checkTasterSessionReadiness(process.argv.includes('--ensure-index'));
  } catch (error) {
    if (error instanceof TasterSessionReadinessBlockedError) {
      const blockers = 'blockers' in error.report ? error.report.blockers : [];
      console.error(
        `Taster Session readiness blocked: ${blockers.join(', ') || 'pending-email index prerequisite is not satisfied'}`
      );
    } else {
      console.error(
        `Taster Session readiness failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  void main();
}
