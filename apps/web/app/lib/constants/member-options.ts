import { UserRole, Gender, MembershipStatus } from '@club/shared-types/core/enums';

/**
 * Member management roles
 * Excludes APPLICANT (used only in membership application flow)
 */
export const MEMBER_ROLES = [
  {
    value: UserRole.ADMIN,
    label: 'Admin',
    i18nKey: 'roles.admin',
    description: 'Full system access'
  },
  {
    value: UserRole.MEMBER,
    label: 'Member',
    i18nKey: 'roles.member',
    description: 'Standard member'
  },
  {
    value: UserRole.GUEST_PLAYER,
    label: 'Guest Player',
    i18nKey: 'roles.guestPlayer',
    description: 'Temporary participant'
  }
] as const;

/**
 * Gender options for member profiles
 */
export const GENDERS = [
  { value: Gender.MALE, label: 'Male', i18nKey: 'gender.male' },
  { value: Gender.FEMALE, label: 'Female', i18nKey: 'gender.female' },
  { value: Gender.NON_BINARY, label: 'Non-binary', i18nKey: 'gender.nonBinary' }
] as const;

/**
 * Membership status options
 */
export const MEMBERSHIP_STATUSES = [
  { value: MembershipStatus.ACTIVE, label: 'Active', i18nKey: 'membershipStatus.active' },
  { value: MembershipStatus.INACTIVE, label: 'Inactive', i18nKey: 'membershipStatus.inactive' },
  { value: MembershipStatus.SUSPENDED, label: 'Suspended', i18nKey: 'membershipStatus.suspended' }
] as const;

/**
 * Player status filter options (for filtering only)
 */
export const PLAYER_FILTER_OPTIONS = [
  { value: 'yes', label: 'Players Only', i18nKey: 'filter.playersOnly' },
  { value: 'no', label: 'Non-Players Only', i18nKey: 'filter.nonPlayersOnly' }
] as const;

// Type exports for type safety
export type MemberRoleOption = typeof MEMBER_ROLES[number];
export type GenderOption = typeof GENDERS[number];
export type MembershipStatusOption = typeof MEMBERSHIP_STATUSES[number];
export type PlayerFilterOption = typeof PLAYER_FILTER_OPTIONS[number];
