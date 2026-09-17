import {
  EMPTY_MEMBERSHIP_PUBLIC_CONTENT,
  getMembershipPublicContentCompleteness,
  membershipPublicContentValuesSchema,
  resolveMembershipPublicContent,
  type MembershipPublicContentAdministrationResponse,
  type MembershipPublicContentPublicResponse,
  type MembershipPublicContentValues,
} from '@club/shared-types/api/membershipPublicContent';
import type { Language } from '@club/shared-types/core/enums';
import { MembershipPublicContent } from '../models/MembershipPublicContent';
import { AppError } from '../utils/errors';

const unavailable = () =>
  new AppError(
    'Membership public content is unavailable',
    503,
    'MEMBERSHIP_PUBLIC_CONTENT_UNAVAILABLE'
  );

export class MembershipPublicContentService {
  static async getAdministrationContent(): Promise<MembershipPublicContentAdministrationResponse> {
    const document = await MembershipPublicContent.findOne({
      singletonKey: 'membership',
    });
    const content = document?.content ?? EMPTY_MEMBERSHIP_PUBLIC_CONTENT;
    return {
      content,
      completeness: getMembershipPublicContentCompleteness(content),
      updatedAt: document?.updatedAt.toISOString() ?? null,
    };
  }

  static async getPublicContent(
    language: Language
  ): Promise<MembershipPublicContentPublicResponse> {
    const document = await MembershipPublicContent.findOne({
      singletonKey: 'membership',
    });
    if (!document) throw unavailable();
    const content = membershipPublicContentValuesSchema.safeParse(
      document.content
    );
    if (!content.success) throw unavailable();
    return resolveMembershipPublicContent(content.data, language);
  }

  static async updateContent(
    content: MembershipPublicContentValues,
    updatedBy: string
  ): Promise<MembershipPublicContentAdministrationResponse> {
    const document = await MembershipPublicContent.findOneAndUpdate(
      { singletonKey: 'membership' },
      {
        $set: { content, updatedBy },
        $setOnInsert: { singletonKey: 'membership' },
      },
      { upsert: true, new: true, runValidators: true }
    );
    return {
      content: document.content,
      completeness: getMembershipPublicContentCompleteness(document.content),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}
