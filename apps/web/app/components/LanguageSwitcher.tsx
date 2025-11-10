'use client';

import { usePathname, useParams, useRouter } from 'next/navigation';
import { languages } from '@messages/config';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@app/components/ui/select"

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const { lang } = useParams();
  const router = useRouter();
  const currentLanguage = Array.isArray(lang) ? lang[0] : lang || 'en';

  const handleLanguageChange = (newLanguage: string) => {
    // Get current path without language prefix
    let pathWithoutLanguage = pathname;

    // Remove the current language from the path if it exists
    languages.forEach((lang) => {
      if (pathname.startsWith(`/${lang}/`)) {
        pathWithoutLanguage = pathname.replace(`/${lang}/`, '/');
      } else if (pathname === `/${lang}`) {
        pathWithoutLanguage = '/';
      }
    });

    // Build the new URL with the selected language
    const newPath = `/${newLanguage}${pathWithoutLanguage === '/' ? '' : pathWithoutLanguage}`;

    // Use Next.js router with refresh for language change
    router.push(newPath);
    router.refresh();
  };

  return (
    <div>
      <Select value={currentLanguage}
        onValueChange={(val) => handleLanguageChange(val)}
        >
        <SelectTrigger className="p-2 border rounded">
            <SelectValue placeholder={currentLanguage} />
        </SelectTrigger>
        <SelectContent>
            <SelectGroup>
            {languages.map((lng) => (
                <SelectItem key={lng} value={lng}>{lng.toUpperCase()}</SelectItem>
            ))}
            </SelectGroup>
          </SelectContent>
        </Select>
    </div>
  );
}