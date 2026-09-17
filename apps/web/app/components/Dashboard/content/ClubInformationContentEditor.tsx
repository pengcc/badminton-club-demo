'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@app/components/ui/tabs';
import ClubInformationEditor from '../ClubInformationEditor';
import ContactEntryManager from '../ContactEntryManager';
import LocationManager from '../LocationManager';
import { ContentDomainHeader } from './ContentDomainHeader';

export default function ClubInformationContentEditor() {
  const t = useTranslations('dashboard.cms.content');
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div>
      <ContentDomainHeader domain="clubInformation" />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-3 items-stretch gap-1 group-data-[orientation=horizontal]/tabs:h-auto">
          <TabsTrigger
            value="profile"
            className="h-auto min-w-0 break-all whitespace-normal py-2"
          >
            {t('domains.clubInformation.tabs.profile')}
          </TabsTrigger>
          <TabsTrigger
            value="locations"
            className="h-auto min-w-0 break-all whitespace-normal py-2"
          >
            {t('domains.clubInformation.tabs.locations')}
          </TabsTrigger>
          <TabsTrigger
            value="contact"
            className="h-auto min-w-0 break-all whitespace-normal py-2"
          >
            {t('domains.clubInformation.tabs.contact')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ClubInformationEditor />
        </TabsContent>
        <TabsContent value="locations">
          <LocationManager />
        </TabsContent>
        <TabsContent value="contact">
          <ContactEntryManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
