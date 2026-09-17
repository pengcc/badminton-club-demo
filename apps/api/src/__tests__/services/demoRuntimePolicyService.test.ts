import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountKind, Capability } from '@club/shared-types/core/enums';
import type { AuthUser } from '@club/shared-types/core/middlewareAuth';
import { config } from '../../config';
import { DemoRuntimePolicyService } from '../../services/demoRuntimePolicyService';

const originalDemoRuntime = { ...config.demoRuntime };
const demoAdmin: AuthUser = {
  id: 'demo-user',
  email: 'demo.admin@club.invalid',
  firstName: 'Demo',
  lastName: 'Administrator',
  displayName: 'Demo Administrator',
  accountKind: AccountKind.PERSON,
  capabilities: [Capability.ADMINISTRATION],
};

beforeEach(() => {
  config.demoRuntime.enabled = true;
  config.demoRuntime.adminEmail = demoAdmin.email;
});

afterEach(() => {
  config.demoRuntime.enabled = originalDemoRuntime.enabled;
  config.demoRuntime.adminEmail = originalDemoRuntime.adminEmail;
});

describe('public demo runtime policy', () => {
  it.each([
    'GET',
    'HEAD',
  ])('denies state-changing email verification via %s only in demo runtime', (method) => {
    for (const path of [
      '/api/users/verify-email-change/test-token',
      '/api/users/verify-email-change/test-token/?source=test',
      '/API/Users/Verify-Email-Change/test-token',
    ]) {
      expect(DemoRuntimePolicyService.permitsPublicMutation(method, path)).toBe(
        false
      );
      config.demoRuntime.enabled = false;
      expect(DemoRuntimePolicyService.permitsPublicMutation(method, path)).toBe(
        true
      );
      config.demoRuntime.enabled = true;
    }
  });

  it('preserves safe reads, OPTIONS, login, logout, and scratch-session entry', () => {
    for (const [method, path] of [
      ['GET', '/api/demo-runtime'],
      ['HEAD', '/api/teams/public'],
      ['OPTIONS', '/api/users/verify-email-change/test-token'],
      ['POST', '/api/auth/login'],
      ['POST', '/api/auth/logout'],
      ['POST', '/api/demo-editing/start'],
      ['POST', '/api/demo-editing/finish'],
    ]) {
      expect(DemoRuntimePolicyService.permitsPublicMutation(method, path)).toBe(
        true
      );
    }
  });

  it('denies unsafe mutations by default and admits only the scratch boundary', () => {
    expect(
      DemoRuntimePolicyService.permitsPublicMutation(
        'POST',
        '/api/membership-applications'
      )
    ).toBe(false);
    expect(
      DemoRuntimePolicyService.permitsPublicMutation(
        'DELETE',
        '/api/announcements/507f1f77bcf86cd799439011'
      )
    ).toBe(false);
    expect(
      DemoRuntimePolicyService.permitsPublicMutation(
        'POST',
        '/api/announcements'
      )
    ).toBe(true);
    expect(
      DemoRuntimePolicyService.permitsPublicMutation(
        'PUT',
        '/api/matches/507f1f77bcf86cd799439011'
      )
    ).toBe(true);
  });

  it('restricts the Demo Admin to approved read projections', () => {
    expect(
      DemoRuntimePolicyService.permitsProtectedRequest(
        demoAdmin,
        'GET',
        '/api/players'
      )
    ).toBe(false);
    expect(
      DemoRuntimePolicyService.permitsProtectedRequest(
        demoAdmin,
        'GET',
        '/api/users/filter?page=1'
      )
    ).toBe(true);
    expect(
      DemoRuntimePolicyService.permitsProtectedRequest(
        demoAdmin,
        'GET',
        '/api/teams'
      )
    ).toBe(true);
    expect(
      DemoRuntimePolicyService.permitsProtectedRequest(
        demoAdmin,
        'GET',
        '/api/players/507f1f77bcf86cd799439011'
      )
    ).toBe(true);
    expect(
      DemoRuntimePolicyService.permitsProtectedRequest(
        demoAdmin,
        'GET',
        '/api/announcements'
      )
    ).toBe(true);
    expect(
      DemoRuntimePolicyService.permitsProtectedRequest(
        demoAdmin,
        'GET',
        '/api/matches?view=all'
      )
    ).toBe(true);
    expect(
      DemoRuntimePolicyService.permitsProtectedRequest(
        demoAdmin,
        'GET',
        '/api/activities?language=en'
      )
    ).toBe(true);
    expect(
      DemoRuntimePolicyService.permitsProtectedRequest(
        demoAdmin,
        'GET',
        '/api/audit-logs'
      )
    ).toBe(false);
    expect(
      DemoRuntimePolicyService.permitsProtectedRequest(
        demoAdmin,
        'POST',
        '/api/users'
      )
    ).toBe(false);
  });

  it('fails closed for every other authenticated account', () => {
    const otherAdmin = {
      ...demoAdmin,
      id: 'other',
      email: 'admin@club.invalid',
    };

    expect(
      DemoRuntimePolicyService.permitsProtectedRequest(
        otherAdmin,
        'GET',
        '/api/users/filter'
      )
    ).toBe(false);
    expect(
      DemoRuntimePolicyService.permitsProtectedRequest(
        otherAdmin,
        'POST',
        '/api/auth/logout'
      )
    ).toBe(true);
  });
});
