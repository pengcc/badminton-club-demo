import express from 'express';
import request from 'supertest';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  AccountKind,
  AccountOnboardingStatus,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import {
  canonicalAuthUserDocument,
  FIRST_PARTY_ORIGIN,
  mockAuthSessionCookie,
} from '../helpers/authSession';
import routes from '../../routes/users';
import { errorHandler } from '../../middleware/errorHandler';
import { User } from '../../models/User';
import { Player } from '../../models/Player';
import { MemberCsvImportService } from '../../services/memberCsvImportService';
const id = '507f1f77bcf86cd799439011';
let designated = true;
function app() {
  const app = express();
  app.use('/api/users', routes);
  app.use(errorHandler);
  return app;
}
function post(path = 'preview') {
  return request(app())
    .post(`/api/users/member-import/${path}`)
    .set('Cookie', mockAuthSessionCookie(id))
    .set('Origin', FIRST_PARTY_ORIGIN);
}
beforeEach(() => {
  designated = true;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(User, 'findById').mockReturnValue({
    select: vi.fn().mockImplementation(async () =>
      canonicalAuthUserDocument({
        _id: id,
        id,
        email: 'admin@example.test',
        firstName: 'CSV',
        lastName: 'Admin',
        accountKind: AccountKind.PERSON,
        administratorDesignation: designated,
        membershipStatus: MembershipStatus.ACTIVE,
        accountOnboardingStatus: AccountOnboardingStatus.READY,
      })
    ),
  } as never);
  vi.spyOn(Player, 'findOne').mockReturnValue({
    select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
  } as never);
});
afterEach(() => vi.restoreAllMocks());
describe('Member CSV route authorization and upload', () => {
  it('rejects unauthorized callers before parsing files', async () => {
    const spy = vi.spyOn(MemberCsvImportService, 'preview');
    expect(
      (
        await request(app())
          .post('/api/users/member-import/preview')
          .attach('file', Buffer.from('invalid'), 'invalid.csv')
      ).status
    ).toBe(403);
    designated = false;
    expect(
      (await post().attach('file', Buffer.from('invalid'), 'x.csv')).status
    ).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });
  it('passes the exact bytes and actor through the thin controller', async () => {
    const spy = vi.spyOn(MemberCsvImportService, 'preview').mockResolvedValue({
      rows: [],
      counts: {
        create: 0,
        update: 0,
        unchanged: 0,
        review_required: 0,
        conflict: 0,
        invalid: 0,
      },
      previewContext: 'opaque',
    });
    expect(
      (await post().attach('file', Buffer.from('csv'), 'x.csv')).status
    ).toBe(200);
    expect(spy.mock.calls[0][0].toString()).toBe('csv');
    expect(spy.mock.calls[0][1].id).toBe(id);
  });
  it('rejects missing, extra, oversized files and unexpected multipart fields', async () => {
    for (const request of [
      post(),
      post()
        .attach('file', Buffer.from('a'), 'a.csv')
        .attach('file', Buffer.from('b'), 'b.csv'),
      post().attach('file', Buffer.alloc(1024 * 1024 + 1), 'large.csv'),
      post()
        .field('previewContext', 'no')
        .attach('file', Buffer.from('a'), 'a.csv'),
      post('apply').attach('file', Buffer.from('a'), 'a.csv'),
      post('apply')
        .field('previewContext', 'yes')
        .field('unknown', 'no')
        .attach('file', Buffer.from('a'), 'a.csv'),
    ])
      expect([400, 413]).toContain((await request).status);
  });
});
