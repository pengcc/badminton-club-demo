import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { EmailTemplate } from '../models/EmailTemplate';
import {
  assertEmailTemplateSystemContract,
  emailTemplateCatalogContract,
  type LocalizedTemplateContent,
} from '../services/emailTemplateSystemContract';
import { renderLocalizedEmailTemplate } from '../services/emailTemplateRenderer';
import { AppError } from '../utils/errors';

function administrationTemplate(template: any) {
  const persisted =
    typeof template.toObject === 'function' ? template.toObject() : template;
  return {
    ...persisted,
    systemContract: emailTemplateCatalogContract(template.name),
  };
}

/**
 * Controller for Email Template management
 */
export class EmailTemplateController {
  /**
   * GET /email-templates
   * Get all email templates (admin only)
   */
  static async getAllTemplates(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const templates = await EmailTemplate.find({}).sort({
        name: 1,
      });

      res.status(200).json({
        success: true,
        data: templates.map(administrationTemplate),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /email-templates/:id
   * Get a specific email template (admin only)
   */
  static async getTemplateById(
    req: AuthenticatedRequest<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const template = await EmailTemplate.findById(req.params.id);

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Template not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: administrationTemplate(template),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /email-templates/:id
   * Update an email template (admin only)
   */
  static async updateTemplate(
    req: AuthenticatedRequest<
      {
        subject?: { de?: string; en?: string; zh?: string };
        body?: { de?: string; en?: string; zh?: string };
      },
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { subject, body } = req.body;

      const template = await EmailTemplate.findById(req.params.id);

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Template not found',
        });
        return;
      }

      const nextBody: LocalizedTemplateContent = {
        de: body?.de ?? template.body.de,
        en: body?.en ?? template.body.en,
        zh: body?.zh ?? template.body.zh,
      };
      assertEmailTemplateSystemContract(template.name, nextBody);

      // Update subject if provided
      if (subject) {
        if (subject.de !== undefined) template.subject.de = subject.de;
        if (subject.en !== undefined) template.subject.en = subject.en;
        if (subject.zh !== undefined) template.subject.zh = subject.zh;
      }

      // Update body if provided
      if (body) {
        if (body.de !== undefined) template.body.de = body.de;
        if (body.en !== undefined) template.body.en = body.en;
        if (body.zh !== undefined) template.body.zh = body.zh;
      }

      await template.save();

      res.status(200).json({
        success: true,
        message: 'Template updated successfully',
        data: administrationTemplate(template),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /email-templates/:id/preview
   * Preview a template with sample data (admin only)
   */
  static async previewTemplate(
    req: AuthenticatedRequest<
      {
        locale: 'de' | 'en' | 'zh';
        variables: Record<string, string>;
        subject?: LocalizedTemplateContent;
        body?: LocalizedTemplateContent;
      },
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { locale, variables, subject, body } = req.body;
      const template = await EmailTemplate.findById(req.params.id);

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Template not found',
        });
        return;
      }

      if (!subject || !body) {
        throw AppError.validation(
          'Preview requires the current unsaved subject and body'
        );
      }

      const rendered = renderLocalizedEmailTemplate({
        name: template.name,
        subject,
        body,
        locale,
        variables,
      });

      res.status(200).json({
        success: true,
        data: {
          subject: rendered.subject,
          body: rendered.body,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
