'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@app/components/ui/button';
import GenderIcon from '@app/components/ui/GenderIcon';
import type { Player } from '@app/lib/types';
import {
  User,
  CalendarCheck,
  CalendarX
} from 'lucide-react';

interface PlayerAvailabilityProps {
  players: Player[];
  availabilityMap: Record<string, boolean>;
  currentUserId?: string;
  isUpcoming: boolean;
  isAdmin?: boolean;
  onToggleAvailability?: (playerId: string, isAvailable: boolean) => Promise<void>;
  // onSyncPlayers removed - auto-sync now happens on backend
}

export default function PlayerAvailability({
  players,
  availabilityMap,
  currentUserId,
  isUpcoming,
  onToggleAvailability
  // onSyncPlayers removed - auto-sync on backend
}: PlayerAvailabilityProps) {
  const tMatch = useTranslations('match');
  const [updating, setUpdating] = useState<string | null>(null);
  // syncing state removed - no longer needed

  // Split players by availability
  const availablePlayers = players.filter(p => availabilityMap[p.id] !== false);
  const unavailablePlayers = players.filter(p => availabilityMap[p.id] === false);

  // Calculate gender counts
  const genderCounts = useMemo(() => {
    const counts = {
      available: { male: 0, female: 0, unknown: 0, total: 0 },
      unavailable: { male: 0, female: 0, unknown: 0, total: 0 }
    };

    availablePlayers.forEach(p => {
      counts.available.total++;
      if (p.userGender === 'male') counts.available.male++;
      else if (p.userGender === 'female') counts.available.female++;
      else counts.available.unknown++;
    });

    unavailablePlayers.forEach(p => {
      counts.unavailable.total++;
      if (p.userGender === 'male') counts.unavailable.male++;
      else if (p.userGender === 'female') counts.unavailable.female++;
      else counts.unavailable.unknown++;
    });

    return counts;
  }, [availablePlayers, unavailablePlayers]);

  // Check if current user is in this team
  const currentPlayer = players.find(p => p.userId === currentUserId);

  const canToggle = isUpcoming && !!currentPlayer;

  // Sort players to show current player first
  const sortedAvailablePlayers = useMemo(() => {
    if (!currentPlayer) return availablePlayers;
    return [
      ...availablePlayers.filter(p => p.id === currentPlayer.id),
      ...availablePlayers.filter(p => p.id !== currentPlayer.id)
    ];
  }, [availablePlayers, currentPlayer]);

  const sortedUnavailablePlayers = useMemo(() => {
    if (!currentPlayer) return unavailablePlayers;
    return [
      ...unavailablePlayers.filter(p => p.id === currentPlayer.id),
      ...unavailablePlayers.filter(p => p.id !== currentPlayer.id)
    ];
  }, [unavailablePlayers, currentPlayer]);

  const handleToggleAvailability = async (playerId: string) => {
    if (!onToggleAvailability || !canToggle) return;

    setUpdating(playerId);
    try {
      const newAvailability = !availabilityMap[playerId];
      await onToggleAvailability(playerId, newAvailability);
    } catch (error) {
      console.error('Error toggling availability:', error);
    } finally {
      setUpdating(null);
    }
  };

  // handleSyncPlayers removed - no longer needed (auto-sync on backend)

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{tMatch('modals.matchDetails.playerAvailability')}</h3>
        {/* Sync Roster button removed - auto-sync now happens on backend */}
      </div>

      {/* Available Players */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-green-700">
          <CalendarCheck className="h-4 w-4" />
          <span>{tMatch('modals.matchDetails.available')} ({genderCounts.available.total})</span>
          {genderCounts.available.male > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <GenderIcon gender="male" size="md" />
                <span className='text-muted-foreground'>{genderCounts.available.male}</span>
              </span>
            )}
          {genderCounts.available.female > 0 && (
            <span className="inline-flex items-center gap-0.5 ml-2">
              <GenderIcon gender="female" size="md" />
              <span className='text-muted-foreground'>{genderCounts.available.female}</span>
            </span>
          )}
        </div>

        {/* Horizontal layout for player names */}
        <div className="flex flex-wrap gap-2">
          {sortedAvailablePlayers.map(player => {
            const isCurrentPlayer = player.id === currentPlayer?.id;
            return (
              <div
                key={player.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-sm"
              >
                <GenderIcon gender={player.userGender} size="md" />
                <span className={isCurrentPlayer ? 'font-semibold' : ''}>{player.userName}</span>
                {canToggle && isCurrentPlayer && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleAvailability(player.id)}
                    disabled={updating === player.id}
                    className="h-5 text-xs px-1 ml-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {updating === player.id ? '...' : <CalendarX className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Unavailable Players */}
      {unavailablePlayers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-red-700">
            <CalendarX className="h-4 w-4" />
            <span>{tMatch('modals.matchDetails.unavailable')} ({genderCounts.unavailable.total})</span>
            <span className="text-xs text-muted-foreground">
              {genderCounts.unavailable.male > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <GenderIcon gender="male" size="md" />
                  <span className='text-muted-foreground'>{genderCounts.unavailable.male}</span>
                </span>
              )}
              {genderCounts.unavailable.female > 0 && (
                <span className="inline-flex items-center gap-0.5 ml-2">
                  <GenderIcon gender="female" size="md" />
                  <span className='text-muted-foreground'>{genderCounts.unavailable.female}</span>
                </span>
              )}
            </span>
          </div>

          {/* Horizontal layout for player names */}
          <div className="flex flex-wrap gap-2">
            {sortedUnavailablePlayers.map(player => {
              const isCurrentPlayer = player.id === currentPlayer?.id;
              return (
                <div
                  key={player.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-sm"
                >
                  <GenderIcon gender={player.userGender} size="md" />
                  <span className={isCurrentPlayer ? 'font-semibold' : ''}>{player.userName}</span>
                  {canToggle && isCurrentPlayer && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleAvailability(player.id)}
                      disabled={updating === player.id}
                      className="h-5 text-xs px-1 ml-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      {updating === player.id ? '...' : <CalendarX className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {players.length === 0 && (
        <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg">
          <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No team players found</p>
        </div>
      )}
    </div>
  );
}
