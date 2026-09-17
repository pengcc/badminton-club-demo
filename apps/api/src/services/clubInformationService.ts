import {
  EMPTY_CLUB_INFORMATION,
  getClubInformationCompleteness,
  resolveClubInformation,
  type ClubInformationAdministrationResponse,
  type ClubInformationPublicResponse,
  type ClubInformationValues,
} from '@club/shared-types/api/clubInformation';
import type { Language } from '@club/shared-types/core/enums';
import { ClubInformation } from '../models/ClubInformation';

export class ClubInformationService {
  static async getAdministrationContent(): Promise<ClubInformationAdministrationResponse> {
    const document = await ClubInformation.findOne({ singletonKey: 'club' });
    const content = document?.content ?? EMPTY_CLUB_INFORMATION;
    return {
      content,
      completeness: getClubInformationCompleteness(content),
      updatedAt: document?.updatedAt.toISOString() ?? null,
    };
  }

  static async getPublicContent(
    language: Language
  ): Promise<ClubInformationPublicResponse> {
    const document = await ClubInformation.findOne({ singletonKey: 'club' });
    return resolveClubInformation(
      document?.content ?? EMPTY_CLUB_INFORMATION,
      language
    );
  }

  static async updateContent(
    content: ClubInformationValues,
    updatedBy: string
  ): Promise<ClubInformationAdministrationResponse> {
    const document = await ClubInformation.findOneAndUpdate(
      { singletonKey: 'club' },
      {
        $set: { content, updatedBy },
        $setOnInsert: { singletonKey: 'club' },
      },
      { upsert: true, new: true, runValidators: true }
    );
    return {
      content: document.content,
      completeness: getClubInformationCompleteness(document.content),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}
