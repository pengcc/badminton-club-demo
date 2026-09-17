import type { Request, Router } from 'express';
import express from 'express';
import { Activity } from '../models/Activity';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authorizeCapability, protect } from '../middleware/auth';
import { receiveActivityImages } from '../middleware/activityImages';
import { validateRequest } from '../middleware/validation';
import { AppError } from '../utils/errors';
import { activityService } from '../services/activityService';
import {
  activityAvailabilityUpdateSchema,
  activityMutationSchema,
  getActivityCompleteness,
  resolveActivityText,
} from '@club/shared-types/api/activity';
import {
  administrationContentListQuerySchema,
  publicActivityListQuerySchema,
} from '@club/shared-types/api/contentList';
import type {
  AdministrationContentListQuery,
  PublicActivityListQuery,
} from '@club/shared-types/api/contentList';
import { Capability, Language } from '@club/shared-types/core/enums';
import {
  ACCOUNT_DISPLAY_PROJECTION,
  accountDisplayReference,
} from '../services/accountDisplayProjection';

const router: Router = express.Router();

router.get('/availability', async (_req, res) => {
  res.status(200).json({
    success: true,
    data: await activityService.getAvailability(),
  });
});

router.put(
  '/availability',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: activityAvailabilityUpdateSchema }),
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    res.status(200).json({
      success: true,
      data: await activityService.updateAvailability(
        authReq.body.enabled,
        authReq.user.id
      ),
    });
  }
);

const activityListItem = (
  activity: any,
  language: Language,
  administration = false
) => {
  const content = resolveActivityText(
    activity.translations,
    activity.videoDescription,
    language
  );

  return {
    id: String(activity._id),
    name: content.name,
    description: content.description,
    images: activity.images ?? [],
    videoLink: activity.videoLink ?? '',
    videoDescription: content.videoDescription,
    isVisible: activity.isVisible,
    order: activity.order,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
    updatedBy: accountDisplayReference(activity.updatedBy),
    ...(administration
      ? {
          completeness: getActivityCompleteness(
            activity.translations,
            activity.videoDescription
          ),
        }
      : {}),
  };
};

const activityAdministrationItem = (activity: any) => ({
  id: String(activity._id),
  translations: activity.translations,
  images: activity.images,
  videoLink: activity.videoLink,
  videoDescription: activity.videoDescription,
  isVisible: activity.isVisible,
  order: activity.order,
  createdAt: activity.createdAt,
  updatedAt: activity.updatedAt,
  createdBy: accountDisplayReference(activity.createdBy),
  updatedBy: accountDisplayReference(activity.updatedBy),
  completeness: getActivityCompleteness(
    activity.translations,
    activity.videoDescription
  ),
});

function parseActivityMutation(request: Request) {
  if (typeof request.body.payload !== 'string') {
    throw new AppError('Activity payload is required', 400);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(request.body.payload);
  } catch {
    throw new AppError('Activity payload must be valid JSON', 400);
  }
  const result = activityMutationSchema.safeParse(payload);
  if (!result.success) {
    throw new AppError(
      result.error.issues.map((issue) => issue.message).join(', '),
      400
    );
  }
  return result.data.activity;
}

/**
 * GET /api/activities
 * Get visible activities for the public projection
 * Supports pagination via `page` and `limit` query params
 */
router.get(
  '/',
  validateRequest({ query: publicActivityListQuerySchema }),
  async (_req, res) => {
    const { language, page, limit } = res.locals
      .validatedQuery as PublicActivityListQuery;
    const availability = await activityService.getAvailability();
    if (!availability.enabled) {
      return res.status(200).json({
        success: true,
        availability,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    const skip = (page - 1) * limit;

    const query = { isVisible: true };

    // Get total count for pagination
    const total = await Activity.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const activities = await Activity.find(query)
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', ACCOUNT_DISPLAY_PROJECTION)
      .populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    const transformedActivities = activities
      .map((activity) => activityListItem(activity, language as Language))
      .filter(Boolean);

    res.status(200).json({
      success: true,
      availability,
      data: transformedActivities,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  }
);

/**
 * GET /api/activities/admin
 * Get the complete activity management projection (admin only)
 */
router.get(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ query: administrationContentListQuerySchema }),
  async (_req, res) => {
    const { language } = res.locals
      .validatedQuery as AdministrationContentListQuery;
    const activities = await Activity.find({})
      .sort({ order: 1, createdAt: -1 })
      .populate('createdBy', ACCOUNT_DISPLAY_PROJECTION)
      .populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    res.status(200).json({
      success: true,
      data: activities
        .map((activity) =>
          activityListItem(activity, language as Language, true)
        )
        .filter(Boolean),
    });
  }
);

/**
 * GET /api/activities/:id
 * Get single activity with all translations (admin only)
 */
router.get(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (req, res) => {
    const activity = await Activity.findById(req.params.id)
      .populate('createdBy', ACCOUNT_DISPLAY_PROJECTION)
      .populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    res.status(200).json({
      success: true,
      data: activityAdministrationItem(activity),
    });
  }
);

/**
 * POST /api/activities
 * Create new activity (admin only)
 */
router.post(
  '/',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  receiveActivityImages,
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const values = parseActivityMutation(authReq);
    const files = (authReq.files ?? []) as Express.Multer.File[];
    const activity = await activityService.create(
      values,
      files,
      authReq.user.id
    );

    await activity.populate('createdBy', ACCOUNT_DISPLAY_PROJECTION);
    await activity.populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    res.status(201).json({
      success: true,
      data: activityAdministrationItem(activity),
    });
  }
);

/**
 * PUT /api/activities/:id
 * Update activity (admin only)
 */
router.put(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  receiveActivityImages,
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const values = parseActivityMutation(authReq);
    const files = (authReq.files ?? []) as Express.Multer.File[];
    const outcome = await activityService.update(
      authReq.params.id,
      values,
      files,
      authReq.user.id
    );
    const { activity } = outcome;
    await activity.populate('createdBy', ACCOUNT_DISPLAY_PROJECTION);
    await activity.populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    res.status(200).json({
      success: true,
      data: {
        activity: activityAdministrationItem(activity),
        mediaCleanupWarning: outcome.mediaCleanupWarning,
      },
    });
  }
);

/**
 * PATCH /api/activities/:id/toggle
 * Toggle activity visibility (admin only)
 */
router.patch(
  '/:id/toggle',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const activity = await activityService.toggle(
      authReq.params.id,
      authReq.user.id
    );

    res.status(200).json({
      success: true,
      data: {
        id: String(activity._id),
        isVisible: activity.isVisible,
      },
    });
  }
);

/**
 * DELETE /api/activities/:id
 * Delete activity (admin only)
 */
router.delete(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (req, res) => {
    const outcome = await activityService.delete(req.params.id as string);

    res.status(200).json({
      success: true,
      data: outcome,
    });
  }
);

export default router;
