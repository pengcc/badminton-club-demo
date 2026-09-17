# Guest Play

## Purpose

Guest Play lets an eligible current member ask for permission to bring one to five friends or
family members to a concrete club play opportunity. Approval is permission only: it is not a
booking, court reservation, capacity commitment, attendance record, or guarantee of play.

## Member Request

Active and passive members may submit. Suspended, inactive, and non-member identities may not.
The member chooses one opportunity offered for the next 21 days in `Europe/Berlin`, supplies a
guest count from one to five, and may add a message. Account identity is used automatically.

Opportunities come from active Locations and active weekly time slots in the shared club-play
configuration. A slot is available by default unless it explicitly restricts Guest Play. A
localized participation note may be displayed as guidance; it is not an automated sporting-level
eligibility rule.

The server revalidates the Location, slot, weekday, date, active state, Guest Play restriction,
and future window. It stores the request-time Location name and address, local date, start and end
time, and start instant. Later configuration changes do not rewrite those facts.

Guest Play shares only these Location and recurring weekly-time facts with Taster Session. It does
not share requester identity, requests, eligibility, lifecycle, decisions, delivery, or archive
state. Taster Session restrictions do not restrict Guest Play, and subjective participation notes
remain informational rather than executable eligibility policy.

For one member and concrete opportunity, only one pending or approved request may exist. A member
may submit again after decline or cancellation. Members can view their own history and cancel only
their own pending request.

## Outcome and Administration

The business outcome is `pending`, `approved`, `declined`, or `cancelled`. Archive is a separate,
reversible administrator queue state and never changes the outcome. Normal hard deletion is not
part of the capability.

Administrators may approve or decline a pending request. Approved and declined outcomes may be
corrected through an explicit command with a required correction reason. Approval, including a
correction to approved, rechecks current member eligibility and rejects a requested time that has
passed. Administrator decisions, corrections, archive, and restore are recorded through the
shared audit owner.

Members never receive administrator notes, recipient configuration, audit data, or notification
diagnostics.

## Email Delivery

Guest Play administrator recipients are maintained in Notification Settings. An empty list is
valid and means the administrator alert is not configured; runtime environment values and
administrator accounts are not hidden fallback recipients.

The request stores only the current delivery state for the member receipt, administrator alert,
and current decision email. Request submission and decisions are persisted before email is sent.
Failed or uncertain delivery never reverses a successful business action.

An administrator may explicitly retry an eligible failed, uncertain, or stale sending entry.
Retry sends email only; it does not recreate a request or replay a decision. A corrected outcome
replaces the current decision-email state while the audit log retains the correction trail.

## Non-Goals

Guest Play does not own a schedule, dated-session inventory, booking, capacity, attendance,
waitlist, court allocation, guest identity, sporting-level assessment, pricing, payment, or a
generic notification platform. It does not redesign Taster Session or the shared Location and
weekly time-slot configuration.

## Documentation Boundary

This document owns confirmed Guest Play product behavior. The
[Capability Overview](../capability-overview.md) owns capability navigation and maturity. Current
implementation facts belong to Project Memory and repository evidence.
