'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MailCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import {
  requestApplicantAccess,
  requestApplicantVerification,
} from '@app/lib/api/membershipApplicationApi';

export default function MembershipApplicantEmailEntry({
  mode,
  accessToken,
}: {
  mode: 'initial' | 'access';
  accessToken?: string;
}) {
  const locale = useLocale() as 'de' | 'en' | 'zh';
  const t = useTranslations('common.membershipApplicant');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setRequestFailed(false);
    try {
      if (mode === 'initial' && accessToken) {
        await requestApplicantVerification(email, locale, accessToken);
      } else {
        await requestApplicantAccess(email, locale);
      }
      setSent(true);
    } catch {
      setRequestFailed(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader className="text-center">
        <MailCheck
          className="mx-auto size-10 text-primary"
          aria-hidden="true"
        />
        <CardTitle>
          {mode === 'initial' ? t('verifyTitle') : t('accessTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p
            className="text-center text-sm text-muted-foreground"
            role="status"
          >
            {t('sent')}
          </p>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <p className="text-sm text-muted-foreground">{t('emailPrivacy')}</p>
            {requestFailed && (
              <p className="text-sm text-destructive" role="alert">
                {t('requestFailed')}
              </p>
            )}
            <label className="block space-y-2 text-sm font-medium">
              {t('email')}
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <Button className="w-full" disabled={sending} type="submit">
              {sending ? t('sending') : requestFailed ? t('retry') : t('send')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
