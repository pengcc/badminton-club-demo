import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  AccountKind,
  AccountOnboardingStatus,
  AuditEventType,
  Gender,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import { AuthSession } from '../../models/AuthSession';
import { Player } from '../../models/Player';
import { User } from '../../models/User';
import { config } from '../../config';
import { errorHandler } from '../../middleware/errorHandler';
import usersRoutes from '../../routes/users';
import { AuthSessionService } from '../../services/authSessionService';
import { AuditService } from '../../services/auditService';

let mongoLease: MongoTestDatabaseLease;

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/users', usersRoutes);
  instance.use(errorHandler);
  return instance;
}

async function createPerson(administratorDesignation = false) {
  return User.create({
    email: `${randomUUID()}@example.test`,
    firstName: 'Profile',
    lastName: 'Owner',
    phone: '+49 30 1234 5678',
    gender: Gender.FEMALE,
    dateOfBirth: '1990-01-01',
    address: {
      street: 'Test 1',
      postalCode: '10115',
      city: 'Berlin',
      country: 'Deutschland',
    },
    accountKind: AccountKind.PERSON,
    administratorDesignation,
    membershipStatus: MembershipStatus.ACTIVE,
    accountOnboardingStatus: AccountOnboardingStatus.READY,
    isPlayer: false,
    password: 'TestPassword1!',
  });
}

async function cookieFor(userId: string) {
  const session = await AuthSessionService.create(userId, 0);
  return `club_session=${session.token}`;
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('personProfile');
  mongoLease.assertOwnedDatabase();
  await User.syncIndexes();
  await Player.syncIndexes();
  await AuthSession.syncIndexes();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  vi.restoreAllMocks();
  await AuthSession.deleteMany({});
  await Player.deleteMany({});
  await User.deleteMany({});
});

afterAll(async () => mongoLease.release());

describe('Person Profile persistence and authorization', () => {
  it('lets a Person update their own profile and explicitly clear optional facts', async () => {
    const owner = await createPerson();
    const audit = vi
      .spyOn(AuditService, 'writeBestEffort')
      .mockResolvedValue(undefined);
    const response = await request(app())
      .put(`/api/users/${owner.id}`)
      .set('Origin', config.frontendUrl)
      .set('Cookie', await cookieFor(owner.id))
      .send({ firstName: '李', phone: null, address: null });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ firstName: '李' });
    expect(response.body.data).not.toHaveProperty('phone');
    expect(response.body.data).not.toHaveProperty('address');
    const stored = await User.findById(owner.id).lean();
    expect(stored?.firstName).toBe('李');
    expect(stored).not.toHaveProperty('phone');
    expect(stored).not.toHaveProperty('address');
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.USER_UPDATED,
        changes: [
          { field: 'firstName' },
          { field: 'phone' },
          { field: 'address' },
        ],
      })
    );
    expect(JSON.stringify(audit.mock.calls[0]?.[0])).not.toContain('+49 30');
  });

  it('allows administrator correction and denies an unrelated ordinary Person', async () => {
    const target = await createPerson();
    const unrelated = await createPerson();
    const administrator = await createPerson(true);

    const denied = await request(app())
      .put(`/api/users/${target.id}`)
      .set('Origin', config.frontendUrl)
      .set('Cookie', await cookieFor(unrelated.id))
      .send({ phone: '+49 30 9' });
    const corrected = await request(app())
      .put(`/api/users/${target.id}`)
      .set('Origin', config.frontendUrl)
      .set('Cookie', await cookieFor(administrator.id))
      .send({ phone: '+49 30 9' });

    expect(denied.status).toBe(403);
    expect(corrected.status).toBe(200);
    expect(corrected.body.data.phone).toBe('+49 30 9');
  });

  it('rejects Super Admin targets and out-of-contract fields', async () => {
    const administrator = await createPerson(true);
    const superAdmin = await User.create({
      email: `${randomUUID()}@example.test`,
      accountKind: AccountKind.SUPER_ADMIN,
      administratorDesignation: false,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      isPlayer: false,
      password: 'TestPassword1!',
    });
    const cookie = await cookieFor(administrator.id);

    const superAdminResponse = await request(app())
      .put(`/api/users/${superAdmin.id}`)
      .set('Origin', config.frontendUrl)
      .set('Cookie', cookie)
      .send({ firstName: 'Nope' });
    const invalid = await request(app())
      .put(`/api/users/${administrator.id}`)
      .set('Origin', config.frontendUrl)
      .set('Cookie', cookie)
      .send({ membershipStatus: MembershipStatus.PASSIVE });

    expect(superAdminResponse.status).toBe(409);
    expect(invalid.status).toBe(400);
  });
});
