'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AlertTriangle, Calendar, Clock, MapPin, Users, X } from 'lucide-react';
import {
  MatchAvailabilityParticipation,
  MatchDirection,
} from '@club/shared-types/core/enums';
import { LINEUP_POSITION_ORDER } from '@club/shared-types/domain/lineup';
import type { Player, Team } from '@app/lib/types';
import { formatMatchDate, getResultBadgeClassName } from '@app/lib/match-utils';
import {
  MatchAvailabilityRefreshError,
  MatchService,
} from '@app/services/matchService';
import PlayerAvailability from '@app/components/Dashboard/PlayerAvailability';
import MatchLineupModal from './MatchLineupModal';
import { Badge } from '@app/components/ui/badge';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Modal } from '@app/components/ui/modal';

interface MatchDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string | null;
  players: Player[];
  teams: Team[];
  currentUserId?: string;
  isAdmin?: boolean;
}

function useBeforeMatchStart(
  startAt: string | undefined,
  enabled: boolean
): boolean {
  const [observedAt, setObservedAt] = useState(Date.now);

  useEffect(() => {
    if (!enabled || !startAt) return;
    const boundary = Date.parse(startAt);
    if (!Number.isFinite(boundary)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      const remaining = boundary - Date.now();
      if (remaining <= 0) {
        setObservedAt(Date.now());
        return;
      }
      timer = setTimeout(schedule, Math.min(remaining + 25, 2_147_483_647));
    };
    schedule();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [enabled, startAt]);

  if (!startAt) return false;
  const boundary = Date.parse(startAt);
  return (
    Number.isFinite(boundary) && boundary > Math.max(observedAt, Date.now())
  );
}

export default function MatchDetailsModal({
  isOpen,
  onClose,
  matchId,
  players,
  teams,
  currentUserId,
  isAdmin,
}: MatchDetailsModalProps) {
  const tMatch = useTranslations('match');
  const locale = useLocale();
  const { data: match, refetch: refetchMatch } = MatchService.useMatchDetails(
    matchId ?? ''
  );
  const availabilityMutation = MatchService.useSetMatchAvailability();
  const [showLineupEditor, setShowLineupEditor] = useState(false);
  const editLineupButtonRef = useRef<HTMLButtonElement>(null);
  const [
    availabilityRefreshFailureMatchId,
    setAvailabilityRefreshFailureMatchId,
  ] = useState<string | null>(null);
  const [reloadingAvailabilityMatchId, setReloadingAvailabilityMatchId] =
    useState<string | null>(null);
  const availabilityRefreshFailed =
    availabilityRefreshFailureMatchId === match?.id;
  const isReloadingAvailability = reloadingAvailabilityMatchId === match?.id;
  const isBeforeStart = useBeforeMatchStart(match?.startAt, isOpen);

  const teamPlayers = useMemo(
    () =>
      match
        ? players.filter(
            (player) =>
              (player.isEffectivelyEligible ?? player.isActivePlayer) &&
              player.teamIds?.includes(match.teamId)
          )
        : [],
    [match, players]
  );
  const retainedAvailability = useMemo(
    () =>
      match
        ? match.availability.filter(
            (entry) =>
              !teamPlayers.some((player) => player.id === entry.playerId)
          )
        : [],
    [match, teamPlayers]
  );

  if (!isOpen || !match) return null;

  const clubTeamName =
    teams.find((team) => team.id === match.teamId)?.shortName ??
    tMatch('modals.matchLineup.unknownTeam');
  const homeName =
    match.direction === MatchDirection.HOME ? clubTeamName : match.opponentName;
  const awayName =
    match.direction === MatchDirection.HOME ? match.opponentName : clubTeamName;
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
  const isUpcoming = isBeforeStart;

  const showAvailabilityError = (error: unknown) => {
    if (error instanceof MatchAvailabilityRefreshError) {
      setAvailabilityRefreshFailureMatchId(match.id);
      toast.error(tMatch('modals.matchDetails.refreshFailed'));
      return;
    }
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      setAvailabilityRefreshFailureMatchId(null);
      toast.error(
        !isAdmin && Date.parse(match.startAt) <= Date.now()
          ? tMatch('modals.matchDetails.playerCutoff')
          : tMatch('modals.matchDetails.conflict')
      );
      return;
    }
    toast.error(tMatch('modals.matchDetails.mutationError'));
  };

  const reloadAvailabilityDetails = async () => {
    setReloadingAvailabilityMatchId(match.id);
    try {
      await refetchMatch({ throwOnError: true });
      setAvailabilityRefreshFailureMatchId(null);
    } catch {
      toast.error(tMatch('modals.matchDetails.refreshFailed'));
    } finally {
      setReloadingAvailabilityMatchId(null);
    }
  };

  const setOwnAvailability = async (
    participation: MatchAvailabilityParticipation
  ) => {
    try {
      await availabilityMutation.mutateAsync({
        kind: 'self',
        matchId: match.id,
        expectedVersion: match.version,
        participation,
      });
      toast.success(tMatch('modals.matchDetails.saved'));
    } catch (error) {
      showAvailabilityError(error);
    }
  };

  const setPlayerAvailability = async (
    playerId: string,
    participation: MatchAvailabilityParticipation
  ) => {
    try {
      await availabilityMutation.mutateAsync({
        kind: 'admin',
        matchId: match.id,
        playerId,
        expectedVersion: match.version,
        participation,
      });
      toast.success(tMatch('modals.matchDetails.saved'));
    } catch (error) {
      showAvailabilityError(error);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !showLineupEditor}
        onClose={onClose}
        ariaLabel={`${homeName} ${tMatch('modals.matchLineup.versus')} ${awayName}`}
        focusReturnMode={showLineupEditor ? 'preserve' : 'restore'}
      >
        <Card className="flex max-h-[90vh] w-full max-w-4xl flex-col">
          <CardHeader className="border-b">
            <div>
              <CardTitle className="text-2xl">
                {homeName} {tMatch('modals.matchLineup.versus')} {awayName}
              </CardTitle>
              {match.result && (
                <Badge className={`mt-2 ${resultBadgeClassName}`}>
                  {resultLabel}
                </Badge>
              )}
            </div>
            <CardAction>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label={tMatch('actions.close')}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardAction>
          </CardHeader>

          <CardContent className="space-y-6 overflow-y-auto p-6">
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">
                {tMatch('modals.matchDetails.matchInfo')}
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {formatMatchDate(match.localStart.date, {
                  includeWeekday: true,
                  locale,
                })}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {match.localStart.time}
              </div>
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="whitespace-pre-line">{match.location}</span>
              </div>
              {match.arrivalGuidance && (
                <div className="border-l-2 border-primary/30 pl-3 text-sm">
                  <div className="font-medium">
                    {tMatch('fields.arrivalGuidance')}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">
                    {match.arrivalGuidance}
                  </p>
                </div>
              )}
              {match.result && (
                <div className="border-t pt-3 text-lg font-bold text-primary">
                  {tMatch('matchCard.finalScore')}: {match.result.homeScore} -{' '}
                  {match.result.awayScore}
                  {match.result.note && (
                    <p className="mt-2 text-sm font-normal text-muted-foreground">
                      {match.result.note}
                    </p>
                  )}
                </div>
              )}
              {!match.result && !isUpcoming && (
                <div className="border-t pt-3 text-sm text-muted-foreground">
                  {tMatch('matchCard.noResult')}
                </div>
              )}
            </section>

            {availabilityRefreshFailed && (
              <div
                role="alert"
                className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4"
              >
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{tMatch('modals.matchDetails.refreshFailed')}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isReloadingAvailability}
                  onClick={() => void reloadAvailabilityDetails()}
                >
                  {tMatch(
                    isReloadingAvailability
                      ? 'modals.matchDetails.reloading'
                      : 'modals.matchDetails.reloadLatest'
                  )}
                </Button>
              </div>
            )}

            <PlayerAvailability
              key={`${match.id}:${currentUserId ?? ''}:${!!isAdmin}`}
              currentPlayers={teamPlayers}
              retainedEntries={retainedAvailability}
              allPlayers={players}
              availability={match.availability}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              isBeforeStart={isBeforeStart}
              isPending={availabilityMutation.isPending}
              isRefreshRequired={
                availabilityRefreshFailed || isReloadingAvailability
              }
              onSetSelf={setOwnAvailability}
              onSetPlayer={setPlayerAvailability}
            />

            <section className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Users className="h-5 w-5" />
                  {tMatch('modals.matchDetails.lineup')}
                </h3>
                {isAdmin && (
                  <Button
                    ref={editLineupButtonRef}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLineupEditor(true)}
                  >
                    {tMatch('actions.editLineup')}
                  </Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {LINEUP_POSITION_ORDER.map((position) => {
                  const entries = match.lineup.filter(
                    (entry) => entry.position === position
                  );
                  const positionWarnings = (match.lineupWarnings ?? []).filter(
                    (warning) =>
                      !warning.playerId &&
                      (warning.position === position ||
                        warning.positions?.includes(position))
                  );
                  return (
                    <Card key={position} className="bg-muted/30">
                      <CardContent className="space-y-2 p-3">
                        <div className="text-sm font-medium text-muted-foreground">
                          {tMatch(
                            `modals.matchLineup.lineupPositions.${position}`
                          )}
                        </div>
                        {entries.length === 0 ? (
                          <span>{tMatch('modals.matchLineup.tbd')}</span>
                        ) : (
                          entries.map((lineupEntry) => {
                            const entryWarnings = (
                              match.lineupWarnings ?? []
                            ).filter((warning) => {
                              if (warning.playerId !== lineupEntry.playerId) {
                                return false;
                              }
                              if (warning.position) {
                                return warning.position === position;
                              }
                              if (warning.positions?.length) {
                                return warning.positions.includes(position);
                              }
                              return true;
                            });
                            return (
                              <div
                                key={`${lineupEntry.position}:${lineupEntry.playerId}`}
                                className="space-y-1"
                              >
                                <div className="font-medium">
                                  {lineupEntry.playerNameSnapshot}
                                </div>
                                {entryWarnings.map((warning, index) => (
                                  <div
                                    key={`${warning.code}:${warning.playerId ?? ''}:${index}`}
                                    className="flex items-start gap-2 text-xs text-amber-800"
                                  >
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <p>
                                      <span className="font-medium">
                                        {lineupEntry.playerNameSnapshot}:{' '}
                                      </span>
                                      {tMatch(
                                        `modals.matchLineup.violationCodes.${warning.code}`
                                      )}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            );
                          })
                        )}
                        {positionWarnings.map((warning, index) => (
                          <div
                            key={`${warning.code}:${warning.playerId ?? ''}:${index}`}
                            className="flex items-start gap-2 text-xs text-amber-800"
                          >
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <p>
                              {tMatch(
                                `modals.matchLineup.violationCodes.${warning.code}`
                              )}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {(match.lineupWarnings ?? [])
                .filter(
                  (warning) =>
                    !warning.playerId &&
                    !warning.position &&
                    !(warning.positions?.length ?? 0)
                )
                .map((warning, index) => (
                  <div
                    key={`${warning.code}:${warning.playerId ?? ''}:${index}`}
                    className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {tMatch(
                      `modals.matchLineup.violationCodes.${warning.code}`
                    )}
                  </div>
                ))}
            </section>
          </CardContent>
        </Card>
      </Modal>
      {showLineupEditor && (
        <MatchLineupModal
          isOpen
          onClose={() => setShowLineupEditor(false)}
          matchId={match.id}
          teams={teams}
          returnFocusTo={() => editLineupButtonRef.current}
        />
      )}
    </>
  );
}
