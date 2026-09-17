import type {
  PublicDocumentCreateValues,
  PublicDocumentUpdateValues,
} from '@club/shared-types/api/publicDocument';
import type {
  LocalizedTextCompleteness,
  LocalizedText,
} from '@club/shared-types/api/localizedContent';
import apiClient from './client';
import type { ApiResponse } from './types';

export interface PublicDocumentAdministration {
  id: string;
  displayName: LocalizedText;
  documentDate: string;
  fileUrl: string;
  isVisible: boolean;
  order: number;
  completeness: LocalizedTextCompleteness;
}

export interface PublicDocumentCreateRequest
  extends PublicDocumentCreateValues {
  replacement: File;
}

export interface PublicDocumentUpdateRequest
  extends PublicDocumentUpdateValues {
  replacement?: File;
}

export interface PublicDocumentMutationOutcome {
  document: PublicDocumentAdministration;
  mediaCleanupWarning: {
    code: 'PUBLIC_DOCUMENT_CLEANUP_FAILED';
    message: string;
  } | null;
}

export interface PublicDocumentDeleteOutcome {
  deleted: true;
  mediaCleanupWarning: PublicDocumentMutationOutcome['mediaCleanupWarning'];
}

export async function getAdminPublicDocuments() {
  const response = await apiClient.get<
    ApiResponse<PublicDocumentAdministration[]>
  >('/public-documents/admin');
  return response.data.data;
}

function multipart(document: object, replacement?: File) {
  const data = new FormData();
  data.append('payload', JSON.stringify({ document }));
  if (replacement) data.append('document', replacement);
  return data;
}

export async function createPublicDocument(
  request: PublicDocumentCreateRequest
): Promise<PublicDocumentMutationOutcome> {
  const { replacement, ...document } = request;
  const response = await apiClient.post<
    ApiResponse<PublicDocumentMutationOutcome>
  >('/public-documents/admin', multipart(document, replacement), {
    headers: { 'Content-Type': undefined },
  });
  return response.data.data;
}

export async function updatePublicDocument(
  id: string,
  request: PublicDocumentUpdateRequest
): Promise<PublicDocumentMutationOutcome> {
  const { replacement, ...document } = request;
  const response = await apiClient.put<
    ApiResponse<PublicDocumentMutationOutcome>
  >(`/public-documents/admin/${id}`, multipart(document, replacement), {
    headers: { 'Content-Type': undefined },
  });
  return response.data.data;
}

export async function reorderPublicDocuments(ids: string[]) {
  const response = await apiClient.put<
    ApiResponse<PublicDocumentAdministration[]>
  >('/public-documents/admin/order', { ids });
  return response.data.data;
}

export async function deletePublicDocument(
  id: string
): Promise<PublicDocumentDeleteOutcome> {
  const response = await apiClient.delete<
    ApiResponse<PublicDocumentDeleteOutcome>
  >(`/public-documents/admin/${id}`);
  return response.data.data;
}
