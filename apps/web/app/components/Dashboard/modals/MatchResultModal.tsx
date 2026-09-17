'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, Save, Trophy, X } from 'lucide-react';
import { MATCH_RESULT_NOTE_MAX_LENGTH } from '@club/shared-types/api/match';
import { MatchDirection } from '@club/shared-types/core/enums';
import type { Match, Team } from '@app/lib/types';
import { MatchService } from '@app/services/matchService';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { Modal } from '@app/components/ui/modal';
import { Textarea } from '@app/components/ui/textarea';
import { toast } from 'sonner';

interface MatchResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  teams: Team[];
  onResultSaved?: (match: unknown) => void;
}

interface ResultMatchSnapshot {
  id: string;
  version: number;
  teamId: string;
  opponentName: string;
  direction: MatchDirection;
  result?: Match['result'];
}

interface ResultDraft {
  snapshot: ResultMatchSnapshot;
  homeScore: string;
  awayScore: string;
  note: string;
  isDirty: boolean;
}

function createResultDraft(snapshot: ResultMatchSnapshot): ResultDraft {
  return {
    snapshot,
    homeScore: snapshot.result?.homeScore.toString() ?? '',
    awayScore: snapshot.result?.awayScore.toString() ?? '',
    note: snapshot.result?.note ?? '',
    isDirty: false,
  };
}

export default function MatchResultModal({
  isOpen,
  onClose,
  match,
  teams,
  onResultSaved,
}: MatchResultModalProps) {
  const tMatch = useTranslations('match');
  const mutation = MatchService.useSetResult();
  const detailsQuery = MatchService.useMatchDetails(match.id);
  const latestMatch = detailsQuery.data;
  const [draft, setDraft] = useState<ResultDraft>(() =>
    createResultDraft(latestMatch ?? match)
  );
  const [hasConflict, setHasConflict] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    const isOpening = isOpen && !wasOpen.current;
    wasOpen.current = isOpen;
    if (!isOpen) return;

    const candidate = latestMatch ?? match;
    if (isOpening || draft.snapshot.id !== candidate.id) {
      setDraft(createResultDraft(candidate));
      setHasConflict(false);
      setIsReloading(false);
      return;
    }

    if (
      !draft.isDirty &&
      !hasConflict &&
      candidate.version !== draft.snapshot.version
    ) {
      setDraft(createResultDraft(candidate));
    }
  }, [
    draft.isDirty,
    draft.snapshot.id,
    draft.snapshot.version,
    hasConflict,
    isOpen,
    latestMatch,
    match,
  ]);

  if (!isOpen) return null;

  const snapshot = draft.snapshot;
  const clubName =
    teams.find((team) => team.id === snapshot.teamId)?.shortName ??
    tMatch('modals.matchLineup.unknownTeam');
  const homeName =
    snapshot.direction === MatchDirection.HOME
      ? clubName
      : snapshot.opponentName;
  const awayName =
    snapshot.direction === MatchDirection.HOME
      ? snapshot.opponentName
      : clubName;
  const title = snapshot.result
    ? tMatch('modals.matchResult.correctTitle')
    : tMatch('modals.matchResult.recordTitle');

  const updateDraft = (
    field: 'homeScore' | 'awayScore' | 'note',
    value: string
  ) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
      isDirty: true,
    }));
  };

  const reloadLatest = async () => {
    setIsReloading(true);
    try {
      const refreshed = await detailsQuery.refetch();
      if (refreshed.error || !refreshed.data) {
        throw refreshed.error ?? new Error('Match detail unavailable');
      }
      setDraft(createResultDraft(refreshed.data));
      setHasConflict(false);
    } catch {
      toast.error(tMatch('modals.matchResult.reloadError'));
    } finally {
      setIsReloading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (hasConflict) return;

    const parsedHomeScore = Number(draft.homeScore);
    const parsedAwayScore = Number(draft.awayScore);
    if (
      !Number.isInteger(parsedHomeScore) ||
      parsedHomeScore < 0 ||
      !Number.isInteger(parsedAwayScore) ||
      parsedAwayScore < 0
    ) {
      toast.error(tMatch('modals.matchResult.scoreValidation'));
      return;
    }

    try {
      const saved = await mutation.mutateAsync({
        id: match.id,
        result: {
          expectedVersion: snapshot.version,
          homeScore: parsedHomeScore,
          awayScore: parsedAwayScore,
          note: draft.note,
        },
      });
      onResultSaved?.(saved);
      toast.success(tMatch('modals.matchResult.success'));
      onClose();
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response
        ?.status;
      if (status === 409) setHasConflict(true);
      toast.error(
        status === 409
          ? tMatch('modals.matchResult.conflictTitle')
          : tMatch('modals.matchResult.error')
      );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel={title}>
      <Card className="w-full max-w-lg">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {title}
          </CardTitle>
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
        <CardContent className="p-6">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="result-home-score">{homeName}</Label>
                <Input
                  id="result-home-score"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={draft.homeScore}
                  onChange={(event) =>
                    updateDraft('homeScore', event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="result-away-score">{awayName}</Label>
                <Input
                  id="result-away-score"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={draft.awayScore}
                  onChange={(event) =>
                    updateDraft('awayScore', event.target.value)
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="result-note">
                {tMatch('modals.matchResult.note')}
              </Label>
              <Textarea
                id="result-note"
                rows={4}
                maxLength={MATCH_RESULT_NOTE_MAX_LENGTH}
                value={draft.note}
                onChange={(event) => updateDraft('note', event.target.value)}
              />
              <p className="text-right text-xs text-muted-foreground">
                {draft.note.length}/{MATCH_RESULT_NOTE_MAX_LENGTH}
              </p>
            </div>

            {hasConflict && (
              <div
                role="alert"
                className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {tMatch('modals.matchResult.conflictTitle')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tMatch('modals.matchResult.conflictDescription')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={reloadLatest}
                  disabled={isReloading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {isReloading
                    ? tMatch('common.loading')
                    : tMatch('modals.matchResult.reloadLatest')}
                </Button>
              </div>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                {tMatch('actions.cancel')}
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={mutation.isPending || hasConflict || isReloading}
              >
                <Save className="mr-2 h-4 w-4" />
                {mutation.isPending
                  ? tMatch('common.loading')
                  : tMatch('modals.matchResult.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
  );
}
