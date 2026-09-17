import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { Settings } from '../models/Settings.js';
import { SettingsService } from '../services/settingsService.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const apiDirectory = path.resolve(directory, '../../');
const environmentFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.join(apiDirectory, environmentFile) });

const legacySettingsMessage =
  'Legacy single-language Team settings detected. No locale can be inferred safely, so no data was changed. In a resettable environment, run the controlled db:reset workflow. Retained data requires a separately authorized transition decision.';

export async function ensureCanonicalSettings(): Promise<void> {
  const storedSettings = await Settings.collection.findOne({});
  const teamContent = storedSettings?.teamPublicContent;

  if (
    typeof teamContent?.title === 'string' ||
    typeof teamContent?.description === 'string'
  ) {
    throw new Error(legacySettingsMessage);
  }

  if (storedSettings) {
    console.log('✅ Canonical Settings already exist; no data changed');
    return;
  }

  await SettingsService.getSettings();
  console.log('✅ Canonical Settings created successfully');
}

async function seedSettings(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error(`MONGODB_URI is required in ${environmentFile}`);

  await mongoose.connect(uri);
  try {
    await ensureCanonicalSettings();
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1]?.includes('seedSettings.ts')) {
  seedSettings().catch((error) => {
    console.error('Settings seeding failed', {
      operation: 'seed_settings',
      reasonCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
    });
    process.exit(1);
  });
}

export { legacySettingsMessage, seedSettings };
