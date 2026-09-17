import { z } from 'zod';
import { getServerApiBaseUrl } from '@app/lib/api/baseUrl';

const demoRuntimeResponse = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({ enabled: z.boolean() }),
});

export type DemoRuntimeStatus = 'enabled' | 'disabled' | 'unavailable';

export async function getDemoRuntimeStatus(): Promise<DemoRuntimeStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${getServerApiBaseUrl()}/api/demo-runtime`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return 'unavailable';

    const result = demoRuntimeResponse.safeParse(await response.json());
    if (!result.success) return 'unavailable';
    return result.data.data.enabled ? 'enabled' : 'disabled';
  } catch {
    return 'unavailable';
  } finally {
    clearTimeout(timeoutId);
  }
}
