'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { RegistrationAccessExpiryMode } from '@club/shared-types/api/membershipApplication';
import {
  generateRegistrationAccess,
  getRegistrationAccess,
  rotateRegistrationAccess,
} from '@app/lib/api/membershipApplicationApi';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Label } from '@app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';

const SUPPORTED_LOCALES = ['de', 'en', 'zh'] as const;
const REGISTRATION_ACCESS_QUERY_KEY = [
  'registration-access',
  'metadata',
] as const;

export default function MembershipSettings() {
  const queryClient = useQueryClient();
  const currentLocale = useLocale();
  const t = useTranslations('common.registrationAccessAdmin');
  const [linkLocale, setLinkLocale] = useState(currentLocale);
  const [expiryMode, setExpiryMode] =
    useState<RegistrationAccessExpiryMode>('30_days');
  const [copied, setCopied] = useState(false);

  const metadata = useQuery({
    queryKey: REGISTRATION_ACCESS_QUERY_KEY,
    queryFn: getRegistrationAccess,
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      const request = { expiryMode };
      return metadata.data?.isValid
        ? rotateRegistrationAccess(request)
        : generateRegistrationAccess(request);
    },
    onSuccess: async (data) => {
      const replacedExistingLink = metadata.data?.isValid === true;
      queryClient.setQueryData(REGISTRATION_ACCESS_QUERY_KEY, data);
      toast.success(replacedExistingLink ? t('replaced') : t('generated'));
      await queryClient.refetchQueries({
        queryKey: REGISTRATION_ACCESS_QUERY_KEY,
        type: 'active',
      });
    },
    onError: () => toast.error(t('updateFailed')),
  });

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const copyableLink = metadata.data?.path
    ? `${origin}/${linkLocale}${metadata.data.path}`
    : undefined;

  const handleCopy = async () => {
    if (!copyableLink) return;
    try {
      await navigator.clipboard.writeText(copyableLink);
      setCopied(true);
      toast.success(t('copied'));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  if (metadata.isLoading) {
    return (
      <div
        className="flex justify-center p-8"
        role="status"
        aria-label={t('loading')}
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (metadata.isError && !metadata.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('loadFailed')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void metadata.refetch()}>
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const current = metadata.data;
  const actionLabel = current?.isValid ? t('rotate') : t('generate');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {t('title')}
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {metadata.isError && (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3"
              role="alert"
            >
              <p className="text-sm text-muted-foreground">
                {t('refreshFailed')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void metadata.refetch()}
              >
                {t('retry')}
              </Button>
            </div>
          )}

          <div className="grid gap-1 text-sm">
            <span className="font-medium">{t('status')}</span>
            <span className="text-muted-foreground">
              {!current?.hasCurrentLink
                ? t('noLink')
                : current.isValid
                  ? t('activeGeneration', { generation: current.generation! })
                  : t('expired')}
            </span>
            {current?.expiresAt && (
              <span className="text-muted-foreground">
                {t('expires', {
                  date: new Date(current.expiresAt).toLocaleString(
                    currentLocale
                  ),
                })}
              </span>
            )}
            {current?.isValid && current.expiryMode === 'none' && (
              <span className="text-muted-foreground">
                {t('doesNotExpire')}
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="registration-expiry">{t('expiryLabel')}</Label>
              <Select
                value={expiryMode}
                onValueChange={(value) =>
                  setExpiryMode(value as RegistrationAccessExpiryMode)
                }
              >
                <SelectTrigger id="registration-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30_days">{t('expiry30Days')}</SelectItem>
                  <SelectItem value="90_days">{t('expiry90Days')}</SelectItem>
                  <SelectItem value="180_days">{t('expiry180Days')}</SelectItem>
                  <SelectItem value="none">{t('expiryNone')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration-language">
                {t('languageLabel')}
              </Label>
              <Select value={linkLocale} onValueChange={setLinkLocale}>
                <SelectTrigger id="registration-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LOCALES.map((locale) => (
                    <SelectItem key={locale} value={locale}>
                      {locale.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={() => issueMutation.mutate()}
            disabled={issueMutation.isPending}
          >
            {issueMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : current?.isValid ? (
              <RefreshCw className="mr-2 h-4 w-4" />
            ) : null}
            {actionLabel}
          </Button>

          {current?.isValid && copyableLink && (
            <div
              className="space-y-2 rounded-md border bg-muted/40 p-4"
              role="status"
            >
              <p className="text-sm font-medium">{t('currentLink')}</p>
              <div className="flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all rounded border bg-background px-3 py-2 text-sm">
                  {copyableLink}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  aria-label={t('copyLabel')}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {current?.isValid &&
            !current.path &&
            !metadata.isFetching &&
            !metadata.isError && (
              <div className="space-y-2 rounded-md border bg-muted/40 p-4">
                <p className="text-sm font-medium">{t('linkUnavailable')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('linkUnavailableDescription')}
                </p>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
