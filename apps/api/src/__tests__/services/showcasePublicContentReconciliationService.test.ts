import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { showcaseContentFingerprint } from '../../services/showcasePublicContentReconciliationService';
import { parseShowcaseReconciliationArgs } from '../../scripts/reconcileShowcasePublicContent';
import * as defaults from '../../scripts/canonicalContentDefaults';
import { canonicalLocations } from '../../scripts/bootstrapCanonicalContent';
import {
  DEVELOPMENT_ANNOUNCEMENTS,
  DEVELOPMENT_ACTIVITIES,
} from '../../scripts/developmentPublicContentFixtures';
import { contactEntryValuesSchema } from '@club/shared-types/api/contact';
import { resolveAnnouncementText } from '@club/shared-types/api/announcement';
import { Language } from '@club/shared-types/core/enums';

describe('Showcase public-content operator input and defaults', () => {
  it('resolves meaningful English fallback content for the second seeded Announcement', () => {
    const announcement = DEVELOPMENT_ANNOUNCEMENTS[1];
    expect(announcement.isActive).toBe(true);
    expect(
      resolveAnnouncementText(announcement.translations, Language.ENGLISH)
    ).toEqual({
      title: 'Fiktives Teilnahmebeispiel',
      content:
        'Demo / 示例: Dieses fiktive Beispiel zeigt die Teilnahmeinformationen. Es werden keine Besuche vereinbart.',
    });
  });

  it('defaults to audit and requires exact, nonduplicated custom approvals', () => {
    expect(parseShowcaseReconciliationArgs([]).apply).toBe(false);
    const hash = 'a'.repeat(64);
    expect(
      parseShowcaseReconciliationArgs([
        '--apply',
        `--approve-custom=homepage:${hash}`,
      ])
    ).toEqual({ apply: true, approvals: new Map([['homepage', hash]]) });
    for (const args of [
      ['--unknown'],
      ['--audit', '--apply'],
      ['--apply', '--apply'],
      ['--approve-custom=homepage:invalid'],
      [
        `--approve-custom=homepage:${hash}`,
        `--approve-custom=homepage:${hash}`,
      ],
    ]) {
      expect(() => parseShowcaseReconciliationArgs(args)).toThrow(
        'CUSTOM_APPROVAL_INVALID'
      );
    }
  });
  it('normalizes key ordering without discarding meaningful array ordering or content changes', () => {
    expect(showcaseContentFingerprint({ b: 1, a: 2 })).toBe(
      showcaseContentFingerprint({ a: 2, b: 1 })
    );
    expect(showcaseContentFingerprint([1, 2])).not.toBe(
      showcaseContentFingerprint([2, 1])
    );
    expect(showcaseContentFingerprint('A')).not.toBe(
      showcaseContentFingerprint('a')
    );
  });
  it('uses non-deliverable synthetic Contacts and non-operational defaults with stable slots', () => {
    for (const entry of defaults.CANONICAL_CONTACT_ENTRIES) {
      expect(contactEntryValuesSchema.safeParse(entry).success).toBe(true);
      expect(entry.email).toMatch(/@example\.invalid$/);
      expect(entry.externalLink).toBe('');
      expect(entry.retainedQrCode).toBe('');
    }
    expect(defaults.CANONICAL_RECRUITMENT_PUBLIC_CONTENT.isOpen).toBe(false);
    expect(
      defaults.CANONICAL_RECRUITMENT_PUBLIC_CONTENT.contactEntryId
    ).toBeNull();
    const locations = canonicalLocations(new Types.ObjectId());
    expect(
      locations.flatMap((row) => row.timeSlots.map((slot) => slot.id))
    ).toEqual(
      Array.from(
        { length: 6 },
        (_, index) => `0a0a0a0a-0000-4000-8000-00000000000${index + 1}`
      )
    );
    for (const row of locations) expect(row.imageUrl).toBe('');
    expect(
      JSON.stringify([
        defaults,
        locations,
        DEVELOPMENT_ANNOUNCEMENTS,
        DEVELOPMENT_ACTIVITIES,
      ])
    ).not.toMatch(
      /DCBV|dcbev\.de|Tempelhofer|Gürtelstraße|Deutsch-Chines|German-Chinese/
    );
  });
});
