import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../utils/errors';

export const MEMBERSHIP_STUDENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const MEMBERSHIP_STUDENT_PROOF_MAX_FILES = 2;

export interface MembershipStudentProofUpload {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

export interface PreparedMembershipStudentProof {
  buffer: Buffer;
  id: string;
  originalName: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  size: number;
  createdAt: Date;
}

const SIGNATURES = [
  {
    mimeType: 'application/pdf' as const,
    extension: 'pdf',
    matches: (bytes: Buffer) =>
      bytes.subarray(0, 5).toString('ascii') === '%PDF-',
  },
  {
    mimeType: 'image/jpeg' as const,
    extension: 'jpg',
    matches: (bytes: Buffer) =>
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff,
  },
  {
    mimeType: 'image/png' as const,
    extension: 'png',
    matches: (bytes: Buffer) =>
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
] as const;

function assertOwner(ownerId: string) {
  if (!/^[a-f\d]{24}$/i.test(ownerId)) {
    throw new AppError('Invalid proof owner', 400, 'INVALID_PROOF_OWNER');
  }
}

export class MembershipStudentProofStore {
  private readonly ownerRoot: string;
  private readonly stagingRoot: string;

  constructor(privateRoot: string) {
    this.ownerRoot = path.resolve(privateRoot, 'membership-student-proof');
    this.stagingRoot = path.resolve(
      privateRoot,
      '.staging',
      'membership-student-proof'
    );
  }

  private ownedPath(ownerId: string, fileId: string): string {
    assertOwner(ownerId);
    if (!/^[a-f\d-]+\.(pdf|jpg|png)$/i.test(fileId)) {
      throw new AppError('Invalid proof identifier', 400, 'INVALID_PROOF_ID');
    }
    const ownerDirectory = path.resolve(this.ownerRoot, ownerId);
    const candidate = path.resolve(ownerDirectory, fileId);
    const relative = path.relative(ownerDirectory, candidate);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new AppError('Invalid proof path', 400, 'INVALID_PROOF_PATH');
    }
    return candidate;
  }

  private stagedPath(ownerId: string, fileId: string): string {
    assertOwner(ownerId);
    if (!/^[a-f\d-]+\.(pdf|jpg|png)$/i.test(fileId)) {
      throw new AppError('Invalid proof identifier', 400, 'INVALID_PROOF_ID');
    }
    const ownerDirectory = path.resolve(this.stagingRoot, ownerId);
    const candidate = path.resolve(ownerDirectory, fileId);
    const relative = path.relative(ownerDirectory, candidate);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new AppError('Invalid proof path', 400, 'INVALID_PROOF_PATH');
    }
    return candidate;
  }

  private detect(file: MembershipStudentProofUpload) {
    if (
      file.size <= 0 ||
      file.size > MEMBERSHIP_STUDENT_PROOF_MAX_BYTES ||
      file.buffer.length !== file.size
    ) {
      throw new AppError(
        'Student proof must be no larger than 10 MB',
        400,
        'INVALID_PROOF_SIZE'
      );
    }
    const signature = SIGNATURES.find((candidate) =>
      candidate.matches(file.buffer)
    );
    if (!signature || signature.mimeType !== file.mimetype) {
      throw new AppError(
        'Student proof content must match PDF, JPEG, or PNG',
        400,
        'INVALID_PROOF_TYPE'
      );
    }
    return signature;
  }

  prepareUploads(
    files: MembershipStudentProofUpload[]
  ): PreparedMembershipStudentProof[] {
    if (files.length > MEMBERSHIP_STUDENT_PROOF_MAX_FILES) {
      throw new AppError(
        'At most two student proof files are allowed',
        400,
        'PROOF_LIMIT_EXCEEDED'
      );
    }
    return files.map((file) => {
      const signature = this.detect(file);
      return {
        buffer: file.buffer,
        id: `${randomUUID()}.${signature.extension}`,
        originalName:
          path.basename(file.originalname).slice(0, 180) ||
          `proof.${signature.extension}`,
        mimeType: signature.mimeType,
        size: file.size,
        createdAt: new Date(),
      };
    });
  }

  async promotePrepared(
    ownerId: string,
    files: PreparedMembershipStudentProof[]
  ) {
    assertOwner(ownerId);
    if (files.length === 0) return [];

    await mkdir(path.resolve(this.stagingRoot, ownerId), {
      recursive: true,
      mode: 0o700,
    });
    const staged: Array<{
      path: string;
      file: PreparedMembershipStudentProof;
    }> = [];
    const promoted: string[] = [];
    try {
      for (const file of files) {
        const stagedPath = this.stagedPath(ownerId, file.id);
        await writeFile(stagedPath, file.buffer, { flag: 'wx', mode: 0o600 });
        staged.push({ path: stagedPath, file });
        const bytes = await readFile(stagedPath);
        this.detect({
          ...file,
          mimetype: file.mimeType,
          buffer: bytes,
          size: bytes.length,
          originalname: file.originalName,
        });
      }

      const ownerDirectory = path.resolve(this.ownerRoot, ownerId);
      await mkdir(ownerDirectory, { recursive: true, mode: 0o700 });
      const results = [];
      for (const item of staged) {
        const destination = this.ownedPath(ownerId, item.file.id);
        await rename(item.path, destination);
        promoted.push(item.file.id);
        results.push({
          id: item.file.id,
          originalName: item.file.originalName,
          mimeType: item.file.mimeType,
          size: item.file.size,
          createdAt: item.file.createdAt,
        });
      }
      return results;
    } catch (error) {
      await Promise.all(
        promoted.map((id) =>
          unlink(this.ownedPath(ownerId, id)).catch(() => undefined)
        )
      );
      throw error;
    } finally {
      await Promise.all(
        staged.map((item) =>
          unlink(item.path).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          })
        )
      );
    }
  }

  async stageAndPromote(
    ownerId: string,
    files: MembershipStudentProofUpload[]
  ) {
    return this.promotePrepared(ownerId, this.prepareUploads(files));
  }

  async readOwned(ownerId: string, fileId: string): Promise<Buffer> {
    try {
      return await readFile(this.ownedPath(ownerId, fileId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw AppError.notFound('Student proof not found');
      }
      throw error;
    }
  }

  async removeOwned(ownerId: string, fileIds: string[]): Promise<void> {
    await Promise.all(
      fileIds
        .flatMap((id) => [
          this.ownedPath(ownerId, id),
          this.stagedPath(ownerId, id),
        ])
        .map((candidate) =>
          unlink(candidate).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          })
        )
    );
  }

  async resetForTests(): Promise<void> {
    await rm(this.ownerRoot, { recursive: true, force: true });
    await rm(this.stagingRoot, { recursive: true, force: true });
  }
}
