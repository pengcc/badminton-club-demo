'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@app/components/ui/button';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@app/components/ui/radio-group';
import { Checkbox } from '@app/components/ui/checkbox';
import { Badge } from '@app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import {
  X,
  Save,
  Users,
  Filter,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { User } from '@app/lib/types';
import { UserRole, MembershipStatus } from '@club/shared-types/core/enums';
import { getMembershipStatusBadgeProps } from '@app/lib/utils/badge-utils';
import { MEMBER_ROLES, MEMBERSHIP_STATUSES, GENDERS, PLAYER_FILTER_OPTIONS } from '@app/lib/constants/member-options';

interface BatchUpdateMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: User[];
  onBatchUpdate: (selectedMemberIds: string[], updateData: any) => Promise<void>;
}

interface BatchUpdateData {
  membershipStatus?: MembershipStatus;
  isPlayer?: boolean;
  role?: UserRole;
}

export default function BatchUpdateMembersModal({
  isOpen,
  onClose,
  members,
  onBatchUpdate
}: BatchUpdateMembersModalProps) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');

  // Selection state
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [playerFilter, setPlayerFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');

  // Update data
  const [updateData, setUpdateData] = useState<BatchUpdateData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedMembers(new Set());
      setSelectAll(false);
      setSearchTerm('');
      setStatusFilter('all');
      setRoleFilter('all');
      setPlayerFilter('all');
      setGenderFilter('all');
      setUpdateData({});
    }
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Filter members based on search and filters
  const filteredMembers = members.filter(member => {
    const matchesSearch = member.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || member.membershipStatus === statusFilter;
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    const matchesPlayer = playerFilter === 'all' ||
                         (playerFilter === 'yes' && member.isPlayer) ||
                         (playerFilter === 'no' && !member.isPlayer);
    const matchesGender = genderFilter === 'all' || member.gender === genderFilter;

    return matchesSearch && matchesStatus && matchesRole && matchesPlayer && matchesGender;
  });

  // Handle individual member selection
  const handleMemberSelect = (memberId: string, checked: boolean) => {
    const newSelected = new Set(selectedMembers);
    if (checked) {
      newSelected.add(memberId);
    } else {
      newSelected.delete(memberId);
    }
    setSelectedMembers(newSelected);
    setSelectAll(newSelected.size === filteredMembers.length);
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredMembers.map(m => m.id));
      setSelectedMembers(allIds);
      setSelectAll(true);
    } else {
      setSelectedMembers(new Set());
      setSelectAll(false);
    }
  };

  // Validate update data
  const hasValidUpdateData = () => {
    return Object.keys(updateData).some(key => updateData[key as keyof BatchUpdateData] !== undefined);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedMembers.size === 0) {
      alert(t('alerts.selectAtLeastOne'));
      return;
    }

    if (!hasValidUpdateData()) {
      alert(t('alerts.specifyUpdateField'));
      return;
    }

    setIsSubmitting(true);
    try {
      await onBatchUpdate(Array.from(selectedMembers), updateData);
      onClose();
    } catch (error: any) {
      console.error('Error in batch update:', error);
      alert(`${t('alerts.updateMemberFailed')}: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">{t('modals.batchUpdate.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('modals.batchUpdate.subtitle')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
            {/* Left Panel - Member Selection */}
            <div className="flex-1 border-r border-gray-200 flex flex-col">
              {/* Search and Filters */}
              <div className="p-2 border-b bg-gray-50">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="search" className="text-sm font-medium">{t('modals.batchUpdate.searchMembers')}</Label>
                    <Input
                      id="search"
                      placeholder={t('form.placeholders.searchByNameOrEmail')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <Label htmlFor="status-filter" className="text-sm font-medium">{t('status')}</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue placeholder={t('form.placeholders.allStatus')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('form.placeholders.allStatus')}</SelectItem>
                          {MEMBERSHIP_STATUSES.map(({ value, i18nKey }) => (
                            <SelectItem key={value} value={value}>{t(i18nKey)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="role-filter" className="text-sm font-medium">{t('role')}</Label>
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue placeholder={t('form.placeholders.allRoles')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('form.placeholders.allRoles')}</SelectItem>
                          {MEMBER_ROLES.map(({ value, i18nKey }) => (
                            <SelectItem key={value} value={value}>{t(i18nKey)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="player-filter" className="text-sm font-medium">{t('form.isPlayer')}</Label>
                      <Select value={playerFilter} onValueChange={setPlayerFilter}>
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue placeholder={t('form.placeholders.allMembers')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('form.placeholders.allMembers')}</SelectItem>
                          {PLAYER_FILTER_OPTIONS.map(({ value, i18nKey }) => (
                            <SelectItem key={value} value={value}>{t(i18nKey)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="gender-filter" className="text-sm font-medium">{t('form.gender')}</Label>
                      <Select value={genderFilter} onValueChange={setGenderFilter}>
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue placeholder={t('form.placeholders.allGenders')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('form.placeholders.allGenders')}</SelectItem>
                          {GENDERS.map(({ value, i18nKey }) => (
                            <SelectItem key={value} value={value}>{t(i18nKey)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Member List */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4">
                  {/* Select All */}
                  <div className="flex items-center gap-2 pb-3 border-b mb-3">
                    <Checkbox
                      id="select-all"
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                    <Label htmlFor="select-all" className="text-sm font-medium">
                      {t('modals.batchUpdate.selectAll')} ({filteredMembers.length} {filteredMembers.length === 1 ? t('modals.batchUpdate.member_one') : t('modals.batchUpdate.member_other')})
                    </Label>
                  </div>

                  {/* Member List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto px-2 sm:px-0">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        className={`flex items-center gap-3 p-2 rounded-md border transition-colors ${
                          selectedMembers.has(member.id)
                            ? 'bg-blue-50 border-blue-200'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <Checkbox
                          id={`member-${member.id}`}
                          checked={selectedMembers.has(member.id)}
                          onChange={(e) =>
                            handleMemberSelect(member.id, e.target.checked)
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{member.fullName}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {member.email}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {(() => {
                              const badgeProps = getMembershipStatusBadgeProps(member.membershipStatus);
                              return <Badge variant={badgeProps.variant} className={`text-xs ${badgeProps?.className ?? ""}`}>{badgeProps.label}</Badge>;
                            })()}
                            {member.isPlayer && (
                              <Badge variant="outline" className="text-xs">{t('players')}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredMembers.length === 0 && (
                    <div className="text-center py-8">
                      <Filter className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {t('modals.batchUpdate.noMembersFound')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel - Update Options */}
            <div className="w-full lg:w-60 flex flex-col">
              <div className="p-4 border-b bg-gray-50">
                <h4 className="font-semibold text-sm">{t('modals.batchUpdate.updateSettings')}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('modals.batchUpdate.subtitle')}
                </p>
              </div>

              <div className="flex-1 p-4 space-y-6">
                {/* Membership Status Update */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Checkbox
                      id="update-status"
                      checked={updateData.membershipStatus !== undefined}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setUpdateData(prev => ({ ...prev, membershipStatus: MembershipStatus.ACTIVE }));
                        } else {
                          const { membershipStatus, ...rest } = updateData;
                          setUpdateData(rest);
                        }
                      }}
                    />
                    <Label htmlFor="update-status" className="font-medium text-sm">
                      {t('batchUpdate.updateMembershipStatus')}
                    </Label>
                  </div>

                  {updateData.membershipStatus !== undefined && (
                    <RadioGroup
                      value={updateData.membershipStatus}
                      onValueChange={(value) =>
                        setUpdateData(prev => ({
                          ...prev,
                          membershipStatus: value as MembershipStatus
                        }))
                      }
                    >
                      {MEMBERSHIP_STATUSES.map(({ value, i18nKey }) => (
                        <div key={value} className="flex items-center space-x-2">
                          <RadioGroupItem value={value} id={`batch-status-${value}`} />
                          <Label htmlFor={`batch-status-${value}`} className="text-sm">{t(i18nKey)}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </div>

                {/* Player Status Update */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Checkbox
                      id="update-player"
                      checked={updateData.isPlayer !== undefined}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setUpdateData(prev => ({ ...prev, isPlayer: true }));
                        } else {
                          const { isPlayer, ...rest } = updateData;
                          setUpdateData(rest);
                        }
                      }}
                    />
                    <Label htmlFor="update-player" className="font-medium text-sm">
                      {t('batchUpdate.updatePlayerStatus')}
                    </Label>
                  </div>

                  {updateData.isPlayer !== undefined && (
                    <RadioGroup
                      value={updateData.isPlayer ? 'true' : 'false'}
                      onValueChange={(value) =>
                        setUpdateData(prev => ({
                          ...prev,
                          isPlayer: value === 'true'
                        }))
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="true" id="player-yes" />
                        <Label htmlFor="player-yes" className="text-sm">{t('batchUpdate.yesIsPlayer')}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="false" id="player-no" />
                        <Label htmlFor="player-no" className="text-sm">{t('batchUpdate.noNotPlayer')}</Label>
                      </div>
                    </RadioGroup>
                  )}
                </div>

                {/* Role Update */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Checkbox
                      id="update-role"
                      checked={updateData.role !== undefined}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setUpdateData(prev => ({ ...prev, role: UserRole.MEMBER }));
                        } else {
                          const { role, ...rest } = updateData;
                          setUpdateData(rest);
                        }
                      }}
                    />
                    <Label htmlFor="update-role" className="font-medium text-sm">
                      {t('batchUpdate.updateRole')}
                    </Label>
                  </div>

                  {updateData.role !== undefined && (
                    <RadioGroup
                      value={updateData.role}
                      onValueChange={(value) =>
                        setUpdateData(prev => ({
                          ...prev,
                          role: value as UserRole
                        }))
                      }
                    >
                      {MEMBER_ROLES.map(({ value, i18nKey }) => (
                        <div key={value} className="flex items-center space-x-2">
                          <RadioGroupItem value={value} id={`batch-role-${value}`} />
                          <Label htmlFor={`batch-role-${value}`} className="text-sm">{t(i18nKey)}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </div>

                {/* Selection Summary */}
                {selectedMembers.size > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-sm text-blue-900">
                        {t('modals.batchUpdate.selectionSummary')}
                      </span>
                    </div>
                    <p className="text-xs text-blue-800">
                      {selectedMembers.size} {selectedMembers.size === 1 ? t('modals.batchUpdate.member_one') : t('modals.batchUpdate.member_other')} {t('modals.batchUpdate.selected')}
                    </p>
                    {hasValidUpdateData() && (
                      <div className="mt-2 space-y-1">
                        {updateData.membershipStatus && (
                          <p className="text-xs text-blue-800">
                            • {t('batchUpdate.updateSummaryPrefix')} <strong>{t(`membershipStatus.${updateData.membershipStatus.toLowerCase()}`)}</strong>
                          </p>
                        )}
                        {updateData.isPlayer !== undefined && (
                          <p className="text-xs text-blue-800">
                            • {t('batchUpdate.updatePlayerSummaryPrefix')} <strong>{updateData.isPlayer ? t('batchUpdate.yes') : t('batchUpdate.no')}</strong>
                          </p>
                        )}
                        {updateData.role && (
                          <p className="text-xs text-blue-800">
                            • {t('batchUpdate.updateRoleSummaryPrefix')} <strong>{t(`roles.${updateData.role.toLowerCase()}`)}</strong>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('buttons.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || selectedMembers.size === 0 || !hasValidUpdateData()}
              className="min-w-[120px] hover:bg-primary hover:text-primary-foreground"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {t('buttons.updating')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t('buttons.update')} {selectedMembers.size} {selectedMembers.size === 1 ? t('modals.batchUpdate.member_one') : t('modals.batchUpdate.member_other')}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}