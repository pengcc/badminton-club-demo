# Project Capability Overview

## Purpose

This document is the maintained project capability map and navigation owner for capability
relationships, high-level responsibilities, non-ownership, and review maturity. It links to
detailed maintained owners rather than repeating their business rules.

Use the [Project Overview](project-overview.md) for product identity and the
[Documentation Index](documentation-index.md) to route questions by authority class.

This document is not a feature inventory, release dashboard, implementation-status report, package
plan, repository file list, or replacement for product specifications and architecture.

## Maturity Labels

- **Confirmed and reviewed:** the capability boundary has confirmed product and maintained ownership
  sufficient for navigation.
- **Confirmed; architecture pending:** product behaviour is confirmed, while detailed architecture
  remains to be accepted.
- **Partially reviewed:** some durable responsibilities are established, but the full boundary has
  not been reviewed.
- **Provisional / not yet reviewed:** only a small high-level responsibility is supported by maintained
  authority; current code must not be treated as confirmed target behaviour.

Maturity describes confidence in the capability boundary, not implementation completion.

## Core Relationships

The product capabilities are peers and supporting owners connected by explicit consumption
relationships. They do not form one linear delivery or architectural sequence.

```text
Account Onboarding ── provides canonical User readiness ──┐
Authentication / Authorization ── provides account access ├──> product workflows
                                                         │
Membership Lifecycle ── owns membership-driven           │
                        Player transitions ───────────────┤
                                                         v
Player identity and authoritative eligibility ─────> Competition
                                                     owns Match-specific behaviour

Audit supports each capability's required traceability.
Location owns shared venue and recurring weekly-time facts consumed independently by Taster Session
and Guest Play.
Public content, Taster Session, Guest Play, Activities,
Documents, and the capability-owned facts stored or delivered through notification and Settings
mechanisms are peer or supporting areas.
```

A Member does not always have a Player identity. An External Player is an ordinary Player linked to
a User without Membership. Membership Lifecycle owns membership-driven Player enablement,
deactivation, and conversion. Competition consumes authoritative Player
identity and eligibility; it does not reinterpret membership status.

## Confirmed Capability Owners

### Account Onboarding

**Maturity:** Confirmed and reviewed; technical architecture pending.

Account Onboarding owns source-neutral canonical User establishment and invitation setup across
Membership Applicant, administrator-established Member, External Player, and reviewed legacy-import
entry paths. It does not own application review, membership state, Team assignment, ranking, or
Competition participation rules.

Detailed owner: [Account Onboarding](product-specifications/account-onboarding.md).

### Membership Application and Registration

**Maturity:** Partially reviewed; maintained specification exists and later alignment is required.

Registration owns controlled access to the Membership Application, application submission, review,
and approval orchestration. It requests shared Account Onboarding and Membership Lifecycle outcomes
instead of owning all identity, invitation, or lifecycle behaviour.

Detailed owner: [Controlled Membership Registration](product-specifications/registration.md).

### Membership Lifecycle

**Maturity:** Confirmed and reviewed.

Membership Lifecycle owns current membership state and membership-driven Player transitions,
including explicit Player-type conversion, Player enable/deactivation batches, and their
consequences. Membership Termination owns only its confirmed Membership outcome; a later External
Player decision is a separate administrator-controlled Player lifecycle action. Membership
Lifecycle does not own Match-specific Availability, Lineup, Team-roster, result, or history rules.

Detailed owners:

- [Membership Domain Architecture](architecture/membership-domain-model.md)
- [Membership Termination](product-specifications/membership-termination.md)

### Member Administration

**Maturity:** Confirmed and reviewed.

Member Administration owns the administrator-facing Active Participant and Member projections,
their complete-cohort demographic summaries, and bounded Member CSV data tools. It consumes
Membership Lifecycle and Player eligibility facts without creating a new lifecycle or attendance
state. Competition owns Team relationships and exposes the bounded selected-Team roster export.

Detailed owner: [Member Administration](product-specifications/member-administration.md).

### Player Identity and Eligibility

**Maturity:** Confirmed and reviewed at the Membership–Competition boundary.

Player is the sporting identity linked to a User and consumed by Team, Match, Availability, and
Lineup workflows while the sporting relationship continues. Membership Lifecycle owns
membership-driven eligibility transitions and explicit participation enable/deactivation.
Administration owns guarded physical Player cleanup after participation ends and guarded final
inactive-account cleanup; neither operation may erase history or orphan a Player. External Players
retain ordinary Player identity without Membership. Competition adds only Match-specific Team,
Availability, position, and Lineup requirements after consuming the authoritative eligibility
result.

Detailed boundary: [Membership Domain Architecture](architecture/membership-domain-model.md).

### Competition

**Maturity:** Confirmed; architecture and implementation alignment pending.

