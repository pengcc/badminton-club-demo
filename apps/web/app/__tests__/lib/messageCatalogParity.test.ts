import { describe, expect, it } from 'vitest';
import commonDe from '../../../messages/de/common.json';
import commonEn from '../../../messages/en/common.json';
import commonZh from '../../../messages/zh/common.json';
import dashboardDe from '../../../messages/de/dashboard.json';
import dashboardEn from '../../../messages/en/dashboard.json';
import dashboardZh from '../../../messages/zh/dashboard.json';
import accountDe from '../../../messages/de/account.json';
import accountEn from '../../../messages/en/account.json';
import accountZh from '../../../messages/zh/account.json';
import loginDe from '../../../messages/de/login.json';
import loginEn from '../../../messages/en/login.json';
import loginZh from '../../../messages/zh/login.json';
import matchDe from '../../../messages/de/match.json';
import matchEn from '../../../messages/en/match.json';
import matchZh from '../../../messages/zh/match.json';
import passwordSetupDe from '../../../messages/de/passwordSetup.json';
import passwordSetupEn from '../../../messages/en/passwordSetup.json';
import passwordSetupZh from '../../../messages/zh/passwordSetup.json';
import passwordRecoveryDe from '../../../messages/de/passwordRecovery.json';
import passwordRecoveryEn from '../../../messages/en/passwordRecovery.json';
import passwordRecoveryZh from '../../../messages/zh/passwordRecovery.json';

function leafKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

function stringLeaves(
  value: unknown,
  prefix = '',
  result: Record<string, string> = {}
) {
  if (typeof value === 'string') {
    result[prefix] = value;
    return result;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      stringLeaves(child, prefix ? `${prefix}.${key}` : key, result);
    }
  }
  return result;
}

function placeholderIds(message: string) {
  return [...message.matchAll(/\{\s*([A-Za-z][A-Za-z0-9_]*)\s*(?:[,}])/g)]
    .map((match) => match[1])
    .sort();
}

const catalogs = [
  ['common', commonDe, commonEn, commonZh],
  ['login', loginDe, loginEn, loginZh],
  ['passwordSetup', passwordSetupDe, passwordSetupEn, passwordSetupZh],
  [
    'passwordRecovery',
    passwordRecoveryDe,
    passwordRecoveryEn,
    passwordRecoveryZh,
  ],
  ['dashboard', dashboardDe, dashboardEn, dashboardZh],
  ['account', accountDe, accountEn, accountZh],
  ['match', matchDe, matchEn, matchZh],
] as const;

describe('message catalog parity', () => {
  it.each([
    [
      'common user menu and error boundary',
      { userMenu: commonDe.userMenu, uiError: commonDe.uiError },
      { userMenu: commonEn.userMenu, uiError: commonEn.uiError },
      { userMenu: commonZh.userMenu, uiError: commonZh.uiError },
    ],
    [
      'common activities',
      commonDe.activities,
      commonEn.activities,
      commonZh.activities,
    ],
    [
      'dashboard shell and CMS',
      {
        shell: dashboardDe.shell,
        navigation: dashboardDe.navigation,
        accountKinds: dashboardDe.accountKinds,
        applicationCenter: dashboardDe.applicationCenter,
        applicationDecision: dashboardDe.applicationDecision,
        applicationContact: dashboardDe.applicationContact,
        playerManagement: dashboardDe.playerManagement,
        sharedDialogs: dashboardDe.sharedDialogs,
        dialogActions: dashboardDe.dialogActions,
        cms: dashboardDe.cms,
      },
      {
        shell: dashboardEn.shell,
        navigation: dashboardEn.navigation,
        accountKinds: dashboardEn.accountKinds,
        applicationCenter: dashboardEn.applicationCenter,
        applicationDecision: dashboardEn.applicationDecision,
        applicationContact: dashboardEn.applicationContact,
        playerManagement: dashboardEn.playerManagement,
        sharedDialogs: dashboardEn.sharedDialogs,
        dialogActions: dashboardEn.dialogActions,
        cms: dashboardEn.cms,
      },
      {
        shell: dashboardZh.shell,
        navigation: dashboardZh.navigation,
        accountKinds: dashboardZh.accountKinds,
        applicationCenter: dashboardZh.applicationCenter,
        applicationDecision: dashboardZh.applicationDecision,
        applicationContact: dashboardZh.applicationContact,
        playerManagement: dashboardZh.playerManagement,
        sharedDialogs: dashboardZh.sharedDialogs,
        dialogActions: dashboardZh.dialogActions,
        cms: dashboardZh.cms,
      },
    ],
  ])('keeps de/en/zh %s leaf keys aligned', (_scope, de, en, zh) => {
    const englishKeys = leafKeys(en).sort();

    expect(leafKeys(de).sort()).toEqual(englishKeys);
    expect(leafKeys(zh).sort()).toEqual(englishKeys);
  });

  it.each(
    catalogs
  )('keeps the complete %s catalog and placeholders aligned', (_namespace, de, en, zh) => {
    const englishKeys = leafKeys(en).sort();
    expect(leafKeys(de).sort()).toEqual(englishKeys);
    expect(leafKeys(zh).sort()).toEqual(englishKeys);

    const leaves = [stringLeaves(de), stringLeaves(en), stringLeaves(zh)];
    for (const key of englishKeys) {
      const expected = placeholderIds(leaves[1][key] ?? '');
      expect(placeholderIds(leaves[0][key] ?? '')).toEqual(expected);
      expect(placeholderIds(leaves[2][key] ?? '')).toEqual(expected);
    }
  });

  it('uses one Chinese term for Competition Teams across affected dashboard surfaces', () => {
    const competitionTeamCopy = JSON.stringify({
      teams: dashboardZh.teams,
      totalTeams: dashboardZh.total_teams,
      addTeam: dashboardZh.add_team,
      searchTeams: dashboardZh.search_teams,
      matchCenter: dashboardZh.matchCenter,
      playerManagement: dashboardZh.playerManagement,
      teamManagement: dashboardZh.teamManagement,
    });

    expect(competitionTeamCopy).toContain('球队');
    expect(competitionTeamCopy).not.toContain('团队');
  });

  it('keeps the Edit Member phone label in every production dashboard catalog', () => {
    expect({
      de: dashboardDe.form.phone,
      en: dashboardEn.form.phone,
      zh: dashboardZh.form.phone,
    }).toEqual({
      de: 'Telefon',
      en: 'Phone',
      zh: '电话',
    });
  });
});
