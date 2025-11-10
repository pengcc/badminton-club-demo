# Match Center - Matches Tabs Specification

**Version:** 1.0
**Last Updated:** 2025-11-02
**Status:** Draft
**Owner:** Match Center Team

**Note:** This spec covers 3 related tabs: Upcoming Matches, Match History, and Match Management (admin)

---

## ADDED Requirements

### Requirement: Upcoming Matches Display

**Priority**: High
**Effort**: 3 hours

The Upcoming Matches tab SHALL display all scheduled matches with date > today, grouped by team. Users MUST filter by team selection and view match details.

**Acceptance Criteria:**
- Only shows matches with status="scheduled" and future date
- Invalid dates filtered out (NaN check)
- Sorted by date ascending (nearest first)
- Team filters: All Matches, Team 1, Team 2
- Unified MatchCard component for consistent display

#### Scenario: User views upcoming matches

**Given** today is 2025-11-02
**And** 10 scheduled matches exist:
- 5 for Team 1 (dates: 11-05 to 11-20)
- 5 for Team 2 (dates: 11-03 to 11-25)
**When** user navigates to Upcoming tab
**And** "All Matches" filter selected
**Then** all 10 matches display
**And** sorted by date (11-03 first, 11-25 last)
**And** each match shows MatchCard with team, opponent, date

---

### Requirement: Team-Based Match Filtering

**Priority**: High
**Effort**: 1 hour

Users SHALL filter upcoming matches by team using checkboxes. The filter MUST support single-team, multi-team, or all-teams views.

**Acceptance Criteria:**
- 3 checkboxes: All Matches, Team 1, Team 2
- Selecting "All Matches" unchecks team filters
- Selecting team filter unchecks "All Matches"
- Multiple teams show union (Team 1 OR Team 2)
- Filter updates instantly (<100ms)

#### Scenario: User filters by Team 1 only

**Given** 10 upcoming matches (5 Team 1, 5 Team 2)
**And** "All Matches" initially checked
**When** user checks "Team 1" checkbox
**Then** "All Matches" unchecks automatically
**And** only 5 Team 1 matches display
**And** Team 2 matches hidden

#### Scenario: User filters by both teams

**Given** "All Matches" checked
**When** user checks both "Team 1" and "Team 2"
**Then** "All Matches" unchecks
**And** all 10 matches display (union)
**And** matches still grouped/labeled by team

---

### Requirement: Player Availability Toggle

**Priority**: High
**Effort**: 2 hours

Players SHALL indicate match availability via checkbox on MatchCard. The system MUST persist availability and notify team admins.

**Acceptance Criteria:**
- Availability checkbox visible to all users
- Checked = available, unchecked = unavailable
- Toggle calls MatchService.useTogglePlayerAvailability()
- Optimistic UI update (instant feedback)
- Rollback on API failure with error toast

#### Scenario: Player marks unavailable for match

**Given** user is Player A
**And** Match #123 shows Player A as available
**When** Player A unchecks availability
**Then** MatchService mutation called immediately
**And** checkbox disabled during API call
**And** on success: checkbox stays unchecked
**And** on failure: checkbox reverts + error displays

---

### Requirement: Match History Display

**Priority**: High
**Effort**: 2 hours

The Match History tab SHALL display completed and canceled matches with date <= today. Users MUST see final scores and match outcomes.

**Acceptance Criteria:**
- Shows matches with status="completed" OR "canceled"
- Includes past matches (date <= today)
- Sorted by date descending (most recent first)
- Displays final score if status="completed"
- "Canceled" badge if status="canceled"

#### Scenario: User views past matches

**Given** 20 historical matches:
- 15 completed with scores
- 5 canceled
**When** user navigates to History tab
**Then** all 20 matches display
**And** sorted newest to oldest
**And** completed matches show score (e.g., "25-20, 21-18")
**And** canceled matches show "Canceled" badge

---

### Requirement: Match Details Modal

**Priority**: Medium
**Effort**: 2 hours

Users SHALL view full match details via "View Details" button. Modal MUST display lineups, scores, notes, and timestamps.

**Acceptance Criteria:**
- Button on each MatchCard
- Modal shows:
  - Teams, date, location
  - Player lineups (both teams)
  - Match scores (if completed)
  - Admin notes
  - Created/Updated timestamps
- Close via X button or ESC key

#### Scenario: User views match details

**Given** Match #456 scheduled for 2025-11-10
**And** lineups finalized (6 players per team)
**When** user clicks "View Details"
**Then** modal opens with:
- Header: Team A vs Team B - 2025-11-10
- Section: Team A Lineup (6 player cards)
- Section: Team B Lineup (6 player cards)
- Section: Match Notes (admin comments)

---

### Requirement: Match Management Tab (Admin Only)

**Priority**: High
**Effort**: 4 hours

Admin users SHALL access Match Management tab for scheduling, editing, and deleting matches. Regular users MUST NOT see this tab.

**Acceptance Criteria:**
- Tab visible only to admin/super admin roles
- Shows all matches (upcoming + history)
- Actions per match:
  - Edit: opens EditMatchModal
  - Delete: shows confirmation, removes match
  - Manage Lineup: opens MatchLineupModal
- "Schedule Match" button creates new match

#### Scenario: Admin schedules new match

**Given** admin on Match Management tab
**When** admin clicks "Schedule Match"
**Then** ScheduleMatchModal opens
**And** form includes:
- Date picker (future dates only)
- Team selection (dropdown)
- Opponent name (text input)
- Location (text input)
**When** admin submits valid form
**Then** MatchService.createMatch() called
**And** new match appears in list
**And** modal closes

