'use client';

import React, { useState } from 'react';
import { useAuth } from '@app/hooks/useAuth';
import { PlayerService } from '@app/services/playerService';
import { TeamService } from '@app/services/teamService';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Badge } from '@app/components/ui/badge';
import { Input } from '@app/components/ui/input';
import { Modal } from '@app/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import {
  Search,
  Edit2,
  User,
  Mars,
  Venus
} from 'lucide-react';
import type { Player } from '@app/lib/types';
import EditPlayerModal from '../modals/EditPlayerModal';

/**
 * PlayersTab Component - Self-contained tab with data fetching
 *
 * Responsibilities:
 * - Fetch players and teams data
 * - Handle filtering and search
 * - Manage edit player modal
 */
export default function PlayersTab() {
  const { user } = useAuth();

  // Service hooks for mutations
  const batchUpdateMutation = PlayerService.useBatchUpdatePlayers();

  // Local state for UI
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterGender, setFilterGender] = useState<'all' | 'male' | 'female'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [selectedTeamForBatch, setSelectedTeamForBatch] = useState('');
  const [teamUpdateMode, setTeamUpdateMode] = useState<'add' | 'remove'>('add');

  // Fetch data using service hooks
  const { data: players = [], isLoading: playersLoading } = PlayerService.usePlayerList();
  const { data: teams = [], isLoading: teamsLoading } = TeamService.useTeamList();

  const isAdmin = user?.role === 'admin';
  const isLoading = playersLoading || teamsLoading;

  const handleEditPlayer = (player: Player) => {
    setSelectedPlayer(player);
    setEditModalOpen(true);
  };

  const handlePlayerUpdated = () => {
    // Data will be automatically refetched by React Query
    setEditModalOpen(false);
    setSelectedPlayer(null);
  };

  const handleSelectAll = () => {
    if (selectedPlayerIds.length === filteredPlayers.length && filteredPlayers.length > 0) {
      setSelectedPlayerIds([]);
    } else {
      setSelectedPlayerIds(filteredPlayers.map(p => p.id));
    }
  };

  const handleToggleSelect = (playerId: string) => {
    setSelectedPlayerIds(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  // Check selected players status for smart button states
  const selectedPlayers = players.filter(p => selectedPlayerIds.includes(p.id));
  const hasActiveSelected = selectedPlayers.some(p => p.isActivePlayer);
  const hasInactiveSelected = selectedPlayers.some(p => !p.isActivePlayer);

  const handleBatchActivate = async () => {
    if (selectedPlayerIds.length === 0) return;

    try {
      // Use Service hook (automatic cache invalidation)
      await batchUpdateMutation.mutateAsync({
        playerIds: selectedPlayerIds,
        updates: { isActivePlayer: true }
      });
      setSelectedPlayerIds([]);
    } catch (error) {
      console.error('Batch activate failed:', error);
      alert('Failed to activate players. Please try again.');
    }
  };

  const handleBatchDeactivate = async () => {
    if (selectedPlayerIds.length === 0) return;

    try {
      // Use Service hook (automatic cache invalidation)
      await batchUpdateMutation.mutateAsync({
        playerIds: selectedPlayerIds,
        updates: { isActivePlayer: false }
      });
      setSelectedPlayerIds([]);
    } catch (error) {
      console.error('Batch deactivate failed:', error);
      alert('Failed to deactivate players. Please try again.');
    }
  };

  const handleBatchUpdateTeam = async () => {
    if (selectedPlayerIds.length === 0) return;
    setTeamUpdateMode('add'); // Default to add mode
    setShowTeamModal(true);
  };

  const handleConfirmUpdateTeam = async () => {
    if (!selectedTeamForBatch) return;

    try {
      // Smart filtering: only update players that need it
      const selectedPlayers = players.filter(p => selectedPlayerIds.includes(p.id));

      let playerIdsToUpdate: string[] = [];

      if (teamUpdateMode === 'add') {
        // Only add players who are NOT already in the team
        playerIdsToUpdate = selectedPlayers
          .filter(p => !p.teamIds?.includes(selectedTeamForBatch))
          .map(p => p.id);

        if (playerIdsToUpdate.length === 0) {
          alert('All selected players are already in this team.');
          setShowTeamModal(false);
          setSelectedTeamForBatch('');
          return;
        }

        // Use Service hook (automatic cache invalidation)
        await batchUpdateMutation.mutateAsync({
          playerIds: playerIdsToUpdate,
          updates: { addToTeams: [selectedTeamForBatch] }
        });
      } else {
        // Only remove players who ARE in the team
        playerIdsToUpdate = selectedPlayers
          .filter(p => p.teamIds?.includes(selectedTeamForBatch))
          .map(p => p.id);

        if (playerIdsToUpdate.length === 0) {
          alert('None of the selected players are in this team.');
          setShowTeamModal(false);
          setSelectedTeamForBatch('');
          return;
        }

        // Use Service hook (automatic cache invalidation)
        await batchUpdateMutation.mutateAsync({
          playerIds: playerIdsToUpdate,
          updates: { removeFromTeams: [selectedTeamForBatch] }
        });
      }

      setSelectedPlayerIds([]);
      setShowTeamModal(false);
      setSelectedTeamForBatch('');

      // Note: Cache invalidation handled automatically by Service hook

      // Show success message
      alert(`Successfully ${teamUpdateMode === 'add' ? 'added' : 'removed'} ${playerIdsToUpdate.length} player(s) ${teamUpdateMode === 'add' ? 'to' : 'from'} team.`);
    } catch (error: any) {
      console.error('Batch update team failed:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error message:', error.message);
      alert(`Failed to ${teamUpdateMode} players ${teamUpdateMode === 'add' ? 'to' : 'from'} team: ${error.response?.data?.error || error.message || 'Unknown error'}`);
    }
  };

  const handleBatchUpdateRanking = async () => {
    if (selectedPlayerIds.length === 0) return;
    setShowRankingModal(true);
  };  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.userName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTeamFilter = filterTeam === 'all' ||
      player.teamIds?.includes(filterTeam);

    const matchesGenderFilter = filterGender === 'all' ||
      player.userGender === filterGender;

    const matchesStatusFilter = filterStatus === 'all' ||
      (filterStatus === 'active' && player.isActivePlayer) ||
      (filterStatus === 'inactive' && !player.isActivePlayer);

    return matchesSearch && matchesTeamFilter && matchesGenderFilter && matchesStatusFilter;
  });

  // Calculate counts for filters
  const allPlayersCount = players.length;
  const maleCount = players.filter(p => p.userGender === 'male').length;
  const femaleCount = players.filter(p => p.userGender === 'female').length;
  const activeCount = players.filter(p => p.isActivePlayer).length;
  const inactiveCount = players.filter(p => !p.isActivePlayer).length;

  // Calculate team counts
  const teamCounts = teams.reduce((acc, team) => {
    acc[team.id] = players.filter(p => p.teamIds?.includes(team.id)).length;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Loading players...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Players List</CardTitle>
          <div className="flex flex-col gap-4 mt-4">
            {/* Search and Team Filter Row */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterTeam} onValueChange={setFilterTeam}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams ({allPlayersCount})</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name} ({teamCounts[team.id] || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Buttons Row */}
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1 border rounded-lg p-1">
                <Button
                  variant={filterGender === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterGender('all')}
                  className="h-7 text-xs"
                >
                  All ({allPlayersCount})
                </Button>
                <Button
                  variant={filterGender === 'male' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterGender('male')}
                  className="h-7 text-xs"
                >
                  Male ({maleCount})
                </Button>
                <Button
                  variant={filterGender === 'female' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterGender('female')}
                  className="h-7 text-xs"
                >
                  Female ({femaleCount})
                </Button>
              </div>

              <div className="flex gap-1 border rounded-lg p-1">
                <Button
                  variant={filterStatus === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterStatus('all')}
                  className="h-7 text-xs"
                >
                  All Status
                </Button>
                <Button
                  variant={filterStatus === 'active' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterStatus('active')}
                  className="h-7 text-xs"
                >
                  Active ({activeCount})
                </Button>
                <Button
                  variant={filterStatus === 'inactive' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterStatus('inactive')}
                  className="h-7 text-xs"
                >
                  Inactive ({inactiveCount})
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                  <tr className="border-b">
                    {isAdmin && (
                      <th className="text-left p-2 font-medium text-muted-foreground w-12">
                        <input
                          type="checkbox"
                          checked={selectedPlayerIds.length === filteredPlayers.length && filteredPlayers.length > 0}
                          onChange={handleSelectAll}
                          className="cursor-pointer h-4 w-4"
                          aria-label="Select all players"
                        />
                      </th>
                    )}
                    <th className="text-left p-2 font-medium text-muted-foreground w-12">#</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-2 font-medium text-muted-foreground hidden sm:table-cell">Ranking</th>
                    <th className="text-left p-2 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Teams</th>
                    {isAdmin && (
                      <th className="text-left p-2 font-medium text-muted-foreground">Actions</th>
                    )}
                  </tr>
                </thead>
              <tbody>
                {filteredPlayers.map((player, index) => (
                  <tr key={player.id} className="border-b hover:bg-muted/50">
                    {isAdmin && (
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedPlayerIds.includes(player.id)}
                          onChange={() => handleToggleSelect(player.id)}
                          className="cursor-pointer h-4 w-4"
                          aria-label={`Select ${player.userName}`}
                        />
                      </td>
                    )}
                    <td className="p-2 text-sm text-muted-foreground">{index + 1}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {player.userGender === 'male' ? (
                          <div title="Male">
                            <Mars className="h-4 w-4 text-blue-600" />
                          </div>
                        ) : player.userGender === 'female' ? (
                          <div title="Female">
                            <Venus className="h-4 w-4 text-pink-600" />
                          </div>
                        ) : (
                          <div title="Unknown">
                            <User className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <span className="font-medium">
                          {player.userName}
                        </span>
                      </div>
                    </td>
                    <td className="p-2 text-sm hidden sm:table-cell">{player.rankingDisplay || `${player.singlesRanking || 0}/${player.doublesRanking || 0}`}</td>
                    <td className="p-2 hidden sm:table-cell">
                      <Badge variant={player.isActivePlayer ? 'default' : 'secondary'} className={player.isActivePlayer ? 'bg-green-600' : ''}>
                        {player.isActivePlayer ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="space-y-1">
                        {player.teamIds?.map(teamId => {
                          const team = teams.find(t => t.id === teamId);
                          return team ? (
                            <div key={teamId} className="text-sm">
                              <span className="font-medium">{team.name}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPlayer(player)}
                            className="h-8 w-8 p-0"
                            title="Edit player teams"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <EditPlayerModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        player={selectedPlayer}
        teams={teams}
        onPlayerUpdated={handlePlayerUpdated}
      />

      {/* Bulk Actions Toolbar */}
      {isAdmin && selectedPlayerIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground p-3 rounded-lg shadow-2xl z-50 w-[calc(100vw-2rem)] sm:w-[90vw] max-w-4xl">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-xs sm:text-sm text-center">
              {selectedPlayerIds.length} player{selectedPlayerIds.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex flex-wrap gap-1 sm:gap-2 justify-center">
              {hasInactiveSelected && (
                <Button
                  onClick={handleBatchActivate}
                  variant="secondary"
                  size="sm"
                  className="text-xs px-2 py-1 h-7 sm:h-8 whitespace-nowrap"
                  title="Activate selected players"
                >
                  Activate
                </Button>
              )}
              {hasActiveSelected && (
                <Button
                  onClick={handleBatchDeactivate}
                  variant="secondary"
                  size="sm"
                  className="text-xs px-2 py-1 h-7 sm:h-8 whitespace-nowrap"
                  title="Deactivate selected players"
                >
                  Deactivate
                </Button>
              )}
              <Button
                onClick={handleBatchUpdateTeam}
                variant="secondary"
                size="sm"
                className="text-xs px-2 py-1 h-7 sm:h-8 whitespace-nowrap"
              >
                Update Teams
              </Button>
              <Button
                onClick={handleBatchUpdateRanking}
                variant="secondary"
                size="sm"
                className="text-xs px-2 py-1 h-7 sm:h-8 whitespace-nowrap"
              >
                Update Ranking
              </Button>
              <Button
                onClick={() => setSelectedPlayerIds([])}
                variant="ghost"
                size="sm"
                className="text-xs px-2 py-1 h-7 sm:h-8 whitespace-nowrap hover:bg-primary-foreground/20"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Team Selection Modal */}
      <Modal isOpen={showTeamModal} onClose={() => setShowTeamModal(false)}>
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-4">Update Player Teams</h3>

          {/* Mode Selection */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Action</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={teamUpdateMode === 'add' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTeamUpdateMode('add')}
                className="flex-1"
              >
                Add to Team
              </Button>
              <Button
                type="button"
                variant={teamUpdateMode === 'remove' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTeamUpdateMode('remove')}
                className="flex-1"
              >
                Remove from Team
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Select a team to {teamUpdateMode === 'add' ? 'add' : 'remove'} {selectedPlayerIds.length} selected player{selectedPlayerIds.length > 1 ? 's' : ''} {teamUpdateMode === 'add' ? 'to' : 'from'}:
          </p>
          <Select value={selectedTeamForBatch} onValueChange={setSelectedTeamForBatch}>
            <SelectTrigger className="w-full mb-4">
              <SelectValue placeholder="Select a team..." />
            </SelectTrigger>
            <SelectContent>
              {teams.map(team => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name} {team.matchLevel && `(${team.matchLevel})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowTeamModal(false);
                setSelectedTeamForBatch('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmUpdateTeam}
              disabled={!selectedTeamForBatch}
            >
              {teamUpdateMode === 'add' ? 'Add to Team' : 'Remove from Team'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Individual Ranking Modal */}
      <Modal isOpen={showRankingModal} onClose={() => setShowRankingModal(false)}>
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Update Player Rankings</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Set individual rankings for each selected player (0-5000):
          </p>
          <div className="space-y-3 mb-4">
            {selectedPlayers.map(player => (
              <div key={player.id} className="p-3 border rounded-lg">
                <div className="font-medium mb-2">{player.userName}</div>
                <div className="text-xs text-muted-foreground mb-3">
                  Current: Singles {player.singlesRanking || 0} / Doubles {player.doublesRanking || 0}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Singles Ranking</label>
                    <Input
                      type="number"
                      min="0"
                      max="5000"
                      defaultValue={player.singlesRanking || 0}
                      className="w-full"
                      id={`singles-ranking-${player.id}`}
                      placeholder="0-5000"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Doubles Ranking</label>
                    <Input
                      type="number"
                      min="0"
                      max="5000"
                      defaultValue={player.doublesRanking || 0}
                      className="w-full"
                      id={`doubles-ranking-${player.id}`}
                      placeholder="0-5000"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRankingModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  // Update each player individually using Service hook
                  for (const player of selectedPlayers) {
                    const singlesInput = document.getElementById(`singles-ranking-${player.id}`) as HTMLInputElement;
                    const doublesInput = document.getElementById(`doubles-ranking-${player.id}`) as HTMLInputElement;
                    const newSinglesRanking = parseInt(singlesInput.value) || 0;
                    const newDoublesRanking = parseInt(doublesInput.value) || 0;
                    if (newSinglesRanking !== player.singlesRanking || newDoublesRanking !== player.doublesRanking) {
                      await batchUpdateMutation.mutateAsync({
                        playerIds: [player.id],
                        updates: {
                          singlesRanking: newSinglesRanking,
                          doublesRanking: newDoublesRanking
                        }
                      });
                    }
                  }
                  setSelectedPlayerIds([]);
                  setShowRankingModal(false);
                  // Note: Cache invalidation handled automatically by Service hook
                } catch (error) {
                  console.error('Batch update ranking failed:', error);
                  alert('Failed to update rankings. Please try again.');
                }
              }}
            >
              Update Rankings
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}