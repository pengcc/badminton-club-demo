# Testing and Persistence Safety

This guide complements Project Memory. It supplies reusable review rules for changes that cross
tests, persistence, and state-changing workflows; it does not replace confirmed product behavior
or current implementation evidence.

## Choose Tests That Can Prove Something Important

Add or retain a test only when it protects a real business rule, invariant, contract, workflow, or
known regression risk. A useful test can fail for a meaningful incorrect implementation.

- Do not add tests solely for coverage, formal completeness, framework behavior, or private
  implementation detail.
- Do not duplicate a stronger existing test unless the new test covers a distinct boundary or
  failure mode.
- Start with the smallest focused validation for the changed behavior, then expand according to
  coupling and risk.
- Prefer observable behavior and normal workflow evidence over synthetic validation when the
  workflow already demonstrates the claim.
- Weigh maintenance and execution cost against expected regression value, especially for frequent
  suites.

Use workflow-level tests when correctness depends on middleware, persistence, authorization,
transactions, side effects, or user-visible state together. Unit mocks remain useful for isolated
policy, but a test that mocks the persistence or middleware boundary does not prove that boundary.

## Run Ordinary Repository Validation

After installing dependencies, run ordinary repository validation directly:

```bash
pnpm validate
```

`pnpm validate` runs lint, the root clean-checkout typecheck, shared-types, Web, and API ordinary
tests, repository-tool tests, and the repository build. It deliberately does not initialize the
API persistence Vitest project or Mongo/Testcontainers. For only its build leg, the command uses
`http://localhost:3000` as the Web metadata origin when the process `FRONTEND_URL` is unset or
empty. A non-empty process value is preserved. Normal application `.env.local` bootstrap and
application startup are not prerequisites merely to build during repository validation.

## Add Persistence Evidence When the Change Requires It

For persistence, integration, transaction, stateful lifecycle, or other Mongo-backed behavior,
run the additive persistence boundary after ordinary validation:

```bash
pnpm test:persistence
```

When no server mode is supplied, this root persistence entrypoint deterministically selects the
disposable Testcontainers server mode. If Testcontainers is unavailable, the command fails without
trying another mode. To deliberately use a verified developer-managed native loopback replica set
instead, select it explicitly with its server-level URI:

```bash
MONGO_TEST_SERVER_MODE=native \
  MONGO_TEST_NATIVE_URI='mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true' \
  pnpm test:persistence
```

An invalid or unavailable explicitly selected server mode fails validation. It never authorizes
fallback to another mode, just as an unavailable default Testcontainers mode never authorizes
fallback to native. `MONGO_TEST_SERVER_MODE` chooses how the persistence-test MongoDB server is
provided; each suite still creates its own disposable database on that server. `MONGODB_URI` and
the normal application development database or provider are not persistence-test inputs. See
`.repo-tools/development/README.md` for the separate local-provider and test-variable operating
guidance.

Standalone API/Vitest persistence entrypoints do not inherit the root persistence-command default.
Supply `MONGO_TEST_SERVER_MODE` explicitly for those entrypoints.

Full assurance is the explicit composition:

```bash
pnpm validate
pnpm test:persistence
```

Run both commands when the task's risk, coupling, or assurance claim requires ordinary and
persistence evidence. A successful ordinary run does not claim persistence health.

Standalone `pnpm build` remains the environment-specific and release-build owner; it does not
receive the validation-only origin fallback.

## Publication Boundary

Implementation owns validation selection and execution. Normal implementation publication requires
current green `pnpm validate`, with persistence evidence added only when the actual change requires
it. `pnpm pr:open-or-update` publishes an already-clean committed feature branch; it does not stage,
commit, select tests, or run validation. It checks exact committed scope, secret safety, default
ancestry, and head stability before publishing one PR. Use `--title` and `--body-file` to deliberately
supply PR content; omit the body option to preserve an existing description.

`pnpm pr:merge <number>` performs a separately authorized exact-PR merge only after current GitHub
state, required checks, final head protection, and remote-result verification. Neither command
replaces the user's authority or grants deployment or release permission.

## Use Disposable Persistence Tests Safely

Destructive persistence tests must operate only on an explicitly disposable database, normally a
project-scoped Testcontainers database. They must not use a configured development, production, or
otherwise ambiguous target.

Before a test clears data, assert both that its database name matches an active-run disposable
pattern and that the active connection uses that exact name. Scope containers, databases,
networks, and volumes to the project or run; clean up only those resources, including on failure.

