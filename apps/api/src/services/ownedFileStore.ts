import { randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../utils/errors';

export interface OwnedFileUpload {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface OwnedFileSignature {
  mimeType: string;
  extension: string;
  matches(bytes: Buffer): boolean;
}

interface OwnedFileStoreOptions {
  namespace: string;
  maxBytes: number;
  signatures: readonly OwnedFileSignature[];
  requireMatchingMimeType?: boolean;
  invalidSize: { message: string; code: string };
  invalidSignature: { message: string; code: string };
  invalidOwner: { message: string; code: string };
  invalidPath: { message: string; code: string };
  ownershipUnverified: { message: string; code: string };
}

function assertContained(
  root: string,
  candidate: string,
  failure: OwnedFileStoreOptions['invalidPath']
) {
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new AppError(failure.message, 400, failure.code);
  }
}

export class OwnedFileStore {
  private readonly ownerRoot: string;
  private readonly stagingRoot: string;
  private readonly urlPrefix: string;

  constructor(
    uploadsRoot: string,
    private readonly options: OwnedFileStoreOptions
  ) {
    this.ownerRoot = path.resolve(uploadsRoot, options.namespace);
    this.stagingRoot = path.resolve(uploadsRoot, '.staging', options.namespace);
    this.urlPrefix = `/uploads/${options.namespace}/`;
  }

  private assertOwnerId(ownerId: string) {
    if (!/^[a-f\d]{24}$/i.test(ownerId)) {
      throw new AppError(
        this.options.invalidOwner.message,
        400,
        this.options.invalidOwner.code
      );
    }
  }

  private ownedPath(ownerId: string, url: string): string | null {
    if (!url.startsWith(this.urlPrefix)) return null;
    const remainder = url.slice(this.urlPrefix.length);
    const separator = remainder.indexOf('/');
    if (separator < 1 || remainder.indexOf('/', separator + 1) !== -1) {
      return null;
    }
    const urlOwner = remainder.slice(0, separator);
    const filename = remainder.slice(separator + 1);
    const extension = filename
      .slice(filename.lastIndexOf('.') + 1)
      .toLowerCase();
    if (
      urlOwner !== ownerId ||
      !/^[a-f\d-]+\.[a-z0-9]+$/i.test(filename) ||
      !this.options.signatures.some(
        (signature) => signature.extension === extension
      )
    ) {
      return null;
    }
    const ownerDirectory = path.resolve(this.ownerRoot, ownerId);
    const candidate = path.resolve(ownerDirectory, filename);
    assertContained(ownerDirectory, candidate, this.options.invalidPath);
    return candidate;
  }

  assertCleanupOwnership(ownerId: string, urls: string[]) {
    this.assertOwnerId(ownerId);
    for (const url of urls) {
      if (!url.startsWith(this.urlPrefix)) continue;
      if (!this.ownedPath(ownerId, url)) {
        throw new AppError(
          this.options.ownershipUnverified.message,
          409,
          this.options.ownershipUnverified.code
        );
      }
    }
  }

  private detect(file: OwnedFileUpload): OwnedFileSignature {
    if (file.size <= 0 || file.size > this.options.maxBytes) {
      throw new AppError(
        this.options.invalidSize.message,
        400,
        this.options.invalidSize.code
      );
    }
    const signature = this.options.signatures.find((candidate) =>
      candidate.matches(file.buffer)
    );
    if (
      !signature ||
      (this.options.requireMatchingMimeType !== false &&
        signature.mimeType !== file.mimetype)
    ) {
      throw new AppError(
        this.options.invalidSignature.message,
        400,
        this.options.invalidSignature.code
      );
    }
    return signature;
  }

  async stageAndPromote(
    ownerId: string,
    files: OwnedFileUpload[]
  ): Promise<string[]> {
    this.assertOwnerId(ownerId);
    if (files.length === 0) return [];

    await mkdir(this.stagingRoot, { recursive: true });
    const stageDirectory = await mkdtemp(
      path.join(this.stagingRoot, `${ownerId}-`)
    );
    const promotedPaths: string[] = [];
    try {
      const staged: Array<{ stagedPath: string; extension: string }> = [];
      for (const file of files) {
        const stagedPath = path.join(stageDirectory, randomUUID());
        await writeFile(stagedPath, file.buffer, { flag: 'wx', mode: 0o600 });
        const bytes = await readFile(stagedPath);
        const signature = this.detect({
          ...file,
          buffer: bytes,
          size: bytes.length,
        });
        staged.push({ stagedPath, extension: signature.extension });
      }

      const ownerDirectory = path.resolve(this.ownerRoot, ownerId);
      await mkdir(ownerDirectory, { recursive: true });
      const urls: string[] = [];
      for (const file of staged) {
        const filename = `${randomUUID()}.${file.extension}`;
        const destination = path.resolve(ownerDirectory, filename);
        assertContained(ownerDirectory, destination, this.options.invalidPath);
        await rename(file.stagedPath, destination);
        promotedPaths.push(destination);
        urls.push(`${this.urlPrefix}${ownerId}/${filename}`);
      }
      return urls;
    } catch (error) {
      await Promise.all(
        promotedPaths.map((file) => unlink(file).catch(() => undefined))
      );
      throw error;
    } finally {
      await rm(stageDirectory, { recursive: true, force: true });
    }
  }

  async removeOwned(ownerId: string, urls: string[]): Promise<void> {
    this.assertCleanupOwnership(ownerId, urls);
    const paths = urls
      .map((url) => this.ownedPath(ownerId, url))
      .filter((file): file is string => file !== null);
    await Promise.all(
      paths.map((file) =>
        unlink(file).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error;
        })
      )
    );
  }

  async resetOwnedNamespaces(): Promise<void> {
    await rm(this.ownerRoot, { recursive: true, force: true });
    await rm(this.stagingRoot, { recursive: true, force: true });
  }
}
