# Taster Session

## Purpose

This specification defines the visitor-request and administrator-follow-up capability for a first
club experience. The English product name is **Taster Session**, the German name is
**Schnuppertraining**, and Chinese copy describes a **newcomer experience activity** without
implying a sporting tryout or selection process.

A Taster Session is normally a free or low-cost introductory club experience. Any participation
fee is informational content only; this capability does not own pricing, payment collection, or
payment state. Public copy must not describe the offering as free unless the club's configured
offering is actually free.

## Product Boundary

Taster Session owns:

- a public visitor request;
- the visitor's plain-language self-identification as `beginner` or `experienced`;
- an optional or required non-binding time-and-location preference according to current matching
  options;
- administrator follow-up with one durable business outcome;
- reversible queue archive state; and
- capability-owned request and outcome email behavior.

It does not establish Membership, Player identity, Team suitability, sporting eligibility,
ranking, attendance, a booking, a capacity reservation, dated-session inventory, or Member
Training participation. Guest Play is an independent capability.

## Visitor Request

The visitor provides their name, normalized email address, self-identification, and an optional
message.

The self-identification values `beginner` and `experienced` are used only to filter preference
options, present appropriate visitor guidance, and inform administrator follow-up. They do not
determine or imply Player identity, sporting eligibility, Team suitability, Membership status,
ranking, or access to another training capability.

At most one `pending` request may exist for one normalized visitor email. A visitor may submit a
new request after the earlier request becomes `invited` or `declined`. This business duplicate
rule is separate from technical rate limiting and has no time-based cooldown.

## Preference Behavior

The shared Location and recurring weekly time-slot configuration is the only runtime source for
venue and time facts. An active Location and active weekly time slot are available for Taster
Session by default for both visitor categories unless the slot explicitly disables Taster Session
or restricts its accepted categories. These restrictions affect only Taster Session and do not
change Guest Play or ordinary public Location visibility.

Preference options cover the next 21 days in `Europe/Berlin` and present the localized date, full
time range, Location name and address, and any localized participation note. The note is guidance,
not executable sporting eligibility. Option identity is independent of display locale.

When matching active preference options exist, the visitor must select one. When no matching active
option exists, the visitor may submit without a preference and is told that an administrator will
follow up to arrange a suitable time.

Every selected date, time, and location is a non-binding preference only. It does not reserve
capacity, create a booking, confirm attendance, establish dated-session inventory, or imply that
capacity is available.

After server-side revalidation, a new request copies the selected Location identifier, stable time
slot identifier, localized Location name and address, local date, start and end time, and canonical
start instant, plus the localized participation note when present. Later shared-configuration
changes do not rewrite those request-time facts. Older requests with the previous smaller
preference shape remain readable using their stored start instant and Location name; missing
historical facts are not guessed or backfilled from mutable
current configuration.

## Administrator Outcomes

Every request has one durable business status: `pending`, `invited`, or `declined`.

The first boundary permits only `pending -> invited` and `pending -> declined`. `invited` and
`declined` are terminal. Reopen, correction, and transitions between terminal outcomes are not
part of this boundary.

A decline may record `no capacity` or another reason. The reason explains administrator follow-up;
it does not introduce capacity inventory, reservations, or availability state.

## Archive and Queue

Archive is a separate reversible queue and lifecycle flag. Archiving never changes the durable
business status and is available for every status.

Archived requests are hidden from the default administrator queue. Administrators can explicitly
include archived requests, view only archived requests, and unarchive them.

The normal administration interface provides no permanent hard deletion. Permanent deletion and
retention periods require a separately confirmed privacy and data-retention policy.

## Email Boundary

Request submission and administrator disposition succeed independently from email delivery.

- Automatic visitor receipts and administrator alerts are untracked best-effort messages.
- Taster Session administrator alerts use the explicit `tasterSessionAlerts` recipient list. An
  empty list is valid and means the alert is not configured; environment values and administrator
  accounts are not hidden fallback recipients.
- Administrator-triggered invitation and decline emails record the latest delivery outcome.
- A failed or uncertain administrator-triggered delivery can be retried explicitly.
- Retry sends only the email and never repeats or changes the persisted disposition.
- Retry is not a late first-send action when no outcome email was requested at disposition.
- An uncertain outcome is shown truthfully; administrators are warned that retry may duplicate a
  message the provider accepted but did not confirm.

This behavior is capability-owned and does not introduce a generic notification platform.

## Non-Goals

This boundary does not introduce Member Training; attendance, waitlists, or capacity reservations;
dated-session management or a generic scheduling platform; a shared Session or capacity owner;
Guest Play redesign; terminal-outcome corrections or reopen commands; permanent deletion or
retention policy; or a generic notification platform.

## Documentation Boundary

This document owns confirmed Taster Session product behavior. The
[Capability Overview](../capability-overview.md) owns capability navigation and maturity. Current
implementation facts belong to Project Memory and repository evidence.
