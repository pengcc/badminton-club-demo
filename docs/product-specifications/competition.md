# Competition

## Purpose

This specification defines the confirmed first-release product behaviour for club Competition
workflows. It owns user-visible Match, Team-roster, Availability, Lineup, ranking, result, and
Match-history behaviour without prescribing persistence or implementation architecture.

The [Capability Overview](../capability-overview.md) describes how Competition relates to other
capabilities. The [Membership Domain Architecture](../architecture/membership-domain-model.md)
owns membership-driven Player eligibility and lifecycle rules.

## Product Boundary

Competition owns:

- the current sporting relationship between Players and Teams;
- Match creation, maintenance, access, deletion, and History;
- Match-scoped Availability and Lineup behaviour;
- Player ranking as an internal lineup-planning aid;
- Match result entry and correction;
- schedule import behaviour and duplicate handling; and
- required user-visible warnings and administrative traceability for Competition work.

Competition consumes an authoritative Player identity and eligibility result. It does not interpret
membership statuses or own membership-driven Player transitions. Account establishment and setup
belong to [Account Onboarding](account-onboarding.md).

## Players and Teams

A Player may belong to zero or more Teams. Administrators maintain these current Team associations.

A Player appears in a Team roster and becomes a candidate for that Team's Match Availability and
Lineup only while currently associated with that Team. A Player without a Team association does not
appear in a Team roster or that Team's Match workflows.

The first release does not preserve Team-assignment history or effective dates. Removing a Player
from a Team changes the current roster, Match access, and candidate scope, but must not erase
existing Match, Availability, or Lineup references.

An External Player uses the same ordinary Player model and Competition rules as a member Player.
An External Player has a User account but does not require Membership.

Account suspension is not a Competition eligibility input. It blocks authentication without
changing Player participation, Team association, Match, Availability, or Lineup state.

## Match Behaviour

A Match records the club Team, opponent, home/away direction, date and time, location, an optional
short arrival-guidance note, and an optional result. An administrator may maintain practical
entrance, parking, access, or on-site wayfinding guidance for the concrete Match. The note is
single-language, stored as entered, and visible to anyone already entitled to view the Match. Its
internal identity remains stable when an administrator edits these facts.

Editing a Match does not create a replacement Match and does not automatically reset Availability
or clear or invalidate Lineup entries. The first release has no cancelled, rescheduled, replacement,
archived, or soft-delete workflow.

An administrator may create, edit, and directly delete a Match. Deletion requires a clear
confirmation and removes the Match together with its Availability, Lineup, and result.

## Match Time and History

Match input and display use `Europe/Berlin`. The backend derives one canonical Match start instant
from the local date and time and handles daylight-saving-time boundaries consistently.

That start instant determines:

- whether a Match is upcoming or past;
- when a Player may update Availability;
- Match History presentation; and
- other time-dependent Competition behaviour.

History is a query and presentation of past Matches, not a separate Match status. A past Match
continues to show its base information, Lineup, and result. Availability is not required as the
primary historical view.

The exact canonical-time representation, conversion contract, persistence model, indexes, and
contract-cleanup sequence belong to future Competition architecture and implementation design.

## Access and Administration

Administrators may view every Match and may maintain Match facts, Team rosters, rankings,
Availability, Lineups, and results. They retain correction and deletion access after a Match starts.

A Player may view Matches for every Team to which that Player is currently assigned. A Player
without a current Team association has no Player Match scope. External Players follow the same
access rule.

A Player may update only their own Availability and only before the Match start instant. After the
start, the Player retains read access but cannot change Availability.

The first release does not introduce Captain, vice-captain, or another Competition-management role.
Administrative interfaces should follow the [Task-Oriented Administration](../product-principles/task-oriented-administration.md)
principle.

## Match Preparation

Match Detail is the shared preparation centre for Match facts, Availability, Lineup, and the
actions allowed to the current user. Availability does not require a separate page.

When present, Match-owned arrival guidance appears with the location in Match Detail. It does not
create a shared opponent-venue registry, link Competition venues to the club-play Location owner,
or add translation management, maps, geocoding, navigation, or route planning. Repeated Matches at
the same venue may retain independent notes.

### Availability

Availability has one participation state: `Available` or `Unavailable`. A current eligible Player
without an explicit entry defaults to Available; choosing Available explicitly has the same meaning.
Available Players may be considered for Lineup selection; Unavailable Players may not be newly assigned.

Players may change only their own Availability before the Match start, within their current-Team
Match access. Administrators may correct current eligible Players or retained explicit entries
before or after Match start. Both use one direct binary action with clear current-state and failure
feedback, without a separate Save step.

Availability appears before Lineup in Match Details. A current Player sees their own Availability
and direct action first; other candidates are collapsed by default and can be revealed as read-only
statuses. Administrators see current-candidate totals, Available/Unavailable counts, and a compact
read-only roster by default. Corrections are exposed through an explicit edit mode and save
immediately; retained entries remain separately identified and excluded from current-candidate counts.
An administrator who is also a current Player sees their own self-service first, followed by the
administrator overview. Separate administrator corrections, including their own post-start correction,
remain available only in explicit edit mode.

