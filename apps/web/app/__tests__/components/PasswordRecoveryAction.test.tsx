import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import { PasswordRecoveryAction } from '../../components/Dashboard/PasswordRecoveryAction';

const messages = {
  dashboard: {
    languageOptions: {
      de: 'German',
      en: 'English',
      zh: 'Chinese',
    },
    passwordRecovery: {
      action: 'Send recovery',
      sending: 'Sending…',
      actionFor: 'Send password recovery for {name}',
      languageFor: 'Recovery email language for {name}',
      sent: 'Sent',
      failed: 'Failed',
      uncertain: 'Uncertain',
      requestFailed: 'Request failed',
    },
  },
};

function renderAction(presentation: 'inline' | 'standalone-menu') {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });

  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={queryClient}>
        <PasswordRecoveryAction
          userId="member-1"
          accountName="Member, Test"
          presentation={presentation}
        />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('PasswordRecoveryAction presentations', () => {
  afterEach(() => cleanup());

  it('preserves the inline locale selector used by Player Management', () => {
    renderAction('inline');

    expect(
      screen.getByRole('combobox', {
        name: 'Recovery email language for Member, Test',
      })
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: 'Send password recovery for Member, Test',
      })
    ).toBeVisible();
  });

  it('does not expose a standing locale selector in the Member presentation', () => {
    renderAction('standalone-menu');

    expect(
      screen.queryByRole('combobox', {
        name: 'Recovery email language for Member, Test',
      })
    ).toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'Send password recovery for Member, Test',
      })
    ).toBeVisible();
  });
});
