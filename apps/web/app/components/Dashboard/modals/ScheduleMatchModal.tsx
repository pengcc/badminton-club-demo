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
import { Textarea } from '@app/components/ui/textarea';
import { FormLabel } from '@app/components/FormLabel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import { MatchService } from '@app/services/matchService';
import type { Team } from '@app/lib/types';
import { toast } from 'sonner';
import { MATCH_ARRIVAL_GUIDANCE_MAX_LENGTH } from '@club/shared-types/api/match';
import { MatchDirection } from '@club/shared-types/core/enums';
import type { MatchFormData as CanonicalMatchFormData } from '@app/lib/types';
import { getMatchCommandErrorMessageKey } from '@app/lib/matchCommandErrors';

import { Calendar, Clock, MapPin, Users, Trophy, X, Save } from 'lucide-react';

interface ScheduleMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMatchCreated: (match: any) => void;
  teams: Team[];
}

interface MatchFormData {
  date: string;
  time: string;
  // Structured location fields (Phase 5)
  locationTitle: string; // "AK Hallenadresse"
  locationStreet: string; // "Ruppiner Straße 47"
  locationPostalCity: string; // "10115 Berlin - Mitte"
  arrivalGuidance: string;
  team: string;
  opponent?: string;
  direction: MatchDirection;
}

