'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@app/hooks/useAuth';
import { PlayerService } from '@app/services/playerService';
import { UserService } from '@app/services/userService';
import { isAdmin as checkIsAdmin } from '@app/lib/access/permissions';
import { TeamService } from '@app/services/teamService';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
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
  MoreHorizontal,
  Mail,
  User,
  UserPlus,
  Mars,
  Venus,
  Activity,
  Trash2,
  Download,
  UserRoundCheck,
} from 'lucide-react';
import {
  AccountKind,
  AccountOnboardingStatus,
  MembershipStatus,
  PlayerType,
} from '@club/shared-types/core/enums';
import type { Player, User as PersonUser } from '@app/lib/types';
import EditPlayerModal from '../modals/EditPlayerModal';
import EditMemberModal from '../modals/EditMemberModal';
import AddExternalPlayerModal from '../modals/AddExternalPlayerModal';
import { AccountSetupSummary } from '../AccountSetupSummary';
import { toast } from 'sonner';
import { downloadCsv } from '@app/lib/utils/csv';
import { formatTeamClass } from '@app/lib/teamClass';
import { PasswordRecoveryAction } from '../PasswordRecoveryAction';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@app/components/ui/dropdown-menu';

const MAX_PLAYER_BATCH_SIZE = 50;

const canConvertFormerMember = (player: Player) =>
  player.membershipStatus === MembershipStatus.INACTIVE &&
  player.type === PlayerType.MEMBER &&
  !player.isActivePlayer &&
  player.teamIds.length === 0;

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
  const t = useTranslations('dashboard.playerManagement');
  const tDialogs = useTranslations('dashboard.sharedDialogs');
  const setupReissue = useTranslations('common.setupReissue');
  const accountSetup = useTranslations('common.accountSetup');

  // Service hooks for mutations
  const batchUpdateMutation = PlayerService.useBatchUpdatePlayers();
  const lifecycleBatchMutation = PlayerService.useBatchPlayerLifecycle();
  const cleanupPlayerMutation = PlayerService.useCleanupPlayer();
  const convertFormerMemberMutation =
    PlayerService.useConvertFormerMemberToExternal();
  const reissueAccountSetupMutation = UserService.useReissueAccountSetup();

  // Local state for UI
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterGender, setFilterGender] = useState<'all' | 'male' | 'female'>(
    'all'
  );
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addExternalPlayerModalOpen, setAddExternalPlayerModalOpen] =
    useState(false);
  const [reissuingUserId, setReissuingUserId] = useState<string>();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [profileCorrectionPlayer, setProfileCorrectionPlayer] =
    useState<Player | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [selectedTeamForBatch, setSelectedTeamForBatch] = useState('');
  const [teamUpdateMode, setTeamUpdateMode] = useState<'add' | 'remove'>('add');
  const [showLifecycleModal, setShowLifecycleModal] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<
    'enable' | 'deactivate'
  >('enable');
  const [selectedLifecycleUserIds, setSelectedLifecycleUserIds] = useState<
    string[]
  >([]);
  const [lifecycleReason, setLifecycleReason] = useState('');
  const [cleanupTarget, setCleanupTarget] = useState<Player | null>(null);
  const [conversionTarget, setConversionTarget] = useState<Player | null>(null);
  const [conversionReason, setConversionReason] = useState('');
  const userIsAdmin = checkIsAdmin(user);

  // Fetch data using service hooks
  const playersQuery = PlayerService.usePlayerList();
  const teamsQuery = TeamService.useTeamList();
  const candidatesQuery = PlayerService.useLifecycleCandidates(userIsAdmin);
  const profileCorrectionQuery = UserService.useUserProfile(
    profileCorrectionPlayer?.userId ?? ''
  );
  const players = playersQuery.data ?? [];
  const teams = teamsQuery.data ?? [];
  const lifecycleCandidates = candidatesQuery.data ?? [];
  const playerBlockingError = playersQuery.isError && !playersQuery.data;
  const teamBlockingError = teamsQuery.isError && !teamsQuery.data;
  const candidateBlockingError =
    userIsAdmin && candidatesQuery.isError && !candidatesQuery.data;
  const teamFactsUnavailable =
    teamBlockingError || (teamsQuery.isLoading && !teamsQuery.data);
  const candidateFactsUnavailable =
    candidateBlockingError ||
    (userIsAdmin && candidatesQuery.isLoading && !candidatesQuery.data);

  const isLoading = playersQuery.isLoading;

  const handleEditPlayer = (player: Player) => {
    setSelectedPlayer(player);
    setEditModalOpen(true);
  };

  const handlePlayerUpdated = () => {
    // Data will be automatically refetched by React Query
    setEditModalOpen(false);
    setSelectedPlayer(null);
  };

  const handleReissueAccountSetup = async (userId: string) => {
    setReissuingUserId(userId);
    try {
      const result = await reissueAccountSetupMutation.mutateAsync(userId);
      if (result.deliveryStatus === 'sent') {
        toast.success(setupReissue('sent'));
      } else if (result.deliveryStatus === 'failed') {
        toast.error(setupReissue('failed'));
      } else {
        toast.warning(setupReissue('uncertain'));
      }
    } catch {
      toast.error(setupReissue('requestFailed'));
    } finally {
      setReissuingUserId(undefined);
    }
  };

  const handleSelectAll = () => {
    if (
      selectedPlayerIds.length === filteredPlayers.length &&
      filteredPlayers.length > 0
    ) {
      setSelectedPlayerIds([]);
    } else {
      if (filteredPlayers.length > MAX_PLAYER_BATCH_SIZE) {
        toast.info(t('batch.selectionLimited', { max: MAX_PLAYER_BATCH_SIZE }));
      }
      setSelectedPlayerIds(
        filteredPlayers.slice(0, MAX_PLAYER_BATCH_SIZE).map((p) => p.id)
      );
    }
  };

  const handleToggleSelect = (playerId: string) => {
    setSelectedPlayerIds((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId);
      if (prev.length >= MAX_PLAYER_BATCH_SIZE) {
        toast.warning(
          t('batch.selectionMaximum', { max: MAX_PLAYER_BATCH_SIZE })
        );
        return prev;
      }
      return [...prev, playerId];
    });
  };

  // Check selected players status for smart button states
  const selectedPlayers = players.filter((p) =>
    selectedPlayerIds.includes(p.id)
  );
  const selectedBatchTeam = teams.find(
    (team) => team.id === selectedTeamForBatch
  );
  const teamAssociationPlayers = selectedPlayers.filter((player) =>
    teamUpdateMode === 'add'
      ? !player.teamIds?.includes(selectedTeamForBatch)
      : player.teamIds?.includes(selectedTeamForBatch)
  );
  const hasActiveSelected = selectedPlayers.some((p) => p.isActivePlayer);
  const isBatchPending =
    batchUpdateMutation.isPending || lifecycleBatchMutation.isPending;

  const openLifecycleBatch = (action: 'enable' | 'deactivate') => {
    setLifecycleAction(action);
    setLifecycleReason('');
    setSelectedLifecycleUserIds(
      action === 'deactivate'
        ? selectedPlayers
            .filter((player) => player.isActivePlayer)
            .map((player) => player.userId)
        : []
    );
    setShowLifecycleModal(true);
  };

  const handleLifecycleBatch = async () => {
    if (!selectedLifecycleUserIds.length || !lifecycleReason.trim()) return;
    try {
      const result = await lifecycleBatchMutation.mutateAsync({
        request: {
          userIds: selectedLifecycleUserIds,
          action: lifecycleAction,
          reason: lifecycleReason,
        },
      });
      if (result.failureCount > 0) {
        toast.warning(
          t('lifecycle.partialResult', {
            completed: result.updatedCount,
            failed: result.failureCount,
          })
        );
      } else {
        toast.success(t('lifecycle.completed', { count: result.updatedCount }));
      }
      setSelectedPlayerIds([]);
      setShowLifecycleModal(false);
      setSelectedLifecycleUserIds([]);
      setLifecycleReason('');
    } catch {
      toast.error(t('lifecycle.failed'));
    }
  };

  const handleFormerMemberConversion = async () => {
    if (!conversionTarget || !conversionReason.trim()) return;
    try {
      await convertFormerMemberMutation.mutateAsync({
        id: conversionTarget.id,
        reason: conversionReason,
      });
      toast.success(t('formerMemberConversion.success'));
      setConversionTarget(null);
      setConversionReason('');
    } catch {
      toast.error(t('formerMemberConversion.failed'));
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
      const playerIdsToUpdate = teamAssociationPlayers.map(
        (player) => player.id
      );
      if (playerIdsToUpdate.length === 0) {
        toast.warning(
          t(
            teamUpdateMode === 'add'
              ? 'teamAssociation.noChangesAdd'
              : 'teamAssociation.noChangesRemove'
          )
        );
        return;
      }

      const result = await batchUpdateMutation.mutateAsync({
        playerIds: playerIdsToUpdate,
        updates:
          teamUpdateMode === 'add'
            ? { addToTeams: [selectedTeamForBatch] }
            : { removeFromTeams: [selectedTeamForBatch] },
      });

      toast.success(
        t(
          teamUpdateMode === 'add'
            ? 'teamAssociation.successAdd'
            : 'teamAssociation.successRemove',
          {
            count: result.updatedCount,
            team: selectedBatchTeam?.shortName ?? '',
          }
        )
      );
      setSelectedPlayerIds([]);
      setShowTeamModal(false);
      setSelectedTeamForBatch('');
    } catch (error: unknown) {
      const status =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof error.response === 'object' &&
        error.response !== null &&
        'status' in error.response
          ? error.response.status
          : undefined;
      toast.error(
        status === 409
          ? t('teamAssociation.conflict')
          : t('teamAssociation.failure')
      );
    }
  };

  const handleBatchUpdateRanking = async () => {
    if (selectedPlayerIds.length === 0) return;
    setShowRankingModal(true);
  };
  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.userName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesTeamFilter =
      filterTeam === 'all' || player.teamIds?.includes(filterTeam);

    const matchesGenderFilter =
      filterGender === 'all' || player.userGender === filterGender;

    const matchesStatusFilter =
      filterStatus === 'all' ||
      (filterStatus === 'active' && player.isEffectivelyEligible) ||
      (filterStatus === 'inactive' && !player.isEffectivelyEligible);

    return (
      matchesSearch &&
      matchesTeamFilter &&
      matchesGenderFilter &&
      matchesStatusFilter
    );
  });

  // Calculate counts for filters
  const allPlayersCount = players.length;
  const maleCount = players.filter((p) => p.userGender === 'male').length;
  const femaleCount = players.filter((p) => p.userGender === 'female').length;
  const activeCount = players.filter((p) => p.isEffectivelyEligible).length;
  const inactiveCount = players.filter((p) => !p.isEffectivelyEligible).length;
  const lifecycleActionCandidates =
    lifecycleAction === 'enable'
      ? lifecycleCandidates.filter(
          (candidate) => !candidate.isParticipationEnabled
        )
      : players
          .filter((player) => player.isActivePlayer)
          .map((player) => ({
            userId: player.userId,
            userName: player.userName,
            playerId: player.id,
            isParticipationEnabled: true,
          }));

  // Calculate team counts
  const teamCounts = teams.reduce(
    (acc, team) => {
      acc[team.id] = players.filter((p) => p.teamIds?.includes(team.id)).length;
      return acc;
    },
    {} as Record<string, number>
  );

  const handleTeamRosterExport = () => {
    if (filterTeam === 'all') return;
    const team = teams.find((candidate) => candidate.id === filterTeam);
    const roster = players.filter(
      (player) =>
        player.teamIds.includes(filterTeam) && player.isEffectivelyEligible
    );
    const date = new Date().toISOString().slice(0, 10);
    const exported = downloadCsv({
      filename: `team_roster_${team?.shortName ?? filterTeam}_${date}.csv`,
      rows: roster,
      columns: [
        { header: 'Name', value: (player) => player.userName },
        { header: 'Gender', value: (player) => player.userGender },
        { header: 'Player type', value: (player) => player.type },
        { header: 'Singles ranking', value: (player) => player.singlesRanking },
        { header: 'Doubles ranking', value: (player) => player.doublesRanking },
      ],
    });
    if (exported) toast.success(t('teamRosterExport.success'));
    else toast.warning(t('teamRosterExport.empty'));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">{t('loading')}</div>
      </div>
    );
  }

  if (playerBlockingError) {
    return (
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>{t('remoteState.playersLoadFailed')}</CardTitle>
          <Button
            type="button"
            variant="outline"
            onClick={() => void playersQuery.refetch()}
          >
            {t('remoteState.retry')}
          </Button>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="pb-24">
      {playersQuery.isError && playersQuery.data && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <span>{t('remoteState.playersRefreshFailed')}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void playersQuery.refetch()}
          >
            {t('remoteState.retry')}
          </Button>
        </div>
      )}
      {teamsQuery.isLoading && !teamsQuery.data && (
        <div
          role="status"
          className="mb-4 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground"
        >
          {t('remoteState.teamsLoading')}
        </div>
      )}
      {userIsAdmin && candidatesQuery.isLoading && !candidatesQuery.data && (
        <div
          role="status"
          className="mb-4 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground"
        >
          {t('remoteState.candidatesLoading')}
        </div>
      )}
      {teamsQuery.isError && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <span>
            {teamsQuery.data
              ? t('remoteState.teamsRefreshFailed')
              : t('remoteState.teamsLoadFailed')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void teamsQuery.refetch()}
          >
            {t('remoteState.retry')}
          </Button>
        </div>
      )}
      {userIsAdmin && candidatesQuery.isError && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <span>
            {candidatesQuery.data
              ? t('remoteState.candidatesRefreshFailed')
              : t('remoteState.candidatesLoadFailed')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void candidatesQuery.refetch()}
          >
            {t('remoteState.retry')}
          </Button>
        </div>
      )}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t('title')}</CardTitle>
            {userIsAdmin && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => openLifecycleBatch('enable')}
                  disabled={candidateFactsUnavailable}
                >
                  <Activity className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('lifecycle.title')}
                </Button>
                <Button onClick={() => setAddExternalPlayerModalOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('addExternalPlayer')}
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-4 mt-4">
            {/* Search and Team Filter Row */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={filterTeam}
                onValueChange={setFilterTeam}
                disabled={teamFactsUnavailable}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue
                    placeholder={t('allTeams', { count: allPlayersCount })}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('allTeams', { count: allPlayersCount })}
                  </SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.shortName} ({teamCounts[team.id] || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {userIsAdmin && filterTeam !== 'all' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTeamRosterExport}
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('teamRosterExport.action')}
                </Button>
              )}
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
                  {t('filters.all', { count: allPlayersCount })}
                </Button>
                <Button
                  variant={filterGender === 'male' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterGender('male')}
                  className="h-7 text-xs"
                >
                  {t('filters.male', { count: maleCount })}
                </Button>
                <Button
                  variant={filterGender === 'female' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterGender('female')}
                  className="h-7 text-xs"
                >
                  {t('filters.female', { count: femaleCount })}
                </Button>
              </div>

              <div className="flex gap-1 border rounded-lg p-1">
                <Button
                  variant={filterStatus === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterStatus('all')}
                  className="h-7 text-xs"
                >
                  {t('filters.allStatus')}
                </Button>
                <Button
                  variant={filterStatus === 'active' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterStatus('active')}
                  className="h-7 text-xs"
                >
                  {t('filters.active', { count: activeCount })}
                </Button>
                <Button
                  variant={filterStatus === 'inactive' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterStatus('inactive')}
                  className="h-7 text-xs"
                >
                  {t('filters.inactive', { count: inactiveCount })}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="divide-y sm:hidden" data-testid="mobile-players-list">
            {userIsAdmin && filteredPlayers.length > 0 && (
              <label className="flex min-w-0 items-center gap-3 px-4 pb-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={
                    selectedPlayerIds.length === filteredPlayers.length &&
                    filteredPlayers.length > 0
                  }
                  onChange={handleSelectAll}
                  disabled={isBatchPending}
                  className="h-4 w-4 shrink-0 cursor-pointer"
                />
                <span className="min-w-0 break-words">
                  {t('batch.selectAll')}
                </span>
              </label>
            )}
            {filteredPlayers.map((player) => {
              const playerTeams = player.teamIds
                .map((teamId) => teams.find((team) => team.id === teamId))
                .filter((team) => team !== undefined);
              const showNoTeams =
                !teamFactsUnavailable && player.teamIds.length === 0;
              const accountSetupSummary = player.accountSetup;
              const accountSetupNeedsAttention =
                accountSetupSummary &&
                accountSetupSummary.accountOnboardingStatus !==
                  AccountOnboardingStatus.READY;

              return (
                <div
                  key={player.id}
                  className="flex min-w-0 items-start gap-3 px-4 py-4"
                >
                  {userIsAdmin && (
                    <input
                      type="checkbox"
                      checked={selectedPlayerIds.includes(player.id)}
                      onChange={() => handleToggleSelect(player.id)}
                      disabled={isBatchPending}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer"
                      aria-label={t('batch.selectPlayer', {
                        name: player.userName,
                      })}
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex min-w-0 items-start gap-2">
                      {player.userGender === 'male' ? (
                        <div
                          className="mt-0.5 shrink-0"
                          title={t('genderTitles.male')}
                        >
                          <Mars className="h-4 w-4 text-blue-600" />
                        </div>
                      ) : player.userGender === 'female' ? (
                        <div
                          className="mt-0.5 shrink-0"
                          title={t('genderTitles.female')}
                        >
                          <Venus className="h-4 w-4 text-pink-600" />
                        </div>
                      ) : (
                        <div
                          className="mt-0.5 shrink-0"
                          title={t('genderTitles.unknown')}
                        >
                          <User className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                      <span className="min-w-0 break-words font-medium leading-5">
                        {player.userName}
                      </span>
                    </div>
                    {(playerTeams.length > 0 || showNoTeams) && (
                      <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        {playerTeams.map((team) => (
                          <span key={team.id} className="break-words">
                            {team.shortName}
                          </span>
                        ))}
                        {showNoTeams && <span>{t('editPlayer.noTeams')}</span>}
                      </div>
                    )}
                    {!player.isActivePlayer && (
                      <Badge variant="secondary" className="whitespace-normal">
                        {t('lifecycle.participationEnded')}
                      </Badge>
                    )}
                    {userIsAdmin && accountSetupNeedsAttention && (
                      <AccountSetupSummary
                        summary={accountSetupSummary}
                        accountName={player.userName}
                        onReissue={handleReissueAccountSetup}
                        isReissuing={
                          reissuingUserId === accountSetupSummary.userId
                        }
                        isReissueDisabled={Boolean(reissuingUserId)}
                        presentation="compact-status"
                      />
                    )}
                  </div>
                  {userIsAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0"
                          aria-label={t('mobile.actionsFor', {
                            name: player.userName,
                          })}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => handleEditPlayer(player)}
                          disabled={teamFactsUnavailable}
                        >
                          <Edit2 aria-hidden="true" />
                          {t('editTeams')}
                        </DropdownMenuItem>
                        {accountSetupSummary?.reissueAvailable && (
                          <DropdownMenuItem
                            onSelect={() =>
                              void handleReissueAccountSetup(
                                accountSetupSummary.userId
                              )
                            }
                            disabled={Boolean(reissuingUserId)}
                          >
                            <Mail aria-hidden="true" />
                            {accountSetup(
                              reissuingUserId === accountSetupSummary.userId
                                ? 'reissuing'
                                : 'reissue'
                            )}
                          </DropdownMenuItem>
                        )}
                        {player.type === PlayerType.EXTERNAL &&
                          player.passwordRecoveryAvailable && (
                            <PasswordRecoveryAction
                              userId={player.userId}
                              accountName={player.userName}
                              presentation="menu"
                            />
                          )}
                        {player.type === PlayerType.EXTERNAL && (
                          <DropdownMenuItem
                            onSelect={() => setProfileCorrectionPlayer(player)}
                          >
                            <User aria-hidden="true" />
                            {t('correctProfile')}
                          </DropdownMenuItem>
                        )}
                        {!player.isActivePlayer && (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setCleanupTarget(player)}
                          >
                            <Trash2 aria-hidden="true" />
                            {t('cleanup.action')}
                          </DropdownMenuItem>
                        )}
                        {canConvertFormerMember(player) && (
                          <DropdownMenuItem
                            onSelect={() => {
                              setConversionTarget(player);
                              setConversionReason('');
                            }}
                          >
                            <UserRoundCheck aria-hidden="true" />
                            {t('formerMemberConversion.action')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  {userIsAdmin && (
                    <th className="text-left p-2 font-medium text-muted-foreground w-12">
                      <input
                        type="checkbox"
                        checked={
                          selectedPlayerIds.length === filteredPlayers.length &&
                          filteredPlayers.length > 0
                        }
                        onChange={handleSelectAll}
                        disabled={isBatchPending}
                        className="cursor-pointer h-4 w-4"
                        aria-label={t('batch.selectAll')}
                      />
                    </th>
                  )}
                  <th className="text-left p-2 font-medium text-muted-foreground w-12">
                    #
                  </th>
                  <th className="text-left p-2 font-medium text-muted-foreground">
                    {t('columns.name')}
                  </th>
                  <th className="text-left p-2 font-medium text-muted-foreground hidden sm:table-cell">
                    {t('columns.ranking')}
                  </th>
                  <th className="text-left p-2 font-medium text-muted-foreground hidden sm:table-cell">
                    {t('columns.status')}
                  </th>
                  <th className="text-left p-2 font-medium text-muted-foreground">
                    {t('columns.teams')}
                  </th>
                  {userIsAdmin && (
                    <>
                      <th className="text-left p-2 font-medium text-muted-foreground">
                        {t('accountSetup')}
                      </th>
                      <th className="text-left p-2 font-medium text-muted-foreground">
                        {t('columns.actions')}
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player, index) => (
                  <tr key={player.id} className="border-b hover:bg-muted/50">
                    {userIsAdmin && (
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedPlayerIds.includes(player.id)}
                          onChange={() => handleToggleSelect(player.id)}
                          disabled={isBatchPending}
                          className="cursor-pointer h-4 w-4"
                          aria-label={t('batch.selectPlayer', {
                            name: player.userName,
                          })}
                        />
                      </td>
                    )}
                    <td className="p-2 text-sm text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {player.userGender === 'male' ? (
                          <div title={t('genderTitles.male')}>
                            <Mars className="h-4 w-4 text-blue-600" />
                          </div>
                        ) : player.userGender === 'female' ? (
                          <div title={t('genderTitles.female')}>
                            <Venus className="h-4 w-4 text-pink-600" />
                          </div>
                        ) : (
                          <div title={t('genderTitles.unknown')}>
                            <User className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <span className="font-medium">{player.userName}</span>
                      </div>
                    </td>
                    <td className="p-2 text-sm hidden sm:table-cell">
                      {player.rankingDisplay ||
                        `${player.singlesRanking || 0}/${player.doublesRanking || 0}`}
                    </td>
                    <td className="p-2 hidden sm:table-cell">
                      <Badge
                        variant={
                          player.isActivePlayer ? 'default' : 'secondary'
                        }
                        className={player.isActivePlayer ? 'bg-green-600' : ''}
                      >
                        {player.isActivePlayer
                          ? t('lifecycle.participationEnabled')
                          : t('lifecycle.participationEnded')}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="space-y-1">
                        {player.teamIds?.map((teamId) => {
                          const team = teams.find((t) => t.id === teamId);
                          return team ? (
                            <div key={teamId} className="text-sm">
                              <span className="font-medium">
                                {team.shortName}
                              </span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </td>
                    {userIsAdmin && (
                      <>
                        <td className="p-2">
                          {player.accountSetup && (
                            <AccountSetupSummary
                              summary={player.accountSetup}
                              accountName={player.userName}
                              onReissue={handleReissueAccountSetup}
                              isReissuing={
                                reissuingUserId === player.accountSetup.userId
                              }
                              isReissueDisabled={Boolean(reissuingUserId)}
                            />
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            {player.type === PlayerType.EXTERNAL &&
                              player.passwordRecoveryAvailable && (
                                <PasswordRecoveryAction
                                  userId={player.userId}
                                  accountName={player.userName}
                                />
                              )}
                            {player.type === PlayerType.EXTERNAL && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setProfileCorrectionPlayer(player)
                                }
                                className="h-8 w-8 p-0"
                                title={t('correctProfile')}
                                aria-label={t('correctProfileForPlayer', {
                                  name: player.userName,
                                })}
                              >
                                <User className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPlayer(player)}
                              disabled={teamFactsUnavailable}
                              className="h-8 w-8 p-0"
                              title={t('editTeams')}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            {!player.isActivePlayer && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCleanupTarget(player)}
                                className="h-8 w-8 p-0 text-destructive"
                                title={t('cleanup.action')}
                                aria-label={t('cleanup.actionForPlayer', {
                                  name: player.userName,
                                })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canConvertFormerMember(player) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setConversionTarget(player);
                                  setConversionReason('');
                                }}
                                className="h-8 w-8 p-0"
                                title={t('formerMemberConversion.action')}
                                aria-label={t(
                                  'formerMemberConversion.actionForPlayer',
                                  { name: player.userName }
                                )}
                              >
                                <UserRoundCheck className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </>
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

      {profileCorrectionPlayer &&
        profileCorrectionQuery.data?.accountKind === AccountKind.PERSON && (
          <EditMemberModal
            isOpen
            profileOnly
            member={profileCorrectionQuery.data as PersonUser}
            onClose={() => setProfileCorrectionPlayer(null)}
            onMemberUpdated={() => undefined}
          />
        )}

      <Modal
        isOpen={
          Boolean(profileCorrectionPlayer) &&
          profileCorrectionQuery.data?.accountKind !== AccountKind.PERSON
        }
        ariaLabel={t('correctProfile')}
        onClose={() => setProfileCorrectionPlayer(null)}
      >
        <div className="w-full max-w-md space-y-4 rounded-lg bg-background p-6">
          <h2 className="text-lg font-semibold">{t('correctProfile')}</h2>
          {profileCorrectionQuery.isError ? (
            <>
              <p role="alert" className="text-sm text-muted-foreground">
                {t('profileLoadFailed')}
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setProfileCorrectionPlayer(null)}
                >
                  {tDialogs('cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={() => void profileCorrectionQuery.refetch()}
                >
                  {t('remoteState.retry')}
                </Button>
              </div>
            </>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              {t('profileLoading')}
            </p>
          )}
        </div>
      </Modal>

      <AddExternalPlayerModal
        isOpen={addExternalPlayerModalOpen}
        onClose={() => setAddExternalPlayerModalOpen(false)}
      />

      <Modal
        isOpen={showLifecycleModal}
        ariaLabel={t('lifecycle.title')}
        onClose={() => {
          if (!lifecycleBatchMutation.isPending) setShowLifecycleModal(false);
        }}
      >
        <div className="w-full max-w-2xl space-y-4 rounded-lg bg-background p-6">
          <div>
            <h3 className="text-lg font-semibold">{t('lifecycle.title')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('lifecycle.description')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={lifecycleAction === 'enable' ? 'default' : 'outline'}
              aria-pressed={lifecycleAction === 'enable'}
              onClick={() => {
                setLifecycleAction('enable');
                setSelectedLifecycleUserIds([]);
              }}
            >
              {t('lifecycle.enable')}
            </Button>
            <Button
              type="button"
              variant={lifecycleAction === 'deactivate' ? 'default' : 'outline'}
              aria-pressed={lifecycleAction === 'deactivate'}
              onClick={() => {
                setLifecycleAction('deactivate');
                setSelectedLifecycleUserIds([]);
              }}
            >
              {t('lifecycle.deactivate')}
            </Button>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
            {lifecycleActionCandidates.map((candidate) => (
              <label
                key={candidate.userId}
                className="flex items-start gap-3 rounded p-2 hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={selectedLifecycleUserIds.includes(candidate.userId)}
                  onChange={() =>
                    setSelectedLifecycleUserIds((current) =>
                      current.includes(candidate.userId)
                        ? current.filter(
                            (userId) => userId !== candidate.userId
                          )
                        : current.length < MAX_PLAYER_BATCH_SIZE
                          ? [...current, candidate.userId]
                          : current
                    )
                  }
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block font-medium">
                    {candidate.userName}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {candidate.playerId
                      ? candidate.isParticipationEnabled
                        ? t('lifecycle.participationEnabled')
                        : t('lifecycle.playerExistsParticipationEnded')
                      : t('lifecycle.noPlayerIdentityYet')}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <label className="block space-y-1 text-sm font-medium">
            {t('lifecycle.reasonLabel')}
            <Input
              value={lifecycleReason}
              onChange={(event) => setLifecycleReason(event.target.value)}
              maxLength={500}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={lifecycleBatchMutation.isPending}
              onClick={() => setShowLifecycleModal(false)}
            >
              {t('lifecycle.cancel')}
            </Button>
            <Button
              disabled={
                lifecycleBatchMutation.isPending ||
                selectedLifecycleUserIds.length === 0 ||
                !lifecycleReason.trim()
              }
              onClick={() => void handleLifecycleBatch()}
            >
              {lifecycleBatchMutation.isPending
                ? t('lifecycle.applying')
                : t('lifecycle.applyTo', {
                    count: selectedLifecycleUserIds.length,
                  })}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(cleanupTarget)}
        ariaLabel={t('cleanup.title')}
        onClose={() => {
          if (!cleanupPlayerMutation.isPending) setCleanupTarget(null);
        }}
      >
        <div className="w-full max-w-md space-y-4 rounded-lg bg-background p-6">
          <h3 className="text-lg font-semibold">{t('cleanup.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t.rich('cleanup.description', {
              name: cleanupTarget?.userName ?? '',
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={cleanupPlayerMutation.isPending}
              onClick={() => setCleanupTarget(null)}
            >
              {t('cleanup.keep')}
            </Button>
            <Button
              variant="destructive"
              disabled={cleanupPlayerMutation.isPending || !cleanupTarget}
              onClick={() => {
                if (!cleanupTarget) return;
                void cleanupPlayerMutation
                  .mutateAsync({
                    id: cleanupTarget.id,
                    reason: 'Administrative physical Player cleanup',
                  })
                  .then(() => {
                    toast.success(t('cleanup.success'));
                    setCleanupTarget(null);
                  })
                  .catch(() => toast.error(t('cleanup.failed')));
              }}
            >
              {t('cleanup.confirm')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(conversionTarget)}
        ariaLabel={t('formerMemberConversion.title')}
        onClose={() => {
          if (!convertFormerMemberMutation.isPending) {
            setConversionTarget(null);
            setConversionReason('');
          }
        }}
      >
        <div className="w-full max-w-md space-y-4 rounded-lg bg-background p-6">
          <div>
            <h3 className="text-lg font-semibold">
              {t('formerMemberConversion.title')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t.rich('formerMemberConversion.description', {
                name: conversionTarget?.userName ?? '',
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
          </div>
          <label className="block space-y-1 text-sm font-medium">
            {t('formerMemberConversion.reasonLabel')}
            <Input
              value={conversionReason}
              onChange={(event) => setConversionReason(event.target.value)}
              maxLength={500}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={convertFormerMemberMutation.isPending}
              onClick={() => {
                setConversionTarget(null);
                setConversionReason('');
              }}
            >
              {t('formerMemberConversion.cancel')}
            </Button>
            <Button
              disabled={
                convertFormerMemberMutation.isPending ||
                !conversionReason.trim()
              }
              onClick={() => void handleFormerMemberConversion()}
            >
              {convertFormerMemberMutation.isPending
                ? t('formerMemberConversion.applying')
                : t('formerMemberConversion.confirm')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Actions Toolbar */}
      {userIsAdmin && selectedPlayerIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground p-3 rounded-lg shadow-2xl z-50 w-[calc(100vw-2rem)] sm:w-[90vw] max-w-4xl">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-xs sm:text-sm text-center">
              {t('batch.selected', { count: selectedPlayerIds.length })}
            </span>
            <div className="flex flex-wrap gap-1 sm:gap-2 justify-center">
              {hasActiveSelected && (
                <Button
                  onClick={() => openLifecycleBatch('deactivate')}
                  disabled={isBatchPending}
                  variant="secondary"
                  size="sm"
                  className="text-xs px-2 py-1 h-7 sm:h-8 whitespace-nowrap"
                  title={t('lifecycle.deactivate')}
                >
                  {t('lifecycle.deactivate')}
                </Button>
              )}
              <Button
                onClick={handleBatchUpdateTeam}
                disabled={isBatchPending || teamFactsUnavailable}
                variant="secondary"
                size="sm"
                className="text-xs px-2 py-1 h-7 sm:h-8 whitespace-nowrap"
              >
                Update Teams
              </Button>
              <Button
                onClick={handleBatchUpdateRanking}
                disabled={isBatchPending}
                variant="secondary"
                size="sm"
                className="text-xs px-2 py-1 h-7 sm:h-8 whitespace-nowrap"
              >
                Update Ranking
              </Button>
              <Button
                onClick={() => setSelectedPlayerIds([])}
                disabled={isBatchPending}
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
      <Modal
        isOpen={showTeamModal}
        ariaLabel={t('teamAssociation.title')}
        onClose={() => {
          if (!isBatchPending) setShowTeamModal(false);
        }}
      >
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-4">
            {t('teamAssociation.title')}
          </h3>

          {/* Mode Selection */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">
              {t('teamAssociation.action')}
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={teamUpdateMode === 'add' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTeamUpdateMode('add')}
                disabled={isBatchPending}
                className="flex-1"
              >
                {t('teamAssociation.add')}
              </Button>
              <Button
                type="button"
                variant={teamUpdateMode === 'remove' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTeamUpdateMode('remove')}
                disabled={isBatchPending}
                className="flex-1"
              >
                {t('teamAssociation.remove')}
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            {t('teamAssociation.selectionSummary', {
              count: selectedPlayerIds.length,
              max: MAX_PLAYER_BATCH_SIZE,
            })}
          </p>
          <Select
            value={selectedTeamForBatch}
            onValueChange={setSelectedTeamForBatch}
            disabled={isBatchPending}
          >
            <SelectTrigger className="w-full mb-4">
              <SelectValue placeholder={t('teamAssociation.selectTeam')} />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.shortName}{' '}
                  {team.matchLevel && `(${formatTeamClass(team.matchLevel)})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedBatchTeam && (
            <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm">
              <p>
                <span className="font-medium">
                  {t('teamAssociation.selectedTeam')}:
                </span>{' '}
                {selectedBatchTeam.shortName}
              </p>
              <p>
                <span className="font-medium">
                  {t('teamAssociation.mode')}:
                </span>{' '}
                {t(
                  teamUpdateMode === 'add'
                    ? 'teamAssociation.add'
                    : 'teamAssociation.remove'
                )}
              </p>
              <p>
                <span className="font-medium">
                  {t('teamAssociation.affectedCount')}:
                </span>{' '}
                {teamAssociationPlayers.length}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={isBatchPending}
              onClick={() => {
                setShowTeamModal(false);
                setSelectedTeamForBatch('');
              }}
            >
              {t('teamAssociation.cancel')}
            </Button>
            <Button
              onClick={handleConfirmUpdateTeam}
              disabled={!selectedTeamForBatch || isBatchPending}
            >
              {isBatchPending
                ? t('teamAssociation.pending')
                : t(
                    teamUpdateMode === 'add'
                      ? 'teamAssociation.confirmAdd'
                      : 'teamAssociation.confirmRemove'
                  )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Individual Ranking Modal */}
      <Modal
        isOpen={showRankingModal}
        ariaLabel={tDialogs('updatePlayerRankings')}
        onClose={() => setShowRankingModal(false)}
      >
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">
            {t('rankingModal.title')}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('rankingModal.description')}
          </p>
          <div className="space-y-3 mb-4">
            {selectedPlayers.map((player) => (
              <div key={player.id} className="p-3 border rounded-lg">
                <div className="font-medium mb-2">{player.userName}</div>
                <div className="text-xs text-muted-foreground mb-3">
                  {t('rankingModal.current', {
                    singles: player.singlesRanking || 0,
                    doubles: player.doublesRanking || 0,
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      {t('rankingModal.singles')}
                    </label>
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
                    <label className="text-xs font-medium mb-1 block">
                      {t('rankingModal.doubles')}
                    </label>
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
              {t('rankingModal.cancel')}
            </Button>
            <Button
              onClick={async () => {
                try {
                  // Update each player individually using Service hook
                  for (const player of selectedPlayers) {
                    const singlesInput = document.getElementById(
                      `singles-ranking-${player.id}`
                    ) as HTMLInputElement;
                    const doublesInput = document.getElementById(
                      `doubles-ranking-${player.id}`
                    ) as HTMLInputElement;
                    const newSinglesRanking = parseInt(singlesInput.value) || 0;
                    const newDoublesRanking = parseInt(doublesInput.value) || 0;
                    if (
                      newSinglesRanking !== player.singlesRanking ||
                      newDoublesRanking !== player.doublesRanking
                    ) {
                      await batchUpdateMutation.mutateAsync({
                        playerIds: [player.id],
                        updates: {
                          singlesRanking: newSinglesRanking,
                          doublesRanking: newDoublesRanking,
                        },
                      });
                    }
                  }
                  setSelectedPlayerIds([]);
                  setShowRankingModal(false);
                  // Note: Cache invalidation handled automatically by Service hook
                } catch {
                  console.error('Batch ranking update failed');
                  toast.error(t('rankingModal.failed'));
                }
              }}
            >
              {t('rankingModal.submit')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
