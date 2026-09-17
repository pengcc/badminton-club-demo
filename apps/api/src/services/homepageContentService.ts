import {
  EMPTY_HOMEPAGE_CONTENT,
  getHomepageContentCompleteness,
  resolveHomepageContent,
  type HomepageContentAdministrationResponse,
  type HomepageContentPublicResponse,
  type HomepageContentValues,
} from '@club/shared-types/api/homepageContent';
import type { Language } from '@club/shared-types/core/enums';
import { HomepageContent } from '../models/Content';

export class HomepageContentService {
  static async getAdministrationContent(): Promise<HomepageContentAdministrationResponse> {
    const document = await HomepageContent.findOne({
      singletonKey: 'homepage',
    });
    const content = document?.content ?? EMPTY_HOMEPAGE_CONTENT;

    return {
      content,
      completeness: getHomepageContentCompleteness(content),
      updatedAt: document?.updatedAt.toISOString() ?? null,
    };
  }

  static async getPublicContent(
    language: Language
  ): Promise<HomepageContentPublicResponse> {
    const document = await HomepageContent.findOne({
      singletonKey: 'homepage',
    });
    return resolveHomepageContent(
      document?.content ?? EMPTY_HOMEPAGE_CONTENT,
      language
    );
  }

  static async updateContent(
    content: HomepageContentValues,
    updatedBy: string
  ): Promise<HomepageContentAdministrationResponse> {
    const document = await HomepageContent.findOneAndUpdate(
      { singletonKey: 'homepage' },
      {
        $set: {
          content,
          updatedBy,
        },
        $setOnInsert: { singletonKey: 'homepage' },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return {
      content: document.content,
      completeness: getHomepageContentCompleteness(document.content),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}
