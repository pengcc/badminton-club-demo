'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@app/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import { UserService } from '@app/services/userService';

function InlinePasswordRecoveryAction({
  accountName,
  isPending,
  onRequest,
}: {
  accountName: string;
  isPending: boolean;
  onRequest: (locale: 'de' | 'en' | 'zh') => void;
}) {
  const t = useTranslations('dashboard.passwordRecovery');
  const [locale, setLocale] = useState<'de' | 'en' | 'zh'>('de');

  return (
    <div className="flex items-center gap-1">
      <Select
        value={locale}
        onValueChange={(value) => setLocale(value as 'de' | 'en' | 'zh')}
      >
        <SelectTrigger
          className="h-8 w-[72px]"
          aria-label={t('languageFor', { name: accountName })}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="de">DE</SelectItem>
          <SelectItem value="en">EN</SelectItem>
          <SelectItem value="zh">中文</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => onRequest(locale)}
        aria-label={t('actionFor', { name: accountName })}
      >
        <KeyRound className="mr-1 h-4 w-4" aria-hidden="true" />
        {isPending ? t('sending') : t('action')}
      </Button>
    </div>
  );
}

export function PasswordRecoveryAction({
  userId,
  accountName,
  presentation = 'inline',
}: {
  userId: string;
  accountName: string;
  presentation?: 'inline' | 'menu' | 'standalone-menu';
}) {
  const t = useTranslations('dashboard.passwordRecovery');
  const languageOptions = useTranslations('dashboard.languageOptions');
  const mutation = UserService.useRequestPasswordRecovery();

  async function requestRecovery(selectedLocale: 'de' | 'en' | 'zh') {
    try {
      const result = await mutation.mutateAsync({
        id: userId,
        locale: selectedLocale,
      });
      if (result.deliveryStatus === 'sent') toast.success(t('sent'));
      else if (result.deliveryStatus === 'failed') toast.error(t('failed'));
      else toast.warning(t('uncertain'));
    } catch {
      toast.error(t('requestFailed'));
    }
  }

  if (presentation === 'menu') {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={mutation.isPending}>
          <KeyRound aria-hidden="true" />
          {mutation.isPending ? t('sending') : t('action')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem onSelect={() => void requestRecovery('de')}>
            {languageOptions('de')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void requestRecovery('en')}>
            {languageOptions('en')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void requestRecovery('zh')}>
            {languageOptions('zh')}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  if (presentation === 'standalone-menu') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            aria-label={t('actionFor', { name: accountName })}
          >
            <KeyRound className="mr-1 h-4 w-4" aria-hidden="true" />
            {mutation.isPending ? t('sending') : t('action')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void requestRecovery('de')}>
            {languageOptions('de')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void requestRecovery('en')}>
            {languageOptions('en')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void requestRecovery('zh')}>
            {languageOptions('zh')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <InlinePasswordRecoveryAction
      accountName={accountName}
      isPending={mutation.isPending}
      onRequest={(locale) => void requestRecovery(locale)}
    />
  );
}
