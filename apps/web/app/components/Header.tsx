'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Logo from './Logo';
import ShowcaseNotice from './ShowcaseNotice';
import MainNav from './MainNav';
import LanguageSwitcher from './LanguageSwitcher';
import UserMenu from './UserMenu';
import { Button } from './ui/button';
import { UserIcon } from 'lucide-react';

interface HeaderProps {
  intent?: 'discovery' | 'focused' | 'neutral' | 'product';
  lang: string;
  showLanguageSwitcher?: boolean;
  showHomeLink?: boolean;
  activitiesEnabled?: boolean;
}

export default function Header({
  intent = 'product',
  lang,
  showLanguageSwitcher = true,
  showHomeLink = true,
  activitiesEnabled = false,
}: HeaderProps) {
  const t = useTranslations('common');

  return (
    <>
      {intent === 'discovery' && (
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[60] -translate-y-24 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {t('accessibility.skipToContent')}
        </a>
      )}
      <header className="sticky p-4 flex justify-between items-center top-0 z-50 bg-card shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Logo />
            {intent === 'discovery' && (
              <MainNav activitiesEnabled={activitiesEnabled} />
            )}
            {intent === 'focused' && showHomeLink && (
              <Link
                href={`/${lang}`}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-primary"
              >
                {t('navigation.home')}
              </Link>
            )}
            {/* Right side: User Menu and Language switcher */}
            <div className="flex items-center gap-2 sm:gap-4">
              {intent === 'product' ? (
                <UserMenu lang={lang} />
              ) : intent === 'discovery' ? (
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/${lang}/login`}>{t('navigation.tryDemo')}</Link>
                </Button>
              ) : (
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9"
                >
                  <Link
                    href={`/${lang}/account`}
                    aria-label={t('userMenu.account')}
                    title={t('userMenu.account')}
                  >
                    <UserIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Link>
                </Button>
              )}
              {showLanguageSwitcher && <LanguageSwitcher />}
            </div>
          </div>
        </div>
      </header>
      {(intent === 'discovery' || intent === 'product') && <ShowcaseNotice />}
    </>
  );
}
