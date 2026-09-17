import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import mongoose, { Schema, Types, model } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Location } from '../../models/Location';
import {
  applyTasterSessionSourceTransfers,
  inspectTasterSessionSourceConsolidation,
  loadRawSharedTasterSourceLocations,
} from '../../services/tasterSessionSourceConsolidationService';

const translations = {
  de: { name: 'Halle', address: 'Adresse' },
  en: { name: 'Hall', address: 'Address' },
  zh: { name: '体育馆', address: '地址' },
};
const timeSlot = {
  id: '0a0a0a0a-0000-4000-8000-000000000001',
  weekday: 'friday' as const,
  startTime: '19:00',
  endTime: '21:30',
  active: true,
};

const LegacyTasterSettingsFixture = model(
  'LegacyTasterSettingsFixture',
  new Schema(
    {
      trialTraining: {
        locations: [
          {
            id: String,
            name: String,
            address: String,
            active: Boolean,
          },
        ],
        sessions: [
          {
            id: String,
            locationId: String,
            dayOfWeek: Number,
            startTime: String,
            endTime: String,
            active: Boolean,
            acceptedLevels: [String],
            capacityPerSlot: Number,
          },
        ],
      },
    },
    { collection: 'settings' }
  )
);

let mongoLease: MongoTestDatabaseLease;

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('location');
  mongoLease.assertOwnedDatabase();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await Location.deleteMany({});
  await LegacyTasterSettingsFixture.deleteMany({});
});

afterAll(async () => {
  await mongoLease.release();
});

