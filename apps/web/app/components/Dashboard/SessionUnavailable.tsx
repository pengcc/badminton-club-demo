'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@app/components/ui/button';

interface SessionUnavailableProps {
  title: string;
  description: string;
  retryLabel: string;
}

export function SessionUnavailable({
  title,
  description,
  retryLabel,
}: SessionUnavailableProps) {
  const router = useRouter();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-16">
      <div
        role="alert"
        className="w-full space-y-4 rounded-lg border bg-card p-8 text-center"
      >
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        <Button type="button" onClick={() => router.refresh()}>
          {retryLabel}
        </Button>
      </div>
    </main>
  );
}
