import path from 'node:path';
import * as dotenv from 'dotenv';

type EnvironmentLoader = (
  options: dotenv.DotenvConfigOptions
) => dotenv.DotenvConfigOutput;

export interface ApiEnvironmentState {
  environmentPath: string;
  alternateDevelopmentDatabase: boolean;
}

export function resolveApiEnvironmentPath(
  apiDirectory: string,
  nodeEnv = process.env.NODE_ENV
): string {
  const fileName = nodeEnv === 'production' ? '.env.production' : '.env.local';
  return path.join(apiDirectory, fileName);
}

export function loadApiEnvironment({
  apiDirectory,
  nodeEnv = process.env.NODE_ENV,
  load = dotenv.config,
}: {
  apiDirectory: string;
  nodeEnv?: string;
  load?: EnvironmentLoader;
}): ApiEnvironmentState {
  const environmentPath = resolveApiEnvironmentPath(apiDirectory, nodeEnv);
  if (nodeEnv === 'test') {
    return { environmentPath, alternateDevelopmentDatabase: false };
  }

  const inheritedMongoUri = process.env.MONGODB_URI;
  const inheritedPublicUploadsRoot =
    process.env.DEVELOPMENT_PUBLIC_UPLOADS_ROOT;
  const { parsed } = load({ path: environmentPath, quiet: true });
  const isDevelopmentEnvironment =
    nodeEnv === undefined || nodeEnv === 'development';
  const alternateDevelopmentDatabase = Boolean(
    isDevelopmentEnvironment &&
      inheritedMongoUri !== undefined &&
      parsed?.MONGODB_URI !== undefined &&
      inheritedMongoUri !== parsed.MONGODB_URI
  );

  if (alternateDevelopmentDatabase) {
    console.error(
      'Development database mode: alternate MONGODB_URI override is active for this process; apps/api/.env.local is unchanged.'
    );
  }

  if (
    isDevelopmentEnvironment &&
    inheritedPublicUploadsRoot !== undefined &&
    inheritedPublicUploadsRoot !== parsed?.DEVELOPMENT_PUBLIC_UPLOADS_ROOT
  ) {
    throw new Error(
      'Development public uploads root conflicts with apps/api/.env.local. Remove the process-level override and rerun pnpm bootstrap:local-env.'
    );
  }

  return { environmentPath, alternateDevelopmentDatabase };
}
