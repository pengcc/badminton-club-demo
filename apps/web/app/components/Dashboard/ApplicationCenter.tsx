'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { FileText, Eye, CheckCircle, XCircle, Mail } from 'lucide-react';
import { MembershipApplicationService } from '@app/services/membershipApplicationService';
import type { MembershipApplicationResponse } from '@club/shared-types/api/membershipApplication';
import ApplicationDetailsModal from './modals/ApplicationDetailsModal';
import ApplicationReviewModal from './modals/ApplicationReviewModal';
import ContactApplicantModal from './modals/ContactApplicantModal';

export default function ApplicationCenter() {
  const t = useTranslations('dashboard.applicationCenter');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const applicationContext = searchParams.get('application');
  const handledApplicationContext = useRef<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<
    'all' | 'pending' | 'approved' | 'rejected' | 'withdrawn'
  >('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] =
    useState<MembershipApplicationResponse | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>(
    'approve'
  );

  // Fetch applications
  const applicationQuery = MembershipApplicationService.useApplicationList();
  const {
    data: applications,
    isLoading,
    isLoadingError,
    isRefetchError,
    isFetching,
    refetch,
  } = applicationQuery;

  const clearApplicationContext = useCallback(() => {
    if (!applicationContext) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete('application');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [applicationContext, pathname, router, searchParams]);

  // Event handlers
  const handleViewDetails = useCallback(
    (app: MembershipApplicationResponse) => {
      setSelectedApplication(app);
      setDetailsModalOpen(true);
    },
    []
  );

  const handleApprove = useCallback((app: MembershipApplicationResponse) => {
    setSelectedApplication(app);
    setReviewAction('approve');
    setReviewModalOpen(true);
  }, []);

  const handleReject = useCallback((app: MembershipApplicationResponse) => {
    setSelectedApplication(app);
    setReviewAction('reject');
    setReviewModalOpen(true);
  }, []);

  const handleContact = useCallback((app: MembershipApplicationResponse) => {
    setSelectedApplication(app);
    setContactModalOpen(true);
  }, []);

  useEffect(() => {
    if (
      !applicationContext ||
      isLoading ||
      handledApplicationContext.current === applicationContext
    ) {
      return;
    }
    handledApplicationContext.current = applicationContext;
    const listed = applications?.find((item) => item.id === applicationContext);
    if (listed) {
      handleViewDetails(listed);
      return;
    }
    let cancelled = false;
    void MembershipApplicationService.getApplication(applicationContext)
      .then((application) => {
        if (!cancelled) handleViewDetails(application);
      })
      .catch(() => {
        if (!cancelled) clearApplicationContext();
      });
    return () => {
      cancelled = true;
    };
  }, [
    applicationContext,
    applications,
    clearApplicationContext,
    handleViewDetails,
    isLoading,
  ]);

  // Filter applications
  const filteredApplications =
    applications?.filter((app) => {
      const matchesStatus =
        selectedStatus === 'all' || app.status === selectedStatus;
      const matchesSearch =
        searchTerm === '' ||
        app.personalInfo.firstName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        app.personalInfo.lastName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        app.personalInfo.email.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStatus && matchesSearch;
    }) || [];

  // Calculate stats
  const stats = {
    total: applications?.length || 0,
    pending: applications?.filter((a) => a.status === 'pending').length || 0,
    approved: applications?.filter((a) => a.status === 'approved').length || 0,
    rejected: applications?.filter((a) => a.status === 'rejected').length || 0,
    withdrawn:
      applications?.filter((a) => a.status === 'withdrawn').length || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  const listUnavailable = isLoadingError && !applications;

  return (
    <div>
      {isRefetchError && applications && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <span>{t('refreshFailed')}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? t('retrying') : t('retry')}
          </Button>
        </div>
      )}
      {listUnavailable ? (
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle>{t('loadFailedTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('loadFailedDescription')}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
            >
              {t('retry')}
            </Button>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t('title')}
              </CardTitle>
            </div>

            {/* Statistics */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-sm text-muted-foreground">
                  {t('statistics.total')}
                </div>
                <div className="text-2xl font-bold">{stats.total}</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-3">
                <div className="text-sm text-muted-foreground">
                  {t('statistics.pending')}
                </div>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                  {stats.pending}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                <div className="text-sm text-muted-foreground">
                  {t('statistics.approved')}
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                  {stats.approved}
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
                <div className="text-sm text-muted-foreground">
                  {t('statistics.rejected')}
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-500">
                  {stats.rejected}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/20 rounded-lg p-3">
                <div className="text-sm text-muted-foreground">
                  {t('statistics.withdrawn')}
                </div>
                <div className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                  {stats.withdrawn}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-4 flex flex-col md:flex-row md:items-center gap-3">
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex h-9 w-full md:max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex gap-2 flex-wrap md:flex-nowrap">
                <Button
                  variant={selectedStatus === 'all' ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={selectedStatus === 'all'}
                  onClick={() => setSelectedStatus('all')}
                  className="flex-shrink-0"
                >
                  {t('filters.all')}
                </Button>
                <Button
                  variant={selectedStatus === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={selectedStatus === 'pending'}
                  onClick={() => setSelectedStatus('pending')}
                  className="flex-shrink-0"
                >
                  {t('filters.pending')}
                </Button>
                <Button
                  variant={
                    selectedStatus === 'approved' ? 'default' : 'outline'
                  }
                  size="sm"
                  aria-pressed={selectedStatus === 'approved'}
                  onClick={() => setSelectedStatus('approved')}
                  className="flex-shrink-0"
                >
                  {t('filters.approved')}
                </Button>
                <Button
                  variant={
                    selectedStatus === 'rejected' ? 'default' : 'outline'
                  }
                  size="sm"
                  aria-pressed={selectedStatus === 'rejected'}
                  onClick={() => setSelectedStatus('rejected')}
                  className="flex-shrink-0"
                >
                  {t('filters.rejected')}
                </Button>
                <Button
                  variant={
                    selectedStatus === 'withdrawn' ? 'default' : 'outline'
                  }
                  size="sm"
                  aria-pressed={selectedStatus === 'withdrawn'}
                  onClick={() => setSelectedStatus('withdrawn')}
                  className="flex-shrink-0"
                >
                  {t('filters.withdrawn')}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {filteredApplications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('empty')}
              </div>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        {t('columns.name')}
                      </th>
                      <th className="hidden md:table-cell px-4 py-3 text-left text-sm font-medium">
                        {t('columns.email')}
                      </th>
                      <th className="hidden md:table-cell px-4 py-3 text-left text-sm font-medium">
                        {t('columns.type')}
                      </th>
                      <th className="hidden md:table-cell px-4 py-3 text-left text-sm font-medium">
                        {t('columns.status')}
                      </th>
                      <th className="hidden md:table-cell px-4 py-3 text-left text-sm font-medium">
                        {t('columns.processedBy')}
                      </th>
                      <th className="hidden md:table-cell px-4 py-3 text-left text-sm font-medium">
                        {t('columns.submitted')}
                      </th>
                      <th className="hidden md:table-cell px-4 py-3 text-left text-sm font-medium">
                        {t('columns.processed')}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        {t('columns.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplications.map((app) => {
                      const getStatusDot = (status: string) => {
                        const colors = {
                          pending: 'bg-yellow-500',
                          approved: 'bg-green-500',
                          rejected: 'bg-red-500',
                          withdrawn: 'bg-slate-500',
                        };
                        return (
                          colors[status as keyof typeof colors] || 'bg-gray-400'
                        );
                      };

                      return (
                        <tr
                          key={app.id}
                          className="border-b last:border-0 hover:bg-muted/50"
                        >
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <span
                                className={`md:hidden w-2 h-2 rounded-full flex-shrink-0 ${getStatusDot(app.status)}`}
                              />
                              <span>
                                {app.personalInfo.firstName}{' '}
                                {app.personalInfo.lastName}
                              </span>
                            </div>
                          </td>
                          <td className="hidden md:table-cell px-4 py-3 text-sm text-muted-foreground">
                            {app.personalInfo.email}
                          </td>
                          <td className="hidden md:table-cell px-4 py-3 text-sm">
                            <span className="capitalize">
                              {app.membershipType}
                            </span>
                          </td>
                          <td className="hidden md:table-cell px-4 py-3 text-sm">
                            {app.status === 'pending' && (
                              <span className="inline-flex items-center rounded-full bg-yellow-50 dark:bg-yellow-950/20 px-2 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-500">
                                {t('status.pending')}
                              </span>
                            )}
                            {app.status === 'approved' && (
                              <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-950/20 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-500">
                                {t('status.approved')}
                              </span>
                            )}
                            {app.status === 'rejected' && (
                              <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-950/20 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-500">
                                {t('status.rejected')}
                              </span>
                            )}
                            {app.status === 'withdrawn' && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-900 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                                {t('status.withdrawn')}
                              </span>
                            )}
                          </td>
                          <td className="hidden md:table-cell px-4 py-3 text-sm text-muted-foreground">
                            {(app as any).reviewerName || '-'}
                          </td>
                          <td className="hidden md:table-cell px-4 py-3 text-sm text-muted-foreground">
                            {app.submittedAt
                              ? new Date(app.submittedAt).toLocaleDateString()
                              : '-'}
                          </td>
                          <td className="hidden md:table-cell px-4 py-3 text-sm text-muted-foreground">
                            {app.reviewDate
                              ? new Date(app.reviewDate).toLocaleDateString()
                              : app.withdrawnAt
                                ? new Date(app.withdrawnAt).toLocaleDateString()
                                : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={t('actions.view')}
                                title={t('actions.view')}
                                onClick={() => handleViewDetails(app)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {app.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-green-600"
                                    aria-label={t('actions.approve')}
                                    title={t('actions.approve')}
                                    onClick={() => handleApprove(app)}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600"
                                    aria-label={t('actions.reject')}
                                    title={t('actions.reject')}
                                    onClick={() => handleReject(app)}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-blue-600"
                                aria-label={t('actions.contact')}
                                title={t('actions.contact')}
                                onClick={() => handleContact(app)}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <ApplicationDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedApplication(null);
          clearApplicationContext();
        }}
        application={selectedApplication}
      />

      <ApplicationReviewModal
        isOpen={reviewModalOpen}
        onClose={() => {
          setReviewModalOpen(false);
          setSelectedApplication(null);
        }}
        application={selectedApplication}
        action={reviewAction}
      />

      <ContactApplicantModal
        isOpen={contactModalOpen}
        onClose={() => {
          setContactModalOpen(false);
          setSelectedApplication(null);
        }}
        application={selectedApplication}
      />
    </div>
  );
}
