# Local runtime environment

Run the repository-owned bootstrap in a Git worktree root before normal local runtime:

```sh
pnpm bootstrap:local-env
```

The command owns first establishment, linked-worktree reuse, and structural validation of the
ignored `apps/api/.env.local` and `apps/web/.env.local` files. In the primary Git worktree, a
completely missing file is created with only the minimum normal-runtime values from that package's
committed `.env.example`. The API file receives the documented native Mongo target, local frontend
origin, and one generated banking key ring; the Web file receives the local frontend origin.
The API file also receives the absolute primary-worktree `apps/api/uploads` root. That ignored
value makes the configured normal development database and retained public uploads one coherent
state boundary across supported worktrees without changing `/uploads/...` URLs.
Generated files are created without overwrite and with owner-only permissions where the filesystem
supports POSIX modes.

Valid existing files are preserved byte-for-byte after establishment, including an intentional
Docker Mongo target, SMTP settings, API overrides, and other optional local choices. The one
bounded upgrade adds only a missing `DEVELOPMENT_PUBLIC_UPLOADS_ROOT` when every other API value is
valid and, in a linked worktree, its configured `MONGODB_URI` exactly matches the primary file.
Before that linked upgrade, managed Activity, Contact QR, and Public Document upload and staging
namespaces must contain no retained files that the switch would hide. Bootstrap never copies,
moves, deletes, or merges such files. An existing partial, malformed, contradictory, or otherwise
invalid file is never repaired or normalized automatically: bootstrap stops before creating a
missing sibling, names only the affected package and variable or bounded reason, and asks for an
explicit local repair. It never prints values, searches arbitrary sibling worktrees, reads
production files, contacts a service, or starts, stops, switches, resets, or seeds MongoDB.

In a linked implementation worktree, the same ordinary command preserves each established valid
target file independently and reuses every missing package file from the configured primary Git
worktree. The API copy receives the derived primary uploads root when the primary file still needs
that bounded prerequisite. Bootstrap preflights both packages before writing either missing target,
then re-reads and validates the complete target. Reuse preserves the primary Mongo selection and
banking cryptographic identity without a shared environment store. A linked API file with a
different configured `MONGODB_URI` is preserved but fails retained-upload readiness and is not
given the primary root. Linked bootstrap never derives a fresh
identity from committed examples, generates a new banking key, searches another worktree, or
repairs a missing or invalid primary source. Such a prerequisite blocks before target writes and
requires separate explicit authorization for the smallest primary-source repair or establishment.

To check an already established target without copying or creating anything, run:

```sh
pnpm bootstrap:local-env --validate-only
```

Validation-only mode never creates, copies, repairs, normalizes, or replaces package-local files.
It resolves the read-only Git worktree context and checks the same normal database and primary
upload-root relationship. A missing, partial, stale, or invalid target file remains unchanged and
blocks before runtime.

# Concurrent local development slots

Root development uses one explicit, deterministic slot for one coherent Web + API session:

```sh
pnpm dev
pnpm dev -- --slot 1
pnpm dev -- --slot 2
```

No argument selects slot 0. The listener mapping is:

```text
Web port = 3000 + (slot * 10)
API port = 3003 + (slot * 10)
```

For example, slot 0 uses Web `3000` and API `3003`, slot 1 uses `3010` / `3013`, and slot 2 uses
`3020` / `3023`. The launcher supplies the matching process-local `PORT`, `FRONTEND_URL`,
`API_URL`, and `NEXT_PUBLIC_API_URL` values without changing either package's `.env.local` file.
Before spawning API or Web, the launcher inspects both requested listener ports using the same
ownership checks as `dev:status`. An occupied or ambiguous port blocks startup and reports the
port, ownership classification, and safe next action. Inspect external or uncertain ownership
before taking action. When both requested listeners are Badminton-owned in the same other worktree,
choose another explicit slot for the invoking worktree; slot inspection remains secondary. For a
positively identified API worker that is stale or no longer needed, the existing `recover:dev-api`
command rechecks ownership before recovery. Startup never reuses, automatically stops, or silently
switches away from the requested slot.
Occupied-slot and verified same-worktree Next blockers lead with the blocked result, `Cause`, and
primary `Next action`; PID, alternative/recovery choices, and safety notes remain under secondary
`Details`.

