import { describe, expect, it } from 'vitest';
import { AccountKind, Capability } from '@club/shared-types/core/enums';
import { RegistrationApprovalService } from '../../services/registrationApprovalService';

const actor = {
  id: '507f1f77bcf86cd799439011',
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  administratorDesignation: true,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
};

describe('RegistrationApprovalService input boundary', () => {
  it('rejects malformed application identity before opening a transaction', async () => {
    await expect(
      RegistrationApprovalService.approve({
        applicationId: 'not-an-object-id',
        idempotencyKey: 'approval-key',
        actor,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects short idempotency keys before opening a transaction', async () => {
    await expect(
      RegistrationApprovalService.approve({
        applicationId: '507f1f77bcf86cd799439012',
        idempotencyKey: 'short',
        actor,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
