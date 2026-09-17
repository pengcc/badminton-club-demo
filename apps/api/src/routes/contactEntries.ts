import type { Request, Router } from 'express';
import express from 'express';
import {
  contactExternalLinkSchema,
  contactEntryMutationSchema,
  getContactEntryCompleteness,
  resolveContactEntryText,
} from '@club/shared-types/api/contact';
import { Language, Capability } from '@club/shared-types/core/enums';
import { ContactEntry } from '../models/ContactEntry';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authorizeCapability, protect } from '../middleware/auth';
import { receiveContactQr } from '../middleware/contactQr';
import { AppError } from '../utils/errors';
import { contactEntryService } from '../services/contactEntryService';
import {
  ACCOUNT_DISPLAY_PROJECTION,
  accountDisplayReference,
} from '../services/accountDisplayProjection';

const router: Router = express.Router();

function requestedLanguage(value: unknown): Language {
  if (value === undefined) return Language.GERMAN;
  if (
    value === Language.GERMAN ||
    value === Language.ENGLISH ||
    value === Language.CHINESE
  ) {
    return value;
  }
  throw new AppError('Unsupported Contact language', 400);
}

function parseMutation(request: Request) {
  if (typeof request.body.payload !== 'string') {
    throw new AppError('Contact payload is required', 400);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(request.body.payload);
  } catch {
    throw new AppError('Contact payload must be valid JSON', 400);
  }
  const result = contactEntryMutationSchema.safeParse(payload);
  if (!result.success) {
    throw new AppError(
      result.error.issues.map((issue) => issue.message).join(', '),
      400
    );
  }
  return result.data.contact;
}

const administrationItem = (entry: any) => ({
  id: String(entry._id),
  category: entry.category,
  title: entry.title,
  description: entry.description,
  email: entry.email,
  qrCode: entry.qrCode ?? '',
  qrCodeOriginalFilename: entry.qrCodeOriginalFilename ?? '',
  qrExplanation: entry.qrExplanation,
  externalLink: entry.externalLink ?? '',
  externalLinkLabel: entry.externalLinkLabel,
  isActive: entry.isActive,
  order: entry.order,
  completeness: getContactEntryCompleteness(entry),
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  createdBy: accountDisplayReference(entry.createdBy),
  updatedBy: accountDisplayReference(entry.updatedBy),
});

function publicExternalLink(entry: any): string {
  const result = contactExternalLinkSchema.safeParse(entry.externalLink ?? '');
  if (result.success) return result.data;
  console.warn('[contact-public-external-link-omitted]', {
    contactEntryId: String(entry._id),
  });
  return '';
}

router.get('/', async (request, response) => {
  const language = requestedLanguage(request.query.language);
  const entries = await ContactEntry.find({ isActive: true }).sort({
    order: 1,
    createdAt: 1,
  });
  response.json({
    success: true,
    data: entries.map((entry) => ({
      id: String(entry._id),
      category: entry.category,
      ...resolveContactEntryText(entry, language),
      email: entry.email,
      qrCode: entry.qrCode ?? '',
      externalLink: publicExternalLink(entry),
      order: entry.order,
    })),
  });
});

router.get(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (_request, response) => {
    const entries = await ContactEntry.find({})
      .sort({ order: 1, createdAt: 1 })
      .populate('createdBy', ACCOUNT_DISPLAY_PROJECTION)
      .populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);
    response.json({ success: true, data: entries.map(administrationItem) });
  }
);

router.get(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (request, response) => {
    const entry = await ContactEntry.findById(request.params.id)
      .populate('createdBy', ACCOUNT_DISPLAY_PROJECTION)
      .populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);
    if (!entry) throw new AppError('Contact entry not found', 404);
    response.json({ success: true, data: administrationItem(entry) });
  }
);

router.post(
  '/',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  receiveContactQr,
  async (request, response) => {
    const authRequest = request as AuthenticatedRequest;
    const entry = await contactEntryService.create(
      parseMutation(authRequest),
      authRequest.file,
      authRequest.user.id
    );
    await entry.populate('createdBy', ACCOUNT_DISPLAY_PROJECTION);
    await entry.populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);
    response
      .status(201)
      .json({ success: true, data: administrationItem(entry) });
  }
);

router.put(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  receiveContactQr,
  async (request, response) => {
    const authRequest = request as AuthenticatedRequest;
    const outcome = await contactEntryService.update(
      authRequest.params.id,
      parseMutation(authRequest),
      authRequest.file,
      authRequest.user.id
    );
    await outcome.entry.populate('createdBy', ACCOUNT_DISPLAY_PROJECTION);
    await outcome.entry.populate('updatedBy', ACCOUNT_DISPLAY_PROJECTION);
    response.json({
      success: true,
      data: {
        entry: administrationItem(outcome.entry),
        mediaCleanupWarning: outcome.mediaCleanupWarning,
      },
    });
  }
);

router.delete(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (request, response) => {
    response.json({
      success: true,
      data: await contactEntryService.delete(request.params.id as string),
    });
  }
);

export default router;
