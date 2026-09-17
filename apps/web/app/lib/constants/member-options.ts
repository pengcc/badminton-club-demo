import { Gender, MembershipStatus } from '@club/shared-types/core/enums';

/**
 * Gender options for member profiles
 */
export const GENDERS = [
  { value: Gender.MALE, label: 'Male', i18nKey: 'gender.male' },
  { value: Gender.FEMALE, label: 'Female', i18nKey: 'gender.female' },
  {
    value: Gender.NON_BINARY,
    label: 'Non-binary',
    i18nKey: 'gender.nonBinary',
  },
] as const;

/**
 * Membership status options
 */
export const MEMBERSHIP_STATUSES = [
  {
    value: MembershipStatus.ACTIVE,
    label: 'Active',
    i18nKey: 'membershipStatus.active',
  },
  {
    value: MembershipStatus.PASSIVE,
    label: 'Passive',
    i18nKey: 'membershipStatus.passive',
  },
  {
    value: MembershipStatus.INACTIVE,
    label: 'Inactive',
    i18nKey: 'membershipStatus.inactive',
  },
] as const;

export const CURRENT_MEMBERSHIP_STATUSES = MEMBERSHIP_STATUSES.filter(
  ({ value }) =>
    value === MembershipStatus.ACTIVE || value === MembershipStatus.PASSIVE
);

/**
 * Player status filter options (for filtering only)
 */
export const PLAYER_FILTER_OPTIONS = [
  { value: 'yes', label: 'Players Only', i18nKey: 'filter.playersOnly' },
  { value: 'no', label: 'Non-Players Only', i18nKey: 'filter.nonPlayersOnly' },
] as const;

// Type exports for type safety
export type GenderOption = (typeof GENDERS)[number];
export type MembershipStatusOption = (typeof MEMBERSHIP_STATUSES)[number];
export type PlayerFilterOption = (typeof PLAYER_FILTER_OPTIONS)[number];
