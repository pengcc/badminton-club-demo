'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/card';
import { UserPlus, Clock } from 'lucide-react';

export default function GuestsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Guest Play Applications
        </h1>
        <p className="text-muted-foreground">
          Manage guest player requests and court reservations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Feature Under Development</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              The guest play management system is currently being developed.
              This will allow admins to manage guest requests and court scheduling.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}