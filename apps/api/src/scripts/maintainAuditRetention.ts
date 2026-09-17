import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import { AuditService } from '../services/auditService';

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

export function parseAuditRetentionArguments(args: string[]): {
  apply: boolean;
} {
  const supported = new Set(['--', '--apply']);
  const unsupported = args.filter((argument) => !supported.has(argument));
  if (unsupported.length > 0) {
    throw new Error('AUDIT_RETENTION_CONFIGURATION_INVALID');
  }
  return { apply: args.includes('--apply') };
}

async function runCli(): Promise<number> {
  loadEnvironment();
  const { apply } = parseAuditRetentionArguments(process.argv.slice(2));
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('AUDIT_RETENTION_CONFIGURATION_INVALID');

  await mongoose.connect(mongoUri, { autoIndex: false });
  const report = await AuditService.maintainRetention({ apply });
  process.stdout.write(`${JSON.stringify(report)}\n`);
  return 0;
}

const isMainModule = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMainModule) {
  runCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch(() => {
      process.stderr.write(
        `${JSON.stringify({ status: 'failed', reasonCode: 'AUDIT_RETENTION_FAILED' })}\n`
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
