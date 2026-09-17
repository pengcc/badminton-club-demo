import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import enDashboard from '../../../messages/en/dashboard.json';
import deDashboard from '../../../messages/de/dashboard.json';
import zhDashboard from '../../../messages/zh/dashboard.json';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  preview: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  templateForId: vi.fn(),
  detailError: false,
  detailFetching: false,
  refetch: vi.fn(),
}));

const template = {
  _id: 'password-setup-template',
  name: 'member_password_setup',
  subject: { de: 'Zugang', en: 'Access', zh: '访问' },
  body: {
    de: '{{firstName}} {{lastName}} {{email}} Link {{resetLink}} gültig {{expiresIn}}',
    en: '{{firstName}} {{lastName}} {{email}} Link {{resetLink}} valid {{expiresIn}}',
    zh: '{{firstName}} {{lastName}} {{email}} 链接 {{resetLink}} 有效期 {{expiresIn}}',
  },
  variables: ['firstName', 'lastName', 'email', 'resetLink', 'expiresIn'],
  isActive: true,
  systemContract: {
    senderStatus: 'current',
    owner: 'Account Onboarding',
    supportedLocales: ['de', 'en', 'zh'],
    availableVariables: [
      'firstName',
      'lastName',
      'email',
      'resetLink',
      'expiresIn',
    ],
    requiredVariables: ['resetLink', 'expiresIn'],
  },
};

const unconsumedTemplate = {
  ...template,
  _id: 'application-approved-template',
  name: 'application_approved',
  systemContract: {
    senderStatus: 'unconsumed' as const,
    owner: null,
    supportedLocales: [],
    availableVariables: [],
    requiredVariables: [],
  },
};

vi.mock('@app/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      aria-label="Select Template"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => (
    <option value="">{placeholder}</option>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
}));
vi.mock('@app/services/emailTemplateService', () => ({
  EmailTemplateService: {
    useTemplateList: () => ({
      data: [template, unconsumedTemplate],
      isLoading: false,
    }),
    useTemplate: (id: string | null) => ({
      data: mocks.templateForId(id),
      isError: mocks.detailError,
      isFetching: mocks.detailFetching,
      refetch: mocks.refetch,
    }),
    useUpdateTemplate: () => ({ mutateAsync: mocks.update, isPending: false }),
    usePreviewTemplate: () => ({
      mutateAsync: mocks.preview,
      isPending: false,
      data: { subject: 'Zugang', body: 'Link [resetLink] gültig [expiresIn]' },
    }),
  },
}));
vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

import EmailTemplateEditor from '@app/components/Dashboard/EmailTemplateEditor';

function renderEditor(
  locale = 'en',
  messages: typeof enDashboard = enDashboard
) {
  return render(<EmailTemplateEditor />, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider
        locale={locale}
        messages={{ dashboard: messages }}
      >
        {children}
      </NextIntlClientProvider>
    ),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.detailError = false;
  mocks.detailFetching = false;
  mocks.templateForId.mockImplementation((id: string | null) =>
    id === unconsumedTemplate._id ? unconsumedTemplate : id ? template : null
  );
  mocks.update.mockResolvedValue({});
  mocks.preview.mockResolvedValue({
    subject: 'Zugang',
    body: 'Link [resetLink] gültig [expiresIn]',
  });
});

