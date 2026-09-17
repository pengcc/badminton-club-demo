import { config } from '../config';
import type { AuthUser } from '@club/shared-types/core/middlewareAuth';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PUBLIC_MUTATION_ALLOWLIST = [
  ['POST', /^\/api\/auth\/login\/?$/],
  ['POST', /^\/api\/auth\/logout\/?$/],
  ['POST', /^\/api\/demo-editing\/(start|finish)\/?$/],
  ['POST', /^\/api\/announcements\/?$/],
  ['PUT', /^\/api\/announcements\/[^/]+\/?$/],
  ['POST', /^\/api\/matches\/?$/],
  ['PUT', /^\/api\/matches\/[^/]+\/?$/],
] as const;

const DEMO_ADMIN_READ_ALLOWLIST = [
  /^\/api\/auth\/verify\/?$/,
  /^\/api\/demo-editing\/status\/?$/,
  /^\/api\/users\/filter(?:\?.*)?$/,
  /^\/api\/players\/(?:active\/list|[a-f\d]{24})\/?(?:\?.*)?$/i,
  /^\/api\/teams(?:\/[a-f\d]{24}(?:\/players|\/stats)?)?\/?(?:\?.*)?$/i,
  /^\/api\/matches(?:\/[^?]*)?(?:\?.*)?$/,
  /^\/api\/announcements(?:\/.*)?$/,
  /^\/api\/activities(?:\/[^?]*)?(?:\?.*)?$/,
] as const;

export class DemoRuntimePolicyService {
  static enabled(): boolean {
    return config.demoRuntime.enabled;
  }

  static isDemoAdmin(user: Pick<AuthUser, 'email'>): boolean {
    return Boolean(
      config.demoRuntime.enabled &&
        config.demoRuntime.adminEmail &&
        user.email.trim().toLowerCase() === config.demoRuntime.adminEmail
    );
  }

  static permitsPublicMutation(method: string, path: string): boolean {
    if (!config.demoRuntime.enabled) return true;
    // Email verification mutates account state, including through Express's HEAD fallback.
    if (
      (method === 'GET' || method === 'HEAD') &&
      /^\/api\/users\/verify-email-change\/[^/?]+\/?(?:\?.*)?$/i.test(path)
    ) {
      return false;
    }
    if (SAFE_METHODS.has(method)) return true;
    return PUBLIC_MUTATION_ALLOWLIST.some(
      ([candidateMethod, pattern]) =>
        candidateMethod === method && pattern.test(path)
    );
  }

  static permitsProtectedRequest(
    user: AuthUser,
    method: string,
    path: string
  ): boolean {
    if (!config.demoRuntime.enabled) return true;
    if (!this.isDemoAdmin(user)) {
      return method === 'POST' && /^\/api\/auth\/logout\/?$/.test(path);
    }
    if (!SAFE_METHODS.has(method)) {
      return this.permitsPublicMutation(method, path);
    }
    return DEMO_ADMIN_READ_ALLOWLIST.some((pattern) => pattern.test(path));
  }
}
