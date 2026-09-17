'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@app/hooks/useAuth';
import { hasCapability, isAdmin } from '@app/lib/access/permissions';
import { Capability } from '@club/shared-types/core/enums';

export function DashboardLandingRedirect() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const lang = (params?.lang as string) || 'en';

  useEffect(() => {
    const canUseMatches =
      hasCapability(user, Capability.CURRENT_MEMBER) ||
      hasCapability(user, Capability.ACTIVE_PLAYER);
    const defaultPath = isAdmin(user)
      ? `/${lang}/dashboard/members`
      : canUseMatches
        ? `/${lang}/dashboard/matches`
        : `/${lang}/account`;

    router.replace(defaultPath);
  }, [lang, router, user]);

  return null;
}
