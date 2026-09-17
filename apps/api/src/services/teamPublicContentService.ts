import {
  EMPTY_TEAM_PUBLIC_CONTENT,
  getTeamPublicContentCompleteness,
  resolveTeamPublicContent,
  type TeamPublicContentAdministrationResponse,
  type TeamPublicContentPublicResponse,
  type TeamPublicContentValues,
} from '@club/shared-types/api/teamPublicContent';
import type { Language } from '@club/shared-types/core/enums';
import { Settings } from '../models/Settings';
import { SettingsService } from './settingsService';

export class TeamPublicContentService {
  static async getAdministrationContent(): Promise<TeamPublicContentAdministrationResponse> {
    const settings = await SettingsService.getSettings();
    const content = settings.teamPublicContent ?? EMPTY_TEAM_PUBLIC_CONTENT;
    return {
      content,
      completeness: getTeamPublicContentCompleteness(content),
      updatedAt: settings.teamPublicContent
        ? settings.updatedAt.toISOString()
        : null,
    };
  }

  static async getPublicContent(
    language: Language
  ): Promise<TeamPublicContentPublicResponse> {
    const settings = await SettingsService.getSettings();
    return resolveTeamPublicContent(
      settings.teamPublicContent ?? EMPTY_TEAM_PUBLIC_CONTENT,
      language
    );
  }

  static async updateContent(
    content: TeamPublicContentValues,
    updatedBy: string
  ): Promise<TeamPublicContentAdministrationResponse> {
    const settings = await Settings.findOneAndUpdate(
      {},
      {
        $set: { teamPublicContent: content, updatedBy },
        $setOnInsert: {
          notificationRecipients: {
            applicationAlerts: { additional: [] },
            tasterSessionAlerts: { additional: [] },
            guestPlayAlerts: { additional: [] },
          },
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    return {
      content: settings.teamPublicContent ?? content,
      completeness: getTeamPublicContentCompleteness(
        settings.teamPublicContent ?? content
      ),
      updatedAt: settings.updatedAt.toISOString(),
    };
  }
}
