import type {
  ClubInformationAdministrationResponse,
  ClubInformationValues,
} from '@club/shared-types/api/clubInformation';
import apiClient from './client';
import type { ApiResponse } from './types';

export async function getClubInformationAdministration(): Promise<ClubInformationAdministrationResponse> {
  const response = await apiClient.get<
    ApiResponse<ClubInformationAdministrationResponse>
  >('/club-information/admin');
  return response.data.data;
}

export async function updateClubInformation(
  content: ClubInformationValues
): Promise<ClubInformationAdministrationResponse> {
  const response = await apiClient.put<
    ApiResponse<ClubInformationAdministrationResponse>
  >('/club-information/admin', { content });
  return response.data.data;
}
