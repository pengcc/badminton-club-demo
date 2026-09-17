'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { requestPasswordRecovery } from '@app/lib/api/authApi';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';

export default function PasswordRecoveryRequestClient() {
  const t = useTranslations('passwordRecovery');
  const locale = useLocale() as 'de' | 'en' | 'zh';
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await requestPasswordRecovery({ email, locale });
    } catch {
      // Public recovery deliberately presents the same confirmation for every outcome.
    } finally {
      setComplete(true);
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{t('requestTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {complete ? (
          <div className="space-y-4" role="status">
            <p>{t('genericConfirmation')}</p>
            <Button asChild className="w-full">
              <Link href={`/${locale}/login`}>{t('backToLogin')}</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <p className="text-sm text-muted-foreground">
              {t('requestDescription')}
            </p>
            <div className="space-y-2">
              <Label htmlFor="recovery-email">{t('email')}</Label>
              <Input
                id="recovery-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? t('requesting') : t('requestSubmit')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
