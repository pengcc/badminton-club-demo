import { UserRole } from '@club/shared-types/core/enums';

export const ADMIN_ROLES = [UserRole.ADMIN];
export const MEMBER_ROLES = [...ADMIN_ROLES, UserRole.MEMBER];