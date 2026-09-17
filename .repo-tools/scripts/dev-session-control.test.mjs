import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';
import { runControlCommand } from './dev-session-control.mjs';
import { createProcessInspector } from './development/process-inspector.mjs';

function outputRecorder() {
  const entries = [];
  return {
    entries,
    output: Object.fromEntries(
      ['info', 'success', 'warning', 'danger'].map((level) => [
        level,
        (message) => entries.push([level, message]),
      ])
    ),
  };
}

const listener = {
  classification: 'Badminton-owned',
  port: 3013,
  pid: 200,
  ppid: 190,
  pgid: 190,
  command: 'node --import tsx src/server.ts',
  cwd: '/repo/apps/api',
  worktreeRoot: '/repo',
  gitCommonDir: '/common',
};

function fakeInspector({
  portResults = [listener],
  groupResults = [
    [
      { pid: 190, ppid: 1, pgid: 190, command: 'node pnpm.cjs dev:api' },
      { pid: 200, ppid: 190, pgid: 190, command: listener.command },
    ],
  ],
  cwdByPid = { 190: '/repo', 200: '/repo/apps/api' },
  ownPgid = 999,
} = {}) {
  let portIndex = 0;
  let groupIndex = 0;
  return {
    gitIdentity: async () => ({
      worktreeRoot: '/repo',
      gitCommonDir: '/common',
    }),
    inspectPort: async () =>
      portResults[Math.min(portIndex++, portResults.length - 1)],
    listProcessGroup: async () =>
      groupResults[Math.min(groupIndex++, groupResults.length - 1)],
    processCwd: async (pid) => cwdByPid[pid] ?? null,
    processDetails: async (pid) =>
      pid === process.pid
        ? { pid, ppid: 1, pgid: ownPgid, command: 'node recovery' }
        : { pid, ppid: 1, pgid: 190, command: 'node worker' },
  };
}

test('status is read-only and reports free, same-worktree, partial, mixed, and ambiguous ownership', async () => {
  const cases = [
    {
      states: [
        { classification: 'free', port: 3000 },
        { classification: 'free', port: 3003 },
      ],
      summary: 'free',
    },
    {
      states: [
        { ...listener, port: 3000 },
        { ...listener, port: 3003 },
      ],
      summary: 'same-worktree-pair',
    },
    {
      states: [
        { classification: 'free', port: 3000 },
        { ...listener, port: 3003 },
      ],
      summary: 'partial',
    },
    {
      states: [
        { ...listener, port: 3000 },
        { ...listener, port: 3003, worktreeRoot: '/repo-other' },
      ],
      summary: 'mixed-owner',
    },
    {
      states: [
        {
          classification: 'ambiguous',
          port: 3000,
          reason: 'multiple listeners',
        },
        { classification: 'free', port: 3003 },
      ],
      summary: 'ambiguous',
    },
  ];

  for (const { states, summary } of cases) {
    const { entries, output } = outputRecorder();
    let index = 0;
    const inspector = fakeInspector();
    inspector.inspectPort = async () => states[index++];
    assert.equal(
      await runControlCommand({ mode: 'status', inspector, output }),
      0
    );
    assert.match(entries.at(-1)[1], new RegExp(`Slot summary: ${summary}`));
  }
});

test('status slot arguments use the shared deterministic mapping', async () => {
  const ports = [];
  const inspector = fakeInspector();
  inspector.inspectPort = async (port) => {
    ports.push(port);
    return { classification: 'free', port };
  };
  const { output } = outputRecorder();
  assert.equal(
    await runControlCommand({
      mode: 'status',
      args: ['--', '--slot', '2'],
      inspector,
      output,
    }),
    0
  );
  assert.deepEqual(ports, [3020, 3023]);
});

test('recovery treats a free API port as a no-op and sends no signal', async () => {
  const signals = [];
  const { output } = outputRecorder();
  assert.equal(
    await runControlCommand({
      mode: 'recover',
      inspector: fakeInspector({
        portResults: [{ classification: 'free', port: 3003 }],
      }),
      killImpl: (...args) => signals.push(args),
      output,
    }),
    0
  );
  assert.deepEqual(signals, []);
});

