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
import { formatTeamClass, teamClassOptions } from '@app/lib/teamClass';

import { Users, X, Save } from 'lucide-react';

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamCreated?: () => void;
}

interface TeamFormData {
  teamId: string;
  shortName: string;
  leagueTeamName: string;
  matchLevel: TeamLevel | '';
}

export default function CreateTeamModal({
  isOpen,
  onClose,
  onTeamCreated,
}: CreateTeamModalProps) {
  const tDashboard = useTranslations('dashboard');
  const tDialog = useTranslations('dashboard.dialogActions');
  const createTeamMutation = TeamService.useCreateTeam();

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
    if (isOpen) {
      const hasChanges =
        formData.teamId.trim() !== '' ||
        formData.shortName.trim() !== '' ||
        formData.leagueTeamName.trim() !== '' ||
        formData.matchLevel !== '';
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        teamId: '',
        shortName: '',
        leagueTeamName: '',
        matchLevel: '',
      });
      setErrors({});
      setHasUnsavedChanges(false);
    }
  }, [isOpen]);

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

    // Validate teamId (required, lowercase alphanumeric, max 10 chars)
    if (!formData.teamId.trim()) {
      newErrors.teamId = 'Team ID is required';
    } else if (!/^[a-z0-9]+$/.test(formData.teamId.trim())) {
      newErrors.teamId = 'Team ID must be lowercase alphanumeric';
    } else if (formData.teamId.trim().length > 10) {
      newErrors.teamId = 'Team ID too long (max 10 characters)';
    }

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
      newErrors.shortName = 'Short name too long (max 50 characters)';
    }

    // Validate leagueTeamName (required, max 100 chars)
    if (!formData.leagueTeamName.trim()) {
      newErrors.leagueTeamName = 'League team name is required';
    } else if (formData.leagueTeamName.trim().length > 100) {
      newErrors.leagueTeamName =
        'League team name too long (max 100 characters)';
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

    if (!validateForm()) {
      return;
    }

    const matchLevel = formData.matchLevel;
    if (!matchLevel) return;

    setIsSubmitting(true);

    try {
      await createTeamMutation.mutateAsync({
        teamId: formData.teamId.trim(),
        shortName: formData.shortName.trim(),
        leagueTeamName: formData.leagueTeamName.trim(),
        matchLevel,
      });

      // Success
      setHasUnsavedChanges(false);
      onTeamCreated?.();
      onClose();
    } catch (error: any) {
      console.error('Team creation failed');
      setErrors({
        submit:
          error.message || tDashboard('teamManagement.errors.createFailed'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
      ariaLabel={tDashboard('teamManagement.createTeam')}
    >
      <ConfirmDialog {...confirmProps} />
      <Card className="w-full max-w-md max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0 border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {tDashboard('teamManagement.createTeam')}
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
            id="create-team-form"
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {/* Team ID */}
            <div className="space-y-2">
              <Label htmlFor="teamId" className="required">
                {tDashboard('teamManagement.fields.teamId')}
              </Label>
              <Input
                id="teamId"
                value={formData.teamId}
                onChange={(e) =>
                  handleInputChange('teamId', e.target.value.toLowerCase())
                }
                placeholder={tDashboard('teamManagement.placeholders.teamId')}
                aria-invalid={Boolean(errors.teamId)}
                aria-describedby={errors.teamId ? 'teamId-error' : undefined}
                disabled={isSubmitting}
                autoFocus
              />
              {errors.teamId && (
                <p id="teamId-error" className="text-sm text-red-500">
                  {errors.teamId}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {tDashboard('teamManagement.placeholders.teamIdHint')}
              </p>
            </div>

            {/* Short Name */}
            <div className="space-y-2">
              <Label htmlFor="shortName" className="required">
                {tDashboard('teamManagement.fields.name')}
              </Label>
              <Input
                id="shortName"
                value={formData.shortName}
                onChange={(e) => handleInputChange('shortName', e.target.value)}
                placeholder={tDashboard(
                  'teamManagement.placeholders.enterTeamName'
                )}
                aria-invalid={Boolean(errors.shortName)}
                aria-describedby={
                  errors.shortName ? 'shortName-error' : undefined
                }
                disabled={isSubmitting}
              />
              {errors.shortName && (
                <p id="shortName-error" className="text-sm text-red-500">
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
                  errors.leagueTeamName ? 'leagueTeamName-error' : undefined
                }
                disabled={isSubmitting}
              />
              {errors.leagueTeamName && (
                <p id="leagueTeamName-error" className="text-sm text-red-500">
                  {errors.leagueTeamName}
                </p>
              )}
            </div>

            {/* Match Level */}
            <div className="space-y-2">
              <Label htmlFor="matchLevel" className="required">
                {tDashboard('teamManagement.fields.matchLevel')}
              </Label>
              <Select
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
                    errors.matchLevel ? 'matchLevel-error' : undefined
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
                <p id="matchLevel-error" className="text-sm text-red-500">
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
              form="create-team-form"
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSubmitting
                ? tDashboard('buttons.save')
                : tDashboard('teamManagement.createTeam')}
            </Button>
          </div>
        </div>
      </Card>
    </Modal>
  );
}
