import apiClient from './client';
import type { ApiResponse } from './types';

/**
 * Email Template API Client
 */

export interface EmailTemplate {
  _id: string;
  name: string;
  subject: {
    de: string;
    en: string;
    zh: string;
  };
  body: {
    de: string;
    en: string;
    zh: string;
  };
  variables: string[];
  isActive: boolean;
  systemContract: {
    senderStatus: 'current' | 'unconsumed';
    owner: string | null;
    supportedLocales: Array<'de' | 'en' | 'zh'>;
    availableVariables: string[];
    requiredVariables: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface UpdateEmailTemplateRequest {
  subject?: {
    de?: string;
    en?: string;
    zh?: string;
  };
  body?: {
    de?: string;
    en?: string;
    zh?: string;
  };
}

export interface PreviewEmailTemplateRequest {
  locale: 'de' | 'en' | 'zh';
  variables: Record<string, string>;
  subject: EmailTemplate['subject'];
  body: EmailTemplate['body'];
}

export interface PreviewEmailTemplateResponse {
  subject: string;
  body: string;
}

/**
 * Get all email templates
 */
export const getEmailTemplates = async (): Promise<
  ApiResponse<EmailTemplate[]>
> => {
  const response =
    await apiClient.get<ApiResponse<EmailTemplate[]>>('/email-templates');
  return response.data;
};

/**
 * Get email template by ID
 */
export const getEmailTemplateById = async (
  id: string
): Promise<ApiResponse<EmailTemplate>> => {
  const response = await apiClient.get<ApiResponse<EmailTemplate>>(
    `/email-templates/${id}`
  );
  return response.data;
};

/**
 * Update email template
 */
export const updateEmailTemplate = async (
  id: string,
  data: UpdateEmailTemplateRequest
): Promise<ApiResponse<EmailTemplate>> => {
  const response = await apiClient.put<ApiResponse<EmailTemplate>>(
    `/email-templates/${id}`,
    data
  );
  return response.data;
};

/**
 * Preview email template with variables
 */
export const previewEmailTemplate = async (
  id: string,
  data: PreviewEmailTemplateRequest
): Promise<ApiResponse<PreviewEmailTemplateResponse>> => {
  const response = await apiClient.post<
    ApiResponse<PreviewEmailTemplateResponse>
  >(`/email-templates/${id}/preview`, data);
  return response.data;
};
