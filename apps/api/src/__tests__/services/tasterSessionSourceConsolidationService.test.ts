import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import {
  inspectTasterSessionSourceConsolidation,
  tasterSourceUnrestrictedApprovalKey,
  validateTasterSessionSourceTransferTargets,
  type SharedTasterSourceLocation,
} from '../../services/tasterSessionSourceConsolidationService';

const shared: SharedTasterSourceLocation[] = [
  {
    id: 'shared-location',
    isActive: true,
    translations: {
      de: { address: 'Tempelhofer Ufer 19, 10963 Berlin' },
      en: { address: 'Tempelhofer Ufer 19, 10963 Berlin' },
    },
    timeSlots: [
      {
        id: 'shared-slot',
        weekday: 'friday',
        startTime: '19:00',
        endTime: '21:30',
        active: true,
      },
    ],
  },
];

const legacy = {
  locations: [
    {
      id: 'legacy-location',
      name: 'TU',
      address: ' tempelhofer ufer 19, 10963  BERLIN ',
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
      acceptedLevels: ['beginner', 'experienced'],
      capacityPerSlot: 4,
    },
  ],
};

describe('Taster Session source consolidation inspection', () => {
  it('maps exact facts, transfers only Taster policy, and reports capacity as obsolete', () => {
    const report = inspectTasterSessionSourceConsolidation(legacy, shared);

    expect(report.blockers).toEqual([]);
    expect(report.obsoleteCapacityFieldCount).toBe(1);
    expect(report.sharedSlotEvidence).toEqual([
      expect.objectContaining({
        locationId: 'shared-location',
        timeSlotId: 'shared-slot',
        classification: 'legacy_mapping',
      }),
    ]);
    expect(report.transfers).toEqual([
      expect.objectContaining({
        legacySessionId: 'legacy-session',
        locationId: 'shared-location',
        normalizedLocationAddress: 'tempelhofer ufer 19, 10963 berlin',
        expectedLocationActive: true,
        timeSlotId: 'shared-slot',
        expectedWeekday: 'friday',
        expectedStartTime: '19:00',
        expectedEndTime: '21:30',
        expectedTimeSlotActive: true,
        expectedTasterSessionPolicy: {
          enabledPresent: false,
          enabled: null,
          acceptedLevelsPresent: false,
          acceptedLevels: null,
        },
        tasterSessionEnabled: true,
        tasterSessionAcceptedLevels: ['beginner', 'experienced'],
      }),
    ]);
  });

  it('recognizes Mongoose subdocument _id metadata but still blocks unknown policy fields', () => {
    const retained = {
      locations: [{ ...legacy.locations[0], _id: new Types.ObjectId() }],
      sessions: [{ ...legacy.sessions[0], _id: new Types.ObjectId() }],
    };
    expect(
      inspectTasterSessionSourceConsolidation(retained, shared).blockers
    ).toEqual([]);
    expect(
      inspectTasterSessionSourceConsolidation(retained, shared).transfers[0]
    ).not.toHaveProperty('_id');

    const unknownPolicy = {
      ...retained,
      sessions: [{ ...retained.sessions[0], seasonalRestriction: true }],
    };
    expect(
      inspectTasterSessionSourceConsolidation(unknownPolicy, shared).blockers
    ).toContain(
      'unclassified_legacy_session_fields:legacy-session:seasonalRestriction'
    );
  });

  it('blocks an unmatched active shared slot without explicit Taster policy', () => {
    const extraSlot = {
      ...shared[0].timeSlots[0],
      id: 'unclassified-slot',
      weekday: 'monday',
    };
    const report = inspectTasterSessionSourceConsolidation(legacy, [
      { ...shared[0], timeSlots: [...shared[0].timeSlots, extraSlot] },
    ]);

    expect(report.blockers).toContainEqual(
      expect.stringContaining(
        'unclassified_shared_slot:shared-location:unclassified-slot:monday:19:00:21:30:approval='
      )
    );
    expect(report.sharedSlotEvidence).toContainEqual(
      expect.objectContaining({
        timeSlotId: 'unclassified-slot',
        classification: 'unclassified',
      })
    );
  });

  it('allows an unmatched slot with explicit valid Taster policy', () => {
    const explicitSlot = {
      ...shared[0].timeSlots[0],
      id: 'explicit-slot',
      weekday: 'monday',
      tasterSessionEnabled: true,
      tasterSessionAcceptedLevels: ['experienced'],
    };
    const report = inspectTasterSessionSourceConsolidation(legacy, [
      { ...shared[0], timeSlots: [...shared[0].timeSlots, explicitSlot] },
    ]);

    expect(report.blockers).toEqual([]);
    expect(report.sharedSlotEvidence).toContainEqual(
      expect.objectContaining({
        timeSlotId: 'explicit-slot',
        classification: 'explicit_policy',
      })
    );
  });

  it('does not treat Guest Play policy as Taster transition evidence', () => {
    const guestRestrictedSlot = {
      ...shared[0].timeSlots[0],
      id: 'guest-only-slot',
      weekday: 'monday',
      guestPlayEnabled: false,
    };
    const report = inspectTasterSessionSourceConsolidation(legacy, [
      {
        ...shared[0],
        timeSlots: [...shared[0].timeSlots, guestRestrictedSlot],
      },
    ]);

    expect(report.sharedSlotEvidence).toContainEqual(
      expect.objectContaining({
        timeSlotId: 'guest-only-slot',
        classification: 'unclassified',
      })
    );
  });

  it('records fact-bound approval for an intentionally unrestricted unmatched slot', () => {
    const newSlot = {
      ...shared[0].timeSlots[0],
      id: 'approved-slot',
      weekday: 'monday',
    };
    const location = {
      ...shared[0],
      timeSlots: [...shared[0].timeSlots, newSlot],
    };
    const approval = tasterSourceUnrestrictedApprovalKey(location, newSlot);
    const report = inspectTasterSessionSourceConsolidation(legacy, [location], {
      approvedUnrestrictedSlots: new Set([approval]),
    });

    expect(report.blockers).toEqual([]);
    expect(report.sharedSlotEvidence).toContainEqual(
      expect.objectContaining({
        timeSlotId: 'approved-slot',
        classification: 'approved_unrestricted',
        unrestrictedApprovalKey: approval,
      })
    );
  });

  it('accepts resettable seed-shaped TU and PU slots with explicit policy', () => {
    const resettable = [
      {
        ...shared[0],
        timeSlots: [
          {
            ...shared[0].timeSlots[0],
            tasterSessionEnabled: true,
            tasterSessionAcceptedLevels: ['beginner', 'experienced'],
          },
          {
            ...shared[0].timeSlots[0],
            id: 'pu-slot',
            weekday: 'monday',
            tasterSessionEnabled: true,
            tasterSessionAcceptedLevels: ['experienced'],
          },
        ],
      },
    ];
    const report = inspectTasterSessionSourceConsolidation(legacy, resettable);

    expect(report.blockers).toEqual([]);
    expect(
      report.sharedSlotEvidence.map((entry) => entry.classification)
    ).toEqual(['legacy_mapping', 'explicit_policy']);
  });

  it('translates inactive legacy facts into Taster-only disablement', () => {
    const report = inspectTasterSessionSourceConsolidation(
      {
        ...legacy,
        locations: [{ ...legacy.locations[0], active: false }],
      },
      shared
    );
    expect(report.transfers[0]?.tasterSessionEnabled).toBe(false);
  });

  it.each([
    [
      'no match',
      [{ ...shared[0], timeSlots: [] }],
      'shared_slot_match_missing',
    ],
    [
      'multiple matches',
      [...shared, { ...shared[0], id: 'duplicate' }],
      'shared_slot_match_ambiguous',
    ],
  ])('blocks %s instead of guessing', (_name, locations, blocker) => {
    expect(
      inspectTasterSessionSourceConsolidation(legacy, locations).blockers
    ).toContain(`${blocker}:legacy-session`);
  });

  it('blocks invalid levels and unclassified fields', () => {
    const report = inspectTasterSessionSourceConsolidation(
      {
        locations: legacy.locations,
        sessions: [
          { ...legacy.sessions[0], acceptedLevels: [] },
          {
            ...legacy.sessions[0],
            id: 'other',
            active: false,
            extraPolicy: true,
          },
        ],
      },
      shared
    );
    expect(report.blockers).toContain('invalid_accepted_levels:legacy-session');
    expect(report.blockers).toContain(
      'unclassified_legacy_session_fields:other:extraPolicy'
    );
  });

  it('blocks unclassified top-level configuration fields', () => {
    const report = inspectTasterSessionSourceConsolidation(
      { ...legacy, seasonalPolicy: true } as never,
      shared
    );
    expect(report.blockers).toContain(
      'unclassified_legacy_configuration_fields:seasonalPolicy'
    );
  });

  it('blocks an invalid legacy root shape without attempting inspection', () => {
    expect(
      inspectTasterSessionSourceConsolidation(
        { locations: null, sessions: [] } as never,
        shared
      ).blockers
    ).toEqual(['invalid_legacy_trial_training_shape']);
  });

  it('blocks malformed retained values instead of trusting compile-time types', () => {
    const report = inspectTasterSessionSourceConsolidation(
      {
        locations: [
          { ...legacy.locations[0], active: 'false' },
          legacy.locations[0],
          legacy.locations[0],
        ],
        sessions: [
          { ...legacy.sessions[0], active: 'false' },
          { ...legacy.sessions[0], id: 'invalid-levels', acceptedLevels: null },
        ],
      } as never,
      shared
    );

    expect(report.blockers).toContain('invalid_legacy_location:0');
    expect(report.blockers).toContain(
      'duplicate_legacy_location_id:legacy-location'
    );
    expect(report.blockers).toContain('invalid_legacy_session:0');
    expect(report.blockers).toContain('invalid_legacy_session:1');
    expect(report.transfers).toEqual([]);
  });

  it('blocks conflicting legacy policies for one shared slot', () => {
    const report = inspectTasterSessionSourceConsolidation(
      {
        locations: legacy.locations,
        sessions: [
          legacy.sessions[0],
          {
            ...legacy.sessions[0],
            id: 'other',
            acceptedLevels: ['experienced'],
          },
        ],
      },
      shared
    );
    expect(report.blockers).toContain(
      'conflicting_legacy_policy:shared-location:shared-slot'
    );
  });

  it('returns deterministic evidence on repeated dry-run inspection', () => {
    expect(inspectTasterSessionSourceConsolidation(legacy, shared)).toEqual(
      inspectTasterSessionSourceConsolidation(legacy, shared)
    );
  });

  it('detects changed transfer facts while accepting an already-applied policy', () => {
    const transfer = inspectTasterSessionSourceConsolidation(legacy, shared)
      .transfers[0];
    expect(
      validateTasterSessionSourceTransferTargets(
        [transfer],
        [
          {
            ...shared[0],
            timeSlots: [{ ...shared[0].timeSlots[0], startTime: '20:00' }],
          },
        ]
      )
    ).toContain('shared_transfer_facts_changed:shared-location:shared-slot');
    expect(
      validateTasterSessionSourceTransferTargets(
        [transfer],
        [
          {
            ...shared[0],
            timeSlots: [
              {
                ...shared[0].timeSlots[0],
                tasterSessionEnabled: true,
                tasterSessionAcceptedLevels: ['beginner', 'experienced'],
              },
            ],
          },
        ]
      )
    ).toEqual([]);
  });

  it.each([
    [
      'address',
      {
        ...shared[0],
        translations: { en: { address: 'Changed Address' } },
      },
      'shared_transfer_facts_changed',
    ],
    [
      'weekday',
      {
        ...shared[0],
        timeSlots: [{ ...shared[0].timeSlots[0], weekday: 'monday' }],
      },
      'shared_transfer_facts_changed',
    ],
    [
      'time range',
      {
        ...shared[0],
        timeSlots: [
          {
            ...shared[0].timeSlots[0],
            startTime: '20:00',
            endTime: '22:00',
          },
        ],
      },
      'shared_transfer_facts_changed',
    ],
    [
      'slot identity',
      {
        ...shared[0],
        timeSlots: [{ ...shared[0].timeSlots[0], id: 'replacement-slot' }],
      },
      'shared_transfer_target_missing',
    ],
  ])('rejects a changed %s before apply', (_name, changed, blocker) => {
    const transfer = inspectTasterSessionSourceConsolidation(legacy, shared)
      .transfers[0];
    expect(
      validateTasterSessionSourceTransferTargets([transfer], [changed])
    ).toContain(`${blocker}:shared-location:shared-slot`);
  });
});
