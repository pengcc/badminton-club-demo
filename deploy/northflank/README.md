# Northflank public-demo deployment

Deploy `badminton-club-demo` as one public Web service, one private API service, and a private
transaction-capable MongoDB addon. Both services use one exact revision and the root `Dockerfile`.
The Web image default runs `node apps/web/server.js`; API overrides the command with
`node apps/api/dist/server.js`.

This procedure requires separate deployment authority. It does not authorize provider resources,
cost changes, database mutation, or publication. Never use upstream data, real account credentials,
or real club contact/payment details. Keep connection values and banking keys in provider-managed
configuration, never Git or command transcripts.

## Topology and evidence

```text
public HTTPS -> Web :3000 -> private API :3003 -> private TLS MongoDB
                            /api and /uploads via API_URL
```

An earlier disposable Northflank Developer Sandbox proof in Europe - West (London), using MongoDB
8.0.26 with a single replica, demonstrated this topology, transactions, health/readiness, and a
localized Teams page. It did not establish the final demo, real SMTP, durable uploads, backup or
restore, monitoring, custom domains, staging, or production readiness. The proof environment and
database are not migration sources. Verify provider availability and effective configuration again
for the separately authorized fresh deployment.

## Configuration channels

| Consumer | Variable | Contract |
| --- | --- | --- |
| Both image builds | `SOURCE_REVISION` | Exact source SHA; required. |
| Web build | `API_URL` | Private API origin for Next.js `/api` and `/uploads` rewrites. |
| Web build | `FRONTEND_URL` | Intended public Web origin. |
| Web build | `NEXT_PUBLIC_SHOWCASE_DEMO_EMAIL` | `demo.admin@club.invalid`; intentionally public. |
| Web build | `NEXT_PUBLIC_SHOWCASE_DEMO_PASSWORD` | Chosen public Demo password, identical to bootstrap input. |
| Bootstrap and API | `NODE_ENV` | `production`. |
| Bootstrap and API | `MONGODB_URI` | Explicit private MongoDB target; no fallback. |
| Bootstrap and API | `FRONTEND_URL` | Exact public Web HTTPS origin. |
| Bootstrap and API | `BANKING_ENCRYPTION_ACTIVE_KEY_VERSION` | Active application banking-key version. |
| Bootstrap and API | `BANKING_ENCRYPTION_KEYS` | JSON object mapping versions to base64-encoded 32-byte keys. |
| Bootstrap and API | `SHOWCASE_DEMO_ADMIN_EMAIL` | `demo.admin@club.invalid`, matching the seeded identity. |
| API runtime | `SHOWCASE_DEMO_ENABLED` | `true`, enabling backend demo restrictions. |
| One-off bootstrap only | `SHOWCASE_DEMO_ADMIN_PASSWORD` | Deployment-chosen Demo password; no source default. |
| API runtime | `MEMBERSHIP_APPLICATION_PRIVATE_UPLOAD_ROOT` | Optional explicit private root; verify isolation/access. |

The Docker build stage declares the two `NEXT_PUBLIC_SHOWCASE_DEMO_*` build arguments before
`next build`. Supply them through Northflank Docker build arguments, not merely service runtime
variables. They are compiled into the Login client; neither is projected into the final image's
runtime environment by the Dockerfile. They are intentionally public synthetic credentials, never
an operator or real account credential. Builds without them remain valid and omit the demo card.

The Demo password must be 8–72 UTF-8 bytes (and at least eight characters), must not be a placeholder,
and must differ from the source-known local seed passwords. Do not copy a concrete hosted password
into this document. Non-Demo users receive generated, undisclosed passwords during fresh bootstrap.
`SHOWCASE_DEMO_ADMIN_PASSWORD` is not a long-lived API requirement. No committed `.env.production`
is required; supply configuration to the execution environment.

The same application banking key is needed by bootstrap for the synthetic application/banking
fixtures and by API for reading them. It is not a fixture-only external service. SMTP is not needed
for this demo. Demo mode skips Membership Termination and Membership Application Retention
schedulers and denies external-effect workflows at the backend boundary.

The image creates `/app/uploads` and `/app/private-uploads`. These paths do not establish persistent
storage across image replacement; the synthetic seed references no missing uploaded media/documents.

## Initial fresh deployment

