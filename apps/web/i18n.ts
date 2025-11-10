import {getRequestConfig} from 'next-intl/server';

/**
 * Lazy-load translations only for the requested locale.
 * Keeps translations organized by namespace for easy maintenance,
 * but only loads what's needed for each request.
 *
 * To add a new namespace:
 * 1. Create {namespace}.json in each locale folder
 * 2. Add the import statement in the loadMessages function below
 */
async function loadMessages(locale: string) {
  // Dynamic imports with explicit paths - Next.js can code-split these
  // Only the requested locale's translations will be loaded
  const [common, login, dashboard, account, match] = await Promise.all([
    import(`./messages/${locale}/common.json`),
    import(`./messages/${locale}/login.json`),
    import(`./messages/${locale}/dashboard.json`),
    import(`./messages/${locale}/account.json`),
    import(`./messages/${locale}/match.json`),
  ]);

  return {
    common: common.default,
    login: login.default,
    dashboard: dashboard.default,
    account: account.default,
    match: match.default,
  };
}

export default getRequestConfig(async ({requestLocale}) => {
  const locale = (await requestLocale) || 'en';

  // Validate locale and fallback to 'de' if invalid
  const validLocales = ['en', 'de', 'zh'];
  const finalLocale = validLocales.includes(locale) ? locale : 'de';

  return {
    locale: finalLocale,
    messages: await loadMessages(finalLocale),
  };
});
