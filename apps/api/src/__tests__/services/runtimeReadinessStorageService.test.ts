import {
  chmod,
  mkdtemp,
  mkdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  inspectFileAccessibility,
  inspectStorageIsolation,
} from '../../services/runtimeReadinessStorageService';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true }))
  );
});

async function temporaryRoot() {
  const root = await mkdtemp(
    path.join(os.tmpdir(), 'runtime-readiness-storage-')
  );
  temporaryRoots.push(root);
  return root;
}

describe('runtime readiness storage inspection', () => {
  it('detects symlink-resolved public/private aliasing without writing probe files', async () => {
    const root = await temporaryRoot();
    const retainedRoot = path.join(root, 'retained');
    const publicRoot = path.join(root, 'public');
    await mkdir(retainedRoot);
    await symlink(retainedRoot, publicRoot);

    await expect(
      inspectStorageIsolation([publicRoot], path.join(retainedRoot, 'private'))
    ).resolves.toBe(false);
  });

  it('uses nearest existing parents for distinct missing roots and bounded access checks', async () => {
    const root = await temporaryRoot();
    const publicRoot = path.join(root, 'public', 'uploads');
    const privateRoot = path.join(root, 'private', 'proofs');

    await expect(
      inspectStorageIsolation([publicRoot], privateRoot)
    ).resolves.toBe(true);
    await expect(
      inspectFileAccessibility([publicRoot, privateRoot])
    ).resolves.toEqual({ accessible: true, checkedRootCount: 1 });
  });

  it('rejects a regular file used as a storage root or nearest existing ancestor', async () => {
    const root = await temporaryRoot();
    const fileRoot = path.join(root, 'not-a-directory');
    await writeFile(fileRoot, 'fixture');

    await expect(
      inspectFileAccessibility([fileRoot, path.join(fileRoot, 'uploads')])
    ).resolves.toEqual({ accessible: false, checkedRootCount: 1 });
  });

  it.skipIf(process.platform === 'win32')(
    'rejects an existing directory without traversal permission',
    async () => {
      const root = await temporaryRoot();
      const storageRoot = path.join(root, 'storage');
      await mkdir(storageRoot, { mode: 0o600 });

      try {
        await expect(
          inspectFileAccessibility([path.join(storageRoot, 'uploads')])
        ).resolves.toEqual({ accessible: false, checkedRootCount: 1 });
      } finally {
        await chmod(storageRoot, 0o700);
      }
    }
  );
});
