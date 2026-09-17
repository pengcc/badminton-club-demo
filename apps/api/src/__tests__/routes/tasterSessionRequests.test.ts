import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  stats: vi.fn(),
  get: vi.fn(),
  dispose: vi.fn(),
  setArchived: vi.fn(),
  retryDelivery: vi.fn(),
  listOptions: vi.fn(),
}));

vi.mock('../../services/tasterSessionRequestService', () => ({
  TasterSessionRequestService: {
    create: service.create,
    list: service.list,
    stats: service.stats,
    get: service.get,
    dispose: service.dispose,
    setArchived: service.setArchived,
    retryDelivery: service.retryDelivery,
  },
}));
vi.mock('../../services/tasterSessionPreferencePolicy', () => ({
  TasterSessionPreferencePolicy: {
    listOptions: service.listOptions,
  },
}));
vi.mock('../../middleware/auth', () => ({
  protect: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (req.headers.cookie !== 'club_session=admin') {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    req.user = {
      id: '507f1f77bcf86cd799439011',
      accountKind: 'person',
      displayName: 'Test Admin',
      capabilities: [],
      firstName: 'Test',
      lastName: 'Admin',
      email: 'admin@example.test',
    } as never;
    next();
  },
  authorizeCapability:
    () =>
    (
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction
    ) =>
      next(),
}));

import routes from '../../routes/tasterSessionRequests';

function app() {
  const application = express();
  application.use(express.json());
  application.use('/api/taster-session-requests', routes);
  return application;
}

beforeEach(() => {
  vi.clearAllMocks();
  service.listOptions.mockResolvedValue([]);
  service.create.mockResolvedValue({ id: 'request', status: 'pending' });
  service.list.mockResolvedValue({
    requests: [],
    total: 0,
    limit: 50,
    offset: 0,
  });
});

describe('Taster Session request routes', () => {
  it('keeps preference discovery and visitor submission public but validates the narrow contract', async () => {
    await request(app())
      .get('/api/taster-session-requests/preference-options')
      .query({ playerLevel: 'beginner', locale: 'en' })
      .expect(200);
    expect(service.listOptions).toHaveBeenCalledWith('beginner', 'en');

    await request(app())
      .post('/api/taster-session-requests')
      .send({
        name: 'Visitor',
        email: 'visitor@example.test',
        playerLevel: 'beginner',
        appointmentDate: '2030-08-02T17:00:00.000Z',
      })
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('protects administration and passes normalized list filters through validated query', async () => {
    await request(app()).get('/api/taster-session-requests').expect(401);
    await request(app())
      .get('/api/taster-session-requests')
      .set('Cookie', 'club_session=admin')
      .query({ archived: 'include', status: 'pending', limit: '20' })
      .expect(200);
    expect(service.list).toHaveBeenCalledWith({
      archived: 'include',
      status: 'pending',
      playerLevel: 'all',
      limit: 20,
      offset: 0,
    });
  });

  it('does not expose generic update or hard-delete routes', async () => {
    await request(app())
      .patch('/api/taster-session-requests/507f1f77bcf86cd799439012')
      .set('Cookie', 'club_session=admin')
      .send({ status: 'invited' })
      .expect(404);
    await request(app())
      .delete('/api/taster-session-requests/507f1f77bcf86cd799439012')
      .set('Cookie', 'club_session=admin')
      .expect(404);
  });

  it('validates explicit terminal and archive commands at the route boundary', async () => {
    await request(app())
      .post('/api/taster-session-requests/507f1f77bcf86cd799439012/disposition')
      .set('Cookie', 'club_session=admin')
      .send({
        expectedVersion: 0,
        disposition: 'pending',
        sendEmail: true,
      })
      .expect(400);
    expect(service.dispose).not.toHaveBeenCalled();

    service.setArchived.mockResolvedValue({
      id: '507f1f77bcf86cd799439012',
      archived: true,
    });
    await request(app())
      .post('/api/taster-session-requests/507f1f77bcf86cd799439012/archive')
      .set('Cookie', 'club_session=admin')
      .send({ expectedVersion: 2 })
      .expect(200);
    expect(service.setArchived).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439012',
      '507f1f77bcf86cd799439011',
      2,
      true
    );
  });
});