Never copy production, personal, or operational data into test fixtures. Use synthetic, minimal,
repeatable data instead.

Test credentials and credential-bearing URLs must remain clearly synthetic and scanner-safe. Do
not embed complete password, token, API-key, secret, registration-link, setup-link, or other
credential-like literals directly in test files when repository secret scanning may classify
them as high-confidence secrets or review-required credentials. This includes full URLs whose
query strings or path segments contain synthetic tokens. Prefer shared test-fixture helpers or
deterministic values generated or assembled at runtime, while keeping tests readable and stable.

When a scanner flags a test credential or credential-bearing URL, first confirm that it is
synthetic, then replace the complete credential-like literal with the repository’s scanner-safe
test-fixture pattern. A clean result means both high-confidence and review-required findings are
zero under the normal guard command; explicit acknowledgement is not a clean pass. Do not add
suppression comments, allowlist exceptions, acknowledgement flags, environment secrets, or
weaker scanning rules merely to publish test code. If the flagged value could be real or reusable
outside the test, treat it as exposed and rotate it.

## Preserve Behavioral Write Ownership

For each state-changing concept, identify:

- the stored source of truth; and
- the behavioral owner that validates and changes it.

The stored representation does not automatically own validation, authorization, coordinated
writes, cleanup, audit, or side effects. Route coordinated mutations through the behavioral owner
instead of creating another direct write path around it.

When a change affects more than one record or external effect, state explicitly:

- the transaction or atomicity boundary;
- retained idempotency/retry identity and replay behavior;
- stale-read or concurrent-write protection, such as a conditional versioned write;
- failure and partial-progress semantics;
- audit and side-effect ownership; and
- cleanup and reconciliation responsibility.

Test the highest-risk guarantees through the real persistence boundary: rollback, same-key replay,
different-intent conflict, stale-state rejection, concurrent writes, and batch atomicity as
applicable.

## Treat Destructive Data Operations as a Safety Boundary

Before a reset, drop, `deleteMany`, migration, backfill, seed replacement, or bulk update, verify:

1. the environment and exact database target;
2. that the target is disposable or separately authorized;
3. filters, mutation scope, and expected affected records;
4. transaction or atomicity requirements;
5. a rollback or complete-rebuild strategy; and
6. the owner of follow-up cleanup, cache invalidation, audit, and side effects.

Stop when any target or scope is ambiguous or unexpected. `NODE_ENV`, a script name, or repository
configuration is not sufficient proof of a safe database target. Do not introduce a fallback
target merely to keep an operation running.

For resettable project data, prefer forward-only canonical schemas and contracts. Add legacy
compatibility, migrations, backfills, or transitional scaffolding only after verifying
non-resettable data or an external consumer that requires preservation.

Seeds and fixtures should be synthetic, repeatable, rebuildable, and deterministic enough to make
validation reliable. Bulk operations should make their all-or-nothing or partial-result semantics
explicit and test the selected guarantee.

## Focused Review Prompts

- What important incorrect behavior would each test catch?
- Does the test exercise the same boundary that production callers use?
- Which service owns each coordinated write, and are there bypasses?
- Can a retry, stale request, or concurrent operation violate an invariant?
- Is every destructive target verified before mutation, with no fallback?
- Are seeds, migrations, and bulk operations safe for the actual data reality rather than a
  hypothetical one?
- Could any test password, token, key, connection string, registration link, setup link, or full
  credential-bearing URL be classified as a high-confidence or review-required credential by the
  repository’s normal secret-safety guard?

## Secret-safety workflow

`pnpm safety:guard` is the read-only standalone diagnostic and repository-safety check for the
prospective PR scope: committed branch changes relative to the local `origin/main` merge base,
staged and unstaged tracked changes, and untracked non-ignored files. It does not fetch, contact
GitHub, stage, commit, push, or create or update a pull request.

The command exits with code `0` only when there are no high-confidence or review-required
findings. Either finding class produces a non-zero exit code. Review-required findings cannot be
acknowledged in this standalone workflow; replace or remove the credential-like value instead.

The maintained local publication workflows scan the complete committed PR delta before push. Use
them only after implementation and validation are complete and publication is authorized. The PR
Repository Safety workflow performs a later defense-in-depth scan after content is remote; it does
not prove that first exposure was prevented.
