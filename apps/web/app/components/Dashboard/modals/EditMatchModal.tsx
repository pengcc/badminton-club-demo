'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { Textarea } from '@app/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@app/components/ui/select';
import type { Match, Team } from '@app/lib/types';
import { MatchService } from '@app/services/matchService';
import { MatchStatus } from '@club/shared-types/core/enums';
import { useModalBehavior } from '@/app/hooks/useModalBehavior';
import {
  Calendar,
  X,
  Save
} from 'lucide-react';



interface EditMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMatchUpdated: (match: any) => void;
  match: Match | null;
  teams: Team[];
}

interface MatchFormData {
  date: string;
  time: string;
  location: string;
  team: string;
  opponent?: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  cancellationReason?: string;
}

export default function EditMatchModal({
  isOpen,
  onClose,
  onMatchUpdated,
  match,
  teams
}: EditMatchModalProps) {
  const tMatch = useTranslations('match');
  const updateMatchMutation = MatchService.useUpdateMatch();

  const [formData, setFormData] = useState<MatchFormData>({
    date: '',
    time: '',
    location: '',
    team: '',
    opponent: '',
    status: MatchStatus.SCHEDULED,
    homeScore: undefined,
    awayScore: undefined,
    cancellationReason: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track unsaved changes
  useEffect(() => {
    if (isOpen && match) {
      const matchDate = new Date(match.date);
      const hasChanges =
        formData.date !== matchDate.toISOString().split('T')[0] ||
        formData.time !== match.time ||
        formData.location !== (match.location || '') ||
        formData.team !== match.homeTeamId ||
        formData.opponent !== (match.awayTeamName || '') ||
        formData.status !== match.status ||
        formData.homeScore !== match.scores?.homeScore ||
        formData.awayScore !== match.scores?.awayScore ||
        formData.cancellationReason !== (match.cancellationReason || '');

      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, match, isOpen]);

  // ESC key handler with unsaved changes warning
  const { handleCloseAttempt, modalProps: _modalProps } = useModalBehavior({
    isOpen,
    onClose,
    hasUnsavedChanges,
    enableBackdropClose: true,
  });

  // Load match data when modal opens
  useEffect(() => {
    if (isOpen && match) {
      const matchDate = new Date(match.date);

      setFormData({
        date: matchDate.toISOString().split('T')[0],
        time: match.time,
        location: match.location || '',
        team: match.homeTeamId,
        opponent: match.awayTeamName || '',
        status: (match.status as MatchStatus) || MatchStatus.SCHEDULED,
        homeScore: match.scores?.homeScore,
        awayScore: match.scores?.awayScore,
        cancellationReason: match.cancellationReason || ''
      });
      setErrors({});
    }
  }, [isOpen, match, teams]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.date) {
      newErrors.date = 'Match date is required';
    }

    if (!formData.time) {
      newErrors.time = 'Match time is required';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }

    if (!formData.team) {
      newErrors.team = 'Please select a team';
    }

    if (formData.status === 'completed') {
      if (formData.homeScore === undefined || formData.homeScore < 0) {
        newErrors.homeScore = 'Home score is required for completed matches';
      }
      if (formData.awayScore === undefined || formData.awayScore < 0) {
        newErrors.awayScore = 'Away score is required for completed matches';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !match) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Call service to update match
      const updatedMatch = await updateMatchMutation.mutateAsync({
        id: match.id,
        formData: formData as any
      });

      // Update parent component with the updated match data
      onMatchUpdated(updatedMatch);

      // Show success message
      alert('Match updated successfully!');

      onClose();
    } catch (error: any) {
      console.group('❌ Error updating match');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Match ID:', match.id);
      console.error('Form data:', formData);
      console.groupEnd();

      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      alert(`Failed to update match: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof MatchFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      });
    }
  };

  if (!isOpen || !match) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-hidden"
      onClick={(e) => {
        // Close modal when clicking backdrop (with unsaved changes check)
        if (e.target === e.currentTarget) {
          handleCloseAttempt();
        }
      }}
    >
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Edit Match
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
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Match Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Match Details</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-match-date">Match Date *</Label>
                  <Input
                    id="edit-match-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className={errors.date ? 'border-red-500' : ''}
                  />
                  {errors.date && (
                    <p className="text-sm text-red-500">{errors.date}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-match-time">Match Time *</Label>
                  <Input
                    id="edit-match-time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => handleInputChange('time', e.target.value)}
                    className={errors.time ? 'border-red-500' : ''}
                  />
                  {errors.time && (
                    <p className="text-sm text-red-500">{errors.time}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-location">Location *</Label>
                <Input
                  id="edit-location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Enter match location"
                  className={errors.location ? 'border-red-500' : ''}
                />
                {errors.location && (
                  <p className="text-sm text-red-500">{errors.location}</p>
                )}
              </div>
            </div>

            {/* Teams and Status */}
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Our Team *</Label>
                  <Select
                    key={`team-select-${formData.team}`}
                    value={formData.team}
                    onValueChange={(value) => handleInputChange('team', value)}
                  >
                    <SelectTrigger className={errors.team ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select our team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.team && (
                    <p className="text-sm text-red-500">{errors.team}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-opponent">Opponent</Label>
                  <Input
                    id="edit-opponent"
                    value={formData.opponent}
                    onChange={(e) => handleInputChange('opponent', e.target.value)}
                    placeholder="Enter opponent team name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  key={`status-${match?.id}-${formData.status}`}
                  value={formData.status}
                  onValueChange={(value) => handleInputChange('status', value as MatchStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(MatchStatus).map((status) => (
                      <SelectItem key={status} value={status}>
                        {tMatch(`status.${status}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.status === MatchStatus.COMPLETED && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="home-score">Home Score *</Label>
                    <Input
                      id="home-score"
                      type="number"
                      min="0"
                      value={formData.homeScore || ''}
                      onChange={(e) => handleInputChange('homeScore', parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className={errors.homeScore ? 'border-red-500' : ''}
                    />
                    {errors.homeScore && (
                      <p className="text-sm text-red-500">{errors.homeScore}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="away-score">Away Score *</Label>
                    <Input
                      id="away-score"
                      type="number"
                      min="0"
                      value={formData.awayScore || ''}
                      onChange={(e) => handleInputChange('awayScore', parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className={errors.awayScore ? 'border-red-500' : ''}
                    />
                    {errors.awayScore && (
                      <p className="text-sm text-red-500">{errors.awayScore}</p>
                    )}
                  </div>
                </div>
              )}

              {formData.status === MatchStatus.CANCELLED && (
                <div className="space-y-2">
                  <Label htmlFor="cancellation-reason">{tMatch('modals.editMatch.cancellationReason')}</Label>
                  <Textarea
                    id="cancellation-reason"
                    value={formData.cancellationReason || ''}
                    onChange={(e) => handleInputChange('cancellationReason', e.target.value)}
                    placeholder={tMatch('modals.editMatch.cancellationPlaceholder')}
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.cancellationReason?.length || 0}/500 characters
                  </p>
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="sm:order-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="sm:order-2 flex-1 hover:bg-primary hover:text-primary-foreground"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Update Match
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}