test('recovery refuses production, invalid arguments, and unsafe ownership without signaling', async () => {
  const unsafeListeners = [
    { ...listener, classification: 'external/other' },
    { ...listener, classification: 'ambiguous' },
    { ...listener, cwd: '/repo' },
    { ...listener, command: 'node unrelated.mjs' },
  ];
  const attempts = [
    { env: { NODE_ENV: 'production' }, inspector: fakeInspector() },
    { args: ['--slot', '-1'], inspector: fakeInspector() },
    ...unsafeListeners.map((value) => ({
      inspector: fakeInspector({ portResults: [value] }),
    })),
    { inspector: fakeInspector({ ownPgid: 190 }) },
    {
      inspector: fakeInspector({
        groupResults: [[{ pid: 190, ppid: 1, pgid: 190, command: '/bin/zsh' }]],
      }),
    },
    {
      inspector: fakeInspector({
        groupResults: [
          [
            {
              pid: 190,
              ppid: 1,
              pgid: 190,
              command: 'node unrelated-task.mjs',
            },
          ],
        ],
      }),
    },
    {
      inspector: fakeInspector({
        groupResults: [
          [{ pid: 190, ppid: 1, pgid: 190, command: 'pnpm lint' }],
        ],
      }),
    },
    {
      inspector: fakeInspector({
        cwdByPid: { 190: '/outside', 200: '/repo/apps/api' },
      }),
    },
  ];

  for (const attempt of attempts) {
    const signals = [];
    const { output } = outputRecorder();
    assert.equal(
      await runControlCommand({
        mode: 'recover',
        env: {},
        ...attempt,
        killImpl: (...args) => signals.push(args),
        output,
      }),
      1
    );
    assert.deepEqual(signals, []);
  }
});

test('recovery accepts a vanished group member only after it is positively absent', async () => {
  const inspector = fakeInspector({ cwdByPid: { 190: '/repo' } });
  inspector.processDetails = async (pid) =>
    pid === process.pid
      ? { pid, ppid: 1, pgid: 999, command: 'node recovery' }
      : pid === 200
        ? null
        : { pid, ppid: 1, pgid: 190, command: 'node pnpm.cjs dev:api' };
  inspector.inspectPort = (() => {
    const states = [listener, listener, { classification: 'free', port: 3013 }];
    let index = 0;
    return async () => states[Math.min(index++, states.length - 1)];
  })();
  inspector.listProcessGroup = (() => {
    const groups = [
      [
        { pid: 190, ppid: 1, pgid: 190, command: 'node pnpm.cjs dev:api' },
        { pid: 200, ppid: 190, pgid: 190, command: listener.command },
      ],
      [{ pid: 190, ppid: 1, pgid: 190, command: 'node pnpm.cjs dev:api' }],
      [],
    ];
    let index = 0;
    return async () => groups[Math.min(index++, groups.length - 1)];
  })();
  const signals = [];
  const { output } = outputRecorder();
  assert.equal(
    await runControlCommand({
      mode: 'recover',
      inspector,
      killImpl: (...args) => signals.push(args),
      output,
    }),
    0
  );
  assert.deepEqual(signals, [[-190, 'SIGTERM']]);
});

test('recovery rechecks identity, sends one group SIGTERM, and requires port and group release', async () => {
  const successInspector = fakeInspector({
    portResults: [listener, listener, { classification: 'free', port: 3013 }],
    groupResults: [
      [
        { pid: 190, ppid: 1, pgid: 190, command: 'node pnpm.cjs dev:api' },
        { pid: 200, ppid: 190, pgid: 190, command: listener.command },
      ],
      [
        { pid: 190, ppid: 1, pgid: 190, command: 'node pnpm.cjs dev:api' },
        { pid: 200, ppid: 190, pgid: 190, command: listener.command },
      ],
      [],
    ],
  });
  const signals = [];
  const { output } = outputRecorder();
  assert.equal(
    await runControlCommand({
      mode: 'recover',
      inspector: successInspector,
      killImpl: (...args) => signals.push(args),
      output,
    }),
    0
  );
  assert.deepEqual(signals, [[-190, 'SIGTERM']]);

  const changedSignals = [];
  assert.equal(
    await runControlCommand({
      mode: 'recover',
      inspector: fakeInspector({
        portResults: [listener, { ...listener, pid: 201 }],
      }),
      killImpl: (...args) => changedSignals.push(args),
      output,
    }),
    1
  );
  assert.deepEqual(changedSignals, []);

  const changedCommandSignals = [];
  assert.equal(
    await runControlCommand({
      mode: 'recover',
      inspector: fakeInspector({
        portResults: [
          listener,
          { ...listener, command: 'node unrelated-task.mjs' },
        ],
      }),
      killImpl: (...args) => changedCommandSignals.push(args),
      output,
    }),
    1
  );
  assert.deepEqual(changedCommandSignals, []);
});

