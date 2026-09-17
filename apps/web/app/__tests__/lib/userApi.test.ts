import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('../../lib/api/client', () => ({ default: client }));

import {
  requestEmailChange,
  transitionMembershipActivity,
} from '../../lib/api/userApi';

describe('User API adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.post.mockResolvedValue({
      data: {
        success: true,
        data: { pendingEmail: 'next@example.test' },
      },
    });
  });

  it('preserves the email-change request and response shape', async () => {
    const request = { newEmail: 'next@example.test', locale: 'en' as const };

    await expect(requestEmailChange(request)).resolves.toEqual({
      pendingEmail: request.newEmail,
    });
    expect(client.post).toHaveBeenCalledWith(
      '/users/request-email-change',
      request
    );
  });

  it('sends a bounded active/passive lifecycle command with retained identity', async () => {
    client.post.mockResolvedValue({
      data: { success: true, data: { id: 'member-1' } },
    });

    await transitionMembershipActivity(
      'member-1',
      'passive',
      'Annual classification',
      'request-key'
    );

    expect(client.post).toHaveBeenCalledWith(
      '/users/member-1/membership-activity',
      { targetStatus: 'passive', reason: 'Annual classification' },
      { headers: { 'Idempotency-Key': 'request-key' } }
    );
  });
});
