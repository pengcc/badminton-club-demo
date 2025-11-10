'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Badge } from '@app/components/ui/badge';
import GenderIcon from '@app/components/ui/GenderIcon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@app/components/ui/select';
import type { Match, Player, Team} from '@app/lib/types';
import { LINEUP_POSITION_CONFIG, LineupPosition } from '@app/lib/types';
import { MatchService } from '@app/services/matchService';
import { useModalBehavior } from '@/app/hooks/useModalBehavior';
import {
  Users,
  User,
  AlertTriangle,
  Save,
  X
} from 'lucide-react';
import type { BaseLineupPlayer } from '@club/shared-types/core/base';
import { Gender } from '@club/shared-types/core/enums';

interface MatchLineupModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  teams: Team[];
  players: Player[];
  onLineupSaved: (match: Match) => void;
}

export default function MatchLineupModal({
  isOpen,
  onClose,
  match,
  teams,
  players,
}: MatchLineupModalProps) {
  const tMatch = useTranslations('match');
  const updateLineupMutation = MatchService.useUpdateLineup();

  // Helper to get team name from ID
  const getTeamName = (teamId: string): string => {
    const team = teams.find(t => t.id === teamId);
    return team?.name || tMatch('modals.matchLineup.unknownTeam');
  };

  // Initialize lineup state from match data
  // Structure: { [LineupPosition]: [playerId1, playerId2?, ...] }
  const [lineup, setLineup] = useState<Record<LineupPosition, string[]>>({} as Record<LineupPosition, string[]>);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Reset lineup when modal opens or match changes
  useEffect(() => {
    if (isOpen && match) {
      // Convert BaseLineupPlayer[] to string[] of player IDs
      const lineupIds: Record<LineupPosition, string[]> = {} as Record<LineupPosition, string[]>;
      Object.entries(match.lineup || {}).forEach(([position, playerList]) => {
        lineupIds[position as LineupPosition] = playerList.map(p => p.id);
      });
      setLineup(lineupIds);
    }
  }, [isOpen, match]);

  // Watch lineup for changes vs original match lineup

  useEffect(() => {
    if (!match) {
      setHasUnsavedChanges(false);
      return;
    }

    // Build original lineup as Record<LineupPosition, string[]>
    const originalLineup = Object.entries(match.lineup || {}).reduce<Record<LineupPosition, string[]>>(
      (acc, [pos, players]) => {
        acc[pos as LineupPosition] = players.map(p => p.id);
        return acc;
      },
      {} as Record<LineupPosition, string[]>
    );

    // Iterate typed keys from LINEUP_POSITION_CONFIG (guaranteed to be LineupPosition keys)
    const positions = Object.keys(LINEUP_POSITION_CONFIG) as LineupPosition[];

    const hasChanges = positions.some((pos) => {
      const original = originalLineup[pos] || [];
      const current = lineup[pos] || [];
      // shallow compare arrays — order matters (your UI preserves player slot order)
      if (original.length !== current.length) return true;
      for (let i = 0; i < original.length; i++) {
        if (original[i] !== current[i]) return true;
      }
      return false;
    });

    setHasUnsavedChanges(hasChanges);
  }, [lineup, match]);

  // ESC key handler and body scroll lock
  const { handleCloseAttempt, modalProps } = useModalBehavior({
    isOpen,
    onClose,
    hasUnsavedChanges,
    enableBackdropClose: false,
  });

  // Get available players for a position
  const getAvailablePlayersForPosition = (position: LineupPosition): Player[] => {
    // Early return if no match
    if (!match) return [];

    const config = LINEUP_POSITION_CONFIG[position];

    // Get all player IDs already assigned to any position
    const usedPlayerIds = new Set(
      Object.values(lineup).flatMap(playerIds => playerIds)
    );

    // Count positions per player
    const playerPositionCount = new Map<string, number>();
    Object.values(lineup).forEach(playerIds => {
      playerIds.forEach(playerId => {
        if (playerId) {
          playerPositionCount.set(playerId, (playerPositionCount.get(playerId) || 0) + 1);
        }
      });
    });

    return players.filter(player => {
      // Filter 1: Team affiliation - player must be in the home team
      if (!player.teamIds || !player.teamIds.includes(match.homeTeamId)) {
        return false;
      }

      // Filter 2: Gender requirements (if player has gender info)
      if (player.userGender) {
        const allowedGenders = Array.isArray(config.allowedGenders)
          ? config.allowedGenders
          : [config.allowedGenders];

        if (!allowedGenders.includes(player.userGender as Gender)) {
          return false;
        }
      }

      // Filter 3: Max 2 positions per player
      const currentPositionCount = playerPositionCount.get(player.id) || 0;
      if (currentPositionCount >= 2) {
        return false;
      }

      // Filter 4: Don't show already assigned players in this position
      if (usedPlayerIds.has(player.id)) {
        return false;
      }

      return true;
    });
  };

  // Validate lineup: Max 2 positions per player
  const validateLineup = useCallback((): { isValid: boolean; warnings: string[] } => {
    const warnings: string[] = [];

    // Count how many positions each player is in
    const playerPositionCount = new Map<string, number>();
    Object.entries(lineup).forEach(([_position, playerIds]) => {
      playerIds.forEach(playerId => {
        if (playerId) { // Skip empty slots
          playerPositionCount.set(playerId, (playerPositionCount.get(playerId) || 0) + 1);
        }
      });
    });

    // Check for players in more than 2 positions
    playerPositionCount.forEach((count, playerId) => {
      if (count > 2) {
        const player = players.find(p => p.id === playerId);
        warnings.push(`${tMatch('modals.matchLineup.warnings.player')} ${player?.userName || ''} ${tMatch('modals.matchLineup.warnings.tooManyPositions', { count })}`);
      }
    });

    return {
      isValid: warnings.length === 0,
      warnings
    };
  }, [lineup, players, tMatch]);

  const validation = useMemo(() => validateLineup(), [validateLineup]);

  const colorGroups = {
    'bg-blue-100 text-blue-800': [1, 2, 3],
    'bg-pink-100 text-pink-800': [4, 7],
    'bg-yellow-100 text-yellow-800': [5, 6],
    'bg-purple-100 text-purple-800': [8],
  };

  const getRankBadgeColor = (ranking: number) =>
    Object.entries(colorGroups).find(([_, ranks]) => ranks.includes(ranking))?.[0] ||
    'bg-gray-100 text-gray-800';

  // Handle player assignment to position
  const handlePlayerAssignment = (position: LineupPosition, playerIndex: number, playerId: string) => {
    setLineup(prev => {
      const newLineup = { ...prev };
      const positionPlayers = [...(newLineup[position] || [])];

      // Ensure array is large enough
      const maxPlayers = LINEUP_POSITION_CONFIG[position].maxPlayers;
      while (positionPlayers.length < maxPlayers) {
        positionPlayers.push('');
      }

      positionPlayers[playerIndex] = playerId;
      newLineup[position] = positionPlayers;

      return newLineup;
    });
  };

  // Handle player removal from position
  const handlePlayerRemoval = (position: LineupPosition, playerIndex: number) => {
    handlePlayerAssignment(position, playerIndex, '');
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validation.isValid) {
      const warningsList = validation.warnings.map(w => `• ${w}`).join('\n');
      const confirmSave = window.confirm(
        `There are lineup validation warnings:\n${warningsList}\n\nDo you want to continue anyway?`
      );
      if (!confirmSave) return;
    }

    setIsSubmitting(true);

    try {
      // Convert lineup to API format: Record<LineupPosition, string[]> → Record<LineupPosition, BaseLineupPlayer[]>
      // Backend expects player IDs only - it will populate full player details
      const lineupRecord: Record<LineupPosition, BaseLineupPlayer[]> = {} as any;

      Object.entries(lineup).forEach(([position, playerIds]) => {
        const filteredPlayerIds = playerIds.filter(id => id !== '');
        if (filteredPlayerIds.length > 0) {
          // Send minimal player data - backend will populate firstName, lastName, gender
          lineupRecord[position as LineupPosition] = filteredPlayerIds.map(playerId => ({
            id: playerId,
            firstName: '', // Backend will populate
            lastName: '',  // Backend will populate
            gender: Gender.MALE // Backend will correct
          }));
        }
      });

      // Save to database using mutation with cache invalidation
      await updateLineupMutation.mutateAsync({
        matchId: match!.id,
        lineup: lineupRecord
      });

      alert(tMatch('modals.matchLineup.success'));

      onClose();
    } catch (error: any) {
      console.group('❌ Error saving lineup');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Match ID:', match!.id);
      console.error('Lineup data:', lineup);
      console.groupEnd();

      const errorMessage = error.response?.data?.errors
        ? error.response.data.errors.join('\n')
        : error.response?.data?.message || error.message || tMatch('modals.matchLineup.unknownError');
      alert(`${tMatch('modals.matchLineup.error')}:\n${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !match) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-hidden"
      {...modalProps}
    >
      <Card className="w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b flex-shrink-0">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Users className="h-5 w-5" />
            <span className="truncate">
              {tMatch('modals.matchLineup.title')} - {getTeamName(match.homeTeamId)} {tMatch('modals.matchLineup.versus')} {match.awayTeamName || tMatch('modals.matchLineup.tbd')}
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCloseAttempt}
            className="h-8 w-8 p-0 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto">
          <form id="lineup-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Match Info */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">{tMatch('modals.matchLineup.matchDetails')}</h4>
              <p className="text-sm text-muted-foreground">
                {new Date(match.date).toLocaleDateString()} at {match.time}
                {match.location || tMatch('modals.matchLineup.tbd') }
              </p>
            </div>

            {/* Validation Warnings */}
            {!validation.isValid && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-orange-800">{tMatch('modals.matchLineup.lineupValidationWarnings')}</h4>
                      <ul className="mt-2 space-y-1 text-sm text-orange-700">
                        {validation.warnings.map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lineup Positions */}
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(LINEUP_POSITION_CONFIG).map(([position, config]) => {
                const lineupPosition = position as LineupPosition;
                const availablePlayers = getAvailablePlayersForPosition(lineupPosition);
                const currentPlayerIds = lineup[lineupPosition] || [];

                return (
                  <Card key={position}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            getRankBadgeColor(config.ranking)
                        }`}>
                            {config.ranking}
                          </div>
                          {tMatch(`modals.matchLineup.lineupPositions.${lineupPosition}`)}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className={config.maxPlayers === 2 ? "flex gap-3" : "space-y-3"}>
                      {Array.from({ length: config.maxPlayers }, (_, index) => {
                        const assignedPlayerId = currentPlayerIds[index] || '';
                        const assignedPlayer = assignedPlayerId ? players.find(p => p.id === assignedPlayerId) : null;

                        return (
                          <div key={index} className={config.maxPlayers === 2 ? "flex-1 space-y-2" : "space-y-2"}>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              {tMatch('modals.matchLineup.warnings.player')} {index + 1}
                              {position === LineupPosition.MIXED_DOUBLES && (
                                <Badge variant="outline" className="text-xs px-1 py-0">
                                  {index === 0 ? tMatch('modals.matchLineup.genderRequirements.maleFemale') : tMatch('modals.matchLineup.genderRequirements.femaleMale')}
                                </Badge>
                              )}
                            </div>
                            {assignedPlayer ? (
                              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-medium">
                                    {assignedPlayer.userName}
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {assignedPlayer.rankingDisplay || `${assignedPlayer.singlesRanking || 0}/${assignedPlayer.doublesRanking || 0}`}
                                  </Badge>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePlayerRemoval(lineupPosition, index)}
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Select
                                value=""
                                onValueChange={(playerId) => handlePlayerAssignment(lineupPosition, index, playerId)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder={tMatch('modals.matchLineup.selectPlayer')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {availablePlayers.map((player) => (
                                    <SelectItem key={player.id} value={player.id}>
                                      <div className="flex items-center gap-2">
                                        <GenderIcon gender={player.userGender} size="md" />
                                        <span>{player.userName}</span>
                                        <Badge variant="outline" className="text-xs">
                                        {player.rankingDisplay || `${player.singlesRanking || 0}/${player.doublesRanking || 0}`}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  ))}
                                  {availablePlayers.length === 0 && (
                                    <SelectItem value="" disabled>
                                      {tMatch('modals.matchLineup.noPlayersAvailable')}
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Form Actions - Removed from here, moved to fixed footer */}
          </form>
        </CardContent>

        {/* Fixed Footer - Always visible */}
        <div className="flex flex-col sm:flex-row gap-3 p-6 border-t bg-background flex-shrink-0">
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
            form="lineup-form"
            className="sm:order-2 flex-1 hover:bg-primary hover:text-primary-foreground"
            disabled={isSubmitting || validation.warnings.length > 0}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {tMatch('common.loading')}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {tMatch('actions.saveLineup')}
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}