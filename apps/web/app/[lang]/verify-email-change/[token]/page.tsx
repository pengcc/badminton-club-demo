'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Header from '@app/components/Header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function VerifyEmailChangePage() {
  const { lang, token } = useParams();
  const router = useRouter();
  const t = useTranslations('common.emailChangeVerification');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  );
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    let active = true;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;

    const verifyEmail = async () => {
      try {
        // Dynamic import to avoid circular dependencies
        const apiClient = (await import('@app/lib/api/client')).default;

        const response = await apiClient.get<{
          success: boolean;
          message: string;
          data: { email: string };
        }>(`/users/verify-email-change/${token}`);

        if (!active) return;

        setStatus('success');
        setNewEmail(response.data.data.email);

        // Redirect to account page after 3 seconds
        redirectTimer = setTimeout(() => {
          if (active) router.push(`/${lang}/account`);
        }, 3000);
      } catch {
        if (active) setStatus('error');
      }
    };

    if (token) {
      verifyEmail();
    }

    return () => {
      active = false;
      if (redirectTimer !== undefined) clearTimeout(redirectTimer);
    };
  }, [token, lang, router]);

  return (
    <div className="min-h-screen bg-background">
      <Header
        intent="focused"
        lang={lang as string}
        showLanguageSwitcher={false}
      />

      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle aria-level={1} className="text-center" role="heading">
              {status === 'loading' && t('loadingTitle')}
              {status === 'success' && t('successTitle')}
              {status === 'error' && t('errorTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-6">
            {/* Loading State */}
            {status === 'loading' && (
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <p className="text-muted-foreground">
                  {t('loadingDescription')}
                </p>
              </div>
            )}

            {/* Success State */}
            {status === 'success' && (
              <div className="flex flex-col items-center space-y-4 text-center">
                <CheckCircle2 className="h-16 w-16 text-green-600" />
                <div className="space-y-2">
                  <p className="text-lg font-medium text-green-800">
                    {t('successDescription')}
                  </p>
                  {newEmail && (
                    <p className="text-sm text-muted-foreground">
                      {t('newEmail')}: <strong>{newEmail}</strong>
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {t('loginGuidance')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-4">
                    {t('redirecting')}
                  </p>
                </div>
                <Button onClick={() => router.push(`/${lang}/account`)}>
                  {t('accountAction')}
                </Button>
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <div className="flex flex-col items-center space-y-4 text-center">
                <XCircle className="h-16 w-16 text-red-600" />
                <div className="space-y-2">
                  <p className="text-lg font-medium text-red-800">
                    {t('errorDescription')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('invalidGuidance')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('retryGuidance')}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => router.push(`/${lang}/account`)}>
                    {t('accountAction')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/${lang}`)}
                  >
                    {t('homeAction')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
