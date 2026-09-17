import assert from 'node:assert/strict';
import test from 'node:test';

import { SECRET_FINDING_LEVEL, scanSecretSafety } from './secret-safety.mjs';

function addedLine(path, line) {
  return `diff --git a/${path} b/${path}\n+++ b/${path}\n+${line}`;
}

function quotedValue(value) {
  return [String.fromCharCode(34), value, String.fromCharCode(34)].join('');
}

function genericCredentialFindings(diff) {
  return scanSecretSafety({ diff }).filter(
    ({ rule }) => rule === 'generic-credential-literal'
  );
}

test('generic credential scanning ignores the original source-code expression triggers', () => {
  const findings = genericCredentialFindings(
    addedLine(
      'formatter.ts',
      [
        `${['to', 'ken'].join('')}: accessToken,`,
        `${['to', 'ken'].join('')}: z.string().min(20).max(200),`,
      ].join('\n+')
    )
  );

  assert.deepEqual(findings, []);
});

test('generic credential scanning ignores representative source-code references and calls', () => {
  const identifier = ['to', 'ken'].join('');
  const findings = genericCredentialFindings(
    addedLine(
      'configuration.ts',
      [
        `${identifier}: process.env.ACCESS_TOKEN,`,
        `${['sec', 'ret'].join('')}: config.secret,`,
        `${['api', 'Key'].join('')}: resolveApiKey(),`,
      ].join('\n+')
    )
  );

  assert.deepEqual(findings, []);
});

test('generic credential scanning retains quoted literals including spaces', () => {
  const identifier = ['sec', 'ret'].join('');
  const value = quotedValue(['realistic secret', 'value'].join(' '));
  const findings = genericCredentialFindings(
    addedLine('configuration.ts', `${identifier}: ${value},`)
  );

  assert.deepEqual(
    findings.map(({ level }) => level),
    [SECRET_FINDING_LEVEL.REVIEW_REQUIRED]
  );
});

test('generic credential scanning retains unquoted non-code credential values', () => {
  const identifier = ['to', 'ken'].join('');
  const value = ['release', 'credential', 'value'].join('_');
  const findings = genericCredentialFindings(
    addedLine('configuration.yml', `${identifier}: ${value}`)
  );

  assert.deepEqual(
    findings.map(({ level }) => level),
    [SECRET_FINDING_LEVEL.REVIEW_REQUIRED]
  );
});

test('high-confidence credential detection remains blocking', () => {
  const findings = scanSecretSafety({
    diff: addedLine(
      'configuration.ts',
      `${['to', 'ken'].join('')}: ${quotedValue(['sk', 'x'.repeat(24)].join('-'))},`
    ),
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, SECRET_FINDING_LEVEL.HIGH_CONFIDENCE);
  assert.equal(findings[0].rule, 'openai-api-key');
});

test('password scanning distinguishes source expressions from quoted credentials', () => {
  const identifier = ['pass', 'word'].join('');
  for (const expression of [
    'environment.PUBLIC_DEMO_PASSWORD',
    'passwordFor(user.email, user.password)',
    'randomBytes(32).toString()',
  ]) {
    assert.deepEqual(
      scanSecretSafety({
        diff: addedLine('bootstrap.ts', `${identifier}: ${expression}`),
      }),
      []
    );
  }
  const value = ['realistic', 'Credential', '123!'].join('');
  assert.ok(
    scanSecretSafety({
      diff: addedLine('bootstrap.ts', `${identifier}: ${quotedValue(value)}`),
    }).some(({ rule }) => rule === 'hard-coded-password')
  );
  assert.ok(
    scanSecretSafety({
      diff: addedLine('config.txt', `${identifier}=${value}`),
    }).some(({ rule }) => rule === 'hard-coded-password')
  );
});
