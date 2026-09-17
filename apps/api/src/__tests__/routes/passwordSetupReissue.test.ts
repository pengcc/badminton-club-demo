import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ reissueForApplication: vi.fn() }));
vi.mock('../../middleware/auth', () => ({
  protect: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin', capabilities: ['administration'] };
    next();
  },
  authorizeCapability: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../services/passwordSetupDeliveryService', () => ({
  PasswordSetupDeliveryService: {
    reissueForApplication: mocks.reissueForApplication,
  },
}));

import routes from '../../routes/membershipApplications';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/membership', routes);
  instance.use((error: any, _req: any, res: any, _next: any) =>
    res.status(error.statusCode ?? 500).json({ error: error.message })
  );
  return instance;
}

describe('POST application password setup reissue', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns generation-bound status without exposing a raw token', async () => {
    mocks.reissueForApplication.mockResolvedValue({
      generation: 2,
      deliveryStatus: 'sent',
    });
    const response = await request(app()).post(
      '/api/membership/applications/507f1f77bcf86cd799439012/password-setup/reissue'
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      generation: 2,
      deliveryStatus: 'sent',
    });
    expect(JSON.stringify(response.body)).not.toContain('token');
  });
});
