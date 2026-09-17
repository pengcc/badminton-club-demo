import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../../../messages/en/common.json';
import dashboard from '../../../messages/en/dashboard.json';
import { renderWithIntl, screen, waitFor } from '../utils/renderWithIntl';
import TasterSessionFormClient from '../../components/TasterSessionFormClient';
import TasterSessionRequestCenter from '../../components/Dashboard/TasterSessionRequestCenter';

const service = vi.hoisted(() => ({
  options: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  stats: vi.fn(),
  disposition: vi.fn(),
  archive: vi.fn(),
  retry: vi.fn(),
}));

vi.mock('../../services/tasterSessionRequestService', () => ({
  TasterSessionRequestService: {
    usePreferenceOptions: service.options,
    useCreate: () => ({
      mutateAsync: service.create,
      isPending: false,
    }),
    useList: service.list,
    useStats: service.stats,
    useDisposition: () => ({
      mutateAsync: service.disposition,
      isPending: false,
    }),
    useArchive: () => ({
      mutateAsync: service.archive,
      isPending: false,
    }),
    useRetryDelivery: () => ({
      mutateAsync: service.retry,
      isPending: false,
    }),
  },
}));

const request = {
  id: 'request-1',
  name: 'Visitor',
  email: 'visitor@example.test',
  playerLevel: 'beginner' as const,
  status: 'pending' as const,
  archived: false,
  delivery: {
    status: 'not_requested' as const,
    retryAvailable: false,
  },
  locale: 'en' as const,
  version: 0,
  createdAt: '2026-07-31T10:00:00.000Z',
  updatedAt: '2026-07-31T10:00:00.000Z',
};

function renderIntl(element: React.ReactElement) {
  return renderWithIntl(element, {
    messages: { common: messages, dashboard },
  });
}

