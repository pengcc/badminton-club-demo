import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ reissueForUser: vi.fn() }));
vi.mock('../../services/passwordSetupDeliveryService', () => ({
  PasswordSetupDeliveryService: {
    reissueForUser: mocks.reissueForUser,
  },
}));

import { UserController } from '../../controllers/userController';

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('User password setup reissue controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the generation-bound delivery outcome without a credential', async () => {
    const result = { generation: 3, deliveryStatus: 'uncertain' as const };
    mocks.reissueForUser.mockResolvedValue(result);
    const res = response();

    await UserController.sendInvitation(
      { params: { id: '507f1f77bcf86cd799439012' } } as never,
      res as never
    );

    expect(mocks.reissueForUser).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439012'
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Password setup reissued',
      data: result,
    });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('token');
  });
});
