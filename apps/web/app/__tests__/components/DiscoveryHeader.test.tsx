import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getActivitiesAvailability = vi.hoisted(() => vi.fn());

vi.mock('@app/lib/data/getActivitiesAvailability', () => ({
  getActivitiesAvailability,
}));
vi.mock('@app/components/Header', () => ({
  default: ({ activitiesEnabled }: { activitiesEnabled?: boolean }) => (
    <div data-testid="header" data-activities={String(activitiesEnabled)} />
  ),
}));

import DiscoveryHeader from '@app/components/DiscoveryHeader';

describe('DiscoveryHeader', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [{ status: 'ready', data: { enabled: true } }, 'true'],
    [{ status: 'ready', data: { enabled: false } }, 'false'],
    [{ status: 'unavailable' }, 'false'],
  ])('passes a fail-closed availability projection to navigation', async (result, expected) => {
    getActivitiesAvailability.mockResolvedValue(result);
    render(await DiscoveryHeader({ lang: 'en' }));

    expect(screen.getByTestId('header')).toHaveAttribute(
      'data-activities',
      expected
    );
  });
});
