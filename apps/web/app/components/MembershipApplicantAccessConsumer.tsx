'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { consumeApplicantAccess } from '@app/lib/api/membershipApplicationApi';
import MembershipApplicantWorkspace from './MembershipApplicantWorkspace';

export default function MembershipApplicantAccessConsumer() {
  const t = useTranslations('common');
  const [state, setState] = useState<'consuming' | 'ready' | 'invalid'>(
    'consuming'
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('token');
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search
    );
    if (!token) {
      void import('@app/lib/api/membershipApplicationApi')
        .then(({ getApplicantApplication }) => getApplicantApplication())
        .then(() => setState('ready'))
        .catch(() => setState('invalid'));
      return;
    }
    void consumeApplicantAccess(token)
      .then(() => setState('ready'))
      .catch(() => setState('invalid'));
  }, []);

  if (state === 'consuming')
    return (
      <p className="py-16 text-center" role="status">
        {t('membershipApplicant.accessOpening')}
      </p>
    );
  if (state === 'invalid')
    return (
      <p className="rounded-lg border p-8 text-center" role="alert">
        {t('membershipApplicant.accessInvalid')}
      </p>
    );
  return <MembershipApplicantWorkspace />;
}
