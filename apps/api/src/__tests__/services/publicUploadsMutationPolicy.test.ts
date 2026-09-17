import { afterEach, describe, expect, it, vi } from 'vitest';
import { Activity } from '../../models/Activity';
import { ContactEntry } from '../../models/ContactEntry';
import { PublicDocument } from '../../models/PublicDocument';
import { ActivityService } from '../../services/activityService';
import { ContactEntryService } from '../../services/contactEntryService';
import { PublicDocumentService } from '../../services/publicDocumentService';
import { assertPublicUploadsMutationAllowed } from '../../services/publicUploadsMutationPolicy';

const actorId = '507f1f77bcf86cd799439011';

function alternateDatabaseGuard() {
  assertPublicUploadsMutationAllowed(true);
}

describe('alternate development database public-upload mutations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses Activity media mutation before file or database work', async () => {
    const files = { stageAndPromote: vi.fn() };
    const save = vi.spyOn(Activity.prototype, 'save');
    const service = new ActivityService(files as never, alternateDatabaseGuard);

    await expect(
      service.create(
        {
          translations: {
            de: { name: 'Training', description: '' },
            en: { name: '', description: '' },
            zh: { name: '', description: '' },
          },
          retainedImages: [],
          videoLink: '',
          videoDescription: { de: '', en: '', zh: '' },
          isVisible: true,
          order: 0,
        },
        [],
        actorId
      )
    ).rejects.toMatchObject({
      code: 'ALTERNATE_DEVELOPMENT_DATABASE_PUBLIC_UPLOADS_UNAVAILABLE',
    });
    expect(files.stageAndPromote).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses Contact QR mutation before file or database work', async () => {
    const files = { stageAndPromote: vi.fn() };
    const count = vi.spyOn(ContactEntry, 'countDocuments');
    const service = new ContactEntryService(
      files as never,
      alternateDatabaseGuard
    );

    await expect(
      service.create(
        {
          category: 'General inquiries',
          title: { de: 'Kontakt', en: '', zh: '' },
          description: { de: '', en: '', zh: '' },
          email: 'club@example.test',
          retainedQrCode: '',
          qrExplanation: { de: '', en: '', zh: '' },
          externalLink: '',
          externalLinkLabel: { de: '', en: '', zh: '' },
          isActive: true,
          order: 0,
        },
        undefined,
        actorId
      )
    ).rejects.toMatchObject({
      code: 'ALTERNATE_DEVELOPMENT_DATABASE_PUBLIC_UPLOADS_UNAVAILABLE',
    });
    expect(files.stageAndPromote).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });

  it('refuses Public Document mutation before file or database work', async () => {
    const files = { stageAndPromote: vi.fn() };
    const find = vi.spyOn(PublicDocument, 'find');
    const service = new PublicDocumentService(
      files as never,
      alternateDatabaseGuard
    );

    await expect(
      service.create(
        {
          displayName: { de: 'Satzung', en: '', zh: '' },
          documentDate: '2026-09-09',
          isVisible: true,
        },
        undefined,
        actorId
      )
    ).rejects.toMatchObject({
      code: 'ALTERNATE_DEVELOPMENT_DATABASE_PUBLIC_UPLOADS_UNAVAILABLE',
    });
    expect(files.stageAndPromote).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });
});