A truthful Availability change must not be rejected merely because it makes an existing Lineup
assignment invalid, and it must not automatically delete that assignment. Retained participation
and Match/Lineup references remain readable; obsolete persisted reply fields have no product meaning
and require no bulk cleanup.

### Lineup

The Lineup is a pre-Match planning aid. It does not represent actual participation or the final
official BVBB record.

Players who may view the Match and administrators can view its Lineup. Only administrators edit it. A Lineup may
be empty or partial, is visible after it is saved, and does not have draft/publish states.

Each saved assignment retains its position, Player identity, and the Player name captured when the
assignment is saved. Later name, Team, Membership, or eligibility changes do not make historical
Lineups unreadable. Ranking and full Player snapshots are not retained for History.

Later physical Player cleanup does not rewrite retained historical Matches. Lineup continues to use
its captured Player name. A historical Availability or other retained reference without an owned
name snapshot degrades only that identity to `Player unavailable`; it must not make the surrounding
Match or history view unusable. New writes still require an authoritative current Player and fail
closed when it is absent or ineligible.

If an existing assignment becomes invalid, the system keeps it and shows the reason. The
administrator may remove or replace it and may continue editing other valid assignments. The system
must reject newly added or moved assignments that violate current rules.

## Positions and Lineup Rules

The first release supports the current eight-position BVBB O19 BBMM format:

1. Men's Singles 1 — male Player;
2. Men's Singles 2 — male Player;
3. Open Singles — any gender;
4. Women's Singles — female Player;
5. Men's Doubles — two male Players;
6. Open Doubles — any gender combination;
7. Women's Doubles — two female Players; and
8. Mixed Doubles — one male and one female Player.

The product requires the following internal planning rules to be enforced:

- a Player may enter at most two events in one Match;
- a Player may not enter two singles events;
- a Player may combine one singles event with one doubles or mixed event;
- one position cannot contain duplicate assignments;
- no more than 12 distinct Players may be used; and
- a new or moved assignment must satisfy current Team, Player eligibility, Availability, and gender
  requirements.

These rules assist administrators. They do not replace official BVBB eligibility judgments.
Administrators remain responsible for eligibility rules that the first release does not automate.

## Ranking

Each Player has separate Singles and Doubles rankings maintained by an administrator. Singles
candidates are ordered and displayed by Singles ranking. Doubles and Mixed Doubles candidates use
Doubles ranking, and a pair's Doubles-ranking total is shown.

Competition trusts the saved values. It does not validate official BVBB rankings, ranking order,
Additionsregel, Festspielen, or other cross-Team eligibility rules.

## Match Result

The first release stores the overall home score, away score, and an optional note. Win, loss, or
draw is derived from the scores rather than stored as a separate result state.

Administrators may enter or correct a result after the Match. A past Match without a result remains
valid and visible. The first release does not store individual-event scores, game scores, or actual
participation and does not import or synchronize results from BVBB.

## Schedule Import

Schedule import creates only Matches that do not already exist. It never updates, overwrites, or
deletes an existing Match or result and does not infer cancellation, rescheduling, or replacement.

A duplicate is determined from the normalized combination of club Team, opponent, home/away
direction, Match date and time, and location. The system does not use fuzzy matching.

Import continues past individual invalid rows and reports input, created, duplicate, and failed
counts with useful duplicate and failure details. An all-duplicate import succeeds without creating
a Match. A separate preview-and-confirm stage is not required; the administrator reviews the import
result. The first release accepts an administrator-uploaded UTF-8 CSV prepared outside the
application with exactly these columns, spelling, and order: `Datum`, `Zeit`, `Sporthalle`,
`Hallenadresse`, `Heimmannschaft`, `Gastmannschaft`.

## Traceability

The first release requires the responsible actor and time to be traceable for Match creation,
Match correction, Match deletion, result entry, and result correction. It does not require complete
change history for Availability, Lineup, ranking, or Team-roster changes.

## Non-Goals

The first release does not introduce:

- a Season domain model or season-specific rosters, rankings, or rule configuration;
- cancellation, rescheduling, Match replacement, archive, or soft-delete workflows;
- a configurable Competition rule engine or multiple competition formats;
- automatic official BVBB ranking or eligibility validation;
- a separate Competition-only Player sporting-state model;
- shared opponent-venue records, Location linkage, maps, geocoding, navigation, or route planning;
- Lineup publish, override, invalidation-history, or automatic-clear workflows;
- full Player, ranking, or Team-roster historical snapshots;
- individual-event results, actual participation, or BVBB result synchronization; or
- complete event sourcing or a broad audit platform.

## Documentation Boundary

This document is product intent. It must not be used to claim that the current repository already
implements every behaviour above. Current implementation is established through Project Memory and
repository evidence; persistence and contract ownership belong to later Competition architecture.
