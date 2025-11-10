'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@app/hooks/useAuth';
import { MatchService } from '@app/services/matchService';
import { TeamService } from '@app/services/teamService';
import { PlayerService } from '@app/services/playerService';
import { Card, CardHeader, CardTitle } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Input } from '@app/components/ui/input';
import { Checkbox } from '@app/components/ui/checkbox';
import { Label } from '@app/components/ui/label';
import { Pagination } from '@app/components/ui/Pagination';
import { SkeletonMatchCards } from '@app/components/ui/SkeletonMatchCard';
import type { Match } from '@app/lib/types';
import UnifiedMatchCard from '../MatchCard';
import ScheduleMatchModal from '../modals/ScheduleMatchModal';
import EditMatchModal from '../modals/EditMatchModal';
import MatchLineupModal from '../modals/MatchLineupModal';
import {
  Plus
} from 'lucide-react';

/**
 * MatchManagementTab Component - Self-contained admin tab with data fetching
 *
 * Responsibilities:
 * - Fetch matches, teams, and players data
 * - Handle match CRUD operations
 * - Manage schedule, edit, and lineup modals
 * - Paginate and filter matches
 *
 * Improvements:
 * - ✅ Dynamic team filtering (no hardcoded "Team 1", "Team 2")
 * - ✅ Timezone-safe date comparison (ISO string comparison in service layer)
 * - ✅ Frontend pagination with configurable page size
 * - ✅ Skeleton loading states for better UX
 */
