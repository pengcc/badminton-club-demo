'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RefreshCw, Save, Users, X } from 'lucide-react';
import type {
  MatchLineupIntentEntry,
  MatchLineupWarning,
} from '@club/shared-types/domain/lineup';
import {
  LINEUP_POSITION_DEFINITIONS,
  LINEUP_POSITION_ORDER,
  compareLineupEntries,
} from '@club/shared-types/domain/lineup';
import type { LineupPosition } from '@club/shared-types/core/enums';
import { MatchDirection } from '@club/shared-types/core/enums';
import type { Team } from '@app/lib/types';
import { MatchService } from '@app/services/matchService';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import { toast } from 'sonner';

interface MatchLineupModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  teams: Team[];
  returnFocusTo?: () => HTMLElement | null;
}

function draftFromLineup(
  lineup: readonly MatchLineupIntentEntry[]
): MatchLineupIntentEntry[] {
  return lineup
    .map(({ position, playerId }) => ({ position, playerId }))
    .sort(compareLineupEntries);
}

function draftKey(lineup: readonly MatchLineupIntentEntry[]): string {
  return JSON.stringify(draftFromLineup(lineup));
}

function responseViolations(error: unknown): MatchLineupWarning[] {
  if (!axios.isAxiosError(error)) return [];
  const data = error.response?.data as
    | { details?: { violations?: unknown } }
    | undefined;
  return Array.isArray(data?.details?.violations)
    ? (data.details.violations as MatchLineupWarning[])
    : [];
}

