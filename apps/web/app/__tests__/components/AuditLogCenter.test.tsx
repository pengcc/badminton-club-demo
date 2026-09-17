import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditEventType, EntityType } from '@club/shared-types/core/enums';
import dashboardMessagesDe from '../../../messages/de/dashboard.json';
import dashboardMessages from '../../../messages/en/dashboard.json';
import dashboardMessagesZh from '../../../messages/zh/dashboard.json';
import AuditLogCenter, {
  AUDIT_ENTITY_FILTER_OPTIONS,
  AUDIT_EVENT_FILTER_OPTIONS,
} from '../../components/Dashboard/AuditLogCenter';
import { AuditService } from '../../services/auditService';

vi.mock('../../services/auditService', () => ({
  AuditService: {
    useAuditLogs: vi.fn(),
  },
}));

vi.mock('@app/components/ui/select', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const SelectContext = ReactModule.createContext<{
    value: string;
    onValueChange: (value: string) => void;
  }>({ value: '', onValueChange: () => {} });

  return {
    Select: ({ value, onValueChange, children }: any) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        {children}
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: any) => <div role="combobox">{children}</div>,
    SelectValue: () => null,
    SelectContent: ({ children }: any) => <div>{children}</div>,
    SelectItem: ({ value, children }: any) => {
      const select = ReactModule.useContext(SelectContext);
      return (
        <button
          type="button"
          role="option"
          aria-selected={select.value === value}
          onClick={() => select.onValueChange(value)}
        >
          {children}
        </button>
      );
    },
  };
});

vi.mock('../../components/Dashboard/modals/AuditDetailsModal', () => ({
  default: () => null,
}));

const auditLog = {
  id: '507f1f77bcf86cd799439012',
  eventType: AuditEventType.USER_UPDATED,
  entityType: EntityType.USER,
  entityId: '507f1f77bcf86cd799439013',
  actorId: '507f1f77bcf86cd799439014',
  actorAccountKind: 'person',
  actorDisplayName: 'Administrator, Ada',
  source: 'human',
  createdAt: '2026-08-09T08:00:00.000Z',
};

const refetch = vi.fn();
const useAuditLogsMock = vi.mocked(AuditService.useAuditLogs);

function queryState(data: unknown, overrides: Record<string, unknown> = {}) {
  return {
    data,
    isLoading: false,
    isLoadingError: false,
    isRefetchError: false,
    isFetching: false,
    refetch,
    ...overrides,
  } as ReturnType<typeof AuditService.useAuditLogs>;
}

function response(logs = [auditLog], total = logs.length) {
  return {
    success: true,
    data: logs,
    pagination: {
      total,
      limit: 50,
      offset: 0,
      hasMore: total > 50,
    },
  };
}

function renderAuditLogCenter() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ dashboard: dashboardMessages }}
      onError={() => {}}
    >
      <AuditLogCenter />
    </NextIntlClientProvider>
  );
}

describe('AuditLogCenter correctness states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuditLogsMock.mockReturnValue(queryState(response()));
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a bounded retry state instead of an empty state after initial failure', () => {
    useAuditLogsMock.mockReturnValue(
      queryState(undefined, { isLoadingError: true })
    );

    renderAuditLogCenter();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to load audit records'
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(
      screen.queryByText(/No records are available/)
    ).not.toBeInTheDocument();
  });

  it('retries an initial failure and can reach a genuine current-view empty state', async () => {
    const user = userEvent.setup();
    useAuditLogsMock.mockReturnValue(
      queryState(undefined, { isLoadingError: true })
    );
    const view = renderAuditLogCenter();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();

    useAuditLogsMock.mockReturnValue(queryState(response([], 0)));
    view.rerender(
      <NextIntlClientProvider
        locale="en"
        messages={{ dashboard: dashboardMessages }}
        onError={() => {}}
      >
        <AuditLogCenter />
      </NextIntlClientProvider>
    );

    expect(
      screen.getByText(/No records are available in the current view/)
    ).toBeInTheDocument();
  });

  it('keeps loaded records visible and marks a failed refresh as stale', () => {
    useAuditLogsMock.mockReturnValue(
      queryState(response(), { isRefetchError: true })
    );

    renderAuditLogCenter();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Audit records may be out of date'
    );
    expect(screen.getByText('Administrator, Ada')).toBeInTheDocument();
  });

  it('names the mobile View action with privacy-safe row context', () => {
    renderAuditLogCenter();

    const timestamp = new Intl.DateTimeFormat('en', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(auditLog.createdAt));
    const viewButton = screen.getByRole('button', {
      name: `View audit log details for ${auditLog.actorDisplayName} at ${timestamp}`,
    });

    expect(viewButton.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });

  it('distinguishes current-view empty results from selected-filter results', async () => {
    const user = userEvent.setup();
    useAuditLogsMock.mockReturnValue(queryState(response([], 0)));

    renderAuditLogCenter();
    expect(
      screen.getByText(/No records are available in the current view/)
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('option', { name: 'Guest Play request decided' })
    );

    expect(
      screen.getByText(/No records match the selected filters/)
    ).toBeInTheDocument();
  });

  it('presents free-text search as current-page-only', async () => {
    const user = userEvent.setup();
    renderAuditLogCenter();

    expect(
      screen.getByText('Search applies only to the currently loaded page.')
    ).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'Search the current page' }),
      'missing@example.test'
    );

    expect(
      screen.getByText('No matches on the current page.')
    ).toBeInTheDocument();
    expect(screen.getByText('0 matches on this page')).toBeInTheDocument();
  });

  it('resets the server offset when an event filter changes', async () => {
    const user = userEvent.setup();
    useAuditLogsMock.mockReturnValue(queryState(response([auditLog], 75)));
    renderAuditLogCenter();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(useAuditLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 50 })
      )
    );

    await user.click(
      screen.getByRole('option', { name: 'Guest Play request decided' })
    );

    await waitFor(() =>
      expect(useAuditLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.GUEST_PLAY_DECIDED,
          offset: 0,
        })
      )
    );
  });
});

describe('Audit filter vocabulary', () => {
  it('derives every event and entity choice from the shared read vocabulary', () => {
    expect(AUDIT_EVENT_FILTER_OPTIONS.map(({ value }) => value)).toEqual(
      Object.values(AuditEventType)
    );
    expect(AUDIT_ENTITY_FILTER_OPTIONS.map(({ value }) => value)).toEqual(
      Object.values(EntityType)
    );
  });

  it('preserves curated labels and includes retained historical values', () => {
    expect(AUDIT_EVENT_FILTER_OPTIONS).toContainEqual({
      value: AuditEventType.TEAM_PLAYER_ADDED,
      label: 'Player Added to Team',
    });
    expect(AUDIT_EVENT_FILTER_OPTIONS).toContainEqual({
      value: AuditEventType.MATCH_SCORE_UPDATED,
      label: 'Match Score Updated',
    });
    expect(AUDIT_ENTITY_FILTER_OPTIONS).toContainEqual({
      value: EntityType.MEMBERSHIP_TERMINATION,
      label: 'Membership Termination',
    });
  });

  it('keeps every Audit correctness message available in de, en, and zh', () => {
    const expectedKeys = Object.keys(dashboardMessages.auditLog).sort();

    expect(Object.keys(dashboardMessagesDe.auditLog).sort()).toEqual(
      expectedKeys
    );
    expect(Object.keys(dashboardMessagesZh.auditLog).sort()).toEqual(
      expectedKeys
    );
  });
});
