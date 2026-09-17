import apiClient from './client';
import type {
  RecruitmentPublicContentAdministrationResponse,
  RecruitmentPublicContentValues,
} from '@club/shared-types/api/recruitmentPublicContent';

export async function getRecruitmentPublicContentAdministration(): Promise<RecruitmentPublicContentAdministrationResponse> {
  const response = await apiClient.get('/recruitment-content/admin');
  return response.data.data;
}

export async function updateRecruitmentPublicContent(
  content: RecruitmentPublicContentValues
): Promise<RecruitmentPublicContentAdministrationResponse> {
  const response = await apiClient.put('/recruitment-content/admin', {
    content,
  });
  return response.data.data;
}
