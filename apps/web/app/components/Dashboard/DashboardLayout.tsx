'use client';

import React, { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@app/hooks/useAuth';
import { Button } from '@app/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@app/components/ui/sheet';
import { Menu } from 'lucide-react';
import Header from '@app/components/Header';
import {
  getDashboardNavigation,
  normalizeDashboardPath,
} from '@app/lib/navigation/dashboardNav';
import { isAdmin, getFilteredNavigation } from '@app/lib/access/permissions';
import { Sidebar } from './Sidebar';
import { DemoControl } from './DemoControl';

interface DashboardLayoutProps {
  children: React.ReactNode;
  lang: string;
}

export default function DashboardLayout({
  children,
  lang,
}: DashboardLayoutProps) {
  const t = useTranslations('dashboard.shell');
  const tDashboard = useTranslations('dashboard');
  const { user, sessionRefreshFailed, retrySession } = useAuth();

  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userIsAdmin = isAdmin(user);

  // Navigation hooks - must be called unconditionally (before early returns)
  const navigationItems = useMemo(() => getDashboardNavigation(lang), [lang]);

  const filteredNavigation = useMemo(
    () => getFilteredNavigation(user, navigationItems),
    [user, navigationItems]
  );

  const currentItem = useMemo(() => {
    const normalizedPathname = normalizeDashboardPath(pathname, lang);
    return filteredNavigation.find((item) =>
      normalizedPathname.startsWith(item.path)
    );
  }, [filteredNavigation, pathname, lang]);

  const isDashboardRoot = pathname === `/${lang}/dashboard`;
  const isAllowedDemoPath =
    !user.demoMode ||
    [
      `/${lang}/dashboard`,
      `/${lang}/dashboard/members`,
      `/${lang}/dashboard/matches`,
      `/${lang}/dashboard/content`,
      `/${lang}/dashboard/content/communication`,
    ].includes(pathname);
  if ((!isDashboardRoot && !currentItem) || !isAllowedDemoPath) {
    const fallbackPath = filteredNavigation[0]?.path ?? `/${lang}/account`;
    return (
      <div className="min-h-screen bg-background">
        <Header intent="product" lang={lang} />
        <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
          <div role="alert" className="space-y-4 rounded-lg border bg-card p-8">
            <h1 className="text-2xl font-semibold text-foreground">
              {t('accessDeniedTitle')}
            </h1>
            <p className="text-muted-foreground">
              {t('accessDeniedDescription')}
            </p>
            <Button onClick={() => router.push(fallbackPath)}>
              {t('goToAvailableArea')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header intent="product" lang={lang} />

      {user.demoMode && <DemoControl />}

      {sessionRefreshFailed && (
        <div
          role="status"
          className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <span>{t('sessionRefreshFailed')}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void retrySession()}
            >
              {t('retrySession')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-64 min-h-screen">
          <Sidebar
            user={user}
            navigation={filteredNavigation}
            isAdmin={userIsAdmin}
          />
        </div>

        {/* Main Content */}
        <div className="min-w-0 flex-1 min-h-screen">
          {/* Mobile Header with Menu Button */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <div className="lg:hidden bg-card border-b border-border p-4 flex items-center justify-between">
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('openNavigation')}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <h1 className="text-lg font-semibold">
                {currentItem
                  ? tDashboard(currentItem.labelKey)
                  : tDashboard('dashboard')}
              </h1>
              <div aria-hidden="true" />
            </div>
            <SheetContent
              side="left"
              closeLabel={t('closeNavigation')}
              className="w-64 p-0 sm:max-w-none"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>{t('mobileNavigationTitle')}</SheetTitle>
              </SheetHeader>
              <Sidebar
                user={user}
                navigation={filteredNavigation}
                isAdmin={userIsAdmin}
                onNavigate={() => setSidebarOpen(false)}
                className="h-full border-r-0"
              />
            </SheetContent>
          </Sheet>

          {/* Content Area */}
          <div className="p-2 lg:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
