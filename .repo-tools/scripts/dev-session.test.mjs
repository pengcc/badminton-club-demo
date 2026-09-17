import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';
import test from 'node:test';
import { DEVELOPMENT_API_STARTUP_SIGNALS } from '../../apps/api/src/developmentStartupContract.ts';
import { runDevelopmentSession as runSession } from './dev-session.mjs';
import {
  deriveDevelopmentSlot,
  parseSlotArguments,
} from './development/dev-slots.mjs';

function freeInspector(overrides = {}) {
  return {
    gitIdentity: async () => ({
      worktreeRoot: '/repo',
      gitCommonDir: '/common',
    }),
    inspectPort: async (port) => ({ classification: 'free', port }),
    processDetails: async () => null,
    processCwd: async () => null,
    ...overrides,
  };
}

function runDevelopmentSession(options) {
  return runSession({
    cwd: '/repo',
    inspector: freeInspector(),
    readFileImpl: async () => {
      throw new Error('no lock');
    },
    realpathImpl: async (value) => value,
    ...(options.output ? { failureOutput: options.output } : {}),
    ...options,
  });
}

const preflightCompleted = () =>
  new Promise((resolve) => setImmediate(resolve));

function childProcess() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.exitCode = null;
  child.signalCode = null;
  child.kill = (signal) => {
    child.signalCode = signal;
    return true;
  };
  return child;
}

function outputRecorder() {
  const entries = [];
  return {
    entries,
    output: {
      step: (message) => entries.push(['STEP', message]),
      success: (message) => entries.push(['SUCCESS', message]),
      danger: (message) => entries.push(['DANGER', message]),
      info: (message) => entries.push(['INFO', message]),
      command: (label, command) =>
        entries.push(['INFO', `${label} ${command}`]),
    },
  };
}

function sink() {
  return new PassThrough();
}

test('the top-level developer entrypoint uses the gated development session', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url))
  );
  assert.equal(
    packageJson.scripts.dev,
    'node .repo-tools/scripts/dev-session.mjs'
  );
});

test('development slots use one deterministic Web/API mapping', () => {
  assert.deepEqual(deriveDevelopmentSlot(parseSlotArguments([])), {
    slot: 0,
    webPort: 3000,
    apiPort: 3003,
    webOrigin: 'http://localhost:3000',
    apiOrigin: 'http://localhost:3003',
  });
  assert.deepEqual(deriveDevelopmentSlot(parseSlotArguments(['--slot', '1'])), {
    slot: 1,
    webPort: 3010,
    apiPort: 3013,
    webOrigin: 'http://localhost:3010',
    apiOrigin: 'http://localhost:3013',
  });
  assert.equal(parseSlotArguments(['--slot', '2']), 2);
  assert.equal(parseSlotArguments(['--', '--slot', '2']), 2);
});

test('invalid, duplicate, and overflowing slot arguments fail before child spawn', async () => {
  for (const args of [
    ['--slot', '-1'],
    ['--slot', '1.5'],
    ['--slot', '1', '--slot', '2'],
    ['--slot', '6254'],
    ['--other', '1'],
  ]) {
    let spawnCount = 0;
    const { output } = outputRecorder();
    assert.equal(
      await runDevelopmentSession({
        args,
        output,
        spawnImpl: () => {
          spawnCount += 1;
          return childProcess();
        },
      }),
      1
    );
    assert.equal(spawnCount, 0);
  }
});

test('slot selection supplies coherent child environments and overrides inherited routing only', async () => {
  const api = childProcess();
  const web = childProcess();
  const spawned = [];
  const { output } = outputRecorder();
  const session = runDevelopmentSession({
    args: ['--slot', '2'],
    env: {
      PORT: '9999',
      FRONTEND_URL: 'http://wrong-web',
      API_URL: 'http://wrong-api',
      NEXT_PUBLIC_API_URL: 'http://wrong-public-api',
      MONGODB_URI: 'mongodb://preserved',
      UNRELATED: 'preserved',
    },
    output,
    stdout: sink(),
    stderr: sink(),
    spawnImpl: (command, args, options) => {
      spawned.push({ command, args, env: options.env });
      return spawned.length === 1 ? api : web;
    },
  });
  await preflightCompleted();

  assert.equal(spawned[0].env.PORT, '3023');
  assert.equal(spawned[0].env.FRONTEND_URL, 'http://localhost:3020');
  assert.equal(spawned[0].env.MONGODB_URI, 'mongodb://preserved');
  assert.equal(spawned[0].env.UNRELATED, 'preserved');

  api.stdout.write(`${DEVELOPMENT_API_STARTUP_SIGNALS.ready}\n`);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(spawned[1].env.PORT, '3020');
  assert.equal(spawned[1].env.FRONTEND_URL, 'http://localhost:3020');
  assert.equal(spawned[1].env.API_URL, 'http://localhost:3023');
  assert.equal(spawned[1].env.NEXT_PUBLIC_API_URL, 'http://localhost:3023');
  assert.equal(spawned[1].env.UNRELATED, 'preserved');

  web.emit('close', 1, null);
  assert.equal(await session, 1);
});

