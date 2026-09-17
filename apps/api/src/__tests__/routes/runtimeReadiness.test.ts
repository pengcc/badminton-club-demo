import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createRuntimeReadinessHandler } from '../../routes/runtimeReadiness';

function createResponse() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { response: { status } as unknown as Response, status, json };
}

describe('/api/ready', () => {
  it('returns unavailable until listening succeeds', () => {
    const getRuntimeSnapshot = vi.fn(() => ({
      listening: false,
      degradationReasonCodes: [],
    }));
    const getMongoReadyState = vi.fn(() => 1);
    const handler = createRuntimeReadinessHandler({
      getRuntimeSnapshot,
      getMongoReadyState,
    });
    const { response, status, json } = createResponse();

    handler({} as never, response, vi.fn());

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      status: 'blocked',
      reasonCodes: ['STARTUP_NOT_READY'],
    });
  });

  it('returns unavailable when the current Mongo connection is not ready', () => {
    const handler = createRuntimeReadinessHandler({
      getRuntimeSnapshot: () => ({
        listening: true,
        degradationReasonCodes: [],
      }),
      getMongoReadyState: () => 0,
    });
    const { response, status, json } = createResponse();

    handler({} as never, response, vi.fn());

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      status: 'blocked',
      reasonCodes: ['MONGO_UNAVAILABLE'],
    });
  });

  it('keeps degraded-only state HTTP-ready with bounded reason codes', () => {
    const handler = createRuntimeReadinessHandler({
      getRuntimeSnapshot: () => ({
        listening: true,
        degradationReasonCodes: [
          'MEMBERSHIP_TERMINATION_SCHEDULER_UNAVAILABLE',
        ],
      }),
      getMongoReadyState: () => 1,
    });
    const { response, status, json } = createResponse();

    handler({} as never, response, vi.fn());

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      status: 'degraded',
      reasonCodes: ['MEMBERSHIP_TERMINATION_SCHEDULER_UNAVAILABLE'],
    });
  });

  it('reports ready without invoking any preflight dependency', () => {
    const getRuntimeSnapshot = vi.fn(() => ({
      listening: true,
      degradationReasonCodes: [],
    }));
    const getMongoReadyState = vi.fn(() => 1);
    const handler = createRuntimeReadinessHandler({
      getRuntimeSnapshot,
      getMongoReadyState,
    });
    const { response, status, json } = createResponse();

    handler({} as never, response, vi.fn());

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ status: 'ready', reasonCodes: [] });
    expect(getRuntimeSnapshot).toHaveBeenCalledOnce();
    expect(getMongoReadyState).toHaveBeenCalledOnce();
  });
});
