'use client';

import { usePathname, useParams, useRouter } from 'next/navigation';
import { languages } from '@messages/config';
import { buildLocaleSwitchHref } from '@app/lib/navigation/localeSwitch';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const { lang } = useParams();
  const router = useRouter();
  const t = useTranslations('common');
  const currentLanguage = Array.isArray(lang) ? lang[0] : lang || 'en';

  const handleLanguageChange = (newLanguage: string) => {
    const newPath = buildLocaleSwitchHref({
      pathname,
      search: window.location.search,
      hash: window.location.hash,
      newLanguage,
    });

    // Use Next.js router with refresh for language change
    router.push(newPath);
    router.refresh();
  };

  return (
    <div>
      <Select
        value={currentLanguage}
        onValueChange={(val) => handleLanguageChange(val)}
      >
        <SelectTrigger
          className="p-2 border rounded"
          aria-label={t('navigation.languageSelector')}
        >
          <SelectValue placeholder={currentLanguage} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {languages.map((lng) => (
              <SelectItem key={lng} value={lng}>
                {lng.toUpperCase()}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
