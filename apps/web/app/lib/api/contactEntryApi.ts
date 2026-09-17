import apiClient from './client';
import type { ApiResponse } from './types';
import type {
  ContactEntryCompleteness,
  ContactEntryValues,
} from '@club/shared-types/api/contact';
import type { LocalizedText } from '@club/shared-types/api/localizedContent';
import { Language } from '@club/shared-types/core/enums';

export interface ContactEntryPublic {
  id: string;
  category: string;
  title: string;
  description: string;
  email: string;
  qrCode: string;
  qrExplanation: string;
  externalLink: string;
  externalLinkLabel: string;
  order: number;
}

export interface ContactEntryAdministration {
  id: string;
  category: string;
  title: LocalizedText;
  description: LocalizedText;
  email: string;
  qrCode: string;
  qrCodeOriginalFilename: string;
  qrExplanation: LocalizedText;
  externalLink: string;
  externalLinkLabel: LocalizedText;
  isActive: boolean;
  order: number;
  completeness: ContactEntryCompleteness;
}

export interface ContactEntryRequest extends ContactEntryValues {
  newQrCode?: File;
}

export interface ContactQrCleanupWarning {
  code: 'CONTACT_QR_CLEANUP_FAILED';
  message: string;
}

export interface ContactEntryUpdateOutcome {
  entry: ContactEntryAdministration;
  mediaCleanupWarning: ContactQrCleanupWarning | null;
}

function formDataFor(request: ContactEntryRequest) {
  const { newQrCode, ...contact } = request;
  const formData = new FormData();
  formData.append('payload', JSON.stringify({ contact }));
  if (newQrCode) formData.append('qrCode', newQrCode);
  return formData;
}

export async function getPublicContactEntries(
  language: Language
): Promise<ContactEntryPublic[]> {
  const response = await apiClient.get<ApiResponse<ContactEntryPublic[]>>(
    '/contact-entries',
    { params: { language } }
  );
  return response.data.data;
}

export async function getAdminContactEntries(): Promise<
  ContactEntryAdministration[]
> {
  const response = await apiClient.get<
    ApiResponse<ContactEntryAdministration[]>
  >('/contact-entries/admin');
  return response.data.data;
}

export async function createContactEntry(
  request: ContactEntryRequest
): Promise<ContactEntryAdministration> {
  const response = await apiClient.post<
    ApiResponse<ContactEntryAdministration>
  >('/contact-entries', formDataFor(request), {
    headers: { 'Content-Type': undefined },
  });
  return response.data.data;
}

export async function updateContactEntry(
  id: string,
  request: ContactEntryRequest
): Promise<ContactEntryUpdateOutcome> {
  const response = await apiClient.put<ApiResponse<ContactEntryUpdateOutcome>>(
    `/contact-entries/${id}`,
    formDataFor(request),
    {
      headers: { 'Content-Type': undefined },
    }
  );
  return response.data.data;
}

export async function deleteContactEntry(id: string) {
  const response = await apiClient.delete<
    ApiResponse<{
      deleted: true;
      mediaCleanupWarning: ContactQrCleanupWarning | null;
    }>
  >(`/contact-entries/${id}`);
  return response.data.data;
}
