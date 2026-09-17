import mongoose, { Types } from 'mongoose';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  MembershipStatus,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';
import { AuditLog } from '../../models/AuditLog';
import { EmailTemplate } from '../../models/EmailTemplate';
import { GuestPlay } from '../../models/GuestPlay';
import { Location } from '../../models/Location';
import { Settings } from '../../models/Settings';
import { User } from '../../models/User';
import EmailService from '../../services/emailService';
import {
  LEGACY_GUEST_PLAY_DEFAULTS,
  reconcileEmailTemplates,
  SYSTEM_EMAIL_TEMPLATE_DEFINITIONS,
} from '../../scripts/seedEmailTemplates';
import { GuestPlayNotificationService } from '../../services/guestPlayNotificationService';
import { GuestPlayOpportunityService } from '../../services/guestPlayOpportunityService';
import { GuestPlayService } from '../../services/guestPlayService';
import {
  GuestPlayApiTransformer,
  GuestPlayPersistenceTransformer,
} from '../../transformers/guestPlay';

let mongoLease: MongoTestDatabaseLease;
const creatorId = new Types.ObjectId();
const memberId = new Types.ObjectId();
const adminId = new Types.ObjectId();
const actor = {
  id: adminId.toString(),
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  administratorDesignation: true,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
};

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('guestPlay');
  await GuestPlay.syncIndexes();
}, 120_000);

afterAll(async () => {
  await mongoLease.release();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    GuestPlay.deleteMany({}),
    Location.deleteMany({}),
    User.deleteMany({}),
    AuditLog.deleteMany({}),
    Settings.deleteMany({}),
    EmailTemplate.deleteMany({}),
  ]);
  await Settings.create({
    notificationRecipients: {
      applicationAlerts: { additional: [] },
      guestPlayAlerts: {
        additional: ['Alerts@Example.test', 'alerts@example.test'],
      },
    },
  });
  await User.create([
    {
      _id: memberId,
      email: 'member@example.test',
      password: 'TestPassword1!',
      firstName: 'Current',
      lastName: 'Member',
      gender: 'male',
      dateOfBirth: '1990-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      membershipStatus: MembershipStatus.ACTIVE,
      isPlayer: false,
    },
    {
      _id: adminId,
      email: actor.email,
      password: 'TestPassword1!',
      firstName: 'Club',
      lastName: 'Admin',
      gender: 'female',
      dateOfBirth: '1990-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: true,
      displayName: 'Administrator',
      capabilities: [Capability.ADMINISTRATION],
      membershipStatus: MembershipStatus.INACTIVE,
      isPlayer: false,
    },
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ADMIN_NOTIFICATION_EMAILS;
});

async function createLocation() {
  const now = new Date('2026-08-03T10:00:00.000Z');
  const weekday = 'monday';
  const location = await Location.create({
    translations: {
      de: { name: 'Halle', address: 'Straße 1' },
      en: { name: 'Hall', address: 'Street 1' },
      zh: { name: '球馆', address: '街道 1' },
    },
    timeSlots: [
      {
        id: 'open-slot',
        weekday,
        startTime: '19:00',
        endTime: '21:00',
        active: true,
        note: { en: 'Fast club play' },
      },
      {
        id: 'restricted-slot',
        weekday,
        startTime: '20:00',
        endTime: '22:00',
        active: true,
        guestPlayEnabled: false,
      },
      {
        id: 'inactive-slot',
        weekday,
        startTime: '18:00',
        endTime: '19:00',
        active: false,
      },
    ],
    isActive: true,
    createdBy: creatorId,
    updatedBy: creatorId,
  });
  const [opportunity] = await GuestPlayOpportunityService.list('en', now);
  return { location, opportunity, now };
}

