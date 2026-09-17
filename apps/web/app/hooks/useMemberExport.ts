import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  MEMBER_CSV_HEADERS,
  portableMemberCsvValues,
} from '@club/shared-types/api/memberCsv';
import type { Api } from '@club/shared-types/api/user';
import { UserService } from '@app/services/userService';
import { toast } from 'sonner';
import { formatDate } from '@app/lib/utils/date-utils';
import { downloadCsv } from '@app/lib/utils/csv';

export function useMemberExport() {
  const t = useTranslations('dashboard.memberList');
  const [isExporting, setIsExporting] = useState(false);

  const exportMembers = useCallback(
    async (cohort: Api.MemberExportCohort) => {
      setIsExporting(true);
      try {
        const response = await UserService.getRichMemberExport({ cohort });
        const date = new Date().toISOString().slice(0, 10);
        if (
          !downloadCsv({
            filename:
              cohort === 'current'
                ? `members_portable_current_${date}.csv`
                : `members_basic_all_${date}.csv`,
            rows: response.items,
            columns:
              cohort === 'current'
                ? MEMBER_CSV_HEADERS.map((header) => ({
                    header,
                    value: (member: Api.RichMemberExportRow) =>
                      portableMemberCsvValues(member)[header],
                  }))
                : [
                    { header: 'Name', value: (member) => member.fullName },
                    { header: 'Email', value: (member) => member.email },
                    { header: 'Gender', value: (member) => member.gender },
                    {
                      header: 'Date of birth',
                      value: (member) =>
                        member.dateOfBirth
                          ? formatDate(member.dateOfBirth)
                          : '',
                    },
                    {
                      header: 'Membership status',
                      value: (member) => member.membershipStatus,
                    },
                  ],
          })
        ) {
          toast.warning(t('noMembersToExport'));
        }
      } catch {
        toast.error(t('exportFailed'));
      } finally {
        setIsExporting(false);
      }
    },
    [t]
  );

  return { exportMembers, isExporting };
}

export function useRichMemberExport() {
  const t = useTranslations('dashboard.memberList');
  const [isExporting, setIsExporting] = useState(false);

  const exportMembers = useCallback(
    async (cohort: Api.MemberExportCohort) => {
      setIsExporting(true);
      try {
        const response = await UserService.getRichMemberExport({ cohort });
        const date = new Date().toISOString().slice(0, 10);
        if (
          !downloadCsv({
            filename: `members_rich_${cohort}_${date}.csv`,
            rows: response.items,
            columns: [
              { header: 'Name', value: (row) => row.fullName },
              { header: 'Email', value: (row) => row.email },
              { header: 'Phone', value: (row) => row.phone },
              { header: 'Gender', value: (row) => row.gender },
              { header: 'Date of birth', value: (row) => row.dateOfBirth },
              {
                header: 'Address',
                value: (row) =>
                  row.address
                    ? `${row.address.street}, ${row.address.postalCode} ${row.address.city}, ${row.address.country}`
                    : '',
              },
              {
                header: 'Membership status',
                value: (row) => row.membershipStatus,
              },
              {
                header: 'Membership type',
                value: (row) => row.membershipType,
              },
              {
                header: 'Administrator designated',
                value: (row) => (row.administratorDesignation ? 'Yes' : 'No'),
              },
              { header: 'Player type', value: (row) => row.player?.type },
              {
                header: 'Player participation',
                value: (row) =>
                  row.player
                    ? row.player.isActivePlayer
                      ? 'active'
                      : 'inactive'
                    : '',
              },
              {
                header: 'Singles ranking',
                value: (row) => row.player?.singlesRanking,
              },
              {
                header: 'Doubles ranking',
                value: (row) => row.player?.doublesRanking,
              },
              {
                header: 'Teams',
                value: (row) => row.player?.teamNames.join('; '),
              },
            ],
          })
        ) {
          toast.warning(t('noMembersToExport'));
        }
      } catch {
        toast.error(t('exportFailed'));
      } finally {
        setIsExporting(false);
      }
    },
    [t]
  );

  return { exportMembers, isExporting };
}
