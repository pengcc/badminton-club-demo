import { describe, expect, it } from 'vitest';
import { readFreshDemoInputs } from '../../scripts/bootstrapFreshPublicDemo';

const environment = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://localhost/explicit-demo',
  SHOWCASE_DEMO_ADMIN_EMAIL: 'demo.admin@club.invalid',
  SHOWCASE_DEMO_ADMIN_PASSWORD: 'Synthetic-bootstrap-test-only',
};

describe('fresh demo operator admission', () => {
  it.each(
    Object.keys(environment)
  )('rejects missing %s without echoing inputs', (key) => {
    expect(() =>
      readFreshDemoInputs(['--fresh-empty-target'], {
        ...environment,
        [key]: undefined,
      })
    ).toThrow('FRESH_DEMO_INPUTS_REQUIRED');
  });
  it.each([
    [],
    ['--all'],
    ['--fresh-empty-target', '--reset'],
  ])('requires only the explicit acknowledgement: %j', (...args) => {
    expect(() => readFreshDemoInputs(args, environment)).toThrow(
      'FRESH_DEMO_INPUTS_REQUIRED'
    );
  });
  it.each([
    'admin123',
    'member123',
    'demo1234',
    '<public-demo-password>',
    'short',
    'x'.repeat(73),
  ])('rejects unsuitable passwords', (password) => {
    expect(() =>
      readFreshDemoInputs(['--fresh-empty-target'], {
        ...environment,
        SHOWCASE_DEMO_ADMIN_PASSWORD: password,
      })
    ).toThrow('FRESH_DEMO_INPUTS_REQUIRED');
  });
  it('requires the actual seed Demo identity', () => {
    expect(() =>
      readFreshDemoInputs(['--fresh-empty-target'], {
        ...environment,
        SHOWCASE_DEMO_ADMIN_EMAIL: 'admin@club.invalid',
      })
    ).toThrow('FRESH_DEMO_INPUTS_REQUIRED');
  });
});