describe('EmailTemplateEditor system contract experience', () => {
  it('edits localized content while keeping system fields outside the form', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.selectOptions(
      screen.getByLabelText('Select Template'),
      template._id
    );
    const body = await screen.findByLabelText('Body');
    expect(
      screen.getByRole('button', { name: 'German', pressed: true })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'English', pressed: false })
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'English', pressed: false })
    );
    expect(
      screen.getByRole('button', { name: 'English', pressed: true })
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'German', pressed: false })
    );
    fireEvent.change(body, {
      target: {
        value:
          'Eigener Text {{firstName}} {{lastName}} {{email}} {{resetLink}} / {{expiresIn}}',
      },
    });
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith({
      id: template._id,
      data: expect.objectContaining({
        body: expect.objectContaining({
          de: 'Eigener Text {{firstName}} {{lastName}} {{email}} {{resetLink}} / {{expiresIn}}',
        }),
      }),
    });
    expect(screen.queryByLabelText(/template name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/variables/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Owner: Account Onboarding/)).toBeInTheDocument();
    expect(screen.getByText('Required variables:')).toBeInTheDocument();
  });

  it('previews with every system-owned variable and surfaces contract errors', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.selectOptions(
      screen.getByLabelText('Select Template'),
      template._id
    );
    await screen.findByLabelText('Body');

    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(mocks.preview).toHaveBeenCalledWith({
      id: template._id,
      data: {
        locale: 'de',
        subject: template.subject,
        body: template.body,
        variables: {
          firstName: '[firstName]',
          lastName: '[lastName]',
          email: '[email]',
          resetLink: '[resetLink]',
          expiresIn: '[expiresIn]',
        },
      },
    });
    expect(
      await screen.findByText('Link [resetLink] gültig [expiresIn]')
    ).toBeInTheDocument();

    mocks.update.mockRejectedValue({
      response: { data: { error: 'de: {{resetLink}} is required' } },
    });
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        'The template could not be updated. Review the required variables and try again.'
      )
    );
  });

  it('shows truthful unconsumed status without inferring retirement', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.selectOptions(
      screen.getByLabelText('Select Template'),
      unconsumedTemplate._id
    );

    expect(await screen.findByText('Unconsumed template')).toBeInTheDocument();
    expect(
      screen.getByText(
        /active or inactive state is preserved pending capability-owner confirmation/
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Catalog active')).toBeInTheDocument();
  });

  it('does not overwrite an owned draft when the selected detail refetches', async () => {
    const user = userEvent.setup();
    const { rerender } = renderEditor();
    await user.selectOptions(
      screen.getByLabelText('Select Template'),
      template._id
    );
    const body = await screen.findByLabelText('Body');
    await user.clear(body);
    await user.type(body, 'Unsaved administrator draft');

    mocks.templateForId.mockReturnValue({
      ...template,
      body: { ...template.body, de: 'Background server value' },
    });
    rerender(<EmailTemplateEditor />);

    expect(screen.getByLabelText('Body')).toHaveValue(
      'Unsaved administrator draft'
    );
  });

  it('does not initialize a selected template from stale cached detail while its first refetch is running', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.selectOptions(
      screen.getByLabelText('Select Template'),
      template._id
    );
    await user.clear(await screen.findByLabelText('Body'));
    await user.type(screen.getByLabelText('Body'), 'Template A draft');

    mocks.detailFetching = true;
    mocks.templateForId.mockImplementation((id: string | null) =>
      id === template._id ? template : unconsumedTemplate
    );
    await user.selectOptions(
      screen.getByLabelText('Select Template'),
      unconsumedTemplate._id
    );

    expect(screen.queryByLabelText('Body')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save Changes' })
    ).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('does not initialize stale cached detail when the first refetch fails', async () => {
    const user = userEvent.setup();
    mocks.detailError = true;
    mocks.templateForId.mockReturnValue(template);
    renderEditor();
    await user.selectOptions(
      screen.getByLabelText('Select Template'),
      template._id
    );

    expect(
      await screen.findByText(/No editable draft was opened/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save Changes' })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Select Template')).toHaveValue('');
  });

  it('keeps an initialized draft saveable through a background failure and successful retry', async () => {
    const user = userEvent.setup();
    const { rerender } = renderEditor();
    await user.selectOptions(
      screen.getByLabelText('Select Template'),
      template._id
    );
    const body = await screen.findByLabelText('Body');
    await user.clear(body);
    await user.type(body, 'Local draft survives refresh');

    mocks.detailError = true;
    mocks.templateForId.mockReturnValue({
      ...template,
      body: { ...template.body, de: 'Stale cached server value' },
    });
    rerender(<EmailTemplateEditor />);

    expect(screen.getByLabelText('Body')).toHaveValue(
      'Local draft survives refresh'
    );
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    expect(
      screen.getByText(/local draft is still open and unchanged/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No editable draft was opened/)
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Retry refresh' }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
    mocks.detailError = false;
    mocks.detailFetching = false;
    mocks.templateForId.mockReturnValue({
      ...template,
      body: { ...template.body, de: 'Fresh server value after retry' },
    });
    rerender(<EmailTemplateEditor />);

    expect(screen.getByLabelText('Body')).toHaveValue(
      'Local draft survives refresh'
    );
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });

  it('invalidates a preview as soon as its draft changes', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.selectOptions(
      screen.getByLabelText('Select Template'),
      template._id
    );
    await screen.findByLabelText('Body');
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(
      await screen.findByText('Link [resetLink] gültig [expiresIn]')
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Body'), ' changed');
    expect(
      screen.queryByText('Link [resetLink] gültig [expiresIn]')
    ).not.toBeInTheDocument();
  });

  it('localizes the active editor shell in German and Chinese', () => {
    const german = renderEditor('de', deDashboard);
    expect(screen.getByText('E-Mail-Vorlagen bearbeiten')).toBeInTheDocument();
    expect(screen.getByText('Vorlage auswählen')).toBeInTheDocument();
    german.unmount();

    renderEditor('zh', zhDashboard);
    expect(screen.getByText('电子邮件模板编辑器')).toBeInTheDocument();
    expect(screen.getByText('选择模板')).toBeInTheDocument();
  });
});
