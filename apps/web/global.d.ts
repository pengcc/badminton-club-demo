// Type definitions for next-intl
import en_common from './messages/en/common.json';
import en_login from './messages/en/login.json';
import en_dashboard from './messages/en/dashboard.json';
import en_account from './messages/en/account.json';

type Messages = {
  common: typeof en_common;
  login: typeof en_login;
  dashboard: typeof en_dashboard;
  account: typeof en_account;
};

declare interface IntlMessages extends Messages {}
