import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import {
  MEMBER_CSV_HEADERS,
  decodeMemberCsvValue,
  type MemberCsvRowResult,
} from '@club/shared-types/api/memberCsv';
import { accountEstablishmentSchema } from '@club/shared-types/schemas/accountOnboarding';
import type { EstablishMemberCommand } from '@club/shared-types/domain/accountOnboarding';
import { AppError } from '../utils/errors';

export const MEMBER_CSV_MAX_BYTES = 1024 * 1024;
export const MEMBER_CSV_MAX_ROWS = 1000;
export interface MemberCsvRow {
  result: MemberCsvRowResult;
  input?: Pick<
    EstablishMemberCommand,
    | 'identity'
    | 'initialMembershipStatus'
    | 'membershipType'
    | 'establishPlayer'
  >;
}
export function digest(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
export function normalizeIdentity(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}
export function parseMemberCsv(buffer: Buffer): MemberCsvRow[] {
  if (!buffer.length || buffer.length > MEMBER_CSV_MAX_BYTES) {
    throw new AppError(
      'Member CSV size is invalid',
      400,
      'MEMBER_CSV_INVALID_FILE'
    );
  }
  let records: string[][];
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    records = parse(text, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });
  } catch {
    throw new AppError(
      'Member CSV structure is invalid',
      400,
      'MEMBER_CSV_INVALID_FILE'
    );
  }
  const header = records.shift() ?? [];
  if (
    header.length !== MEMBER_CSV_HEADERS.length ||
    new Set(header).size !== header.length ||
    MEMBER_CSV_HEADERS.some((name) => !header.includes(name)) ||
    !records.length ||
    records.length > MEMBER_CSV_MAX_ROWS
  ) {
    throw new AppError(
      'Member CSV headers or row count are invalid',
      400,
      'MEMBER_CSV_INVALID_FILE'
    );
  }
  const rows = records.map((values, index): MemberCsvRow => {
    const fields = Object.fromEntries(
      header.map((name, i) => [
        name,
        decodeMemberCsvValue(values[i] ?? '').trim(),
      ])
    );
    const result: MemberCsvRowResult = {
      rowNumber: index + 2,
      name: `${fields['First Name']} ${fields['Last Name']}`.slice(0, 220),
      email: fields.Email.slice(0, 255),
      outcome: 'invalid',
      changes: [],
      reason: 'invalid_values',
    };
    const row: MemberCsvRow = {
      result,
    };
    const address = [fields.Street, fields['Postal code'], fields.City];
    if (
      values.length !== header.length ||
      (address.some(Boolean) && !address.every(Boolean)) ||
      !['', 'false', 'true'].includes(fields['Ensure Player'])
    )
      return row;
    const parsed = accountEstablishmentSchema.safeParse({
      targetKind: 'member',
      firstName: fields['First Name'],
      lastName: fields['Last Name'],
      email: fields.Email,
      gender: fields.Gender,
      dateOfBirth: fields['Date of birth'],
      phone: fields.Phone || undefined,
      address: address.every(Boolean)
        ? {
            street: fields.Street,
            postalCode: fields['Postal code'],
            city: fields.City,
            country: 'Deutschland',
          }
        : undefined,
      initialMembershipStatus: fields['Membership status'],
      membershipType: fields['Membership type'] || undefined,
      establishPlayer: fields['Ensure Player'] === 'true',
      sendPasswordSetupEmailNow: false,
    });
    if (!parsed.success || parsed.data.targetKind !== 'member') return row;
    const {
      targetKind: _target,
      initialMembershipStatus,
      membershipType,
      establishPlayer,
      setupLocale: _locale,
      sendPasswordSetupEmailNow: _send,
      ...identity
    } = parsed.data;
    row.input = {
      identity,
      initialMembershipStatus,
      membershipType,
      establishPlayer,
    };
    row.result = {
      ...result,
      email: identity.email,
      outcome: 'unchanged',
      reason: undefined,
    };
    return row;
  });
  const emails = new Map<string, MemberCsvRow[]>();
  const identities = new Map<string, MemberCsvRow[]>();
  for (const row of rows) {
    // Invalid rows still participate in email ambiguity detection.
    const email = row.result.email.trim().toLowerCase();
    emails.set(email, [...(emails.get(email) ?? []), row]);
    if (row.input) {
      const { firstName, lastName, dateOfBirth } = row.input.identity;
      const key = JSON.stringify([
        normalizeIdentity(firstName),
        normalizeIdentity(lastName),
        dateOfBirth,
      ]);
      identities.set(key, [...(identities.get(key) ?? []), row]);
    }
  }
  for (const group of identities.values())
    if (new Set(group.map((r) => r.result.email)).size > 1) {
      for (const row of group)
        row.result = {
          ...row.result,
          outcome: 'review_required',
          reason: 'identity_candidate',
        };
    }
  for (const group of emails.values())
    if (group.length > 1) {
      for (const row of group)
        row.result = {
          ...row.result,
          outcome: 'invalid',
          reason: 'duplicate_email',
        };
    }
  return rows;
}
