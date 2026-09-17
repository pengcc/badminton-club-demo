'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@app/hooks/useAuth';
import GuestPlayCenter from '@app/components/Dashboard/GuestPlayCenter';
import GuestPlayManagement from '@app/components/Dashboard/GuestPlayManagement';
import { hasCapability, isAdmin } from '@app/lib/access/permissions';
import { Capability } from '@club/shared-types/core/enums';

export default function GuestPlayPage() {
  const t = useTranslations('common');
  const { user } = useAuth();
  const userIsAdmin = isAdmin(user);
  const isCurrentMember = hasCapability(user, Capability.CURRENT_MEMBER);

  return (
    <div className="space-y-8">
      {isCurrentMember && (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t('guestPlay.title')}
            </h1>
            <p className="text-muted-foreground">{t('guestPlay.subtitle')}</p>
          </div>
          <GuestPlayCenter />
        </div>
      )}

      {/* Admin Section - Show only for admins */}
      {userIsAdmin && (
        <div>
          <div className="mb-6 pt-6 border-t">
            <h2 className="text-xl font-bold text-foreground mb-2">
              {t('guestPlay.admin.title')}
            </h2>
            <p className="text-muted-foreground">
              {t('guestPlay.admin.subtitle')}
            </p>
          </div>
          <GuestPlayManagement />
        </div>
      )}
    </div>
  );
}
