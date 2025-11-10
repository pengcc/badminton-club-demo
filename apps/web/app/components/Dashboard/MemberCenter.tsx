'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Badge } from '@app/components/ui/badge';
import { Input } from '@app/components/ui/input';
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Mail,
  Trash2,
  Settings
} from 'lucide-react';
import { UserService } from '@app/services/userService';
import { getMembershipStatusBadgeProps, getUserRoleBadgeProps } from '@app/lib/utils/badge-utils';
import AddMemberModal from './modals/AddMemberModal';
import EditMemberModal from './modals/EditMemberModal';
import BatchUpdateMembersModal from './modals/BatchUpdateMembersModal';
import type { User } from '@app/lib/types';
import { UserRole } from '@club/shared-types/core/enums';

export default function MemberCenter() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, active, inactive, players, admins

  // Use service hook - returns UserCard[] with computed display fields
  const { data: members, isLoading } = UserService.useUserList({ limit: 100 });

  // React Query mutations for proper cache invalidation
  const deleteUserMutation = UserService.useDeleteUser();
  const batchUpdateMutation = UserService.useBatchUpdate();

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    players: 0,
    admins: 0
  });

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [batchUpdateModalOpen, setBatchUpdateModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);

  // Calculate stats when members change
  useEffect(() => {
    if (members && members.length > 0) {
      updateStats(members);
    }
  }, [members]);

  // Memoize filtered members for performance
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    return members.filter(member => {
      const matchesSearch =
        member.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter = (() => {
        switch (filterType) {
          case 'active':
            return member.membershipStatus === 'active';
          case 'inactive':
            return member.membershipStatus !== 'active';
          case 'players':
            return member.isPlayer;
          case 'admins':
            return member.role === 'admin';
          default:
            return true;
        }
      })();

      return matchesSearch && matchesFilter;
    });
  }, [members, searchTerm, filterType]);

  // Memoize callback functions for performance
  const handleSendEmail = useCallback(async (_memberId: string) => {
    try {
      // In real app, call API to send invitation email
      alert('Invitation email sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    }
  }, []);

  const handleEditMember = useCallback((member: User) => {
    setSelectedMember(member);
    setEditModalOpen(true);
  }, []);

  const handleDeleteMember = useCallback(async (member: User) => {
    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete ${member.fullName}? This action cannot be undone.${member.isPlayer ? '\n\nNote: This will also remove their player profile.' : ''}`
    );

    if (!confirmed) return;

    try {
      // Use React Query mutation for proper cache invalidation
      await deleteUserMutation.mutateAsync(member.id);

      alert(`Member ${member.fullName} has been deleted successfully.`);
    } catch (error: any) {
      console.error('Error deleting member:', error);
      alert(`Failed to delete member: ${error.response?.data?.message || error.message || 'Unknown error'}`);
    }
  }, [deleteUserMutation]);  const handleAddMember = useCallback(() => {
    setAddModalOpen(true);
  }, []);

  const handleMemberAdded = useCallback(() => {
    // Cache is automatically invalidated by the mutation in AddMemberModal
    // Show success message
    alert('Member added successfully!');
  }, []);

  const handleBatchUpdate = async (selectedMemberIds: string[], updateData: any) => {
    try {
      // Use React Query mutation for proper cache invalidation
      const response = await batchUpdateMutation.mutateAsync({
        userIds: selectedMemberIds,
        updateData
      });

      alert(`Successfully updated ${response.modifiedCount || selectedMemberIds.length} members!`);
    } catch (error: any) {
      console.error('Error in batch update:', error);
      throw new Error(error.response?.data?.message || 'Failed to update members');
    }
  };

  const handleMemberUpdated = () => {
    // Cache is automatically invalidated by the mutation in EditMemberModal
    // No need to manually refetch
  };

  const updateStats = (membersData: User[]) => {
    setStats({
      total: membersData.length,
      active: membersData.filter(m => m.membershipStatus === 'active').length,
      inactive: membersData.filter(m => m.membershipStatus !== 'active').length,
      players: membersData.filter(m => m.isPlayer).length,
      admins: membersData.filter(m => m.role === 'admin').length
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Member Management Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Member Management
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBatchUpdateModalOpen(true)}
                className="hover:bg-primary hover:text-primary-foreground min-w-0"
              >
                <Settings className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Batch Update</span>
                <span className="sm:hidden">Batch</span>
              </Button>
              <Button variant="outline" size="sm" className='hover:bg-primary hover:text-primary-foreground  min-w-0' onClick={handleAddMember}>
                <UserPlus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Add Member</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('all')}
                className="text-xs px-2 py-1 hover:bg-primary hover:text-primary-foreground"
              >
                All ({stats.total})
              </Button>
              <Button
                variant={filterType === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('active')}
                className="text-xs px-2 py-1 hover:bg-primary hover:text-primary-foreground"
              >
                Active ({stats.active})
              </Button>
              <Button
                variant={filterType === 'inactive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('inactive')}
                className="text-xs px-2 py-1 hover:bg-primary hover:text-primary-foreground"
              >
                Inactive ({stats.inactive})
              </Button>
              <Button
                variant={filterType === 'players' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('players')}
                className="text-xs px-2 py-1 hover:bg-primary hover:text-primary-foreground"
              >
                Players ({stats.players})
              </Button>
              <Button
                variant={filterType === 'admins' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('admins')}
                className="text-xs px-2 py-1 hover:bg-primary hover:text-primary-foreground"
              >
                Admins ({stats.admins})
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Desktop Table View (1280px+) */}
          <div className="hidden xl:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">#</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Email</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Gender</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Birthday</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Player</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Role</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Invited</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member, index) => (
                  <tr key={member.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 text-sm text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="p-2">
                      <div className="font-medium">
                        {member.fullName}
                      </div>
                    </td>
                    <td className="p-2 text-sm text-muted-foreground">
                      {member.email}
                    </td>
                    <td className="p-2">
                      <span className="capitalize text-sm">{member.gender || 'Not specified'}</span>
                    </td>
                    <td className="p-2 text-sm">
                      {member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString() : 'Not provided'}
                    </td>
                    <td className="p-2">
                      {(() => {
                        const badgeProps = getMembershipStatusBadgeProps(member.membershipStatus);
                        return <Badge variant={badgeProps.variant} className={`text-xs test-classname ${badgeProps?.className ?? ""}`}>{badgeProps.label}</Badge>;
                      })()}
                    </td>
                    <td className="p-2">
                      {member.isPlayer ? (
                        <Badge variant="outline" className="text-blue-600">Player</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-2">
                      {(() => {
                        const badgeProps = getUserRoleBadgeProps(member.role);
                        return <Badge variant={badgeProps.variant}>{badgeProps.label}</Badge>;
                      })()}
                    </td>
                    <td className="p-2 text-sm text-muted-foreground">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditMember(member)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendEmail(member.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMember(member)}
                          className="h-8 w-8 p-0 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Medium/Tablet Table View (768px - 1279px) - Remove Role Column */}
          <div className="hidden md:block xl:hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">#</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Gender</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Player</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member, index) => (
                  <tr key={member.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 text-sm text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="p-2">
                      <div className="font-medium">
                        {member.fullName}
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="capitalize text-sm">{member.gender || 'Not specified'}</span>
                    </td>
                    <td className="p-2">
                      {(() => {
                        const badgeProps = getMembershipStatusBadgeProps(member.membershipStatus);
                        return <Badge variant={badgeProps.variant} className={`text-xs test-classname ${badgeProps?.className ?? ""}`}>{badgeProps.label}</Badge>;
                      })()}
                    </td>
                    <td className="p-2">
                      {member.isPlayer ? (
                        <Badge variant="outline" className="text-blue-600">Player</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditMember(member)}
                          className="h-8 w-8 p-0"
                          title="Edit Member"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendEmail(member.id)}
                          className="h-8 w-8 p-0"
                          title="Send Email"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMember(member)}
                          className="h-8 w-8 p-0 hover:text-destructive"
                          title="Delete Member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Optimized Table View */}
          <div className="md:hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground text-sm">#</th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-sm">Name</th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-sm">Status</th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member, index) => (
                  <tr key={member.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 text-sm text-muted-foreground w-8">
                      {index + 1}
                    </td>
                    <td className="p-2">
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {member.fullName}
                        </div>
                        <div className="flex gap-1">
                          {member.isPlayer && (
                            <Badge variant="outline" className="text-xs px-1 py-0 text-blue-600">Player</Badge>
                          )}
                          {member.role === UserRole.ADMIN && (
                            <Badge variant="outline" className="text-xs px-1 py-0 text-purple-600">
                              Admin
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-2">
                      {(() => {
                        const badgeProps = getMembershipStatusBadgeProps(member.membershipStatus);
                        return <Badge variant={badgeProps.variant} className={`text-xs test-classname ${badgeProps?.className ?? ""}`}>{badgeProps.label}</Badge>;
                      })()}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditMember(member)}
                          className="h-7 w-7 p-0"
                          title="Edit Member"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendEmail(member.id)}
                          className="h-7 w-7 p-0"
                          title="Send Email"
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMember(member)}
                          className="h-7 w-7 p-0 hover:text-destructive"
                          title="Delete Member"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredMembers.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || filterType !== 'all'
                  ? 'No members found matching your criteria'
                  : 'No members found'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <AddMemberModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onMemberAdded={handleMemberAdded}
      />

      <EditMemberModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedMember(null);
        }}
        member={selectedMember}
        onMemberUpdated={handleMemberUpdated}
      />

      <BatchUpdateMembersModal
        isOpen={batchUpdateModalOpen}
        onClose={() => setBatchUpdateModalOpen(false)}
        members={members || []}
        onBatchUpdate={handleBatchUpdate}
      />
    </div>
  );
}