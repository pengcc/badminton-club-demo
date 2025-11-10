'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@app/components/ui/select';
import { TeamService } from '@app/services/teamService';
import { TeamLevel } from '@club/shared-types/core/enums';
import { useModalBehavior } from '@/app/hooks/useModalBehavior';
import {
  Users,
  X,
  Save
} from 'lucide-react';

interface EditTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamUpdated?: () => void;
  team: any | null;
}

interface TeamFormData {
  name: string;
  matchLevel: TeamLevel;
}

export default function EditTeamModal({
  isOpen,
  onClose,
  onTeamUpdated,
  team
}: EditTeamModalProps) {
  const tDashboard = useTranslations('dashboard');
  const updateTeamMutation = TeamService.useUpdateTeam();

  const [formData, setFormData] = useState<TeamFormData>({
    name: '',
    matchLevel: TeamLevel.C
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track unsaved changes
  useEffect(() => {
    if (isOpen && team) {
      const hasChanges =
        formData.name !== team.name ||
        formData.matchLevel !== team.matchLevel;
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, team, isOpen]);

  // ESC key handler with unsaved changes warning
  const { handleCloseAttempt, modalProps } = useModalBehavior({
    isOpen,
    onClose,
    hasUnsavedChanges,
    enableBackdropClose: true,
  });

  // Load team data when modal opens
  useEffect(() => {
    if (isOpen && team) {
      setFormData({
        name: team.name || '',
        matchLevel: team.matchLevel || TeamLevel.C
      });
      setErrors({});
      setHasUnsavedChanges(false);
    }
  }, [isOpen, team]);

  const handleInputChange = (field: keyof TeamFormData, value: string | TeamLevel) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate name (required, 2-100 chars)
    if (!formData.name.trim()) {
      newErrors.name = tDashboard('teamManagement.validation.nameRequired');
    } else if (formData.name.trim().length < 2) {
      newErrors.name = tDashboard('teamManagement.validation.nameTooShort');
    } else if (formData.name.trim().length > 100) {
      newErrors.name = tDashboard('teamManagement.validation.nameTooLong');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!team || !validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await updateTeamMutation.mutateAsync({
        id: team.id,
        formData: {
          name: formData.name.trim(),
          matchLevel: formData.matchLevel
        }
      });

      // Success
      setHasUnsavedChanges(false);
      onTeamUpdated?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to update team:', error);
      setErrors({
        submit: error.message || tDashboard('teamManagement.errors.updateFailed')
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !team) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCloseAttempt();
        }
      }}
      {...modalProps}
    >
      <Card className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {tDashboard('teamManagement.editTeam')}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCloseAttempt}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Team Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="required">
                {tDashboard('teamManagement.fields.name')}
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder={tDashboard('teamManagement.placeholders.enterTeamName')}
                className={errors.name ? 'border-red-500' : ''}
                disabled={isSubmitting}
                autoFocus
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Match Level - Key prop to force re-render when team changes */}
            <div className="space-y-2">
              <Label htmlFor="matchLevel">
                {tDashboard('teamManagement.fields.matchLevel')}
              </Label>
              <Select
                key={`matchLevel-${team?.id}-${formData.matchLevel}`}
                value={formData.matchLevel}
                onValueChange={(value) => handleInputChange('matchLevel', value as TeamLevel)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="matchLevel">
                  <SelectValue placeholder={tDashboard('teamManagement.placeholders.matchLevel')} />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TeamLevel).map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
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
                disabled={isSubmitting}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? tDashboard('buttons.saving') : tDashboard('buttons.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
