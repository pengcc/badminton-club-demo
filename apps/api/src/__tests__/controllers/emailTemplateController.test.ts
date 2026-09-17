import type { NextFunction, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailTemplateController } from '../../controllers/emailTemplateController';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { EmailTemplate } from '../../models/EmailTemplate';
import { MEMBER_PASSWORD_SETUP_TEMPLATE } from '../../services/emailTemplateSystemContract';

function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

function passwordSetupDocument() {
  return {
    _id: 'template-id',
    ...structuredClone(MEMBER_PASSWORD_SETUP_TEMPLATE),
    isActive: true,
    save: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => vi.restoreAllMocks());

describe('EmailTemplateController system-owned contracts', () => {
  it('lists current catalog entries without changing active state', async () => {
    const current = passwordSetupDocument();
    const applicationApproval = {
      _id: 'application-approved-id',
      name: 'application_approved',
      subject: { de: 'Genehmigt', en: 'Approved', zh: '已批准' },
      body: { de: 'Text', en: 'Text', zh: '文本' },
      variables: ['firstName'],
      isActive: true,
    };
    const sort = vi.fn().mockResolvedValue([current, applicationApproval]);
    vi.spyOn(EmailTemplate, 'find').mockReturnValue({ sort } as never);
    const res = response();

    await EmailTemplateController.getAllTemplates(
      {} as AuthenticatedRequest,
      res,
      vi.fn() as NextFunction
    );

    expect(EmailTemplate.find).toHaveBeenCalledWith({});
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [
        expect.objectContaining({
          name: 'member_password_setup',
          systemContract: expect.objectContaining({
            senderStatus: 'current',
            owner: 'Account Onboarding',
          }),
        }),
        expect.objectContaining({
          name: 'application_approved',
          isActive: true,
          systemContract: expect.objectContaining({
            senderStatus: 'current',
            owner: 'Membership Application',
          }),
        }),
      ],
    });
  });

  it('rejects an administrator edit that removes the setup link', async () => {
    const template = passwordSetupDocument();
    vi.spyOn(EmailTemplate, 'findById').mockResolvedValue(template as never);
    const next = vi.fn();
    const request = {
      params: { id: 'template-id' },
      body: {
        body: {
          en: MEMBER_PASSWORD_SETUP_TEMPLATE.body.en.replace(
            '{{resetLink}}',
            ''
          ),
        },
      },
    } as AuthenticatedRequest;

    await EmailTemplateController.updateTemplate(
      request,
      response(),
      next as NextFunction
    );

    expect(template.save).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      })
    );
  });

  it('preserves system-owned fields while saving localized administrator content', async () => {
    const template = passwordSetupDocument();
    vi.spyOn(EmailTemplate, 'findById').mockResolvedValue(template as never);
    const res = response();
    const next = vi.fn();
    const customBody = `Hello {{firstName}} {{lastName}} at {{email}}. Custom instructions {{resetLink}} valid for {{expiresIn}}.`;
    const request = {
      params: { id: 'template-id' },
      body: { subject: { en: 'Custom subject' }, body: { en: customBody } },
    } as AuthenticatedRequest;

    await EmailTemplateController.updateTemplate(
      request,
      res,
      next as NextFunction
    );

    expect(next).not.toHaveBeenCalled();
    expect(template.name).toBe('member_password_setup');
    expect(template.variables).toEqual(
      MEMBER_PASSWORD_SETUP_TEMPLATE.variables
    );
    expect(template.subject.en).toBe('Custom subject');
    expect(template.body.en).toBe(customBody);
    expect(template.save).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('refuses to preview a draft password-setup template with a broken contract', async () => {
    const template = passwordSetupDocument();
    vi.spyOn(EmailTemplate, 'findById').mockResolvedValue(template as never);
    const next = vi.fn();
    const request = {
      params: { id: 'template-id' },
      body: {
        locale: 'de',
        subject: template.subject,
        body: {
          ...template.body,
          de: template.body.de.replace('{{expiresIn}}', '24 Stunden'),
        },
        variables: { resetLink: 'link', expiresIn: '24 Stunden' },
      },
    } as AuthenticatedRequest;

    await EmailTemplateController.previewTemplate(
      request,
      response(),
      next as NextFunction
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
    expect(template.save).not.toHaveBeenCalled();
  });

  it('previews unsaved localized content through the delivery renderer without persistence', async () => {
    const template = passwordSetupDocument();
    vi.spyOn(EmailTemplate, 'findById').mockResolvedValue(template as never);
    const res = response();
    const next = vi.fn();
    const draftBody = {
      ...template.body,
      en: '{{firstName}} {{#if lastName}}({{lastName}}){{/if}} {{resetLink}} expires {{expiresIn}}',
    };

    await EmailTemplateController.previewTemplate(
      {
        params: { id: 'template-id' },
        body: {
          locale: 'en',
          subject: { ...template.subject, en: 'Draft for {{firstName}}' },
          body: draftBody,
          variables: {
            firstName: 'Ada',
            lastName: 'Lovelace',
            resetLink: 'https://example.test/setup',
            expiresIn: '7 days',
          },
        },
      } as AuthenticatedRequest,
      res,
      next as NextFunction
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        subject: 'Draft for Ada',
        body: 'Ada (Lovelace) https://example.test/setup expires 7 days',
      },
    });
    expect(template.save).not.toHaveBeenCalled();
  });

  it('rejects a Membership Application edit with locale-specific missing variables', async () => {
    const template = {
      _id: 'application-template',
      name: 'application_approved',
      subject: { de: 'Betreff', en: 'Subject', zh: '主题' },
      body: {
        de: '{{firstName}} {{lastName}} {{setupGuidance}}',
        en: '{{firstName}} {{lastName}} {{setupGuidance}}',
        zh: '{{firstName}} {{lastName}} {{setupGuidance}}',
      },
      variables: ['firstName', 'lastName', 'setupGuidance'],
      isActive: true,
      save: vi.fn(),
    };
    vi.spyOn(EmailTemplate, 'findById').mockResolvedValue(template as never);
    const next = vi.fn();

    await EmailTemplateController.updateTemplate(
      {
        params: { id: template._id },
        body: { body: { zh: '{{firstName}} {{lastName}}' } },
      } as AuthenticatedRequest,
      response(),
      next as NextFunction
    );

    expect(template.save).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('zh: {{setupGuidance}}'),
      })
    );
  });
});