export default function MatchLineupModal({
  isOpen,
  onClose,
  matchId,
  teams,
  returnFocusTo,
}: MatchLineupModalProps) {
  const tMatch = useTranslations('match');
  const matchQuery = MatchService.useMatchDetails(matchId);
  const contextQuery = MatchService.useLineupContext(matchId);
  const updateLineup = MatchService.useUpdateLineup();
  const [draft, setDraft] = useState<MatchLineupIntentEntry[]>([]);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [baseKey, setBaseKey] = useState('[]');
  const [conflict, setConflict] = useState(false);
  const [serverViolations, setServerViolations] = useState<
    MatchLineupWarning[]
  >([]);

  useEffect(() => {
    if (!isOpen || !contextQuery.data || baseVersion !== null) return;
    const nextDraft = draftFromLineup(contextQuery.data.lineup);
    setDraft(nextDraft);
    setBaseKey(draftKey(nextDraft));
    setBaseVersion(contextQuery.data.version);
  }, [baseVersion, contextQuery.data, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setDraft([]);
      setBaseVersion(null);
      setBaseKey('[]');
      setConflict(false);
      setServerViolations([]);
    }
  }, [isOpen]);

  const context = contextQuery.data;
  const match = matchQuery.data;
  const visibleWarnings =
    serverViolations.length > 0
      ? serverViolations
      : (context?.lineupWarnings ?? []);
  const hasUnsavedChanges = draftKey(draft) !== baseKey;
  const remoteVersionChanged =
    baseVersion !== null &&
    context !== undefined &&
    context.version !== baseVersion;

  const entriesByPosition = useMemo(
    () =>
      Object.fromEntries(
        LINEUP_POSITION_ORDER.map((position) => [
          position,
          draft.filter((entry) => entry.position === position),
        ])
      ) as Record<LineupPosition, MatchLineupIntentEntry[]>,
    [draft]
  );

  const retainedNames = useMemo(
    () =>
      new Map(
        context?.lineup.map((entry) => [
          `${entry.position}:${entry.playerId}`,
          entry.playerNameSnapshot,
        ]) ?? []
      ),
    [context?.lineup]
  );
  const candidatesById = useMemo(
    () =>
      new Map(
        context?.candidates.map((candidate) => [
          candidate.playerId,
          candidate,
        ]) ?? []
      ),
    [context?.candidates]
  );

  if (!isOpen) return null;

  const setSlot = (
    position: LineupPosition,
    slot: number,
    playerId: string
  ) => {
    setServerViolations([]);
    const positionEntries = entriesByPosition[position];
    const replaced = positionEntries[slot];
    setDraft((current) => {
      const withoutSlot = replaced
        ? current.filter(
            (entry) =>
              !(
                entry.position === replaced.position &&
                entry.playerId === replaced.playerId
              )
          )
        : current;
      if (!playerId) return withoutSlot.sort(compareLineupEntries);
      return [...withoutSlot, { position, playerId }].sort(
        compareLineupEntries
      );
    });
  };

  const reloadLatest = async () => {
    try {
      const [contextResult, matchResult] = await Promise.all([
        contextQuery.refetch({ throwOnError: true }),
        matchQuery.refetch({ throwOnError: true }),
      ]);
      if (!contextResult.data || !matchResult.data) {
        throw new Error('Match Lineup refresh returned no data');
      }
      const latest = draftFromLineup(contextResult.data.lineup);
      setDraft(latest);
      setBaseKey(draftKey(latest));
      setBaseVersion(contextResult.data.version);
      setConflict(false);
      setServerViolations([]);
    } catch {
      toast.error(tMatch('modals.matchLineup.refreshFailed'));
    }
  };

  const save = async () => {
    if (baseVersion === null) return;
    try {
      const response = await updateLineup.mutateAsync({
        matchId,
        request: {
          expectedVersion: baseVersion,
          lineup: draftFromLineup(draft),
        },
      });
      const saved = draftFromLineup(response.lineup);
      setDraft(saved);
      setBaseKey(draftKey(saved));
      setBaseVersion(response.version);
      setConflict(false);
      setServerViolations([]);
      toast.success(tMatch('modals.matchLineup.success'));
      onClose();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setConflict(true);
        toast.error(tMatch('modals.matchLineup.conflict'));
        return;
      }
      const violations = responseViolations(error);
      if (violations.length > 0) {
        setServerViolations(violations);
        toast.error(tMatch('modals.matchLineup.lineupValidationWarnings'));
        return;
      }
      toast.error(
        axios.isAxiosError(error)
          ? ((error.response?.data as { error?: string } | undefined)?.error ??
              tMatch('modals.matchLineup.unknownError'))
          : tMatch('modals.matchLineup.unknownError')
      );
    }
  };

  const close = () => {
    if (
      !hasUnsavedChanges ||
      window.confirm(tMatch('modals.matchLineup.unsavedChanges'))
    ) {
      onClose();
    }
  };

  const clubTeamName =
    teams.find((team) => team.id === match?.teamId)?.shortName ??
    tMatch('modals.matchLineup.unknownTeam');
  const homeName =
    match?.direction === MatchDirection.AWAY
      ? match.opponentName
      : clubTeamName;
  const awayName =
    match?.direction === MatchDirection.AWAY
      ? clubTeamName
      : match?.opponentName;

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      ariaLabel={tMatch('modals.matchLineup.title')}
      returnFocusTo={returnFocusTo}
    >
      <Card className="flex max-h-[90vh] w-full max-w-6xl flex-col">
        <CardHeader className="border-b">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              {tMatch('modals.matchLineup.title')}
            </CardTitle>
            {match && (
              <p className="text-sm text-muted-foreground">
                {homeName} {tMatch('modals.matchLineup.versus')} {awayName}
              </p>
            )}
          </div>
          <CardAction>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={close}
              aria-label={tMatch('actions.close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-5 overflow-y-auto p-6">
          {(contextQuery.isLoading || matchQuery.isLoading) && (
            <p>{tMatch('common.loading')}</p>
          )}
          {(contextQuery.isError || matchQuery.isError) && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 p-4"
            >
              {tMatch('modals.matchLineup.refreshFailed')}
            </div>
          )}
          {(contextQuery.isRefetchError || matchQuery.isRefetchError) &&
            context &&
            match && (
              <div
                role="status"
                className="rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900"
              >
                {tMatch('modals.matchLineup.refreshFailed')}
              </div>
            )}

          {(conflict || remoteVersionChanged) && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-50 p-4 text-amber-950"
            >
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{tMatch('modals.matchLineup.conflict')}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void reloadLatest()}
                disabled={contextQuery.isFetching || matchQuery.isFetching}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {tMatch('modals.matchLineup.loadLatest')}
              </Button>
            </div>
          )}

          {context &&
            visibleWarnings.some(
              (warning) =>
                !warning.position &&
                !warning.playerId &&
                !(warning.positions?.length ?? 0)
            ) && (
              <div className="rounded-md border border-amber-500/40 bg-amber-50 p-4">
                <h3 className="flex items-center gap-2 font-medium text-amber-950">
                  <AlertTriangle className="h-4 w-4" />
                  {tMatch('modals.matchLineup.retainedWarnings')}
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {visibleWarnings
                    .filter(
                      (warning) =>
                        !warning.position &&
                        !warning.playerId &&
                        !(warning.positions?.length ?? 0)
                    )
                    .map((warning, index) => (
                      <li
                        key={`${warning.code}:${warning.position ?? ''}:${warning.playerId ?? ''}:${index}`}
                      >
                        {tMatch(
                          `modals.matchLineup.violationCodes.${warning.code}`
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            )}

          {context && (
            <div className="grid gap-4 md:grid-cols-2">
              {LINEUP_POSITION_ORDER.map((position) => {
                const definition = LINEUP_POSITION_DEFINITIONS[position];
                const positionEntries = entriesByPosition[position];
                const pairHasCurrentRankings =
                  positionEntries.length === 2 &&
                  positionEntries.every((entry) =>
                    candidatesById.has(entry.playerId)
                  );
                const pairSum = positionEntries.reduce((sum, entry) => {
                  const candidate = candidatesById.get(entry.playerId);
                  return sum + (candidate?.doublesRanking ?? 0);
                }, 0);
                return (
                  <Card key={position} className="bg-muted/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-base">
                        <span>
                          {tMatch(
                            `modals.matchLineup.lineupPositions.${position}`
                          )}
                        </span>
                        {definition.eventKind === 'doubles' &&
                          pairHasCurrentRankings && (
                            <Badge variant="secondary">
                              {tMatch('modals.matchLineup.pairRanking', {
                                sum: pairSum,
                              })}
                            </Badge>
                          )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {Array.from(
                        { length: definition.capacity },
                        (_, slot) => {
                          const entry = positionEntries[slot];
                          const candidate = entry
                            ? candidatesById.get(entry.playerId)
                            : undefined;
                          const snapshot = entry
                            ? retainedNames.get(`${position}:${entry.playerId}`)
                            : undefined;
                          const selectedName =
                            candidate?.playerName ?? snapshot;
                          const samePositionPlayerIds = new Set(
                            positionEntries
                              .filter((_, index) => index !== slot)
                              .map((item) => item.playerId)
                          );
                          const entryWarnings = visibleWarnings.filter(
                            (warning) =>
                              (warning.position === position &&
                                (!warning.playerId ||
                                  warning.playerId === entry?.playerId)) ||
                              (Boolean(entry) &&
                                warning.playerId === entry?.playerId) ||
                              warning.positions?.includes(position)
                          );
                          return (
                            <div key={slot} className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                  {selectedName ??
                                    tMatch('modals.matchLineup.slot', {
                                      slot: slot + 1,
                                    })}
                                </span>
                                {candidate && (
                                  <Badge variant="outline">
                                    {definition.rankingKind === 'singles'
                                      ? candidate.singlesRanking
                                      : candidate.doublesRanking}
                                  </Badge>
                                )}
                              </div>
                              <Select
                                value={entry?.playerId ?? '__empty__'}
                                onValueChange={(playerId) =>
                                  setSlot(
                                    position,
                                    slot,
                                    playerId === '__empty__' ? '' : playerId
                                  )
                                }
                              >
                                <SelectTrigger
                                  aria-label={tMatch(
                                    'modals.matchLineup.selectPlayerForPositionSlot',
                                    {
                                      position: tMatch(
                                        `modals.matchLineup.lineupPositions.${position}`
                                      ),
                                      slot: slot + 1,
                                    }
                                  )}
                                >
                                  <SelectValue
                                    placeholder={tMatch(
                                      'modals.matchLineup.selectPlayer'
                                    )}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__empty__">
                                    {tMatch('modals.matchLineup.emptySlot')}
                                  </SelectItem>
                                  {entry && !candidate && selectedName && (
                                    <SelectItem value={entry.playerId}>
                                      {selectedName}{' '}
                                      {tMatch(
                                        'modals.matchLineup.retainedEntry'
                                      )}
                                    </SelectItem>
                                  )}
                                  {context.candidates
                                    .filter(
                                      (item) =>
                                        !samePositionPlayerIds.has(
                                          item.playerId
                                        ) &&
                                        definition.allowedGenders.includes(
                                          item.gender
                                        )
                                    )
                                    .sort(
                                      (left, right) =>
                                        (definition.rankingKind === 'singles'
                                          ? right.singlesRanking -
                                            left.singlesRanking
                                          : right.doublesRanking -
                                            left.doublesRanking) ||
                                        left.playerName.localeCompare(
                                          right.playerName
                                        )
                                    )
                                    .map((item) => (
                                      <SelectItem
                                        key={item.playerId}
                                        value={item.playerId}
                                      >
                                        {item.playerName} ·{' '}
                                        {definition.rankingKind === 'singles'
                                          ? item.singlesRanking
                                          : item.doublesRanking}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              {entryWarnings.map((warning, index) => (
                                <p
                                  key={`${warning.code}:${warning.playerId ?? ''}:${index}`}
                                  className="flex items-start gap-2 text-xs text-amber-800"
                                >
                                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                  {tMatch(
                                    `modals.matchLineup.violationCodes.${warning.code}`
                                  )}
                                </p>
                              ))}
                            </div>
                          );
                        }
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>

        <div className="flex justify-end gap-3 border-t p-6">
          <Button type="button" variant="outline" onClick={close}>
            {tMatch('actions.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={
              !context ||
              updateLineup.isPending ||
              contextQuery.isLoading ||
              conflict ||
              remoteVersionChanged
            }
          >
            <Save className="mr-2 h-4 w-4" />
            {tMatch('actions.saveLineup')}
          </Button>
        </div>
      </Card>
    </Modal>
  );
}
