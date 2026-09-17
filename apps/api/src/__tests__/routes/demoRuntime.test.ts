import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../../config';
import { enforceDemoMutationFirewall } from '../../middleware/demoRuntime';
import demoRuntimeRoutes from '../../routes/demoRuntime';

const originalEnabled = config.demoRuntime.enabled;

afterEach(() => {
  config.demoRuntime.enabled = originalEnabled;
});

describe('anonymous demo-runtime projection', () => {
  it.each([
    true,
    false,
  ])('returns only the authoritative enabled=%s state', async (enabled) => {
    config.demoRuntime.enabled = enabled;
    const app = express();
    app.use(enforceDemoMutationFirewall);
    app.use('/api/demo-runtime', demoRuntimeRoutes);

    const response = await request(app).get('/api/demo-runtime');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { enabled } });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