test('the project Docker Mongo entrypoint uses tracked configuration and waits for health', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url))
  );
  const composeDefinition = await readFile(
    new URL('../development/compose.mongo.yml', import.meta.url),
    'utf8'
  );

  assert.equal(
    packageJson.scripts['mongo:docker:start'],
    'docker compose -f .repo-tools/development/compose.mongo.yml up --wait --wait-timeout 75 mongo-rs'
  );
  assert.equal(packageJson.scripts['mongo:start'], undefined);
  assert.match(composeDefinition, /^name: mongo-docker-rs$/m);
  assert.match(composeDefinition, /^\s+image: mongo:8\.0\.14$/m);
  assert.match(composeDefinition, /^\s+name: mongo-docker-rs_mongo-rs-data$/m);
  assert.doesNotMatch(composeDefinition, /^name: mongo-rs-test$/m);
});

test('root development uses the machine signal rather than human log wording before starting Web', async () => {
  const api = childProcess();
  const web = childProcess();
  const spawned = [];
  const spawnImpl = (command, args) => {
    spawned.push([command, args]);
    return spawned.length === 1 ? api : web;
  };
  const { output } = outputRecorder();
  const session = runDevelopmentSession({
    spawnImpl,
    output,
    stdout: sink(),
    stderr: sink(),
  });
  await preflightCompleted();

  assert.deepEqual(spawned, [['pnpm', ['--filter', '@club/api', 'dev']]]);

  api.stdout.write('API is listening; this ordinary wording may change.\n');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(spawned.length, 1);

  api.stdout.write(`${DEVELOPMENT_API_STARTUP_SIGNALS.ready}\n`);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(spawned, [
    ['pnpm', ['--filter', '@club/api', 'dev']],
    ['pnpm', ['--filter', '@club/web', 'dev']],
  ]);

  web.emit('close', 1, null);
  assert.equal(await session, 1);
  assert.equal(api.signalCode, 'SIGTERM');
});

