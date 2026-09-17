import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('@app/lib/api/client', () => ({ default: client }));

import {
  createActivity,
  deleteActivity,
  getActivityAvailability,
  updateActivityAvailability,
  updateActivity,
} from '@app/lib/api/activityApi';

const activity = {
  translations: {
    de: { name: 'Sommerfest', description: '' },
    en: { name: '', description: '' },
    zh: { name: '', description: '' },
  },
  retainedImages: ['/uploads/activities/id/existing.png'],
  newImages: [new File(['image'], 'new.png', { type: 'image/png' })],
  videoLink: '',
  videoDescription: { de: '', en: '', zh: '' },
  isVisible: true,
  order: 0,
};

describe('Activity API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.post.mockResolvedValue({ data: { data: { id: 'activity' } } });
    client.get.mockResolvedValue({ data: { data: { enabled: false } } });
    client.put.mockResolvedValue({
      data: {
        data: {
          activity: { id: 'activity' },
          mediaCleanupWarning: {
            code: 'ACTIVITY_MEDIA_CLEANUP_FAILED',
            message: 'Activity saved; previous media cleanup failed',
          },
        },
      },
    });
    client.delete.mockResolvedValue({
      data: {
        data: { deleted: true, mediaCleanupWarning: null },
      },
    });
  });

  it('reads and updates the Activities-owned availability projection', async () => {
    client.put.mockResolvedValueOnce({ data: { data: { enabled: true } } });

    await expect(getActivityAvailability()).resolves.toEqual({
      enabled: false,
    });
    await expect(updateActivityAvailability(true)).resolves.toEqual({
      enabled: true,
    });
    expect(client.get).toHaveBeenCalledWith('/activities/availability');
    expect(client.put).toHaveBeenCalledWith('/activities/availability', {
      enabled: true,
    });
  });

  it('sends create and update as owner-scoped multipart commands', async () => {
    await createActivity(activity);
    await updateActivity('activity', activity);

    const createBody = client.post.mock.calls[0][1] as FormData;
    const updateBody = client.put.mock.calls[0][1] as FormData;
    expect(client.post).toHaveBeenCalledWith(
      '/activities',
      expect.any(FormData),
      { headers: { 'Content-Type': undefined } }
    );
    expect(client.put).toHaveBeenCalledWith(
      '/activities/activity',
      expect.any(FormData),
      { headers: { 'Content-Type': undefined } }
    );
    expect(createBody.getAll('images')).toEqual(activity.newImages);
    expect(updateBody.getAll('images')).toEqual(activity.newImages);
    const { newImages: _newImages, ...persistedActivity } = activity;
    expect(JSON.parse(String(createBody.get('payload')))).toEqual({
      activity: persistedActivity,
    });
  });

  it('preserves committed update and delete outcomes from the Activity owner', async () => {
    await expect(updateActivity('activity', activity)).resolves.toMatchObject({
      activity: { id: 'activity' },
      mediaCleanupWarning: {
        code: 'ACTIVITY_MEDIA_CLEANUP_FAILED',
      },
    });
    await expect(deleteActivity('activity')).resolves.toEqual({
      deleted: true,
      mediaCleanupWarning: null,
    });
    expect(client.delete).toHaveBeenCalledWith('/activities/activity');
  });
});
