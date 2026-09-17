import { constants } from 'node:fs';
import { access, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

async function resolveThroughNearestExistingParent(candidate: string): Promise<{
  effectivePath: string;
  existingPath: string;
}> {
  const missingSegments: string[] = [];
  let current = path.resolve(candidate);

  while (true) {
    try {
      const existingPath = await realpath(current);
      return {
        effectivePath: path.join(existingPath, ...missingSegments),
        existingPath,
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR' && code !== 'EACCES') {
        throw error;
      }
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missingSegments.unshift(path.basename(current));
      current = parent;
    }
  }
}

function pathsOverlap(left: string, right: string): boolean {
  const relative = path.relative(left, right);
  return (
    !relative || (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

export async function inspectStorageIsolation(
  publicRoots: string[],
  privateRoot: string
): Promise<boolean> {
  const privateStorage = await resolveThroughNearestExistingParent(privateRoot);
  for (const publicRoot of publicRoots) {
    const publicStorage = await resolveThroughNearestExistingParent(publicRoot);
    if (
      pathsOverlap(publicStorage.effectivePath, privateStorage.effectivePath) ||
      pathsOverlap(privateStorage.effectivePath, publicStorage.effectivePath)
    ) {
      return false;
    }
  }
  return true;
}

export async function inspectFileAccessibility(roots: string[]): Promise<{
  accessible: boolean;
  checkedRootCount: number;
}> {
  const resolvedRoots = await Promise.all(
    roots.map((root) => resolveThroughNearestExistingParent(root))
  );
  const uniqueExistingRoots = [
    ...new Set(resolvedRoots.map(({ existingPath }) => existingPath)),
  ];

  try {
    await Promise.all(
      uniqueExistingRoots.map(async (root) => {
        const rootStat = await stat(root);
        if (!rootStat.isDirectory())
          throw new Error('Storage root is not a directory');
        await access(root, constants.R_OK | constants.W_OK | constants.X_OK);
      })
    );
    return { accessible: true, checkedRootCount: uniqueExistingRoots.length };
  } catch {
    return { accessible: false, checkedRootCount: uniqueExistingRoots.length };
  }
}
