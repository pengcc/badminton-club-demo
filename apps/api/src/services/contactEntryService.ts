import { Types } from 'mongoose';
import type { ContactEntryValues } from '@club/shared-types/api/contact';
import { ContactEntry } from '../models/ContactEntry';
import { AppError } from '../utils/errors';
import {
  ContactQrOwnedFileStore,
  type ContactQrUpload,
} from './contactQrOwnedFileStore';
import { config } from '../config';
import { assertPublicUploadsMutationAllowed } from './publicUploadsMutationPolicy';

const defaultFiles = new ContactQrOwnedFileStore(config.publicUploadsRoot);

export interface ContactQrCleanupWarning {
  code: 'CONTACT_QR_CLEANUP_FAILED';
  message: string;
}

function warning(message: string): ContactQrCleanupWarning {
  return { code: 'CONTACT_QR_CLEANUP_FAILED', message };
}

function assertRetainedQr(requested: string, existing: string) {
  if (requested && requested !== existing) {
    throw new AppError(
      'A Contact entry can retain only the QR image it already owns',
      400,
      'INVALID_RETAINED_CONTACT_QR'
    );
  }
}

export class ContactEntryService {
  constructor(
    private readonly files = defaultFiles,
    private readonly assertMutationAllowed = assertPublicUploadsMutationAllowed
  ) {}

  private async stageQr(ownerId: string, upload: ContactQrUpload) {
    try {
      return await this.files.stageAndPromote(ownerId, [upload]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        'The Contact QR image could not be uploaded',
        500,
        'INVALID_CONTACT_QR_UPLOAD'
      );
    }
  }

  async isActive(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    return Boolean(await ContactEntry.exists({ _id: id, isActive: true }));
  }

  async create(
    values: ContactEntryValues,
    upload: ContactQrUpload | undefined,
    userId: string
  ) {
    this.assertMutationAllowed();
    if ((await ContactEntry.countDocuments({})) >= 4) {
      throw new AppError(
        'Contact entries are limited to four',
        409,
        'CONTACT_ENTRY_LIMIT_REACHED'
      );
    }
    if (values.retainedQrCode) {
      throw new AppError(
        'A new Contact entry cannot retain an existing QR image',
        400,
        'INVALID_RETAINED_CONTACT_QR'
      );
    }
    const id = new Types.ObjectId();
    const [qrCode = ''] = upload ? await this.stageQr(String(id), upload) : [];
    try {
      return await ContactEntry.create({
        _id: id,
        ...values,
        qrCode,
        qrCodeOriginalFilename: upload?.originalname ?? '',
        createdBy: userId,
        updatedBy: userId,
      });
    } catch (error) {
      if (qrCode) await this.files.removeOwned(String(id), [qrCode]);
      throw error;
    }
  }

  async update(
    id: string,
    values: ContactEntryValues,
    upload: ContactQrUpload | undefined,
    userId: string
  ) {
    this.assertMutationAllowed();
    const entry = await ContactEntry.findById(id);
    if (!entry) throw new AppError('Contact entry not found', 404);
    assertRetainedQr(values.retainedQrCode, entry.qrCode);

    const previousQr = entry.qrCode;
    const removedQr =
      previousQr && (!values.retainedQrCode || upload) ? [previousQr] : [];
    this.files.assertCleanupOwnership(id, removedQr);
    const [promotedQr = ''] = upload ? await this.stageQr(id, upload) : [];

    try {
      entry.category = values.category;
      entry.title = values.title;
      entry.description = values.description;
      entry.email = values.email;
      entry.qrCode = promotedQr || values.retainedQrCode;
      entry.qrCodeOriginalFilename = promotedQr
        ? (upload?.originalname ?? '')
        : values.retainedQrCode
          ? entry.qrCodeOriginalFilename
          : '';
      entry.qrExplanation = values.qrExplanation;
      entry.externalLink = values.externalLink;
      entry.externalLinkLabel = values.externalLinkLabel;
      entry.isActive = values.isActive;
      entry.order = values.order;
      entry.updatedBy = userId as never;
      await entry.save();
    } catch (error) {
      if (promotedQr) await this.files.removeOwned(id, [promotedQr]);
      throw error;
    }

    try {
      await this.files.removeOwned(id, removedQr);
      return { entry, mediaCleanupWarning: null };
    } catch {
      return {
        entry,
        mediaCleanupWarning: warning(
          'Contact entry saved; previous QR cleanup failed'
        ),
      };
    }
  }

  async delete(id: string) {
    this.assertMutationAllowed();
    const entry = await ContactEntry.findById(id);
    if (!entry) throw new AppError('Contact entry not found', 404);
    const qrCodes = entry.qrCode ? [entry.qrCode] : [];
    this.files.assertCleanupOwnership(id, qrCodes);
    await ContactEntry.deleteOne({ _id: entry._id });
    try {
      await this.files.removeOwned(id, qrCodes);
      return { deleted: true as const, mediaCleanupWarning: null };
    } catch {
      return {
        deleted: true as const,
        mediaCleanupWarning: warning(
          'Contact entry deleted; QR cleanup failed'
        ),
      };
    }
  }
}

export const contactEntryService = new ContactEntryService();
