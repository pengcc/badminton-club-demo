import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Activity } from '../../models/Activity';
import { ActivityOwnedFileStore } from '../../services/activityOwnedFileStore';
import { ActivityService } from '../../services/activityService';

const roots: string[] = [];
const userId = '507f1f77bcf86cd799439011';
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const values = {
  translations: {
    de: { name: 'Deutsch', description: '' },
    en: { name: '', description: '' },
    zh: { name: '', description: '' },
  },
  retainedImages: [],
  videoLink: '',
  videoDescription: { de: '', en: '', zh: '' },
  isVisible: true,
  order: 0,
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe('ActivityService', () => {
  it('compensates promoted files when Activity persistence fails', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'club-wp3-service-'));
    roots.push(root);
    const service = new ActivityService(new ActivityOwnedFileStore(root));
    vi.spyOn(Activity.prototype, 'save').mockRejectedValueOnce(
      new Error('persistence failed')
    );

    await expect(
      service.create(
        values,
        [{ buffer: png, mimetype: 'image/png', size: png.length }],
        userId
      )
    ).rejects.toThrow('persistence failed');

    const ownerDirectories = await readdir(path.join(root, 'activities'));
    expect(ownerDirectories).toHaveLength(1);
    expect(
      await readdir(path.join(root, 'activities', ownerDirectories[0]))
    ).toEqual([]);
  });

  it('compensates a replacement image when the Activity update fails', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'club-wp3-service-'));
    roots.push(root);
    const service = new ActivityService(new ActivityOwnedFileStore(root));
    const activityId = '507f1f77bcf86cd799439012';
    const activity = {
      _id: activityId,
      id: activityId,
      translations: values.translations,
      images: [],
      videoLink: '',
      videoDescription: values.videoDescription,
      isVisible: true,
      order: 0,
      updatedBy: userId,
      save: vi.fn().mockRejectedValue(new Error('update failed')),
    };
    vi.spyOn(Activity, 'findById').mockResolvedValueOnce(activity as never);

    await expect(
      service.update(
        activityId,
        values,
        [{ buffer: png, mimetype: 'image/png', size: png.length }],
        userId
      )
    ).rejects.toThrow('update failed');

    expect(await readdir(path.join(root, 'activities', activityId))).toEqual(
      []
    );
  });

  it('reports a committed update when previous media cleanup fails', async () => {
    const activityId = '507f1f77bcf86cd799439012';
    const files = {
      assertCleanupOwnership: vi.fn(),
      stageAndPromote: vi.fn().mockResolvedValue([]),
      removeOwned: vi.fn().mockRejectedValue(new Error('disk unavailable')),
    };
    const activity = {
      _id: activityId,
      id: activityId,
      translations: values.translations,
      images: [`/uploads/activities/${activityId}/old.png`],
      videoLink: '',
      videoDescription: values.videoDescription,
      isVisible: true,
      order: 0,
      updatedBy: userId,
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(Activity, 'findById').mockResolvedValueOnce(activity as never);
    const service = new ActivityService(files as never);

    const outcome = await service.update(activityId, values, [], userId);

    expect(activity.save).toHaveBeenCalledTimes(1);
    expect(files.removeOwned).toHaveBeenCalledTimes(1);
    expect(outcome.activity).toBe(activity);
    expect(outcome.mediaCleanupWarning).toEqual({
      code: 'ACTIVITY_MEDIA_CLEANUP_FAILED',
      message: 'Activity saved; previous media cleanup failed',
    });
  });

  it('reports a committed deletion when media cleanup fails', async () => {
    const activityId = '507f1f77bcf86cd799439012';
    const files = {
      assertCleanupOwnership: vi.fn(),
      removeOwned: vi.fn().mockRejectedValue(new Error('disk unavailable')),
    };
    const activity = {
      _id: activityId,
      id: activityId,
      images: [`/uploads/activities/${activityId}/old.png`],
    };
    vi.spyOn(Activity, 'findById').mockResolvedValueOnce(activity as never);
    const deletion = vi
      .spyOn(Activity, 'deleteOne')
      .mockResolvedValueOnce({ deletedCount: 1 } as never);
    const service = new ActivityService(files as never);

    const outcome = await service.delete(activityId);

    expect(deletion).toHaveBeenCalledTimes(1);
    expect(files.removeOwned).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({
      deleted: true,
      mediaCleanupWarning: {
        code: 'ACTIVITY_MEDIA_CLEANUP_FAILED',
        message: 'Activity deleted; media cleanup failed',
      },
    });
  });
});
