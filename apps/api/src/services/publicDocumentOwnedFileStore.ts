import { OwnedFileStore, type OwnedFileUpload } from './ownedFileStore';

const PDF_SIGNATURES = [
  {
    mimeType: 'application/pdf',
    extension: 'pdf',
    matches: (bytes: Buffer) =>
      bytes.subarray(0, 5).toString('ascii') === '%PDF-',
  },
] as const;

export type PublicDocumentUpload = OwnedFileUpload;

export class PublicDocumentOwnedFileStore extends OwnedFileStore {
  constructor(uploadsRoot: string) {
    super(uploadsRoot, {
      namespace: 'public-documents',
      maxBytes: 10 * 1024 * 1024,
      signatures: PDF_SIGNATURES,
      invalidSize: {
        message: 'A Public Document PDF must be no larger than 10 MB',
        code: 'INVALID_PUBLIC_DOCUMENT_SIZE',
      },
      invalidSignature: {
        message: 'Public Document content must match its PDF type',
        code: 'INVALID_PUBLIC_DOCUMENT_SIGNATURE',
      },
      invalidOwner: {
        message: 'Invalid Public Document file owner',
        code: 'INVALID_PUBLIC_DOCUMENT_OWNER',
      },
      invalidPath: {
        message: 'Public Document path is outside its owner directory',
        code: 'INVALID_PUBLIC_DOCUMENT_PATH',
      },
      ownershipUnverified: {
        message:
          'Public Document ownership could not be verified; cleanup was stopped',
        code: 'PUBLIC_DOCUMENT_OWNERSHIP_UNVERIFIED',
      },
    });
  }
}
