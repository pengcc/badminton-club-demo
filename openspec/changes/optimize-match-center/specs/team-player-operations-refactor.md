# Team-Player Operations Refactor

**Status**: Implementation
**Date**: 2025-11-03
**Related**: optimize-match-center Phase 1

## Problem

Currently, `addPlayerToTeam` and `removePlayerFromTeam` operations are located in `TeamService`. This creates architectural confusion:

1. **Responsibility Mismatch**: TeamTab UI should not update player properties directly
2. **Update Direction**: These operations primarily update Player entities (Player.teamIds) and only secondarily update Team entities (Team.playerIds)
3. **Data Flow Clarity**: Players belong to multiple teams, so the relationship is managed from the Player side

## Solution

### Architectural Decision

**Move team-player relationship management operations from TeamService to PlayerService.**

**Rationale**:
- Player is the primary entity being modified (Player.teamIds array)
- Team.playerIds can be computed/derived from Player.teamIds relationships
- PlayersTab manages player operations, should call PlayerService
- TeamsTab can still read team-player relationships via queries
- Follows Single Responsibility Principle: PlayerService manages player state

### API Changes

#### Before (TeamService)
```typescript
// TeamService
static async addPlayerToTeam(teamId: string, playerId: string): Promise<Domain.Team>
static async removePlayerFromTeam(teamId: string, playerId: string): Promise<Domain.Team>
```

#### After (PlayerService)
```typescript
// PlayerService
static async addPlayerToTeam(playerId: string, teamId: string): Promise<Domain.Player>
static async removePlayerFromTeam(playerId: string, teamId: string): Promise<Domain.Player>
```

**Note**: Parameter order reversed to reflect player-centric approach.

### Implementation Details

1. **Move Methods**: Copy implementation from TeamService to PlayerService
2. **Update Controllers**: Keep existing routes but delegate to PlayerService
3. **Bidirectional Updates**: Continue updating both Player.teamIds and Team.playerIds
4. **Return Type**: Changed from `Domain.Team` to `Domain.Player` (reflects primary entity)
5. **Tests**: Update unit tests to reflect new service location

### Files Modified

- `apps/api/src/services/playerService.ts` - Add methods
- `apps/api/src/services/teamService.ts` - Remove methods (keep deprecated stubs)
- `apps/api/src/controllers/teamController.ts` - Update to call PlayerService
- `apps/api/src/__tests__/services/playerService.test.ts` - Add tests
- `apps/api/src/__tests__/services/teamService.test.ts` - Update/remove tests

### Migration Path

1. Add methods to PlayerService
2. Update TeamController to delegate to PlayerService
3. Mark TeamService methods as deprecated
4. Update unit tests
5. Future: Remove deprecated TeamService methods after confirming no direct usage

## Benefits

1. **Clearer Responsibility**: PlayerService owns player state
2. **Better Data Flow**: Player-centric operations in player service
3. **Consistency**: Matches batch update operations already in PlayerService
4. **Maintainability**: Single source of truth for player-team relationships

## Risks

- **Breaking Change**: If external code directly calls TeamService methods
- **Mitigation**: Keep deprecated stubs that delegate to PlayerService
- **Test Coverage**: Comprehensive tests ensure bidirectional updates work correctly
