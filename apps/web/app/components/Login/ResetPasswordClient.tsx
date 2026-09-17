'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  getPasswordRecoveryStatus,
  resetRecoveredPassword,
} from '@app/lib/api/authApi';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';

export default function ResetPasswordClient() {
  const t = useTranslations('passwordRecovery');
  const locale = useLocale();
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>(
    'loading'
  );
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;
    const fragmentToken =
      new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    setToken(fragmentToken);
    if (!fragmentToken) {
      setStatus('invalid');
      return () => {
        active = false;
      };
    }
    void getPasswordRecoveryStatus(fragmentToken)
      .then((usable) => {
        if (active) setStatus(usable ? 'valid' : 'invalid');
      })
      .catch(() => {
        if (active) setStatus('invalid');
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError(t('minimum'));
    if (password !== confirmation) return setError(t('mismatch'));
    setSubmitting(true);
    try {
      await resetRecoveredPassword({
        token,
        password,
        passwordConfirmation: confirmation,
      });
      setComplete(true);
      window.history.replaceState(null, '', window.location.pathname);
    } catch {
      setStatus('invalid');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{t('resetTitle')}</CardTitle>
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
              <Link href={`/${locale}/forgot-password`}>
                {t('requestAnother')}
              </Link>
            </Button>
          </div>
        ) : complete ? (
          <div className="space-y-4" role="status">
            <p>{t('success')}</p>
            <Button asChild className="w-full">
              <Link href={`/${locale}/login`}>{t('backToLogin')}</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <p className="text-sm text-muted-foreground">
              {t('resetDescription')}
            </p>
            <div className="space-y-2">
              <Label htmlFor="recovery-password">{t('credentialLabel')}</Label>
              <Input
                id="recovery-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recovery-confirmation">{t('confirmation')}</Label>
              <Input
                id="recovery-confirmation"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
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
              {submitting ? t('submitting') : t('resetSubmit')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
