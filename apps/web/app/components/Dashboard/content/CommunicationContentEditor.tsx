'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@app/components/ui/tabs';
import ActivityManager from '../ActivityManager';
import AnnouncementManager from '../AnnouncementManager';
import { ContentDomainHeader } from './ContentDomainHeader';
import { useOptionalAuth } from '@app/hooks/useAuth';

export default function CommunicationContentEditor() {
  const t = useTranslations('dashboard.cms.content');
  const [activeTab, setActiveTab] = useState('announcements');
  const demoMode = Boolean(useOptionalAuth()?.user.demoMode);

  return (
    <div>
      <ContentDomainHeader domain="communication" />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-2 items-stretch gap-1 group-data-[orientation=horizontal]/tabs:h-auto">
          <TabsTrigger
            value="announcements"
            className="h-auto min-w-0 break-all whitespace-normal py-2"
          >
            {t('domains.communication.tabs.announcements')}
          </TabsTrigger>
          <TabsTrigger
            value="activities"
            className="h-auto min-w-0 break-all whitespace-normal py-2"
          >
            {t('domains.communication.tabs.activities')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="announcements">
          <AnnouncementManager />
        </TabsContent>
        <TabsContent value="activities">
          <ActivityManager readOnly={demoMode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
