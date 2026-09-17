'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@app/hooks/useAuth';
import { TeamService } from '@app/services/teamService';
import { isAdmin as checkIsAdmin } from '@app/lib/access/permissions';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Badge } from '@app/components/ui/badge';
import { Skeleton } from '@app/components/ui/skeleton';
import { SkeletonTeamCards } from '@app/components/ui/SkeletonTeamCard';
import {
  ConfirmDialog,
  useConfirmDialog,
} from '@app/components/ui/confirm-dialog';
import CreateTeamModal from '@app/components/Dashboard/modals/CreateTeamModal';
import EditTeamModal from '@app/components/Dashboard/modals/EditTeamModal';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { formatTeamClass } from '@app/lib/teamClass';

/**
 * TeamCard Component - Displays a single team with real-time stats from backend
 */
const TeamCard = ({
  team,
  isAdmin,
  onEdit,
  onDelete,
}: {
  team: any;
  isAdmin: boolean;
  onEdit: (team: any) => void;
  onDelete: (id: string) => void;
}) => {
  const t = useTranslations('dashboard.teamManagement');

  // Fetch real-time stats from backend (Player → User aggregation)
  const statsQuery = TeamService.useTeamStats(team.id);
  const { data: stats, isLoading: statsLoading } = statsQuery;
  const composition = stats
    ? [
        { label: t('stats.male'), count: stats.male },
        { label: t('stats.female'), count: stats.female },
        { label: t('stats.nonBinary'), count: stats.nonBinary },
      ].filter(({ count }) => count > 0)
    : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-xl font-bold tracking-tight">
            <h3>{team.shortName}</h3>
          </CardTitle>
          {team.matchLevel && (
            <Badge variant="outline" className="font-medium">
              {formatTeamClass(team.matchLevel)}
            </Badge>
          )}
        </div>
        <CardDescription>{team.leagueTeamName}</CardDescription>
        {isAdmin && (
          <CardAction className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onEdit(team)}
              aria-label={t('editNamed', { name: team.shortName })}
            >
              <Edit2 className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive"
              onClick={() => onDelete(team.id)}
              aria-label={t('deleteNamed', { name: team.shortName })}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {statsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-5 w-40" />
          </div>
        ) : stats ? (
          <>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('stats.totalPlayers')}
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {stats.total}
              </p>
            </div>
            {composition.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                {composition.map(({ label, count }) => (
                  <span key={label}>
                    {label}{' '}
                    <span className="font-medium text-foreground tabular-nums">
                      {count}
                    </span>
                  </span>
                ))}
              </div>
            )}
            {statsQuery.isError && (
              <div
                role="status"
                className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
              >
                <p>{t('stats.refreshFailed')}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void statsQuery.refetch()}
                >
                  {t('retry')}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div
            role="status"
            className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
          >
            <p>{t('stats.unavailable')}</p>
            {statsQuery.isError && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void statsQuery.refetch()}
              >
                {t('retry')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * TeamManagementTab Component - Self-contained admin tab with data fetching
 *
 * Responsibilities:
 * - Fetch teams data
 * - Handle team CRUD operations
 *
 * Improvements:
 * - ✅ i18n consistency (no hardcoded strings)
 * - ✅ Skeleton loading states for better UX
 * - ✅ Server-side gender statistics with real User data
 * - 🔄 Create/Edit team modals (in progress)
 */
export default function TeamManagementTab() {
  const t = useTranslations('dashboard.teamManagement');
  const tDialog = useTranslations('dashboard.dialogActions');
  const { user } = useAuth();

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
  const { confirm: confirmDialog, confirmProps } = useConfirmDialog({
    confirmText: tDialog('confirm'),
    cancelText: tDialog('cancel'),
    pendingText: tDialog('processing'),
  });

  // Fetch teams using service hooks
  const teamsQuery = TeamService.useTeamList();
  const teams = teamsQuery.data ?? [];
  const teamsLoading = teamsQuery.isLoading;
  const deleteTeamMutation = TeamService.useDeleteTeam();

  const userIsAdmin = checkIsAdmin(user);

  const handleCreateTeam = () => {
    setShowCreateModal(true);
  };

  const handleEditTeam = (team: any) => {
    setSelectedTeam(team);
    setShowEditModal(true);
  };

  const handleDeleteTeam = (teamId: string) => {
    confirmDialog({
      title: t('confirmDelete'),
      description: t('confirmDelete'),
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteTeamMutation.mutateAsync(teamId);
        } catch {
          console.error('Team deletion failed');
          toast.error(t('errors.deleteFailed'));
        }
      },
    });
  };

  if (teamsLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
          </CardHeader>
        </Card>
        <SkeletonTeamCards count={6} />
      </div>
    );
  }

  if (teamsQuery.isError && !teamsQuery.data) {
    return (
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>{t('loadFailed')}</CardTitle>
          <Button
            type="button"
            variant="outline"
            onClick={() => void teamsQuery.refetch()}
          >
            {t('retry')}
          </Button>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <ConfirmDialog {...confirmProps} />
      {teamsQuery.isError && teamsQuery.data && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <span>{t('refreshFailed')}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void teamsQuery.refetch()}
          >
            {t('retry')}
          </Button>
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('title')}</CardTitle>
          {userIsAdmin && (
            <Button onClick={handleCreateTeam} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t('createTeam')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {t('placeholders.noTeams')}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  isAdmin={userIsAdmin}
                  onEdit={handleEditTeam}
                  onDelete={handleDeleteTeam}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateTeamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTeamCreated={() => setShowCreateModal(false)}
      />

      <EditTeamModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedTeam(null);
        }}
        onTeamUpdated={() => {
          setShowEditModal(false);
          setSelectedTeam(null);
        }}
        team={selectedTeam}
      />
    </>
  );
}
