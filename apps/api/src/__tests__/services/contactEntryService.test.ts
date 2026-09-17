import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContactEntry } from '../../models/ContactEntry';
import { ContactEntryService } from '../../services/contactEntryService';

const actorId = '507f1f77bcf86cd799439011';
const upload = {
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
  mimetype: 'image/png',
  size: 9,
  originalname: 'club-wechat.png',
};
const values = {
  category: 'General inquiries',
  title: { de: 'Kontakt', en: '', zh: '联系' },
  description: { de: 'Schreib uns.', en: '', zh: '请联系我们。' },
  email: 'info@example.test',
  retainedQrCode: '',
  qrExplanation: { de: 'QR', en: '', zh: '' },
  externalLink: '',
  externalLinkLabel: { de: '', en: '', zh: '' },
  isActive: true,
  order: 1,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ContactEntryService QR storage errors', () => {
  it('classifies an unexpected staging failure as a retryable QR upload error', async () => {
    vi.spyOn(ContactEntry, 'countDocuments').mockResolvedValueOnce(0 as never);
    const create = vi.spyOn(ContactEntry, 'create');
    const files = {
      stageAndPromote: vi
        .fn()
        .mockRejectedValueOnce(new Error('disk unavailable')),
    };
    const service = new ContactEntryService(files as never);

    await expect(service.create(values, upload, actorId)).rejects.toMatchObject(
      {
        statusCode: 500,
        code: 'INVALID_CONTACT_QR_UPLOAD',
      }
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('does not reclassify a later Contact-entry persistence failure', async () => {
    vi.spyOn(ContactEntry, 'countDocuments').mockResolvedValueOnce(0 as never);
    vi.spyOn(ContactEntry, 'create').mockRejectedValueOnce(
      new Error('persistence unavailable') as never
    );
    const files = {
      stageAndPromote: vi
        .fn()
        .mockResolvedValueOnce(['/uploads/contact-qr/new.png']),
      removeOwned: vi.fn().mockResolvedValueOnce(undefined),
    };
    const service = new ContactEntryService(files as never);
    const attempt = service.create(values, upload, actorId);

    await expect(attempt).rejects.toThrow('persistence unavailable');
    await expect(attempt).rejects.not.toMatchObject({
      code: 'INVALID_CONTACT_QR_UPLOAD',
    });
    expect(files.removeOwned).toHaveBeenCalledOnce();
  });
});
