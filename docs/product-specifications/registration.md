# Controlled Membership Registration

## Purpose

This specification defines the controlled membership-application intake and review flow that
establishes a Member. It does not define unrestricted public account registration or the shared
product behavior for canonical User establishment and invitation delivery.

Shared canonical identity, normalized-email matching, password-setup invitations, delivery
outcomes, expiry, reissue, administrative Member establishment, External Player establishment, and
legacy import are owned by [Account Onboarding](account-onboarding.md).

## Product Boundary

Controlled Membership Registration owns:

- access-controlled intake for an approved prospective member;
- collection and submission of the required personal and membership information, followed by any
  banking information and signed documents required for approval;
- generation and submission of the required application and SEPA documents;
- administrator review, annotation, approval, and rejection of the application; and
- the approved transition from Membership Applicant to Member through Membership Lifecycle.

It does not own Authentication, general account establishment, setup-email delivery and recovery,
External Player establishment, legacy Member import, Team assignment, or Competition behavior.

## Product Intent

Membership registration is a controlled continuation of the club's real-world admission process.
It is not an unrestricted public account-creation feature.

A prospective member may first use the visitor-facing
[Taster Session](taster-session.md) workflow and receives club approval before entering the formal
application flow. The current application entry is made
available through an administrator-managed shared registration link. Access to that flow and
permission to submit an application are independently enforced by the backend.

The shared registration link is reusable by multiple approved prospective applicants until it
expires or an administrator deliberately replaces it. An authorized administrator can retrieve
and copy the current active link together with its Version and expiry state. Newly issued links
default to 30 days, while 90-day, 180-day, and no-automatic-expiry choices remain available.
Replacement immediately invalidates the former shared Version.

The current valid shared registration link is sufficient controlled entry for a prospective
applicant, including after a rejected or withdrawn application, subject to the normal independent
eligibility and anti-abuse rules. Rotating the club-wide shared link is not a per-applicant
reauthorization action.

Possession of the shared registration link does not establish a User, Player, credential, or
Membership. The applicant first verifies an email address. Verification creates or resumes one
canonical application and establishes a short-lived, application-scoped browser session; later
access uses a single-use link sent to the verified email address. Submitting the draft creates no
account and moves only the saved application into review.

## Applicant-Entered Flow

1. The club allows a prospective member to proceed.
2. The applicant verifies an email address and receives temporary access to one saved draft.
3. The applicant may save and resume partial personal, membership, banking, and student-proof data.
   Banking and student proof are optional at submission. Banking is encrypted and private proof is
   not publicly served.
4. The applicant submits complete core personal data plus a Membership type. Banking may be
   completed while the application is pending, but approval requires complete banking. The bank
   relationship identifies either the applicant or another person as the account holder; it does
   not introduce a separate payer role.
5. While pending, Membership Application and SEPA PDFs are generated transiently from current saved
   data for download or optional delivery to the verified email. The SEPA mandate identifies the
   Membership applicant separately from the bank account holder. Generated PDFs are not retained
   as application records.
6. Signed Membership Application and SEPA receipt are recorded separately. Relevant applicant data
   changes reset the affected receipt and require the document to be signed and received again.
7. An administrator may add an internal review note, contact the applicant, manage proof and signed
   receipts, and approve or reject. Rejection requires an applicant-visible reason; internal notes
   are never applicant-visible notification content.
8. Approval requires pending status, complete encrypted banking, and both active signed-document
   receipts. Missing student proof warns but does not block approval.
9. Approval establishes or reuses one canonical User and active Membership through Membership
   Lifecycle. Registration approval does not create a Player; an already compatible canonical
   Player is preserved or converted without duplication.
10. Approved banking moves to a durable encrypted Member-owned record. Account setup continues
   separately through the source-neutral invitation behavior defined by
   [Account Onboarding](account-onboarding.md).

Approval is the boundary that establishes the Member. Application submission alone must not create
or activate an account.

## Administrator-Handled Entry

An administrator may record an application received through paper, email, or another offline
channel and complete the same review and approval outcome where an application record is useful.

An administrator may also establish a Member directly when a Membership Application is not
required. That path still establishes or reuses the canonical User and lets the administrator
choose whether to establish or associate a Player. It belongs to
[Account Onboarding](account-onboarding.md), not to a parallel registration or standalone-User
workflow.

Team association and ranking are separate tasks and are not required for Member establishment or
account invitation.

## Review and Establishment Rules

- Application state is separate from Membership state.
- Approval must produce one canonical Member identity and must not duplicate a compatible existing
  User or Player.
- A Member may exist without a Player.
- Any member Player transition is owned by Membership Lifecycle.
- An External Player may be converted to a Member without replacing the canonical User, Player, or
  existing sporting references when the identity is compatible.
- Ambiguous or incompatible identity matches must stop for administrator review.
- Approval success and account-invitation delivery are distinct outcomes.
- Approval/rejection notification delivery is distinct from the committed decision and can be
  retried by an administrator.
- Membership Application administrator alerts use the explicit `applicationAlerts` recipient
  list. An empty list is valid and means the alert is not configured; environment values and
  administrator accounts are not hidden fallback recipients.

The detailed identity, email, setup-token, delivery, recovery, and import rules are defined once in
[Account Onboarding](account-onboarding.md).

## Retention and Privacy

- Temporary verification/access data expires no later than 24 hours; access links themselves are
  valid for 30 minutes and applicant sessions for at most 24 hours.
- Drafts are deleted after 30 days without applicant-data changes. Merely viewing the application
  or requesting a new access link does not refresh that period.
- Pending applications are not deleted by age while review is open.
- Approved, rejected, and withdrawn applications and their private proof are deleted after 90 days.
  Approved applications are deleted only after Member-owned encrypted banking and durable approval
  provenance are verified.
- Member account, Member-owned banking, onboarding, and minimal existing audit/approval provenance
  remain independent of application retention. No pre-deletion reminder email is sent.

## Non-Goals

Controlled Membership Registration does not introduce:

- unrestricted public self-registration or a public create-account page;
- a standalone authenticated User category or unaffiliated ordinary-User establishment path;
- a general-purpose invitation or access-policy platform;
- separate canonical-identity, email, delivery, or recovery rules for applicants;
- Team assignment, ranking, or Competition administration; or
- implementation prescriptions for routes, tokens, persistence, transactions, or email transport.

## Documentation Boundary

This document defines confirmed product behavior for application intake and review. Use
[Account Onboarding](account-onboarding.md) for shared account establishment and
[Membership Domain Architecture](../architecture/membership-domain-model.md) for the durable
User, Membership, Player, eligibility, and lifecycle boundaries. Current implementation is
established through Project Memory and repository evidence.
