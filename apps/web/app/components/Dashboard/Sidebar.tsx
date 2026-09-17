'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Api } from '@club/shared-types/api/auth';
import { Button } from '@app/components/ui/button';
import { Badge } from '@app/components/ui/badge';
import type { NavigationItem } from '@app/lib/navigation/dashboardNav';
import { Capability } from '@club/shared-types/core/enums';
import { hasCapability } from '@app/lib/access/permissions';

interface SidebarProps {
  user: Api.User;
  navigation: NavigationItem[];
  isAdmin: boolean;
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({
  user,
  navigation,
  isAdmin,
  onNavigate,
  className = '',
}: SidebarProps) {
  const t = useTranslations('dashboard');
  const pathname = usePathname();
  const accountLabel = isAdmin
    ? t('accountKinds.admin')
    : hasCapability(user, Capability.EXTERNAL_PLAYER)
      ? t('accountKinds.externalPlayer')
      : t('accountKinds.member');

  return (
    <div className={`bg-card border-r border-border ${className}`}>
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">
          {t('dashboard')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {user.fullName || `${user.lastName}, ${user.firstName}`}
        </p>
        <Badge variant={isAdmin ? 'default' : 'secondary'} className="mt-2">
          {accountLabel}
        </Badge>
      </div>

      <nav className="p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.path);
          const isDisabled = !!item.badge;

          const content = (
            <>
              <span className="flex items-center space-x-3">
                <Icon className="h-5 w-5" />
                <span>{t(item.labelKey)}</span>
              </span>
              {item.badge && (
                <Badge variant="secondary" className="text-xs">
                  {item.badge}
                </Badge>
              )}
            </>
          );

          if (isDisabled) {
            return (
              <Button
                key={item.id}
                variant={isActive ? 'default' : 'ghost'}
                disabled
                className="w-full justify-between"
              >
                {content}
              </Button>
            );
          }

          return (
            <Button
              key={item.id}
              variant={isActive ? 'default' : 'ghost'}
              className="w-full justify-between"
              asChild
            >
              <Link
                href={item.path}
                prefetch={true}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
              >
                {content}
              </Link>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
