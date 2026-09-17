# Membership Domain Architecture Baseline

Purpose

This document defines the durable domain model for membership, account access, and Player identity in the badminton club application.

It is the architectural baseline for later implementation planning, data migration, testing, and future feature development.

This document describes the intended domain responsibilities and invariants. It does not document current bugs, implementation work packages, runtime evidence, or specific source files.

Use the [Capability Overview](../capability-overview.md) for capability navigation,
[Account Onboarding](../product-specifications/account-onboarding.md) for canonical User
establishment and invitation behavior, and [Competition](../product-specifications/competition.md)
for Team, Match, Availability, and Lineup product rules.

Core Principles

Membership state, account access, Player identity, and Player eligibility are separate concerns.

They must not be represented or inferred through one combined status.

The system should retain the current incremental architecture:

* User remains the authenticated system identity.
* Current membership state remains stored on User.membershipStatus.
* Player remains a separate sporting identity linked to a User account.
* A separate Membership entity is not introduced at the current stage.
* Member-related lifecycle transitions are coordinated through one membership-lifecycle capability.
* External Players are supported explicitly without treating them as current members.

The current codebase and schema are implementation evidence, not automatic proof of the optimal design.

Core Concepts

User

User represents an authenticated account in the system. `accountKind` distinguishes an ordinary
person account from the singleton canonical `super_admin` operational principal.

User owns:

* authentication identity;
* credentials and account linkage;
* account kind;
* ordinary-person administrator designation;
* current membership state;
* the account information required by centralized access-control policy.

User does not own sporting profile data such as:

* ranking;
* Team membership;
* Player eligibility;
* Match identity;
* sporting preferences.

For the current architecture, membership state remains stored on `User.membershipStatus` for
person accounts. The canonical Super Admin has no person, Membership, or Player facts.

This is a storage simplification. It does not mean that User, membership, and account access are the same domain concept.

Membership

Membership represents whether the User is currently a club member and the current condition of that membership.

Supported membership states are:

* active
* passive
* inactive

Membership does not manage:

* membership fees;
* billing;
* SEPA collection;
* bank debit processing;
* payment state;
* accounting;
* overdue payments.

Although passive membership has a different real-world fee, that difference is outside the current system scope.

Membership Application

A Membership Application represents a submitted request to join the club.

Application state is separate from membership state.

pending belongs to MembershipApplication.status.

It means that an application has been submitted and is waiting for review.

pending must not be used as a value of User.membershipStatus.

An approved application should produce a complete and usable current-member account. Establishing
or associating a Player is optional because a Member does not necessarily participate in sporting
workflows.

Player

Player represents the persistent sporting identity used by:

* Team;
* Availability;
* Lineup;
* Match;
* ranking and sporting preferences.

Player owns:

* Player type;
* participation enablement and the Player-owned inputs to effective sporting eligibility;
* ranking;
* sporting preferences;
* Team relationships;
* sporting identity used by downstream capabilities.

The Player record is the authoritative persisted representation of sporting identity while the
sporting relationship continues. `Player.isActivePlayer` records whether participation is enabled;
effective current eligibility additionally depends on Player type and current Membership state.

For member Players, Membership Lifecycle owns enabling, deactivating, and converting the Player and
the membership transitions that may restrict effective eligibility. Physical cleanup is a separate
guarded operation after participation has ended.

The Player domain stores the sporting identity but does not independently decide whether a member becomes or ceases to be a Player.

External Player

External Player represents a person who is not a current member but is allowed to participate in sporting workflows.

An external Player may be a former member or a person who has never held current membership.

External Players are a confirmed business capability.

External Players:

* require User accounts;
* are not current members;
* use an explicit Player type of external;
* may participate in authenticated Player workflows;
* must not access current-member-only capabilities.

Guest, temporary, and similar non-member Players should initially use the broader external Player category.

More detailed subtypes should be introduced only when they require materially different lifecycle, eligibility, expiry, or authorization rules.

Account Access

Account access determines whether a User may authenticate and which capabilities the User may use.

Account access is not identical to membership state.

The authorization model must distinguish:

* current-member access;
* active-Player access;
* external-Player access;
* administrator access.

Administrator access is derived from current state. The canonical Super Admin always receives
only authenticated-account and administration capabilities. A person receives administration
only while designated and active or passive; transition to inactive clears the designation
atomically.

Membership status must not be used as the universal login switch.

Temporary Account suspension is an ordinary authentication access block, represented by an
`accountSuspension` fact containing its reason, timestamp, and responsible administrator. It does
not change Membership, Player participation, Team associations, administrator designation, or
Competition state. Suspension increments the authentication-session generation and removes older
sessions transactionally. Login and protected requests reject suspended Accounts before capability
evaluation. Unsuspension removes only the access block; it does not recreate a session or change
business state. The canonical Super Admin cannot be suspended.

