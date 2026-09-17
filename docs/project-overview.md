# Project Overview

Badminton Club Demo demonstrates a real club-management application through a fictional,
non-live club. It retains the application's breadth while making the public demo safe to explore
with synthetic/resettable data. It is mostly feature-frozen for release curation; public
documentation emphasizes understanding the system rather than reproducing a complete internal
product-specification library.

## Three connected experiences

- **Public website:** localized club information, teams, activities, recruitment, membership and
  Taster Session information, announcements, and published documents.
- **Member experience:** account/profile maintenance and capability-controlled participation,
  including competition availability and lineup information.
- **Administration:** membership and account workflows, players and team rosters, matches,
  localized content, and communication templates.

The interfaces support German, English, and Chinese. The full application's capabilities remain
in the repository even when they are intentionally excluded from the public Demo Admin experience.

## Architecture

```text
Next.js App Router / React
  components → service hooks → API adapters
                         ↓
Express API
  routes → controllers → services → Mongoose models
                         ↓
                      MongoDB

shared/types: vocabulary, TypeScript contracts, and schemas used across packages
```

The Web uses next-intl for localization and TanStack Query for client-side server state. The API
owns authorization, validation, business transitions, and side-effect boundaries. MongoDB replica
set transactions support coordinated persistence operations. Shared contracts keep transport and
domain vocabulary aligned without making the browser the policy authority.

## Domain boundaries

| Concept | Responsibility |
| --- | --- |
| User/account | Login identity and canonical person-profile facts |
| Membership | Club membership state and lifecycle, separate from account access |
| Player | Sporting identity and team-roster membership |
| Team and Match | Competition identity, scheduling, results, availability, and lineups |
| Membership Application | Controlled intake and review before membership establishment |
| Public content | Capability-owned localized content, publication, and media/document handling |

These distinctions let the application represent membership, sporting participation, and access
without treating them as one interchangeable role. Detailed retained capability references remain
available through the [capability overview](capability-overview.md).

## Public-demo behavior

The Demo identity and public content disclose that this is a synthetic, non-live experience.
Contact, venue, schedule, and participation examples are not invitations to an actual club.

When the bounded demo runtime is enabled, the API restricts the dedicated Demo Admin to the accepted
read surface and temporary scratch Announcement/Match editing. Canonical data stays protected;
private/security workflows and excluded side effects remain inaccessible. Public entrypoints avoid
offering unsupported Taster submission, applicant recovery, password recovery, or Demo Admin
account self-service. This demo policy does not remove those underlying ordinary application
capabilities.

Repository implementation alone does not establish hosted demo provisioning, retained-content
acceptance, durable uploads, real email delivery, or production hardening. Use the
[README](../README.md) for local startup and the
[Northflank runbook](../deploy/northflank/README.md) for the represented hosting path and its
remaining verification boundaries.
