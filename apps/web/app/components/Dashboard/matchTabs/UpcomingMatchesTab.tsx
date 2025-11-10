'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@app/hooks/useAuth';
import { MatchService } from '@app/services/matchService';
import { TeamService } from '@app/services/teamService';
import { PlayerService } from '@app/services/playerService';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/card';
import { Checkbox } from '@app/components/ui/checkbox';
import { Label } from '@app/components/ui/label';
import { Pagination } from '@app/components/ui/Pagination';
import { SkeletonMatchCards } from '@app/components/ui/SkeletonMatchCard';
import { Match } from '@app/lib/types';
import UnifiedMatchCard from '../MatchCard';
import MatchDetailsModal from '../modals/MatchDetailsModal';

/**
 * UpcomingMatchesTab Component - Self-contained tab with data fetching
 *
 * Responsibilities:
 * - Fetch upcoming matches (scheduled, future dates - timezone-safe filtering in service layer)
 * - Filter matches by team (dynamic, uses team IDs not hardcoded names)
 * - Handle player availability toggles
 * - Manage match details modal
 * - Paginate match results
 *
 * Improvements:
 * - ✅ Dynamic team filtering (no hardcoded "Team 1", "Team 2")
 * - ✅ Timezone-safe date comparison (ISO string comparison in service layer)
 * - ✅ Frontend pagination with configurable page size
 * - ✅ Skeleton loading states for better UX
 */
export default function UpcomingMatchesTab() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const { user } = useAuth();

  // Local state for UI
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);  // Changed: Dynamic team filtering
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Derived state
  const showAllMatches = selectedTeamIds.length === 0;

  // Fetch data using service hooks - useUpcomingMatches now handles date filtering
  const { data: upcomingMatches = [], isLoading } = MatchService.useUpcomingMatches();
  const { data: teams = [] } = TeamService.useTeamList();
  const { data: players = [] } = PlayerService.usePlayerList();
  const toggleAvailabilityMutation = MatchService.useTogglePlayerAvailability();
  // syncPlayersMutation removed - auto-sync on backend

  // Removed: No longer need useEffect to sync selectedMatch!

  const handleViewDetails = (match: Match) => {
    setSelectedMatchId(match.id);  // Changed: Store ID only
    setShowMatchDetails(true);
  };

  const handlePlayerAvailability = async (matchId: string, isAvailable: boolean) => {
    try {
      if (!user?.id) return;
      await toggleAvailabilityMutation.mutateAsync({
        matchId,
        playerId: user.id,
        isAvailable,
      });
    } catch (error) {
      console.error('Failed to toggle availability:', error);
    }
  };

  const handleToggleAvailability = async (matchId: string, playerId: string, isAvailable: boolean) => {
    try {
      await toggleAvailabilityMutation.mutateAsync({
        matchId,
        playerId,
        isAvailable,
      });
    } catch (error) {
      console.error('Failed to toggle availability:', error);
    }
  };

  // handleSyncPlayers removed - auto-sync on backend

  // Filter matches based on team selection (date filtering now done in useUpcomingMatches hook)
  const filteredMatches = upcomingMatches.filter(match => {
    if (showAllMatches) return true;
    return selectedTeamIds.includes(match.homeTeamId);
  });

  // Pagination logic
  const totalMatches = filteredMatches.length;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedMatches = filteredMatches.slice(startIndex, endIndex);

  // Group paginated matches by team for "All Matches" view
  const matchesByTeam = teams.reduce((acc, team) => {
    acc[team.id] = paginatedMatches.filter(m => m.homeTeamId === team.id);
    return acc;
  }, {} as Record<string, Match[]>);

  // Handle team selection
  const handleTeamToggle = (teamId: string, checked: boolean) => {
    setSelectedTeamIds(prev =>
      checked
        ? [...prev, teamId]
        : prev.filter(id => id !== teamId)
    );
    setCurrentPage(1); // Reset to first page when filter changes
  };

  // Handle pagination changes
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when page size changes
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Matches</CardTitle>
          </CardHeader>
        </Card>
        <SkeletonMatchCards count={3} />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Matches</CardTitle>

            {/* Filter Checkboxes */}
            <div className="flex flex-wrap gap-4 mt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="all-matches"
                  checked={showAllMatches}
                  onChange={() => setSelectedTeamIds([])}
                />
                <Label htmlFor="all-matches" className="text-sm font-medium">
                  All Matches
                </Label>
              </div>

              {/* Dynamic team checkboxes */}
              {teams.map(team => (
                <div key={team.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`team-${team.id}`}
                    checked={selectedTeamIds.includes(team.id)}
                    onChange={(e) => handleTeamToggle(team.id, e.target.checked)}
                  />
                  <Label htmlFor={`team-${team.id}`} className="text-sm font-medium">
                    {team.name}
                  </Label>
                </div>
              ))}
            </div>
          </CardHeader>
        </Card>

        {/* Matches Layout */}
        {showAllMatches ? (
          // Desktop: Two columns, Mobile: Stacked
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {teams.map(team => (
                <div key={team.id} className="space-y-4">
                  <h4 className="text-lg font-semibold">{team.name} Matches</h4>
                  {matchesByTeam[team.id]?.map((match) => (
                    <UnifiedMatchCard
                      key={match.id}
                      match={match}
                      variant="upcoming"
                      user={user}
                      onViewDetails={handleViewDetails}
                      onPlayerAvailability={handlePlayerAvailability}
                    />
                  ))}
                  {(matchesByTeam[team.id]?.length === 0 || !matchesByTeam[team.id]) && (
                    <div className="text-center py-4 text-gray-500">
                      No {team.name} matches on this page.
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalItems={totalMatches}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        ) : (
          // Filtered view - single column
          <div className="space-y-4">
            {paginatedMatches.map((match) => (
              <UnifiedMatchCard
                key={match.id}
                match={match}
                variant="upcoming"
                user={user}
                onViewDetails={handleViewDetails}
                onPlayerAvailability={handlePlayerAvailability}
              />
            ))}
            {paginatedMatches.length === 0 && filteredMatches.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No matches found for the selected filter.
              </div>
            )}
            {paginatedMatches.length === 0 && filteredMatches.length > 0 && (
              <div className="text-center py-8 text-gray-500">
                No matches on this page. Try going to page 1.
              </div>
            )}

            {/* Pagination */}
            {filteredMatches.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={totalMatches}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            )}
          </div>
        )}
      </div>

      {/* Match Details Modal */}
      <MatchDetailsModal
        matchId={selectedMatchId}
        isOpen={showMatchDetails}
        onClose={() => {
          setShowMatchDetails(false);
          setSelectedMatchId(null);
        }}
        players={players}
        teams={teams}
        currentUserId={user?.id}
        isAdmin={user?.role === 'admin'}
        onToggleAvailability={handleToggleAvailability}
      />
      {/* onSyncPlayers prop removed - auto-sync now happens on backend */}
    </>
  );
}