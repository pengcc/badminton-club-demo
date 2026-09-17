import { OwnedFileStore, type OwnedFileUpload } from './ownedFileStore';

const QR_SIGNATURES = [
  {
    mimeType: 'image/jpeg',
    extension: 'jpg',
    matches: (bytes: Buffer) =>
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    extension: 'png',
    matches: (bytes: Buffer) =>
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
] as const;

export type ContactQrUpload = OwnedFileUpload & { originalname: string };

export class ContactQrOwnedFileStore extends OwnedFileStore {
  constructor(uploadsRoot: string) {
    super(uploadsRoot, {
      namespace: 'contact-qr',
      maxBytes: 2 * 1024 * 1024,
      signatures: QR_SIGNATURES,
      requireMatchingMimeType: false,
      invalidSize: {
        message: 'A Contact QR image must be no larger than 2 MB',
        code: 'INVALID_CONTACT_QR_SIZE',
      },
      invalidSignature: {
        message: 'Contact QR content must match its PNG or JPEG type',
        code: 'INVALID_CONTACT_QR_SIGNATURE',
      },
      invalidOwner: {
        message: 'Invalid Contact QR owner',
        code: 'INVALID_CONTACT_QR_OWNER',
      },
      invalidPath: {
        message: 'Contact QR path is outside its owner directory',
        code: 'INVALID_CONTACT_QR_PATH',
      },
      ownershipUnverified: {
        message:
          'Contact QR ownership could not be verified; cleanup was stopped',
        code: 'CONTACT_QR_OWNERSHIP_UNVERIFIED',
      },
    });
  }
}
