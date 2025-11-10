'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/card';
import { Calendar, Clock } from 'lucide-react';

export default function TrainingPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Trial Training Applications
        </h1>
        <p className="text-muted-foreground">
          Manage trial training sessions and applications
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Feature Under Development</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              The trial training management system is currently being developed.
              This will allow admins to schedule trial sessions and manage applications.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}