import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import dashboard from '../../../messages/en/dashboard.json';
import de from '../../../messages/de/dashboard.json';
import zh from '../../../messages/zh/dashboard.json';

const mocks = vi.hoisted(() => ({
  status: {
    data: undefined as
      | {
          mode: 'read-only' | 'active' | 'in-use' | 'cleanup-blocked';
          expiresAt?: string;
          remainingMutations: number;
        }
      | undefined,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  start: vi.fn(),
  finish: vi.fn(),
}));

vi.mock('@app/services/demoEditingService', () => ({
  DemoEditingService: {
    useStatus: () => mocks.status,
    useStart: () => ({ mutate: mocks.start, isPending: false }),
    useFinish: () => ({ mutate: mocks.finish, isPending: false }),
  },
}));

import { DemoControl } from '@app/components/Dashboard/DemoControl';

function renderControl(locale: 'en' | 'de' | 'zh' = 'en') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ dashboard: { en: dashboard, de, zh }[locale] }}
    >
      <DemoControl />
    </NextIntlClientProvider>
  );
}

describe('DemoControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.status.isPending = false;
    mocks.status.isError = false;
  });

  it.each([
    [
      'en',
      /one temporary Match and one temporary Announcement/,
      /Existing demo data remains read-only/,
      /12 changes left/,
      'Finish editing',
    ],
    [
      'de',
      /ein temporäres Spiel und eine temporäre Ankündigung/,
      /Demo-Daten bleiben schreibgeschützt/,
      /12 Änderungen/,
      de.demo.finish,
    ],
    [
      'zh',
      /一场临时比赛和一条临时公告/,
      /原有演示数据仍为只读/,
      /12 次/,
      zh.demo.finish,
    ],
  ] as const)('explains the %s scratch scope before secondary quota and lets the owner finish', async (locale, scope, readOnly, quota, finish) => {
    mocks.status.data = {
      mode: 'active',
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      remainingMutations: 12,
    };
    renderControl(locale);

    const guidance = screen.getByText(scope);
    expect(guidance).toHaveTextContent(readOnly);
    const quotaLine = screen.getByText(quota);
    expect(quotaLine).toHaveClass('text-xs');
    expect(
      guidance.compareDocumentPosition(quotaLine) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: finish }));
    expect(mocks.finish).toHaveBeenCalledOnce();
  });

  it('keeps browsing available while another visitor owns the lease', () => {
    mocks.status.data = { mode: 'in-use', remainingMutations: 0 };
    renderControl();

    expect(screen.getByText(/Another visitor/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start demo editing' })
    ).toBeDisabled();
  });

  it('offers bounded cleanup recovery without implying write access', async () => {
    mocks.status.data = { mode: 'cleanup-blocked', remainingMutations: 0 };
    renderControl();

    expect(screen.getByText(/could not be safely cleared/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Retry safe cleanup' })
    );
    expect(mocks.start).toHaveBeenCalledOnce();
  });

  it('returns an elapsed cached lease to an actionable read-only state', () => {
    mocks.status.data = {
      mode: 'active',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      remainingMutations: 10,
    };
    renderControl();

    expect(screen.getByText('Read-only demo')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start demo editing' })
    ).toBeEnabled();
  });

  it('presents backend unavailability as retryable rather than empty data', async () => {
    mocks.status.data = undefined;
    mocks.status.isError = true;
    renderControl();

    expect(screen.getByText(/temporarily unavailable/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.status.refetch).toHaveBeenCalledOnce();
  });
});
