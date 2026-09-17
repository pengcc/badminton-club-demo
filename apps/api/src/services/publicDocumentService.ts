import type {
  PublicDocumentCreateValues,
  PublicDocumentUpdateValues,
} from '@club/shared-types/api/publicDocument';
import { Types } from 'mongoose';
import { PublicDocument } from '../models/PublicDocument';
import { AppError } from '../utils/errors';
import {
  PublicDocumentOwnedFileStore,
  type PublicDocumentUpload,
} from './publicDocumentOwnedFileStore';
import { config } from '../config';
import { assertPublicUploadsMutationAllowed } from './publicUploadsMutationPolicy';

const defaultFiles = new PublicDocumentOwnedFileStore(config.publicUploadsRoot);

export interface PublicDocumentCleanupWarning {
  code: 'PUBLIC_DOCUMENT_CLEANUP_FAILED';
  message: string;
}

function cleanupWarning(
  action: 'saved' | 'deleted'
): PublicDocumentCleanupWarning {
  return {
    code: 'PUBLIC_DOCUMENT_CLEANUP_FAILED',
    message: `Public Document ${action}; previous PDF cleanup failed`,
  };
}

function assertDocumentId(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) {
    throw new AppError(
      'Invalid Public Document ID',
      400,
      'INVALID_PUBLIC_DOCUMENT_ID'
    );
  }
}

async function orderedDocuments(filter: Record<string, unknown>) {
  return PublicDocument.find(filter).sort({
    order: 1,
    _id: 1,
  });
}

export class PublicDocumentService {
  constructor(
    private readonly files = defaultFiles,
    private readonly assertMutationAllowed = assertPublicUploadsMutationAllowed
  ) {}

  async listAdministration() {
    return orderedDocuments({});
  }

  async listPublic() {
    return orderedDocuments({ isVisible: true, fileUrl: { $ne: '' } });
  }

  async create(
    values: PublicDocumentCreateValues,
    upload: PublicDocumentUpload | undefined,
    userId: string
  ) {
    this.assertMutationAllowed();
    if (!upload) {
      throw new AppError(
        'A new Public Document requires a PDF',
        400,
        'PUBLIC_DOCUMENT_PDF_REQUIRED'
      );
    }
    const current = await this.listAdministration();
    const order =
      current.reduce(
        (highest, document) => Math.max(highest, document.order),
        -1
      ) + 1;
    const id = new Types.ObjectId();
    const [promoted] = await this.files.stageAndPromote(String(id), [upload]);
    const document = new PublicDocument({
      _id: id,
      ...values,
      order,
      fileUrl: promoted,
      createdBy: userId,
      updatedBy: userId,
    });
    try {
      await document.save();
      return { document, mediaCleanupWarning: null };
    } catch (error) {
      await this.files.removeOwned(String(id), [promoted]);
      throw error;
    }
  }

  async update(
    id: string,
    values: PublicDocumentUpdateValues,
    upload: PublicDocumentUpload | undefined,
    userId: string
  ) {
    this.assertMutationAllowed();
    assertDocumentId(id);
    const document = await PublicDocument.findById(id);
    if (!document) throw new AppError('Public Document not found', 404);
    if (values.retainedFile && values.retainedFile !== document.fileUrl) {
      throw new AppError(
        'A Public Document can retain only the PDF it already owns',
        400,
        'INVALID_RETAINED_PUBLIC_DOCUMENT'
      );
    }

    const previousFile = document.fileUrl;
    const removed =
      previousFile && (!values.retainedFile || upload) ? [previousFile] : [];
    this.files.assertCleanupOwnership(document.id, removed);
    const [promoted = ''] = upload
      ? await this.files.stageAndPromote(document.id, [upload])
      : [];
    const nextFile = promoted || values.retainedFile;
    if (values.isVisible && !nextFile) {
      if (promoted) await this.files.removeOwned(document.id, [promoted]);
      throw new AppError(
        'A visible Public Document must have a valid PDF',
        400,
        'VISIBLE_PUBLIC_DOCUMENT_REQUIRES_FILE'
      );
    }

    try {
      document.displayName = values.displayName;
      document.documentDate = values.documentDate;
      document.fileUrl = nextFile;
      document.isVisible = values.isVisible;
      document.updatedBy = userId as never;
      await document.save();
    } catch (error) {
      if (promoted) await this.files.removeOwned(document.id, [promoted]);
      throw error;
    }

    try {
      await this.files.removeOwned(document.id, removed);
      return { document, mediaCleanupWarning: null };
    } catch {
      return { document, mediaCleanupWarning: cleanupWarning('saved') };
    }
  }

  async reorder(ids: string[], userId: string) {
    ids.forEach(assertDocumentId);
    if (new Set(ids).size !== ids.length) {
      throw new AppError(
        'Public Document order contains duplicate IDs',
        400,
        'INVALID_PUBLIC_DOCUMENT_ORDER'
      );
    }
    const current = await this.listAdministration();
    const currentIds = current.map((document) => document.id);
    if (
      ids.length !== currentIds.length ||
      ids.some((id) => !currentIds.includes(id))
    ) {
      throw new AppError(
        'Public Document collection changed; refetch and retry',
        409,
        'PUBLIC_DOCUMENT_ORDER_CONFLICT'
      );
    }

    const updatedBy = new Types.ObjectId(userId);
    await PublicDocument.bulkWrite(
      ids.map((id, order) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { order, updatedBy } },
        },
      }))
    );
    const confirmed = await this.listAdministration();
    if (
      confirmed.length !== ids.length ||
      confirmed.some((document, order) => document.id !== ids[order])
    ) {
      throw new AppError(
        'Public Document order could not be confirmed; refetch and retry',
        409,
        'PUBLIC_DOCUMENT_ORDER_UNCONFIRMED'
      );
    }
    return confirmed;
  }

  async delete(id: string) {
    this.assertMutationAllowed();
    assertDocumentId(id);
    const document = await PublicDocument.findById(id);
    if (!document) throw new AppError('Public Document not found', 404);
    const removed = document.fileUrl ? [document.fileUrl] : [];
    this.files.assertCleanupOwnership(document.id, removed);
    const result = await PublicDocument.deleteOne({
      _id: document._id,
      fileUrl: document.fileUrl,
    });
    if (result.deletedCount !== 1) {
      throw new AppError(
        'Public Document changed before deletion; refetch and retry',
        409,
        'PUBLIC_DOCUMENT_DELETE_CONFLICT'
      );
    }
    try {
      await this.files.removeOwned(document.id, removed);
      return { deleted: true as const, mediaCleanupWarning: null };
    } catch {
      return {
        deleted: true as const,
        mediaCleanupWarning: cleanupWarning('deleted'),
      };
    }
  }
}

export const publicDocumentService = new PublicDocumentService();