Each concurrent complete session must use a distinct Git worktree and a distinct slot. Next.js
permits one development server for a project directory, so multiple slots do not bypass its
same-worktree development lock or create a custom `.next` directory. Once the requested ports
appear free, the launcher best-effort reads Next's `.next/dev/lock` and rechecks its live Next
server PID and current `apps/web` cwd. A verified existing server blocks before API spawn and
shows its local URL and PID: continue using it, or intentionally replace it with the displayed
`kill <PID>` command before retrying. Selecting another slot in that same worktree cannot solve
this conflict. The launcher never signals that server or deletes its lock. Missing, stale,
malformed, unreadable, or changing lock evidence is left to Next's authoritative runtime check.

After preflight, API must confirm its listening state before Web starts. In combined `pnpm dev`,
the launcher owns the human diagnosis for known Mongo/listener startup failures while the API's
machine startup signals still control readiness. Standalone `pnpm dev:api` keeps its useful human
failure diagnostics. Unknown startup diagnostics and normal API/Web runtime logs remain visible.
A failed configured Mongo connection never starts Web or automatically starts/switches providers;
use the provider guidance below to recover the selected provider explicitly.

Inspect one slot without changing any process:

```sh
pnpm dev:status
pnpm dev:status -- --slot 2
```

Status reports listener PID/PGID, cwd, Git-worktree ownership when it can be established, and a
bounded slot classification. Listener ownership does not prove that two processes share a parent
or that an independently launched Web process has coherent API routing.

If a Badminton API development watcher is positively identified as stale or no longer needed,
recover only its selected API slot explicitly:

```sh
pnpm recover:dev-api
pnpm recover:dev-api -- --slot 2
```

Recovery fails closed unless the listener is the current `src/server.ts` development worker, its
Git common-directory identity belongs to this Badminton checkout family, and every live member of
its process group belongs to the same worktree. It refuses its own group, interactive-shell-owned
groups, changing or unreadable ownership, external listeners, and production mode. After an
immediate identity recheck it sends one `SIGTERM` to the verified process group and succeeds only
when both the API port and group are gone. It never uses `SIGKILL`, kills by process name, scans for
a free slot, or targets a replacement process.

The status and recovery commands are local development tools. They do not manage the selected
MongoDB provider, isolate databases per slot, or change PM2, Nginx, Capistrano, deployment, or
production process ownership.

# Local development MongoDB

The application supports two explicit local MongoDB providers. `MONGODB_URI` selects the target
used by the API; it does not start, stop, or switch either provider.

| Provider | Endpoint | Lifecycle owner |
| --- | --- | --- |
| Host-native single-node `rs0` | `127.0.0.1:27018` | Developer-managed with the manual procedure below |
| Project Docker single-node `rs0` | `127.0.0.1:27019` | `pnpm mongo:docker:start` |

The Docker Compose project uses the stable `mongo-docker-rs` identity and pins MongoDB 8.0.14, and uses the dedicated development volume
`mongo-docker-rs_mongo-rs-data`. Issue #223 Testcontainers and native persistence tests
keep their own explicit `MONGO_TEST_SERVER_MODE` server-provision and database-isolation
contract. The selector chooses how the test server is provided; suites retain ownership of their
run-specific disposable databases, independently of the application target selected by
`MONGODB_URI`.

### One-time transition from the historical Compose project

An existing container labeled for the former `mongo-rs-test` Compose project cannot be adopted by
the renamed project. Stop and remove only that container, preserve its named volume, then start the
new project:

