import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RuntimeReadinessPreflightReport } from '../services/runtimeReadinessPreflightService';

const currentFilePath = fileURLToPath(import.meta.url);

function configurationFailureReport(): RuntimeReadinessPreflightReport {
  const observedAt = new Date().toISOString();
  return {
    status: 'blocked',
    observedAt,
    checks: [
      {
        checkId: 'configuration',
        status: 'blocked',
        reasonCode: 'CONFIGURATION_INVALID',
        observedAt,
      },
    ],
  };
}

export async function runRuntimeReadinessCli({
  arguments_: argumentsForRun = process.argv.slice(2),
  loadRunner = async () =>
    (await import('../services/runtimeReadinessPreflightDependencies'))
      .runConfiguredRuntimeReadinessPreflight,
  write = (report: RuntimeReadinessPreflightReport) =>
    console.log(JSON.stringify(report, null, 2)),
}: {
  arguments_?: string[];
  loadRunner?: () => Promise<
    (options: {
      verifySmtp: boolean;
    }) => Promise<RuntimeReadinessPreflightReport>
  >;
  write?: (report: RuntimeReadinessPreflightReport) => void;
} = {}): Promise<number> {
  if (argumentsForRun.some((argument) => argument !== '--verify-smtp')) {
    const report = configurationFailureReport();
    write(report);
    return 1;
  }

  try {
    const run = await loadRunner();
    const report = await run({
      verifySmtp: argumentsForRun.includes('--verify-smtp'),
    });
    write(report);
    return report.status === 'blocked' ? 1 : 0;
  } catch {
    const report = configurationFailureReport();
    write(report);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  void runRuntimeReadinessCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
