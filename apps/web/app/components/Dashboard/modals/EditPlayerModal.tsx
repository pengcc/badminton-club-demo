'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import {
  ConfirmDialog,
  useConfirmDialog,
} from '@app/components/ui/confirm-dialog';
import { X, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { PlayerService } from '@app/services/playerService';
import type { Player, Team } from '@app/lib/types';
import { toast } from 'sonner';
import { formatTeamClass } from '@app/lib/teamClass';

interface EditPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  teams: Team[];
  onPlayerUpdated: (updatedPlayer: Player) => void;
}

interface SavedPlayerState {
  isActivePlayer: boolean;
  singlesRanking: number;
  doublesRanking: number;
}

function getPlayerState(player: Player | null): SavedPlayerState {
  return {
    isActivePlayer: player?.isActivePlayer ?? false,
    singlesRanking: player?.singlesRanking ?? 0,
    doublesRanking: player?.doublesRanking ?? 0,
  };
}

function getErrorStatus(error: unknown): number | undefined {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('response' in error) ||
    typeof error.response !== 'object' ||
    error.response === null ||
    !('status' in error.response) ||
    typeof error.response.status !== 'number'
  ) {
    return undefined;
  }

  return error.response.status;
}

export default function EditPlayerModal({
  isOpen,
  onClose,
  player,
  teams,
  onPlayerUpdated,
}: EditPlayerModalProps) {
  const t = useTranslations('dashboard');
  const tDialog = useTranslations('dashboard.dialogActions');
  const { confirmProps, confirm: confirmDialog } = useConfirmDialog({
    confirmText: tDialog('confirm'),
    cancelText: tDialog('cancel'),
    pendingText: tDialog('processing'),
  });

  // Service hooks for mutations
  const updatePlayerMutation = PlayerService.useUpdatePlayer();
  const batchUpdateMutation = PlayerService.useBatchUpdatePlayers();
  const participationMutation = PlayerService.useSetPlayerParticipation();

  const [loading, setLoading] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [localIsActivePlayer, setLocalIsActivePlayer] = useState(
    player?.isActivePlayer || false
  );
  const [localSinglesRanking, setLocalSinglesRanking] = useState(
    player?.singlesRanking || 0
  );
  const [localDoublesRanking, setLocalDoublesRanking] = useState(
    player?.doublesRanking || 0
  );
  const [savedPlayerState, setSavedPlayerState] = useState<SavedPlayerState>(
    () => getPlayerState(player)
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [pendingTeamChanges, setPendingTeamChanges] = useState<{
    toAdd: string[];
    toRemove: Array<string>;
  }>({ toAdd: [], toRemove: [] });
  const editSessionRef = useRef<{
    isOpen: boolean;
    playerId: string | undefined;
  }>({ isOpen: false, playerId: undefined });
  const isPending =
    loading ||
    updatePlayerMutation.isPending ||
    batchUpdateMutation.isPending ||
    participationMutation.isPending;

  // Start a fresh form only when the modal opens or its target Player changes.
  // Same-Player query refreshes must not discard an unsubmitted Team intent.
  useEffect(() => {
    const previousSession = editSessionRef.current;
    const shouldReset =
      isOpen &&
      (!previousSession.isOpen || previousSession.playerId !== player?.id);
    editSessionRef.current = { isOpen, playerId: player?.id };

    if (!shouldReset) return;

    const nextPlayerState = getPlayerState(player);
    setLocalIsActivePlayer(player?.isActivePlayer || false);
    setLocalSinglesRanking(player?.singlesRanking || 0);
    setLocalDoublesRanking(player?.doublesRanking || 0);
    setSavedPlayerState(nextPlayerState);
    setPendingTeamChanges({ toAdd: [], toRemove: [] });
    setHasChanges(false);
  }, [isOpen, player]);

  const handleSave = async () => {
    if (!player || !hasChanges) return;

    setLoading(true);
    try {
      const updateData: {
        singlesRanking?: number;
        doublesRanking?: number;
      } = {};
      const completedOperations: string[] = [];

      if (localSinglesRanking !== savedPlayerState.singlesRanking) {
        updateData.singlesRanking = localSinglesRanking;
      }
      if (localDoublesRanking !== savedPlayerState.doublesRanking) {
        updateData.doublesRanking = localDoublesRanking;
      }

      if (Object.keys(updateData).length > 0) {
        try {
          await updatePlayerMutation.mutateAsync({
            id: player.id,
            formData: updateData,
          });
          setSavedPlayerState((current) => ({
            ...current,
            singlesRanking: localSinglesRanking,
            doublesRanking: localDoublesRanking,
          }));
          completedOperations.push(
            t('playerManagement.saveFeedback.rankingsSaved')
          );
        } catch {
          toast.error(t('playerManagement.saveFeedback.rankingFailure'));
          return;
        }
      }

      if (localIsActivePlayer !== savedPlayerState.isActivePlayer) {
        try {
          await participationMutation.mutateAsync({
            id: player.id,
            isActivePlayer: localIsActivePlayer,
          });
          setSavedPlayerState((current) => ({
            ...current,
            isActivePlayer: localIsActivePlayer,
          }));
          completedOperations.push(
            t('playerManagement.saveFeedback.eligibilitySaved')
          );
        } catch {
          toast.error(
            completedOperations.length > 0
              ? t('playerManagement.saveFeedback.partialEligibilityFailure')
              : t('playerManagement.saveFeedback.eligibilityFailure')
          );
          return;
        }
      }

      if (
        pendingTeamChanges.toAdd.length > 0 ||
        pendingTeamChanges.toRemove.length > 0
      ) {
        try {
          const result = await batchUpdateMutation.mutateAsync({
            playerIds: [player.id],
            updates: {
              addToTeams: pendingTeamChanges.toAdd,
              removeFromTeams: pendingTeamChanges.toRemove,
            },
          });
          toast.success(
            t('playerManagement.teamAssociation.editSuccess', {
              count: result.updatedCount,
            })
          );
        } catch (error: unknown) {
          const status = getErrorStatus(error);

          if (completedOperations.length > 0) {
            const completed = completedOperations.join(
              t('playerManagement.saveFeedback.completedSeparator')
            );
            toast.error(
              status === 409
                ? t('playerManagement.teamAssociation.partialConflict', {
                    completed,
                  })
                : t('playerManagement.teamAssociation.partialFailure', {
                    completed,
                  })
            );
          } else {
            toast.error(
              status === 409
                ? t('playerManagement.teamAssociation.conflict')
                : t('playerManagement.teamAssociation.failure')
            );
          }
          return;
        }
      }

      // Cache invalidation handled automatically by Service hooks
      // React Query will refetch the updated player data
      onPlayerUpdated(player); // Pass current player, parent doesn't use it anyway
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      confirmDialog({
        title: 'Discard Changes?',
        description:
          'You have unsaved changes. Are you sure you want to discard them?',
        variant: 'destructive',
        confirmText: 'Discard',
        cancelText: 'Keep Editing',
        onConfirm: () => onClose(),
      });
      return;
    }
    onClose();
  };

  // Calculate current teams with pending changes
  const getCurrentTeams = () => {
    if (!player) return [];

    // Get current team IDs and map them to team objects
    let currentTeamIds = [...(player.teamIds || [])];

    // Remove teams that are pending removal
    currentTeamIds = currentTeamIds.filter(
      (teamId) => !pendingTeamChanges.toRemove.includes(teamId)
    );

    // Add teams that are pending addition
    pendingTeamChanges.toAdd.forEach((teamId) => {
      if (!currentTeamIds.includes(teamId)) {
        currentTeamIds.push(teamId);
      }
    });

    // Map team IDs to team objects with role info
    return currentTeamIds
      .map((teamId) => {
        const team = teams.find((t) => t.id === teamId);
        return {
          teamId,
          team: team ? { id: team.id, name: team.shortName } : null,
          joinedAt: new Date(),
          role: 'player',
        };
      })
      .filter((aff) => aff.team !== null);
  };

  const availableTeams = teams.filter(
    (team) =>
      !getCurrentTeams().some((aff) => aff.team && aff.team.id === team.id)
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

    setPendingTeamChanges((prev) => ({
      toAdd: prev.toAdd.includes(selectedTeamId)
        ? prev.toAdd
        : [...prev.toAdd, selectedTeamId],
      toRemove: prev.toRemove.filter((teamId) => teamId !== selectedTeamId),
    }));
    setSelectedTeamId('');
    setHasChanges(true);
  };

  const handleRemoveTeam = (teamId: string) => {
    if (!player) return;

    if (pendingTeamChanges.toAdd.includes(teamId)) {
      setPendingTeamChanges((prev) => ({
        ...prev,
        toAdd: prev.toAdd.filter((id) => id !== teamId),
      }));
      setHasChanges(true);
      return;
    }

    const teamName = teams.find((team) => team.id === teamId)?.shortName ?? '';
    confirmDialog({
      title: t('playerManagement.teamAssociation.removeTitle'),
      description: t('playerManagement.teamAssociation.removeDescription', {
        team: teamName,
      }),
      variant: 'destructive',
      confirmText: t('playerManagement.teamAssociation.confirmRemove'),
      cancelText: t('playerManagement.teamAssociation.keepTeam'),
      onConfirm: () => {
        setPendingTeamChanges((prev) => ({
          ...prev,
          toRemove: prev.toRemove.includes(teamId)
            ? prev.toRemove
            : [...prev.toRemove, teamId],
        }));
        setHasChanges(true);
      },
    });
  };

  if (!player) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      ariaLabel={t('sharedDialogs.editPlayer', { name: player.userName })}
    >
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Fixed Header */}
        <div className="flex-shrink-0 p-4 sm:p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold truncate pr-4">
              {t('playerManagement.editPlayer.title', {
                name: player.userName,
              })}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isPending}
              className="h-8 w-8 p-0 flex-shrink-0"
              aria-label={tDialog('close')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
          {/* Player Status Toggle - MOVED TO TOP */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">
                  {t('playerManagement.editPlayer.status')}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {localIsActivePlayer
                    ? t('playerManagement.editPlayer.enabledDescription')
                    : t('playerManagement.editPlayer.disabledDescription')}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={handleToggleActivePlayer}
                disabled={isPending}
                aria-label={
                  localIsActivePlayer
                    ? t('playerManagement.editPlayer.disable')
                    : t('playerManagement.editPlayer.enable')
                }
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
                {localIsActivePlayer
                  ? t('playerManagement.editPlayer.enabled')
                  : t('playerManagement.editPlayer.disabled')}
              </Badge>
            </div>
          </div>

          {/* Player Ranking - MOVED BELOW STATUS */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm">
                  {t('playerManagement.editPlayer.rankings')}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('playerManagement.editPlayer.rankingsDescription')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block">
                    {t('playerManagement.editPlayer.singles')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    value={localSinglesRanking}
                    onChange={(e) =>
                      handleSinglesRankingChange(parseInt(e.target.value) || 0)
                    }
                    disabled={isPending}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0-5000"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('playerManagement.editPlayer.current', {
                      value: player?.singlesRanking || 0,
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">
                    {t('playerManagement.editPlayer.doubles')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    value={localDoublesRanking}
                    onChange={(e) =>
                      handleDoublesRankingChange(parseInt(e.target.value) || 0)
                    }
                    disabled={isPending}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0-5000"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('playerManagement.editPlayer.current', {
                      value: player?.doublesRanking || 0,
                    })}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {t('playerManagement.editPlayer.rankingGuidance')}
              </div>
            </div>
          </div>

          {/* Current Teams */}
          <div>
            <h4 className="font-medium mb-3 text-sm">
              {t('playerManagement.editPlayer.currentTeams')}
            </h4>
            <div className="space-y-2">
              {getCurrentTeams()
                .filter((aff) => aff.team)
                .map((affiliation) => (
                  <div
                    key={affiliation.team!.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-medium text-sm truncate">
                        {affiliation.team!.name}
                      </span>
                      {affiliation.role !== 'player' && (
                        <Badge
                          variant="outline"
                          className="text-xs whitespace-nowrap"
                        >
                          {affiliation.role}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTeam(affiliation.team!.id)}
                      aria-label={t(
                        'playerManagement.teamAssociation.removeTeam',
                        { team: affiliation.team!.name }
                      )}
                      disabled={isPending}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive flex-shrink-0 ml-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              {getCurrentTeams().length === 0 && (
                <p className="text-muted-foreground text-sm py-4 text-center bg-muted/20 rounded-lg">
                  {t('playerManagement.editPlayer.noTeams')}
                </p>
              )}
            </div>
          </div>

          {/* Add New Team */}
          {availableTeams.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 text-sm">
                {t('playerManagement.editPlayer.addToTeam')}
              </h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('playerManagement.editPlayer.selectTeam')}
                  </label>
                  <Select
                    value={selectedTeamId}
                    onValueChange={setSelectedTeamId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={t(
                          'playerManagement.editPlayer.selectTeamPlaceholder'
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTeams.map((team: Team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.shortName}{' '}
                          {team.matchLevel &&
                            `(${formatTeamClass(team.matchLevel)})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleAddTeam}
                  disabled={!selectedTeamId || isPending}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('playerManagement.editPlayer.addToTeam')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 p-4 sm:p-6 border-t bg-muted/20">
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isPending}
              className="min-w-[100px]"
            >
              {tDialog('cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || !hasChanges}
              className="min-w-[100px]"
            >
              {isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {t('playerManagement.editPlayer.saving')}
                </>
              ) : (
                t('playerManagement.editPlayer.save')
              )}
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDialog {...confirmProps} />
    </Modal>
  );
}