for (const [mode, isTTY, env] of [
  ['TTY', true, {}],
  ['NO_COLOR', true, { NO_COLOR: '' }],
  ['piped', false, {}],
]) {
  test(`Mongo failure has a scannable hierarchy on stderr (${mode})`, async () => {
    const api = childProcess();
    const spawned = [];
    const stdout = sink();
    const stderr = sink();
    stderr.isTTY = isTTY;
    let rendered = '';
    stderr.on('data', (chunk) => {
      rendered += chunk;
    });
    const session = runDevelopmentSession({
      env,
      spawnImpl: (command, args) => {
        spawned.push([command, args]);
        return api;
      },
      stdout,
      stderr,
    });
    await preflightCompleted();
    api.stdout.write(
      `${DEVELOPMENT_API_STARTUP_SIGNALS.initialMongoFailure}\n`
    );
    api.emit('close', 1, null);

    assert.equal(await session, 1);
    assert.equal(spawned.length, 1);
    assert.equal(api.signalCode, 'SIGTERM');
    const lines = stripVTControlCharacters(rendered).trimEnd().split('\n');
    // Line boundaries, priority, and indentation are the presentation contract.
    assert.equal(lines.length, 8);
    assert.equal(lines[0], '[DANGER] Development session blocked.');
    assert.match(
      lines[1],
      /^\[INFO\] Cause: .*configured MongoDB target was unavailable.*initial API connection\.$/
    );
    assert.equal(
      lines[2],
      '[INFO] Next action (project Docker option): pnpm mongo:docker:start'
    );
    assert.equal(lines[3], '[INFO] Details:');
    assert.match(lines[4], /^  Consequence: Web was not started/);
    assert.match(
      lines[5],
      /^  Alternative: .*configured local MongoDB provider manually\.$/
    );
    assert.match(
      lines[6],
      /^  Troubleshooting: .*apps\/api\/\.env\.local and MONGODB_URI.*pnpm dev again\.$/
    );
    assert.match(lines[7], /^  See \.repo-tools\/development\/README\.md\./);
    assert.doesNotMatch(
      rendered,
      /mongodb:\/\/|private-target|CLUB_API_STARTUP/
    );
    assert.doesNotMatch(
      stdout.read().toString(),
      /Cause:|Next action|Details:|Development session blocked/
    );
    if (mode === 'TTY') {
      const styled = rendered.trimEnd().split('\n');
      assert.match(styled[0], /^\u001b\[1;91m\[DANGER\]/);
      assert.match(styled[1], /\[INFO\]\u001b\[0m Cause:/);
      assert.match(
        styled[2],
        /\u001b\[38;2;28;112;230mpnpm mongo:docker:start\u001b\[0m$/
      );
      assert.ok(styled.slice(4).every((line) => !line.includes('\u001b')));
    } else {
      assert.equal(rendered, stripVTControlCharacters(rendered));
    }
  });
}

test('explicit listener failure blocks the session without starting Web or claiming automatic recovery', async () => {
  const api = childProcess();
  const spawned = [];
  const spawnImpl = (command, args) => {
    spawned.push([command, args]);
    return api;
  };
  const { entries, output } = outputRecorder();
  const session = runDevelopmentSession({
    spawnImpl,
    output,
    stdout: sink(),
    stderr: sink(),
  });
  await preflightCompleted();

  api.stdout.write(`${DEVELOPMENT_API_STARTUP_SIGNALS.listenerFailure}\n`);

  assert.equal(await session, 1);
  assert.equal(spawned.length, 1);
  assert.equal(api.signalCode, 'SIGTERM');
  const dangerEntries = entries.filter(([level]) => level === 'DANGER');
  assert.equal(dangerEntries.length, 1);
  const diagnostic = dangerEntries[0][1];
  assert.match(diagnostic, /could not acquire its configured listener/);
  assert.match(diagnostic, /Web was not started/);
  assert.match(diagnostic, /inspect the affected port/);
  assert.match(diagnostic, /pnpm dev:status -- --slot 0/);
  assert.doesNotMatch(diagnostic, /diagnostic above/);
  assert.match(diagnostic, /existing listener was not reused or stopped/);
  assert.doesNotMatch(diagnostic, /Mongo/i);
});

test('the generic API startup fallback is ten seconds and does not blame Mongo', async () => {
  const api = childProcess();
  const spawned = [];
  let expireStartup;
  let startupDelay;
  const { entries, output } = outputRecorder();
  const session = runDevelopmentSession({
    spawnImpl: (command, args) => {
      spawned.push([command, args]);
      return api;
    },
    output,
    stdout: sink(),
    stderr: sink(),
    setTimeoutImpl: (callback, delay) => {
      expireStartup = callback;
      startupDelay = delay;
      return 1;
    },
    clearTimeoutImpl: () => {},
  });
  await preflightCompleted();

  expireStartup();

  assert.equal(await session, 1);
  assert.equal(startupDelay, 10_000);
  assert.equal(spawned.length, 1);
  assert.equal(api.signalCode, 'SIGTERM');
  const dangerEntries = entries.filter(([level]) => level === 'DANGER');
  assert.equal(dangerEntries.length, 1);
  const diagnostic = dangerEntries[0][1];
  assert.match(
    diagnostic,
    /API did not reach its startup-ready\/listening state/
  );
  assert.doesNotMatch(diagnostic, /Mongo/i);
  assert.doesNotMatch(diagnostic, /MONGODB_URI/);
  assert.doesNotMatch(diagnostic, /pnpm mongo:docker:start/);
});

test('generic API process failure does not blame Mongo and never starts Web', async () => {
  const api = childProcess();
  const spawned = [];
  const { entries, output } = outputRecorder();
  const session = runDevelopmentSession({
    spawnImpl: (command, args) => {
      spawned.push([command, args]);
      return api;
    },
    output,
    stdout: sink(),
    stderr: sink(),
  });
  await preflightCompleted();

  api.emit('close', 1, null);

  assert.equal(await session, 1);
  assert.equal(spawned.length, 1);
  const diagnostic = entries.find(([level]) => level === 'DANGER')[1];
  assert.match(
    diagnostic,
    /API did not reach its startup-ready\/listening state/
  );
  assert.doesNotMatch(diagnostic, /Mongo/i);
  assert.doesNotMatch(diagnostic, /MONGODB_URI/);
  assert.doesNotMatch(diagnostic, /pnpm mongo:docker:start/);
});

test('a hard API startup failure after a watch restart stops Web and fails the session', async () => {
  const api = childProcess();
  const web = childProcess();
  let spawnCount = 0;
  const { entries, output } = outputRecorder();
  const stderr = sink();
  const session = runDevelopmentSession({
    spawnImpl: () => {
      spawnCount += 1;
      return spawnCount === 1 ? api : web;
    },
    output,
    stdout: sink(),
    stderr,
  });
  await preflightCompleted();

  api.stdout.write(`${DEVELOPMENT_API_STARTUP_SIGNALS.ready}\n`);
  await new Promise((resolve) => setImmediate(resolve));
  api.stdout.write(`${DEVELOPMENT_API_STARTUP_SIGNALS.initialMongoFailure}\n`);

  assert.equal(await session, 1);
  assert.equal(spawnCount, 2);
  assert.equal(api.signalCode, 'SIGTERM');
  assert.equal(web.signalCode, 'SIGTERM');
  assert.equal(entries.filter(([level]) => level === 'DANGER').length, 1);
  assert.match(
    entries.map(([, message]) => message).join('\n'),
    /Web was not started \(or was stopped\)/
  );
});

test('requested ports are inspected once and every occupied or uncertain state blocks before spawn', async () => {
  const ownedApi = {
    classification: 'Badminton-owned',
    pid: 200,
    cwd: '/repo/apps/api',
    worktreeRoot: '/repo',
    command: 'node --import tsx src/server.ts',
  };
  for (const [webState, apiState, recoveryHint] of [
    ['free', ownedApi, true],
    [{ classification: 'Badminton-owned', pid: 201 }, 'free', false],
    [{ classification: 'Badminton-owned', pid: 201 }, ownedApi, true],
    ['external/other', 'free', false],
    ['free', 'external/other', false],
    ['ambiguous', 'free', false],
    ['free', 'ambiguous', false],
    ['ambiguous', 'external/other', false],
    ['free', { ...ownedApi, command: 'node unrelated.mjs' }, false],
  ]) {
    const inspected = [];
    const { entries, output } = outputRecorder();
    let spawns = 0;
    let lockReads = 0;
    const result = await runDevelopmentSession({
      args: ['--slot', '2'],
      output,
      inspector: freeInspector({
        inspectPort: async (port, common) => {
          inspected.push([port, common]);
          const state = port === 3020 ? webState : apiState;
          return {
            port,
            ...(typeof state === 'string' ? { classification: state } : state),
          };
        },
      }),
      readFileImpl: async () => {
        lockReads++;
        throw new Error('no lock');
      },
      spawnImpl: () => {
        spawns++;
        return childProcess();
      },
    });
    assert.equal(result, 1);
    assert.equal(spawns, 0);
    assert.equal(lockReads, 0);
    assert.deepEqual(inspected, [
      [3020, '/common'],
      [3023, '/common'],
    ]);
    assert.deepEqual(
      entries.map(([level]) => level),
      ['DANGER', 'INFO', 'INFO', 'INFO']
    );
    const diagnostic = entries.map(([, message]) => message).join('\n');
    assert.match(diagnostic, /blocked before API\/Web spawn/);
    assert.match(diagnostic, /pnpm dev:status -- --slot 2/);
    assert.equal(
      diagnostic.includes('pnpm recover:dev-api -- --slot 2'),
      recoveryHint
    );
    assert.doesNotMatch(diagnostic, /kill \d|SIGTERM|unrelated\.mjs/);
    if (
      [webState, apiState].some((state) =>
        ['external/other', 'ambiguous'].includes(state)
      )
    ) {
      assert.match(diagnostic, /Resolve external or ambiguous ownership/);
      assert.doesNotMatch(diagnostic, /Use another explicit slot/);
    }
  }
});

test('both Badminton listeners in another worktree render slot selection before inspection, PID and recovery detail', async () => {
  const stdout = sink();
  const stderr = sink();
  let rendered = '';
  stderr.on('data', (chunk) => {
    rendered += chunk;
  });

  assert.equal(
    await runDevelopmentSession({
      args: ['--slot', '2'],
      stdout,
      stderr,
      inspector: freeInspector({
        inspectPort: async (port) => ({
          classification: 'Badminton-owned',
          port,
          pid: port === 3020 ? 201 : 200,
          cwd: port === 3020 ? '/other/apps/web' : '/other/apps/api',
          worktreeRoot: '/other',
          command:
            port === 3020
              ? 'next-server (v16.2.11)'
              : 'node --import tsx src/server.ts',
        }),
      }),
      spawnImpl: () => assert.fail('must not spawn or terminate any child'),
    }),
    1
  );

  const lines = rendered.trimEnd().split('\n');
  assert.deepEqual(lines, [
    '[DANGER] Development session blocked before API/Web spawn.',
    '[INFO] Cause: development slot 2 has Badminton-owned Web and API listeners in another worktree.',
    '[INFO] Next action: Choose another explicit slot for this worktree, then rerun pnpm dev with that --slot value.',
    '[INFO] Details:',
    '  Listeners: Web port 3020: Badminton-owned, PID 201; API port 3023: Badminton-owned, PID 200.',
    '  Inspection: pnpm dev:status -- --slot 2',
    '  Recovery: If the identified API is stale or no longer needed, use pnpm recover:dev-api -- --slot 2; recovery rechecks ownership before signaling.',
    '  Safety: no existing process was stopped and no alternative slot was selected.',
  ]);
  assert.equal(stdout.readableLength, 0);
});

test('unavailable checkout or port inspection fails closed with bounded diagnostics', async () => {
  for (const inspector of [
    freeInspector({ gitIdentity: async () => null }),
    freeInspector({
      inspectPort: async () => {
        throw new Error('private inspection detail');
      },
    }),
  ]) {
    const { entries, output } = outputRecorder();
    assert.equal(
      await runDevelopmentSession({
        inspector,
        output,
        spawnImpl: () => assert.fail('must not spawn'),
      }),
      1
    );
    assert.match(entries[0][1], /listener ownership could not be inspected/);
    assert.doesNotMatch(entries[0][1], /private inspection detail/);
  }
});

const nextLock = JSON.stringify({
  pid: 410,
  port: 3050,
  hostname: 'localhost',
  appUrl: 'http://localhost:3050',
  startedAt: 12345,
});
const nextProcess = {
  pid: 410,
  ppid: 400,
  pgid: 400,
  command: 'next-server (v16.2.11)',
};
function nextInspector(overrides = {}) {
  return freeInspector({
    processDetails: async () => nextProcess,
    processCwd: async () => '/repo/apps/web',
    ...overrides,
  });
}

test('a verified same-worktree Next server blocks before API spawn with its URL and intentional replacement hint', async () => {
  const stdout = sink();
  const stderr = sink();
  let rendered = '';
  stderr.on('data', (chunk) => {
    rendered += chunk;
  });
  const reads = [];
  const inspected = [];
  assert.equal(
    await runDevelopmentSession({
      args: ['--slot', '2'],
      stdout,
      stderr,
      inspector: nextInspector({
        processDetails: async (pid) => {
          inspected.push(pid);
          return nextProcess;
        },
      }),
      readFileImpl: async (file) => {
        reads.push(file);
        return nextLock;
      },
      spawnImpl: () => assert.fail('must not spawn or terminate any child'),
    }),
    1
  );
  assert.deepEqual(reads, [
    '/repo/apps/web/.next/dev/lock',
    '/repo/apps/web/.next/dev/lock',
  ]);
  assert.deepEqual(inspected, [410, 410]);
  assert.deepEqual(rendered.trimEnd().split('\n'), [
    '[DANGER] Development session blocked before API/Web spawn.',
    '[INFO] Cause: this worktree already has a verified Next.js development server.',
    '[INFO] Next action: Continue using the existing server at http://localhost:3050.',
    '[INFO] Details:',
    '  PID: 410',
    '  Alternative: Run kill 410 only if you intentionally want to replace it, then retry pnpm dev.',
    '  Safety: a different slot does not bypass the same-worktree lock. No signal was sent and the lock was not deleted.',
  ]);
  assert.equal(stdout.readableLength, 0);
  assert.doesNotMatch(rendered, /recover:dev-api/);
});

test('uncertain Next locks defer to Next without deleting evidence, signaling, or guessing ownership', async () => {
  const changing = (first, second) => {
    let calls = 0;
    return async () => (calls++ === 0 ? first : second);
  };
  const cases = [
    {
      readFileImpl: async () => {
        throw new Error('unreadable');
      },
    },
    ...[
      '',
      '{bad',
      'null',
      '{}',
      JSON.stringify({ pid: -1 }),
      nextLock.replace('"pid":410', '"pid":"410"'),
      nextLock.replace('http://localhost:3050', 'https://example.test:3050'),
    ].map((content) => ({ readFileImpl: async () => content })),
    { inspector: nextInspector({ processDetails: async () => null }) },
    {
      inspector: nextInspector({
        processDetails: async () => ({
          ...nextProcess,
          command: 'node unrelated.mjs',
        }),
      }),
    },
    {
      inspector: nextInspector({ processCwd: async () => '/another/apps/web' }),
    },
    {
      inspector: nextInspector({
        processCwd: async () => {
          throw new Error('unreadable');
        },
      }),
    },
    { readFileImpl: changing(nextLock, nextLock.replace('410', '411')) },
    {
      inspector: nextInspector({ processDetails: changing(nextProcess, null) }),
    },
    {
      inspector: nextInspector({
        processDetails: changing(nextProcess, { ...nextProcess, pid: 411 }),
      }),
    },
    {
      inspector: nextInspector({
        processDetails: changing(nextProcess, { ...nextProcess, pgid: 401 }),
      }),
    },
    {
      inspector: nextInspector({
        processDetails: changing(nextProcess, {
          ...nextProcess,
          command: 'node unrelated.mjs',
        }),
      }),
    },
    {
      inspector: nextInspector({
        processCwd: changing('/repo/apps/web', '/another/apps/web'),
      }),
    },
  ];
  for (const overrides of cases) {
    const api = childProcess();
    const web = childProcess();
    const { entries, output } = outputRecorder();
    let spawns = 0;
    const stderr = sink();
    let relayed = '';
    stderr.on('data', (data) => {
      relayed += data;
    });
    const session = runDevelopmentSession({
      inspector: nextInspector(),
      readFileImpl: async () => nextLock,
      output,
      stdout: sink(),
      stderr,
      spawnImpl: () => (++spawns === 1 ? api : web),
      ...overrides,
    });
    await preflightCompleted();
    assert.equal(spawns, 1);
    assert.equal(api.signalCode, null);
    assert.equal(
      entries.some(([level]) => level === 'DANGER'),
      false
    );
    api.stdout.write(`${DEVELOPMENT_API_STARTUP_SIGNALS.ready}\n`);
    await preflightCompleted();
    assert.equal(spawns, 2);
    web.stderr.write(
      'Another next dev server is already running in this directory.\n'
    );
    web.emit('close', 1, null);
    assert.equal(await session, 1);
    assert.match(relayed, /Another next dev server/);
  }
});

test('ordinary API and Web runtime diagnostics are still relayed after readiness', async () => {
  const api = childProcess();
  const web = childProcess();
  const stdout = sink();
  const stderr = sink();
  let normal = '';
  let errors = '';
  let spawns = 0;
  stdout.on('data', (chunk) => {
    normal += chunk;
  });
  stderr.on('data', (chunk) => {
    errors += chunk;
  });
  const { output } = outputRecorder();
  const session = runDevelopmentSession({
    output,
    stdout,
    stderr,
    spawnImpl: () => (++spawns === 1 ? api : web),
  });
  await preflightCompleted();
  api.stdout.write(
    `${DEVELOPMENT_API_STARTUP_SIGNALS.ready}\nAPI runtime log\n`
  );
  await preflightCompleted();
  web.stdout.write('Web runtime log\n');
  api.stderr.write('Bounded API runtime diagnostic\n');
  web.stderr.write('Bounded Web runtime diagnostic\n');
  web.emit('close', 1, null);
  await session;
  assert.match(normal, /API runtime log/);
  assert.match(normal, /Web runtime log/);
  assert.match(errors, /Bounded API runtime diagnostic/);
  assert.match(errors, /Bounded Web runtime diagnostic/);
  assert.doesNotMatch(normal, /@club\/api-startup/);
});
