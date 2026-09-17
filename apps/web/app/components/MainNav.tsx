'use client';
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Button } from '@app/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@app/components/ui/sheet';

interface NavItem {
  key: string;
  href: string;
}

export function getDiscoveryNavItems(
  locale: string,
  activitiesEnabled = false
): NavItem[] {
  const home = `/${locale}`;

  const items = [
    { key: 'navigation.home', href: home },
    { key: 'navigation.training', href: `${home}#visit-us` },
    { key: 'navigation.teams', href: `${home}/teams` },
    { key: 'navigation.activities', href: `${home}/activities` },
    { key: 'navigation.join', href: `${home}#participation` },
    { key: 'navigation.contact', href: `${home}#contact` },
    { key: 'navigation.about', href: `${home}#about-us` },
    { key: 'navigation.documents', href: `${home}#documents` },
  ];

  return activitiesEnabled
    ? items
    : items.filter((item) => item.key !== 'navigation.activities');
}

export function isDiscoveryPageCurrent(
  pathname: string,
  href: string
): boolean {
  if (href.includes('#')) return false;
  const normalize = (value: string) => value.replace(/\/$/, '') || '/';
  return normalize(pathname) === normalize(href);
}

export default function MainNav({
  activitiesEnabled = false,
}: {
  activitiesEnabled?: boolean;
}) {
  const t = useTranslations('common');
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const navItems = getDiscoveryNavItems(locale, activitiesEnabled);

  return (
    <nav
      className="flex flex-1 justify-center bg-card"
      aria-label={t('navigation.discoveryLabel')}
    >
      <div className="flex items-center justify-center px-2">
        <div className="hidden items-center gap-4 whitespace-nowrap xl:flex 2xl:gap-6">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={
                isDiscoveryPageCurrent(pathname, item.href) ? 'page' : undefined
              }
              className="text-sm text-foreground transition-colors hover:text-primary 2xl:text-base"
            >
              {t(item.key)}
            </Link>
          ))}
        </div>
        <div className="xl:hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary"
                aria-label={t('navigation.openMenu')}
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              closeLabel={t('navigation.closeMenu')}
              className="max-h-dvh w-[300px] overflow-y-auto bg-background sm:w-[350px]"
            >
              <SheetHeader className="text-left">
                <SheetTitle className="text-xl font-bold text-primary">
                  {t('navigation.menuTitle')}
                </SheetTitle>
              </SheetHeader>
              <nav
                className="mt-8 flex flex-col gap-2"
                aria-label={t('navigation.discoveryMenuLabel')}
              >
                {navItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={
                      isDiscoveryPageCurrent(pathname, item.href)
                        ? 'page'
                        : undefined
                    }
                    onClick={() => setIsOpen(false)}
                    className="group flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-accent/50 hover:text-primary"
                  >
                    <span>{t(item.key)}</span>
                    <span
                      aria-hidden="true"
                      className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    >
                      →
                    </span>
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
