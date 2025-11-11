/**
 * Local Dashboard Account Page
 * Client-side only, uses LocalAdapter
 */

'use client';

import { DataManagement } from '@app/components/Storage';
import { Card, CardHeader, CardTitle, CardDescription } from '@app/components/ui/card';

export default function LocalAccountPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>
            Manage your local mode data and settings
          </CardDescription>
        </CardHeader>
      </Card>

      <DataManagement />
    </div>
  );
}
