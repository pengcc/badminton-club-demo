'use client';

import React, { useState } from 'react';
import { useAuth } from '@app/hooks/useAuth';
import { MatchService } from '@app/services/matchService';
import { TeamService } from '@app/services/teamService';
import { PlayerService } from '@app/services/playerService';
import { Card, CardHeader, CardTitle } from '@app/components/ui/card';
import { Checkbox } from '@app/components/ui/checkbox';
import { Label } from '@app/components/ui/label';
import { Pagination } from '@app/components/ui/Pagination';
import { SkeletonMatchCards } from '@app/components/ui/SkeletonMatchCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@app/components/ui/select';
import type { Match } from '@app/lib/types';
import UnifiedMatchCard from '../MatchCard';
import MatchDetailsModal from '../modals/MatchDetailsModal';
import MatchLineupModal from '../modals/MatchLineupModal';

/**
 * MatchHistoryTab Component - Self-contained tab with data fetching
 *
 * Responsibilities:
 * - Fetch history matches (completed, past dates - timezone-safe filtering in service layer)
 * - Filter matches by team (dynamic, uses team IDs not hardcoded names)
 * - Filter by year
 * - Manage lineup and details modals
 * - Paginate match results
 *
 * Improvements:
 * - ✅ Dynamic team filtering (no hardcoded "Team 1", "Team 2")
 * - ✅ Timezone-safe date comparison (ISO string comparison in service layer)
 * - ✅ Frontend pagination with configurable page size
 * - ✅ Skeleton loading states for better UX
 */
export default function MatchHistoryTab() {
  const { user } = useAuth();

  // Local state for UI
  const [yearFilter, setYearFilter] = useState('all');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);  // Changed: Dynamic team filtering
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [showMatchLineup, setShowMatchLineup] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);  // For MatchDetailsModal
  const [selectedMatchForLineup, setSelectedMatchForLineup] = useState<Match | null>(null);  // For MatchLineupModal (temp)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Derived state
  const showAllMatches = selectedTeamIds.length === 0;

  // Fetch data using service hooks - useHistoryMatches now handles date filtering
  const { data: historyMatches = [], isLoading } = MatchService.useHistoryMatches(yearFilter);
  const { data: teams = [] } = TeamService.useTeamList();
  const { data: players = [] } = PlayerService.usePlayerList();
  const toggleAvailabilityMutation = MatchService.useTogglePlayerAvailability();

  // Filter matches based on team selection (date and year filtering now done in useHistoryMatches hook)
  const filteredMatches = historyMatches.filter(match => {
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

  const handleViewDetails = (match: Match) => {
    setSelectedMatchId(match.id);
    setShowMatchDetails(true);
  };

  const handleViewLineup = (match: Match) => {
    setSelectedMatchForLineup(match);
    setShowMatchLineup(true);
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
            <CardTitle>Match History</CardTitle>
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
            <CardTitle>Match History</CardTitle>

            {/* Year Filter */}
            <div className="mt-4">
              <Select
                value={yearFilter}
                onValueChange={(value) => {
                  setYearFilter(value);
                  setCurrentPage(1); // Reset to first page when filter changes
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Checkboxes */}
            <div className="flex flex-wrap gap-4 mt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="all-history-matches"
                  checked={showAllMatches}
                  onChange={() => setSelectedTeamIds([])}
                />
                <Label htmlFor="all-history-matches" className="text-sm font-medium">
                  All Matches
                </Label>
              </div>

              {/* Dynamic team checkboxes */}
              {teams.map(team => (
                <div key={team.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`team-history-${team.id}`}
                    checked={selectedTeamIds.includes(team.id)}
                    onChange={(e) => handleTeamToggle(team.id, e.target.checked)}
                  />
                  <Label htmlFor={`team-history-${team.id}`} className="text-sm font-medium">
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
                  <h4 className="text-lg font-semibold">{team.name} History</h4>
                  {matchesByTeam[team.id]?.map((match) => (
                    <UnifiedMatchCard
                      key={match.id}
                      match={match}
                      variant="history"
                      user={user}
                      onViewDetails={handleViewDetails}
                      onViewLineup={handleViewLineup}
                    />
                  ))}
                  {(matchesByTeam[team.id]?.length === 0 || !matchesByTeam[team.id]) && (
                    <div className="text-center py-4 text-gray-500">
                      No {team.name} history on this page.
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
                variant="history"
                user={user}
                onViewDetails={handleViewDetails}
                onViewLineup={handleViewLineup}
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

      {/* Match Lineup Modal */}
      {selectedMatchForLineup && (
        <MatchLineupModal
          match={selectedMatchForLineup}
          isOpen={showMatchLineup}
          onClose={() => {
            setShowMatchLineup(false);
            setSelectedMatchForLineup(null);
          }}
          teams={teams}
          players={players}
          onLineupSaved={() => {}}
        />
      )}
    </>
  );
}