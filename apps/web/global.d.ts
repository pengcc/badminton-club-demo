// Type definitions for next-intl
import type en_common from './messages/en/common.json';
import type en_login from './messages/en/login.json';
import type en_dashboard from './messages/en/dashboard.json';
import type en_account from './messages/en/account.json';

type Messages = {
  common: typeof en_common;
  login: typeof en_login;
  dashboard: typeof en_dashboard;
  account: typeof en_account;
};

declare interface IntlMessages extends Messages {}
