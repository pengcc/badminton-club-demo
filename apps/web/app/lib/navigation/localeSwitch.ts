import { languages } from '@messages/config';

interface LocaleSwitchLocation {
  pathname: string;
  search?: string;
  hash?: string;
  newLanguage: string;
}

export function buildLocaleSwitchHref({
  pathname,
  search = '',
  hash = '',
  newLanguage,
}: LocaleSwitchLocation): string {
  const segments = pathname.split('/');
  if (languages.includes(segments[1] as (typeof languages)[number])) {
    segments.splice(1, 1);
  }
  const pathWithoutLanguage = `/${segments.filter(Boolean).join('/')}`;
  const localizedPath = `/${newLanguage}${pathWithoutLanguage === '/' ? '' : pathWithoutLanguage}`;

  if (pathWithoutLanguage === '/' || pathWithoutLanguage === '/activities') {
    return `${localizedPath}${search}${hash}`;
  }

  if (pathWithoutLanguage === '/apply') {
    const registrationKey = new URLSearchParams(search).get('k');
    return registrationKey
      ? `${localizedPath}?${new URLSearchParams({ k: registrationKey })}`
      : localizedPath;
  }

  return localizedPath;
}
