import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountKind, Capability } from '@club/shared-types/core/enums';

const mocks = vi.hoisted(() => ({ approve: vi.fn() }));
vi.mock('../../services/registrationApprovalService', () => ({
  RegistrationApprovalService: { approve: mocks.approve },
}));

import { MembershipApplicationController } from '../../controllers/membershipApplicationController';

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

const user = {
  id: '507f1f77bcf86cd799439011',
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  administratorDesignation: true,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
};

describe('membership application approval controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires a retained Idempotency-Key', async () => {
    const next = vi.fn();
    await MembershipApplicationController.approveApplication(
      {
        body: {},
        params: { id: '507f1f77bcf86cd799439012' },
        user,
        get: vi.fn(),
      } as never,
      response() as never,
      next
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it('passes normalized request identity and returns the stable result', async () => {
    const result = {
      applicationId: 'a',
      userId: 'u',
      setupGeneration: 1,
      setupRequired: true,
      replayed: false,
      deliveryStatus: 'sent',
      decisionDeliveryStatus: 'sent',
    };
    mocks.approve.mockResolvedValue(result);
    const res = response();
    await MembershipApplicationController.approveApplication(
      {
        body: { reviewNote: 'Internal', approvalMessage: 'Welcome' },
        params: { id: '507f1f77bcf86cd799439012' },
        user,
        ip: '127.0.0.1',
        get: vi.fn((name: string) =>
          name === 'Idempotency-Key' ? 'approval-key-1' : undefined
        ),
      } as never,
      res as never,
      vi.fn()
    );
    expect(mocks.approve).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'approval-key-1',
        reviewNote: 'Internal',
        approvalMessage: 'Welcome',
        actor: expect.objectContaining({ id: user.id }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: result })
    );
  });
});
