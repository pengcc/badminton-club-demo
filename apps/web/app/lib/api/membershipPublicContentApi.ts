import apiClient from './client';
import type {
  MembershipPublicContentAdministrationResponse,
  MembershipPublicContentValues,
} from '@club/shared-types/api/membershipPublicContent';

export async function getMembershipPublicContentAdministration(): Promise<MembershipPublicContentAdministrationResponse> {
  const response = await apiClient.get('/membership-content/admin');
  return response.data.data;
}

export async function updateMembershipPublicContent(
  content: MembershipPublicContentValues
): Promise<MembershipPublicContentAdministrationResponse> {
  const response = await apiClient.put('/membership-content/admin', {
    content,
  });
  return response.data.data;
}
