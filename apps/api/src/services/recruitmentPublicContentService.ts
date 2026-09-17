import {
  EMPTY_RECRUITMENT_PUBLIC_CONTENT,
  getRecruitmentPublicContentCompleteness,
  recruitmentPublicContentValuesSchema,
  resolveRecruitmentPublicContent,
  type RecruitmentPublicContentAdministrationResponse,
  type RecruitmentPublicContentPublicResponse,
  type RecruitmentPublicContentValues,
} from '@club/shared-types/api/recruitmentPublicContent';
import type { Language } from '@club/shared-types/core/enums';
import { RecruitmentPublicContent } from '../models/RecruitmentPublicContent';
import { AppError } from '../utils/errors';
import { contactEntryService } from './contactEntryService';

const unavailable = () =>
  new AppError(
    'Recruitment public content is unavailable',
    503,
    'RECRUITMENT_PUBLIC_CONTENT_UNAVAILABLE'
  );

function toValues(documentContent: {
  isOpen: boolean;
  introduction: RecruitmentPublicContentValues['introduction'];
  requirements: RecruitmentPublicContentValues['requirements'];
  tryoutGuidance: RecruitmentPublicContentValues['tryoutGuidance'];
  contactEntryId: unknown;
}): RecruitmentPublicContentValues {
  return {
    isOpen: documentContent.isOpen,
    introduction: documentContent.introduction,
    requirements: documentContent.requirements,
    tryoutGuidance: documentContent.tryoutGuidance,
    contactEntryId: documentContent.contactEntryId
      ? String(documentContent.contactEntryId)
      : null,
  };
}

export class RecruitmentPublicContentService {
  static async getAdministrationContent(): Promise<RecruitmentPublicContentAdministrationResponse> {
    const document = await RecruitmentPublicContent.findOne({
      singletonKey: 'recruitment',
    });
    const content = document
      ? toValues(document.content)
      : EMPTY_RECRUITMENT_PUBLIC_CONTENT;
    return {
      content,
      completeness: getRecruitmentPublicContentCompleteness(content),
      contactAvailable: content.contactEntryId
        ? await contactEntryService.isActive(content.contactEntryId)
        : false,
      updatedAt: document?.updatedAt.toISOString() ?? null,
    };
  }

  static async getPublicContent(
    language: Language
  ): Promise<RecruitmentPublicContentPublicResponse> {
    const document = await RecruitmentPublicContent.findOne({
      singletonKey: 'recruitment',
    });
    if (!document) throw unavailable();
    const parsed = recruitmentPublicContentValuesSchema.safeParse(
      toValues(document.content)
    );
    if (!parsed.success) throw unavailable();
    return resolveRecruitmentPublicContent(parsed.data, language);
  }

  static async updateContent(
    content: RecruitmentPublicContentValues,
    updatedBy: string
  ): Promise<RecruitmentPublicContentAdministrationResponse> {
    const contactAvailable = content.contactEntryId
      ? await contactEntryService.isActive(content.contactEntryId)
      : false;
    if (content.isOpen && !contactAvailable) {
      throw new AppError(
        'Open recruitment requires an active Contact entry',
        400,
        'RECRUITMENT_ACTIVE_CONTACT_REQUIRED'
      );
    }

    const document = await RecruitmentPublicContent.findOneAndUpdate(
      { singletonKey: 'recruitment' },
      {
        $set: { content, updatedBy },
        $setOnInsert: { singletonKey: 'recruitment' },
      },
      { upsert: true, new: true, runValidators: true }
    );
    const saved = toValues(document.content);
    return {
      content: saved,
      completeness: getRecruitmentPublicContentCompleteness(saved),
      contactAvailable,
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}
