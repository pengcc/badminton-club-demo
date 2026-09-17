import path from 'node:path';

export function resolvePublicUploadsRoot({
  nodeEnv,
  workingDirectory,
  configuredRoot,
}: {
  nodeEnv: string;
  workingDirectory: string;
  configuredRoot: string | undefined;
}): string {
  if (nodeEnv !== 'development') {
    return path.resolve(workingDirectory, 'uploads');
  }

  if (!configuredRoot || !path.isAbsolute(configuredRoot)) {
    throw new Error(
      'Development public uploads root is missing or invalid. Run pnpm bootstrap:local-env.'
    );
  }

  return path.resolve(configuredRoot);
}
