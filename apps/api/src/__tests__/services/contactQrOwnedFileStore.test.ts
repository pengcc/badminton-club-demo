import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ContactQrOwnedFileStore } from '../../services/contactQrOwnedFileStore';

const ownerId = '507f1f77bcf86cd799439011';
const roots: string[] = [];
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

async function store() {
  const root = await mkdtemp(path.join(tmpdir(), 'club-wp4b-contact-qr-'));
  roots.push(root);
  return { root, files: new ContactQrOwnedFileStore(root) };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe('ContactQrOwnedFileStore', () => {
  it('promotes a signature-verified QR image under its Contact owner', async () => {
    const { root, files } = await store();
    const [url] = await files.stageAndPromote(ownerId, [
      { buffer: png, mimetype: 'image/png', size: png.length },
    ]);

    expect(url).toMatch(
      /^\/uploads\/contact-qr\/507f1f77bcf86cd799439011\/[a-f\d-]+\.png$/
    );
    expect(
      await readFile(path.join(root, url.replace('/uploads/', '')))
    ).toEqual(png);
  });

  it('promotes a signature-verified QR image when the browser MIME type is generic', async () => {
    const { files } = await store();
    await expect(
      files.stageAndPromote(ownerId, [
        { buffer: png, mimetype: 'application/octet-stream', size: png.length },
      ])
    ).resolves.toHaveLength(1);
  });

  it('rejects content without a permitted signature and compensates its staging directory', async () => {
    const { root, files } = await store();
    const invalidImage = Buffer.from('not an image');
    await expect(
      files.stageAndPromote(ownerId, [
        {
          buffer: invalidImage,
          mimetype: 'image/png',
          size: invalidImage.length,
        },
      ])
    ).rejects.toMatchObject({ code: 'INVALID_CONTACT_QR_SIGNATURE' });
    await expect(
      readdir(path.join(root, 'contact-qr', ownerId))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('stops cleanup for another owner or traversal path', async () => {
    const { files } = await store();
    expect(() =>
      files.assertCleanupOwnership(ownerId, [
        '/uploads/contact-qr/507f1f77bcf86cd799439012/file.png',
      ])
    ).toThrow('ownership could not be verified');
    expect(() =>
      files.assertCleanupOwnership(ownerId, [
        `/uploads/contact-qr/${ownerId}/../file.png`,
      ])
    ).toThrow('ownership could not be verified');
    expect(() =>
      files.assertCleanupOwnership(ownerId, [
        `/uploads/contact-qr/${ownerId}/file.svg`,
      ])
    ).toThrow('ownership could not be verified');
  });
});
