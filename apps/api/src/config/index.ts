import path from 'path';
import { fileURLToPath } from 'url';
import { loadApiEnvironment } from './apiEnvironment';
import { resolvePublicUploadsRoot } from './publicUploadsConfig';
import { emailSchema } from '@club/shared-types/schemas/user';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDirectory = path.resolve(__dirname, '../..');

const apiEnvironment = loadApiEnvironment({ apiDirectory });

function requiredEnvironmentVariable(
  key: 'MONGODB_URI' | 'FRONTEND_URL'
): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function resolveBankingEncryptionConfig() {
  if (process.env.NODE_ENV === 'test' && !process.env.BANKING_ENCRYPTION_KEYS) {
    return {
      activeKeyVersion: 'test-v1',
      keys: { 'test-v1': Buffer.alloc(32, 7).toString('base64') },
    };
  }

  const activeKeyVersion = process.env.BANKING_ENCRYPTION_ACTIVE_KEY_VERSION;
  const serializedKeys = process.env.BANKING_ENCRYPTION_KEYS;
  if (!activeKeyVersion || !serializedKeys) {
    throw new Error('Missing required banking encryption configuration');
  }

  let keys: Record<string, string>;
  try {
    keys = JSON.parse(serializedKeys) as Record<string, string>;
  } catch {
    throw new Error('BANKING_ENCRYPTION_KEYS must be a JSON object');
  }
  if (!keys[activeKeyVersion]) {
    throw new Error(
      'Active banking encryption key version is not present in BANKING_ENCRYPTION_KEYS'
    );
  }
  for (const [version, encodedKey] of Object.entries(keys)) {
    if (!version || Buffer.from(encodedKey, 'base64').length !== 32) {
      throw new Error(
        `Banking encryption key ${version || '<empty>'} must decode to 32 bytes`
      );
    }
  }
  return { activeKeyVersion, keys };
}

const bankingEncryption = resolveBankingEncryptionConfig();
const nodeEnv = process.env.NODE_ENV || 'development';

export type DevelopmentEmailTransport = 'ethereal' | 'smtp';

export function resolveTrustProxy(environment: string): 1 | false {
  return environment === 'production' ? 1 : false;
}

export function resolveDevelopmentEmailTransport(
  environment: string,
  configuredValue: string | undefined
): DevelopmentEmailTransport | undefined {
  if (environment !== 'development') return undefined;
  const value = configuredValue?.trim().toLowerCase() || 'ethereal';
  if (value !== 'ethereal' && value !== 'smtp') {
    throw new Error('DEV_EMAIL_TRANSPORT must be either ethereal or smtp');
  }
  return value;
}

function resolveDemoRuntimeConfig() {
  const enabled = process.env.SHOWCASE_DEMO_ENABLED === 'true';
  const adminEmail =
    process.env.SHOWCASE_DEMO_ADMIN_EMAIL?.trim().toLowerCase();
  if (enabled && !emailSchema.safeParse(adminEmail).success) {
    throw new Error(
      'SHOWCASE_DEMO_ADMIN_EMAIL must identify the dedicated Demo Admin when SHOWCASE_DEMO_ENABLED=true'
    );
  }
  return { enabled, adminEmail };
}
const privateUploadsRoot = path.resolve(
  process.env.MEMBERSHIP_APPLICATION_PRIVATE_UPLOAD_ROOT ||
    path.join(apiDirectory, 'private_uploads')
);
const publicUploadsRoot = resolvePublicUploadsRoot({
  nodeEnv,
  workingDirectory: process.cwd(),
  configuredRoot: process.env.DEVELOPMENT_PUBLIC_UPLOADS_ROOT,
});
const relative = path.relative(publicUploadsRoot, privateUploadsRoot);
if (!relative || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
  throw new Error(
    'Membership Application private uploads must be outside the public uploads directory'
  );
}

export const config = {
  nodeEnv,
  trustProxy: resolveTrustProxy(nodeEnv),
  developmentEmailTransport: resolveDevelopmentEmailTransport(
    nodeEnv,
    process.env.DEV_EMAIL_TRANSPORT
  ),
  port: parseInt(process.env.PORT || '3003', 10),
  get mongoUri() {
    return requiredEnvironmentVariable('MONGODB_URI');
  },
  get frontendUrl() {
    return requiredEnvironmentVariable('FRONTEND_URL');
  },
  privateUploadsRoot,
  publicUploadsRoot,
  alternateDevelopmentDatabase:
    apiEnvironment?.alternateDevelopmentDatabase ?? false,
  bankingEncryption,
  demoRuntime: resolveDemoRuntimeConfig(),
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },
};

export function resolveApiStartupConfig(): {
  mongoUri: string;
  frontendUrl: string;
} {
  return {
    mongoUri: config.mongoUri,
    frontendUrl: config.frontendUrl,
  };
}

export const isDev = config.nodeEnv === 'development';
export const isProd = config.nodeEnv === 'production';
