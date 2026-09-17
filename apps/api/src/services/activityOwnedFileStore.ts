import { OwnedFileStore, type OwnedFileUpload } from './ownedFileStore';

const IMAGE_SIGNATURES = [
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
  {
    mimeType: 'image/gif',
    extension: 'gif',
    matches: (bytes: Buffer) => {
      const header = bytes.subarray(0, 6).toString('ascii');
      return header === 'GIF87a' || header === 'GIF89a';
    },
  },
  {
    mimeType: 'image/webp',
    extension: 'webp',
    matches: (bytes: Buffer) =>
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP',
  },
] as const;

export type ActivityImageUpload = OwnedFileUpload;

export class ActivityOwnedFileStore extends OwnedFileStore {
  constructor(uploadsRoot: string) {
    super(uploadsRoot, {
      namespace: 'activities',
      maxBytes: 5 * 1024 * 1024,
      signatures: IMAGE_SIGNATURES,
      invalidSize: {
        message: 'Each Activity image must be no larger than 5 MB',
        code: 'INVALID_ACTIVITY_IMAGE_SIZE',
      },
      invalidSignature: {
        message:
          'Activity image content does not match an allowed JPEG, PNG, GIF, or WebP type',
        code: 'INVALID_ACTIVITY_IMAGE_SIGNATURE',
      },
      invalidOwner: {
        message: 'Invalid Activity file owner',
        code: 'INVALID_ACTIVITY_FILE_OWNER',
      },
      invalidPath: {
        message: 'Activity file path is outside its owner directory',
        code: 'INVALID_ACTIVITY_FILE_PATH',
      },
      ownershipUnverified: {
        message:
          'Activity file ownership could not be verified; cleanup was stopped',
        code: 'ACTIVITY_FILE_OWNERSHIP_UNVERIFIED',
      },
    });
  }
}
