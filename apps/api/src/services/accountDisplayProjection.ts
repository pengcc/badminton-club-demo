import { AccountKind } from '@club/shared-types/core/enums';

export const ACCOUNT_DISPLAY_PROJECTION =
  '_id accountKind firstName lastName' as const;

interface AccountDisplaySource {
  _id?: { toString(): string } | string;
  accountKind?: AccountKind;
  firstName?: string;
  lastName?: string;
}

export interface AccountDisplayReference {
  id: string;
  name: string;
}

export function accountDisplayName(account: AccountDisplaySource): string {
  if (account.accountKind === AccountKind.SUPER_ADMIN) return 'Super Admin';

  const personName = [account.firstName, account.lastName]
    .filter(
      (part): part is string =>
        typeof part === 'string' && part.trim().length > 0
    )
    .map((part) => part.trim())
    .join(' ');

  return personName || 'Unknown account';
}

export function accountDisplayReference(
  account: AccountDisplaySource | null | undefined
): AccountDisplayReference {
  if (!account?._id) return { id: 'system', name: 'System' };

  return {
    id: account._id.toString(),
    name: accountDisplayName(account),
  };
}
