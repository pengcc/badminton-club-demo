import { MembershipStatus } from '@club/shared-types/core/enums';

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
export function getMembershipStatusBadgeProps(
  status: MembershipStatus
): BadgeProps {
  switch (status) {
    case MembershipStatus.ACTIVE:
      return { variant: 'default', label: 'Active', className: 'bg-green-600' };
    case MembershipStatus.PASSIVE:
      return { variant: 'secondary', label: 'Passive' };
    case MembershipStatus.INACTIVE:
      return { variant: 'secondary', label: 'Inactive' };
    default:
      return { variant: 'outline', label: status };
  }
}
