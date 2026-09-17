import { describe, expect, it } from 'vitest';
import common from '../../../messages/de/common.json';
import dashboard from '../../../messages/de/dashboard.json';
import login from '../../../messages/de/login.json';
import match from '../../../messages/de/match.json';
import account from '../../../messages/de/account.json';
import passwordSetup from '../../../messages/de/passwordSetup.json';
import passwordRecovery from '../../../messages/de/passwordRecovery.json';
import {
  CLIENT_MESSAGE_NAMESPACES,
  selectClientMessages,
} from '@app/lib/clientMessages';

const allMessages = {
  common,
  dashboard,
  login,
  match,
  account,
  passwordSetup,
  passwordRecovery,
};

describe('client message selection', () => {
  it('ships only shared messages through the localized root', () => {
    expect(
      Object.keys(
        selectClientMessages(allMessages, CLIENT_MESSAGE_NAMESPACES.public)
      )
    ).toEqual(['common']);
  });

  it.each([
    ['login', ['common', 'login']],
    ['passwordSetup', ['common', 'passwordSetup']],
    ['passwordRecovery', ['common', 'passwordRecovery']],
    ['account', ['common', 'account', 'dashboard']],
    ['dashboard', ['common', 'dashboard', 'match']],
  ] as const)('provides the complete %s route namespace set', (route, expected) => {
    expect(
      Object.keys(
        selectClientMessages(allMessages, CLIENT_MESSAGE_NAMESPACES[route])
      )
    ).toEqual(expected);
  });
});