Regardless of storage, access policy must be centralized and enforced by backend authorization.

Membership State Model

Active

An active User is a current member.

An active member:

* may access member capabilities;
* may be a Player or non-Player;
* may participate in sporting workflows when an eligible Player record exists.

Passive

A passive User is a current member.

A passive member:

* has no functional restriction compared with an active member;
* may access member capabilities;
* may be a Player or non-Player;
* may participate in sporting workflows when an eligible Player record exists.

The system does not calculate or manage passive membership fees.

Inactive

An inactive User is not a current member.

An inactive User must not retain an active Player of type member.

A former member without another active product identity normally loses access to member
capabilities and may have account access disabled.

An inactive User may remain an active external Player.

In that case:

* the Player type must be external;
* the account may remain enabled;
* Player-related capabilities may remain available;
* current-member-only capabilities must remain unavailable.

Player Type and Eligibility

Player type should support:

* member
* external

Player type describes the relationship between sporting identity and membership.

Player eligibility describes whether the Player may currently participate in sporting operations.

The implementation must support the following lifecycle outcomes:

* enable Player;
* deactivate Player;
* convert member Player to external Player;
* convert external Player to member Player.

A member Player requires an active or passive membership.

An inactive User must not retain an active Player of type member.

An inactive User may retain an active Player of type external.

User.isPlayer must not remain an independently writable source of truth.

It remains a derived compatibility field and must be updated atomically when Player identity is
established or physically cleaned up.

Supported lifecycle paths should modify Player identity through the centralized lifecycle capability rather than writing User.isPlayer directly.

Domain Relationships

The target relationships are:

* A User may have one current membership state.
* A User may have zero or one Player identity.
* A Player requires a linked User account.
* A Player may be of type member or external.
* A member Player requires active or passive membership.
* An external Player does not require current membership.
* Team membership is stored through Player.teamIds.
* A Player may have zero or more current Team associations; the product sets no fixed maximum.
* A Team roster is derived from Players currently associated with that Team.
* Availability, Lineup, and Match use Player identity rather than User identity.

A separate Membership entity is not required for the current scope.

This decision should be revisited only when the product requires:

* multiple membership periods;
* repeated termination and re-entry history;
* parallel memberships;
* a durable membership-history aggregate.

Lifecycle Ownership

Registration owns Membership Application intake, review, and approval orchestration.

Account Onboarding owns source-neutral canonical User establishment or compatible reuse, individual
invitation issuance, delivery outcome, expiry, completion, and safe reissue for an approved
applicant, an administrator-established Member with an optional Player, an External Player, or a
reviewed legacy import.

Authentication owns credentials, sign-in, and sessions.

Membership Lifecycle owns membership state and membership-driven Player transitions, including:

* membership-state transitions;
* Player enablement;
* Player deactivation;
* member-to-external conversion;
* external-to-member conversion;
* termination transition;
* batch lifecycle operations;
* lifecycle audit events.

All supported member-related lifecycle mutations should pass through this capability.

Controllers and individual services should not independently coordinate User, Player, account
access, and Team effects.

The lifecycle capability must prevent contradictory partial states.

Examples of invalid partial states include:

* User.isPlayer = true without a Player record;
* User.isPlayer = false with an active Player record;
* inactive membership with an active member Player;
* external Player with unrestricted member access;
* membership transition committed while required Player or account changes fail.

Access Rules

The required access rules are:

Membership state	Player state/type	Member capabilities	Player capabilities
active	no Player	allowed	not applicable
active	active member Player	allowed	allowed
passive	no Player	allowed	not applicable
passive	active member Player	allowed	allowed
inactive	no active Player	denied	denied
inactive	active external Player	denied	allowed
inactive	inactive external Player	denied	denied

Physical Player cleanup is permitted only for a person account after participation is disabled,
current Team associations are empty, and no current or future Match Lineup or Availability still
requires the Player identity. Historical Match references do not block cleanup and are not erased.
When the User remains, cleanup sets the derived `User.isPlayer` projection to false in the same
transaction.

Permanent User/account deletion is distinct from ending Membership or Player participation and
never applies to the fixed Super Admin. For a current Member, one account-deletion transaction
claims the User and Player identities, composes the authoritative Membership Lifecycle transition
to inactive, then removes the User and eligible account-owned data without retaining an
intermediate inactive account. Open Membership Termination creation claims the same User identity,
and new current or future Match Availability and Lineup dependencies claim the same Player
identity, so those dependency writers serialize with deletion without changing their domain
ownership. Login claims that same User identity while replacing and issuing its ordinary
Authentication session in one transaction: a committed session is therefore visible to a
subsequent deletion retry, while a committed deletion prevents session issuance. A live Player
state that Membership Lifecycle resolves is not a blocker; independently
active external Player state and current or future Match dependencies fail closed. An eligible
Player may be removed in the same transaction so no orphan Player remains, while historical
Competition references remain owned and readable through their existing snapshots and
missing-reference behavior.

