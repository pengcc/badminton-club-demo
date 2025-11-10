'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@app/components/ui/button';
import { Badge } from '@app/components/ui/badge';
import { Modal } from '@app/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import { X, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { PlayerService } from '@app/services/playerService';
import type { Player, Team } from '@app/lib/types';
import { TeamRole } from '@club/shared-types/core/enums';

interface EditPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  teams: Team[];
  onPlayerUpdated: (updatedPlayer: Player) => void;
}

export default function EditPlayerModal({
  isOpen,
  onClose,
  player,
  teams,
  onPlayerUpdated
}: EditPlayerModalProps) {
  const t = useTranslations('dashboard');

  // Service hooks for mutations
  const updatePlayerMutation = PlayerService.useUpdatePlayer();
  const addToTeamMutation = PlayerService.useAddPlayerToTeam();
  const removeFromTeamMutation = PlayerService.useRemovePlayerFromTeam();

  const [loading, setLoading] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedRole, setSelectedRole] = useState<TeamRole>(TeamRole.PLAYER);
  const [localIsActivePlayer, setLocalIsActivePlayer] = useState(player?.isActivePlayer || false);
  const [localSinglesRanking, setLocalSinglesRanking] = useState(player?.singlesRanking || 0);
  const [localDoublesRanking, setLocalDoublesRanking] = useState(player?.doublesRanking || 0);
  const [hasChanges, setHasChanges] = useState(false);
  const [pendingTeamChanges, setPendingTeamChanges] = useState<{
    toAdd: Array<{ teamId: string; role: string }>;
    toRemove: Array<string>;
  }>({ toAdd: [], toRemove: [] });

  // Update local state when player changes
  useEffect(() => {
    setLocalIsActivePlayer(player?.isActivePlayer || false);
    setLocalSinglesRanking(player?.singlesRanking || 0);
    setLocalDoublesRanking(player?.doublesRanking || 0);
    setPendingTeamChanges({ toAdd: [], toRemove: [] });
    setHasChanges(false);
  }, [player]);

  const handleSave = async () => {
    if (!player || !hasChanges) return;

    setLoading(true);
    try {
      // Prepare update data for basic fields
      const updateData: any = {};

      // Status and ranking changes
      if (localIsActivePlayer !== player.isActivePlayer) {
        updateData.isActivePlayer = localIsActivePlayer;
      }
      if (localSinglesRanking !== player.singlesRanking) {
        updateData.singlesRanking = localSinglesRanking;
      }
      if (localDoublesRanking !== player.doublesRanking) {
        updateData.doublesRanking = localDoublesRanking;
      }

      // Update basic fields if any changed
      if (Object.keys(updateData).length > 0) {
        await updatePlayerMutation.mutateAsync({
          id: player.id,
          formData: updateData
        });
      }

      // Handle team removals
      for (const teamId of pendingTeamChanges.toRemove) {
        await removeFromTeamMutation.mutateAsync({
          playerId: player.id,
          teamId
        });
      }

      // Handle team additions
      for (const teamChange of pendingTeamChanges.toAdd) {
        await addToTeamMutation.mutateAsync({
          playerId: player.id,
          teamId: teamChange.teamId
        });
      }

      // Cache invalidation handled automatically by Service hooks
      // React Query will refetch the updated player data
      onPlayerUpdated(player); // Pass current player, parent doesn't use it anyway
      onClose();
    } catch (error) {
      console.error('Error saving player changes:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmDiscard = window.confirm('You have unsaved changes. Are you sure you want to discard them?');
      if (!confirmDiscard) return;
    }
    onClose();
  };

  // Calculate current teams with pending changes
  const getCurrentTeams = () => {
    if (!player) return [];

    // Get current team IDs and map them to team objects
    let currentTeamIds = [...(player.teamIds || [])];

    // Remove teams that are pending removal
    currentTeamIds = currentTeamIds.filter(teamId =>
      !pendingTeamChanges.toRemove.includes(teamId)
    );

    // Add teams that are pending addition
    pendingTeamChanges.toAdd.forEach(change => {
      if (!currentTeamIds.includes(change.teamId)) {
        currentTeamIds.push(change.teamId);
      }
    });

    // Map team IDs to team objects with role info
    return currentTeamIds.map(teamId => {
      const team = teams.find(t => t.id === teamId);
      const pendingAdd = pendingTeamChanges.toAdd.find(change => change.teamId === teamId);
      return {
        teamId,
        team: team ? { id: team.id, name: team.name } : null,
        joinedAt: new Date(),
        role: pendingAdd?.role || 'player'
      };
    }).filter(aff => aff.team !== null);
  };

  const availableTeams = teams.filter(team =>
    !getCurrentTeams().some(aff => aff.team && aff.team.id === team.id)
  );

  const handleToggleActivePlayer = () => {
    const newActiveStatus = !localIsActivePlayer;
    setLocalIsActivePlayer(newActiveStatus);
    setHasChanges(true);
  };

  const handleSinglesRankingChange = (newRanking: number) => {
    setLocalSinglesRanking(newRanking);
    setHasChanges(true);
  };

  const handleDoublesRankingChange = (newRanking: number) => {
    setLocalDoublesRanking(newRanking);
    setHasChanges(true);
  };

  const handleAddTeam = () => {
    if (!player || !selectedTeamId) return;

    setPendingTeamChanges(prev => ({
      ...prev,
      toAdd: [...prev.toAdd, { teamId: selectedTeamId, role: selectedRole }]
    }));
    setSelectedTeamId('');
    setSelectedRole(TeamRole.PLAYER);
    setHasChanges(true);
  };

  const handleRemoveTeam = (teamId: string) => {
    if (!player) return;

    setPendingTeamChanges(prev => ({
      ...prev,
      toRemove: [...prev.toRemove, teamId]
    }));
    setHasChanges(true);
  };

  if (!player) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleCancel}>
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold truncate pr-4">
              Edit Player - {player.userName}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={loading}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Player Status Toggle - MOVED TO TOP */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">Player Status</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {localIsActivePlayer ? 'Active player - can participate in matches' : 'Inactive player - cannot participate in matches'}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={handleToggleActivePlayer}
                disabled={loading}
                className={`h-12 w-20 p-0 ${localIsActivePlayer ? 'text-green-600' : 'text-gray-400'}`}
              >
                {localIsActivePlayer ? (
                  <ToggleRight className="h-8 w-8" />
                ) : (
                  <ToggleLeft className="h-8 w-8" />
                )}
              </Button>
            </div>
            <div className="mt-2">
              <Badge
                variant={localIsActivePlayer ? 'default' : 'secondary'}
                className={localIsActivePlayer ? 'bg-green-600' : ''}
              >
                {localIsActivePlayer ? 'Active Player' : 'Inactive Player'}
              </Badge>
            </div>
          </div>

          {/* Player Ranking - MOVED BELOW STATUS */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm">Player Rankings</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Player rankings for match organization and team composition
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block">Singles Ranking</label>
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    value={localSinglesRanking}
                    onChange={(e) => handleSinglesRankingChange(parseInt(e.target.value) || 0)}
                    disabled={loading}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0-5000"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Current: {player?.singlesRanking || 0}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Doubles Ranking</label>
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    value={localDoublesRanking}
                    onChange={(e) => handleDoublesRankingChange(parseInt(e.target.value) || 0)}
                    disabled={loading}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0-5000"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Current: {player?.doublesRanking || 0}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Higher ranking indicates stronger player (typically 0-5000 range)
              </div>
            </div>
          </div>

          {/* Current Teams */}
          <div>
            <h4 className="font-medium mb-3 text-sm">Current Teams</h4>
            <div className="space-y-2">
              {getCurrentTeams().filter(aff => aff.team).map(affiliation => (
                <div
                  key={affiliation.team!.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-medium text-sm truncate">{affiliation.team!.name}</span>
                    {affiliation.role !== 'player' && (
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {affiliation.role}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveTeam(affiliation.team!.id)}
                    disabled={loading}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive flex-shrink-0 ml-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {getCurrentTeams().length === 0 && (
                <p className="text-muted-foreground text-sm py-4 text-center bg-muted/20 rounded-lg">
                  No active team affiliations
                </p>
              )}
            </div>
          </div>

          {/* Add New Team */}
          {availableTeams.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 text-sm">Add to Team</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Select Team</label>
                  <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a team..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTeams.map((team: Team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name} {team.matchLevel && `(${team.matchLevel})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Role</label>
                  <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as TeamRole)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TeamRole).map((role) => (
                        <SelectItem key={role} value={role}>
                          {t(`player.role.${role}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleAddTeam}
                  disabled={!selectedTeamId || loading}
                  className="w-full hover:bg-primary hover:text-primary-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Team
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t bg-muted/20">
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="min-w-[100px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !hasChanges}
              className="min-w-[100px] hover:bg-primary hover:text-primary-foreground"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}