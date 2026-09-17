import type { Application, RequestHandler } from 'express';
import type { RuntimeReadinessService } from '../services/runtimeReadinessService';

type RuntimeReadinessStatus = 'blocked' | 'degraded' | 'ready';

interface RuntimeReadinessResponse {
  status: RuntimeReadinessStatus;
  reasonCodes: string[];
}

export interface RuntimeReadinessDependencies {
  getRuntimeSnapshot: RuntimeReadinessService['snapshot'];
  getMongoReadyState: () => number;
}

export function registerRuntimeOperationalRoutes(
  app: Application,
  dependencies: RuntimeReadinessDependencies
): void {
  app.get('/api/health', (_request, response) => {
    response.status(200).json({ status: 'OK', message: 'Server is running' });
  });
  app.get('/api/ready', createRuntimeReadinessHandler(dependencies));
}

export function createRuntimeReadinessHandler({
  getRuntimeSnapshot,
  getMongoReadyState,
}: RuntimeReadinessDependencies): RequestHandler {
  return (_request, response) => {
    const runtime = getRuntimeSnapshot();
    const hardReasonCodes: string[] = [];

    if (!runtime.listening) hardReasonCodes.push('STARTUP_NOT_READY');
    if (getMongoReadyState() !== 1) hardReasonCodes.push('MONGO_UNAVAILABLE');

    const reasonCodes = [...hardReasonCodes, ...runtime.degradationReasonCodes];
    const body: RuntimeReadinessResponse = {
      status:
        hardReasonCodes.length > 0
          ? 'blocked'
          : runtime.degradationReasonCodes.length > 0
            ? 'degraded'
            : 'ready',
      reasonCodes,
    };

    response.status(hardReasonCodes.length > 0 ? 503 : 200).json(body);
  };
}
