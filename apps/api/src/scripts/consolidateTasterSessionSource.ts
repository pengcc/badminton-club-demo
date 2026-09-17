import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApiEnvironment } from '../config/apiEnvironment';
import { Settings } from '../models/Settings';
import {
  inspectTasterSessionSourceConsolidation,
  applyTasterSessionSourceTransfers,
  loadRawSharedTasterSourceLocations,
  type LegacyTasterSessionConfiguration,
} from '../services/tasterSessionSourceConsolidationService';

const currentFilePath = fileURLToPath(import.meta.url);
const apiDirectory = path.resolve(path.dirname(currentFilePath), '../../');
loadApiEnvironment({ apiDirectory });

function approvedUnrestrictedSlots(): Set<string> {
  return new Set(
    process.argv
      .filter((argument) => argument.startsWith('--approve-unrestricted-slot='))
      .map((argument) => argument.slice('--approve-unrestricted-slot='.length))
      .filter(Boolean)
  );
}

export async function consolidateTasterSessionSource(
  apply: boolean
): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is required');
  if (
    apply &&
    process.env.TASTER_SESSION_SOURCE_CONSOLIDATION_APPLY !== 'confirmed'
  ) {
    throw new Error(
      'Apply requires TASTER_SESSION_SOURCE_CONSOLIDATION_APPLY=confirmed'
    );
  }

  await mongoose.connect(mongoUri, { autoIndex: false });
  try {
    const [settings, locations] = await Promise.all([
      Settings.collection.findOne({}, { projection: { trialTraining: 1 } }),
      loadRawSharedTasterSourceLocations(),
    ]);
    const report = inspectTasterSessionSourceConsolidation(
      settings?.trialTraining as LegacyTasterSessionConfiguration | undefined,
      locations,
      { approvedUnrestrictedSlots: approvedUnrestrictedSlots() }
    );
    console.log(
      JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...report }, null, 2)
    );
    if (report.blockers.length > 0) {
      throw new Error(
        `Taster Session source consolidation blocked: ${report.blockers.join(', ')}`
      );
    }
    if (!apply) return;

    await applyTasterSessionSourceTransfers(report.transfers);
  } finally {
    await mongoose.disconnect();
  }
}

async function main(): Promise<void> {
  try {
    await consolidateTasterSessionSource(process.argv.includes('--apply'));
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : 'Taster Session source consolidation failed'
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  void main();
}
