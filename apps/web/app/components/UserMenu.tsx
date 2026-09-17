'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { UserIcon, LogOut, User, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@app/hooks/useAuth';
import { Button } from '@app/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@app/components/ui/sheet';
import { canUseDashboard } from '@app/lib/access/permissions';

interface UserMenuProps {
  lang: string;
}

export default function UserMenu({ lang }: UserMenuProps) {
  const t = useTranslations('common');
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  const displayName = user.fullName || `${user.lastName}, ${user.firstName}`;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 h-8 px-2 sm:h-9 sm:px-3"
          title={displayName}
        >
          <UserIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="hidden max-w-32 truncate text-sm sm:inline-block 2xl:max-w-48">
            {displayName}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[300px] sm:w-[350px]"
        closeLabel={t('userMenu.close')}
      >
        <SheetHeader>
          <SheetTitle className="text-left">{t('userMenu.title')}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="px-2 py-3 bg-gray-50 rounded-md">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>

          <div className="space-y-2">
            {canUseDashboard(user) && (
              <Button
                asChild
                variant="ghost"
                className="w-full justify-start gap-2"
              >
                <Link
                  href={`/${lang}/dashboard`}
                  onClick={() => setIsOpen(false)}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  {t('dashboard')}
                </Link>
              </Button>
            )}
            {!user.demoMode && (
              <Button
                asChild
                variant="ghost"
                className="w-full justify-start gap-2"
              >
                <Link
                  href={`/${lang}/account`}
                  onClick={() => setIsOpen(false)}
                >
                  <User className="h-4 w-4" />
                  {t('userMenu.account')}
                </Link>
              </Button>
            )}
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              {t('logout')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
