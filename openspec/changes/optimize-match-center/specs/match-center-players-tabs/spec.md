# Match Center - Players Tab Specification

**Version:** 1.0
**Last Updated:** 2025-11-02
**Status:** Draft
**Owner:** Match Center Team

---

## ADDED Requirements

### Requirement: Player Search and Filtering

**Priority**: High
**Effort**: 2 hours

The Players Tab SHALL provide real-time search and team-based filtering of the player roster. Users MUST be able to filter by player name (case-insensitive) and team membership simultaneously.

**Acceptance Criteria:**
- Search input filters players by userName (substring match)
- Team dropdown shows "All Teams" + all available teams
- Filters combine with AND logic (both must match)
- Filtered list updates instantly (<100ms)
- Zero results shows "No players found" message

#### Scenario: Admin searches for player in specific team

**Given** user is admin viewing Players tab
**And** roster contains 50+ players across 5 teams
**When** user types "john" in search input
**And** selects "Team 1" from dropdown
**Then** only players matching "john" AND in "Team 1" display
**And** player count badge shows filtered count

---

### Requirement: Player Team Assignment Editing

**Priority**: High
**Effort**: 3 hours

Admin users SHALL edit player team assignments via modal dialog. The system MUST support multi-team membership per player and validate team capacity constraints.

**Acceptance Criteria:**
- Edit button visible only to admins
- Modal displays current team assignments (checkboxes)
- Player can belong to 0-N teams
- Save persists changes via PlayerService
- UI refreshes automatically after save
- Error handling for service failures

#### Scenario: Admin assigns player to multiple teams

**Given** admin clicks Edit on player "Alice"
**And** Alice currently in "Team 1"
**When** admin checks "Team 2" and "Team 3"
**And** clicks Save
**Then** PlayerService.updatePlayer called with new teamIds
**And** modal closes
**And** Alice's row shows "Team 1, Team 2, Team 3" badges
**And** team filter includes Alice in all 3 teams

---

### Requirement: Player Display with Team Badges

**Priority**: Medium
**Effort**: 1 hour

The player list SHALL display each player's name and team memberships as colored badges. Users MUST distinguish between single and multi-team players at a glance.

**Acceptance Criteria:**
- Table shows Player Name | Teams | Actions columns
- Teams rendered as Badge components
- Multiple teams separated visually
- Players with no teams show "No teams" in muted text
- Responsive layout (mobile: stack columns)

#### Scenario: User views players with varied team assignments

**Given** roster contains:
- Player A: Team 1, Team 2
- Player B: No teams
- Player C: Team 3
**When** user views Players tab
**Then** Player A shows 2 badges side-by-side
**And** Player B shows "No teams" in gray
**And** Player C shows 1 badge
**And** badges use consistent team colors

---

### Requirement: Admin-Only Edit Permissions

**Priority**: High
**Effort**: 30 minutes

Edit functionality SHALL be restricted to users with admin or super admin roles. Non-admin users MUST view player list in read-only mode.

**Acceptance Criteria:**
- Edit button hidden for non-admin users
- API validates admin role server-side
- Attempting direct API call as non-admin returns 403
- No client-side workarounds (button always hidden)

#### Scenario: Regular user views Players tab

**Given** user role is "member"
**When** user navigates to Players tab
**Then** Edit buttons are not rendered
**And** hovering over player rows shows no action icons
**And** no edit modal can be opened

---

## Technical Notes

### Component Hierarchy
```
PlayersTab
├── Card (Players List)
│   ├── SearchInput (with Search icon)
│   ├── TeamFilterDropdown (Select)
│   └── Table
│       └── PlayerRow[]
│           ├── PlayerName
│           ├── TeamBadges[]
│           └── EditButton (admin only)
└── EditPlayerTeamsModal
    ├── TeamCheckboxes[]
    ├── SaveButton
    └── CancelButton
```

### Data Flow
```
MatchCenter (parent)
  ↓ props: players[], teams[], callbacks
PlayersTab
  ↓ user interaction
EditPlayerTeamsModal
  ↓ mutation
PlayerService.updatePlayer()
  ↓ refetch
MatchCenter.refetchPlayers()
  ↓ props update
PlayersTab re-renders
```

### Types Used
```typescript
interface Player {
  id: string;
  userName: string;
  teamIds?: string[];
  // ... other fields
}

interface Team {
  id: string;
  name: string;
}
```

### Service Hooks
- `PlayerService.usePlayerList()` - fetched in parent
- `PlayerService.useUpdatePlayer()` - mutation in modal

---

## Future Enhancements

1. **Bulk Team Assignment** - Select multiple players, assign to team in one action
2. **Player Import/Export** - CSV upload for roster management
3. **Activity Status** - Show last active date, availability for matches
4. **Performance Stats** - Win rate, match participation per player
5. **Custom Fields** - Phone, email, emergency contact (configurable)

---

## Open Issues

- **Q:** Should team filter support multi-select (AND vs OR logic)?
- **Q:** Max teams per player? Currently unlimited
- **Q:** Delete player functionality - where should it live? (Currently not in Players tab)
