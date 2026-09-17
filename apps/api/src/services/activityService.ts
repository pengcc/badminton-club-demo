import { Types } from 'mongoose';
import type { ActivityMutationValues } from '@club/shared-types/api/activity';
import { Activity } from '../models/Activity';
import { Settings } from '../models/Settings';
import { AppError } from '../utils/errors';
import {
  ActivityOwnedFileStore,
  type ActivityImageUpload,
} from './activityOwnedFileStore';
import { SettingsService } from './settingsService';
import { config } from '../config';
import { assertPublicUploadsMutationAllowed } from './publicUploadsMutationPolicy';

const defaultFileStore = new ActivityOwnedFileStore(config.publicUploadsRoot);

function ensureRetainedImages(requested: string[], existing: string[]) {
  const existingSet = new Set(existing);
  if (requested.some((url) => !existingSet.has(url))) {
    throw new AppError(
      'An Activity can retain only images it already owns',
      400,
      'INVALID_RETAINED_ACTIVITY_IMAGE'
    );
  }
}

export interface ActivityMediaCleanupWarning {
  code: 'ACTIVITY_MEDIA_CLEANUP_FAILED';
  message: string;
}

export interface ActivityUpdateOutcome {
  activity: InstanceType<typeof Activity>;
  mediaCleanupWarning: ActivityMediaCleanupWarning | null;
}

export interface ActivityDeleteOutcome {
  deleted: true;
  mediaCleanupWarning: ActivityMediaCleanupWarning | null;
}

function cleanupWarning(message: string): ActivityMediaCleanupWarning {
  return { code: 'ACTIVITY_MEDIA_CLEANUP_FAILED', message };
}

export class ActivityService {
  constructor(
    private readonly files = defaultFileStore,
    private readonly assertMutationAllowed = assertPublicUploadsMutationAllowed
  ) {}

  async getAvailability(): Promise<{ enabled: boolean }> {
    const settings = await Settings.findOne()
      .select('activitiesEnabled')
      .lean();
    return { enabled: settings?.activitiesEnabled ?? false };
  }

  async updateAvailability(enabled: boolean, userId: string) {
    const settings = await SettingsService.getSettings();
    settings.activitiesEnabled = enabled;
    settings.updatedBy = userId as never;
    await settings.save();
    return { enabled: settings.activitiesEnabled ?? false };
  }

  async create(
    values: ActivityMutationValues,
    uploads: ActivityImageUpload[],
    userId: string
  ) {
    this.assertMutationAllowed();
    if (values.retainedImages.length > 0) {
      throw new AppError(
        'A new Activity cannot retain existing images',
        400,
        'INVALID_RETAINED_ACTIVITY_IMAGE'
      );
    }
    if (uploads.length > 10) {
      throw new AppError('Maximum 10 images allowed per Activity', 400);
    }

    const activityId = new Types.ObjectId();
    const images = await this.files.stageAndPromote(
      String(activityId),
      uploads
    );
    try {
      const activity = new Activity({
        _id: activityId,
        translations: values.translations,
        images,
        videoLink: values.videoLink,
        videoDescription: values.videoDescription,
        isVisible: values.isVisible,
        order: values.order,
        createdBy: userId,
        updatedBy: userId,
      });
      await activity.save();
      return activity;
    } catch (error) {
      await this.files.removeOwned(String(activityId), images);
      throw error;
    }
  }

  async update(
    activityId: string,
    values: ActivityMutationValues,
    uploads: ActivityImageUpload[],
    userId: string
  ): Promise<ActivityUpdateOutcome> {
    this.assertMutationAllowed();
    const activity = await Activity.findById(activityId);
    if (!activity) throw new AppError('Activity not found', 404);

    ensureRetainedImages(values.retainedImages, activity.images);
    const removedImages = activity.images.filter(
      (url) => !values.retainedImages.includes(url)
    );
    this.files.assertCleanupOwnership(activityId, removedImages);

    if (values.retainedImages.length + uploads.length > 10) {
      throw new AppError('Maximum 10 images allowed per Activity', 400);
    }

    const promoted = await this.files.stageAndPromote(activityId, uploads);
    try {
      activity.translations = values.translations;
      activity.images = [...values.retainedImages, ...promoted];
      activity.videoLink = values.videoLink;
      activity.videoDescription = values.videoDescription;
      activity.isVisible = values.isVisible;
      activity.order = values.order;
      activity.updatedBy = userId as never;
      await activity.save();
    } catch (error) {
      await this.files.removeOwned(activityId, promoted);
      throw error;
    }

    try {
      await this.files.removeOwned(activityId, removedImages);
      return { activity, mediaCleanupWarning: null };
    } catch {
      return {
        activity,
        mediaCleanupWarning: cleanupWarning(
          'Activity saved; previous media cleanup failed'
        ),
      };
    }
  }

  async toggle(activityId: string, userId: string) {
    const activity = await Activity.findById(activityId);
    if (!activity) throw new AppError('Activity not found', 404);
    activity.isVisible = !activity.isVisible;
    activity.updatedBy = userId as never;
    await activity.save();
    return activity;
  }

  async delete(activityId: string): Promise<ActivityDeleteOutcome> {
    this.assertMutationAllowed();
    const activity = await Activity.findById(activityId);
    if (!activity) throw new AppError('Activity not found', 404);
    this.files.assertCleanupOwnership(activityId, activity.images);
    await Activity.deleteOne({ _id: activity._id });
    try {
      await this.files.removeOwned(activityId, activity.images);
      return { deleted: true, mediaCleanupWarning: null };
    } catch {
      return {
        deleted: true,
        mediaCleanupWarning: cleanupWarning(
          'Activity deleted; media cleanup failed'
        ),
      };
    }
  }
}

export const activityService = new ActivityService();