Backend authorization must enforce these rules.

Frontend visibility must not be treated as sufficient protection.

Member List Rules

The default member list represents current members.

It should include:

* active
* passive

It should provide explicit filters for:

* inactive
* all

External Players must not appear in the default member list.

They belong to Player management or an explicit Player-oriented view.

Membership Application records awaiting review do not belong in the member list.

Player Identity Preservation

Player should be treated as a persistent sporting identity rather than as a disposable checkbox projection.

The preferred direction is to preserve Player identity when:

* Player participation is disabled;
* a Player becomes permanently ineligible for current sporting operations;
* a member Player becomes an external Player;
* an external Player later becomes a member Player.

The persistence representation may use deactivation or another lifecycle mechanism, but supported
lifecycle changes preserve the Player record and existing Match, Availability, and Lineup references
rather than physically deleting identity. Current Team associations may be cleared as a Membership
Lifecycle consequence or changed through Competition Team/Roster workflows; the first release does
not preserve Team-assignment history.

Team, Availability, Lineup, and Match Boundary

Membership management should not own detailed Match rules.

Team, Availability, Lineup, and Match should consume Player identity and Player eligibility.

Current sporting operations must exclude:

* inactive member Players;
* deactivated external Players;
* Players who are not eligible for the relevant Team or Match operation.

Current Team association is a Competition fact separate from Membership and Player eligibility. A
Player appears in a Team roster and becomes a candidate for that Team's Match only while currently
associated with that Team. A Player with no current Team association has no roster or Player-facing
Match workflow.

Removing a current Team association changes current roster, Match access, and candidate scope. It
must not erase existing Match, Availability, or Lineup references. Historical Lineup readability
uses the stable Player reference plus the Player name captured when the assignment is saved.
Gender, ranking, and a full Player snapshot are not retained for that purpose.

The exact Competition persistence and contract representation belongs to later Competition
architecture and implementation design; this Membership baseline does not prescribe it.

Audit Boundary

Structured audit records are required for lifecycle events, including:

* application approval;
* membership-state transition;
* Player enablement;
* Player deactivation;
* Player type conversion;
* termination approval;
* termination effective transition;
* batch lifecycle outcomes.

Lifecycle audit records should capture:

* actor;
* timestamp;
* action;
* previous state;
* new state;
* relevant reason.

Ordinary profile-field edits do not require compliance-grade audit history unless future requirements explicitly introduce that need.

Core Invariants

The system must preserve the following invariants:

1. active and passive represent current members.
2. inactive means the User is not a current member.
3. pending belongs to Membership Application, not membership state.
4. Active and passive members may independently be Players or non-Players.
5. An inactive User must not retain an active Player of type member.
6. An inactive User may retain an active Player of type external.
7. External Players require User accounts.
8. External Players may access approved Player capabilities but not current-member-only capabilities.
9. Membership state, account access, Player type, and Player eligibility are separate concerns.
10. An active Player record is the persisted representation of sporting identity.
11. Member-Player lifecycle transitions are owned by the membership lifecycle capability.
12. User.isPlayer must not remain an independently writable source of truth.
13. Team membership is authoritative through Player.teamIds.
14. A Player may have zero or more current Team associations, with no fixed product maximum.
15. Current roster, Match access, Availability, and Lineup candidate scope use current Team
    association and eligible Players.
16. Removing current Team association or eligibility must not erase existing Match, Availability,
    or Lineup references.
17. Membership and Player lifecycle mutations must not leave contradictory partial state.
18. Player lifecycle operations must not silently corrupt Match or Lineup data.
19. External Players do not appear in the default member list.
20. Membership management does not manage fees, billing, payments, SEPA collection, or accounting.
21. At most one canonical Super Admin exists, and it has no person, Membership, or Player facts.
22. Administrator designation is separate from account kind and is effective only for active or
    passive members.
23. Account suspension leaves Membership, Player, Team, Competition, and administrator designation
    unchanged while blocking authentication; becoming inactive clears administrator designation
    atomically.

Deferred Decisions

The following decisions remain outside this baseline:

* detailed guest or temporary external Player subtypes;
* full Membership entity extraction;
* multiple membership-period history;
* fee or payment administration.

These deferred decisions should be resolved only when they materially affect an approved implementation package.
