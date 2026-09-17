'use client';

import React from 'react';
import { Button } from '@app/components/ui/button';
import { Badge } from '@app/components/ui/badge';
import { Edit2, Mail, MoreHorizontal, Trash2, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@app/components/ui/dropdown-menu';
import { getMembershipStatusBadgeProps } from '@app/lib/utils/badge-utils';
import { formatDate } from '@app/lib/utils/date-utils';
import type { User } from '@app/lib/types';
import { AccountSetupSummary } from './AccountSetupSummary';
import { useTranslations } from 'next-intl';
import { AccountOnboardingStatus } from '@club/shared-types/core/enums';
import { PasswordRecoveryAction } from './PasswordRecoveryAction';

export interface MemberTableProps {
  members: User[];
  onEdit: (member: User) => void;
  onSendEmail: (memberId: string) => void;
  reissuingUserId?: string;
  onDelete: (member: User) => void;
  currentUser?: { id: string } | null;
  readOnly?: boolean;
}

/**
 * Member list with desktop/tablet tables and a task-oriented mobile projection.
 * - Desktop (xl): Full table with all columns
 * - Tablet (md-lg): Reduced columns
 * - Mobile (sm): Minimal columns with compact layout
 *
 * Memoized to prevent unnecessary re-renders when props haven't changed
 */
const MemberTableComponent = ({
  members,
  onEdit,
  onSendEmail,
  onDelete,
  reissuingUserId,
  readOnly = false,
}: MemberTableProps) => {
  const accountSetup = useTranslations('common.accountSetup');
  const memberList = useTranslations('dashboard.memberList');

  if (members.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{memberList('empty')}</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View (1280px+) */}
      <div className="hidden xl:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 font-medium text-muted-foreground">
                #
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                {memberList('columns.name')}
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                {memberList('columns.email')}
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                {memberList('columns.gender')}
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                {memberList('columns.birthday')}
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                {memberList('columns.status')}
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                {memberList('columns.player')}
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                {memberList('columns.administrator')}
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                {accountSetup('header')}
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                {memberList('columns.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
              <tr key={member.id} className="border-b hover:bg-muted/50">
                <td className="p-2 text-sm text-muted-foreground">
                  {index + 1}
                </td>
                <td className="p-2">
                  <div className="space-y-1">
                    <div className="font-medium">{member.fullName}</div>
                    {member.accountSuspension && (
                      <div className="space-y-1">
                        <Badge variant="destructive" className="text-xs">
                          {memberList('accountSuspended')}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {memberList('accountSuspensionReason', {
                            reason: member.accountSuspension.reason,
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-2 text-sm text-muted-foreground">
                  {member.email}
                </td>
                <td className="p-2">
                  <span className="capitalize text-sm">
                    {member.gender
                      ? member.gender === 'male' || member.gender === 'female'
                        ? memberList(`genderValues.${member.gender}`)
                        : memberList('other')
                      : memberList('notSpecified')}
                  </span>
                </td>
                <td className="p-2 text-sm">
                  {member.dateOfBirth
                    ? formatDate(member.dateOfBirth)
                    : memberList('notProvided')}
                </td>
                <td className="p-2">
                  {(() => {
                    const badgeProps = getMembershipStatusBadgeProps(
                      member.membershipStatus!
                    );
                    return (
                      <Badge
                        variant={badgeProps.variant}
                        className={`text-xs test-classname ${badgeProps?.className ?? ''}`}
                      >
                        {memberList(`filters.${member.membershipStatus}`)}
                      </Badge>
                    );
                  })()}
                </td>
                <td className="p-2">
                  {member.isPlayer ? (
                    <Badge variant="outline" className="text-blue-600">
                      {memberList('playerBadge')}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-2">
                  {member.administratorDesignation ? (
                    <Badge variant="outline" className="text-purple-600">
                      {memberList('administratorBadge')}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-2">
                  {!readOnly && member.accountSetup && (
                    <AccountSetupSummary
                      summary={member.accountSetup}
                      accountName={member.fullName}
                      onReissue={onSendEmail}
                      isReissuing={reissuingUserId === member.id}
                      isReissueDisabled={Boolean(reissuingUserId)}
                    />
                  )}
                </td>
                <td className="p-2">
                  {!readOnly && (
                    <div className="flex items-center gap-2">
                      {member.passwordRecoveryAvailable && (
                        <PasswordRecoveryAction
                          userId={member.id}
                          accountName={member.fullName}
                          presentation="standalone-menu"
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(member)}
                        className="h-8 w-8 p-0"
                        aria-label={memberList('editNamed', {
                          name: member.fullName,
                        })}
                      >
                        <Edit2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(member)}
                        className="h-8 w-8 p-0 hover:text-destructive"
                        aria-label={memberList('deleteNamed', {
                          name: member.fullName,
                        })}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Medium/Tablet Table View (768px - 1279px) */}
      <div className="hidden md:block xl:hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 font-medium text-muted-foreground">
                #
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                {memberList('columns.name')}
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                {memberList('columns.gender')}
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                {memberList('columns.status')}
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                {memberList('columns.player')}
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                {memberList('columns.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
              <tr key={member.id} className="border-b hover:bg-muted/50">
                <td className="p-2 text-sm text-muted-foreground">
                  {index + 1}
                </td>
                <td className="p-2">
                  <div className="space-y-1">
                    <div className="font-medium">{member.fullName}</div>
                    {member.accountSuspension && (
                      <Badge variant="destructive" className="text-xs">
                        {memberList('accountSuspended')}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="p-2">
                  <span className="capitalize text-sm">
                    {member.gender
                      ? member.gender === 'male' || member.gender === 'female'
                        ? memberList(`genderValues.${member.gender}`)
                        : memberList('other')
                      : memberList('notSpecified')}
                  </span>
                </td>
                <td className="p-2">
                  {(() => {
                    const badgeProps = getMembershipStatusBadgeProps(
                      member.membershipStatus!
                    );
                    return (
                      <Badge
                        variant={badgeProps.variant}
                        className={`text-xs test-classname ${badgeProps?.className ?? ''}`}
                      >
                        {memberList(`filters.${member.membershipStatus}`)}
                      </Badge>
                    );
                  })()}
                </td>
                <td className="p-2">
                  {member.isPlayer ? (
                    <Badge variant="outline" className="text-blue-600">
                      {memberList('playerBadge')}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex flex-col items-start gap-2">
                    {!readOnly && member.accountSetup && (
                      <AccountSetupSummary
                        summary={member.accountSetup}
                        accountName={member.fullName}
                        onReissue={onSendEmail}
                        isReissuing={reissuingUserId === member.id}
                        isReissueDisabled={Boolean(reissuingUserId)}
                      />
                    )}
                    {!readOnly && (
                      <div className="flex items-center gap-2">
                        {member.passwordRecoveryAvailable && (
                          <PasswordRecoveryAction
                            userId={member.id}
                            accountName={member.fullName}
                            presentation="standalone-menu"
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(member)}
                          className="h-8 w-8 p-0"
                          aria-label={memberList('editNamed', {
                            name: member.fullName,
                          })}
                        >
                          <Edit2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(member)}
                          className="h-8 w-8 p-0 hover:text-destructive"
                          aria-label={memberList('deleteNamed', {
                            name: member.fullName,
                          })}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile task list */}
      <div className="divide-y md:hidden" data-testid="mobile-member-list">
        {members.map((member) => {
          const badgeProps = getMembershipStatusBadgeProps(
            member.membershipStatus!
          );
          const setupNeedsAttention =
            member.accountSetup &&
            member.accountSetup.accountOnboardingStatus !==
              AccountOnboardingStatus.READY;

          return (
            <article key={member.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-start gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{member.fullName}</h3>
                    <p className="break-all text-sm text-muted-foreground">
                      {member.email}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant={badgeProps.variant}
                      className={`text-xs ${badgeProps.className ?? ''}`}
                    >
                      {memberList(`filters.${member.membershipStatus}`)}
                    </Badge>
                    {member.administratorDesignation && (
                      <Badge
                        variant="outline"
                        className="text-xs text-purple-600"
                      >
                        {memberList('administratorBadgeShort')}
                      </Badge>
                    )}
                    {member.accountSuspension && (
                      <Badge variant="destructive" className="text-xs">
                        {memberList('accountSuspended')}
                      </Badge>
                    )}
                    {member.isPlayer && (
                      <Badge
                        variant="outline"
                        className="text-xs text-blue-600"
                      >
                        {memberList('playerBadge')}
                      </Badge>
                    )}
                  </div>

                  {!readOnly && setupNeedsAttention && member.accountSetup && (
                    <AccountSetupSummary
                      summary={member.accountSetup}
                      accountName={member.fullName}
                      onReissue={onSendEmail}
                      isReissuing={reissuingUserId === member.id}
                      isReissueDisabled={Boolean(reissuingUserId)}
                      presentation="compact-status"
                    />
                  )}
                </div>

                {!readOnly && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        aria-label={memberList('actionsFor', {
                          name: member.fullName,
                        })}
                      >
                        <MoreHorizontal
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(member)}>
                        <Edit2 aria-hidden="true" />
                        {memberList('edit')}
                      </DropdownMenuItem>
                      {member.accountSetup?.reissueAvailable && (
                        <DropdownMenuItem
                          disabled={Boolean(reissuingUserId)}
                          onSelect={() => onSendEmail(member.id)}
                        >
                          <Mail aria-hidden="true" />
                          {reissuingUserId === member.id
                            ? accountSetup('reissuing')
                            : accountSetup('reissue')}
                        </DropdownMenuItem>
                      )}
                      {member.passwordRecoveryAvailable && (
                        <PasswordRecoveryAction
                          userId={member.id}
                          accountName={member.fullName}
                          presentation="menu"
                        />
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => onDelete(member)}
                      >
                        <Trash2 aria-hidden="true" />
                        {memberList('deleteAccount')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
};

// Export memoized version to prevent unnecessary re-renders
export const MemberTable = React.memo(MemberTableComponent);
