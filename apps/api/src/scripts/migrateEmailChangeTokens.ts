import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApiEnvironment } from '../config/apiEnvironment';
import { migrateLegacyEmailChangeTokens } from '../services/emailChangeTokenMigration';

const currentFilePath = fileURLToPath(import.meta.url);
const apiDirectory = path.resolve(path.dirname(currentFilePath), '../../');

loadApiEnvironment({ apiDirectory });

export async function runEmailChangeTokenMigration(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(mongoUri, { autoIndex: false });
  try {
    const report = await migrateLegacyEmailChangeTokens(mongoose.connection);
    console.log(JSON.stringify(report));
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  runEmailChangeTokenMigration().catch((error) => {
    console.error(
      `Email-change token migration failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
    process.exitCode = 1;
  });
}