describe('Guest Play persistence boundary', () => {
  it('projects unrestricted active shared slots with localized facts', async () => {
    const { opportunity } = await createLocation();
    expect(opportunity).toMatchObject({
      timeSlotId: 'open-slot',
      localDate: '2026-08-03',
      locationName: 'Hall',
      locationAddress: 'Street 1',
      participationNote: 'Fast club play',
    });
    expect(
      await GuestPlayOpportunityService.list(
        'en',
        new Date('2026-08-03T10:00:00.000Z')
      )
    ).toHaveLength(3);
  });

  it('converges concurrent active requests through the unique key and permits retry after cancel', async () => {
    const { location, opportunity } = await createLocation();
    const input = {
      locationId: location.id,
      timeSlotId: opportunity.timeSlotId,
      localDate: opportunity.localDate,
      guestCount: 2,
      locale: 'en' as const,
    };
    const member = {
      id: memberId.toString(),
      firstName: 'Current',
      lastName: 'Member',
      email: 'member@example.test',
    };
    vi.spyOn(GuestPlayOpportunityService, 'resolve').mockResolvedValue(
      opportunity
    );
    vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue(
      undefined as never
    );
    const results = await Promise.allSettled([
      GuestPlayService.createRequest(input, member),
      GuestPlayService.createRequest(input, member),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1);
    const current = await GuestPlay.findOne().orFail();
    await GuestPlayService.cancelOwnRequest(current.id, member.id, current.__v);
    await expect(
      GuestPlayService.createRequest(input, member)
    ).resolves.toMatchObject({
      status: 'pending',
    });
  });

  it('round-trips appointment facts from Mongo through member and administrator responses', async () => {
    const opportunity = {
      locationId: new Types.ObjectId().toString(),
      timeSlotId: 'slot',
      locationName: 'Hall',
      locationAddress: 'Street 1',
      localDate: '2099-01-01',
      startTime: '19:00',
      endTime: '21:00',
      startAt: '2099-01-01T18:00:00.000Z',
    };
    vi.spyOn(GuestPlayOpportunityService, 'resolve').mockResolvedValue(
      opportunity
    );
    vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue(
      undefined as never
    );

    const created = await GuestPlayService.createRequest(
      {
        locationId: opportunity.locationId,
        timeSlotId: opportunity.timeSlotId,
        localDate: opportunity.localDate,
        guestCount: 2,
        locale: 'en',
      },
      {
        id: memberId.toString(),
        firstName: 'Current',
        lastName: 'Member',
        email: 'member@example.test',
      }
    );
    const reloaded = await GuestPlay.findById(created.id).orFail();
    const domain = GuestPlayPersistenceTransformer.toDomain(reloaded);
    const expectedAppointment = {
      locationId: expect.any(String),
      timeSlotId: 'slot',
      locationName: 'Hall',
      locationAddress: 'Street 1',
      localDate: '2099-01-01',
      startTime: '19:00',
      endTime: '21:00',
      startAt: '2099-01-01T18:00:00.000Z',
    };

    expect(domain.appointment.startAt).toBeInstanceOf(Date);
    for (const response of [
      GuestPlayApiTransformer.toMemberResponse(domain),
      GuestPlayApiTransformer.toAdminResponse(domain),
      GuestPlayApiTransformer.toMemberResponse(
        (await GuestPlayService.getMyRequests(memberId.toString()))[0]
      ),
      GuestPlayApiTransformer.toAdminResponse(
        await GuestPlayService.getRequestById(created.id)
      ),
    ]) {
      expect(response.appointment).toEqual(expectedAppointment);
      expect(Object.keys(response.appointment).sort()).toEqual(
        [
          'endTime',
          'localDate',
          'locationAddress',
          'locationId',
          'locationName',
          'startAt',
          'startTime',
          'timeSlotId',
        ].sort()
      );
      expect(JSON.stringify(response)).not.toMatch(/"(?:_doc|\$__)"/);
    }

    const approved = await GuestPlayService.decide(created.id, actor, {
      expectedVersion: created.version,
      decision: 'approved',
    });
    expect(
      GuestPlayApiTransformer.toAdminResponse(approved).appointment
    ).toEqual(expectedAppointment);
    const declined = await GuestPlayService.correctDecision(created.id, actor, {
      expectedVersion: approved.version,
      decision: 'declined',
      reason: 'Schedule changed',
    });
    expect(
      GuestPlayApiTransformer.toAdminResponse(declined).appointment
    ).toEqual(expectedAppointment);
  });

  it('applies named decision, correction, archive and restore commands with audit facts', async () => {
    vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue(
      undefined as never
    );
    const startAt = new Date(Date.now() + 86_400_000);
    const request = await GuestPlay.create({
      memberId,
      memberName: 'Current Member',
      memberEmail: 'member@example.test',
      guestCount: 1,
      status: 'pending',
      appointment: {
        locationId: new Types.ObjectId().toString(),
        timeSlotId: 'slot',
        locationName: 'Hall',
        locationAddress: 'Street 1',
        localDate: '2026-08-10',
        startTime: '19:00',
        endTime: '21:00',
        startAt,
      },
      activeRequestKey: `${memberId}:opportunity`,
      locale: 'en',
    });

    const approved = await GuestPlayService.decide(request.id, actor, {
      expectedVersion: request.__v,
      decision: 'approved',
    });
    const declined = await GuestPlayService.correctDecision(request.id, actor, {
      expectedVersion: approved.version,
      decision: 'declined',
      reason: 'Club schedule changed',
    });
    const archived = await GuestPlayService.setArchived(
      request.id,
      actor,
      declined.version,
      true
    );
    const restored = await GuestPlayService.setArchived(
      request.id,
      actor,
      archived.version,
      false
    );

    expect(restored).toMatchObject({ status: 'declined', archived: false });
    expect(await AuditLog.countDocuments({ entityId: request._id })).toBe(4);
  });

  it('keeps multi-recipient administrator alerts private across initial delivery and retry', async () => {
    await Settings.updateOne(
      {},
      {
        $set: {
          'notificationRecipients.guestPlayAlerts.additional': [
            'First.Alert@Example.test',
            'second-alert@example.test',
          ],
        },
      }
    );
    const request = await GuestPlay.create({
      memberId,
      memberName: 'Current Member',
      memberEmail: 'member@example.test',
      guestCount: 2,
      status: 'pending',
      appointment: {
        locationId: new Types.ObjectId().toString(),
        timeSlotId: 'slot',
        locationName: 'Hall',
        locationAddress: 'Street 1',
        localDate: '2099-01-01',
        startTime: '19:00',
        endTime: '21:00',
        startAt: new Date('2099-01-01T18:00:00.000Z'),
      },
      activeRequestKey: `${memberId}:notifications`,
      locale: 'en',
    });
    const send = vi
      .spyOn(EmailService, 'sendFromTemplate')
      .mockResolvedValueOnce(undefined as never)
      .mockRejectedValueOnce(
        Object.assign(new Error('smtp rejected'), { code: 'EAUTH' })
      )
      .mockResolvedValueOnce(undefined as never);

    await GuestPlayNotificationService.sendInitial(request.id);
    const failed = await GuestPlay.findById(request.id).orFail();

    expect(failed.notifications.memberReceipt.status).toBe('sent');
    expect(failed.notifications.administratorAlert).toMatchObject({
      status: 'failed',
      attempts: 1,
      recipients: ['first.alert@example.test', 'second-alert@example.test'],
      error: 'transport',
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][1]).toEqual({
      bcc: ['first.alert@example.test', 'second-alert@example.test'],
    });

    await GuestPlayNotificationService.retry(
      request.id,
      'administratorAlert',
      failed.__v
    );
    const retried = await GuestPlay.findById(request.id).orFail();

    expect(retried.notifications.administratorAlert).toMatchObject({
      status: 'sent',
      attempts: 2,
      recipients: ['first.alert@example.test', 'second-alert@example.test'],
    });
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[2][1]).toEqual({
      bcc: ['first.alert@example.test', 'second-alert@example.test'],
    });
  });

  it('uses no hidden alert fallback and lets only one concurrent retry claim send', async () => {
    await Settings.updateOne(
      {},
      { $set: { 'notificationRecipients.guestPlayAlerts.additional': [] } }
    );
    process.env.ADMIN_NOTIFICATION_EMAILS = 'hidden@example.test';
    const request = await GuestPlay.create({
      memberId,
      memberName: 'Current Member',
      memberEmail: 'member@example.test',
      guestCount: 1,
      status: 'pending',
      appointment: {
        locationId: new Types.ObjectId().toString(),
        timeSlotId: 'slot',
        locationName: 'Hall',
        locationAddress: 'Street 1',
        localDate: '2099-01-01',
        startTime: '19:00',
        endTime: '21:00',
        startAt: new Date('2099-01-01T18:00:00.000Z'),
      },
      activeRequestKey: `${memberId}:retry`,
      notifications: {
        memberReceipt: {
          status: 'failed',
          attempts: 1,
          recipients: ['member@example.test'],
          error: 'transport',
        },
        administratorAlert: {
          status: 'not_attempted',
          attempts: 0,
          recipients: [],
        },
        decisionEmail: { status: 'not_attempted', attempts: 0, recipients: [] },
      },
      locale: 'en',
    });
    const send = vi
      .spyOn(EmailService, 'sendFromTemplate')
      .mockResolvedValue(undefined as never);

    await GuestPlayNotificationService.sendInitial(request.id);
    const notConfigured = await GuestPlay.findById(request.id).orFail();
    expect(notConfigured.notifications.administratorAlert.status).toBe(
      'not_configured'
    );
    expect(send).not.toHaveBeenCalled();

    const results = await Promise.allSettled([
      GuestPlayNotificationService.retry(
        request.id,
        'memberReceipt',
        notConfigured.__v
      ),
      GuestPlayNotificationService.retry(
        request.id,
        'memberReceipt',
        notConfigured.__v
      ),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('preserves non-default Guest Play templates and stops automatic replacement', async () => {
    const definition = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
      (template) => template.name === 'guest_play_declined'
    )!;
    await EmailTemplate.create({
      ...definition,
      body: { ...definition.body, en: 'Customized member message' },
    });

    const summary = await reconcileEmailTemplates();
    const persisted = await EmailTemplate.findOne({
      name: definition.name,
    }).lean();

    expect(persisted?.body.en).toBe('Customized member message');
    expect(summary.customContentPreserved).toContain('guest_play_declined');
    expect(summary.reviewRequired).toContain(
      'guest_play_declined: retained content differs from the current Guest Play default; review without automatic replacement'
    );
  });

  it('upgrades only an exact known Guest Play template default', async () => {
    const definition = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
      (template) => template.name === 'guest_play_declined'
    )!;
    const legacy = LEGACY_GUEST_PLAY_DEFAULTS.guest_play_declined!;
    await EmailTemplate.create({
      ...definition,
      body: legacy.body,
      variables: legacy.variables,
    });

    const summary = await reconcileEmailTemplates();
    const persisted = await EmailTemplate.findOne({
      name: definition.name,
    }).lean();

    expect(persisted?.body).toMatchObject(definition.body);
    expect(persisted?.variables).toEqual(definition.variables);
    expect(summary.defaultsUpdated).toContain('guest_play_declined');
    expect(summary.reviewRequired).toEqual([]);
  });

  it('upgrades a recognized legacy Guest Play body without overwriting a customized subject', async () => {
    const definition = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
      (template) => template.name === 'guest_play_approved'
    )!;
    const legacy = LEGACY_GUEST_PLAY_DEFAULTS.guest_play_approved!;
    const customEnglishSubject = 'Your guests can join us';
    await EmailTemplate.create({
      ...definition,
      subject: { ...definition.subject, en: customEnglishSubject },
      body: legacy.body,
      variables: legacy.variables,
    });

    const summary = await reconcileEmailTemplates();
    const persisted = await EmailTemplate.findOne({
      name: definition.name,
    }).lean();

    expect(persisted?.subject.en).toBe(customEnglishSubject);
    expect(persisted?.body).toMatchObject(definition.body);
    expect(persisted?.variables).toEqual(definition.variables);
    expect(summary.defaultsUpdated).toContain('guest_play_approved');
    expect(summary.customContentPreserved).toContain('guest_play_approved');
    expect(summary.reviewRequired).toContain(
      'guest_play_approved: retained content differs from the current Guest Play default; review without automatic replacement'
    );
  });

  it('keeps declined email facts aligned across all supported locales', () => {
    const definition = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
      (template) => template.name === 'guest_play_declined'
    )!;

    for (const locale of ['de', 'en', 'zh'] as const) {
      expect(definition.body[locale]).toContain('{{guestCount}}');
      expect(definition.body[locale]).toContain('{{appointmentDetails}}');
      expect(definition.body[locale]).not.toContain('{{adminNotes}}');
    }
    expect(definition.variables).toEqual([
      'memberName',
      'guestCount',
      'appointmentDetails',
    ]);
  });

  it('blocks approval after membership loss and archive while pending', async () => {
    const request = await GuestPlay.create({
      memberId,
      memberName: 'Current Member',
      memberEmail: 'member@example.test',
      guestCount: 1,
      status: 'pending',
      appointment: {
        locationId: new Types.ObjectId().toString(),
        timeSlotId: 'slot',
        locationName: 'Hall',
        locationAddress: 'Street 1',
        localDate: '2099-01-01',
        startTime: '19:00',
        endTime: '21:00',
        startAt: new Date('2099-01-01T18:00:00.000Z'),
      },
      activeRequestKey: `${memberId}:opportunity`,
      locale: 'en',
    });
    await User.updateOne(
      { _id: memberId },
      { membershipStatus: MembershipStatus.INACTIVE }
    );
    await expect(
      GuestPlayService.decide(request.id, actor, {
        expectedVersion: request.__v,
        decision: 'approved',
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      GuestPlayService.setArchived(request.id, actor, request.__v, true)
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
