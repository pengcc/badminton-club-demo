import {
  EMPTY_TASTER_SESSION_PUBLIC_CONTENT,
  getTasterSessionPublicContentCompleteness,
  resolveTasterSessionPublicContent,
  tasterSessionPublicContentValuesSchema,
  type TasterSessionPublicContentAdministrationResponse,
  type TasterSessionPublicContentPublicResponse,
  type TasterSessionPublicContentValues,
} from '@club/shared-types/api/tasterSessionPublicContent';
import type { Language } from '@club/shared-types/core/enums';
import { TasterSessionPublicContent } from '../models/TasterSessionPublicContent';
import { AppError } from '../utils/errors';

const unavailable = () =>
  new AppError(
    'Taster Session public content is unavailable',
    503,
    'TASTER_SESSION_PUBLIC_CONTENT_UNAVAILABLE'
  );

export class TasterSessionPublicContentService {
  static async getAdministrationContent(): Promise<TasterSessionPublicContentAdministrationResponse> {
    const document = await TasterSessionPublicContent.findOne({
      singletonKey: 'taster-session',
    });
    const content = document?.content ?? EMPTY_TASTER_SESSION_PUBLIC_CONTENT;
    return {
      content,
      completeness: getTasterSessionPublicContentCompleteness(content),
      updatedAt: document?.updatedAt.toISOString() ?? null,
    };
  }

  static async getPublicContent(
    language: Language
  ): Promise<TasterSessionPublicContentPublicResponse> {
    const document = await TasterSessionPublicContent.findOne({
      singletonKey: 'taster-session',
    });
    if (!document) throw unavailable();
    const content = tasterSessionPublicContentValuesSchema.safeParse(
      document.content
    );
    if (!content.success) throw unavailable();
    return resolveTasterSessionPublicContent(content.data, language);
  }

  static async updateContent(
    content: TasterSessionPublicContentValues,
    updatedBy: string
  ): Promise<TasterSessionPublicContentAdministrationResponse> {
    const document = await TasterSessionPublicContent.findOneAndUpdate(
      { singletonKey: 'taster-session' },
      {
        $set: { content, updatedBy },
        $setOnInsert: { singletonKey: 'taster-session' },
      },
      { upsert: true, new: true, runValidators: true }
    );
    return {
      content: document.content,
      completeness: getTasterSessionPublicContentCompleteness(document.content),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}
