'use client';

import React, {
  useState,
  useRef,
  useCallback,
  useDeferredValue,
  useEffect,
} from 'react';
import { useTranslations } from 'next-intl';
import { MemberListFilter } from '@club/shared-types/core/enums';
import type { Api } from '@club/shared-types/api/user';
import { useAuth } from '@app/hooks/useAuth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@app/components/ui/dropdown-menu';
import {
  AlertCircle,
  ChevronDown,
  Download,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  UserService,
  type MemberListViewResponse,
} from '@app/services/userService';
import {
  useMemberExport,
  useRichMemberExport,
} from '@app/hooks/useMemberExport';
import { MemberFilters } from './MemberFilters';
import { MemberTable } from './MemberTable';
import { MemberStatistics } from './MemberStatistics';
import { ActiveExternalPlayers } from './ActiveExternalPlayers';
import { Pagination } from '@app/components/ui/Pagination';
import AddMemberModal from './modals/AddMemberModal';
import MemberCsvImportModal from './modals/MemberCsvImportModal';
import EditMemberModal from './modals/EditMemberModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@app/components/ui/alert-dialog';
import type { User } from '@app/lib/types';
import { toast } from 'sonner';
import { Label } from '@app/components/ui/label';
import { Textarea } from '@app/components/ui/textarea';