```sh
docker stop badminton-mongo-rs
docker rm badminton-mongo-rs
pnpm mongo:docker:start
```

The new project uses `mongo-docker-rs_mongo-rs-data`.
The historical `mongo-rs-test_mongo-rs-data` volume is not reused.

## Native provider: current local setup

The following is current environment guidance for the project-specific native instance. Its paths,
start invocation, and writable-primary check were verified on 2026-08-20 against MongoDB 8.0.12;
the shutdown step uses MongoDB 8.0's documented self-managed localhost procedure:

- configuration: `~/.config/badminton-mongod.conf`;
- data: `~/.local/share/badminton-mongo`;
- bind target: `localhost:27018`;
- replica set: `rs0`;
- process mode: `mongod --config ... --fork`.

These user-local paths and the `65536` recovery value below describe the current development
environment. They are not portable product requirements and must not be copied into production
or machine-global configuration.

### Start

Check the current shell's open-file soft limit before starting:

```sh
ulimit -Sn
```

MongoDB 8.0 warns below `64000`. If this shell is below that threshold, raise only this shell and
its future child processes to the verified recovery value, then start `mongod` from the same shell:

```sh
ulimit -n 65536
mongod --config "$HOME/.config/badminton-mongod.conf" --fork
```

If the existing limit is already at least `64000`, leave it unchanged and run only the `mongod`
command. Do not change shell profiles, launch agents, Homebrew services, or global limits for this
project workflow.

### Check

This read-only check succeeds only when the exact native target is writable `rs0` primary:

```sh
mongosh --quiet --host 127.0.0.1 --port 27018 --eval '
const hello = db.adminCommand({ hello: 1 });
quit(hello.setName === "rs0" && hello.isWritablePrimary === true ? 0 : 1);
'
```

### Stop

First stop or disconnect local API/test work using this native instance. A single-node primary has
no secondary to step down to, so the manual shutdown uses MongoDB's localhost-only administrative
method with `force: true`:

```sh
mongosh --quiet --host 127.0.0.1 --port 27018 --eval '
db.getSiblingDB("admin").shutdownServer({ force: true });
'
```

Forced shutdown can interrupt active operations. Use it only for this dedicated local development
instance after dependent work has stopped; it is not a production procedure.

### Restart

Run the Stop procedure, wait until the Check command fails because the listener is gone, then run
the Start procedure and require the Check command to succeed before starting `pnpm dev`.

## Select the application provider

Keep the chosen target in the local-only `apps/api/.env.local` file:

```dotenv
# Native provider
MONGODB_URI=mongodb://localhost:27018/badminton-club-demo-dev?replicaSet=rs0&directConnection=true

# Project Docker provider
# MONGODB_URI=mongodb://localhost:27019/badminton-club-demo-dev?replicaSet=rs0&directConnection=true
```

For Docker, run `pnpm mongo:docker:start` before `pnpm dev`. For native MongoDB, use the manual
procedure above. There is no automatic provider fallback or native process supervision.

Ordinary local development uses the target in `apps/api/.env.local`. A directly supplied
`MONGODB_URI` remains available as an explicit, command-scoped alternate development session. If
it differs from the file-selected target, the API reports alternate database mode on stderr
without printing either connection string. The override remains effective only for that process,
does not modify `.env.local`, and a later command without the override returns to the file-selected
default. The alternate target does not establish another retained public-upload environment:
Activity media, Contact QR, Public Document, and file-affecting seed/reset mutations fail closed,
and deliberate readiness reports retained uploads as unverified for that database. Read-only
serving may still expose the normal shared root without claiming a coherent alternate environment.
An unavailable selected provider never causes the runtime to discover or switch to another
provider automatically.

MongoDB references: [clean `mongosh` shutdown](https://www.mongodb.com/docs/v8.0/reference/method/db.shutdownServer/)
and [MongoDB 8.0 UNIX `ulimit` guidance](https://www.mongodb.com/docs/v8.0/reference/ulimit/).
