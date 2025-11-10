'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AuthService } from '@app/services/authService';
import { Badge } from '@app/components/ui/badge';
import {
  Users,
  Trophy,
  FileText,
  Calendar,
  UserPlus,
  Menu,
  X
} from 'lucide-react';
import Header from '@app/components/Header';
import { useState } from 'react';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  access: 'all' | 'admin' | 'player';
  badge?: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  lang: string;
  initialUser: any; // Server-fetched user data
}

export default function DashboardLayout({ children, lang, initialUser }: DashboardLayoutProps) {
  const t = useTranslations('dashboard');

  // Use session hook directly with initial server data
  const { data: user, isLoading } = AuthService.useSession(initialUser);

  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isPlayer = user?.role === 'member' || isAdmin;

  // Preload navigation targets on hover for better UX
  const handleNavHover = (path: string) => {
    if (path.includes('/members')) {
      import('./MemberCenter');
    } else if (path.includes('/matches')) {
      import('./MatchCenter');
    }
  };

  // Redirect to appropriate default page based on role
  useEffect(() => {
    if (!isLoading && user && pathname === `/${lang}/dashboard`) {
      const defaultPath = isAdmin ? `/${lang}/dashboard/members` : `/${lang}/dashboard/matches`;
      router.replace(defaultPath);
    }
  }, [user, isLoading, pathname, router, lang, isAdmin]);

  // Show loading skeleton while fetching user
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  const navigationItems: NavigationItem[] = [
    {
      id: 'members',
      label: t('members'),
      icon: Users,
      path: `/${lang}/dashboard/members`,
      access: 'admin'
    },
    {
      id: 'matches',
      label: t('matches'),
      icon: Trophy,
      path: `/${lang}/dashboard/matches`,
      access: 'player'
    },
    {
      id: 'applications',
      label: 'Applications',
      icon: FileText,
      path: `/${lang}/dashboard/applications`,
      access: 'admin',
      badge: 'Soon'
    },
    {
      id: 'training',
      label: 'Trial Training',
      icon: Calendar,
      path: `/${lang}/dashboard/training`,
      access: 'admin',
      badge: 'Soon'
    },
    {
      id: 'guests',
      label: 'Guest Play',
      icon: UserPlus,
      path: `/${lang}/dashboard/guests`,
      access: 'admin',
      badge: 'Soon'
    }
  ];

  const filteredNavigation = navigationItems.filter(item => {
    if (item.access === 'all') return true;
    if (item.access === 'admin') return isAdmin;
    if (item.access === 'player') return isPlayer || isAdmin;
    return false;
  });

  const currentItem = filteredNavigation.find(item => pathname.startsWith(item.path));

  const Sidebar = ({ className = '' }) => (
    <div className={`bg-card border-r border-border ${className}`}>
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">
          {t('dashboard')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {user.fullName || `${user.lastName}, ${user.firstName}`}
        </p>
        <Badge variant={isAdmin ? 'default' : 'secondary'} className="mt-2">
          {isAdmin ? 'Admin' : 'Member'}
        </Badge>
      </div>

      <nav className="p-4 space-y-2">
        {filteredNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.path);
          const isDisabled = !!item.badge;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (!isDisabled) {
                  router.push(item.path);
                  setSidebarOpen(false);
                }
              }}
              onMouseEnter={() => handleNavHover(item.path)}
              disabled={isDisabled}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : isDisabled
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <Badge variant="secondary" className="text-xs">
                  {item.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header withMainNav={false} lang={lang} />

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-64 min-h-screen">
          <Sidebar />
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed left-0 top-0 h-full w-64 z-50">
              <Sidebar />
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 min-h-screen">
          {/* Mobile Header with Menu Button */}
          <div className="lg:hidden bg-card border-b border-border p-4 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold">
              {currentItem?.label}
            </h1>
            <div></div> {/* Spacer for centering */}
          </div>

          {/* Content Area */}
          <div className="p-4 lg:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}