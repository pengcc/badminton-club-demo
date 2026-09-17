'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, Save, X } from 'lucide-react';
import { MATCH_ARRIVAL_GUIDANCE_MAX_LENGTH } from '@club/shared-types/api/match';
import { MatchDirection } from '@club/shared-types/core/enums';
import type { Match, MatchFormData, Team } from '@app/lib/types';
import { MatchService } from '@app/services/matchService';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import {
  ConfirmDialog,
  useConfirmDialog,
} from '@app/components/ui/confirm-dialog';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { Textarea } from '@app/components/ui/textarea';
import { Modal } from '@app/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import { toast } from 'sonner';
import { getMatchCommandErrorMessageKey } from '@app/lib/matchCommandErrors';

interface EditMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMatchUpdated: (match: unknown) => void;
  match: Match | null;
  teams: Team[];
}

const emptyForm: MatchFormData = {
  teamId: '',
  opponentName: '',
  direction: MatchDirection.HOME,
  localDate: '',
  localTime: '',
  location: '',
  arrivalGuidance: '',
};

function formFromMatch(match: {
  teamId: string;
  opponentName: string;
  direction: MatchDirection;
  localStart: { date: string; time: string };
  location: string;
  arrivalGuidance?: string;
}): MatchFormData {
  return {
    teamId: match.teamId,
    opponentName: match.opponentName,
    direction: match.direction,
    localDate: match.localStart.date,
    localTime: match.localStart.time,
    location: match.location,
    arrivalGuidance: match.arrivalGuidance ?? '',
  };
}

export default function EditMatchModal({
  isOpen,
  onClose,
  onMatchUpdated,
  match,
  teams,
}: EditMatchModalProps) {
  const tMatch = useTranslations('match');
  const tDialog = useTranslations('dashboard.dialogActions');
  const updateMatch = MatchService.useUpdateMatch();
  const { data: latestMatch } = MatchService.useMatchDetails(match?.id ?? '');
  const authorizedMatch = latestMatch ?? match;
  const [formData, setFormData] = useState<MatchFormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { confirm, confirmProps } = useConfirmDialog({
    confirmText: tDialog('confirm'),
    cancelText: tDialog('cancel'),
    pendingText: tDialog('processing'),
  });

  useEffect(() => {
    if (isOpen && authorizedMatch) {
      setFormData(formFromMatch(authorizedMatch));
      setErrors({});
    }
  }, [authorizedMatch, isOpen]);

  if (!isOpen || !authorizedMatch) return null;

  const original = formFromMatch(authorizedMatch);
  const hasUnsavedChanges =
    JSON.stringify(formData) !== JSON.stringify(original);

  const close = () => {
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }
    confirm({
      title: tMatch('modals.editMatch.discardTitle'),
      description: tMatch('modals.editMatch.discardDescription'),
      variant: 'destructive',
      confirmText: tMatch('modals.editMatch.discard'),
      onConfirm: onClose,
    });
  };

  const setField = <K extends keyof MatchFormData>(
    field: K,
    value: MatchFormData[K]
  ) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!formData.teamId) next.teamId = tMatch('validation.teamRequired');
    if (!formData.opponentName.trim()) {
      next.opponentName = tMatch('validation.opponentRequired');
    }
    if (!formData.localDate) next.localDate = tMatch('validation.dateRequired');
    if (!formData.localTime) next.localTime = tMatch('validation.timeRequired');
    if (!formData.location.trim()) {
      next.location = tMatch('validation.locationRequired');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    try {
      const updated = await updateMatch.mutateAsync({
        id: authorizedMatch.id,
        expectedVersion: authorizedMatch.version,
        formData: {
          ...formData,
          opponentName: formData.opponentName.trim(),
          location: formData.location.trim(),
          arrivalGuidance: formData.arrivalGuidance,
        },
      });
      onMatchUpdated(updated);
      toast.success(tMatch('modals.editMatch.success'));
      onClose();
    } catch (error) {
      const messageKey = getMatchCommandErrorMessageKey(error);
      toast.error(
        messageKey ? tMatch(messageKey) : tMatch('modals.editMatch.error')
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      ariaLabel={tMatch('modals.editMatch.title')}
    >
      <ConfirmDialog {...confirmProps} />
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {tMatch('modals.editMatch.title')}
          </CardTitle>
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
        <CardContent className="overflow-y-auto p-6">
          <form id="edit-match-form" onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-match-date">{tMatch('fields.date')}</Label>
                <Input
                  id="edit-match-date"
                  type="date"
                  value={formData.localDate}
                  onChange={(event) =>
                    setField('localDate', event.target.value)
                  }
                />
                {errors.localDate && (
                  <p className="text-sm text-destructive">{errors.localDate}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-match-time">{tMatch('fields.time')}</Label>
                <Input
                  id="edit-match-time"
                  type="time"
                  value={formData.localTime}
                  onChange={(event) =>
                    setField('localTime', event.target.value)
                  }
                />
                {errors.localTime && (
                  <p className="text-sm text-destructive">{errors.localTime}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{tMatch('fields.team')}</Label>
                <Select
                  value={formData.teamId}
                  onValueChange={(value) => setField('teamId', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.shortName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.teamId && (
                  <p className="text-sm text-destructive">{errors.teamId}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{tMatch('fields.direction')}</Label>
                <Select
                  value={formData.direction}
                  onValueChange={(value) =>
                    setField('direction', value as MatchDirection)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MatchDirection.HOME}>
                      {tMatch('direction.home')}
                    </SelectItem>
                    <SelectItem value={MatchDirection.AWAY}>
                      {tMatch('direction.away')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-opponent">{tMatch('fields.opponent')}</Label>
              <Input
                id="edit-opponent"
                value={formData.opponentName}
                onChange={(event) =>
                  setField('opponentName', event.target.value)
                }
              />
              {errors.opponentName && (
                <p className="text-sm text-destructive">
                  {errors.opponentName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-location">{tMatch('fields.location')}</Label>
              <Input
                id="edit-location"
                value={formData.location}
                onChange={(event) => setField('location', event.target.value)}
              />
              {errors.location && (
                <p className="text-sm text-destructive">{errors.location}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-arrival-guidance">
                {tMatch('fields.arrivalGuidance')}
              </Label>
              <Textarea
                id="edit-arrival-guidance"
                value={formData.arrivalGuidance}
                onChange={(event) =>
                  setField('arrivalGuidance', event.target.value)
                }
                maxLength={MATCH_ARRIVAL_GUIDANCE_MAX_LENGTH}
                placeholder={tMatch('fields.arrivalGuidancePlaceholder')}
              />
              <p className="text-sm text-muted-foreground">
                {tMatch('fields.arrivalGuidanceHelp')}
              </p>
            </div>
          </form>
        </CardContent>
        <div className="flex gap-3 border-t p-4">
          <Button type="button" variant="outline" onClick={close}>
            {tMatch('actions.cancel')}
          </Button>
          <Button
            type="submit"
            form="edit-match-form"
            className="flex-1"
            disabled={updateMatch.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {tMatch('actions.updateMatch')}
          </Button>
        </div>
      </Card>
    </Modal>
  );
}
