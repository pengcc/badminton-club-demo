'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Check,
  CircleCheck,
  CircleX,
  ChevronDown,
  Pencil,
  User,
  Users,
} from 'lucide-react';
import type { Api } from '@club/shared-types/api/match';
import { MatchAvailabilityParticipation } from '@club/shared-types/core/enums';
import { getMatchAvailability } from '@club/shared-types/domain/match';
import type { Player } from '@app/lib/types';
import { Button } from '@app/components/ui/button';
import { cn } from '@app/lib/utils';

interface PlayerAvailabilityProps {
  currentPlayers: Player[];
  retainedEntries: Api.MatchAvailabilityEntry[];
  allPlayers: Player[];
  availability: Api.MatchAvailabilityEntry[];
  currentUserId?: string;
  isAdmin?: boolean;
  isBeforeStart: boolean;
  isPending: boolean;
  isRefreshRequired: boolean;
  onSetSelf: (participation: MatchAvailabilityParticipation) => Promise<void>;
  onSetPlayer: (
    playerId: string,
    participation: MatchAvailabilityParticipation
  ) => Promise<void>;
}

const positiveText = 'text-green-700 dark:text-green-400';

function AvailabilityState({
  participation,
}: {
  participation: MatchAvailabilityParticipation;
}) {
  const t = useTranslations('match.modals.matchDetails');
  const available = participation === MatchAvailabilityParticipation.AVAILABLE;
  const Icon = available ? CircleCheck : CircleX;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-sm',
        available ? positiveText : 'text-destructive'
      )}
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {t(available ? 'available' : 'unavailable')}
    </span>
  );
}

function AvailabilityActions({
  playerName,
  participation,
  own = false,
  disabled,
  pending,
  onChange,
}: {
  playerName: string;
  participation: MatchAvailabilityParticipation;
  own?: boolean;
  disabled: boolean;
  pending: boolean;
  onChange: (value: MatchAvailabilityParticipation) => Promise<void>;
}) {
  const t = useTranslations('match.modals.matchDetails');
  return (
    <div
      role="group"
      aria-label={t('availabilityFor', { player: playerName })}
      aria-busy={pending}
      className={cn(
        'grid grid-cols-2 gap-2',
        own ? 'w-full' : 'w-full sm:w-72'
      )}
    >
      {[
        MatchAvailabilityParticipation.AVAILABLE,
        MatchAvailabilityParticipation.UNAVAILABLE,
      ].map((value) => {
        const selected = participation === value;
        const available = value === MatchAvailabilityParticipation.AVAILABLE;
        const Icon = available ? CircleCheck : CircleX;
        return (
          <Button
            key={value}
            type="button"
            variant="outline"
            aria-pressed={selected}
            disabled={disabled}
            className={cn(
              'h-auto min-h-9 whitespace-normal px-2 py-2 text-sm',
              own && 'min-h-11',
              selected
                ? available
                  ? 'border-green-600 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/20 dark:text-green-400'
                  : 'border-destructive bg-destructive/5 text-destructive hover:bg-destructive/10'
                : 'text-muted-foreground'
            )}
            onClick={() => {
              if (!selected) void onChange(value);
            }}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {t(
              own
                ? available
                  ? 'ownAvailable'
                  : 'ownUnavailable'
                : available
                  ? 'available'
                  : 'unavailable'
            )}
          </Button>
        );
      })}
    </div>
  );
}

