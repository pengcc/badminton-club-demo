'use client';

import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  Copy,
  Edit2,
  Eye,
  MapPin,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { MatchDirection } from '@club/shared-types/core/enums';
import { formatMatchDate, getResultBadgeClassName } from '@app/lib/match-utils';
import type { Match } from '@app/lib/types';
import { Badge } from '@app/components/ui/badge';
import { Button } from '@app/components/ui/button';
import { Card, CardContent } from '@app/components/ui/card';

export type MatchCardVariant = 'upcoming' | 'history' | 'management';

interface MatchCardProps {
  match: Match;
  variant: MatchCardVariant;
  onViewDetails?: (match: Match) => void;
  onViewLineup?: (match: Match) => void;
  onEditMatch?: (match: Match) => void;
  onEditResult?: (match: Match) => void;
  onDeleteMatch?: (match: Match) => void;
}

export default function MatchCard({
  match,
  variant,
  onViewDetails,
  onViewLineup,
  onEditMatch,
  onEditResult,
  onDeleteMatch,
}: MatchCardProps) {
  const tMatch = useTranslations('match');
  const tDemo = useTranslations('dashboard.demo');
  const locale = useLocale();
  const resultBadgeClassName = getResultBadgeClassName(match.result?.outcome);
  const resultLabel = match.result
    ? tMatch(
        match.result.outcome === 'win'
          ? 'outcome.win'
          : match.result.outcome === 'loss'
            ? 'outcome.loss'
            : 'outcome.draw'
      )
    : '';
  const homeName =
    match.direction === MatchDirection.HOME
      ? match.clubTeamName
      : match.opponentName;
  const awayName =
    match.direction === MatchDirection.HOME
      ? match.opponentName
      : match.clubTeamName;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(
        match.location
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .join(', ')
      );
      toast.success(tMatch('matchCard.addressCopied'));
    } catch {
      toast.error(tMatch('matchCard.addressCopyError'));
    }
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div
          className={
            variant === 'management'
              ? 'flex flex-col gap-4 md:flex-row'
              : 'space-y-3'
          }
        >
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h4 className="text-lg font-semibold">
                {homeName}{' '}
                <span className="text-muted-foreground">
                  {tMatch('matchCard.versus')}
                </span>{' '}
                {awayName}
              </h4>
              {match.result && (
                <Badge className={resultBadgeClassName}>{resultLabel}</Badge>
              )}
              {match.isDemoScratch && (
                <Badge variant="secondary">{tDemo('scratchLabel')}</Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                {formatMatchDate(match.localStart.date, {
                  includeWeekday: true,
                  locale,
                })}
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                {match.localStart.time}
              </span>
              {variant === 'upcoming' && (
                <span className="text-muted-foreground">
                  {match.daysRemaining === 0
                    ? tMatch('matchCard.today')
                    : match.daysRemaining === 1
                      ? tMatch('matchCard.tomorrow')
                      : tMatch('matchCard.daysRemaining', {
                          count: match.daysRemaining,
                        })}
                </span>
              )}
            </div>

            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="whitespace-pre-line">{match.location}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={copyAddress}
                className="h-7 w-7 p-0"
                aria-label={tMatch('matchCard.copyAddress')}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>

            {match.result && (
              <div className="font-semibold text-primary">
                {tMatch('matchCard.finalScore')}: {match.scoreDisplay}
              </div>
            )}
            {variant === 'history' && match.result?.note && (
              <p
                data-testid="match-result-note"
                className="whitespace-pre-wrap break-words text-sm text-muted-foreground"
              >
                {match.result.note}
              </p>
            )}
            {variant === 'history' && !match.result && (
              <div className="text-sm text-muted-foreground">
                {tMatch('matchCard.noResult')}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 md:flex-col">
            {onViewDetails && variant !== 'management' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(match)}
              >
                <Eye className="mr-2 h-4 w-4" />
                {tMatch('matchCard.viewDetails')}
              </Button>
            )}
            {variant === 'management' && onViewLineup && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onViewLineup(match)}
              >
                <Users className="mr-2 h-4 w-4" />
                {tMatch('matchCard.editLineup')}
              </Button>
            )}
            {variant === 'management' && onEditMatch && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEditMatch(match)}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                {tMatch('matchCard.updateMatch')}
              </Button>
            )}
            {variant === 'management' && !match.isUpcoming && onEditResult && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEditResult(match)}
              >
                <Trophy className="mr-2 h-4 w-4" />
                {match.result
                  ? tMatch('matchCard.correctResult')
                  : tMatch('matchCard.recordResult')}
              </Button>
            )}
            {variant === 'management' && onDeleteMatch && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => onDeleteMatch(match)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {tMatch('matchCard.delete')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
