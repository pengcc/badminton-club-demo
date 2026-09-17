# Badminton Club Demo

A portfolio/demo of a real multilingual club application: a public website, member workflows,
and protected administration built with **Next.js → Express → MongoDB**. German, English, and
Chinese interfaces cover club content, membership, teams, and competition.

## What it demonstrates

- Public pages for teams, activities, recruitment, membership information, and Taster Sessions.
- Account and membership workflows, player profiles, team rosters, match availability, and lineups.
- Administration for members and competition, plus localized CMS content and communication.
- Shared TypeScript contracts, backend-owned validation and permissions, and persistence-aware
  workflows across a full-stack monorepo.

See the [project overview](docs/project-overview.md) for the architecture and domain boundaries.

## Demo boundary

Badminton Club Demo (`badminton-club-demo`) represents a fictional, non-live club. Use only synthetic/resettable data; its
contact details, venues, schedules, and participation information are demonstration content.

The bounded public-demo runtime lets a dedicated Demo Admin explore representative administration.
Canonical demo records remain protected; temporary editing is limited to scratch Announcements and
Matches. Account/security, private-data, and side-effecting actions are deliberately restricted by
the API. The retained application is broader than this Demo Admin surface.

**Hosted demo:** the verified live URL will be added here after deployment acceptance.

Once available, open the hosted site, choose **Try the admin demo**, then use **Fill demo
credentials** on Login. Explore **Members / Matches / Content**. Optionally start the 30-minute
editing session to create and edit one scratch Announcement and one scratch Match, then Finish
Editing or let the session expire. Canonical records remain read-only; another visitor may already
hold the single editing slot.

The hosted demo starts with a brand-new database using the same synthetic seed as local development.
Its Demo Admin password is supplied during deployment; all other mock users receive undisclosed
random passwords. The temporary hosting-proof database is not migrated. The
[Northflank runbook](deploy/northflank/README.md) describes fresh establishment and subsequent
redeploys; this non-production demo does not establish production readiness.

## Run locally

Prerequisites: **Node.js 24**, **pnpm 10+**, and a transaction-capable MongoDB replica set. The
repository-owned MongoDB provider also requires a running Docker engine with Docker Compose.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm bootstrap:local-env
```

Bootstrap creates missing package-local environment files; it does **not** start MongoDB. For the
Docker provider, set `MONGODB_URI` in the ignored `apps/api/.env.local` to this local-only target:

```dotenv
MONGODB_URI=mongodb://localhost:27019/badminton-club-dev?replicaSet=rs0&directConnection=true
```

Then start MongoDB before the application:

```sh
pnpm mongo:docker:start
pnpm dev
```

Open [localhost:3000](http://localhost:3000). The API uses port `3003`; the launcher waits for its
initial MongoDB connection and listening state before starting Web. An already configured
host-native `rs0` provider on port `27018` is an alternative. See the
[local environment guide](.repo-tools/development/README.md) for provider selection and startup
troubleshooting. Keep local values in ignored environment files.

This starts ordinary development on a separate resettable database. To create the synthetic
application dataset, run `pnpm seed:data` against that disposable local target. This deliberately
replaces its data and owned uploads; the command refuses non-development targets. Local mock
passwords remain convenient source defaults. Demo mode is opt-in and is not enabled by `pnpm dev`.
The hosted fresh bootstrap uses separate credential and target safeguards described in the runbook.

## Validate and build

```sh
pnpm validate
```

This runs formatting/lint checks, typechecking, ordinary workspace tests, repository-tool tests,
and the production build. Persistence integration tests are separate (`pnpm test:persistence`);
see [testing and persistence safety](docs/engineering/testing-and-persistence-safety.md).

`pnpm build` builds all packages. `pnpm local:production` offers a disposable local production-mode
rehearsal with Docker; it is not staging or a hosted deployment.

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/web/` | Next.js App Router, React UI, localization, and API adapters |
| `apps/api/` | Express API, domain services, Mongoose models, and integrations |
| `shared/types/` | Shared TypeScript vocabulary, schemas, and contracts |
| `docs/` | Project overview and retained product/engineering references |
| `deploy/local/` | Disposable local production-mode rehearsal |
| `deploy/northflank/` | Fresh demo deployment guidance and verification boundaries |

IONOS operations are not supported or retained here. Historical upstream operations are outside this public artifact.

## Provenance

Derived from the DCBV club application (`pengcc/badminton-club-app`). This is an independent,
synthetic portfolio demo, not the official club website or a live club service. Private source
history is not included or required to build and use this repository.
