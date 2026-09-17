import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { config, resolveTrustProxy } from '../../config';
import { requireFirstPartyRequest } from '../../middleware/firstPartyRequest';
import { createLoginRateLimiter } from '../../middleware/loginRateLimiter';

const FIRST_PARTY_ORIGIN = new URL(config.frontendUrl).origin;

function createLoginApp(environment: string) {
  const app = express();
  app.set('trust proxy', resolveTrustProxy(environment));
  app.use(express.json());
  app.post(
    '/api/auth/login',
    requireFirstPartyRequest,
    createLoginRateLimiter({ windowMs: 60_000, max: 1 }),
    (_request, response) => response.status(204).end()
  );
  return app;
}

describe('Login rate limiter', () => {
  it('trusts exactly one production proxy hop and no non-production proxies', () => {
    expect(resolveTrustProxy('production')).toBe(1);
    expect(resolveTrustProxy('development')).toBe(false);
    expect(resolveTrustProxy('test')).toBe(false);
  });

  it('keys production requests by the rightmost proxy-appended client address', async () => {
    const app = createLoginApp('production');

    await request(app)
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .set('X-Forwarded-For', '198.51.100.11, 203.0.113.7')
      .expect(204);

    const blocked = await request(app)
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .set('X-Forwarded-For', '198.51.100.99, 203.0.113.7')
      .expect(429);

    expect(blocked.body).toEqual({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: expect.any(Number),
    });
    expect(blocked.headers['retry-after']).toBeDefined();

    await request(app)
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .set('X-Forwarded-For', '198.51.100.11, 203.0.113.8')
      .expect(204);
  });

  it('does not trust a forwarded client address outside production', async () => {
    const app = express();
    app.set('trust proxy', resolveTrustProxy('test'));
    app.get('/client-ip', (req, res) => res.json({ ip: req.ip }));

    const direct = await request(app).get('/client-ip');
    const forwarded = await request(app)
      .get('/client-ip')
      .set('X-Forwarded-For', '203.0.113.20');

    expect(forwarded.body.ip).toBe(direct.body.ip);
    expect(forwarded.body.ip).not.toBe('203.0.113.20');
  });

  it('does not consume the Login quota for rejected cross-origin requests', async () => {
    const app = createLoginApp('test');

    await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://attacker.example')
      .expect(403);

    await request(app)
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .expect(204);
  });
});
