'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@app/hooks/useAuth';
import { TeamService } from '@app/services/teamService';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Badge } from '@app/components/ui/badge';
import { Skeleton } from '@app/components/ui/skeleton';
import { SkeletonTeamCards } from '@app/components/ui/SkeletonTeamCard';
import CreateTeamModal from '@app/components/Dashboard/modals/CreateTeamModal';
import EditTeamModal from '@app/components/Dashboard/modals/EditTeamModal';
import GenderIcon from '@app/components/ui/GenderIcon';
import {
  Plus,
  Edit2,
  Trash2,
  Users
} from 'lucide-react';

/**
 * TeamCard Component - Displays a single team with real-time stats from backend
 */
const TeamCard = ({ team, isAdmin, onEdit, onDelete }: {
  team: any;
  isAdmin: boolean;
  onEdit: (team: any) => void;
  onDelete: (id: string) => void;
}) => {
  const t = useTranslations('dashboard.teamManagement');

  // Fetch real-time stats from backend (Player → User aggregation)
  const { data: stats, isLoading: statsLoading } = TeamService.useTeamStats(team.id);

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{team.name}</h3>
          </div>
          {isAdmin && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onEdit(team)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-500"
                onClick={() => onDelete(team.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Total Players */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{t('stats.totalPlayers')}</span>
            </div>
            {statsLoading ? (
              <Skeleton className="h-5 w-8" />
            ) : (
              <Badge variant="secondary" className="font-medium">
                {stats?.total || 0}
              </Badge>
            )}
          </div>

          {/* Gender Breakdown */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1.5">
                <GenderIcon gender="male" size="sm" />
                <span className="text-muted-foreground">{t('stats.male')}</span>
              </div>
              {statsLoading ? (
                <Skeleton className="h-4 w-8" />
              ) : (
                <span className="font-medium text-blue-600">{stats?.male || 0}</span>
              )}
            </div>
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1.5">
                <GenderIcon gender="female" size="sm" />
                <span className="text-muted-foreground">{t('stats.female')}</span>
              </div>
              {statsLoading ? (
                <Skeleton className="h-4 w-8" />
              ) : (
                <span className="font-medium text-pink-600">{stats?.female || 0}</span>
              )}
            </div>
          </div>

          {/* Match Level */}
          {team.matchLevel && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('stats.matchLevel')}</span>
              <Badge variant="outline" className="font-medium">
                {team.matchLevel}
              </Badge>
            </div>
          )}
        </div>
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
  const { user } = useAuth();

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);

  // Fetch teams using service hooks
  const { data: teams = [], isLoading: teamsLoading } = TeamService.useTeamList();
  const deleteTeamMutation = TeamService.useDeleteTeam();

  const isAdmin = user?.role === 'admin';

  const handleCreateTeam = () => {
    setShowCreateModal(true);
  };

  const handleEditTeam = (team: any) => {
    setSelectedTeam(team);
    setShowEditModal(true);
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await deleteTeamMutation.mutateAsync(teamId);
    } catch (error) {
      console.error('Failed to delete team:', error);
      alert(t('errors.deleteFailed'));
    }
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('title')}</CardTitle>
          {isAdmin && (
            <Button onClick={handleCreateTeam} variant="outline" size="sm" className='hover:bg-primary hover:text-primary-foreground'>
              <Plus className="mr-2 h-4 w-4" />
              {t('createTeam')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                isAdmin={isAdmin}
                onEdit={handleEditTeam}
                onDelete={handleDeleteTeam}
              />
            ))}
          </div>
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
    </div>
  );
}
