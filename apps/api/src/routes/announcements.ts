import type { Router } from 'express';
import express from 'express';
import mongoose, { type ClientSession } from 'mongoose';
import { Announcement } from '../models/Announcement';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authorizeCapability, protect } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  announcementExternalLinkSchema,
  announcementMutationSchema,
  getAnnouncementCompleteness,
  resolveAnnouncementText,
  type AnnouncementMutation,
} from '@club/shared-types/api/announcement';
import {
  administrationContentListQuerySchema,
  publicActiveContentListQuerySchema,
} from '@club/shared-types/api/contentList';
import type {
  AdministrationContentListQuery,
  PublicActiveContentListQuery,
} from '@club/shared-types/api/contentList';
import { Capability, Language } from '@club/shared-types/core/enums';
import {
  ACCOUNT_DISPLAY_PROJECTION,
  accountDisplayReference,
} from '../services/accountDisplayProjection';
import { DemoRuntimePolicyService } from '../services/demoRuntimePolicyService';
import { DemoEditingService } from '../services/demoEditingService';
import { AppError } from '../utils/errors';

const router: Router = express.Router();

const announcementListItem = (
  announcement: any,
  language: Language,
  administration = false
) => {
  const content = resolveAnnouncementText(announcement.translations, language);
  if (!content.title || !content.content) return null;
  const parsedLink = announcementExternalLinkSchema.safeParse(
    announcement.externalLink ?? ''
  );
  const externalLink = parsedLink.success ? parsedLink.data : '';

  const publicItem = {
    id: String(announcement._id),
    title: content.title,
    content: content.content,
    type: announcement.type,
    displayDate: announcement.displayDate,
    ...(externalLink ? { externalLink } : {}),
  };

  if (!administration) return publicItem;

  return {
    ...publicItem,
    isActive: announcement.isActive,
    order: announcement.order,
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
    updatedBy: accountDisplayReference(announcement.updatedBy),
    completeness: getAnnouncementCompleteness(announcement.translations),
    ...(announcement.demoScratchLeaseId ? { isDemoScratch: true } : {}),
  };
};

const announcementDetail = (announcement: any) => ({
  id: String(announcement._id),
  translations: announcement.translations,
  type: announcement.type,
  displayDate: announcement.displayDate,
  externalLink: announcement.externalLink ?? '',
  isActive: announcement.isActive,
  order: announcement.order,
  createdAt: announcement.createdAt,
  updatedAt: announcement.updatedAt,
  createdBy: accountDisplayReference(announcement.createdBy),
  updatedBy: accountDisplayReference(announcement.updatedBy),
  completeness: getAnnouncementCompleteness(announcement.translations),
  ...(announcement.demoScratchLeaseId ? { isDemoScratch: true } : {}),
});

const canonicalAnnouncementQuery = { demoScratchLeaseId: { $exists: false } };

async function withDemoTransaction<T>(
  operation: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    if (result === undefined) {
      throw AppError.internal(
        'Demo Announcement transaction produced no result'
      );
    }
    return result;
  } finally {
    await session.endSession();
  }
}

async function administrationAnnouncementQuery(req: AuthenticatedRequest) {
  if (!DemoRuntimePolicyService.isDemoAdmin(req.user)) {
    return canonicalAnnouncementQuery;
  }
  const leaseId = await DemoEditingService.activeLeaseForOwner(
    req.authSession.id
  );
  return leaseId
    ? { $or: [canonicalAnnouncementQuery, { demoScratchLeaseId: leaseId }] }
    : canonicalAnnouncementQuery;
}

/**
 * GET /api/announcements
 * Get active announcements for the public projection
 */
router.get(
  '/',
  validateRequest({ query: publicActiveContentListQuerySchema }),
  async (_req, res) => {
    const { language } = res.locals
      .validatedQuery as PublicActiveContentListQuery;

    const announcements = await Announcement.find({
      isActive: true,
      ...canonicalAnnouncementQuery,
    })
      .sort({ order: 1, displayDate: -1, createdAt: -1, _id: 1 })
      .populate('createdBy', ACCOUNT_DISPLAY_PROJECTION)
      .populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    const transformedAnnouncements = announcements
      .map((announcement) =>
        announcementListItem(announcement, language as Language)
      )
      .filter(Boolean);

    res.status(200).json({
      success: true,
      data: transformedAnnouncements,
    });
  }
);

/**
 * GET /api/announcements/admin
 * Get the complete announcement management projection (admin only)
 */
router.get(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ query: administrationContentListQuerySchema }),
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { language } = res.locals
      .validatedQuery as AdministrationContentListQuery;
    const announcements = await Announcement.find(
      await administrationAnnouncementQuery(authReq)
    )
      .select('+demoScratchLeaseId')
      .sort({ order: 1, displayDate: -1, createdAt: -1, _id: 1 })
      .populate('createdBy', ACCOUNT_DISPLAY_PROJECTION)
      .populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    res.status(200).json({
      success: true,
      data: announcements
        .map((announcement) =>
          announcementListItem(announcement, language as Language, true)
        )
        .filter(Boolean),
    });
  }
);

