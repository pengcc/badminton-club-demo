import express from 'express';
import mongoose from 'mongoose';
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
  AuditEventType,
  TeamLevel,
} from '@club/shared-types/core/enums';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';

const auth = vi.hoisted(() => ({
  user: {
    id: '507f1f77bcf86cd799439011',
    accountKind: 'person',
  },
}));

vi.mock('../../middleware/auth', () => ({
  protect: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    req.user = auth.user as never;
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
  authorizeAnyCapability:
    () =>
    (
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction
    ) =>
      next(),
}));

import { errorHandler } from '../../middleware/errorHandler';
import { Player } from '../../models/Player';
import { Team } from '../../models/Team';
import teamsRoutes from '../../routes/teams';
import { AuditService } from '../../services/auditService';
import { TeamService } from '../../services/teamService';

let mongoLease: MongoTestDatabaseLease;

const creatorId = new mongoose.Types.ObjectId().toString();
const updaterId = new mongoose.Types.ObjectId().toString();
const hostileActorId = new mongoose.Types.ObjectId().toString();

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/teams', teamsRoutes);
  instance.use(errorHandler);
  return instance;
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('teamMutationActorOwnership');
  mongoLease.assertOwnedDatabase();
  await Team.syncIndexes();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  vi.restoreAllMocks();
  await Promise.all([Team.deleteMany({}), Player.deleteMany({})]);
});

afterAll(async () => mongoLease.release());

describe('Issue #436 Team mutation actor ownership', () => {
  it('uses authenticated actors for creation provenance and update Audit', async () => {
    const audit = vi
      .spyOn(AuditService, 'writeBestEffort')
      .mockImplementation(() => undefined);
    const createTeam = vi.spyOn(TeamService, 'createTeam');
    const updateTeam = vi.spyOn(TeamService, 'updateTeam');

    auth.user = { id: creatorId, accountKind: AccountKind.PERSON };
    const created = await request(app())
      .post('/api/teams')
      .send({
        teamId: 't436',
        shortName: 'DCBV I',
        leagueTeamName: 'DCBV I',
        matchLevel: TeamLevel.A,
        createdById: hostileActorId,
        updatedById: hostileActorId,
        playerIds: [hostileActorId],
      });

    expect(created.status).toBe(201);
    expect(createTeam).toHaveBeenCalledWith(
      {
        teamId: 't436',
        shortName: 'DCBV I',
        leagueTeamName: 'DCBV I',
        matchLevel: TeamLevel.A,
      },
      creatorId
    );
    expect(created.body.data.createdById).toBe(creatorId);
    expect(created.body.data.playerIds).toEqual([]);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.TEAM_CREATED,
        actor: expect.objectContaining({ id: creatorId }),
      })
    );

    const storedAfterCreate = await Team.findById(created.body.data.id).lean();
    expect(storedAfterCreate?.createdById.toString()).toBe(creatorId);

    auth.user = { id: updaterId, accountKind: AccountKind.PERSON };
    const updated = await request(app())
      .put(`/api/teams/${created.body.data.id}`)
      .send({
        shortName: 'DCBV Updated',
        createdById: hostileActorId,
        updatedById: hostileActorId,
        playerIds: [hostileActorId],
      });

    expect(updated.status).toBe(200);
    expect(updateTeam).toHaveBeenCalledWith(created.body.data.id, {
      shortName: 'DCBV Updated',
    });
    expect(updated.body.data.createdById).toBe(creatorId);
    const storedAfterUpdate = await Team.findById(created.body.data.id).lean();
    expect(storedAfterUpdate?.createdById.toString()).toBe(creatorId);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.TEAM_UPDATED,
        actor: expect.objectContaining({ id: updaterId }),
        changes: [{ field: 'shortName' }],
      })
    );
  });
});
