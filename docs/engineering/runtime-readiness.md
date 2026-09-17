# Runtime Readiness

This document owns the application-side runtime-readiness contract. It does not certify a deployed
environment or choose a deployment topology.

## Three operational signals

| Signal | Purpose | Cost and side effects |
| --- | --- | --- |
| `GET /api/health` | Process liveness: the HTTP process can answer. | Cheap and side-effect-free; it does not inspect MongoDB or capability readiness. |
| `GET /api/ready` | Live service readiness: startup reached the listening callback and the current Mongoose connection is ready. It also reports already-known scheduler degradation codes. | Cheap and side-effect-free; degraded-only state remains HTTP 200, while startup or Mongo unavailability returns HTTP 503. |
| `pnpm check:runtime-readiness` | Deliberate application-owned environment and retained-data preflight before pilot or release use. | Read-only but broader and potentially slower; it connects to the configured MongoDB and inspects configured storage and capability state. |

Normal API startup keeps existing configuration validation, connects to MongoDB, attempts the
Membership Termination and Membership Application Retention schedulers independently, and starts
the listener. A scheduler initialization failure records bounded capability degradation without
taking unrelated traffic offline. The listener is not ready until its listening callback runs.
The root `pnpm dev` command waits for that same listening outcome before starting Web. If API hard
startup fails, it ends the combined development session nonzero and reports safe local recovery
guidance instead of leaving Web to serve against an unavailable API. Development API startup
bounds initial Mongo server selection to five seconds; the root session has a separate ten-second
generic startup fallback. Production retains Mongoose's default server-selection behavior.

Startup and `/api/ready` deliberately do not query Mongo topology, scan retained banking or Taster
records, inspect indexes or templates, verify SMTP, resolve storage symlinks, or audit file
accessibility. Those facts are environment/capability checks rather than conditions that should be
repeated on every process start or readiness request.

## Operator preflight

Run the default read-only preflight from the repository root:

```sh
pnpm check:runtime-readiness
```

It checks the supported Node major version; Mongo connectivity and transaction-capable topology;
effective public/private storage isolation; current Draft/Pending Membership Application banking
key-version compatibility; the exact Taster pending-email persistence prerequisite; broad Membership
Application banking integrity; the full Taster request/data audit; all consumed email-template
contracts; SMTP configuration; and bounded read/write/traversal permission on the active public and
private storage roots or their nearest existing parents. Storage inspection resolves symlinks and
missing roots without creating directories or probe files.

The default does not contact the SMTP server and normally ends as `unverified` when every requested
check passes. To verify the configured transport without sending mail, run:

```sh
pnpm check:runtime-readiness -- --verify-smtp
```

SMTP preflight uses the existing `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`,
and explicit `SMTP_FROM` sender configuration shared with real delivery. It never creates an
Ethereal account and never sends a message.

The JSON report contains only fixed check IDs, `blocked` / `degraded` / `unverified` / `ready`, safe
reason codes, one observation time, and bounded aggregate counts. It does not print connection
targets, credentials, recipients, template content, application/member identities, banking
material, absolute paths, child reports, or raw errors.

- `blocked`, exit nonzero: the candidate cannot establish required activation safety evidence,
  including supported Node, Mongo connectivity/transactions, public/private storage isolation,
  required current banking key-version coverage, or the exact Taster pending-email persistence
  prerequisite.
- `degraded`, exit zero: a capability, configuration, or retained-data diagnostic needs attention,
  such as unreadable banking records or approval provenance, broad Taster data findings, invalid
  templates, SMTP, or active file-root accessibility. The finding remains in the JSON report.
- `unverified`, exit zero: all default read-only checks passed and optional SMTP transport
  verification was not requested.
- `ready`, exit zero: every check requested for this run passed.

The command never repairs state. Run it against a retained or externally hosted environment only
with the separate authorization required for that environment.

## Ownership boundaries

Mongo transactions are a supported-environment requirement for transaction-owned Membership
Lifecycle and related writes, so topology belongs in deliberate preflight. Operation-time
transactions still fail closed if support becomes unavailable later.

Membership Application banking compatibility is scoped to configured key-version coverage for
currently consumable Draft/Pending application envelopes. A missing referenced key version blocks
activation. Broad integrity verification remains a diagnostic for unreadable ciphertext, terminal
records, and approval-to-member-banking provenance. Administrator accounts and directly
administrator-established Members are not globally required to have a banking profile.

The preflight reuses narrow read-only release prerequisites alongside the broader banking/Taster
diagnostics and consumed email template contracts. Repair and historical cutover remain with their
dedicated owners:

- Membership Application banking: runtime readiness reports broad current encrypted-banking and
  durable approval-to-member-banking findings without migration, plaintext repair, or a standalone
  operator workflow.
- Taster request/index readiness: only the named partial unique pending-email index, canonical
  pending-email state, and duplicate normalized pending-email groups are release prerequisites.
  `audit:taster-session-readiness` remains read-only, while
  `check:taster-session-readiness` owns explicit index ensure.
- Historical Taster shared-source work: `audit:taster-session-source` is read-only and
  `apply:taster-session-source` is the separately authorized migration.
- Taster email templates: `preflight:taster-session-email-templates` is read-only and
  `reconcile:taster-session-email-templates` owns scoped reconciliation. See
  [Taster Session Deployment Readiness](taster-session-deployment-readiness.md).

## Deferred operational concerns

This application contract does not establish deployment topology, process count, persistence
across releases, backup or restore readiness, monitoring or alerting, rollback ownership, disaster
recovery, successful delivery to a real mailbox, or durable cross-release file storage. Those
remain future deployment-preflight and operations concerns and require runtime evidence after the
deployment design is selected.
