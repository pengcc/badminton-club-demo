import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EmailTemplate } from '../../models/EmailTemplate';
import {
  PRE_B1_SYSTEM_EMAIL_TEMPLATE_DEFINITIONS,
  preflightTasterSessionEmailTemplates,
  reconcileEmailTemplates,
  reconcileTasterSessionEmailTemplates,
  SYSTEM_EMAIL_TEMPLATE_DEFINITIONS,
} from '../../scripts/seedEmailTemplates';
import {
  LEGACY_MEMBER_PASSWORD_SETUP_BODY,
  MEMBER_PASSWORD_SETUP_TEMPLATE,
  OBSOLETE_MEMBER_INVITATION_TEMPLATE_NAME,
  PRE_B1_MEMBER_PASSWORD_SETUP_TEMPLATE,
  SYSTEM_EMAIL_TEMPLATE_CONTRACTS,
} from '../../services/emailTemplateSystemContract';

let mongoLease: MongoTestDatabaseLease;

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('emailTemplateSeed');
  mongoLease.assertOwnedDatabase();
  await EmailTemplate.syncIndexes();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await EmailTemplate.deleteMany({});
});

afterAll(async () => {
  await mongoLease.release();
});

describe('email-template seed reconciliation persistence', () => {
  it('creates every current sender with exact available-variable metadata and valid defaults', async () => {
    const summary = await reconcileEmailTemplates();
    expect(summary.reviewRequired).toEqual([]);

    for (const contract of SYSTEM_EMAIL_TEMPLATE_CONTRACTS) {
      const persisted = await EmailTemplate.findOne({
        name: contract.name,
      }).lean();
      expect(persisted, contract.name).not.toBeNull();
      expect(persisted?.variables, contract.name).toEqual(
        contract.availableVariables
      );
    }

    expect(
      await EmailTemplate.exists({ name: 'application_approved' })
    ).not.toBeNull();
    expect(summary.gate5Skipped).not.toContain('application_approved');
  });

  it('upgrades exact old defaults and the system-owned variable contract', async () => {
    await EmailTemplate.create({
      ...MEMBER_PASSWORD_SETUP_TEMPLATE,
      body: LEGACY_MEMBER_PASSWORD_SETUP_BODY,
      variables: ['firstName', 'lastName', 'email', 'resetLink'],
    });

    const summary = await reconcileEmailTemplates();
    const persisted = await EmailTemplate.findOne({
      name: 'member_password_setup',
    }).lean();

    expect(persisted?.body).toMatchObject(MEMBER_PASSWORD_SETUP_TEMPLATE.body);
    expect(persisted?.variables).toEqual(
      MEMBER_PASSWORD_SETUP_TEMPLATE.variables
    );
    expect(summary.defaultsUpdated).toEqual([
      'member_password_setup.de',
      'member_password_setup.en',
      'member_password_setup.zh',
    ]);
    expect(summary.contractUpdated).toEqual(['member_password_setup']);
    expect(summary.reviewRequired).toEqual([]);
  });

  it('converges every exact pre-B1 recipient default without changing administrator alerts', async () => {
    const currentNames = new Set<string>(
      SYSTEM_EMAIL_TEMPLATE_CONTRACTS.map(({ name }) => name)
    );
    await EmailTemplate.create(
      PRE_B1_SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.filter(({ name }) =>
        currentNames.has(name)
      )
    );

    const summary = await reconcileEmailTemplates();

    expect(summary.reviewRequired).toEqual([]);
    for (const definition of SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.filter(
      ({ name }) => currentNames.has(name)
    )) {
      const persisted = await EmailTemplate.findOne({
        name: definition.name,
      }).lean();
      expect(persisted?.subject, `${definition.name} subject`).toMatchObject(
        definition.subject
      );
      expect(persisted?.body, `${definition.name} body`).toMatchObject(
        definition.body
      );
      expect(persisted?.variables, `${definition.name} variables`).toEqual(
        definition.variables
      );
    }
    for (const name of [
      'application_admin_alert',
      'taster_session_admin_alert',
      'guest_play_admin_alert',
    ]) {
      expect(summary.defaultsUpdated).not.toContain(name);
    }
  });

  it('converges the reviewed-head B1 Taster and Guest copy to the natural-language defaults', async () => {
    const taster = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
      (template) => template.name === 'taster_session_received'
    )!;
    const guest = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
      (template) => template.name === 'guest_play_approved'
    )!;
    await EmailTemplate.create([
      {
        ...taster,
        body: {
          de: taster.body.de.replace(
            'Wir haben deine Anfrage erhalten. Die gewählte Zeit ist dein Wunschtermin und noch nicht bestätigt.',
            'Deine Anfrage ist eingegangen; die gewählte Zeit ist nur eine unverbindliche Präferenz.'
          ),
          en: taster.body.en.replace(
            'We received it. The time you selected is your preferred time and has not been confirmed yet.',
            'We received it; the selected time is only a non-binding preference.'
          ),
          zh: taster.body.zh.replace(
            '我们已经收到申请。你选择的是希望到访的时间，具体时间还需要俱乐部确认。',
            '我们已经收到申请；所选时间仅为非约束性偏好。'
          ),
        },
      },
      {
        ...guest,
        body: {
          de: guest.body.de.replace(
            'Die Genehmigung ist keine Buchung, hält keinen Platz frei und garantiert keine Spielzeit.',
            'Die Genehmigung ist keine Buchung, reserviert keine Kapazität und garantiert keine Spielzeit.'
          ),
          en: guest.body.en.replace(
            'This permission is not a booking, does not hold a place, and does not guarantee playing time.',
            'This permission is not a booking, does not reserve capacity, and does not guarantee playing time.'
          ),
          zh: guest.body.zh.replace(
            '这项许可不是预订，不会为你预留名额，也不保证上场时间。',
            '该许可不是预订，不保留容量，也不保证上场时间。'
          ),
        },
      },
    ]);

    const summary = await reconcileEmailTemplates();

    expect(
      (await EmailTemplate.findOne({ name: taster.name }).lean())?.body
    ).toMatchObject(taster.body);
    expect(
      (await EmailTemplate.findOne({ name: guest.name }).lean())?.body
    ).toMatchObject(guest.body);
    expect(summary.defaultsUpdated).toEqual(
      expect.arrayContaining([taster.name, guest.name])
    );
    expect(summary.reviewRequired).toEqual([]);
  });

  it('updates sender metadata while preserving customized content and reporting violations', async () => {
    const definition = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
      (template) => template.name === 'application_received'
    )!;
    await EmailTemplate.create({
      ...definition,
      body: {
        ...definition.body,
        en: 'Customized receipt with legacy reference {{applicationId}}',
      },
      variables: ['firstName', 'lastName', 'applicationId'],
    });

    const summary = await reconcileEmailTemplates();
    const persisted = await EmailTemplate.findOne({
      name: 'application_received',
    }).lean();

    expect(persisted?.body.en).toBe(
      'Customized receipt with legacy reference {{applicationId}}'
    );
    expect(persisted?.variables).toEqual(definition.variables);
    expect(summary.contractUpdated).toContain('application_received');
    expect(summary.customContentPreserved).toContain('application_received');
    expect(summary.reviewRequired).toContain(
      'application_received: retained custom content uses retired {{applicationId}}; review before delivery'
    );
  });

  it('preserves contract-valid customized B1 content and still requires semantic review', async () => {
    const definition = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
      (template) => template.name === 'application_contact'
    )!;
    const customBody = {
      ...definition.body,
      en: 'Club note: {{message}} — {{senderName}}',
    };
    await EmailTemplate.create({ ...definition, body: customBody });

    const summary = await reconcileEmailTemplates();
    const persisted = await EmailTemplate.findOne({
      name: 'application_contact',
    }).lean();

    expect(persisted?.body).toMatchObject(customBody);
    expect(summary.customContentPreserved).toContain('application_contact');
    expect(summary.reviewRequired).toContain(
      'application_contact: retained content differs from the recognized system defaults; review without automatic replacement'
    );
  });

  it.each([
    true,
    false,
  ])('preserves customized approval content and reconciles its active contract when isActive=%s', async (isActive) => {
    const definition = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
      (template) => template.name === 'application_approved'
    )!;
    const custom = {
      ...definition,
      subject: {
        de: 'Eigener Betreff',
        en: 'Custom subject',
        zh: '自定义主题',
      },
      body: { de: 'Eigener Text', en: 'Custom body', zh: '自定义正文' },
      variables: ['customVariable'],
      isActive,
    };
    await EmailTemplate.create(custom);

    const summary = await reconcileEmailTemplates();
    const persisted = await EmailTemplate.findOne({
      name: 'application_approved',
    }).lean();

    expect(persisted).toMatchObject({
      subject: custom.subject,
      body: custom.body,
      variables: definition.variables,
      isActive,
    });
    expect(summary.gate5Skipped).not.toContain('application_approved');
    expect(summary.obsoleteDisabled).not.toContain('application_approved');
    expect(summary.contractUpdated).toContain('application_approved');
    expect(summary.customContentPreserved).toContain('application_approved');
    expect(summary.reviewRequired).toEqual(
      expect.arrayContaining([
        'application_approved.de: missing {{setupGuidance}}',
        'application_approved.en: missing {{setupGuidance}}',
        'application_approved.zh: missing {{setupGuidance}}',
      ])
    );
  });

  it('upgrades only exact legacy locales and flags incompatible custom content', async () => {
    const customBody = {
      de: 'Eigener Text {{resetLink}} mit {{expiresIn}}.',
      en: LEGACY_MEMBER_PASSWORD_SETUP_BODY.en,
      zh: '自定义内容 {{expiresIn}}。',
    };
    await EmailTemplate.create({
      ...MEMBER_PASSWORD_SETUP_TEMPLATE,
      body: customBody,
      variables: ['firstName', 'lastName', 'email', 'resetLink'],
    });

    const summary = await reconcileEmailTemplates();
    const persisted = await EmailTemplate.findOne({
      name: 'member_password_setup',
    }).lean();

    expect(persisted?.body.de).toBe(customBody.de);
    expect(persisted?.body.en).toBe(MEMBER_PASSWORD_SETUP_TEMPLATE.body.en);
    expect(persisted?.body.zh).toBe(customBody.zh);
    expect(summary.customContentPreserved).toEqual(['member_password_setup']);
    expect(summary.reviewRequired).toEqual(
      expect.arrayContaining([
        'member_password_setup.zh: missing {{resetLink}}',
        'member_password_setup: retained content differs from the recognized system defaults; review without automatic replacement',
      ])
    );
  });

  it('upgrades recognized password-setup subjects by locale and preserves a customized subject', async () => {
    const customEnglishSubject = 'Your club account is waiting';
    await EmailTemplate.create({
      ...MEMBER_PASSWORD_SETUP_TEMPLATE,
      subject: {
        de: PRE_B1_MEMBER_PASSWORD_SETUP_TEMPLATE.subject.de,
        en: customEnglishSubject,
        zh: MEMBER_PASSWORD_SETUP_TEMPLATE.subject.zh,
      },
    });

    const summary = await reconcileEmailTemplates();
    const persisted = await EmailTemplate.findOne({
      name: 'member_password_setup',
    }).lean();

    expect(persisted?.subject).toMatchObject({
      de: MEMBER_PASSWORD_SETUP_TEMPLATE.subject.de,
      en: customEnglishSubject,
      zh: MEMBER_PASSWORD_SETUP_TEMPLATE.subject.zh,
    });
    expect(summary.customContentPreserved).toContain('member_password_setup');
    expect(summary.reviewRequired).toContain(
      'member_password_setup: retained content differs from the recognized system defaults; review without automatic replacement'
    );
  });

  it('deactivates the obsolete temporary-password template without deleting its content', async () => {
    const oldBody = { de: 'custom de', en: 'custom en', zh: 'custom zh' };
    await EmailTemplate.create({
      name: OBSOLETE_MEMBER_INVITATION_TEMPLATE_NAME,
      subject: { de: 'old de', en: 'old en', zh: 'old zh' },
      body: oldBody,
      variables: ['temporaryPassword'],
      isActive: true,
    });

    const summary = await reconcileEmailTemplates();
    const persisted = await EmailTemplate.findOne({
      name: OBSOLETE_MEMBER_INVITATION_TEMPLATE_NAME,
    }).lean();

    expect(persisted?.isActive).toBe(false);
    expect(persisted?.body).toMatchObject(oldBody);
    expect(summary.obsoleteDisabled).toEqual([
      OBSOLETE_MEMBER_INVITATION_TEMPLATE_NAME,
    ]);
  });

  it('creates canonical Taster Session templates and does not create obsolete legacy identities', async () => {
    const summary = await reconcileEmailTemplates();
    expect(summary.created).toEqual(
      expect.arrayContaining([
        'taster_session_received',
        'taster_session_admin_alert',
        'taster_session_invited',
        'taster_session_declined',
      ])
    );
    expect(
      await EmailTemplate.countDocuments({
        name: {
          $in: ['trial_training_contacted', 'trial_training_no_capacity'],
        },
      })
    ).toBe(0);

    const canonical = await EmailTemplate.find({
      name: {
        $in: [
          'taster_session_received',
          'taster_session_admin_alert',
          'taster_session_invited',
          'taster_session_declined',
        ],
      },
    }).lean();
    expect(canonical).toHaveLength(4);
    for (const template of canonical) {
      expect(template.subject.de).toBeTruthy();
      expect(template.subject.en).toBeTruthy();
      expect(template.subject.zh).toBeTruthy();
      expect(template.body.de).toBeTruthy();
      expect(template.body.en).toBeTruthy();
      expect(template.body.zh).toBeTruthy();
    }
    expect(
      canonical.find((template) => template.name === 'taster_session_invited')
        ?.variables
    ).toEqual(['name', 'preferenceDetails']);
    expect(
      canonical.find((template) => template.name === 'taster_session_declined')
        ?.variables
    ).toEqual(['name', 'declineReason', 'declineReasonDetails']);
  });

  it('performs zero writes when Taster Session preflight finds a customization blocker', async () => {
    const contacted = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
      (template) => template.name === 'trial_training_contacted'
    )!;
    const noCapacity = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
      (template) => template.name === 'trial_training_no_capacity'
    )!;
    await EmailTemplate.create(contacted);
    await EmailTemplate.create({
      ...noCapacity,
      body: { ...noCapacity.body, en: 'Customized legacy text' },
    });
    const before = await EmailTemplate.find().sort({ name: 1 }).lean();

    const summary = await reconcileTasterSessionEmailTemplates();
    const after = await EmailTemplate.find().sort({ name: 1 }).lean();

    expect(after).toEqual(before);
    expect(summary.created).toEqual([]);
    expect(summary.obsoleteDisabled).toEqual([]);
    expect(summary.customContentPreserved).toContain(
      'trial_training_no_capacity'
    );
    expect(summary.reviewRequired).toContain(
      'trial_training_no_capacity -> taster_session_declined: customized legacy template must be preserved but inactive after a verified canonical replacement is active'
    );
  });

  it('completes a resolved manual customization migration without deleting legacy content', async () => {
    const legacy = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
      (template) => template.name === 'trial_training_received'
    )!;
    const canonical = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.find(
      (template) => template.name === 'taster_session_received'
    )!;
    await EmailTemplate.create({
      ...legacy,
      body: { ...legacy.body, de: 'Bewahrter eigener Inhalt {{name}}' },
      isActive: false,
    });
    await EmailTemplate.create(canonical);

    const preflight = await preflightTasterSessionEmailTemplates();
    const summary = await reconcileTasterSessionEmailTemplates();
    const persistedLegacy = await EmailTemplate.findOne({
      name: legacy.name,
    }).lean();

    expect(preflight).toMatchObject({
      ready: true,
      resolvedCustomizations: ['trial_training_received'],
      reviewRequired: [],
    });
    expect(summary.reviewRequired).toEqual([]);
    expect(persistedLegacy?.isActive).toBe(false);
    expect(persistedLegacy?.body.de).toBe('Bewahrter eigener Inhalt {{name}}');
  });

  it('converts all four system defaults without changing unrelated template families', async () => {
    const legacyNames = [
      'trial_training_received',
      'trial_training_admin_alert',
      'trial_training_contacted',
      'trial_training_no_capacity',
    ];
    const canonicalNames = [
      'taster_session_received',
      'taster_session_admin_alert',
      'taster_session_invited',
      'taster_session_declined',
    ];
    await EmailTemplate.create(
      SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.filter((template) =>
        legacyNames.includes(template.name)
      )
    );
    const unrelated = await EmailTemplate.create({
      name: 'unrelated_capability_template',
      subject: { de: 'de', en: 'en', zh: 'zh' },
      body: { de: 'de body', en: 'en body', zh: 'zh body' },
      variables: [],
      isActive: true,
    });
    const unrelatedBefore = unrelated.toObject();

    const summary = await reconcileTasterSessionEmailTemplates();
    const unrelatedAfter = await EmailTemplate.findById(unrelated._id).lean();

    expect(summary.reviewRequired).toEqual([]);
    expect(summary.obsoleteDisabled).toEqual(
      expect.arrayContaining(legacyNames)
    );
    expect(summary.created).toEqual(expect.arrayContaining(canonicalNames));
    expect(
      await EmailTemplate.countDocuments({
        name: { $in: legacyNames },
        isActive: false,
      })
    ).toBe(4);
    expect(
      await EmailTemplate.countDocuments({
        name: { $in: canonicalNames },
        isActive: true,
      })
    ).toBe(4);
    expect(unrelatedAfter).toEqual(unrelatedBefore);
  });
});
