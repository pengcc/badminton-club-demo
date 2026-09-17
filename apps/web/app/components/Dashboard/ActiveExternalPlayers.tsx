'use client';

import { PlayerType } from '@club/shared-types/core/enums';
import { PlayerService } from '@app/services/playerService';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { AlertCircle, RefreshCw, UserRoundSearch } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function ActiveExternalPlayers() {
  const t = useTranslations('dashboard.memberList.activeExternalPlayers');
  const playersQuery = PlayerService.usePlayerList();
  const externalPlayers = (playersQuery.data ?? [])
    .filter(
      (player) =>
        player.type === PlayerType.EXTERNAL &&
        player.isEffectivelyEligible === true
    )
    .sort(
      (left, right) =>
        left.userName.localeCompare(right.userName) ||
        left.id.localeCompare(right.id)
    );
  const blockingError = playersQuery.isError && !playersQuery.data;
  const backgroundError = playersQuery.isError && playersQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRoundSearch className="h-5 w-5" aria-hidden="true" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {playersQuery.isLoading && !playersQuery.data ? (
          <div
            className="flex items-center justify-center gap-3 py-8 text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span>{t('loading')}</span>
          </div>
        ) : blockingError ? (
          <div
            className="flex flex-col items-center gap-3 py-8 text-center"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle
              className="h-9 w-9 text-destructive"
              aria-hidden="true"
            />
            <div>
              <p className="font-medium">{t('loadErrorTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('loadErrorDescription')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void playersQuery.refetch()}
              disabled={playersQuery.isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${playersQuery.isFetching ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {playersQuery.isFetching ? t('retrying') : t('retry')}
            </Button>
          </div>
        ) : (
          <>
            {backgroundError && (
              <div
                className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-3"
                role="alert"
                aria-live="polite"
              >
                <p className="text-sm">{t('refreshError')}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void playersQuery.refetch()}
                  disabled={playersQuery.isFetching}
                >
                  {playersQuery.isFetching ? t('retrying') : t('retry')}
                </Button>
              </div>
            )}

            {externalPlayers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <UserRoundSearch
                  className="mx-auto mb-3 h-10 w-10"
                  aria-hidden="true"
                />
                <p>{t('empty')}</p>
              </div>
            ) : (
              <div>
                <div
                  className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)] gap-4 border-b px-2 pb-2 text-sm font-medium text-muted-foreground md:grid"
                  aria-hidden="true"
                >
                  <span>{t('columns.name')}</span>
                  <span>{t('columns.email')}</span>
                  <span>{t('columns.ranking')}</span>
                </div>
                {externalPlayers.map((player) => (
                  <dl
                    key={player.id}
                    className="grid min-w-0 gap-3 border-b px-2 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)] md:gap-4 md:py-3"
                  >
                    <div className="min-w-0">
                      <dt className="text-xs font-medium text-muted-foreground md:sr-only">
                        {t('columns.name')}
                      </dt>
                      <dd className="mt-1 break-words font-medium md:mt-0">
                        {player.userName}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium text-muted-foreground md:sr-only">
                        {t('columns.email')}
                      </dt>
                      <dd className="mt-1 break-all text-sm text-muted-foreground md:mt-0">
                        {player.userEmail}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium text-muted-foreground md:sr-only">
                        {t('columns.ranking')}
                      </dt>
                      <dd className="mt-1 break-words text-sm md:mt-0">
                        {t('ranking', {
                          singles: player.singlesRanking,
                          doubles: player.doublesRanking,
                        })}
                      </dd>
                    </div>
                  </dl>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
