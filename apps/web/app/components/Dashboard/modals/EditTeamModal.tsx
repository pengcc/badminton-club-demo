'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Modal } from '@app/components/ui/modal';
import { Button } from '@app/components/ui/button';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import { TeamService } from '@app/services/teamService';
import { TeamLevel } from '@club/shared-types/core/enums';
import {
  ConfirmDialog,
  useConfirmDialog,
} from '@app/components/ui/confirm-dialog';
import { teamMatchLevelSchema } from '@club/shared-types/schemas/team';
import { formatTeamClass, teamClassOptions } from '@app/lib/teamClass';

import { Users, X, Save } from 'lucide-react';

interface EditTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamUpdated?: () => void;
  team: any | null;
}

interface TeamFormData {
  teamId: string;
  shortName: string;
  leagueTeamName: string;
  matchLevel: TeamLevel | '';
}

export default function EditTeamModal({
  isOpen,
  onClose,
  onTeamUpdated,
  team,
}: EditTeamModalProps) {
  const tDashboard = useTranslations('dashboard');
  const tDialog = useTranslations('dashboard.dialogActions');
  const updateTeamMutation = TeamService.useUpdateTeam();

  const [formData, setFormData] = useState<TeamFormData>({
    teamId: '',
    shortName: '',
    leagueTeamName: '',
    matchLevel: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { confirm: confirmDialog, confirmProps } = useConfirmDialog({
    confirmText: tDialog('confirm'),
    cancelText: tDialog('cancel'),
    pendingText: tDialog('processing'),
  });

  // Track unsaved changes
  useEffect(() => {
    if (isOpen && team) {
      const parsedMatchLevel = teamMatchLevelSchema.safeParse(team.matchLevel);
      const originalMatchLevel = parsedMatchLevel.success
        ? parsedMatchLevel.data
        : '';
      const hasChanges =
        formData.shortName !== team.shortName ||
        formData.leagueTeamName !== team.leagueTeamName ||
        formData.matchLevel !== originalMatchLevel;
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, team, isOpen]);

  // Load team data when modal opens
  useEffect(() => {
    if (isOpen && team) {
      const parsedMatchLevel = teamMatchLevelSchema.safeParse(team.matchLevel);
      setFormData({
        teamId: team.teamId || '',
        shortName: team.shortName || '',
        leagueTeamName: team.leagueTeamName || '',
        matchLevel: parsedMatchLevel.success ? parsedMatchLevel.data : '',
      });
      setErrors({});
      setHasUnsavedChanges(false);
    }
  }, [isOpen, team]);

  const handleInputChange = (
    field: keyof TeamFormData,
    value: string | TeamLevel
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate shortName (required, 2-50 chars)
    if (!formData.shortName.trim()) {
      newErrors.shortName = tDashboard(
        'teamManagement.validation.nameRequired'
      );
    } else if (formData.shortName.trim().length < 2) {
      newErrors.shortName = tDashboard(
        'teamManagement.validation.nameTooShort'
      );
    } else if (formData.shortName.trim().length > 50) {
      newErrors.shortName = tDashboard('teamManagement.validation.nameTooLong');
    }

    // Validate leagueTeamName (required, max 100 chars)
    if (!formData.leagueTeamName.trim()) {
      newErrors.leagueTeamName = 'League team name is required';
    } else if (formData.leagueTeamName.trim().length > 100) {
      newErrors.leagueTeamName = 'League team name too long';
    }

    if (!formData.matchLevel) {
      newErrors.matchLevel = tDashboard(
        'teamManagement.validation.matchLevelRequired'
      );
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!team || !validateForm()) {
      return;
    }

    const matchLevel = formData.matchLevel;
    if (!matchLevel) return;

    setIsSubmitting(true);

    try {
      await updateTeamMutation.mutateAsync({
        id: team.id,
        formData: {
          shortName: formData.shortName.trim(),
          leagueTeamName: formData.leagueTeamName.trim(),
          matchLevel,
        },
      });

      // Success
      setHasUnsavedChanges(false);
      onTeamUpdated?.();
      onClose();
    } catch (error: any) {
      console.error('Team update failed');
      setErrors({
        submit:
          error.message || tDashboard('teamManagement.errors.updateFailed'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !team) return null;

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      confirmDialog({
        title: 'Discard changes?',
        description:
          'You have unsaved changes. Are you sure you want to close?',
        variant: 'destructive',
        confirmText: 'Discard',
        onConfirm: () => onClose(),
      });
    } else {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseAttempt}
      ariaLabel={tDashboard('teamManagement.editTeam')}
    >
      <ConfirmDialog {...confirmProps} />
      <Card className="w-full max-w-md max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0 border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {tDashboard('teamManagement.editTeam')}
          </CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCloseAttempt}
              aria-label={tDialog('close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto overscroll-contain p-6">
          <form
            id="edit-team-form"
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {/* Team ID (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="teamId">
                {tDashboard('teamManagement.fields.teamId')}
              </Label>
              <Input
                id="teamId"
                value={formData.teamId}
                disabled
                className="bg-muted"
              />
            </div>

            {/* Short Name */}
            <div className="space-y-2">
              <Label htmlFor="shortName" className="required">
                {tDashboard('teamManagement.fields.displayName')}
              </Label>
              <Input
                id="shortName"
                value={formData.shortName}
                onChange={(e) => handleInputChange('shortName', e.target.value)}
                placeholder={tDashboard(
                  'teamManagement.placeholders.displayName'
                )}
                aria-invalid={Boolean(errors.shortName)}
                aria-describedby={
                  errors.shortName ? 'edit-shortName-error' : undefined
                }
                disabled={isSubmitting}
                autoFocus
              />
              {errors.shortName && (
                <p id="edit-shortName-error" className="text-sm text-red-500">
                  {errors.shortName}
                </p>
              )}
            </div>

            {/* League Team Name */}
            <div className="space-y-2">
              <Label htmlFor="leagueTeamName" className="required">
                {tDashboard('teamManagement.fields.leagueName')}
              </Label>
              <Input
                id="leagueTeamName"
                value={formData.leagueTeamName}
                onChange={(e) =>
                  handleInputChange('leagueTeamName', e.target.value)
                }
                placeholder={tDashboard(
                  'teamManagement.placeholders.leagueName'
                )}
                aria-invalid={Boolean(errors.leagueTeamName)}
                aria-describedby={
                  errors.leagueTeamName
                    ? 'edit-leagueTeamName-error'
                    : undefined
                }
                disabled={isSubmitting}
              />
              {errors.leagueTeamName && (
                <p
                  id="edit-leagueTeamName-error"
                  className="text-sm text-red-500"
                >
                  {errors.leagueTeamName}
                </p>
              )}
            </div>

            {/* Match Level - Key prop to force re-render when team changes */}
            <div className="space-y-2">
              <Label htmlFor="matchLevel" className="required">
                {tDashboard('teamManagement.fields.matchLevel')}
              </Label>
              <Select
                key={`matchLevel-${team?.id}-${formData.matchLevel}`}
                value={formData.matchLevel}
                onValueChange={(value) =>
                  handleInputChange('matchLevel', value as TeamLevel)
                }
                disabled={isSubmitting}
              >
                <SelectTrigger
                  id="matchLevel"
                  className="w-full"
                  aria-required="true"
                  aria-invalid={Boolean(errors.matchLevel)}
                  aria-describedby={
                    errors.matchLevel ? 'edit-matchLevel-error' : undefined
                  }
                >
                  <SelectValue
                    placeholder={tDashboard(
                      'teamManagement.placeholders.matchLevel'
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {teamClassOptions.map((level) => (
                    <SelectItem key={level} value={level}>
                      {formatTeamClass(level)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.matchLevel && (
                <p id="edit-matchLevel-error" className="text-sm text-red-500">
                  {errors.matchLevel}
                </p>
              )}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {errors.submit}
                </p>
              </div>
            )}
          </form>
        </CardContent>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 border-t p-4 bg-muted/20">
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseAttempt}
              disabled={isSubmitting}
            >
              {tDashboard('buttons.cancel')}
            </Button>
            <Button
              type="submit"
              form="edit-team-form"
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSubmitting
                ? tDashboard('buttons.saving')
                : tDashboard('buttons.save')}
            </Button>
          </div>
        </div>
      </Card>
    </Modal>
  );
}