test('process and cwd inspection failures are never treated as vanished group members', async () => {
  for (const failure of ['cwd', 'details']) {
    const inspector = fakeInspector({ cwdByPid: { 190: '/repo', 200: null } });
    if (failure === 'cwd') {
      inspector.processCwd = async (pid) => {
        if (pid === 200) throw new Error('lsof permission failure');
        return '/repo';
      };
    } else {
      inspector.processDetails = async (pid) => {
        if (pid === process.pid) {
          return { pid, ppid: 1, pgid: 999, command: 'node recovery' };
        }
        if (pid === 200) throw new Error('ps timeout');
        return { pid, ppid: 1, pgid: 190, command: 'pnpm dev:api' };
      };
    }
    const signals = [];
    const { output } = outputRecorder();
    assert.equal(
      await runControlCommand({
        mode: 'recover',
        inspector,
        killImpl: (...args) => signals.push(args),
        output,
      }),
      1
    );
    assert.deepEqual(signals, []);
  }
});

test('process inspection deduplicates one listener PID and rejects multiple owners', async () => {
  const results = [];
  const runner = {
    run: async (command, args) => {
      if (command === 'lsof' && args.includes('-iTCP:3003'))
        return results.shift();
      if (command === 'ps') {
        return {
          ok: true,
          exitCode: 0,
          stdout: '200 190 190 node src/server.ts\n',
        };
      }
      if (command === 'lsof') {
        return { ok: true, exitCode: 0, stdout: 'p200\nn/repo/apps/api\n' };
      }
      if (command === 'git' && args.at(-1) === '--show-toplevel') {
        return { ok: true, exitCode: 0, stdout: '/repo\n' };
      }
      return { ok: true, exitCode: 0, stdout: '/common\n' };
    },
  };
  const inspector = createProcessInspector({
    runner,
    realpathImpl: async (value) => value,
  });
  results.push({ ok: true, exitCode: 0, stdout: 'p200\np200\n' });
  assert.equal(
    (await inspector.inspectPort(3003, '/common')).classification,
    'Badminton-owned'
  );
  results.push({ ok: true, exitCode: 0, stdout: 'p200\np201\n' });
  assert.equal(
    (await inspector.inspectPort(3003, '/common')).classification,
    'ambiguous'
  );
});

test('listener inspection distinguishes canonical no-match from lsof failure', async () => {
  const results = [
    {
      ok: false,
      exitCode: 1,
      signal: null,
      stdout: '',
      stderr: '',
    },
    {
      ok: false,
      exitCode: 1,
      signal: null,
      stdout: '',
      stderr: 'lsof: permission denied',
    },
    {
      ok: false,
      exitCode: null,
      signal: 'SIGTERM',
      stdout: '',
      stderr: 'Command timed out',
    },
  ];
  const inspector = createProcessInspector({
    runner: { run: async () => results.shift() },
    realpathImpl: async (value) => value,
  });

  assert.equal(
    (await inspector.inspectPort(3003, '/common')).classification,
    'free'
  );
  assert.equal(
    (await inspector.inspectPort(3003, '/common')).classification,
    'ambiguous'
  );
  assert.equal(
    (await inspector.inspectPort(3003, '/common')).classification,
    'ambiguous'
  );
});

test('ps and cwd command failures are surfaced instead of becoming PID-gone results', async () => {
  const results = [
    {
      ok: false,
      exitCode: 1,
      signal: null,
      stdout: '',
      stderr: 'ps: operation not permitted',
    },
    {
      ok: false,
      exitCode: null,
      signal: null,
      stdout: '',
      stderr: 'spawn lsof ENOENT',
    },
  ];
  const inspector = createProcessInspector({
    runner: { run: async () => results.shift() },
    realpathImpl: async (value) => value,
  });

  await assert.rejects(inspector.processDetails(200), /inspection failed/);
  await assert.rejects(inspector.processCwd(200), /inspection failed/);
});