describe('Taster Session visitor and administrator workflows', () => {
  beforeEach(() => {
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
    vi.clearAllMocks();
    service.create.mockResolvedValue(request);
    service.disposition.mockResolvedValue({
      ...request,
      status: 'invited',
      version: 1,
    });
    service.archive.mockResolvedValue({
      ...request,
      archived: true,
      version: 1,
    });
    service.retry.mockResolvedValue({
      ...request,
      status: 'invited',
      delivery: { status: 'sent', retryAvailable: false },
      version: 2,
    });
    service.options.mockImplementation((level?: string) => ({
      data:
        level === 'beginner'
          ? [
              {
                id: 'preference-1',
                timeSlotId: 'slot-1',
                localDate: '2030-08-02',
                startTime: '19:00',
                endTime: '21:00',
                startsAt: '2030-08-02T17:00:00.000Z',
                endsAt: '2030-08-02T19:00:00.000Z',
                location: {
                  id: 'hall',
                  name: 'Main Hall',
                  address: 'Example Street',
                },
              },
            ]
          : undefined,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    }));
    service.list.mockReturnValue({
      data: { requests: [request], total: 1, limit: 50, offset: 0 },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    service.stats.mockReturnValue({
      data: { total: 1, pending: 1, invited: 0, declined: 0, archived: 0 },
    });
  });

  it('requires a matching server option and submits only its opaque identity and start', async () => {
    const user = userEvent.setup();
    renderIntl(<TasterSessionFormClient />);
    await user.click(screen.getByText('Beginner'));
    expect(screen.getByText('19:00–21:00')).toBeInTheDocument();
    expect(screen.getByText('Example Street')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Full name'), 'Visitor');
    await user.type(
      screen.getByLabelText('Email Address'),
      'visitor@example.test'
    );
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    expect(
      await screen.findByText('This field is required.')
    ).toBeInTheDocument();

    await user.click(screen.getByText('Main Hall'));
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    await waitFor(() =>
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          playerLevel: 'beginner',
          preference: {
            optionId: 'preference-1',
            startsAt: '2030-08-02T17:00:00.000Z',
          },
        })
      )
    );
  });

  it('projects public text-field errors through the shared input contract', async () => {
    const user = userEvent.setup();
    renderIntl(<TasterSessionFormClient />);
    await user.click(screen.getByText('Beginner'));

    await user.click(screen.getByRole('button', { name: 'Submit Request' }));

    const name = screen.getByLabelText('Full name');
    const email = screen.getByLabelText('Email Address');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAttribute('aria-describedby', 'name-error');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAttribute('aria-describedby', 'email-error');
    expect(service.create).not.toHaveBeenCalled();
  });

  it('does not repeat the page-level request heading inside the initial form card', () => {
    renderIntl(<TasterSessionFormClient />);

    expect(
      screen.queryByRole('heading', { name: 'Request a Taster Session' })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Tell us about yourself/)).toBeInTheDocument();
  });

  it('allows submission without a preference when no matching option exists and explains follow-up', async () => {
    service.options.mockImplementation((level?: string) => ({
      data: level ? [] : undefined,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    }));
    const user = userEvent.setup();
    renderIntl(<TasterSessionFormClient />);
    await user.click(screen.getByText('Experienced'));
    expect(
      screen.getByText(/There is no matching active option right now/)
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('Full name'), 'Visitor');
    await user.type(
      screen.getByLabelText('Email Address'),
      'visitor@example.test'
    );
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    await waitFor(() =>
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({ preference: undefined })
      )
    );
  });

  it('localizes a backend stale-preference rejection', async () => {
    service.create.mockRejectedValue({
      response: {
        status: 400,
        data: { error: 'The selected preference is no longer available' },
      },
    });
    const user = userEvent.setup();
    renderIntl(<TasterSessionFormClient />);
    await user.click(screen.getByText('Beginner'));
    await user.click(screen.getByText('Main Hall'));
    await user.type(screen.getByLabelText('Full name'), 'Visitor');
    await user.type(
      screen.getByLabelText('Email Address'),
      'visitor@example.test'
    );
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));

    expect(
      await screen.findByText(
        'The preference options changed. Review the current choices and submit again.'
      )
    ).toBeInTheDocument();
  });

  it('defaults to hiding archived requests and exposes no hard-delete or reopen action', () => {
    renderIntl(<TasterSessionRequestCenter />);
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ archived: 'exclude' })
    );
    expect(
      screen.getByRole('button', { name: 'Set outcome' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /delete|reopen/i })
    ).not.toBeInTheDocument();
  });

  it('shows administrator preference times in Europe/Berlin', () => {
    service.list.mockReturnValue({
      data: {
        requests: [
          {
            ...request,
            preference: {
              optionId: 'preference-1',
              startsAt: '2030-08-02T17:00:00.000Z',
              locationId: 'hall',
              locationName: 'Main Hall',
            },
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderIntl(<TasterSessionRequestCenter />);

    expect(screen.getByText(/2 Aug 2030, 19:00/)).toBeInTheDocument();
  });

  it('sends one explicit terminal command with a separate email choice', async () => {
    const user = userEvent.setup();
    renderIntl(<TasterSessionRequestCenter />);

    await user.click(screen.getByRole('button', { name: 'Set outcome' }));
    expect(
      screen.getByRole('dialog', { name: 'Record visitor outcome' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Outcome')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Confirm outcome' }));

    await waitFor(() =>
      expect(service.disposition).toHaveBeenCalledWith({
        id: request.id,
        command: {
          expectedVersion: request.version,
          disposition: 'invited',
          adminNotes: undefined,
          declineReason: undefined,
          declineReasonDetails: undefined,
          sendEmail: true,
        },
      })
    );
  });

  it.each([
    ['de', 'German'],
    ['en', 'English'],
    ['zh', 'Chinese'],
  ] as const)('shows the stored %s visitor language beside recipient-visible decline detail', async (requestLocale, language) => {
    service.list.mockReturnValue({
      data: {
        requests: [{ ...request, locale: requestLocale }],
        total: 1,
        limit: 50,
        offset: 0,
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderIntl(<TasterSessionRequestCenter />);

    await user.click(screen.getByRole('button', { name: 'Set outcome' }));
    await user.click(screen.getByLabelText('Outcome'));
    await user.click(screen.getByRole('option', { name: 'Declined' }));
    await user.click(screen.getByLabelText('Decline reason'));
    await user.click(screen.getByRole('option', { name: 'Another reason' }));

    expect(
      screen.getByText(
        `Write this visitor-visible detail in ${language}. If an outcome email is sent, it will be included unchanged.`
      )
    ).toBeVisible();
    expect(
      screen.getByText(
        "Internal only. These notes are not included in the visitor's email."
      )
    ).toBeVisible();
  });

  it('keeps no-email decline guidance truthful and preserves the unchecked command', async () => {
    const user = userEvent.setup();
    renderIntl(<TasterSessionRequestCenter />);

    await user.click(screen.getByRole('button', { name: 'Set outcome' }));
    await user.click(screen.getByLabelText('Outcome'));
    await user.click(screen.getByRole('option', { name: 'Declined' }));
    await user.click(screen.getByLabelText('Decline reason'));
    await user.click(screen.getByRole('option', { name: 'Another reason' }));
    await user.type(screen.getByLabelText('Reason details'), 'Try next month');
    await user.type(screen.getByLabelText('Administrator notes'), 'Internal');
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Send the visitor an outcome email',
      })
    );

    expect(
      screen.getByText(
        'Write this visitor-visible detail in English. If an outcome email is sent, it will be included unchanged.'
      )
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Confirm outcome' }));

    await waitFor(() =>
      expect(service.disposition).toHaveBeenCalledWith({
        id: request.id,
        command: {
          expectedVersion: request.version,
          disposition: 'declined',
          adminNotes: 'Internal',
          declineReason: 'other',
          declineReasonDetails: 'Try next month',
          sendEmail: false,
        },
      })
    );
  });

  it('closes a stale disposition modal when the conflict contains a terminal latest record', async () => {
    service.disposition.mockRejectedValueOnce({
      response: {
        data: {
          code: 'TASTER_SESSION_STATE_CONFLICT',
          details: {
            latest: {
              ...request,
              status: 'invited',
              dispositionAt: '2026-07-31T10:05:00.000Z',
              delivery: {
                status: 'not_requested',
                retryAvailable: false,
              },
              version: 1,
              updatedAt: '2026-07-31T10:05:00.000Z',
            },
          },
        },
      },
    });
    const user = userEvent.setup();
    renderIntl(<TasterSessionRequestCenter />);

    await user.click(screen.getByRole('button', { name: 'Set outcome' }));
    await user.click(screen.getByRole('button', { name: 'Confirm outcome' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Record visitor outcome' })
      ).not.toBeInTheDocument()
    );
    expect(
      screen.getByText(
        'This request changed. The list has been refreshed; review the latest state before trying again.'
      )
    ).toBeInTheDocument();
  });

  it('keeps terminal status, archive state, and uncertain email retry visibly separate', async () => {
    const user = userEvent.setup();
    const uncertain = {
      ...request,
      status: 'invited' as const,
      archived: true,
      version: 4,
      delivery: {
        status: 'uncertain' as const,
        retryAvailable: true,
      },
    };
    service.list.mockReturnValue({
      data: { requests: [uncertain], total: 1, limit: 50, offset: 0 },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderIntl(<TasterSessionRequestCenter />);
    expect(
      screen.queryByRole('button', { name: 'Set outcome' })
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('Invited').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Archived').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Retrying may send a duplicate email/)
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry email' }));
    expect(service.retry).toHaveBeenCalledWith({
      id: uncertain.id,
      expectedVersion: uncertain.version,
    });
    await user.click(screen.getByRole('button', { name: 'Unarchive' }));
    expect(service.archive).toHaveBeenCalledWith({
      id: uncertain.id,
      expectedVersion: uncertain.version,
      archived: false,
    });

    await user.click(screen.getByLabelText('Archive filter'));
    await user.click(screen.getByRole('option', { name: 'Include archived' }));
    expect(service.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ archived: 'include' })
    );
  });
});