export default function MemberCenter() {
  const t = useTranslations('dashboard');
  const setupReissue = useTranslations('common.setupReissue');
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm.trim());
  const [filter, setFilter] = useState(MemberListFilter.CURRENT);
  const [gender, setGender] = useState<Api.MemberGenderFilter>();
  const [administratorOnly, setAdministratorOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const memberListQuery: Api.MemberListQuery = {
    filter,
    gender,
    administratorOnly: administratorOnly || undefined,
    search: deferredSearch || undefined,
    page,
    pageSize,
  };
  const effectiveQueryKey = JSON.stringify(memberListQuery);
  const memberQuery = UserService.useMemberList(memberListQuery);
  const { isLoading, isLoadingError, isFetching, refetch } = memberQuery;
  const [lastSuccessfulMemberList, setLastSuccessfulMemberList] = useState<{
    key: string;
    data: MemberListViewResponse;
  }>();

  useEffect(() => {
    if (memberQuery.data !== undefined && !memberQuery.isPlaceholderData) {
      setLastSuccessfulMemberList({
        key: effectiveQueryKey,
        data: memberQuery.data,
      });
    }
  }, [effectiveQueryKey, memberQuery.data, memberQuery.isPlaceholderData]);

  const lastSuccessfulForQuery =
    lastSuccessfulMemberList?.key === effectiveQueryKey
      ? lastSuccessfulMemberList.data
      : undefined;
  const memberList =
    memberQuery.isError && memberQuery.isPlaceholderData
      ? lastSuccessfulForQuery
      : (memberQuery.data ?? lastSuccessfulForQuery);
  const members = memberList?.items;
  const { user: currentUser } = useAuth();

  // React Query mutations for proper cache invalidation
  const deleteUserMutation = UserService.useDeleteUser();
  const reissueAccountSetupMutation = UserService.useReissueAccountSetup();

  const { exportMembers, isExporting } = useMemberExport();
  const { exportMembers: exportRichMembers, isExporting: isExportingRich } =
    useRichMemberExport();
  const isAnyExportPending = isExporting || isExportingRich;

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const csvMenuRef = useRef<HTMLButtonElement>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [reissuingUserId, setReissuingUserId] = useState<string>();

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<User | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  // Event handlers
  const handleSendEmail = useCallback(
    async (memberId: string) => {
      setReissuingUserId(memberId);
      try {
        const result = await reissueAccountSetupMutation.mutateAsync(memberId);
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
    },
    [reissueAccountSetupMutation, setupReissue]
  );

  const handleEditMember = useCallback((member: User) => {
    setSelectedMember(member);
    setEditModalOpen(true);
  }, []);

  const handleDeleteMember = useCallback((member: User) => {
    setDeleteError(false);
    setDeleteReason('');
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    const reason = deleteReason.trim();
    if (!memberToDelete || !reason) return;

    setDeleteError(false);
    try {
      await deleteUserMutation.mutateAsync({
        id: memberToDelete.id,
        reason,
      });
      setDeleteDialogOpen(false);
      setMemberToDelete(null);
    } catch {
      setDeleteError(true);
    }
  }, [deleteReason, memberToDelete, deleteUserMutation]);

  const handleAddMember = useCallback(() => {
    setAddModalOpen(true);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((nextFilter: MemberListFilter) => {
    setFilter(nextFilter);
    setPage(1);
  }, []);

  const handleGenderChange = useCallback(
    (nextGender?: Api.MemberGenderFilter) => {
      setGender(nextGender);
      setPage(1);
    },
    []
  );

  const handleAdministratorOnlyChange = useCallback((nextValue: boolean) => {
    setAdministratorOnly(nextValue);
    setPage(1);
  }, []);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (memberQuery.isError && nextPage === page) {
        void refetch();
        return;
      }
      setPage(nextPage);
    },
    [memberQuery.isError, page, refetch]
  );

  const handlePageSizeChange = useCallback(
    (nextPageSize: number) => {
      if (memberQuery.isError && nextPageSize === pageSize && page === 1) {
        void refetch();
        return;
      }
      setPageSize(nextPageSize);
      setPage(1);
    },
    [memberQuery.isError, page, pageSize, refetch]
  );

  const handleMemberAdded = useCallback(() => {
    // Cache is automatically invalidated by the mutation in AddMemberModal
  }, []);

  const handleMemberUpdated = useCallback((updatedMember: User) => {
    setSelectedMember(updatedMember);
  }, []);

  return (
    <div className="space-y-6">
      {/* Member Management Table */}
      {isLoading && memberList === undefined ? (
        <Card>
          <CardContent>
            <div
              className="flex items-center justify-center p-8"
              role="status"
              aria-live="polite"
            >
              <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                <p className="text-muted-foreground">
                  {t('memberList.loading')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isLoadingError && memberList === undefined ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('memberList.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="flex flex-col items-center gap-3 py-8 text-center"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle
                className="h-10 w-10 text-destructive"
                aria-hidden="true"
              />
              <div>
                <h3 className="font-semibold">
                  {t('memberList.loadErrorTitle')}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('memberList.loadErrorDescription')}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {isFetching ? t('memberList.retrying') : t('memberList.retry')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('memberList.title')}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                {!currentUser.demoMode && (
                  <Button
                    size="sm"
                    className="min-w-0"
                    onClick={handleAddMember}
                  >
                    <UserPlus aria-hidden="true" />
                    <span>{t('memberList.addMember')}</span>
                  </Button>
                )}
                {!currentUser.demoMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        ref={csvMenuRef}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-w-0"
                        disabled={isAnyExportPending}
                        aria-busy={isAnyExportPending}
                        aria-label={
                          isAnyExportPending
                            ? t('memberList.exporting')
                            : t('memberList.export')
                        }
                      >
                        {isAnyExportPending ? (
                          <RefreshCw
                            className="animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Download aria-hidden="true" />
                        )}
                        <span>CSV</span>
                        <ChevronDown aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => setImportModalOpen(true)}
                      >
                        {t('memberImport.title')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => void exportMembers('current')}
                      >
                        <Download aria-hidden="true" />
                        {t('memberList.portableCurrentExport')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => void exportMembers('all')}
                      >
                        <Download aria-hidden="true" />
                        {t('memberList.basicAllExport')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => void exportRichMembers('current')}
                      >
                        <Download aria-hidden="true" />
                        {t('memberList.richCurrentExport')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => void exportRichMembers('all')}
                      >
                        <Download aria-hidden="true" />
                        {t('memberList.richAllExport')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {memberQuery.isError && memberList !== undefined && (
              <div
                className="mt-4 flex flex-col gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
                role="alert"
                aria-live="polite"
              >
                <div className="flex gap-3">
                  <AlertCircle
                    className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium">
                      {t('memberList.refreshErrorTitle')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('memberList.refreshErrorDescription')}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                  className="self-start sm:self-auto"
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  {isFetching
                    ? t('memberList.retrying')
                    : t('memberList.retry')}
                </Button>
              </div>
            )}

            {memberList && (
              <div className="mt-4">
                <MemberStatistics
                  statistics={memberList.statistics}
                  cohortLabel={t('memberList.statisticsCohorts.members')}
                />
              </div>
            )}

            {/* Search and Filter */}
            <div className="mt-4">
              <MemberFilters
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                filter={filter}
                onFilterChange={handleFilterChange}
                administratorOnly={administratorOnly}
                onAdministratorOnlyChange={handleAdministratorOnlyChange}
                gender={gender}
                genderCounts={
                  memberList?.genderFilterCounts ?? {
                    male: 0,
                    female: 0,
                    other: 0,
                    missing: 0,
                  }
                }
                onGenderChange={handleGenderChange}
                showMembershipFilters
              />
            </div>
          </CardHeader>

          <CardContent>
            <MemberTable
              members={members || []}
              onEdit={handleEditMember}
              onSendEmail={handleSendEmail}
              onDelete={handleDeleteMember}
              currentUser={currentUser}
              reissuingUserId={reissuingUserId}
              readOnly={currentUser.demoMode}
            />
            {memberList && (
              <Pagination
                currentPage={memberList.pagination.page}
                totalItems={memberList.pagination.total}
                pageSize={memberList.pagination.pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={[10, 20, 50, 100]}
              />
            )}
          </CardContent>
        </Card>
      )}

      {!currentUser.demoMode && <ActiveExternalPlayers />}

      {/* Modals */}
      {!currentUser.demoMode && importModalOpen && (
        <MemberCsvImportModal
          onClose={() => setImportModalOpen(false)}
          returnFocusTo={() => csvMenuRef.current}
        />
      )}
      {!currentUser.demoMode && (
        <AddMemberModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          onMemberAdded={handleMemberAdded}
        />
      )}

      {!currentUser.demoMode && (
        <EditMemberModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedMember(null);
          }}
          member={selectedMember}
          onMemberUpdated={handleMemberUpdated}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {!currentUser.demoMode && (
        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            if (deleteUserMutation.isPending) return;
            setDeleteDialogOpen(open);
            if (!open) {
              setDeleteError(false);
              setDeleteReason('');
              setMemberToDelete(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('memberList.deleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {memberToDelete && (
                  <>
                    {t.rich('memberList.deleteDescription', {
                      name: memberToDelete.fullName,
                      email: memberToDelete.email,
                      status: t(
                        `memberList.filters.${memberToDelete.membershipStatus}`
                      ),
                      strong: (chunks) => <strong>{chunks}</strong>,
                    })}
                    <span className="mt-2 block text-destructive font-medium">
                      {t('memberList.deleteConsequences')}
                    </span>
                  </>
                )}
              </AlertDialogDescription>
              <div className="space-y-2">
                <Label htmlFor="account-deletion-reason">
                  {t('memberList.deleteReasonLabel')}
                </Label>
                <Textarea
                  id="account-deletion-reason"
                  value={deleteReason}
                  onChange={(event) => setDeleteReason(event.target.value)}
                  maxLength={500}
                  disabled={deleteUserMutation.isPending}
                  placeholder={t('memberList.deleteReasonPlaceholder')}
                />
                {!deleteReason.trim() && (
                  <p className="text-xs text-muted-foreground">
                    {t('memberList.deleteReasonRequired')}
                  </p>
                )}
              </div>
              {deleteError && (
                <p role="alert" className="text-sm text-destructive">
                  {t('memberList.cleanupFailed')}
                </p>
              )}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteUserMutation.isPending}>
                {t('memberList.deleteCancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteUserMutation.isPending || !deleteReason.trim()}
                onClick={(event) => {
                  event.preventDefault();
                  void confirmDelete();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteUserMutation.isPending
                  ? t('memberList.deletePending')
                  : t('memberList.deleteAccount')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
