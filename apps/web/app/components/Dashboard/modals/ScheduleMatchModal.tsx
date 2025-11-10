'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@app/components/ui/select';
import { MatchService } from '@app/services/matchService';
import { Team } from '@app/lib/types';
import { useModalBehavior } from '@/app/hooks/useModalBehavior';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Trophy,
  X,
  Save
} from 'lucide-react';

interface ScheduleMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMatchCreated: (match: any) => void;
  teams: Team[];
}

interface MatchFormData {
  date: string;
  time: string;
  location: string;
  team: string;
  opponent?: string;
}

export default function ScheduleMatchModal({
  isOpen,
  onClose,
  onMatchCreated,
  teams
}: ScheduleMatchModalProps) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const tMatch = useTranslations('match');
  const createMatchMutation = MatchService.useCreateMatch();

  const [formData, setFormData] = useState<MatchFormData>({
    date: '',
    time: '',
    location: '',
    team: '',
    opponent: ''
  });

  const [errors, setErrors] = useState<Partial<MatchFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        date: '',
        time: '',
        location: '',
        team: '',
        opponent: ''
      });
      setErrors({});
    }
  }, [isOpen]);

  // ESC key handler and body scroll lock
  useModalBehavior({ isOpen, onClose });

  const validateForm = (): boolean => {
    const newErrors: Partial<MatchFormData> = {};

    // Required field validations
    if (!formData.date) {
      newErrors.date = tMatch('modals.scheduleMatch.validation.dateRequired');
    } else {
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        newErrors.date = tMatch('modals.scheduleMatch.validation.datePast');
      }
    }

    if (!formData.time) {
      newErrors.time = tMatch('modals.scheduleMatch.validation.timeRequired');
    }

    if (!formData.location.trim()) {
      newErrors.location = tMatch('modals.scheduleMatch.validation.locationRequired');
    }

    if (!formData.team) {
      newErrors.team = tMatch('modals.scheduleMatch.validation.teamRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('📝 Creating match with form data:', formData);

      // Transform form data to match API expectations
      const matchData: any = {
        date: formData.date,
        time: formData.time,
        location: formData.location,
        homeTeamId: formData.team, // Map 'team' to 'homeTeamId'
        awayTeamName: formData.opponent || '',
        lineup: {}, // Empty lineup for new match
      };

      console.log('📤 Sending to API:', matchData);

      const newMatch = await createMatchMutation.mutateAsync(matchData as any);

      console.log('✅ Match created successfully:', newMatch);
      alert(tMatch('modals.scheduleMatch.success'));

      // Pass the created match to parent component
      onMatchCreated(newMatch);
      onClose();
    } catch (error: any) {
      console.group('❌ Error creating match');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Form data:', formData);
      console.groupEnd();

      const errorMessage = error.response?.data?.message || error.message || tMatch('modals.scheduleMatch.error');
      alert(`${tMatch('modals.scheduleMatch.error')}: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof MatchFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {tMatch('modals.scheduleMatch.title')}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Match Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{tMatch('modals.scheduleMatch.matchDetails')}</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="match-date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {tMatch('modals.scheduleMatch.date')} *
                  </Label>
                  <Input
                    id="match-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className={errors.date ? 'border-red-500' : ''}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {errors.date && (
                    <p className="text-sm text-red-500">{errors.date}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="match-time" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {tMatch('modals.scheduleMatch.time')} *
                  </Label>
                  <Input
                    id="match-time"
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
                <Label htmlFor="location" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {tMatch('modals.scheduleMatch.location')} *
                </Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder={tMatch('modals.scheduleMatch.placeholders.enterLocation')}
                  className={errors.location ? 'border-red-500' : ''}
                />
                {errors.location && (
                  <p className="text-sm text-red-500">{errors.location}</p>
                )}
              </div>
            </div>

            {/* Team Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Teams</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="team" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {tMatch('modals.scheduleMatch.homeTeam')} *
                  </Label>
                  <Select value={formData.team} onValueChange={(value) => handleInputChange('team', value)}>
                    <SelectTrigger className={errors.team ? 'border-red-500' : ''}>
                      <SelectValue placeholder={tMatch('modals.scheduleMatch.placeholders.selectTeam')} />
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
                  <Label htmlFor="opponent" className="flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    {tMatch('modals.scheduleMatch.opponent')}
                  </Label>
                  <Input
                    id="opponent"
                    value={formData.opponent}
                    onChange={(e) => handleInputChange('opponent', e.target.value)}
                    placeholder={tMatch('modals.scheduleMatch.placeholders.enterOpponent')}
                  />
                </div>
              </div>
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
                {tMatch('actions.cancel')}
              </Button>
              <Button
                type="submit"
                className="sm:order-2 flex-1 hover:bg-primary hover:text-primary-foreground"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {tMatch('common.loading')}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {tMatch('actions.scheduleMatch')}
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