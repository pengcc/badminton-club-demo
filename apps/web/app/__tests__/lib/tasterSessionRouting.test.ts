import { describe, expect, it, vi } from 'vitest';

const redirect = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ redirect }));

import LegacyPublicPage from '../../[lang]/trial-training/page';
import LegacyAdminPage from '../../[lang]/dashboard/training/page';
import {
  getDashboardNavigation,
  normalizeDashboardPath,
} from '../../lib/navigation/dashboardNav';

describe('Taster Session route compatibility', () => {
  it('uses the canonical localized administrator path', () => {
    const german = getDashboardNavigation('de').find(
      (item) => item.id === 'taster-sessions'
    );
    const chinese = getDashboardNavigation('zh').find(
      (item) => item.id === 'taster-sessions'
    );

    expect(german?.path).toBe('/de/dashboard/taster-sessions');
    expect(chinese?.path).toBe('/zh/dashboard/taster-sessions');
  });

  it('preserves locale through both established legacy redirects', async () => {
    expect(normalizeDashboardPath('/de/dashboard/training', 'de')).toBe(
      '/de/dashboard/taster-sessions'
    );
    await LegacyPublicPage({
      params: Promise.resolve({ lang: 'de' }),
    });
    await LegacyAdminPage({
      params: Promise.resolve({ lang: 'zh' }),
    });

    expect(redirect).toHaveBeenNthCalledWith(1, '/de/taster-session');
    expect(redirect).toHaveBeenNthCalledWith(
      2,
      '/zh/dashboard/taster-sessions'
    );
  });
});
