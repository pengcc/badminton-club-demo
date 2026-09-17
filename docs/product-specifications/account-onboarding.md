# Account Onboarding

## Purpose

This specification defines source-neutral product behaviour for establishing one canonical User,
inviting that User to set a password, tracking delivery and completion, and recovering from expiry
or delivery failure.

It applies across confirmed entry paths without making Membership Application approval the owner of
all account setup. The [Controlled Membership Registration](registration.md) specification owns the
application-intake and review flow; this document owns the shared onboarding outcome.

## Product Boundary

Account Onboarding owns:

- canonical User establishment or compatible reuse;
- identity-collision handling for administrative establishment and legacy import;
- individual invitation issuance;
- invitation delivery outcome, expiry, completion, and safe reissue; and
- preservation of canonical identity across onboarding attempts.

Authentication owns credentials, sign-in, and sessions. Authorization owns backend-enforced access
decisions. Membership Lifecycle owns membership state and membership-driven Player transitions.
Competition owns Team, ranking, Match, Availability, and Lineup behaviour.

## Supported Entry Paths

The shared onboarding behaviour supports:

1. a Membership Applicant whose approved application establishes or reuses the User;
2. an administrator-established Member, with an optional Player establishment or association;
3. an administrator-established External Player; and
4. a successfully imported legacy Member after administrator review and explicit batch-invitation
   confirmation.

There is no standalone authenticated User product category. A normal non-administrator User must
belong to a confirmed product identity or workflow such as Membership Applicant, Member, or
External Player. The product does not provide an administrator task for creating an otherwise
unaffiliated ordinary User.

The canonical Super Admin is a separate singleton operational account, not an onboarding target.
It is created or recovered only through the operator workflow, uses the existing password-setup
and session-security mechanisms, and has no person, Membership, or Player facts.

## Canonical Identity

Every User requires an email address. The normalized email is globally unique across Users and is
the authoritative lookup for administrative establishment and legacy import.

When that email identifies an existing compatible canonical identity, onboarding reuses it. The
system must not create a second User for the same normalized email.

When a match is ambiguous or incompatible, the operation stops for administrator review. The
system must not automatically merge people based only on name, birth date, or other non-unique
facts. The outcome preserves or establishes at most one canonical User and, where applicable, one
canonical Player.

Missing email cannot produce a User account. How a particular legacy source reports or resolves a
missing email remains format-specific and is not defined here.

## Member and Player Establishment

Establishing a Member always establishes or reuses the canonical User. The administrator chooses
whether a Player is also established or associated at that time. Not every Member is a Player.

An optional member Player uses the existing Player identity and Membership Lifecycle rules. Team
assignment and ranking are separate administrative tasks and are not required to send the account
invitation.

An External Player is an ordinary User-linked Player without Membership. External Player
establishment uses the same canonical User and invitation behaviour and does not create a separate
account or Competition model.

## Invitation Setup

A newly established or imported User who requires account access completes initial setup through
an invitation email. Each recipient receives an individually generated, time-limited, single-use
password-setup token or link.

A batch may use one shared email template, but it must not share an invitation credential. Each
User has an independent invitation and outcome.

The onboarding experience must represent:

- invitation issuance;
- expiry;
- `sent`, `failed`, and `uncertain` delivery outcomes;
- safe reissue that replaces the prior setup opportunity;
- successful password-setup completion; and
- prevention of duplicate account creation during retry or recovery.

Temporary-password invitation is not supported target behaviour. The system must not generate,
persist, or email a temporary password when issuing an onboarding invitation.
Any current temporary-password invitation path is obsolete implementation and does not define
product intent.

## Delivery and Recovery

Canonical identity establishment and invitation delivery are distinct outcomes. A delivery failure
or uncertain result does not roll back an already established User, Membership, or Player identity.

Administrators must be able to see the per-User outcome and safely reissue an expired or failed
invitation. Reissue must preserve the canonical identity and must not create a duplicate account.

Successful setup completes the invitation's purpose. Later account access follows normal
Authentication and Authorization policy.

## Legacy Member Import

Legacy import does not require a new Membership Application. Import and invitation release are
separate stages:

1. import and validate legacy Member identities;
2. present row-level outcomes for administrator review; and
3. after explicit administrator confirmation, send a batch invitation to successfully imported
   Users.

Each batch recipient receives an individual setup token or link and an individual delivery outcome.
Failed or expired invitations can be reissued. Email failure does not roll back a successfully
imported canonical identity.

The supported legacy source fields, encoding, volume, duplicate characteristics, missing-email
representation, and Player-related fields remain unresolved until representative source evidence
is available. This document does not define a general migration format.

## Administrative Experience

Administrative onboarding should be task-oriented. The administrator chooses a supported outcome—
Member with optional Player, External Player, or reviewed imported Members—and sees identity and
invitation results relevant to that task.

The interface must not present uncertain delivery as confirmed success and must direct ambiguous or
incompatible identity matches to review rather than silently merging them. See
[Task-Oriented Administration](../product-principles/task-oriented-administration.md).

## Non-Goals

Account Onboarding does not define:

- unrestricted public account registration;
- a standalone authenticated person-account category, capability, or establishment path;
- creation or recovery of the canonical Super Admin through ordinary onboarding;
- Team assignment or Player ranking;
- a general-purpose invitation or access-policy platform;
- automatic identity merging from non-unique personal facts;
- broad legacy migration, fees, SEPA history, documents, or operational data repair;
- SMTP transport, email-provider behaviour, API shapes, transactions, database representation, or
  token persistence; or
- Competition access and participation rules, which belong to [Competition](competition.md).

## Documentation Boundary

This document defines confirmed product behaviour. It does not claim that every entry path is
implemented. Current implementation is established through Project Memory and repository evidence;
technical orchestration and persistence belong to later architecture and implementation planning.
