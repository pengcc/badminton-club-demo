import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SuperAdminService } from '../services/superAdminService.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const apiDirectory = path.resolve(directory, '../../');
const environmentFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.join(apiDirectory, environmentFile) });

function argument(name: string): string {
  const args = process.argv.slice(2);
  const inline = args.find((value) => value.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  throw new Error(`--${name} is required`);
}

async function run(): Promise<void> {
  const mode = argument('mode');
  if (mode !== 'bootstrap' && mode !== 'recover') {
    throw new Error('--mode must be bootstrap or recover');
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error(`MONGODB_URI is required in ${environmentFile}`);
  await mongoose.connect(uri, { autoIndex: false });
  try {
    const result =
      mode === 'bootstrap'
        ? await SuperAdminService.bootstrap(argument('email'))
        : await SuperAdminService.recover(argument('email'));
    console.log(
      `Super Admin ${mode} completed: account ${result.created ? 'created' : 'preserved'}, setup generation ${result.setupGeneration}, delivery ${result.deliveryStatus ?? 'unchanged'}`
    );
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(
    `Super Admin operation failed: ${error instanceof Error ? error.message : 'Unknown failure'}`
  );
  process.exitCode = 1;
});
