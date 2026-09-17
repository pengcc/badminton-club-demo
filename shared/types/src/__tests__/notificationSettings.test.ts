import { describe, expect, it } from 'vitest';
import { notificationRecipientTypes } from '../api/notificationSettings';

describe('Notification Settings API contract', () => {
  it('contains only the three capability-owned administrator alert families', () => {
    expect(notificationRecipientTypes).toEqual([
      'applicationAlerts',
      'tasterSessionAlerts',
      'guestPlayAlerts',
    ]);
  });
});
