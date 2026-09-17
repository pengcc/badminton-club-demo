'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@app/hooks/useAuth';
import { MatchService } from '@app/services/matchService';
import { TeamService } from '@app/services/teamService';
import { Card, CardHeader, CardTitle } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Input } from '@app/components/ui/input';
import { Checkbox } from '@app/components/ui/checkbox';
import { Label } from '@app/components/ui/label';
import {
  ConfirmDialog,
  useConfirmDialog,
} from '@app/components/ui/confirm-dialog';
import { Pagination } from '@app/components/ui/Pagination';
import { SkeletonMatchCards } from '@app/components/ui/SkeletonMatchCard';
import type { Match } from '@app/lib/types';
import UnifiedMatchCard from '../MatchCard';
import ScheduleMatchModal from '../modals/ScheduleMatchModal';
import EditMatchModal from '../modals/EditMatchModal';
import MatchLineupModal from '../modals/MatchLineupModal';
import MatchResultModal from '../modals/MatchResultModal';
import { CSVUploadModal } from '../modals/CSVUploadModal';
import { toast } from 'sonner';
import { Plus, Upload } from 'lucide-react';
import { MatchListView } from '@club/shared-types/core/enums';
import { DemoEditingService } from '@app/services/demoEditingService';

function DemoEditingAvailability({
  onChange,
}: {
  onChange: (active: boolean) => void;
}) {
  const status = DemoEditingService.useStatus();
  useEffect(() => {
    onChange(status.data?.mode === 'active');
  }, [onChange, status.data?.mode]);
  return null;
}

