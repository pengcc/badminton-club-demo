'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@app/hooks/useAuth';
import { MatchService } from '@app/services/matchService';
import { isAdmin } from '@app/lib/access/permissions';
import { TeamService } from '@app/services/teamService';
import { PlayerService } from '@app/services/playerService';
import { Card, CardHeader, CardTitle } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Checkbox } from '@app/components/ui/checkbox';
import { Label } from '@app/components/ui/label';
import { Pagination } from '@app/components/ui/Pagination';
import { SkeletonMatchCards } from '@app/components/ui/SkeletonMatchCard';
import type { Match } from '@app/lib/types';
import UnifiedMatchCard from '../MatchCard';
import MatchDetailsModal from '../modals/MatchDetailsModal';

/**
 * UpcomingMatchesTab Component - Self-contained tab with data fetching
 *
 * Responsibilities:
 * - Fetch upcoming matches (scheduled, future dates - timezone-safe filtering in service layer)
 * - Filter matches by team (dynamic, uses team IDs not hardcoded names)
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
  const { user } = useAuth();
  const tMatch = useTranslations('match');

  // Local state for UI
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]); // Changed: Dynamic team filtering
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Derived state
  const showAllMatches = selectedTeamIds.length === 0;

  // Fetch data using service hooks - useUpcomingMatches now handles date filtering
  const {
    data: upcomingMatches = [],
    isLoading,
    isError,
    refetch,
  } = MatchService.useUpcomingMatches();
  const teamQuery = TeamService.useTeamList();
  const playerQuery = PlayerService.usePlayerList();
  const teams = teamQuery.data ?? [];
  const players = playerQuery.data ?? [];
  const teamBlockingError = teamQuery.isError && !teamQuery.data;
  const playerBlockingError = playerQuery.isError && !playerQuery.data;
  const teamFactsUnavailable =
    teamBlockingError || (teamQuery.isLoading && !teamQuery.data);
  const playerFactsUnavailable =
    playerBlockingError || (playerQuery.isLoading && !playerQuery.data);
  // Current roster and Match access derive from Player.teamIds; retained Match
  // Availability and Lineup references are not removed with a Team association.

  // Removed: No longer need useEffect to sync selectedMatch!

  const handleViewDetails = (match: Match) => {
    setSelectedMatchId(match.id); // Changed: Store ID only
    setShowMatchDetails(true);
  };

  // Filter matches based on team selection (date filtering now done in useUpcomingMatches hook)
  const filteredMatches = upcomingMatches.filter((match) => {
    if (showAllMatches) return true;
    return selectedTeamIds.includes(match.teamId);
  });

  // Pagination logic
  const totalMatches = filteredMatches.length;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedMatches = filteredMatches.slice(startIndex, endIndex);

  // Group paginated matches by team for "All Matches" view
  const matchesByTeam = teams.reduce(
    (acc, team) => {
      acc[team.id] = paginatedMatches.filter((m) => m.teamId === team.id);
      return acc;
    },
    {} as Record<string, Match[]>
  );

  // Handle team selection
  const handleTeamToggle = (teamId: string, checked: boolean) => {
    setSelectedTeamIds((prev) =>
      checked ? [...prev, teamId] : prev.filter((id) => id !== teamId)
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
            <CardTitle>{tMatch('views.upcomingTitle')}</CardTitle>
          </CardHeader>
        </Card>
        <SkeletonMatchCards count={3} />
      </div>
    );
  }

  if (isError && upcomingMatches.length === 0) {
    return (
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>{tMatch('common.error')}</CardTitle>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refetch()}
          >
            {tMatch('common.retry')}
          </Button>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      {isError && upcomingMatches.length > 0 && (
        <div
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {tMatch('common.backgroundError')}
        </div>
      )}
      {teamQuery.isLoading && !teamQuery.data && (
        <div
          role="status"
          className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground"
        >
          {tMatch('common.teamLoading')}
        </div>
      )}
      {playerQuery.isLoading && !playerQuery.data && (
        <div
          role="status"
          className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground"
        >
          {tMatch('common.playerLoading')}
        </div>
      )}
      {teamQuery.isError && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <span>
            {teamQuery.data
              ? tMatch('common.teamRefreshError')
              : tMatch('common.teamLoadError')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void teamQuery.refetch()}
          >
            {tMatch('common.retry')}
          </Button>
        </div>
      )}
      {playerQuery.isError && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <span>
            {playerQuery.data
              ? tMatch('common.playerRefreshError')
              : tMatch('common.playerLoadError')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void playerQuery.refetch()}
          >
            {tMatch('common.retry')}
          </Button>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{tMatch('views.upcomingTitle')}</CardTitle>

          {/* Filter Checkboxes */}
          {!teamFactsUnavailable && (
            <div className="flex flex-wrap gap-4 mt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="all-matches"
                  checked={showAllMatches}
                  onCheckedChange={() => setSelectedTeamIds([])}
                />
                <Label htmlFor="all-matches" className="text-sm font-medium">
                  {tMatch('views.allMatches')}
                </Label>
              </div>

              {/* Dynamic team checkboxes */}
              {teams.map((team) => (
                <div key={team.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`team-${team.id}`}
                    checked={selectedTeamIds.includes(team.id)}
                    onCheckedChange={(checked) =>
                      handleTeamToggle(team.id, checked === true)
                    }
                  />
                  <Label
                    htmlFor={`team-${team.id}`}
                    className="text-sm font-medium"
                  >
                    {team.shortName}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Matches Layout */}
      {upcomingMatches.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {tMatch('views.noUpcoming')}
        </div>
      ) : showAllMatches && !teamFactsUnavailable ? (
        // Desktop: Two columns, Mobile: Stacked
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {teams.map((team) => (
              <div key={team.id} className="space-y-4">
                <h4 className="text-lg font-semibold">
                  {tMatch('views.teamMatches', { team: team.shortName })}
                </h4>
                {matchesByTeam[team.id]?.map((match) => (
                  <UnifiedMatchCard
                    key={match.id}
                    match={match}
                    variant="upcoming"
                    onViewDetails={
                      playerFactsUnavailable ? undefined : handleViewDetails
                    }
                  />
                ))}
                {(matchesByTeam[team.id]?.length === 0 ||
                  !matchesByTeam[team.id]) && (
                  <div className="text-center py-4 text-gray-500">
                    {tMatch('views.noTeamMatchesOnPage', {
                      team: team.shortName,
                    })}
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
              onViewDetails={
                playerFactsUnavailable ? undefined : handleViewDetails
              }
            />
          ))}
          {paginatedMatches.length === 0 && filteredMatches.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {tMatch('views.noMatchesForFilter')}
            </div>
          )}
          {paginatedMatches.length === 0 && filteredMatches.length > 0 && (
            <div className="text-center py-8 text-gray-500">
              {tMatch('views.noMatchesOnPage')}
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
        isAdmin={isAdmin(user)}
      />
    </>
  );
}
