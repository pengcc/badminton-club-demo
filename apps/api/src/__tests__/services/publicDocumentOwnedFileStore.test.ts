import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PublicDocumentOwnedFileStore } from '../../services/publicDocumentOwnedFileStore';

const ownerId = '507f1f77bcf86cd799439011';
const roots: string[] = [];
const pdf = Buffer.from('%PDF-1.7\nmock');

async function store() {
  const root = await mkdtemp(path.join(tmpdir(), 'club-wp5a-documents-'));
  roots.push(root);
  return { root, files: new PublicDocumentOwnedFileStore(root) };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe('PublicDocumentOwnedFileStore', () => {
  it('promotes only a signature-verified PDF under its exact owner', async () => {
    const { root, files } = await store();
    const [url] = await files.stageAndPromote(ownerId, [
      { buffer: pdf, mimetype: 'application/pdf', size: pdf.length },
    ]);
    expect(url).toMatch(
      /^\/uploads\/public-documents\/507f1f77bcf86cd799439011\/[a-f\d-]+\.pdf$/
    );
    expect(
      await readFile(path.join(root, url.replace('/uploads/', '')))
    ).toEqual(pdf);
  });

  it('rejects MIME spoofing and compensates staging', async () => {
    const { root, files } = await store();
    await expect(
      files.stageAndPromote(ownerId, [
        {
          buffer: Buffer.from('not a PDF'),
          mimetype: 'application/pdf',
          size: 9,
        },
      ])
    ).rejects.toMatchObject({ code: 'INVALID_PUBLIC_DOCUMENT_SIGNATURE' });
    await expect(
      readdir(path.join(root, 'public-documents', ownerId))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects cross-owner, traversal, and non-PDF cleanup references', async () => {
    const { files } = await store();
    for (const url of [
      '/uploads/public-documents/507f1f77bcf86cd799439012/file.pdf',
      `/uploads/public-documents/${ownerId}/../file.pdf`,
      `/uploads/public-documents/${ownerId}/file.exe`,
    ]) {
      expect(() => files.assertCleanupOwnership(ownerId, [url])).toThrow(
        'ownership could not be verified'
      );
    }
  });
});