/**
 * MatchManagementTab Component - Self-contained admin tab with data fetching
 *
 * Responsibilities:
 * - Fetch matches and teams data
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
  const tDialog = useTranslations('dashboard.dialogActions');
  const { user } = useAuth();
  const [canEditDemo, setCanEditDemo] = useState(false);

  // Local state for UI
  const [matchSearch, setMatchSearch] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]); // Changed: Dynamic team filtering
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLineupModal, setShowLineupModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const { confirm: confirmDialog, confirmProps } = useConfirmDialog({
    confirmText: tDialog('confirm'),
    cancelText: tDialog('cancel'),
    pendingText: tDialog('processing'),
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Derived state
  const showAllMatches = selectedTeamIds.length === 0;

  useEffect(() => {
    if (user.demoMode && !canEditDemo) {
      setShowScheduleModal(false);
      setShowEditModal(false);
      setSelectedMatch(null);
    }
  }, [canEditDemo, user.demoMode]);

  // Fetch data using service hooks
  const {
    data: matches = [],
    isLoading: matchesLoading,
    isError,
    refetch,
  } = MatchService.useMatchList(MatchListView.ALL);
  const { data: teams = [] } = TeamService.useTeamList();
  const deleteMutation = MatchService.useDeleteMatch();

  const isLoading = matchesLoading;
  // Filter and sort matches
  const filteredAndSortedMatches = matches
    .filter((match) => {
      // Enhanced search matching
      const clubTeamName = match.clubTeamName;
      const opponentName = match.opponentName;
      const location = match.location || '';

      const searchTerm = matchSearch.toLowerCase();
      const matchesSearch =
        searchTerm === '' ||
        clubTeamName.toLowerCase().includes(searchTerm) ||
        opponentName.toLowerCase().includes(searchTerm) ||
        location.toLowerCase().includes(searchTerm) ||
        match.localStart.date.includes(searchTerm) ||
        match.localStart.time.toLowerCase().includes(searchTerm);

      return matchesSearch;
    })
    .filter((match) => {
      // Team filter - dynamic filtering by team IDs
      if (showAllMatches) return true;
      return selectedTeamIds.includes(match.teamId);
    })
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));

  // Pagination logic
  const totalMatches = filteredAndSortedMatches.length;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedMatches = filteredAndSortedMatches.slice(startIndex, endIndex);

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

  const handleEditMatch = (match: Match) => {
    setSelectedMatch(match);
    setShowEditModal(true);
  };

  const handleViewLineup = (match: Match) => {
    setSelectedMatch(match);
    setShowLineupModal(true);
  };

  const handleEditResult = (match: Match) => {
    setSelectedMatch(match);
    setShowResultModal(true);
  };

  const handleDeleteMatch = (match: Match) => {
    confirmDialog({
      title: tMatch('confirmation.deleteMatch'),
      description: tMatch('confirmation.deleteMatch'),
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync({
            id: match.id,
            expectedVersion: match.version,
          });
          toast.success(tMatch('confirmation.deleteSuccess'));
        } catch (error) {
          const status = (error as { response?: { status?: number } }).response
            ?.status;
          toast.error(
            status === 409
              ? tMatch('errors.conflict')
              : tMatch('confirmation.deleteError')
          );
        }
      },
    });
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

  if (isError && matches.length === 0) {
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
      {user.demoMode && <DemoEditingAvailability onChange={setCanEditDemo} />}
      <ConfirmDialog {...confirmProps} />
      {isError && matches.length > 0 && (
        <div
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {tMatch('common.backgroundError')}
        </div>
      )}
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>{tMatch('title')}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {tMatch('views.showing', {
                  shown: paginatedMatches.length,
                  total: totalMatches,
                })}
                {matchSearch &&
                  tMatch('views.matching', { search: matchSearch })}
                {!showAllMatches &&
                  tMatch('views.teamsSelected', {
                    count: selectedTeamIds.length,
                  })}
              </p>
            </div>
            {/* Action Buttons - Stack on mobile, row on desktop (Phase 7) */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {!user.demoMode && (
                <Button
                  onClick={() => setShowCSVModal(true)}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {tMatch('views.importCsv')}
                </Button>
              )}
              {(!user.demoMode || canEditDemo) && (
                <Button
                  onClick={() => setShowScheduleModal(true)}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {tMatch('modals.scheduleMatch.title')}
                </Button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="flex-1">
              <Input
                placeholder={tMatch('views.searchPlaceholder')}
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
                  onCheckedChange={() => {
                    setSelectedTeamIds([]);
                    setCurrentPage(1);
                  }}
                />
                <Label
                  htmlFor="all-management-matches"
                  className="text-sm font-medium"
                >
                  {tMatch('views.allMatches')}
                </Label>
              </div>

              {/* Dynamic team checkboxes */}
              {teams.map((team) => (
                <div key={team.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`team-management-${team.id}`}
                    checked={selectedTeamIds.includes(team.id)}
                    onCheckedChange={(checked) =>
                      handleTeamToggle(team.id, checked === true)
                    }
                  />
                  <Label
                    htmlFor={`team-management-${team.id}`}
                    className="text-sm font-medium"
                  >
                    {team.shortName}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Matches Layout */}
      {matches.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {tMatch('views.noMatches')}
        </div>
      ) : showAllMatches ? (
        // All teams view with pagination
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
                    variant="management"
                    onEditMatch={
                      !user.demoMode || (canEditDemo && match.isDemoScratch)
                        ? handleEditMatch
                        : undefined
                    }
                    onEditResult={user.demoMode ? undefined : handleEditResult}
                    onViewLineup={user.demoMode ? undefined : handleViewLineup}
                    onDeleteMatch={
                      user.demoMode ? undefined : handleDeleteMatch
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
              onEditMatch={
                !user.demoMode || (canEditDemo && match.isDemoScratch)
                  ? handleEditMatch
                  : undefined
              }
              onEditResult={user.demoMode ? undefined : handleEditResult}
              onViewLineup={user.demoMode ? undefined : handleViewLineup}
              onDeleteMatch={user.demoMode ? undefined : handleDeleteMatch}
            />
          ))}
          {paginatedMatches.length === 0 &&
            filteredAndSortedMatches.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {tMatch('views.noMatchesForFilter')}
              </div>
            )}
          {paginatedMatches.length === 0 &&
            filteredAndSortedMatches.length > 0 && (
              <div className="text-center py-8 text-gray-500">
                {tMatch('views.noMatchesOnPage')}
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
          matchId={selectedMatch.id}
          teams={teams}
        />
      )}

      {selectedMatch && showResultModal && (
        <MatchResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          match={selectedMatch}
          teams={teams}
        />
      )}

      {showCSVModal && (
        <CSVUploadModal
          isOpen={showCSVModal}
          onClose={() => setShowCSVModal(false)}
          userId={user?.id || ''}
        />
      )}
    </>
  );
}
