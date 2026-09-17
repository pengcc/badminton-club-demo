# Membership Termination

## Purpose

This specification defines the confirmed membership-termination lifecycle: request, approval,
future effective date, waiting period, and the final transition to inactive Membership. It defines
product behavior without prescribing persistence, scheduling, API, or user-interface design.

The [Membership Domain Architecture](../architecture/membership-domain-model.md) owns the resulting
Membership and member-Player eligibility transitions. [Competition](competition.md) owns the effect
of current Player and Team state on Match access and participation.

## Product Goal

The product must provide one reliable and auditable termination lifecycle for:

- an online request submitted by a current Member;
- an administrator-recorded request received through an offline channel; and
- bounded administrator batch recording for multiple Members.

The entry paths converge on the same review/approval facts and effective Membership transition. The
normal path uses a scheduled quarter-end and waiting period; administrators may instead choose the
explicit `Today` timing exception when Membership must end immediately.

## Effective-Date Rules

Termination may take effect only at a calendar-quarter end:

- March 31;
- June 30;
- September 30; or
- December 31.

A request requires one full calendar month of notice. For example, June 30 remains valid through
May 31; from June 1, September 30 is the earliest valid date.

The member and administrator experiences should present only currently valid quarter-end dates.
The authoritative business boundary must independently validate the selected date.

Termination calendar-day policy uses the `Europe/Berlin` business date. Effective dates remain
date-only values: June 30 is valid through May 31 in Berlin and becomes invalid when June 1 begins
in Berlin, regardless of the server or browser's local time zone.

## Online Member Request

1. A current Member opens the termination task and sees valid quarter-end dates without a
   preselected commitment.
2. The Member deliberately selects one requested Membership end date and confirms submission.
3. The request waits for administrator review.
4. An administrator either approves that exact requested date or rejects the request with a
   retained reason. The administrator does not choose a different normal scheduled date.
5. An approved request remains visible during the waiting period as `Membership ends on`; a
   rejected request closes and permits a new request while the person remains a current Member.
6. When the effective date is reached, Membership Lifecycle changes the Membership to `inactive`
   exactly once.

A timely request remains approvable after only its notice deadline passes. If the requested end
date itself is no longer future-valid at review, it cannot be approved, silently rescheduled, or
converted to the `Today` exception on that request; the administrator rejects it with a reason.

Submitting or approving a request does not immediately inactivate the Membership. A Member cannot
create a duplicate request while another request remains open.

## Administrator-Recorded and Batch Requests

For an offline request, an administrator selects the Member by recognizable name and email while
the system submits the stable User identity. The administrator records the source, request facts,
timing, and necessary notes. The recorded request is approved immediately.

For a bounded batch, the administrator selects multiple recognizable Members and one shared timing
choice. Each affected Member receives an independently traceable termination outcome.

Scheduled recording uses a valid quarter-end, the normal notice policy, and the ordinary waiting period.
`Today` is an administrator-only exception: the server derives the current Berlin date, requires
an explicit reason, and completes the same termination and Membership Lifecycle transition in the
request transaction. It produces the same `inactive` Membership state; it is not permanent account
deletion and does not delete User or Player identity. Retaining that identity does not promise
continued authenticated access after Membership becomes inactive. A batch must not weaken
lifecycle, audit, or per-Member atomicity.

## Lifecycle and Capability Effects

Until the effective date, the Member retains the capabilities associated with their current
Membership state. An approved future termination is visible as an additional lifecycle fact; it is
not a replacement Membership status.

At the scheduled effective date, or immediately for an administrator `Today` exception:

- Membership Lifecycle changes eligible active or passive Membership to `inactive`;
- current-member capabilities end;
- ordinarily, a member Player is disabled while its identity is preserved and current Team
  associations are cleared; and
- existing Match, Availability, and Lineup references remain intact.

Account suspension does not pause or alter a due termination. A suspended Account follows the same
effective-date Membership and Player outcome as any other eligible Member.

Membership Termination does not promise or automatically perform a later External Player outcome.
If a former Member should participate as an External Player, an administrator makes that separate
explicit decision through the Player lifecycle after Membership is inactive. The conversion keeps
the same Player identity, enables External Player participation, and does not restore Team
associations; Team assignment remains a separate Competition task.

A genuine due-processing failure remains fail-closed and leaves the approved termination open.
The administrator view shows one bounded safe projection of the latest failed attempt so the
underlying Membership or Player state can be inspected. Automatic retry remains appropriate only
when correcting that state can make the existing confirmed termination succeed; it does not invent
a different Player outcome.

## Traceability

The product must preserve enough information to establish:

- request source and request time;
- the Member and requested effective date;
- the approving or rejecting administrator, review time, outcome, and required rejection reason;
- the approved Membership end date and necessary notes;
- the final Membership transition and its time; and
- the per-Member outcome of a batch or due transition.

Request, approval, and final transition must be safe under retry and concurrent processing. The
product requires the durable outcome; it does not prescribe a particular processor or scheduler.

## Optional Capabilities

The following remain optional and require separate confirmation before becoming delivery scope:

- changing or cancelling an approved request before it becomes effective;
- member withdrawal of a pending or approved request;
- request, approval, or final-termination notifications;
- a complete termination-history presentation beyond the current open/waiting state and required
  traceability.

## Non-Goals

The first product boundary does not define:

- a dedicated Membership status for the waiting period;
- the persistence shape of termination records;
- cron, scheduler, request-triggered, or manual processing mechanics;
- automatic or termination-selected conversion to External Player;
- deletion of User or Player identity;
- destructive cleanup of existing Match, Availability, or Lineup references; or
- fees, refunds, mailing-list policy, or broad notification orchestration.

## Product Principle

Prioritize the complete main flow:

`request -> approval or rejection -> scheduled waiting period or administrator Today exception -> inactive Membership`

Optional exceptions and notifications must not compromise date correctness, lifecycle ownership,
traceability, or retry safety.

## Documentation Boundary

This document owns confirmed termination product behavior. Use
[Membership Domain Architecture](../architecture/membership-domain-model.md) for lifecycle and
eligibility invariants, [Account Onboarding](account-onboarding.md) for later account setup or
re-establishment concerns, and [Competition](competition.md) for Match-specific consequences.
Current implementation is established through Project Memory and repository evidence.