export default function ScheduleMatchModal({
  isOpen,
  onClose,
  onMatchCreated,
  teams,
}: ScheduleMatchModalProps) {
  const tMatch = useTranslations('match');
  const createMatchMutation = MatchService.useCreateMatch();

  const [formData, setFormData] = useState<MatchFormData>({
    date: '',
    time: '',
    locationTitle: '',
    locationStreet: '',
    locationPostalCity: '',
    arrivalGuidance: '',
    team: '',
    opponent: '',
    direction: MatchDirection.HOME,
  });

  const [errors, setErrors] = useState<Partial<MatchFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        date: '',
        time: '',
        locationTitle: '',
        locationStreet: '',
        locationPostalCity: '',
        arrivalGuidance: '',
        team: '',
        opponent: '',
        direction: MatchDirection.HOME,
      });
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Partial<MatchFormData> = {};

    // Required field validations
    if (!formData.date) {
      newErrors.date = tMatch('modals.scheduleMatch.validation.dateRequired');
    }

    if (!formData.time) {
      newErrors.time = tMatch('modals.scheduleMatch.validation.timeRequired');
    }

    // Validate location title (required)
    if (!formData.locationTitle.trim()) {
      newErrors.locationTitle = tMatch(
        'modals.scheduleMatch.validation.locationRequired'
      );
    }

    if (!formData.team) {
      newErrors.team = tMatch('modals.scheduleMatch.validation.teamRequired');
    }
    if (!formData.opponent?.trim()) {
      newErrors.opponent = tMatch(
        'modals.scheduleMatch.validation.opponentRequired'
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

    setIsSubmitting(true);

    try {
      // Build normalized location string from structured fields
      const buildLocationString = (): string => {
        const parts = [
          formData.locationTitle.trim(),
          formData.locationStreet.trim(),
          formData.locationPostalCity.trim(),
        ].filter(Boolean);

        return parts.join('\n');
      };

      // Transform form data to match API expectations
      const matchData: CanonicalMatchFormData = {
        localDate: formData.date,
        localTime: formData.time,
        location: buildLocationString(),
        arrivalGuidance: formData.arrivalGuidance,
        teamId: formData.team,
        opponentName: formData.opponent?.trim() ?? '',
        direction: formData.direction,
      };

      const newMatch = await createMatchMutation.mutateAsync(matchData);

      toast.success(tMatch('modals.scheduleMatch.success'));

      // Pass the created match to parent component
      onMatchCreated(newMatch);
      onClose();
    } catch (error) {
      const messageKey = getMatchCommandErrorMessageKey(error);
      toast.error(
        messageKey ? tMatch(messageKey) : tMatch('modals.scheduleMatch.error')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof MatchFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={tMatch('modals.scheduleMatch.title')}
    >
      <Card className="w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0 border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {tMatch('modals.scheduleMatch.title')}
          </CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={tMatch('actions.close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <form
            id="schedule-match-form"
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* Match Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">
                {tMatch('modals.scheduleMatch.matchDetails')}
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <FormLabel
                    htmlFor="match-date"
                    icon={<Calendar className="h-4 w-4" />}
                    required
                  >
                    {tMatch('modals.scheduleMatch.date')}
                  </FormLabel>
                  <Input
                    id="match-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    aria-invalid={Boolean(errors.date)}
                    aria-describedby={
                      errors.date ? 'match-date-error' : undefined
                    }
                  />
                  {errors.date && (
                    <p id="match-date-error" className="text-sm text-red-500">
                      {errors.date}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <FormLabel
                    htmlFor="match-time"
                    icon={<Clock className="h-4 w-4" />}
                    required
                  >
                    {tMatch('modals.scheduleMatch.time')}
                  </FormLabel>
                  <Input
                    id="match-time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => handleInputChange('time', e.target.value)}
                    aria-invalid={Boolean(errors.time)}
                    aria-describedby={
                      errors.time ? 'match-time-error' : undefined
                    }
                  />
                  {errors.time && (
                    <p id="match-time-error" className="text-sm text-red-500">
                      {errors.time}
                    </p>
                  )}
                </div>
              </div>

              {/* Location - Structured Input (Phase 5) */}
              <div className="space-y-3">
                <FormLabel
                  htmlFor="location-title"
                  icon={<MapPin className="h-4 w-4" />}
                  required
                >
                  {tMatch('modals.scheduleMatch.location')}
                </FormLabel>

                {/* Location Title */}
                <Input
                  id="location-title"
                  placeholder={tMatch(
                    'modals.scheduleMatch.placeholders.locationTitle'
                  )}
                  value={formData.locationTitle}
                  onChange={(e) =>
                    handleInputChange('locationTitle', e.target.value)
                  }
                  aria-invalid={Boolean(errors.locationTitle)}
                  aria-describedby={
                    errors.locationTitle ? 'location-title-error' : undefined
                  }
                />
                {errors.locationTitle && (
                  <p id="location-title-error" className="text-sm text-red-500">
                    {errors.locationTitle}
                  </p>
                )}

                {/* Street + Number */}
                <Input
                  id="location-street"
                  placeholder={tMatch(
                    'modals.scheduleMatch.placeholders.locationStreet'
                  )}
                  value={formData.locationStreet}
                  onChange={(e) =>
                    handleInputChange('locationStreet', e.target.value)
                  }
                />

                {/* Postal Code + City */}
                <Input
                  id="location-postal"
                  placeholder={tMatch(
                    'modals.scheduleMatch.placeholders.locationPostalCity'
                  )}
                  value={formData.locationPostalCity}
                  onChange={(e) =>
                    handleInputChange('locationPostalCity', e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <FormLabel htmlFor="arrival-guidance">
                  {tMatch('fields.arrivalGuidance')}
                </FormLabel>
                <Textarea
                  id="arrival-guidance"
                  value={formData.arrivalGuidance}
                  onChange={(event) =>
                    handleInputChange('arrivalGuidance', event.target.value)
                  }
                  maxLength={MATCH_ARRIVAL_GUIDANCE_MAX_LENGTH}
                  placeholder={tMatch('fields.arrivalGuidancePlaceholder')}
                />
                <p className="text-sm text-muted-foreground">
                  {tMatch('fields.arrivalGuidanceHelp')}
                </p>
              </div>
            </div>

            {/* Team Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">
                {tMatch('modals.scheduleMatch.teams')}
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <FormLabel
                    htmlFor="direction"
                    icon={<Trophy className="h-4 w-4" />}
                    required
                  >
                    {tMatch('modals.scheduleMatch.direction')}
                  </FormLabel>
                  <Select
                    value={formData.direction}
                    onValueChange={(value) =>
                      handleInputChange('direction', value)
                    }
                  >
                    <SelectTrigger id="direction">
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
                <div className="space-y-2">
                  <FormLabel
                    htmlFor="team"
                    icon={<Users className="h-4 w-4" />}
                    required
                  >
                    {tMatch('modals.scheduleMatch.clubTeam')}
                  </FormLabel>
                  <Select
                    value={formData.team}
                    onValueChange={(value) => handleInputChange('team', value)}
                  >
                    <SelectTrigger
                      id="team"
                      aria-invalid={Boolean(errors.team)}
                      aria-describedby={
                        errors.team ? 'match-team-error' : undefined
                      }
                    >
                      <SelectValue
                        placeholder={tMatch(
                          'modals.scheduleMatch.placeholders.selectTeam'
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.shortName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.team && (
                    <p id="match-team-error" className="text-sm text-red-500">
                      {errors.team}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <FormLabel
                    htmlFor="opponent"
                    icon={<Trophy className="h-4 w-4" />}
                  >
                    {tMatch('modals.scheduleMatch.opponent')}
                  </FormLabel>
                  <Input
                    id="opponent"
                    value={formData.opponent}
                    onChange={(e) =>
                      handleInputChange('opponent', e.target.value)
                    }
                    placeholder={tMatch(
                      'modals.scheduleMatch.placeholders.enterOpponent'
                    )}
                    aria-invalid={Boolean(errors.opponent)}
                    aria-describedby={
                      errors.opponent ? 'opponent-error' : undefined
                    }
                  />
                  {errors.opponent && (
                    <p id="opponent-error" className="text-sm text-red-500">
                      {errors.opponent}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </form>
        </CardContent>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 border-t p-4 bg-muted/20">
          <div className="flex flex-col sm:flex-row gap-3">
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
              form="schedule-match-form"
              className="sm:order-2 flex-1"
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
        </div>
      </Card>
    </Modal>
  );
}
