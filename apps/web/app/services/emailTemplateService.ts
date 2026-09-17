'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as emailTemplateApi from '@app/lib/api/emailTemplateApi';

/**
 * Email Template Service
 * React Query hooks for email template management
 */
export class EmailTemplateService {
  /**
   * Hook: Get all email templates
   */
  static useTemplateList() {
    return useQuery({
      queryKey: ['email-templates', 'list'],
      queryFn: async () => {
        const response = await emailTemplateApi.getEmailTemplates();
        return response.data;
      },
    });
  }

  /**
   * Hook: Get email template by ID
   */
  static useTemplate(id: string | null) {
    return useQuery({
      queryKey: ['email-templates', id],
      queryFn: async () => {
        if (!id) return null;
        const response = await emailTemplateApi.getEmailTemplateById(id);
        return response.data;
      },
      enabled: !!id,
    });
  }

  /**
   * Hook: Update email template
   */
  static useUpdateTemplate() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({
        id,
        data,
      }: {
        id: string;
        data: emailTemplateApi.UpdateEmailTemplateRequest;
      }) => {
        return await emailTemplateApi.updateEmailTemplate(id, data);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      },
    });
  }

  /**
   * Hook: Preview email template
   */
  static usePreviewTemplate() {
    return useMutation({
      mutationFn: async ({
        id,
        data,
      }: {
        id: string;
        data: emailTemplateApi.PreviewEmailTemplateRequest;
      }) => {
        const response = await emailTemplateApi.previewEmailTemplate(id, data);
        return response.data;
      },
    });
  }
}
