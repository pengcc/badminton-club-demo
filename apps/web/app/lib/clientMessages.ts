import type { AbstractIntlMessages } from 'next-intl';

export const CLIENT_MESSAGE_NAMESPACES = {
  public: ['common'],
  login: ['common', 'login'],
  passwordSetup: ['common', 'passwordSetup'],
  passwordRecovery: ['common', 'passwordRecovery'],
  account: ['common', 'account', 'dashboard'],
  dashboard: ['common', 'dashboard', 'match'],
} as const;

export function selectClientMessages(
  messages: AbstractIntlMessages,
  namespaces: readonly string[]
): AbstractIntlMessages {
  return Object.fromEntries(
    namespaces.map((namespace) => [namespace, messages[namespace]])
  ) as AbstractIntlMessages;
}
