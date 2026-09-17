'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, ShieldX } from 'lucide-react';
import MembershipApplicantEmailEntry from './MembershipApplicantEmailEntry';
import { validateRegistrationAccess } from '@app/lib/api/membershipApplicationApi';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export default function ControlledMembershipApplication({
  accessToken,
}: {
  accessToken?: string;
}) {
  const t = useTranslations('common');
  const [validation, setValidation] = useState<{
    token?: string;
    state: 'checking' | 'valid' | 'unavailable';
  }>({ token: accessToken, state: accessToken ? 'checking' : 'unavailable' });
  const accessState =
    validation.token === accessToken ? validation.state : 'checking';

  useEffect(() => {
    if (!accessToken) {
      setValidation({ state: 'unavailable' });
      return;
    }

    let active = true;
    setValidation({ token: accessToken, state: 'checking' });
    void validateRegistrationAccess(accessToken)
      .then((isValid) => {
        if (active)
          setValidation({
            token: accessToken,
            state: isValid ? 'valid' : 'unavailable',
          });
      })
      .catch(() => {
        if (active) setValidation({ token: accessToken, state: 'unavailable' });
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  if (accessState === 'checking') {
    return (
      <div
        className="flex items-center justify-center gap-2 py-16 text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>{t('registrationAccess.checking')}</span>
      </div>
    );
  }

  if (!accessToken || accessState !== 'valid') {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader className="text-center">
          <ShieldX
            className="mx-auto h-10 w-10 text-muted-foreground"
            aria-hidden="true"
          />
          <CardTitle>{t('registrationAccess.unavailableTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground" role="alert">
            {t('registrationAccess.unavailableDescription')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <MembershipApplicantEmailEntry mode="initial" accessToken={accessToken} />
  );
}
