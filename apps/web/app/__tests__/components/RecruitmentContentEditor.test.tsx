import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', async () => {
  const { dashboardTranslator } = await import('../testI18nMock');
  return {
    useLocale: () => 'en',
    useTranslations: dashboardTranslator,
  };
});

const mocks = vi.hoisted(() => ({
  recruitmentQuery: {
    data: undefined as any,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  contactsQuery: {
    data: [] as any[] | undefined,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  recruitmentUpdate: { mutateAsync: vi.fn(), isPending: false },
  publish: vi.fn(),
  retry: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.success,
    warning: mocks.warning,
    error: mocks.error,
  },
}));
vi.mock('@app/services/recruitmentPublicContentService', () => ({
  RecruitmentPublicContentService: {
    useContent: () => mocks.recruitmentQuery,
    useUpdateContent: () => mocks.recruitmentUpdate,
  },
}));
vi.mock('@app/services/contactEntryService', () => ({
  ContactEntryService: {
    useEntries: () => mocks.contactsQuery,
  },
}));
vi.mock('@app/hooks/usePublication', () => ({
  usePublication: () => ({
    hasPublicationFailure: false,
    isRetrying: false,
    publish: mocks.publish,
    retry: mocks.retry,
  }),
}));

import RecruitmentContentEditor from '@app/components/Dashboard/RecruitmentContentEditor';

const localized = (de: string, en = '', zh = '') => ({ de, en, zh });
const recruitment = {
  isOpen: false,
  introduction: localized('Erfahrene Spieler'),
  requirements: localized('Wettkampferfahrung'),
  tryoutGuidance: localized('Kontakt aufnehmen'),
  contactEntryId: null,
};

describe('RecruitmentContentEditor', () => {
  beforeEach(() => {
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
    vi.clearAllMocks();
    mocks.recruitmentQuery.data = {
      content: recruitment,
      completeness: {},
      contactAvailable: false,
      updatedAt: null,
    };
    mocks.contactsQuery.data = [];
    mocks.contactsQuery.isPending = false;
    mocks.contactsQuery.isError = false;
    mocks.recruitmentUpdate.mutateAsync.mockResolvedValue({
      content: recruitment,
    });
    mocks.publish.mockResolvedValue(true);
  });

  it('preserves localized field and translation-completeness guidance', () => {
    render(<RecruitmentContentEditor />);

    expect(screen.getByDisplayValue('Erfahrene Spieler')).toBeVisible();
    expect(screen.getByLabelText('Translation completeness')).toBeVisible();
    expect(
      screen.getByText('Introduction: Missing: English, Chinese')
    ).toBeVisible();
  });

  it('saves paused Recruitment with a real null Contact value', async () => {
    render(<RecruitmentContentEditor />);
    const heading = screen.getByText('Team recruitment public information');
    const card = heading.closest('[data-slot="card"]');
    if (!card) throw new Error('Recruitment editor card missing');

    fireEvent.click(
      within(card as HTMLElement).getByRole('button', {
        name: 'Save and publish',
      })
    );

    await waitFor(() =>
      expect(mocks.recruitmentUpdate.mutateAsync).toHaveBeenCalledWith(
        recruitment
      )
    );
    expect(mocks.publish).toHaveBeenCalledWith('recruitment');
  });

  it('uses the shared Select and sends the selected active Contact identity', async () => {
    const user = userEvent.setup();
    mocks.contactsQuery.data = [
      {
        id: '507f1f77bcf86cd799439011',
        isActive: true,
        title: localized('Sportkontakt'),
        email: 'sport@example.test',
      },
    ];
    render(<RecruitmentContentEditor />);
    const heading = screen.getByText('Team recruitment public information');
    const card = heading.closest('[data-slot="card"]');
    if (!card) throw new Error('Recruitment editor card missing');

    await user.click(
      within(card as HTMLElement).getByLabelText('Recruitment status')
    );
    await user.click(screen.getByRole('option', { name: 'Open' }));
    await user.click(
      within(card as HTMLElement).getByLabelText('Tryout Contact route')
    );
    await user.click(
      screen.getByRole('option', {
        name: 'Sportkontakt — sport@example.test',
      })
    );
    await user.click(
      within(card as HTMLElement).getByRole('button', {
        name: 'Save and publish',
      })
    );

    await waitFor(() =>
      expect(mocks.recruitmentUpdate.mutateAsync).toHaveBeenCalledWith({
        ...recruitment,
        isOpen: true,
        contactEntryId: '507f1f77bcf86cd799439011',
      })
    );
  });

  it('clears a selected Contact back to the real null domain value', async () => {
    const user = userEvent.setup();
    const contactId = '507f1f77bcf86cd799439011';
    mocks.contactsQuery.data = [
      {
        id: contactId,
        isActive: true,
        title: localized('Sportkontakt'),
        email: 'sport@example.test',
      },
    ];
    mocks.recruitmentQuery.data = {
      content: { ...recruitment, contactEntryId: contactId },
      completeness: {},
      contactAvailable: true,
      updatedAt: null,
    };
    render(<RecruitmentContentEditor />);
    const heading = screen.getByText('Team recruitment public information');
    const card = heading.closest('[data-slot="card"]');
    if (!card) throw new Error('Recruitment editor card missing');

    await user.click(
      within(card as HTMLElement).getByLabelText('Tryout Contact route')
    );
    await user.click(
      screen.getByRole('option', { name: 'No Contact selected' })
    );
    await user.click(
      within(card as HTMLElement).getByRole('button', {
        name: 'Save and publish',
      })
    );

    await waitFor(() =>
      expect(mocks.recruitmentUpdate.mutateAsync).toHaveBeenCalledWith({
        ...recruitment,
        contactEntryId: null,
      })
    );
    expect(
      JSON.stringify(mocks.recruitmentUpdate.mutateAsync.mock.calls[0]?.[0])
    ).not.toContain('__none__');
  });

  it('reports persistence success separately when public refresh fails', async () => {
    mocks.publish.mockResolvedValue(false);
    render(<RecruitmentContentEditor />);
    const heading = screen.getByText('Team recruitment public information');
    const card = heading.closest('[data-slot="card"]');
    if (!card) throw new Error('Recruitment editor card missing');

    fireEvent.click(
      within(card as HTMLElement).getByRole('button', {
        name: 'Save and publish',
      })
    );

    await waitFor(() =>
      expect(mocks.warning).toHaveBeenCalledWith(
        'Recruitment information saved; public refresh failed'
      )
    );
    expect(mocks.recruitmentUpdate.mutateAsync).toHaveBeenCalledOnce();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('does not publish when Recruitment persistence fails', async () => {
    mocks.recruitmentUpdate.mutateAsync.mockRejectedValue(new Error('failed'));
    render(<RecruitmentContentEditor />);
    const heading = screen.getByText('Team recruitment public information');
    const card = heading.closest('[data-slot="card"]');
    if (!card) throw new Error('Recruitment editor card missing');

    fireEvent.click(
      within(card as HTMLElement).getByRole('button', {
        name: 'Save and publish',
      })
    );

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        'Recruitment information could not be saved'
      )
    );
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(within(card as HTMLElement).getByRole('alert')).toHaveTextContent(
      'Recruitment information could not be saved'
    );
  });

  it('maps the backend active-Contact race back to the Contact selector', async () => {
    const user = userEvent.setup();
    const contactId = '507f1f77bcf86cd799439011';
    mocks.contactsQuery.data = [
      {
        id: contactId,
        isActive: true,
        title: localized('Sportkontakt'),
        email: 'sport@example.test',
      },
    ];
    mocks.recruitmentQuery.data = {
      content: { ...recruitment, isOpen: true, contactEntryId: contactId },
      completeness: {},
      contactAvailable: true,
      updatedAt: null,
    };
    mocks.recruitmentUpdate.mutateAsync.mockRejectedValueOnce({
      response: { data: { code: 'RECRUITMENT_ACTIVE_CONTACT_REQUIRED' } },
    });
    render(<RecruitmentContentEditor />);
    const card = screen
      .getByText('Team recruitment public information')
      .closest('[data-slot="card"]');
    if (!card) throw new Error('Recruitment editor card missing');

    fireEvent.click(
      within(card as HTMLElement).getByRole('button', {
        name: 'Save and publish',
      })
    );

    const contact = within(card as HTMLElement).getByLabelText(
      'Tryout Contact route'
    );
    await waitFor(() =>
      expect(contact).toHaveAttribute('aria-invalid', 'true')
    );
    expect(within(card as HTMLElement).getByRole('alert')).toHaveTextContent(
      'Open Recruitment requires an active Contact route.'
    );
    fireEvent.change(
      within(card as HTMLElement).getByLabelText('Introduction'),
      { target: { value: 'Aktualisierte Einführung' } }
    );
    expect(contact).toHaveAttribute('aria-invalid', 'true');
    await user.click(
      within(card as HTMLElement).getByLabelText('Recruitment status')
    );
    await user.click(screen.getByRole('option', { name: 'Paused' }));
    expect(contact).toHaveAttribute('aria-invalid', 'false');
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('distinguishes initial Contact dependency failure from cached stale data', async () => {
    const user = userEvent.setup();
    mocks.contactsQuery.data = undefined;
    mocks.contactsQuery.isError = true;
    const { rerender } = render(<RecruitmentContentEditor />);
    expect(
      screen.getByText(
        'Contact routes could not be loaded. Retry before opening Recruitment.'
      )
    ).toBeInTheDocument();

    mocks.contactsQuery.data = [
      {
        id: '507f1f77bcf86cd799439011',
        isActive: true,
        title: localized('Sportkontakt'),
        email: 'sport@example.test',
      },
    ];
    rerender(<RecruitmentContentEditor />);
    expect(
      screen.getByText(
        'Contact routes may be out of date. Previously loaded routes remain available.'
      )
    ).toBeInTheDocument();
    await user.click(screen.getByLabelText('Tryout Contact route'));
    expect(
      screen.getByText('Sportkontakt — sport@example.test')
    ).toBeInTheDocument();
  });

  it('does not turn a stored Contact into an active-Contact blocker while the dependency is pending or unavailable', async () => {
    const contactId = '507f1f77bcf86cd799439011';
    mocks.recruitmentQuery.data = {
      content: { ...recruitment, isOpen: true, contactEntryId: contactId },
      completeness: {},
      contactAvailable: true,
      updatedAt: null,
    };
    mocks.contactsQuery.data = undefined;
    mocks.contactsQuery.isPending = true;
    const { rerender } = render(<RecruitmentContentEditor />);
    const card = screen
      .getByText('Team recruitment public information')
      .closest('[data-slot="card"]');
    if (!card) throw new Error('Recruitment editor card missing');

    expect(
      within(card as HTMLElement).getByText(
        'Contact routes are still loading. Wait before saving open Recruitment.'
      )
    ).toBeInTheDocument();
    expect(
      within(card as HTMLElement).queryByText(
        'The saved Contact route is missing or inactive. Select another active Contact before opening Recruitment.'
      )
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(card as HTMLElement).getByRole('button', {
        name: 'Save and publish',
      })
    );
    expect(mocks.recruitmentUpdate.mutateAsync).not.toHaveBeenCalled();
    expect(within(card as HTMLElement).getByRole('alert')).toHaveTextContent(
      'Contact routes are still loading.'
    );

    mocks.contactsQuery.isPending = false;
    mocks.contactsQuery.isError = true;
    rerender(<RecruitmentContentEditor />);
    expect(within(card as HTMLElement).getByRole('alert')).toHaveTextContent(
      'Contact routes could not be loaded.'
    );
    expect(
      within(card as HTMLElement).getByRole('alert')
    ).not.toHaveTextContent(
      'Open Recruitment requires an active Contact route.'
    );
    expect(
      within(card as HTMLElement).queryByText(
        'The saved Contact route is missing or inactive. Select another active Contact before opening Recruitment.'
      )
    ).not.toBeInTheDocument();
  });

  it('keeps stale cached Contact absence non-blocking and lets the backend decide on save', async () => {
    const contactId = '507f1f77bcf86cd799439011';
    const openRecruitment = {
      ...recruitment,
      isOpen: true,
      contactEntryId: contactId,
    };
    mocks.recruitmentQuery.data = {
      content: openRecruitment,
      completeness: {},
      contactAvailable: true,
      updatedAt: null,
    };
    mocks.contactsQuery.data = [];
    mocks.contactsQuery.isError = true;
    render(<RecruitmentContentEditor />);
    const card = screen
      .getByText('Team recruitment public information')
      .closest('[data-slot="card"]');
    if (!card) throw new Error('Recruitment editor card missing');

    expect(
      within(card as HTMLElement).getByText(
        'Contact routes may be out of date. Previously loaded routes remain available.'
      )
    ).toBeInTheDocument();
    expect(
      within(card as HTMLElement).queryByText(
        'The saved Contact route is missing or inactive. Select another active Contact before opening Recruitment.'
      )
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(card as HTMLElement).getByRole('button', {
        name: 'Save and publish',
      })
    );

    await waitFor(() =>
      expect(mocks.recruitmentUpdate.mutateAsync).toHaveBeenCalledWith(
        openRecruitment
      )
    );
    expect(
      within(card as HTMLElement).queryByRole('alert')
    ).not.toBeInTheDocument();
  });

  it('projects semantic invalid state onto the shared Contact trigger', async () => {
    mocks.recruitmentQuery.data = {
      content: { ...recruitment, isOpen: true },
      completeness: {},
      contactAvailable: false,
      updatedAt: null,
    };
    render(<RecruitmentContentEditor />);
    const heading = screen.getByText('Team recruitment public information');
    const card = heading.closest('[data-slot="card"]');
    if (!card) throw new Error('Recruitment editor card missing');

    fireEvent.click(
      within(card as HTMLElement).getByRole('button', {
        name: 'Save and publish',
      })
    );

    const trigger = within(card as HTMLElement).getByLabelText(
      'Tryout Contact route'
    );
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute(
      'aria-describedby',
      'recruitment-contact-error'
    );
    expect(mocks.recruitmentUpdate.mutateAsync).not.toHaveBeenCalled();
  });
});
