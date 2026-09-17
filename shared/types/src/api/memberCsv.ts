import type { Api } from './user';
import { PlayerType } from '../core/enums';

export const MEMBER_CSV_HEADERS = [
  'First Name',
  'Last Name',
  'Email',
  'Gender',
  'Date of birth',
  'Phone',
  'Street',
  'Postal code',
  'City',
  'Membership status',
  'Membership type',
  'Ensure Player',
] as const;

export type MemberCsvOutcome =
  | 'create'
  | 'update'
  | 'unchanged'
  | 'review_required'
  | 'conflict'
  | 'invalid';
export type MemberCsvChange =
  | 'gender'
  | 'phone'
  | 'address'
  | 'membership'
  | 'player';
export type MemberCsvReason =
  | 'invalid_values'
  | 'duplicate_email'
  | 'identity_candidate'
  | 'identity_mismatch'
  | 'protected_account'
  | 'membership_type'
  | 'inactive_person'
  | 'player_state'
  | 'stale';
export interface MemberCsvRowResult {
  rowNumber: number;
  name: string;
  email: string;
  outcome: MemberCsvOutcome;
  changes: MemberCsvChange[];
  reason?: MemberCsvReason;
}
export interface MemberCsvResult {
  rows: MemberCsvRowResult[];
  counts: Record<MemberCsvOutcome, number>;
}
export interface MemberCsvPreview extends MemberCsvResult {
  previewContext: string;
}
export interface MemberCsvApply extends MemberCsvResult {
  status: 'completed' | 'partial' | 'incomplete';
  auditSummary: 'written' | 'failed' | 'not_attempted';
}

/** Reversible companion to the existing spreadsheet-safe CSV serializer. */
export function encodeMemberCsvValue(value: string): string {
  return /^[=+\-@\t\r']/.test(value) ? `'${value}` : value;
}
export function decodeMemberCsvValue(value: string): string {
  return /^'[=+\-@\t\r']/.test(value) ? value.slice(1) : value;
}

export function portableMemberCsvValues(
  member: Api.RichMemberExportRow
): Record<(typeof MEMBER_CSV_HEADERS)[number], string> {
  const values = {
    'First Name': member.firstName ?? '',
    'Last Name': member.lastName ?? '',
    Email: member.email,
    Gender: member.gender ?? '',
    'Date of birth': member.dateOfBirth ?? '',
    Phone: member.phone ?? '',
    Street: member.address?.street ?? '',
    'Postal code': member.address?.postalCode ?? '',
    City: member.address?.city ?? '',
    'Membership status': member.membershipStatus,
    'Membership type': member.membershipType ?? '',
    'Ensure Player':
      member.player?.type === PlayerType.MEMBER && member.player.isActivePlayer
        ? 'true'
        : '',
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      encodeMemberCsvValue(value),
    ])
  ) as Record<(typeof MEMBER_CSV_HEADERS)[number], string>;
}
