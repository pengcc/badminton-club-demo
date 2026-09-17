'use client';

import React, { useState } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@app/components/ui/tabs';
import EmailTemplateEditor from './EmailTemplateEditor';
import NotificationSettings from './NotificationSettings';
import MembershipSettings from './MembershipSettings';
import TeamPublicContentSettings from './TeamPublicContentSettings';
import { Mail, Bell, Users, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function SettingsCenter() {
  const t = useTranslations('dashboard.settingsCenter');
  const [activeTab, setActiveTab] = useState('notifications');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex overflow-x-auto gap-1 mb-6 pb-2 scrollbar-hide w-full max-w-full flex-wrap group-data-[orientation=horizontal]/tabs:h-fit">
          <TabsTrigger
            value="notifications"
            className="flex items-center gap-2"
          >
            <Bell className="h-4 w-4 hidden sm:inline" />
            <span>{t('notifications')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="email-templates"
            className="flex items-center gap-2"
          >
            <Mail className="h-4 w-4 hidden sm:inline" />
            <span>{t('emailTemplates')}</span>
          </TabsTrigger>
          <TabsTrigger value="membership" className="flex items-center gap-2">
            <Users className="h-4 w-4 hidden sm:inline" />
            <span>{t('membership')}</span>
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex items-center gap-2">
            <Trophy className="h-4 w-4 hidden sm:inline" />
            <span>{t('teams')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="email-templates">
          <EmailTemplateEditor />
        </TabsContent>

        <TabsContent value="membership">
          <MembershipSettings />
        </TabsContent>

        <TabsContent value="teams">
          <TeamPublicContentSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
