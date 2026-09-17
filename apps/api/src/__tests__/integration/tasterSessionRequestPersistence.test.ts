import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import mongoose, { Types } from 'mongoose';
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
import EmailService from '../../services/emailService';
import { SettingsService } from '../../services/settingsService';
import { TasterSessionPreferencePolicy } from '../../services/tasterSessionPreferencePolicy';
import { TasterSessionRequestService } from '../../services/tasterSessionRequestService';
import { TasterSessionDeliveryService } from '../../services/tasterSessionDeliveryService';
import { ensureTasterSessionIndexes } from '../../services/tasterSessionReadinessService';
import { TasterSessionRequestModel } from '../../models/TasterSessionRequest';
import { Location } from '../../models/Location';

let mongoLease: MongoTestDatabaseLease;
const adminId = new Types.ObjectId().toString();

function input(email: string) {
  return {
    name: 'Visitor',
    email,
    playerLevel: 'beginner' as const,
    locale: 'en' as const,
  };
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('tasterSessionRequest');
  mongoLease.assertOwnedDatabase();
  await ensureTasterSessionIndexes(mongoose.connection);
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await TasterSessionRequestModel.deleteMany({});
  vi.spyOn(
    TasterSessionPreferencePolicy,
    'validateSelection'
  ).mockResolvedValue(undefined);
  vi.spyOn(SettingsService, 'getSettings').mockResolvedValue({
    notificationRecipients: {
      applicationAlerts: { additional: [] },
      tasterSessionAlerts: { additional: [] },
    },
  } as never);
  vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  await mongoLease.release();
});

