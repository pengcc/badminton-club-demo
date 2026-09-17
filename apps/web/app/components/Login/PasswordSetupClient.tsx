'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { getPasswordSetupStatus, setupPassword } from '@app/lib/api/authApi';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';

export default function PasswordSetupClient() {
  const t = useTranslations('passwordSetup');
  const locale = useLocale();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>(
    'loading'
  );

  useEffect(() => {
    let active = true;
    if (!token) {
      setStatus('invalid');
      return () => {
        active = false;
      };
    }
    void getPasswordSetupStatus(token)
      .then((usable) => {
        if (active) setStatus(usable ? 'valid' : 'invalid');
      })
      .catch(() => {
        if (active) setStatus('invalid');
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!token) return setError(t('invalid'));
    if (password.length < 8) return setError(t('minimum'));
    if (password !== confirmation) return setError(t('mismatch'));
    setSubmitting(true);
    try {
      await setupPassword({
        token,
        password,
        passwordConfirmation: confirmation,
      });
      setComplete(true);
    } catch {
      setError(t('invalid'));
      setStatus('invalid');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {status === 'loading' ? (
          <p role="status" aria-live="polite">
            {t('checking')}
          </p>
        ) : status === 'invalid' ? (
          <div className="space-y-4" role="alert">
            <p>{t('invalid')}</p>
            <Button asChild className="w-full">
              <Link href={`/${locale}/login`}>{t('login')}</Link>
            </Button>
          </div>
        ) : complete ? (
          <div className="space-y-4" role="status">
            <p>{t('success')}</p>
            <Button asChild className="w-full">
              <Link href={`/${locale}/login`}>{t('login')}</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('password')}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('confirmation')}</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? t('submitting') : t('submit')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