describe('Location persistence', () => {
  it('defaults omitted Guest Play availability to allowed and preserves explicit restrictions', async () => {
    const actorId = new Types.ObjectId();
    const unrestricted = await Location.create({
      translations,
      timeSlots: [timeSlot],
      createdBy: actorId,
      updatedBy: actorId,
    });
    const restricted = await Location.create({
      translations,
      timeSlots: [
        {
          ...timeSlot,
          id: '0a0a0a0a-0000-4000-8000-000000000002',
          guestPlayEnabled: false,
        },
      ],
      createdBy: actorId,
      updatedBy: actorId,
    });

    expect(unrestricted.timeSlots[0].guestPlayEnabled).toBe(true);
    expect(restricted.timeSlots[0].guestPlayEnabled).toBe(false);
    expect(unrestricted.timeSlots[0]).toMatchObject({
      tasterSessionEnabled: true,
      tasterSessionAcceptedLevels: ['beginner', 'experienced'],
    });
  });

  it('persists independent Taster Session restrictions and rejects enabled empty levels', async () => {
    const actorId = new Types.ObjectId();
    const location = await Location.create({
      translations,
      timeSlots: [
        {
          ...timeSlot,
          id: '0a0a0a0a-0000-4000-8000-000000000003',
          guestPlayEnabled: true,
          tasterSessionEnabled: true,
          tasterSessionAcceptedLevels: ['experienced'],
        },
      ],
      createdBy: actorId,
      updatedBy: actorId,
    });
    expect(location.timeSlots[0]).toMatchObject({
      guestPlayEnabled: true,
      tasterSessionAcceptedLevels: ['experienced'],
    });
    await expect(
      Location.create({
        translations,
        timeSlots: [
          {
            ...timeSlot,
            id: '0a0a0a0a-0000-4000-8000-000000000004',
            tasterSessionEnabled: true,
            tasterSessionAcceptedLevels: [],
          },
        ],
        createdBy: actorId,
        updatedBy: actorId,
      })
    ).rejects.toThrow('must accept at least one level');
  });

  it('inspects realistic legacy subdocument metadata and applies an exact batch idempotently', async () => {
    const actorId = new Types.ObjectId();
    const location = await Location.create({
      translations,
      timeSlots: [
        {
          ...timeSlot,
          tasterSessionEnabled: true,
          tasterSessionAcceptedLevels: ['beginner', 'experienced'],
        },
      ],
      createdBy: actorId,
      updatedBy: actorId,
    });
    const legacyDocument = await LegacyTasterSettingsFixture.create({
      trialTraining: {
        locations: [
          {
            id: 'legacy-location',
            name: 'Legacy Hall',
            address: 'Address',
            active: true,
          },
        ],
        sessions: [
          {
            id: 'legacy-session',
            locationId: 'legacy-location',
            dayOfWeek: 5,
            startTime: '19:00',
            endTime: '21:30',
            active: true,
            acceptedLevels: ['experienced'],
            capacityPerSlot: 7,
          },
        ],
      },
    });
    const retainedBefore = await LegacyTasterSettingsFixture.collection.findOne(
      { _id: legacyDocument._id },
      { projection: { trialTraining: 1 } }
    );
    expect(retainedBefore?.trialTraining.locations[0]._id).toBeDefined();
    expect(retainedBefore?.trialTraining.sessions[0]._id).toBeDefined();

    const report = inspectTasterSessionSourceConsolidation(
      retainedBefore?.trialTraining,
      await loadRawSharedTasterSourceLocations()
    );
    expect(report.blockers).toEqual([]);
    await applyTasterSessionSourceTransfers(report.transfers);
    await applyTasterSessionSourceTransfers(report.transfers);

    const stored = await Location.findById(location._id).lean();
    expect(stored?.timeSlots[0]).toMatchObject({
      id: timeSlot.id,
      weekday: 'friday',
      startTime: '19:00',
      endTime: '21:30',
      guestPlayEnabled: true,
      tasterSessionAcceptedLevels: ['experienced'],
    });
    expect(stored?.translations).toMatchObject(translations);
    expect(
      await LegacyTasterSettingsFixture.collection.findOne(
        { _id: legacyDocument._id },
        { projection: { trialTraining: 1 } }
      )
    ).toEqual(retainedBefore);
  });

  it('writes nothing when one target changes after inspection', async () => {
    const actorId = new Types.ObjectId();
    const first = await Location.create({
      translations,
      timeSlots: [
        {
          ...timeSlot,
          id: '0a0a0a0a-0000-4000-8000-000000000010',
          tasterSessionEnabled: true,
          tasterSessionAcceptedLevels: ['beginner', 'experienced'],
        },
      ],
      createdBy: actorId,
      updatedBy: actorId,
    });
    const second = await Location.create({
      translations: {
        de: { name: 'Zweite Halle', address: 'Zweite Adresse' },
        en: { name: 'Second Hall', address: 'Second Address' },
        zh: { name: '第二体育馆', address: '第二地址' },
      },
      timeSlots: [
        {
          ...timeSlot,
          id: '0a0a0a0a-0000-4000-8000-000000000011',
          weekday: 'monday',
          tasterSessionEnabled: true,
          tasterSessionAcceptedLevels: ['beginner', 'experienced'],
        },
      ],
      createdBy: actorId,
      updatedBy: actorId,
    });
    const retained = {
      locations: [
        { id: 'first', name: 'First', address: 'Address', active: true },
        {
          id: 'second',
          name: 'Second',
          address: 'Second Address',
          active: true,
        },
      ],
      sessions: [
        {
          id: 'first-session',
          locationId: 'first',
          dayOfWeek: 5,
          startTime: '19:00',
          endTime: '21:30',
          active: true,
          acceptedLevels: ['experienced'],
        },
        {
          id: 'second-session',
          locationId: 'second',
          dayOfWeek: 1,
          startTime: '19:00',
          endTime: '21:30',
          active: true,
          acceptedLevels: ['experienced'],
        },
      ],
    };
    const report = inspectTasterSessionSourceConsolidation(
      retained,
      await loadRawSharedTasterSourceLocations()
    );
    expect(report.blockers).toEqual([]);

    await Location.collection.updateOne(
      { _id: second._id, 'timeSlots.id': second.timeSlots[0].id },
      { $set: { 'timeSlots.$.weekday': 'tuesday' } }
    );
    await expect(
      applyTasterSessionSourceTransfers(report.transfers)
    ).rejects.toThrow('shared_transfer_facts_changed');

    const firstAfter = await Location.findById(first._id).lean();
    expect(firstAfter?.timeSlots[0].tasterSessionAcceptedLevels).toEqual([
      'beginner',
      'experienced',
    ]);

    await Location.collection.updateOne(
      { _id: second._id, 'timeSlots.id': second.timeSlots[0].id },
      { $set: { 'timeSlots.$.weekday': 'monday' } }
    );
    await Location.collection.updateOne(
      { _id: second._id },
      { $set: { timeSlots: [] } }
    );
    await expect(
      applyTasterSessionSourceTransfers(report.transfers)
    ).rejects.toThrow('shared_transfer_target_missing');
    const firstAfterMissingTarget = await Location.findById(first._id).lean();
    expect(
      firstAfterMissingTarget?.timeSlots[0].tasterSessionAcceptedLevels
    ).toEqual(['beginner', 'experienced']);
  });
});