/**
 * GET /api/announcements/:id
 * Get single announcement with all translations (admin only)
 */
router.get(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const announcement = await Announcement.findOne({
      _id: req.params.id,
      ...(await administrationAnnouncementQuery(authReq)),
    })
      .select('+demoScratchLeaseId')
      .populate('createdBy', ACCOUNT_DISPLAY_PROJECTION)
      .populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    res.status(200).json({
      success: true,
      data: announcementDetail(announcement),
    });
  }
);

/**
 * POST /api/announcements
 * Create new announcement (admin only)
 */
router.post(
  '/',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: announcementMutationSchema }),
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const {
      translations,
      type,
      displayDate,
      externalLink,
      isActive = true,
      order = 0,
    } = authReq.body as AnnouncementMutation;

    const isDemoScratch = DemoRuntimePolicyService.isDemoAdmin(authReq.user);
    if (isDemoScratch && externalLink) {
      return res.status(400).json({
        success: false,
        error: 'Demo announcements cannot publish external links',
      });
    }
    let announcement;
    try {
      const values = {
        translations,
        type,
        displayDate,
        externalLink,
        isActive: isDemoScratch ? false : isActive,
        order: isDemoScratch ? 0 : order,
        createdBy: authReq.user.id,
        updatedBy: authReq.user.id,
      };
      if (isDemoScratch) {
        announcement = await withDemoTransaction(async (session) => {
          const demoScratchLeaseId = await DemoEditingService.reserveMutation(
            authReq.authSession.id,
            new Date(),
            session
          );
          const [created] = await Announcement.create(
            [{ ...values, demoScratchLeaseId }],
            { session }
          );
          return created;
        });
      } else {
        announcement = await Announcement.create(values);
      }
    } catch (error) {
      if (isDemoScratch && (error as { code?: number }).code === 11000) {
        throw new AppError(
          'This demo lease already has a temporary Announcement',
          409,
          'DEMO_SCRATCH_LIMIT_REACHED'
        );
      }
      throw error;
    }

    await announcement.populate('createdBy', ACCOUNT_DISPLAY_PROJECTION);
    await announcement.populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    res.status(201).json({
      success: true,
      data: announcementDetail(announcement),
    });
  }
);

/**
 * PUT /api/announcements/:id
 * Update announcement (admin only)
 */
router.put(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: announcementMutationSchema }),
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { translations, type, displayDate, externalLink, isActive, order } =
      authReq.body as AnnouncementMutation;

    const isDemoScratch = DemoRuntimePolicyService.isDemoAdmin(authReq.user);
    if (isDemoScratch && externalLink) {
      return res.status(400).json({
        success: false,
        error: 'Demo announcements cannot publish external links',
      });
    }
    const update = (
      ownerQuery: Record<string, unknown>,
      session?: ClientSession
    ) =>
      Announcement.findOneAndUpdate(
        { _id: authReq.params.id, ...ownerQuery },
        {
          $set: {
            translations,
            type,
            displayDate,
            externalLink,
            isActive: isDemoScratch ? false : isActive,
            order: isDemoScratch ? 0 : order,
            updatedBy: authReq.user.id,
          },
        },
        { new: true, runValidators: true, session }
      ).select('+demoScratchLeaseId');

    const announcement = isDemoScratch
      ? await withDemoTransaction(async (session) => {
          const demoScratchLeaseId = await DemoEditingService.reserveMutation(
            authReq.authSession.id,
            new Date(),
            session
          );
          return update({ demoScratchLeaseId }, session);
        })
      : await update(canonicalAnnouncementQuery);

    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    await announcement.populate('createdBy', ACCOUNT_DISPLAY_PROJECTION);
    await announcement.populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    res.status(200).json({
      success: true,
      data: announcementDetail(announcement),
    });
  }
);

/**
 * PATCH /api/announcements/:id/toggle
 * Toggle announcement visibility (admin only)
 */
router.patch(
  '/:id/toggle',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const announcement = await Announcement.findById(authReq.params.id);

    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    announcement.isActive = !announcement.isActive;
    announcement.updatedBy = authReq.user.id as any;
    await announcement.save();

    res.status(200).json({
      success: true,
      data: {
        id: String(announcement._id),
        isActive: announcement.isActive,
      },
    });
  }
);

/**
 * DELETE /api/announcements/:id
 * Delete announcement (admin only)
 */
router.delete(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (req, res) => {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    await Announcement.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      data: {},
    });
  }
);

export default router;
