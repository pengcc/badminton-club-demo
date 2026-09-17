import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const DEMO_EMAIL = 'demo.admin@club.invalid';

export function readFreshDemoInputs(
  args: string[],
  environment: NodeJS.ProcessEnv
): { uri: string; password: string } {
  const password = environment.SHOWCASE_DEMO_ADMIN_PASSWORD;
  if (
    environment.NODE_ENV !== 'production' ||
    args.length !== 1 ||
    args[0] !== '--fresh-empty-target' ||
    !environment.MONGODB_URI ||
    environment.SHOWCASE_DEMO_ADMIN_EMAIL?.trim().toLowerCase() !==
      DEMO_EMAIL ||
    !password ||
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72 ||
    ['admin123', 'member123', 'demo1234'].includes(password) ||
    password.startsWith('<')
  ) {
    throw new Error('FRESH_DEMO_INPUTS_REQUIRED');
  }
  return { uri: environment.MONGODB_URI, password };
}

// The deployment owner must keep all other writers (including API startup) off
// this newly provisioned target. This check is not a database-wide write lock.
export async function assertFreshDemoDatabase(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db || ['admin', 'config', 'local'].includes(db.databaseName)) {
    throw new Error('FRESH_DEMO_TARGET_REFUSED');
  }
  const collections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();
  for (const collection of collections) {
    if (collection.name.startsWith('system.')) continue;
    if (
      await db
        .collection(collection.name)
        .findOne({}, { projection: { _id: 1 } })
    ) {
      throw new Error('FRESH_DEMO_TARGET_NOT_EMPTY');
    }
  }
}

export async function bootstrapFreshPublicDemo(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env
): Promise<void> {
  // Capture explicit inputs before importing seed modules that load env files.
  const { uri, password } = readFreshDemoInputs(args, environment);
  try {
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
    await assertFreshDemoDatabase();
    const { createSyntheticSeed } = await import('./seedData.js');
    // Only after empty-target admission: establish application schema indexes.
    for (const name of mongoose.modelNames()) {
      await mongoose.model(name).createIndexes();
    }
    await createSyntheticSeed(
      (email) =>
        email === DEMO_EMAIL ? password : randomBytes(32).toString('base64url'),
      'canonical'
    );
    console.log(
      'Fresh public demo bootstrap completed. Run public-content audit and readiness before API startup.'
    );
  } catch {
    // Never forward database, validation, credential or fixture-bearing errors.
    throw new Error(
      'FRESH_DEMO_BOOTSTRAP_FAILED: Do not retry or repair this target; the deployment owner must recreate the new environment before retrying.'
    );
  } finally {
    await mongoose.disconnect();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  bootstrapFreshPublicDemo(process.argv.slice(2)).catch(() => {
    console.error(
      'Fresh public demo bootstrap refused or failed. Verify production inputs and fresh-target acknowledgement. Never retry over partial state; recreate the new target under deployment authority.'
    );
    process.exitCode = 1;
  });
}
