import { afterEach, describe, expect, it, vi } from 'vitest';
import { Language } from '@club/shared-types/core/enums';
import { RecruitmentPublicContent } from '../../models/RecruitmentPublicContent';
import { contactEntryService } from '../../services/contactEntryService';
import { RecruitmentPublicContentService } from '../../services/recruitmentPublicContentService';

const contactId = '507f1f77bcf86cd799439011';
const content = {
  isOpen: true,
  introduction: { de: 'Einführung', en: '', zh: '介绍' },
  requirements: { de: 'Erfahrung', en: '', zh: '' },
  tryoutGuidance: { de: 'Kontakt', en: 'Contact', zh: '' },
  contactEntryId: contactId,
};

afterEach(() => vi.restoreAllMocks());

describe('RecruitmentPublicContentService', () => {
  it('returns bounded unavailability for a missing public owner', async () => {
    vi.spyOn(RecruitmentPublicContent, 'findOne').mockResolvedValue(null);

    await expect(
      RecruitmentPublicContentService.getPublicContent(Language.GERMAN)
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'RECRUITMENT_PUBLIC_CONTENT_UNAVAILABLE',
    });
  });

  it('resolves localized content while exposing only Contact identity', async () => {
    vi.spyOn(RecruitmentPublicContent, 'findOne').mockResolvedValue({
      content,
    } as never);

    await expect(
      RecruitmentPublicContentService.getPublicContent(Language.ENGLISH)
    ).resolves.toEqual({
      isOpen: true,
      introduction: 'Einführung',
      requirements: 'Erfahrung',
      tryoutGuidance: 'Contact',
      contactEntryId: contactId,
    });
  });

  it('uses the Contact-owned active check before opening', async () => {
    vi.spyOn(contactEntryService, 'isActive').mockResolvedValue(false);
    const update = vi.spyOn(RecruitmentPublicContent, 'findOneAndUpdate');

    await expect(
      RecruitmentPublicContentService.updateContent(content, contactId)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'RECRUITMENT_ACTIVE_CONTACT_REQUIRED',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('allows paused content without a Contact and reports it unavailable', async () => {
    const paused = { ...content, isOpen: false, contactEntryId: null };
    vi.spyOn(RecruitmentPublicContent, 'findOneAndUpdate').mockResolvedValue({
      content: paused,
      updatedAt: new Date('2026-08-22T12:00:00.000Z'),
    } as never);

    await expect(
      RecruitmentPublicContentService.updateContent(paused, contactId)
    ).resolves.toMatchObject({
      content: paused,
      contactAvailable: false,
      updatedAt: '2026-08-22T12:00:00.000Z',
    });
  });
});
