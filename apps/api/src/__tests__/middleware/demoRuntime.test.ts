import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import authRoutes from '../../routes/auth';
import membershipApplicationRoutes from '../../routes/membershipApplications';
import tasterSessionRequestRoutes from '../../routes/tasterSessionRequests';
import userRoutes from '../../routes/users';
import { UserService } from '../../services/userService';
import { config } from '../../config';
import { enforceDemoMutationFirewall } from '../../middleware/demoRuntime';
import { errorHandler } from '../../middleware/errorHandler';

const originalDemoRuntime = { ...config.demoRuntime };

function createApp(downstream: RequestHandler) {
  const app = express();
  app.use(express.json());
  app.use(enforceDemoMutationFirewall);
  app.use(downstream);
  app.use('/api/auth', authRoutes);
  app.use('/api/membership', membershipApplicationRoutes);
  app.use('/api/taster-session-requests', tasterSessionRequestRoutes);
  app.use('/api/users', userRoutes);
  app.use(errorHandler);
  return app;
}

describe('public demo mutation firewall route composition', () => {
  beforeEach(() => {
    config.demoRuntime.enabled = true;
    config.demoRuntime.adminEmail = 'demo.admin@club.invalid';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    config.demoRuntime.enabled = originalDemoRuntime.enabled;
    config.demoRuntime.adminEmail = originalDemoRuntime.adminEmail;
    vi.restoreAllMocks();
  });

  it.each([
    'get',
    'head',
  ] as const)('blocks email verification %s before any downstream work', async (method) => {
    const downstream = vi.fn<RequestHandler>((_req, _res, next) => next());
    const app = createApp(downstream);

    for (const path of [
      '/api/users/verify-email-change/test-token',
      '/API/Users/Verify-Email-Change/test-token/?source=test',
    ]) {
      const response = await request(app)[method](path);
      expect(response.status).toBe(403);
      if (method === 'get') {
        expect(response.body).toMatchObject({
          success: false,
          code: 'DEMO_ACTION_UNAVAILABLE',
        });
      }
      expect(downstream).not.toHaveBeenCalled();
    }
  });

  it.each([
    'get',
    'head',
  ] as const)('preserves ordinary email verification through %s', async (method) => {
    config.demoRuntime.enabled = false;
    const verify = vi
      .spyOn(UserService, 'verifyEmailChange')
      .mockRejectedValue(new Error('Invalid verification token'));
    const downstream = vi.fn<RequestHandler>((_req, _res, next) => next());
    const response = await request(createApp(downstream))[method](
      '/api/users/verify-email-change/test-token'
    );
    expect(downstream).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledWith('test-token');
    expect(response.status).not.toBe(403);
  });

  it('blocks representative public side effects before downstream route middleware', async () => {
    const downstream = vi.fn<RequestHandler>((_req, _res, next) => next());
    const app = createApp(downstream);
    const scenarios = [
      {
        method: 'post' as const,
        path: '/api/auth/password-recovery/request',
        body: { email: 'visitor@example.test', locale: 'en' },
      },
      {
        method: 'post' as const,
        path: '/api/membership/applicant/access-requests',
        body: { email: 'visitor@example.test', locale: 'en' },
      },
      {
        method: 'patch' as const,
        path: '/api/membership/applicant/application',
        body: { firstName: 'Demo' },
      },
      {
        method: 'patch' as const,
        path: '/api/membership/applicant/application/student-proof',
      },
      {
        method: 'post' as const,
        path: '/api/membership/applicant/application/documents/email',
        body: { locale: 'en' },
      },
      {
        method: 'post' as const,
        path: '/api/taster-session-requests',
        body: {
          firstName: 'Demo',
          lastName: 'Visitor',
          email: 'visitor@example.test',
          level: 'beginner',
          locale: 'en',
        },
      },
    ];

    for (const scenario of scenarios) {
      downstream.mockClear();
      const response =
        scenario.method === 'patch'
          ? await request(app).patch(scenario.path).send(scenario.body)
          : await request(app).post(scenario.path).send(scenario.body);

      expect(response.status, scenario.path).toBe(403);
      expect(response.body, scenario.path).toMatchObject({
        success: false,
        code: 'DEMO_ACTION_UNAVAILABLE',
      });
      expect(downstream, scenario.path).not.toHaveBeenCalled();
    }
  });
});
