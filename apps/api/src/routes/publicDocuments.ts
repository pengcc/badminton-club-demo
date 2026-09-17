import type { Request, Router } from 'express';
import express from 'express';
import type { ZodType } from 'zod';
import {
  getPublicDocumentCompleteness,
  publicDocumentCreateMutationSchema,
  publicDocumentReorderSchema,
  publicDocumentUpdateMutationSchema,
  resolvePublicDocumentName,
} from '@club/shared-types/api/publicDocument';
import { Capability, Language } from '@club/shared-types/core/enums';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authorizeCapability, protect } from '../middleware/auth';
import { receivePublicDocumentPdf } from '../middleware/publicDocumentPdf';
import type { IPublicDocument } from '../models/PublicDocument';
import { publicDocumentService } from '../services/publicDocumentService';
import { AppError } from '../utils/errors';

const router: Router = express.Router();

function language(value: unknown): Language {
  if (value === undefined) return Language.GERMAN;
  if (
    value === Language.GERMAN ||
    value === Language.ENGLISH ||
    value === Language.CHINESE
  )
    return value;
  throw new AppError('Unsupported Public Document language', 400);
}

function parseMultipartMutation<T>(
  request: Request,
  schema: ZodType<{ document: T }>
): T {
  if (typeof request.body.payload !== 'string') {
    throw new AppError('Public Document payload is required', 400);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(request.body.payload);
  } catch {
    throw new AppError('Public Document payload must be valid JSON', 400);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError(
      parsed.error.issues.map((issue) => issue.message).join(', '),
      400
    );
  }
  return parsed.data.document;
}

const administrationItem = (document: IPublicDocument) => ({
  id: String(document._id),
  displayName: document.displayName,
  documentDate: document.documentDate,
  fileUrl: document.fileUrl,
  isVisible: document.isVisible,
  order: document.order,
  completeness: getPublicDocumentCompleteness(document.displayName),
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
});

router.get('/', async (request, response) => {
  const requestedLanguage = language(request.query.language);
  const documents = await publicDocumentService.listPublic();
  response.json({
    success: true,
    data: documents.map((document) => ({
      id: document.id,
      displayName: resolvePublicDocumentName(
        document.displayName,
        requestedLanguage
      ),
      documentDate: document.documentDate,
      fileUrl: document.fileUrl,
    })),
  });
});

router.get(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (_request, response) => {
    const documents = await publicDocumentService.listAdministration();
    response.json({ success: true, data: documents.map(administrationItem) });
  }
);

router.post(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  receivePublicDocumentPdf,
  async (request, response) => {
    const authRequest = request as AuthenticatedRequest;
    const outcome = await publicDocumentService.create(
      parseMultipartMutation(authRequest, publicDocumentCreateMutationSchema),
      authRequest.file,
      authRequest.user.id
    );
    response.status(201).json({
      success: true,
      data: {
        document: administrationItem(outcome.document),
        mediaCleanupWarning: outcome.mediaCleanupWarning,
      },
    });
  }
);

router.put(
  '/admin/order',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (request, response) => {
    const authRequest = request as AuthenticatedRequest;
    const parsed = publicDocumentReorderSchema.safeParse(authRequest.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues.map((issue) => issue.message).join(', '),
        400
      );
    }
    const documents = await publicDocumentService.reorder(
      parsed.data.ids,
      authRequest.user.id
    );
    response.json({ success: true, data: documents.map(administrationItem) });
  }
);

router.put(
  '/admin/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  receivePublicDocumentPdf,
  async (request, response) => {
    const authRequest = request as AuthenticatedRequest;
    const outcome = await publicDocumentService.update(
      authRequest.params.id,
      parseMultipartMutation(authRequest, publicDocumentUpdateMutationSchema),
      authRequest.file,
      authRequest.user.id
    );
    response.json({
      success: true,
      data: {
        document: administrationItem(outcome.document),
        mediaCleanupWarning: outcome.mediaCleanupWarning,
      },
    });
  }
);

router.delete(
  '/admin/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  async (request, response) => {
    response.json({
      success: true,
      data: await publicDocumentService.delete(request.params.id as string),
    });
  }
);

export default router;