describe('Taster Session request persistence', () => {
  it.each([
    ['de', 'Keine Präferenz verfügbar; wir melden uns zur Abstimmung.'],
    ['en', 'No preference was available; we will get in touch to arrange it.'],
    ['zh', '未选择偏好时间；我们会联系你商定安排。'],
  ] as const)('uses club-owned %s fallback wording without inventing a booking', async (locale, expected) => {
    const created = await TasterSessionRequestService.create({
      ...input(`fallback-${locale}@example.test`),
      locale,
    });
    await vi.waitFor(() =>
      expect(
        vi
          .mocked(EmailService.sendFromTemplate)
          .mock.calls.find(
            ([template]) => template === 'taster_session_received'
          )
      ).toBeDefined()
    );
    expect(
      vi
        .mocked(EmailService.sendFromTemplate)
        .mock.calls.find(
          ([template]) => template === 'taster_session_received'
        )?.[3].preferenceDetails
    ).toBe(expected);

    await TasterSessionRequestService.dispose(created.id, adminId, {
      expectedVersion: created.version,
      disposition: 'invited',
      sendEmail: true,
    });
    expect(
      vi
        .mocked(EmailService.sendFromTemplate)
        .mock.calls.find(
          ([template]) => template === 'taster_session_invited'
        )?.[3].preferenceDetails
    ).toBe(expected);
  });

  it('runs the integrated visitor-to-administrator workflow without booking or capacity state', async () => {
    vi.mocked(TasterSessionPreferencePolicy.validateSelection).mockRestore();
    const location = await Location.create({
      translations: {
        de: { name: 'Haupthalle', address: 'Beispielstraße' },
        en: { name: 'Main Hall', address: 'Example Street' },
        zh: { name: '主体育馆', address: '示例街' },
      },
      timeSlots: [
        {
          id: '0a0a0a0a-0000-4000-8000-000000000010',
          weekday: 'sunday',
          startTime: '18:00',
          endTime: '20:00',
          active: true,
          tasterSessionEnabled: true,
          tasterSessionAcceptedLevels: ['beginner'],
        },
      ],
      createdBy: new Types.ObjectId(),
      updatedBy: new Types.ObjectId(),
    });
    const [option] = await TasterSessionPreferencePolicy.listOptions(
      'beginner',
      'en'
    );
    expect(option).toBeDefined();

    const created = await TasterSessionRequestService.create({
      ...input('workflow@example.test'),
      preference: {
        optionId: option!.id,
        startsAt: option!.startsAt,
      },
    });
    expect(created).toMatchObject({
      status: 'pending',
      archived: false,
      preference: {
        optionId: option!.id,
        locationId: String(location._id),
        locationName: 'Main Hall',
        timeSlotId: '0a0a0a0a-0000-4000-8000-000000000010',
        locationAddress: 'Example Street',
      },
      delivery: { status: 'not_requested' },
    });
    expect(
      (
        await TasterSessionRequestService.list({
          status: 'all',
          playerLevel: 'all',
          archived: 'exclude',
          limit: 50,
          offset: 0,
        })
      ).requests
    ).toHaveLength(1);

    let explicitAttempts = 0;
    vi.mocked(EmailService.sendFromTemplate).mockImplementation(
      async (template) => {
        if (template !== 'taster_session_declined') return;
        explicitAttempts += 1;
        if (explicitAttempts === 1) {
          throw Object.assign(new Error('mail failed'), { code: 'EAUTH' });
        }
      }
    );
    const declined = await TasterSessionRequestService.dispose(
      created.id,
      adminId,
      {
        expectedVersion: created.version,
        disposition: 'declined',
        declineReason: 'other',
        declineReasonDetails: 'Follow-up completed',
        sendEmail: true,
      }
    );
    expect(declined).toMatchObject({
      status: 'declined',
      delivery: { status: 'failed', retryAvailable: true },
    });
    const delivered = await TasterSessionRequestService.retryDelivery(
      declined.id,
      declined.version
    );
    expect(delivered).toMatchObject({
      status: 'declined',
      delivery: { status: 'sent', retryAvailable: false },
    });

    const archived = await TasterSessionRequestService.setArchived(
      delivered.id,
      adminId,
      delivered.version,
      true
    );
    expect(
      (
        await TasterSessionRequestService.list({
          status: 'all',
          playerLevel: 'all',
          archived: 'exclude',
          limit: 50,
          offset: 0,
        })
      ).requests
    ).toHaveLength(0);
    const unarchived = await TasterSessionRequestService.setArchived(
      archived.id,
      adminId,
      archived.version,
      false
    );
    expect(unarchived).toMatchObject({
      status: 'declined',
      archived: false,
      delivery: { status: 'sent' },
    });
    expect(JSON.stringify(unarchived)).not.toMatch(
      /booking|reservation|capacityPerSlot/
    );
    expect(explicitAttempts).toBe(2);
  });

  it('normalizes email and permits exactly one concurrent pending request', async () => {
    const outcomes = await Promise.allSettled([
      TasterSessionRequestService.create(input(' Visitor@Example.Test ')),
      TasterSessionRequestService.create(input('visitor@example.test')),
    ]);

    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled')
    ).toHaveLength(1);
    const rejected = outcomes.find(
      (outcome) => outcome.status === 'rejected'
    ) as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({
      statusCode: 409,
      code: 'PENDING_TASTER_SESSION_REQUEST_EXISTS',
    });
    expect(await TasterSessionRequestModel.countDocuments()).toBe(1);
    await vi.waitFor(() =>
      expect(
        vi
          .mocked(EmailService.sendFromTemplate)
          .mock.calls.filter(
            ([template]) => template === 'taster_session_received'
          )
      ).toHaveLength(1)
    );
  });

  it('returns after persistence when an automatic best-effort email never settles', async () => {
    vi.mocked(EmailService.sendFromTemplate).mockImplementation(
      () => new Promise<void>(() => undefined)
    );

    const created = await Promise.race([
      TasterSessionRequestService.create(input('bounded@example.test')),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error('request creation waited for automatic email')),
          250
        )
      ),
    ]);

    expect(created).toMatchObject({
      email: 'bounded@example.test',
      status: 'pending',
      delivery: { status: 'not_requested' },
    });
    expect(await TasterSessionRequestModel.countDocuments()).toBe(1);
  });

  it('contains an immediately rejected automatic receipt after persistence', async () => {
    vi.mocked(EmailService.sendFromTemplate).mockRejectedValue(
      new Error('template unavailable')
    );

    const created = await TasterSessionRequestService.create(
      input('rejected-receipt@example.test')
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(created).toMatchObject({
      email: 'rejected-receipt@example.test',
      status: 'pending',
      delivery: { status: 'not_requested' },
    });
    expect(await TasterSessionRequestModel.countDocuments()).toBe(1);
  });

  it('allows a new pending request after a terminal outcome and rejects competing outcomes', async () => {
    const created = await TasterSessionRequestService.create(
      input('terminal@example.test')
    );
    const invited = await TasterSessionRequestService.dispose(
      created.id,
      adminId,
      {
        expectedVersion: created.version,
        disposition: 'invited',
        sendEmail: false,
      }
    );
    await expect(
      TasterSessionRequestService.dispose(created.id, adminId, {
        expectedVersion: invited.version,
        disposition: 'declined',
        declineReason: 'no_capacity',
        sendEmail: false,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'TASTER_SESSION_STATE_CONFLICT',
      details: { latest: { status: 'invited' } },
    });
    await expect(
      TasterSessionRequestService.create(input(' TERMINAL@example.test '))
    ).resolves.toMatchObject({ status: 'pending' });
  });

  it('stores only a server-validated non-binding preference snapshot', async () => {
    vi.mocked(SettingsService.getSettings).mockResolvedValueOnce({
      notificationRecipients: {
        applicationAlerts: { additional: ['wrong-owner@example.test'] },
        tasterSessionAlerts: { additional: ['admin@example.test'] },
      },
    } as never);
    vi.mocked(
      TasterSessionPreferencePolicy.validateSelection
    ).mockResolvedValueOnce({
      optionId: 'server-option',
      startsAt: new Date('2030-08-02T17:00:00.000Z'),
      locationId: 'hall',
      locationName: 'Main Hall',
      timeSlotId: 'slot',
      locationAddress: 'Example Street',
      localDate: '2030-08-02',
      startTime: '19:00',
      endTime: '21:00',
      participationNote: 'Bring indoor shoes',
    });

    const created = await TasterSessionRequestService.create({
      ...input('preference@example.test'),
      preference: {
        optionId: 'server-option',
        startsAt: '2030-08-02T17:00:00.000Z',
      },
    });

    expect(created.preference).toEqual({
      optionId: 'server-option',
      startsAt: '2030-08-02T17:00:00.000Z',
      locationId: 'hall',
      locationName: 'Main Hall',
      timeSlotId: 'slot',
      locationAddress: 'Example Street',
      localDate: '2030-08-02',
      startTime: '19:00',
      endTime: '21:00',
      participationNote: 'Bring indoor shoes',
    });
    expect(
      (await TasterSessionRequestModel.findById(created.id).lean())?.preference
    ).toMatchObject({
      optionId: 'server-option',
      locationId: 'hall',
      locationName: 'Main Hall',
    });

    await vi.waitFor(() =>
      expect(
        vi
          .mocked(EmailService.sendFromTemplate)
          .mock.calls.filter(([template]) =>
            ['taster_session_received', 'taster_session_admin_alert'].includes(
              template
            )
          )
      ).toHaveLength(2)
    );
    const automaticPreferenceDetails = vi
      .mocked(EmailService.sendFromTemplate)
      .mock.calls.filter(([template]) =>
        ['taster_session_received', 'taster_session_admin_alert'].includes(
          template
        )
      )
      .map(([, , , variables]) => variables.preferenceDetails);
    for (const details of automaticPreferenceDetails) {
      expect(details).toContain('19:00');
      expect(details).not.toContain('17:00');
      expect(details).not.toContain('T17:00');
    }
    const adminAlert = vi
      .mocked(EmailService.sendFromTemplate)
      .mock.calls.find(
        ([template]) => template === 'taster_session_admin_alert'
      );
    expect(adminAlert).toMatchObject([
      'taster_session_admin_alert',
      'admin@example.test',
      'de',
      expect.objectContaining({ playerLevel: 'Anfänger' }),
    ]);
    expect(
      vi
        .mocked(EmailService.sendFromTemplate)
        .mock.calls.some(
          ([, recipient]) => recipient === 'wrong-owner@example.test'
        )
    ).toBe(false);

    await TasterSessionRequestService.dispose(created.id, adminId, {
      expectedVersion: created.version,
      disposition: 'invited',
      sendEmail: true,
    });
    const outcomePreferenceDetails = vi
      .mocked(EmailService.sendFromTemplate)
      .mock.calls.find(
        ([template]) => template === 'taster_session_invited'
      )?.[3].preferenceDetails;
    expect(outcomePreferenceDetails).toContain('19:00');
    expect(outcomePreferenceDetails).not.toContain('T17:00');
  });

  it('archives independently for pending, invited, and declined requests and hides them by default', async () => {
    const pending = await TasterSessionRequestService.create(
      input('pending@example.test')
    );
    const inviteCandidate = await TasterSessionRequestService.create(
      input('invited@example.test')
    );
    const declineCandidate = await TasterSessionRequestService.create(
      input('declined@example.test')
    );
    const invited = await TasterSessionRequestService.dispose(
      inviteCandidate.id,
      adminId,
      {
        expectedVersion: inviteCandidate.version,
        disposition: 'invited',
        sendEmail: false,
      }
    );
    const declined = await TasterSessionRequestService.dispose(
      declineCandidate.id,
      adminId,
      {
        expectedVersion: declineCandidate.version,
        disposition: 'declined',
        declineReason: 'no_capacity',
        sendEmail: false,
      }
    );
    for (const request of [pending, invited, declined]) {
      const archived = await TasterSessionRequestService.setArchived(
        request.id,
        adminId,
        request.version,
        true
      );
      expect(archived).toMatchObject({
        status: request.status,
        archived: true,
      });
      await expect(
        TasterSessionRequestService.setArchived(
          request.id,
          adminId,
          archived.version,
          false
        )
      ).resolves.toMatchObject({
        status: request.status,
        archived: false,
        archivedAt: undefined,
        archivedBy: undefined,
      });
      await TasterSessionRequestService.setArchived(
        request.id,
        adminId,
        archived.version + 1,
        true
      );
    }
    const defaultQueue = await TasterSessionRequestService.list({
      status: 'all',
      playerLevel: 'all',
      archived: 'exclude',
      limit: 50,
      offset: 0,
    });
    expect(defaultQueue.requests).toHaveLength(0);
    expect(
      (
        await TasterSessionRequestService.list({
          status: 'all',
          playerLevel: 'all',
          archived: 'only',
          limit: 50,
          offset: 0,
        })
      ).requests
    ).toHaveLength(3);
    await expect(TasterSessionRequestService.stats()).resolves.toEqual({
      total: 3,
      pending: 1,
      invited: 1,
      declined: 1,
      archived: 3,
    });
  });

  it('keeps submission and terminal outcome successful across automatic and explicit email failures', async () => {
    vi.mocked(EmailService.sendFromTemplate).mockRejectedValue(
      Object.assign(new Error('mail failed'), { code: 'EAUTH' })
    );
    const created = await TasterSessionRequestService.create(
      input('delivery@example.test')
    );
    expect(created.delivery.status).toBe('not_requested');

    const declined = await TasterSessionRequestService.dispose(
      created.id,
      adminId,
      {
        expectedVersion: created.version,
        disposition: 'declined',
        declineReason: 'no_capacity',
        sendEmail: true,
      }
    );
    expect(declined).toMatchObject({
      status: 'declined',
      declineReason: 'no_capacity',
      delivery: { status: 'failed', retryAvailable: true },
    });
    const declineCall = vi
      .mocked(EmailService.sendFromTemplate)
      .mock.calls.find(([template]) => template === 'taster_session_declined');
    expect(declineCall?.[3]).toMatchObject({
      name: 'Visitor',
      declineReason: 'No capacity',
    });
    expect(declineCall?.[3]).not.toHaveProperty('adminNotes');

    vi.mocked(EmailService.sendFromTemplate).mockRejectedValue(
      new Error('provider result unknown')
    );
    const uncertainCandidate = await TasterSessionRequestService.create(
      input('uncertain@example.test')
    );
    await expect(
      TasterSessionRequestService.dispose(uncertainCandidate.id, adminId, {
        expectedVersion: uncertainCandidate.version,
        disposition: 'invited',
        sendEmail: true,
      })
    ).resolves.toMatchObject({
      status: 'invited',
      delivery: { status: 'uncertain', retryAvailable: true },
    });
  });

  it('retries email only, claims one concurrent attempt, and preserves disposition metadata', async () => {
    let dispositionAttempts = 0;
    vi.mocked(EmailService.sendFromTemplate).mockImplementation(
      async (template) => {
        if (template === 'taster_session_invited') {
          dispositionAttempts += 1;
          if (dispositionAttempts === 1) {
            throw Object.assign(new Error('mail failed'), { code: 'EAUTH' });
          }
        }
      }
    );
    const created = await TasterSessionRequestService.create(
      input('retry@example.test')
    );
    const failed = await TasterSessionRequestService.dispose(
      created.id,
      adminId,
      {
        expectedVersion: created.version,
        disposition: 'invited',
        adminNotes: 'Bring sports shoes.',
        sendEmail: true,
      }
    );
    const outcomes = await Promise.allSettled([
      TasterSessionRequestService.retryDelivery(failed.id, failed.version),
      TasterSessionRequestService.retryDelivery(failed.id, failed.version),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled')
    ).toHaveLength(1);
    const latest = await TasterSessionRequestService.get(failed.id);
    expect(latest).toMatchObject({
      status: 'invited',
      adminNotes: 'Bring sports shoes.',
      dispositionAt: failed.dispositionAt,
      delivery: { status: 'sent', retryAvailable: false },
    });
    expect(dispositionAttempts).toBe(2);
    await expect(
      TasterSessionRequestService.retryDelivery(latest.id, latest.version)
    ).rejects.toMatchObject({ statusCode: 409 });

    const noEmailCandidate = await TasterSessionRequestService.create(
      input('no-late-first-send@example.test')
    );
    const notRequested = await TasterSessionRequestService.dispose(
      noEmailCandidate.id,
      adminId,
      {
        expectedVersion: noEmailCandidate.version,
        disposition: 'invited',
        sendEmail: false,
      }
    );
    await expect(
      TasterSessionRequestService.retryDelivery(
        notRequested.id,
        notRequested.version
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects a stale disposition after an independent archive command', async () => {
    const created = await TasterSessionRequestService.create(
      input('stale-disposition@example.test')
    );
    await TasterSessionRequestService.setArchived(
      created.id,
      adminId,
      created.version,
      true
    );

    await expect(
      TasterSessionRequestService.dispose(created.id, adminId, {
        expectedVersion: created.version,
        disposition: 'invited',
        sendEmail: true,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'TASTER_SESSION_STATE_CONFLICT',
      details: { latest: { status: 'pending', archived: true } },
    });
    expect(
      vi
        .mocked(EmailService.sendFromTemplate)
        .mock.calls.filter(
          ([template]) => template === 'taster_session_invited'
        )
    ).toHaveLength(0);
  });

  it('persists a recoverable delivery claim in the disposition write before sending', async () => {
    const created = await TasterSessionRequestService.create(
      input('crash-before-send@example.test')
    );
    vi.spyOn(
      TasterSessionDeliveryService,
      'deliverClaimed'
    ).mockRejectedValueOnce(new Error('simulated process interruption'));

    await expect(
      TasterSessionRequestService.dispose(created.id, adminId, {
        expectedVersion: created.version,
        disposition: 'invited',
        sendEmail: true,
      })
    ).rejects.toThrow('simulated process interruption');

    const claimed = await TasterSessionRequestModel.findById(created.id).lean();
    expect(claimed).toMatchObject({
      status: 'invited',
      delivery: {
        status: 'in_progress',
        attemptId: expect.any(String),
        claimedAt: expect.any(Date),
      },
    });
    expect(
      vi
        .mocked(EmailService.sendFromTemplate)
        .mock.calls.filter(
          ([template]) => template === 'taster_session_invited'
        )
    ).toHaveLength(0);

    await TasterSessionRequestModel.updateOne(
      { _id: created.id },
      {
        $set: {
          'delivery.claimedAt': new Date(Date.now() - 11 * 60 * 1000),
        },
      }
    );
    await expect(
      TasterSessionRequestService.get(created.id)
    ).resolves.toMatchObject({
      status: 'invited',
      delivery: { status: 'uncertain', retryAvailable: true },
    });
  });

  it('prevents a late delivery result from overwriting a newer retry attempt', async () => {
    let resolveFirstExplicit!: () => void;
    const firstExplicit = new Promise<void>((resolve) => {
      resolveFirstExplicit = resolve;
    });
    let explicitAttempts = 0;
    vi.mocked(EmailService.sendFromTemplate).mockImplementation(
      async (template) => {
        if (template !== 'taster_session_invited') return;
        explicitAttempts += 1;
        if (explicitAttempts === 1) await firstExplicit;
      }
    );
    const created = await TasterSessionRequestService.create(
      input('late-result@example.test')
    );
    const disposition = TasterSessionRequestService.dispose(
      created.id,
      adminId,
      {
        expectedVersion: created.version,
        disposition: 'invited',
        sendEmail: true,
      }
    );
    await vi.waitFor(() => expect(explicitAttempts).toBe(1));
    await TasterSessionRequestModel.updateOne(
      { _id: created.id },
      {
        $set: {
          'delivery.claimedAt': new Date(Date.now() - 11 * 60 * 1000),
        },
      }
    );
    const stale = await TasterSessionRequestService.get(created.id);

    await expect(
      TasterSessionRequestService.retryDelivery(created.id, stale.version)
    ).resolves.toMatchObject({
      status: 'invited',
      delivery: { status: 'sent' },
    });
    resolveFirstExplicit();
    await disposition;

    await expect(
      TasterSessionRequestService.get(created.id)
    ).resolves.toMatchObject({
      status: 'invited',
      delivery: { status: 'sent', retryAvailable: false },
    });
    expect(explicitAttempts).toBe(2);
  });
});
