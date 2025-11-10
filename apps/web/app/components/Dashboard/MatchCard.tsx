/**
 * Unified Match Card Component
 *
 * **Design Rationale:**
 * - Single source of truth for match display across all tabs
 * - Configurable action buttons based on context (upcoming, history, management)
 * - Consistent UI/UX with responsive design
 * - Type-safe props with clear separation of concerns
 * - Performance optimized with minimal re-renders
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Badge } from '@app/components/ui/badge';
import type { Match } from '@app/lib/types';
import {
  formatMatchDate,
  getResultBadgeConfig
} from '@app/lib/match-utils';
import {
  Calendar,
  MapPin,
  Clock,
  Eye,
  Users,
  Edit2,
  Trash2,
  CheckCircle
} from 'lucide-react';

// **Design Decision:** Enum for card variants ensures type safety and clear API
export type MatchCardVariant = 'upcoming' | 'history' | 'management';

interface MatchCardProps {
  match: Match;
  variant: MatchCardVariant;
  user?: { role: string; playerId?: string } | null;

  // Action handlers - only relevant ones will be used based on variant
  onViewDetails?: (match: Match) => void;
  onPlayerAvailability?: (matchId: string, isAvailable: boolean) => void;
  onViewLineup?: (match: Match) => void;
  onViewStats?: (match: Match) => void;
  onEditMatch?: (match: Match) => void;
  onDeleteMatch?: (matchId: string) => void;
}

/**
 * Unified Match Card Component
 *
 * **Key Features:**
 * - Consistent layout across all match contexts
 * - Responsive design with mobile-optimized actions
 * - Score display for completed matches
 * - Context-aware action buttons
 * - Comprehensive error handling for dates
 */
export default function MatchCard({
  match,
  variant,
  user,
  onViewDetails,
  onPlayerAvailability,
  onViewLineup,
  onEditMatch,
  onDeleteMatch
}: MatchCardProps) {
  const tMatch = useTranslations('match');

  // Get result badge configuration
  const resultBadge = getResultBadgeConfig(match.result);

  /**
   * **Design Decision:** Context-aware action rendering
   * Each variant shows only relevant actions to avoid UI clutter
   */
  const renderActions = () => {
    switch (variant) {
      case 'upcoming':
        return (
          <div className="flex flex-col gap-2 pt-2">
            {onViewDetails && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(match)}
                className="w-full"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
            )}
            {/* Player availability toggle for members/players */}
            {(user?.role === 'player' || user?.role === 'member') && onPlayerAvailability && user?.playerId && (
              <Button
                size="sm"
                onClick={() => {
                  const isCurrentlyAvailable = !match.unavailablePlayers.includes(user.playerId!);
                  onPlayerAvailability(match.id, !isCurrentlyAvailable);
                }}
                className={`w-full ${
                  !match.unavailablePlayers.includes(user.playerId!)
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {!match.unavailablePlayers.includes(user.playerId!) ? 'Available' : 'Mark Available'}
              </Button>
            )}
          </div>
        );

      case 'history':
        return (
          <div className="flex flex-col gap-2 pt-2">
            {onViewDetails && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(match)}
                className="w-full"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
            )}
          </div>
        );

      case 'management':
        return (
          <div className="flex flex-row md:flex-col gap-2 flex-shrink-0">
            {onViewLineup && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewLineup(match)}
                className="h-9 px-3 text-xs justify-start hover:bg-blue-50 hover:text-blue-600"
                title="Aufstellung anzeigen/bearbeiten"
              >
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{tMatch('matchCard.editLineup')}</span>
              </Button>
            )}
            {onEditMatch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditMatch(match)}
                className="h-9 px-3 text-xs justify-start hover:bg-gray-50"
                title="Spiel bearbeiten"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{tMatch('matchCard.updateMatch')}</span>
              </Button>
            )}
            {onDeleteMatch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteMatch(match.id)}
                className="h-9 px-3 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 justify-start"
                title="Spiel löschen"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{tMatch('matchCard.delete')}</span>
              </Button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  /**
   * **Design Decision:** Responsive layout adaptation
   * Management cards use horizontal layout for actions, others use vertical
   */
  const isManagementCard = variant === 'management';

  return (
    <Card className={`hover:shadow-md transition-shadow ${isManagementCard ? 'overflow-hidden' : ''}`}>
      <CardContent className="p-4">
        <div className={`${isManagementCard ? 'flex gap-4 flex-col md:flex-row' : 'space-y-3'}`}>
          {/* Main Content */}
          <div className={`${isManagementCard ? 'flex-1 min-w-0' : ''}`}>
            {/* Match Title with Result Badge */}
            <div className={`flex items-center ${variant === 'history' ? 'gap-4' : 'mb-3'}`}>
              <h4 className="font-semibold text-lg">
                {match.homeTeamName} <span className="font-bold text-muted-foreground bg-muted rounded-full px-2 py-1">vs</span> {match.awayTeamName}
              </h4>
              {variant === 'history' && match.result && (
                <Badge className={`${resultBadge.className} px-2 py-1 rounded-full text-xs font-medium`}>
                  {resultBadge.label}
                </Badge>
              )}
            </div>

            {/* Date and Time with Status Indicators */}
            <div className={`${isManagementCard ? 'mb-3' : ''}`}>
                {/* Date & Time for upcoming/history */}
                <div className={`inline-flex items-center gap-2 py-2 rounded-lg ${
                  match.status === 'completed'
                    ? 'text-green-800'
                    : match.isToday
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : match.isTomorrow
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-muted/50 text-foreground'
                }`}>
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">
                    {formatMatchDate(match.date, {
                          includeWeekday: true,
                          includeTime: true,
                          time: match.time
                        })
                    }
                  </span>
                  {match.status === 'completed' && (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                </div>

                {/* Days remaining for upcoming matches */}
                {variant === 'upcoming' && (
                  <div className="flex items-center gap-2 text-sm text-gray-700 mb-3">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span>{match.daysRemaining}</span>
                  </div>
                )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span>
                {match.location}
              </span>
            </div>

            {/* Score Display for Management/History */}
            {(isManagementCard || variant === 'history') && (
              <>
                {/* Final Score Display */}
                {match.scores && match.scoreDisplay && (
                  <div className={`${variant === 'history' ? 'text-lg font-semibold text-blue-600' : 'text-center'}`}>
                    <div className={`${isManagementCard ? 'inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-lg' : ''}`}>
                      {variant === 'history' ? `Final Score: ${match.scoreDisplay}` : (
                        <>
                          <span className="text-lg font-bold">{match.scores?.homeScore ?? 0}</span>
                          <span className="text-sm font-medium">-</span>
                          <span className="text-lg font-bold">{match.scores?.awayScore ?? 0}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Actions Column */}
          {renderActions()}
        </div>
      </CardContent>
    </Card>
  );
}