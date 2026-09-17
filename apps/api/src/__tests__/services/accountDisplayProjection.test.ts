import { describe, expect, it } from 'vitest';
import { AccountKind } from '@club/shared-types/core/enums';
import { accountDisplayReference } from '../../services/accountDisplayProjection';

describe('account display projection', () => {
  it('preserves real person and Super Admin identities', () => {
    expect(
      accountDisplayReference({
        _id: 'person-1',
        accountKind: AccountKind.PERSON,
        firstName: 'First',
        lastName: 'Person',
      })
    ).toEqual({ id: 'person-1', name: 'First Person' });
    expect(
      accountDisplayReference({
        _id: 'super-admin-1',
        accountKind: AccountKind.SUPER_ADMIN,
      })
    ).toEqual({ id: 'super-admin-1', name: 'Super Admin' });
  });

  it('uses System only when no account reference exists', () => {
    expect(accountDisplayReference(null)).toEqual({
      id: 'system',
      name: 'System',
    });
    expect(
      accountDisplayReference({
        _id: 'unknown-person',
        accountKind: AccountKind.PERSON,
      })
    ).toEqual({ id: 'unknown-person', name: 'Unknown account' });
  });
});
