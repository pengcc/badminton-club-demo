import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MembershipStudentProofStore } from '../../services/membershipStudentProofStore';

const ownerId = '507f1f77bcf86cd799439011';
let root = '';
let store: MembershipStudentProofStore;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'membership-proof-store-'));
  store = new MembershipStudentProofStore(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('private Membership Application student proof store', () => {
  it('validates and allocates opaque IDs before writing persistent bytes', async () => {
    const buffer = Buffer.from('%PDF-1.4\n%%EOF');
    const [prepared] = store.prepareUploads([
      {
        buffer,
        mimetype: 'application/pdf',
        size: buffer.length,
        originalname: '../private.pdf',
      },
    ]);
    expect(prepared.id).toMatch(/^[a-f\d-]+\.pdf$/i);
    expect(prepared.originalName).toBe('private.pdf');
    expect(await readdir(root)).toEqual([]);
    await store.promotePrepared(ownerId, [prepared]);
    expect(await store.readOwned(ownerId, prepared.id)).toEqual(buffer);
  });

  it.each([
    ['application/pdf', Buffer.from('%PDF-1.4\n%%EOF'), 'pdf'],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]), 'jpg'],
    [
      'image/png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      'png',
    ],
  ])('accepts verified %s bytes without creating a public URL', async (mimetype, buffer, extension) => {
    const [proof] = await store.stageAndPromote(ownerId, [
      {
        buffer,
        mimetype,
        size: buffer.length,
        originalname: `../private.${extension}`,
      },
    ]);
    expect(proof.id).toMatch(new RegExp(`\\.${extension}$`));
    expect(proof.originalName).toBe(`private.${extension}`);
    expect(proof.id).not.toContain('/uploads');
    expect(await store.readOwned(ownerId, proof.id)).toEqual(buffer);
  });

  it('rejects MIME/signature mismatches, traversal, oversize declarations, and more than two files', async () => {
    const pdf = Buffer.from('%PDF-1.4\n%%EOF');
    await expect(
      store.stageAndPromote(ownerId, [
        {
          buffer: pdf,
          mimetype: 'image/png',
          size: pdf.length,
          originalname: 'x.png',
        },
      ])
    ).rejects.toMatchObject({ code: 'INVALID_PROOF_TYPE' });
    await expect(
      store.stageAndPromote(ownerId, [
        {
          buffer: pdf,
          mimetype: 'application/pdf',
          size: 1,
          originalname: 'x.pdf',
        },
      ])
    ).rejects.toMatchObject({ code: 'INVALID_PROOF_SIZE' });
    await expect(
      store.readOwned(ownerId, '../secret.pdf')
    ).rejects.toMatchObject({ code: 'INVALID_PROOF_ID' });
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    oversized.write('%PDF-');
    await expect(
      store.stageAndPromote(ownerId, [
        {
          buffer: oversized,
          mimetype: 'application/pdf',
          size: oversized.length,
          originalname: 'x.pdf',
        },
      ])
    ).rejects.toMatchObject({ code: 'INVALID_PROOF_SIZE' });
    await expect(
      store.stageAndPromote(
        ownerId,
        Array.from({ length: 3 }, (_, index) => ({
          buffer: pdf,
          mimetype: 'application/pdf',
          size: pdf.length,
          originalname: `${index}.pdf`,
        }))
      )
    ).rejects.toMatchObject({ code: 'PROOF_LIMIT_EXCEEDED' });
  });

  it('contains ownership, cleans failed staging, and treats missing-file cleanup as idempotent', async () => {
    const pdf = Buffer.from('%PDF-1.4\n%%EOF');
    const [proof] = await store.stageAndPromote(ownerId, [
      {
        buffer: pdf,
        mimetype: 'application/pdf',
        size: pdf.length,
        originalname: 'owned.pdf',
      },
    ]);
    await expect(
      store.readOwned('507f1f77bcf86cd799439012', proof.id)
    ).rejects.toMatchObject({ statusCode: 404 });
    await store.removeOwned(ownerId, [proof.id]);
    await store.removeOwned(ownerId, [proof.id]);

    await expect(
      store.stageAndPromote(ownerId, [
        {
          buffer: pdf,
          mimetype: 'application/pdf',
          size: pdf.length,
          originalname: 'valid.pdf',
        },
        {
          buffer: Buffer.from('not-an-image'),
          mimetype: 'image/png',
          size: 12,
          originalname: 'invalid.png',
        },
      ])
    ).rejects.toMatchObject({ code: 'INVALID_PROOF_TYPE' });
    expect(
      (await readdir(root, { recursive: true })).filter((entry) =>
        /\.(pdf|jpg|png)$/.test(entry)
      )
    ).toEqual([]);
  });
});
