import type { Router } from 'express';
import express from 'express';
import { Location } from '../models/Location';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authorizeCapability, protect } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { Capability, Language } from '@club/shared-types/core/enums';
import {
  administrationContentListQuerySchema,
  publicActiveContentListQuerySchema,
} from '@club/shared-types/api/contentList';
import type {
  AdministrationContentListQuery,
  PublicActiveContentListQuery,
} from '@club/shared-types/api/contentList';
import {
  createLocationSchema,
  updateLocationSchema,
} from '@club/shared-types/api/location';
import {
  activeLocationTimeSlots,
  normalizeLocationTimeSlots,
} from '../services/locationTimeSlotService';
import {
  ACCOUNT_DISPLAY_PROJECTION,
  accountDisplayReference,
} from '../services/accountDisplayProjection';

const router: Router = express.Router();

const locationListItem = (
  location: any,
  language: Language,
  activeSlotsOnly: boolean
) => {
  const translation =
    location.translations[language] ??
    location.translations[Language.ENGLISH] ??
    Object.values(location.translations)[0];

  if (!translation) return null;

  return {
    id: String(location._id),
    name: (translation as { name?: string }).name ?? '',
    address: (translation as { address?: string }).address ?? '',
    timeSlots: activeSlotsOnly
      ? activeLocationTimeSlots(location.timeSlots)
      : location.timeSlots,
    imageUrl: location.imageUrl,
    isActive: location.isActive,
    order: location.order,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
    updatedBy: accountDisplayReference(location.updatedBy),
  };
};

/**
 * GET /api/locations
 * Get active locations and active slots for the public projection
 */
router.get(
  '/',
  validateRequest({ query: publicActiveContentListQuerySchema }),
  async (_req, res) => {
    const { language } = res.locals
      .validatedQuery as PublicActiveContentListQuery;

    const locations = await Location.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .populate('createdBy', ACCOUNT_DISPLAY_PROJECTION)
      .populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    const transformedLocations = locations
      .map((location) => locationListItem(location, language as Language, true))
      .filter(Boolean);

    res.status(200).json({
      success: true,
      data: transformedLocations,
    });
  }
);

/**
 * GET /api/locations/admin
 * Get the complete Location management projection (admin only)
 */
router.get(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ query: administrationContentListQuerySchema }),
  async (_req, res) => {
    const { language } = res.locals
      .validatedQuery as AdministrationContentListQuery;
    const locations = await Location.find({})
      .sort({ order: 1, createdAt: -1 })
      .populate('createdBy', ACCOUNT_DISPLAY_PROJECTION)
      .populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    res.status(200).json({
      success: true,
      data: locations
        .map((location) =>
          locationListItem(location, language as Language, false)
        )
        .filter(Boolean),
    });
  }
);

/**
 * GET /api/locations/:id
 * Get single location with all translations (admin only)
 */
router.get(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (req, res) => {
    const location = await Location.findById(req.params.id)
      .populate('createdBy', ACCOUNT_DISPLAY_PROJECTION)
      .populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        id: String(location._id),
        translations: location.translations,
        timeSlots: location.timeSlots,
        imageUrl: location.imageUrl,
        isActive: location.isActive,
        order: location.order,
        createdAt: location.createdAt,
        updatedAt: location.updatedAt,
        createdBy: accountDisplayReference(location.createdBy),
        updatedBy: accountDisplayReference(location.updatedBy),
      },
    });
  }
);

/**
 * POST /api/locations
 * Create new location (admin only)
 */
router.post(
  '/',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: createLocationSchema }),
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const {
      translations,
      timeSlots,
      imageUrl = '',
      isActive = true,
      order = 0,
    } = authReq.body;

    const location = await Location.create({
      translations,
      timeSlots: normalizeLocationTimeSlots(timeSlots),
      imageUrl,
      isActive,
      order,
      createdBy: authReq.user.id,
      updatedBy: authReq.user.id,
    });

    await location.populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    res.status(201).json({
      success: true,
      data: {
        id: String(location._id),
        translations: location.translations,
        timeSlots: location.timeSlots,
        imageUrl: location.imageUrl,
        isActive: location.isActive,
        order: location.order,
        updatedBy: accountDisplayReference(location.updatedBy),
      },
    });
  }
);

/**
 * PUT /api/locations/:id
 * Update location (admin only)
 */
router.put(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: updateLocationSchema }),
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { translations, timeSlots, imageUrl, isActive, order } = authReq.body;

    const location = await Location.findById(authReq.params.id);

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Update fields
    if (translations) location.translations = translations;
    if (timeSlots !== undefined) {
      const existingIds = new Set(location.timeSlots.map((slot) => slot.id));
      location.timeSlots = normalizeLocationTimeSlots(timeSlots, existingIds);
    }
    if (imageUrl !== undefined) location.imageUrl = imageUrl;
    if (typeof isActive === 'boolean') location.isActive = isActive;
    if (typeof order === 'number') location.order = order;
    location.updatedBy = authReq.user.id as any;

    await location.save();
    await location.populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);

    res.status(200).json({
      success: true,
      data: {
        id: String(location._id),
        translations: location.translations,
        timeSlots: location.timeSlots,
        imageUrl: location.imageUrl,
        isActive: location.isActive,
        order: location.order,
        updatedBy: accountDisplayReference(location.updatedBy),
      },
    });
  }
);

/**
 * PATCH /api/locations/:id/toggle
 * Toggle location visibility (admin only)
 */
router.patch(
  '/:id/toggle',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const location = await Location.findById(authReq.params.id);

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    location.isActive = !location.isActive;
    location.updatedBy = authReq.user.id as any;
    await location.save();

    res.status(200).json({
      success: true,
      data: {
        id: String(location._id),
        isActive: location.isActive,
      },
    });
  }
);

/**
 * DELETE /api/locations/:id
 * Delete location (admin only)
 */
router.delete(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (req, res) => {
    const location = await Location.findById(req.params.id);

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    await Location.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      data: {},
    });
  }
);

export default router;
