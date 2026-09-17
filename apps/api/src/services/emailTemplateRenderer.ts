import {
  assertEmailTemplateRenderContract,
  assertEmailTemplateSystemContract,
  type LocalizedTemplateContent,
} from './emailTemplateSystemContract';

export type EmailTemplateVariables = Record<string, unknown>;

function renderOriginalTemplateSyntax(
  template: string,
  variables: EmailTemplateVariables,
  renderValue: (value: unknown) => string
): string {
  return template.replace(
    /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}|{{\s*(\w+)\s*}}/g,
    (
      _match,
      conditionalVariable: string | undefined,
      content: string | undefined,
      placeholder: string | undefined
    ) => {
      if (conditionalVariable) {
        return variables[conditionalVariable]
          ? renderOriginalTemplateSyntax(content ?? '', variables, renderValue)
          : '';
      }

      return renderValue(variables[placeholder ?? '']);
    }
  );
}

function escapeHtmlVariable(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderEmailTemplateText(
  template: string,
  variables: EmailTemplateVariables
): string {
  return renderOriginalTemplateSyntax(template, variables, (value) =>
    String(value ?? '')
  );
}

export function renderEmailTemplateHtml(
  template: string,
  variables: EmailTemplateVariables
): string {
  return renderOriginalTemplateSyntax(template, variables, escapeHtmlVariable);
}

export function renderEmailTemplatePlainText(
  template: string,
  variables: EmailTemplateVariables
): string {
  return renderEmailTemplateHtml(template, variables)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function renderLocalizedEmailTemplate(input: {
  name: string;
  subject: LocalizedTemplateContent;
  body: LocalizedTemplateContent;
  locale: 'de' | 'en' | 'zh';
  variables: EmailTemplateVariables;
}): { subject: string; body: string; htmlBody: string } {
  assertEmailTemplateSystemContract(input.name, input.body);
  assertEmailTemplateRenderContract(input.name, input.locale, input.variables);

  const subject = input.subject[input.locale] || input.subject.de;
  const body = input.body[input.locale] || input.body.de;
  return {
    subject: renderEmailTemplateText(subject, input.variables),
    body: renderEmailTemplatePlainText(body, input.variables),
    htmlBody: renderEmailTemplateHtml(body, input.variables),
  };
}
