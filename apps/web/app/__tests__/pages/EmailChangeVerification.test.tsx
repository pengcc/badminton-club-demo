import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import de from '@messages/de/common.json';
import en from '@messages/en/common.json';
import zh from '@messages/zh/common.json';

const state = vi.hoisted(() => {
  const push = vi.fn();
  return {
    lang: 'en',
    token: 'One_Time_Token',
    push,
    router: { push },
    get: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ lang: state.lang, token: state.token }),
  useRouter: () => state.router,
}));
vi.mock('@app/components/Header', () => ({
  default: ({
    intent,
    showLanguageSwitcher,
  }: {
    intent: string;
    showLanguageSwitcher: boolean;
  }) => (
    <div
      data-testid="header"
      data-intent={intent}
      data-language-switcher={String(showLanguageSwitcher)}
    />
  ),
}));
vi.mock('@app/lib/api/client', () => ({
  default: { get: state.get },
}));

import VerifyEmailChangePage from '@app/[lang]/verify-email-change/[token]/page';

const localeMessages = { de, en, zh } as const;

interface VerificationResponse {
  data: { data: { email: string } };
}

function deferredResponse() {
  let resolve!: (value: VerificationResponse) => void;
  const promise = new Promise<VerificationResponse>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderPage(locale: keyof typeof localeMessages) {
  state.lang = locale;
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ common: localeMessages[locale] }}
    >
      <VerifyEmailChangePage />
    </NextIntlClientProvider>
  );
}

describe('localized email-change verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.get.mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each([
    ['de', 'E-Mail-Änderung wird bestätigt'],
    ['en', 'Verifying email change'],
    ['zh', '正在验证邮箱更改'],
  ] as const)('renders localized focused loading state for %s', (locale, title) => {
    renderPage(locale);

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByTestId('header')).toHaveAttribute(
      'data-intent',
      'focused'
    );
    expect(screen.getByTestId('header')).toHaveAttribute(
      'data-language-switcher',
      'false'
    );
  });

  it('uses bounded localized failure wording without transport details', async () => {
    state.get.mockRejectedValueOnce(new Error('sensitive transport detail'));
    renderPage('en');

    expect(
      await screen.findByRole('heading', { name: 'Verification failed' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('We could not verify this email change.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('sensitive transport detail')
    ).not.toBeInTheDocument();
  });

  it('cancels the delayed account redirect when the user leaves after success', async () => {
    const request = deferredResponse();
    state.get.mockReturnValueOnce(request.promise);
    vi.useFakeTimers();
    const view = renderPage('en');

    await vi.waitFor(() => expect(state.get).toHaveBeenCalledOnce());
    await act(async () => {
      request.resolve({ data: { data: { email: 'new@example.com' } } });
      await request.promise;
    });

    expect(
      screen.getByRole('heading', { name: 'Email verified' })
    ).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);

    view.unmount();

    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(3000);
    expect(state.push).not.toHaveBeenCalled();
  });

  it('does not schedule a redirect when verification resolves after leaving', async () => {
    const request = deferredResponse();
    state.get.mockReturnValueOnce(request.promise);
    vi.useFakeTimers();
    const view = renderPage('en');

    await vi.waitFor(() => expect(state.get).toHaveBeenCalledOnce());
    view.unmount();

    await act(async () => {
      request.resolve({ data: { data: { email: 'new@example.com' } } });
      await request.promise;
    });

    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(3000);
    expect(state.push).not.toHaveBeenCalled();
  });
});