export default function PlayerAvailability({
  currentPlayers,
  retainedEntries,
  allPlayers,
  availability,
  currentUserId,
  isAdmin = false,
  isBeforeStart,
  isPending,
  isRefreshRequired,
  onSetSelf,
  onSetPlayer,
}: PlayerAvailabilityProps) {
  const t = useTranslations('match.modals.matchDetails');
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const currentPlayer = currentPlayers.find(
    (player) => player.userId === currentUserId
  );
  const candidates = [...currentPlayers].sort((a, b) =>
    a.userName.localeCompare(b.userName)
  );
  const others = candidates.filter((player) => player.id !== currentPlayer?.id);
  const availableCount = candidates.filter(
    (player) =>
      getMatchAvailability(availability, player.id).participation ===
      MatchAvailabilityParticipation.AVAILABLE
  ).length;
  const blocked = isPending || isRefreshRequired;
  const editButton = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-pressed={editing}
      onClick={() => setEditing((value) => !value)}
      className="h-auto min-h-9 whitespace-normal"
    >
      {editing ? <Check aria-hidden="true" /> : <Pencil aria-hidden="true" />}
      {t(editing ? 'doneEditing' : 'editAvailability')}
    </Button>
  );

  function roster(
    players: {
      playerId: string;
      player?: Player;
      participation: MatchAvailabilityParticipation;
    }[],
    retained = false
  ) {
    return (
      <ul
        aria-label={t(retained ? 'retainedAvailability' : 'currentCandidates', {
          count: players.length,
        })}
        className="divide-y rounded-md border px-3"
      >
        {players.map((entry, index) => (
          <li
            key={entry.playerId}
            className={cn(
              'flex items-center justify-between gap-3 py-2',
              editing && 'flex-col items-stretch sm:flex-row sm:items-center'
            )}
          >
            <div className="flex min-w-0 items-baseline gap-3 text-sm">
              <span
                aria-hidden="true"
                className="w-4 shrink-0 text-xs text-muted-foreground"
              >
                {index + 1}
              </span>
              <span className="min-w-0 break-words">
                {entry.player?.userName ?? t('playerUnavailable')}
                {entry.playerId === currentPlayer?.id && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t('you')}
                  </span>
                )}
              </span>
            </div>
            <div className={cn('shrink-0', !editing && 'max-w-[48%]')}>
              {isAdmin && editing ? (
                <AvailabilityActions
                  playerName={entry.player?.userName ?? t('playerUnavailable')}
                  participation={entry.participation}
                  disabled={blocked}
                  pending={isPending}
                  onChange={(value) => onSetPlayer(entry.playerId, value)}
                />
              ) : (
                <AvailabilityState participation={entry.participation} />
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  const retainedRoster = retainedEntries.length > 0 && (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{t('retainedAvailability')}</h4>
      <p className="text-xs text-muted-foreground">{t('noLongerAssociated')}</p>
      {roster(
        retainedEntries.map((entry) => ({
          ...entry,
          player: allPlayers.find((player) => player.id === entry.playerId),
        })),
        true
      )}
    </div>
  );

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="space-y-4 rounded-lg border bg-card p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3
            id={`${id}-title`}
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <User aria-hidden="true" className="h-5 w-5" />
            {t('playerAvailability')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t(currentPlayer ? 'selfDescription' : 'overviewDescription')}
          </p>
        </div>
        {isAdmin && !currentPlayer && editButton}
      </div>

      {currentPlayer && (
        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center gap-3">
            <User
              aria-hidden="true"
              className="h-6 w-6 text-muted-foreground"
            />
            <div>
              <h4 className="font-medium">{t('yourAvailability')}</h4>
              <p className="text-xs text-muted-foreground">
                {t('selectAvailability')}
              </p>
            </div>
          </div>
          <AvailabilityActions
            playerName={currentPlayer.userName}
            own
            participation={
              getMatchAvailability(availability, currentPlayer.id).participation
            }
            disabled={blocked || !isBeforeStart}
            pending={isPending}
            onChange={onSetSelf}
          />
          {!isBeforeStart && (
            <p className="text-xs text-muted-foreground">{t('playerCutoff')}</p>
          )}
        </div>
      )}

      {isAdmin ? (
        <div className="space-y-3">
          {currentPlayer && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <h4 className="flex items-center gap-2 font-medium">
                <Users
                  aria-hidden="true"
                  className="h-5 w-5 text-muted-foreground"
                />
                {t('teamAvailability')}
              </h4>
              {editButton}
            </div>
          )}
          <dl
            className="grid grid-cols-3 gap-2"
            aria-label={t('availabilitySummary')}
          >
            {[
              {
                label: t('candidateTotal'),
                count: candidates.length,
                Icon: Users,
                tone: 'text-muted-foreground',
              },
              {
                label: t('available'),
                count: availableCount,
                Icon: CircleCheck,
                tone: positiveText,
              },
              {
                label: t('unavailable'),
                count: candidates.length - availableCount,
                Icon: CircleX,
                tone: 'text-destructive',
              },
            ].map(({ label, count, Icon, tone }) => (
              <div
                key={label}
                className="flex flex-col gap-1 rounded-md border bg-muted/10 p-2 sm:flex-row sm:items-center sm:gap-3 sm:p-3"
              >
                <Icon
                  aria-hidden="true"
                  className={cn('h-5 w-5 shrink-0', tone)}
                />
                <div className="min-w-0">
                  <dt className="break-words text-xs text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="text-xl font-semibold tabular-nums">
                    {count}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
          {editing && (
            <p className="text-sm text-muted-foreground">
              {t('editingDescription')}
            </p>
          )}
          {candidates.length > 0 ? (
            roster(
              candidates.map((player) => ({
                playerId: player.id,
                player,
                participation: getMatchAvailability(availability, player.id)
                  .participation,
              }))
            )
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t('noCandidates')}
            </p>
          )}
          {retainedRoster}
        </div>
      ) : (
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            aria-expanded={showOthers}
            aria-controls={`${id}-others`}
            className="h-auto min-h-14 w-full justify-between gap-3 whitespace-normal bg-muted/10 p-3 text-left"
            onClick={() => setShowOthers((value) => !value)}
          >
            <Users aria-hidden="true" className="shrink-0" />
            <span className="flex-1">
              {t(showOthers ? 'hideOtherCandidates' : 'showOtherCandidates', {
                count: others.length,
              })}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'shrink-0 transition-transform',
                showOthers && 'rotate-180'
              )}
            />
          </Button>
          {showOthers && (
            <div id={`${id}-others`} className="space-y-3">
              {others.length > 0 &&
                roster(
                  others.map((player) => ({
                    playerId: player.id,
                    player,
                    participation: getMatchAvailability(availability, player.id)
                      .participation,
                  }))
                )}
              {candidates.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('noCandidates')}
                </p>
              )}
              {retainedRoster}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