1. Freeze one exact reviewed revision. Provision a **brand-new**, private, transaction-capable
   MongoDB in the selected project/region. Keep Web public and API/MongoDB private.
2. Keep the normal API and every other writer disconnected from that database. One selected
   operator/bootstrap execution owns initial establishment. This is a deployment prerequisite,
   not a guarantee implemented through database locks or transactional collection enumeration.
3. Build the image with the exact SHA and Web routing/demo arguments above. Configure the one-off
   bootstrap execution with the explicit Mongo target, application keys, and Demo credential tuple.
4. Run the compiled entrypoint inside the image (working directory `/app`):

   ```sh
   node apps/api/dist/scripts/bootstrapFreshPublicDemo.js --fresh-empty-target
   ```

   It checks every non-system collection outside a transaction and refuses any application document.
   Empty collections/index metadata are acceptable. It reuses the full synthetic seed creation
   pipeline without the development reset/delete/file-cleanup phase. It creates no startup hook.
5. On failure, keep API disconnected. Do not repair, reconcile, reset, rotate passwords, or retry
   over the partial target. Under deployment authority, discard/recreate the still-new database
   or environment and rerun from empty. A partial bootstrap is never accepted as live state.
6. Require converged public content using the existing read-only owner:

   ```sh
   node apps/api/dist/scripts/reconcileShowcasePublicContent.js --audit
   ```

   This checks public-content owners only, not all application state. It emits bounded owner
   classifications/counts/fingerprints. Unexpected content blocks acceptance; do not automatically
   run retained-content reconciliation to hide a fresh-bootstrap defect.
7. Verify release prerequisites before starting API:

   ```sh
   node apps/api/dist/scripts/checkRuntimeReadiness.js
   ```

   Require connectivity, transaction topology, banking-key coverage, and storage/index prerequisites.
   Respect blocking versus independent degraded diagnostics; do not add real SMTP merely to clear
   a diagnostic. If the preflight identifies the missing canonical Taster pending-email index, use
   only its existing bounded owner under deployment authority, then rerun preflight:

   ```sh
   node apps/api/dist/scripts/checkTasterSessionReadiness.js --ensure-index
   ```
8. After successful bootstrap, content audit, and preflight, start API with demo mode enabled.
   The bootstrap execution is temporary, not a third retained application service. API must connect
   to MongoDB before listening on `3003`.
9. Start Web on `3000` using the same revision. Set private `API_URL` at build time and the exact Web
   origin in API `FRONTEND_URL`; do not expose API publicly to work around routing errors.

For a source checkout, `pnpm bootstrap:fresh-public-demo --fresh-empty-target` is the corresponding
alias. Deployed-image operation uses compiled Node scripts because the runtime image does not
contain the source pnpm toolchain. Ordinary `pnpm seed:data` and `pnpm db:reset` remain destructive
local-development tools and must never be used against hosted MongoDB.

## Live acceptance

Under the separate deployment task, verify the exact service revision, ports, origin policy, and
private/public boundaries, then check API `/api/health` and `/api/ready` and their Web-proxied routes.
Liveness, live readiness, and deliberate preflight establish different facts.

For DE/EN/ZH, follow public discovery -> **Try the admin demo** -> Login -> **Fill demo credentials**
-> ordinary sign-in. Require representative **Members / Matches / Content**, read-only canonical
records, backend denial of excluded account/security/private/side-effect workflows, and the bounded
scratch Announcement/Match editing lifecycle. Finish/expiry must remove write authority; a later
editing start converges predecessor scratch. Do not manufacture failures or run load/stress tests
against this shared demo. Record the verified live URL only after acceptance.

## Ordinary later redeploys

Retain the newly established final demo database. Use the next exact reviewed code revision and
perform bounded read-only/readiness/live acceptance. Do **not** rerun fresh bootstrap, development
seed/reset, persistence tests, destructive tests, load tests, or stress tests. Preserve canonical
and scratch state under existing backend rules. The fresh bootstrap refuses a non-empty target;
it is not an upgrade, repair, migration, or password-rotation command.

Reverify affected boundaries when code/image layout, build inputs, ports/origins, MongoDB topology,
keys, storage, or demo policy changes. Provider configuration is not evidence of effective live
behavior. Paid plans, production hardening, real SMTP, backups, durable uploads, and custom domains
need their own scope and authorization. Cleanup may affect only resources positively identified as
belonging to the separately authorized deployment task.
