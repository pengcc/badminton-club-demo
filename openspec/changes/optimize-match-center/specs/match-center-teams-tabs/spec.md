# Match Center - Teams Tab Specification

**Version:** 1.0
**Last Updated:** 2025-11-02
**Status:** Draft
**Owner:** Match Center Team

---

## ADDED Requirements

### Requirement: Team Roster Display

**Priority**: High
**Effort**: 2 hours

The Teams Tab SHALL display all teams in a grid layout with player statistics. Each team card MUST show total player count and provide quick access to team management actions.

**Acceptance Criteria:**
- Grid layout: 3 columns desktop, 2 tablet, 1 mobile
- Each card shows team name + total players badge
- Cards sorted by team name (alphabetical)
- Responsive grid with proper spacing
- Loading skeleton during data fetch

#### Scenario: User views teams overview

**Given** system has 5 teams:
- Team A: 12 players
- Team B: 8 players
- Team C: 0 players
**When** user navigates to Teams tab
**Then** 3 team cards display in grid
**And** Team A badge shows "12"
**And** Team C badge shows "0"
**And** cards maintain aspect ratio on mobile

---

### Requirement: Team Creation (Admin Only)

**Priority**: High
**Effort**: 3 hours

Admin users SHALL create new teams via "Create Team" button. The system MUST validate team name uniqueness and enforce naming conventions.

**Acceptance Criteria:**
- "Create Team" button visible only to admins
- Button positioned in card header (top-right)
- Click opens CreateTeamModal
- Name required, 3-50 characters
- Duplicate names rejected with clear error
- Success closes modal, refetches team list

#### Scenario: Admin creates new team

**Given** admin on Teams tab
**And** no team named "Team Elite" exists
**When** admin clicks "Create Team"
**And** enters "Team Elite"
**And** clicks Save
**Then** TeamService.createTeam() called
**And** success toast displays
**And** "Team Elite" appears in grid with 0 players
**And** modal closes

#### Scenario: Admin attempts duplicate team name

**Given** team "Team Pros" already exists
**When** admin tries creating "Team Pros"
**And** clicks Save
**Then** API returns 409 Conflict
**And** error displays "Team name already exists"
**And** modal stays open with form data preserved

---

### Requirement: Team Deletion (Admin Only)

**Priority**: High
**Effort**: 2 hours

Admin users SHALL delete teams via trash icon on team card. The system MUST confirm deletion and handle players assigned to deleted team.

**Acceptance Criteria:**
- Trash icon visible only to admins
- Click shows confirmation dialog
- Confirmation explains player reassignment (all players unassigned)
- Delete calls TeamService.deleteTeam()
- Success removes card, refetches data
- Cannot delete team if used in active matches (validation)

#### Scenario: Admin deletes empty team

**Given** "Team Beta" has 0 players
**And** no matches reference "Team Beta"
**When** admin clicks trash icon
**And** confirms deletion
**Then** TeamService.deleteTeam() called
**And** "Team Beta" card disappears
**And** grid re-layouts remaining cards

#### Scenario: Admin tries deleting team with active matches

**Given** "Team Alpha" has 3 active matches
**When** admin clicks trash icon
**And** confirms deletion
**Then** API returns 400 Bad Request
**And** error displays "Cannot delete team with active matches"
**And** team card remains

---

### Requirement: Player Count Statistics

**Priority**: Medium
**Effort**: 1 hour

Each team card SHALL display total player count as a badge. The system MUST calculate counts dynamically from current roster.

**Acceptance Criteria:**
- Badge shows numeric count
- Count derived from `players.filter(p => p.teamIds.includes(teamId))`
- Updates immediately when player teams change
- Zero count displays as "0" (not hidden)

#### Scenario: Player team assignment updates count

**Given** Team X has 5 players
**And** user assigns Player Y to Team X
**When** assignment saves successfully
**Then** Team X badge updates to "6"
**And** no page refresh required
**And** update appears within 500ms

---

### Requirement: Team Edit Actions (Placeholder)

**Priority**: Low
**Effort**: 30 minutes

Admin users SHALL see Edit button on team cards. Current implementation MUST display button but clicking shows placeholder alert.

**Acceptance Criteria:**
- Edit icon (pencil) visible to admins
- Click shows alert: "Team editing coming soon"
- No modal opens
- No API calls made
- Button styling consistent with other actions

#### Scenario: Admin clicks Edit (placeholder)

**Given** admin on Teams tab
**When** admin clicks Edit on any team
**Then** alert displays "Team editing coming soon"
**And** no network requests occur
**And** UI remains unchanged after closing alert

---

## Technical Notes

### Component Hierarchy
```
TeamManagementTab
├── Card (Teams Header)
│   ├── Title: "Team Management"
│   └── CreateTeamButton (admin only)
└── Grid
    └── TeamCard[]
        ├── Header
        │   ├── TeamName
        │   └── Actions (Edit, Delete - admin only)
        └── Content
            └── PlayerCountBadge
```

### Data Flow
```
MatchCenter (parent)
  ↓ props: teams[], players[]
TeamManagementTab
  ↓ stats calculation
getTeamStats(teamId) → { total, male, female }
  ↓ render
TeamCard[]
  ↓ admin actions
CreateTeamModal / DeleteConfirmation
  ↓ mutation
TeamService.createTeam() / deleteTeam()
  ↓ refetch
MatchCenter.refetchTeams()
```

### Types Used
```typescript
interface Team {
  id: string;
  name: string;
}

interface Player {
  id: string;
  userName: string;
  teamIds?: string[];
}

interface TeamStats {
  total: number;
  male: number; // Currently unused (gender removed)
  female: number; // Currently unused
}
```

### Service Hooks
- `TeamService.useTeamList()` - fetched in parent
- `TeamService.useCreateTeam()` - modal mutation
- `TeamService.useDeleteTeam()` - delete action

---

## Known Issues

1. **Gender Stats Removed** - TeamManagementTab comments:
   ```typescript
   // Note: Gender stats removed as PlayerResponse doesn't include gender
   // Would need to fetch User data separately for gender information
   ```
   **Impact:** male/female counts always 0
   **Workaround:** None (feature disabled)
   **Resolution:** TBD (depends on privacy policy decision)

2. **Edit Team Placeholder** - Edit button exists but not functional
   **Impact:** Admins cannot rename teams or change team properties
   **Workaround:** Delete and recreate team
   **Resolution:** Phase 4 enhancement

3. **No Team Capacity Limits** - Unlimited players per team
   **Impact:** Performance issues with 100+ player teams?
   **Workaround:** Manual monitoring
   **Resolution:** Add validation if needed

---

## Future Enhancements

1. **Team Edit Modal** - Rename team, set description, upload logo
2. **Team Hierarchy** - Sub-teams, divisions, skill levels
3. **Team Colors** - Custom badge colors per team
4. **Team Capacity** - Max players per team (configurable)
5. **Team Archives** - Soft delete + restore instead of permanent deletion
6. **Gender/Age Stats** - Restore if User model includes demographics

---

## Open Questions

- **Q:** Should team deletion be soft (archive) or hard (permanent)?
- **Q:** Team properties beyond name? (description, logo, color?)
- **Q:** Default team assignment for new players?
- **Q:** Team ownership/captain role - should this be tracked?