#### Scenario: Admin deletes match

**Given** Match #789 scheduled
**When** admin clicks Delete
**Then** confirmation dialog shows "Delete match Team A vs Team B?"
**When** admin confirms
**Then** MatchService.deleteMatch(789) called
**And** match removed from list
**And** success toast displays

---

### Requirement: Match Lineup Management

**Priority**: High
**Effort**: 3 hours

Admin users SHALL assign players to match lineups via dedicated modal. The system MUST validate lineup capacity and player availability.

**Acceptance Criteria:**
- Modal shows available players (filtered by team)
- Drag-and-drop or checkbox selection
- Lineup capacity: 6-12 players (configurable)
- Unavailable players shown but disabled
- Save persists lineup, sends notifications

#### Scenario: Admin assigns lineup for match

**Given** Match #101 between Team A vs Team B
**And** Team A has 15 players, 3 marked unavailable
**When** admin clicks "Manage Lineup"
**Then** modal shows 12 available Team A players
**And** unavailable players grayed out
**When** admin selects 8 players
**And** clicks Save
**Then** lineup saved to match.homeTeamLineup
**And** selected players notified via email/SMS
**And** modal closes

---

### Requirement: Match Status Transitions

**Priority**: Medium
**Effort**: 2 hours

The system SHALL track match status lifecycle: scheduled → in-progress → completed/canceled. Status transitions MUST follow business rules.

**Acceptance Criteria:**
- Statuses: scheduled, in-progress, completed, canceled
- Transitions:
  - scheduled → in-progress (manual, match day)
  - in-progress → completed (score entered)
  - scheduled → canceled (admin action)
- Cannot complete without score
- Cannot edit completed matches (archive)

#### Scenario: Admin completes match with score

**Given** Match #202 status="in-progress"
**And** match date was yesterday
**When** admin enters final score "25-22, 21-19"
**And** clicks "Complete Match"
**Then** status updates to "completed"
**And** match moves to History tab
**And** score displayed on MatchCard

---

## Technical Notes

### Component Hierarchy
```
MatchCenter
├── UpcomingMatchesTab
│   ├── FilterCheckboxes (All, Team1, Team2)
│   └── MatchCard[]
│       ├── TeamInfo
│       ├── DateDisplay
│       ├── AvailabilityCheckbox
│       └── ViewDetailsButton
├── MatchHistoryTab
│   ├── YearFilter (optional)
│   └── MatchCard[]
│       ├── ScoreDisplay (if completed)
│       ├── CanceledBadge (if canceled)
│       └── ViewDetailsButton
└── MatchManagementTab (admin only)
    ├── ScheduleMatchButton
    └── MatchCard[]
        ├── EditButton
        ├── DeleteButton
        └── ManageLineupButton
```

### Data Flow
```
MatchCenter
  ↓ MatchService.useMatchList()
matches[] (all statuses)
  ↓ props to tabs
UpcomingMatchesTab filters upcoming
MatchHistoryTab filters past
MatchManagementTab shows all
  ↓ user actions
Mutations: toggleAvailability, deleteMatch, updateMatch
  ↓ refetch
MatchCenter.refetchMatches()
  ↓ tabs re-render
```

### Types Used
```typescript
interface Match {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  date: string; // ISO date
  location?: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'canceled';
  score?: string; // e.g., "25-20, 21-18"
  homeTeamLineup?: string[]; // player IDs
  awayTeamLineup?: string[];
  notes?: string;
}
```

### Service Hooks
- `MatchService.useMatchList()` - all matches
- `MatchService.useCreateMatch()` - schedule new
- `MatchService.useUpdateMatch()` - edit existing
- `MatchService.useDeleteMatch()` - remove match
- `MatchService.useTogglePlayerAvailability()` - availability
- `MatchService.useSyncMatchPlayers()` - lineup sync

---

## Known Issues

1. **Date Validation Inconsistent**
   ```typescript
   const matchDate = new Date(match.date);
   return matchDate > new Date() && !isNaN(matchDate.getTime());
   ```
   **Issue:** Relies on client timezone, may cause off-by-one errors
   **Impact:** Match might show in wrong tab near midnight
   **Resolution:** Use UTC comparison or server-side filtering

2. **Team Hardcoded to "Team 1" and "Team 2"**
   ```typescript
   const isTeam1Match = match.homeTeamName === 'Team 1';
   ```
   **Issue:** Assumes specific team names, breaks with renamed teams
   **Impact:** Filters fail if teams renamed
   **Resolution:** Use team IDs instead of names

3. **No Pagination** - All matches loaded at once
   **Impact:** Performance issues with 500+ matches
   **Workaround:** Year filter reduces visible matches
   **Resolution:** Implement virtual scrolling or pagination

4. **Availability Not Linked to Lineup** - Player can mark unavailable but still in lineup
   **Impact:** Confusing state, admins may assign unavailable players
   **Resolution:** Add validation: unavailable players auto-removed from lineup

---

## Future Enhancements

1. **Real-time Score Updates** - WebSocket for live scoring during matches
2. **Match Reminders** - Notifications 24h before match
3. **Weather Integration** - Show forecast for outdoor matches
4. **Match Stats** - Points won/lost, player performance metrics
5. **Recurring Matches** - Template for weekly/monthly matches
6. **Match Chat** - Team discussion per match

---

## Open Questions

- **Q:** Should past matches be editable (score corrections)?
- **Q:** Maximum match history retention (1 year? 5 years? forever?)
- **Q:** Should canceled matches count in team statistics?
- **Q:** Lineup capacity configurable per match or global setting?
- **Q:** Notification preferences per player (email/SMS/push)?
