import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ActivityOwnedFileStore } from '../../services/activityOwnedFileStore';

const activityId = '507f1f77bcf86cd799439011';
const temporaryRoots: string[] = [];
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

async function temporaryStore() {
  const root = await mkdtemp(path.join(tmpdir(), 'club-wp3-files-'));
  temporaryRoots.push(root);
  return { root, store: new ActivityOwnedFileStore(root) };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe('ActivityOwnedFileStore', () => {
  it('stages and promotes a signature-verified image into its owner namespace', async () => {
    const { root, store } = await temporaryStore();
    const [url] = await store.stageAndPromote(activityId, [
      { buffer: png, mimetype: 'image/png', size: png.length },
    ]);

    expect(url).toMatch(
      /^\/uploads\/activities\/507f1f77bcf86cd799439011\/[a-f\d-]+\.png$/
    );
    expect(
      await readFile(path.join(root, url.replace('/uploads/', '')))
    ).toEqual(png);
  });

  it('rejects MIME spoofing and leaves no promoted file', async () => {
    const { root, store } = await temporaryStore();
    await expect(
      store.stageAndPromote(activityId, [
        { buffer: png, mimetype: 'image/jpeg', size: png.length },
      ])
    ).rejects.toMatchObject({ code: 'INVALID_ACTIVITY_IMAGE_SIGNATURE' });

    await expect(
      readdir(path.join(root, 'activities', activityId))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('deletes only exact owner paths and preserves legacy references', async () => {
    const { root, store } = await temporaryStore();
    const [ownedUrl] = await store.stageAndPromote(activityId, [
      { buffer: png, mimetype: 'image/png', size: png.length },
    ]);
    const legacyPath = path.join(root, 'legacy.png');
    await writeFile(legacyPath, png);

    await store.removeOwned(activityId, [ownedUrl, '/uploads/legacy.png']);

    await expect(
      readFile(path.join(root, ownedUrl.replace('/uploads/', '')))
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(legacyPath)).toEqual(png);
  });

  it('stops cleanup for traversal or another Activity owner', async () => {
    const { store } = await temporaryStore();
    expect(() =>
      store.assertCleanupOwnership(activityId, [
        '/uploads/activities/507f1f77bcf86cd799439012/image.png',
      ])
    ).toThrow('ownership could not be verified');
    expect(() =>
      store.assertCleanupOwnership(activityId, [
        `/uploads/activities/${activityId}/../image.png`,
      ])
    ).toThrow('ownership could not be verified');
  });
});
