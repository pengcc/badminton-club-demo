'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Badge } from '@app/components/ui/badge';
import type { Player, Team } from '@app/lib/types';
import { useModalBehavior } from '@app/hooks/useModalBehavior';
import PlayerAvailability from '@app/components/Dashboard/PlayerAvailability';
import { MatchService } from '@app/services/matchService';
import {
  X,
  Calendar,
  MapPin,
  Clock,
  Users,
  XCircle
} from 'lucide-react';

interface MatchDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string | null;  // Changed: Pass ID instead of full match object
  players: Player[];
  teams: Team[];
  currentUserId?: string;
  isAdmin?: boolean;
  onToggleAvailability?: (matchId: string, playerId: string, isAvailable: boolean) => Promise<void>;
  // onSyncPlayers removed - auto-sync now happens on backend
}

export default function MatchDetailsModal({
  isOpen,
  onClose,
  matchId,  // Changed: Receive ID instead of match
  players,
  teams,
  currentUserId,
  isAdmin,
  onToggleAvailability
  // onSyncPlayers removed
}: MatchDetailsModalProps) {
  const tMatch = useTranslations('match');

  // Fetch match data directly - automatically updates when cache changes!
  const { data: match } = MatchService.useMatchDetails(matchId || '');

  // ESC key handler and body scroll lock
  useModalBehavior({ isOpen, onClose });

  // Helper to get team name from ID
  const getTeamName = (teamId: string): string => {
    const team = teams.find(t => t.id === teamId);
    return team?.name || tMatch('modals.matchLineup.unknownTeam');
  };

  // Get players from the match's team (home team)
  const teamPlayers = useMemo(() => {
    if (!match) return [];
    return players.filter(player =>
      player.teamIds?.includes(match.homeTeamId)
    );
  }, [players, match]);

  // Get availability map from match data
  const availabilityMap = useMemo(() => {
    const map: Record<string, boolean> = {};

    if (!match) return map;

    // Initialize all team players as available by default
    teamPlayers.forEach(player => {
      map[player.id] = !match.unavailablePlayers.includes(player.id);
    });

    return map;
  }, [match, teamPlayers]);

  // Early return AFTER all hooks
  if (!isOpen || !match) return null;

  const isUpcoming = match.status === 'scheduled' && new Date(match.date) > new Date();

  const formatDate = (date: Date | string) => {
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'Invalid Date';
      return new Intl.DateTimeFormat('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(d);
    } catch {
      return 'Invalid Date';
    }
  };

  // Calculate result from scores
  const getResult = (): 'win' | 'loss' | 'draw' | undefined => {
    const homeScore = match.scores?.homeScore;
    const awayScore = match.scores?.awayScore;
    if (homeScore === undefined || awayScore === undefined) return undefined;
    if (homeScore > awayScore) return 'win';
    if (homeScore < awayScore) return 'loss';
    return 'draw';
  };

  const result = getResult();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        // Close modal when clicking backdrop (not the modal content)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh]"
        onClick={(e) => e.stopPropagation()} // Prevent click inside modal from closing it
      >
        <CardHeader className="border-b sticky top-0 bg-background z-10 py-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-2">
                {getTeamName(match.homeTeamId)} {tMatch('modals.matchLineup.versus')} {match.awayTeamName || tMatch('modals.matchLineup.tbd')}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={match.status === 'scheduled' ? 'default' : 'secondary'}>
                  {match.status === 'scheduled' ? tMatch('status.scheduled') : tMatch('status.completed')}
                </Badge>
                {match.status === 'completed' && result && (
                  <Badge variant={
                    result === 'win' ? 'default' :
                    result === 'loss' ? 'destructive' :
                    'secondary'
                  }>
                    {result === 'win' ? 'Victory' :
                     result === 'loss' ? 'Defeat' : 'Draw'}
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Match Information */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">{tMatch('modals.matchDetails.matchInfo')}</h3>

            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{formatDate(match.date)}</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{match.time} Uhr</span>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="flex-1">{match.location || tMatch('modals.matchLineup.tbd')}</span>
            </div>

            {match.status === 'completed' && (
              <div className="pt-2 border-t">
                <div className="text-lg font-bold text-primary">
                  Final Score: {match.scores?.homeScore ?? 0} - {match.scores?.awayScore ?? 0}
                </div>
              </div>
            )}

            {match.status === 'cancelled' && match.cancellationReason && (
              <div className="pt-2 border-t">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <h4 className="font-semibold text-destructive mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    {tMatch('modals.matchDetails.cancellationInfo')}
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {match.cancellationReason}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Lineup Section */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              {tMatch('modals.matchDetails.lineup')}
            </h3>

            {Object.keys(match.lineup).length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(match.lineup).map(([position, playerList]) => (
                  <Card key={position} className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">
                            {tMatch(`modals.matchLineup.lineupPositions.${position}`)}
                          </div>
                          <div className="font-medium">
                            {playerList.length > 0 ? playerList.map(p => `${p.firstName} ${p.lastName}`).join(', ') : tMatch('modals.matchLineup.tbd')}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{tMatch('modals.matchDetails.noLineup')}</p>
              </div>
            )}
          </div>

          {/* Player Availability Section */}
          <PlayerAvailability
            players={teamPlayers}
            availabilityMap={availabilityMap}
            currentUserId={currentUserId}
            isUpcoming={isUpcoming}
            isAdmin={isAdmin}
            onToggleAvailability={onToggleAvailability ? async (playerId, isAvailable) => {
              await onToggleAvailability(match.id, playerId, isAvailable);
            } : undefined}
          />
          {/* onSyncPlayers prop removed - auto-sync now happens on backend */}
        </CardContent>
      </div>
    </div>
  );
}