Competition owns current Team–Player sporting relationships and the user-visible Match,
Availability, Lineup, ranking, result, History, access, and schedule-import behaviour. It does not
own Membership Lifecycle, account establishment, or official BVBB eligibility policy.

Detailed owner: [Competition](product-specifications/competition.md).

### Taster Session

**Maturity:** Confirmed and reviewed.

Taster Session owns a public visitor request and administrator follow-up workflow with non-binding
preferences, terminal `invited` or `declined` outcomes, reversible queue archive state, and
capability-owned email delivery. It consumes shared Location and recurring weekly-time facts but
does not own Member Training, booking, attendance, capacity inventory, dated-session management,
Player or Team suitability, or Guest Play.

Detailed owner: [Taster Session](product-specifications/taster-session.md).

### Guest Play

**Maturity:** Confirmed and reviewed.

Guest Play owns an authenticated current-member request for permission to bring one to five guests,
member cancellation, administrator decisions and correction, reversible archive state, and
capability-owned notification outcomes. Approval does not reserve a court or guarantee
participation. Guest Play consumes shared Location and recurring weekly-time facts but does not own
Taster Session or a schedule, booking, capacity, attendance, or guest-identity model.

Detailed owner: [Guest Play](product-specifications/guest-play.md).

## Shared Operational Owners

### Location and Recurring Weekly Play Times

Location owns localized venue facts, Location active state, and canonical recurring weekly play
times. A weekly slot may contain independent lightweight Guest Play and Taster Session
restrictions. Missing capability restriction metadata leaves an otherwise active Location and slot
available to that capability.

This shared configuration has no requester, request record, lifecycle, decision, delivery, archive,
or capability maturity of its own. When a request includes a selected option, the consuming
capability validates it and copies the applicable venue/time facts onto that request; later
configuration changes do not rewrite submitted requests. The owner does not establish booking,
capacity, attendance, waitlists, dated sessions, a generic Session, or Member Training.

## Cross-Cutting Owners

### Authentication and Authorization

**Maturity:** Partially reviewed.

Authentication owns credentials, sign-in, and sessions. Authorization owns backend-enforced access
decisions consumed by product workflows. These concerns are distinct
from Membership state, Player identity, and Account Onboarding.

Temporary Account suspension is owned here as a User/Authentication access block. It rejects
sign-in and protected requests, records the administrator and reason, and revokes active sessions.
Suspending or restoring Account access does not change Membership state, Player participation,
Team associations, Competition facts, or administrator designation.

Account kind, ordinary-person administrator designation, and effective capabilities are distinct.
The singleton canonical Super Admin is an operational principal with no person, Membership, or
Player facts. Ordinary administrator capability is derived from current designation and membership
state; it is not a persisted role label.

Current durable boundary: [Membership Domain Architecture](architecture/membership-domain-model.md).

### Audit

**Maturity:** Confirmed and reviewed.

Audit provides privacy-minimized operational traceability required by each capability. The
capability performing a business change owns whether Audit is required and which bounded business
facts must be traceable; Audit owns the common record/read mechanics, actor/source presentation,
administrator inspection surface, and current-store retention. It does not own the business
transition or replace capability-specific rules.

Detailed owner: [Audit](product-specifications/audit.md).

## Other Product and Supporting Areas

The following areas are present in the maintained product overview. Their review maturity varies;
confirmed areas link to their maintained owner, while descriptions without such an owner remain
intentionally minimal.

| Area | High-level responsibility | Maturity |
| --- | --- | --- |
| Public Website and CMS-managed content | Present club information and publish bounded localized content through explicit capability owners; detailed owner: [Public Content and CMS](product-specifications/public-content-and-cms.md) | Confirmed and reviewed |
| Activities and Images | Publish club activities and related media | Provisional / not yet reviewed |
| Notifications and Email | Supporting delivery/template mechanisms; each sending capability owns message purpose, recipient semantics, locale, and delivery/retry behavior | Provisional supporting area |
| PDFs and Documents | Generate capability-owned Membership, SEPA, and other documents | Provisional supporting area |
| Settings and Templates | Supporting storage/configuration mechanisms; concrete recipient, public-content, and template facts remain with their maintained capability owners | Provisional supporting area |

These labels do not infer a target architecture from current code. A future change to one of these
areas should begin with its real club scenario and the smallest relevant maintained authority.
The navigation grouping does not create a generic Notification or Settings product owner.

## Navigation and Non-Ownership Rules

- Use this overview to find the capability owner and understand consumption relationships.
- Use product specifications for intended behaviour and architecture documents for durable models
  and invariants.
- Use Project Memory and repository evidence for current implementation; maturity here is not a
  completion claim.
- Keep administrative surfaces task-oriented as defined by
  [Task-Oriented Administration](product-principles/task-oriented-administration.md).
- Do not copy detailed Account Onboarding, Membership Lifecycle, Availability, Lineup, or other
  product rules into this overview; update or link their maintained owner instead.
