import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { EntityType } from '@club/shared-types/core/enums';
import dashboardMessages from '../../../messages/en/dashboard.json';
import dashboardZh from '../../../messages/zh/dashboard.json';
import AuditDetailsModal from '../../components/Dashboard/modals/AuditDetailsModal';
import type { AuditLog } from '../../services/auditService';

const baseLog: AuditLog = {
  id: '507f1f77bcf86cd799439012',
  eventType: 'match_updated',
  entityType: EntityType.MATCH,
  entityId: '507f1f77bcf86cd799439013',
  actorId: '507f1f77bcf86cd799439014',
  actorAccountKind: 'person',
  actorDisplayName: 'Administrator, Ada',
  source: 'human',
  createdAt: '2026-08-12T08:00:00.000Z',
};

function renderModal(
  log: AuditLog,
  locale = 'en',
  messages: typeof dashboardMessages | typeof dashboardZh = dashboardMessages
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ dashboard: messages }}>
      <AuditDetailsModal isOpen onClose={vi.fn()} log={log} />
    </NextIntlClientProvider>
  );
}

describe('AuditDetailsModal redacted changes', () => {
  it('exposes a semantic close action', () => {
    renderModal(baseLog);

    expect(
      screen
        .getAllByRole('button', { name: 'Close' })
        .some((button) => button.dataset.size === 'icon')
    ).toBe(true);
  });

  it('describes a field-only change without implying that nothing changed', () => {
    renderModal({
      ...baseLog,
      changes: [{ field: 'arrivalGuidance' }],
    });

    expect(screen.getByText('Arrival guidance')).toBeVisible();
    expect(screen.queryByText('arrivalGuidance')).not.toBeInTheDocument();
    expect(
      screen.getByText('Changed; value details were not retained.')
    ).toBeVisible();
    expect(screen.queryByText('— → —')).not.toBeInTheDocument();
  });

  it('renders a natural Audit field label in Chinese', () => {
    renderModal(
      { ...baseLog, changes: [{ field: 'arrivalGuidance' }] },
      'zh',
      dashboardZh
    );

    expect(screen.getByText('到场说明')).toBeVisible();
    expect(screen.queryByText('arrivalGuidance')).not.toBeInTheDocument();
  });

  it('preserves the existing before-and-after presentation when values exist', () => {
    renderModal({
      ...baseLog,
      changes: [
        {
          field: 'location',
          oldValue: 'Old hall',
          newValue: 'New hall',
        },
      ],
    });

    expect(screen.getByText('Old hall → New hall')).toBeVisible();
  });

  it('localizes Membership status transitions in Chinese', () => {
    renderModal(
      {
        ...baseLog,
        changes: [
          {
            field: 'membershipStatus',
            oldValue: 'active',
            newValue: 'inactive',
          },
        ],
      },
      'zh',
      dashboardZh
    );

    expect(screen.getByText('活跃 → 不活跃')).toBeVisible();
    expect(screen.queryByText('active → inactive')).not.toBeInTheDocument();
  });
});