export default function MatchManagementTab() {
  const tMatch = useTranslations('match');
  const { user } = useAuth();

  // Local state for UI
  const [matchSearch, setMatchSearch] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);  // Changed: Dynamic team filtering
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLineupModal, setShowLineupModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Derived state
  const showAllMatches = selectedTeamIds.length === 0;

  // Fetch data using service hooks
  const { data: matches = [], isLoading: matchesLoading } = MatchService.useMatchList();
  const { data: teams = [] } = TeamService.useTeamList();
  const { data: players = [] } = PlayerService.usePlayerList();
  const deleteMutation = MatchService.useDeleteMatch();

  const isLoading = matchesLoading;

  // Filter and sort matches
  const filteredAndSortedMatches = matches
    .filter(match => {
      // Enhanced search matching
      const homeTeamName = match.homeTeamName;
      const awayTeamName = match.awayTeamName || '';
      const location = match.location || '';

      const searchTerm = matchSearch.toLowerCase();
      const matchesSearch = searchTerm === '' ||
        homeTeamName.toLowerCase().includes(searchTerm) ||
        awayTeamName.toLowerCase().includes(searchTerm) ||
        location.toLowerCase().includes(searchTerm) ||
        new Date(match.date).toLocaleDateString().toLowerCase().includes(searchTerm) ||
        (match.time && match.time.toLowerCase().includes(searchTerm));

      return matchesSearch;
    })
    .filter(match => {
      // Team filter - dynamic filtering by team IDs
      if (showAllMatches) return true;
      return selectedTeamIds.includes(match.homeTeamId);
    })
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);

      // Sort by status first (scheduled before completed), then by date
      if (a.status !== b.status) {
        const statusOrder: Record<string, number> = { 'scheduled': 1, 'completed': 2 };
        return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
      }

      // For scheduled matches, nearest date first
      // For completed matches, most recent first
      if (a.status === 'scheduled') {
        return dateA.getTime() - dateB.getTime();
      } else {
        return dateB.getTime() - dateA.getTime();
      }
    });

  // Pagination logic
  const totalMatches = filteredAndSortedMatches.length;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedMatches = filteredAndSortedMatches.slice(startIndex, endIndex);

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

  const handleEditMatch = (match: Match) => {
    setSelectedMatch(match);
    setShowEditModal(true);
  };

  const handleViewLineup = (match: Match) => {
    setSelectedMatch(match);
    setShowLineupModal(true);
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm(tMatch('confirmation.deleteMatch'))) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(matchId);
      alert(tMatch('confirmation.deleteSuccess'));
    } catch (error: any) {
      console.group('❌ Error deleting match');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Match ID:', matchId);
      console.groupEnd();

      const errorMessage = error.response?.data?.message || error.message || tMatch('modals.matchLineup.unknownError');
      alert(`${tMatch('confirmation.deleteError')}: ${errorMessage}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{tMatch('title')}</CardTitle>
          </CardHeader>
        </Card>
        <SkeletonMatchCards count={3} />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>{tMatch('title')}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Showing {paginatedMatches.length} of {totalMatches} matches
                  {matchSearch && ` matching "${matchSearch}"`}
                  {!showAllMatches && ` (${selectedTeamIds.length} team${selectedTeamIds.length !== 1 ? 's' : ''} selected)`}
                </p>
              </div>
              <Button onClick={() => setShowScheduleModal(true)} variant="outline" size="sm" className="w-full sm:w-auto hover:bg-primary hover:text-primary-foreground">
                <Plus className="mr-2 h-4 w-4" />
                {tMatch('modals.scheduleMatch.title')}
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="flex-1">
              <Input
                placeholder="Suche nach Teams, Ort, Datum oder Uhrzeit..."
                value={matchSearch}
                onChange={(e) => setMatchSearch(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Team Filter Checkboxes - Dynamic */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="all-management-matches"
                  checked={showAllMatches}
                  onChange={() => setSelectedTeamIds([])}
                />
                <Label htmlFor="all-management-matches" className="text-sm font-medium">
                  All Matches
                </Label>
              </div>

              {/* Dynamic team checkboxes */}
              {teams.map(team => (
                <div key={team.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`team-management-${team.id}`}
                    checked={selectedTeamIds.includes(team.id)}
                    onChange={(e) => handleTeamToggle(team.id, e.target.checked)}
                  />
                  <Label htmlFor={`team-management-${team.id}`} className="text-sm font-medium">
                    {team.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Matches Layout */}
      {showAllMatches ? (
        // All teams view with pagination
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {teams.map(team => (
              <div key={team.id} className="space-y-4">
                <h4 className="text-lg font-semibold">{team.name} Matches</h4>
                {matchesByTeam[team.id]?.map((match) => (
                  <UnifiedMatchCard
                    key={match.id}
                    match={match}
                    variant="management"
                    user={user}
                    onEditMatch={handleEditMatch}
                    onViewLineup={handleViewLineup}
                    onDeleteMatch={handleDeleteMatch}
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
          {totalMatches > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={totalMatches}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </div>
      ) : (
        // Filtered view - single column
        <div className="space-y-4">
          {paginatedMatches.map((match) => (
            <UnifiedMatchCard
              key={match.id}
              match={match}
              variant="management"
              user={user}
              onEditMatch={handleEditMatch}
              onViewLineup={handleViewLineup}
              onDeleteMatch={handleDeleteMatch}
            />
          ))}
          {paginatedMatches.length === 0 && filteredAndSortedMatches.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No matches found for the selected filter.
            </div>
          )}
          {paginatedMatches.length === 0 && filteredAndSortedMatches.length > 0 && (
            <div className="text-center py-8 text-gray-500">
              No matches on this page. Try going to page 1.
            </div>
          )}

          {/* Pagination */}
          {totalMatches > 0 && (
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

      {/* Modals */}
      {showScheduleModal && (
        <ScheduleMatchModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          teams={teams}
          onMatchCreated={() => {}}
        />
      )}

      {selectedMatch && showEditModal && (
        <EditMatchModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          match={selectedMatch}
          teams={teams}
          onMatchUpdated={() => {}}
        />
      )}

      {selectedMatch && showLineupModal && (
        <MatchLineupModal
          isOpen={showLineupModal}
          onClose={() => setShowLineupModal(false)}
          match={selectedMatch}
          teams={teams}
          players={players}
          onLineupSaved={() => {}}
        />
      )}
    </div>
    </>
  );
}
