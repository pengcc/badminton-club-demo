import { MembershipStatus, UserRole } from '@club/shared-types/core/enums';

// Badge variant types matching shadcn/ui Badge component
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

/**
 * Get Badge component props for a given membership status
 *
 * @param status - The membership status enum value
 * @returns Badge props (variant and label)
 */
export function getMembershipStatusBadgeProps(status: MembershipStatus): BadgeProps {
  switch (status) {
    case MembershipStatus.ACTIVE:
      return { variant: 'default', label: 'Active', className: 'bg-green-600' };
    case MembershipStatus.INACTIVE:
      return { variant: 'secondary', label: 'Inactive' };
    case MembershipStatus.SUSPENDED:
      return { variant: 'destructive', label: 'Suspended' };
    default:
      return { variant: 'outline', label: status };
  }
}

/**
 * Get Badge component props for a given user role
 *
 * @param role - The user role enum value
 * @returns Badge props (variant and label)
 */
export function getUserRoleBadgeProps(role: UserRole): BadgeProps {
  switch (role) {
    case UserRole.ADMIN:
      return { variant: 'default', label: 'Admin' };
    case UserRole.MEMBER:
      return { variant: 'secondary', label: 'Member' };
    case UserRole.APPLICANT:
      return { variant: 'outline', label: 'Applicant' };
    case UserRole.GUEST_PLAYER:
      return { variant: 'outline', label: 'Guest' };
    default:
      return { variant: 'outline', label: role };
  }
}
