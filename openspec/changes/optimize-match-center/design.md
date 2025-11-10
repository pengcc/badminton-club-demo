# Design: Optimize Match Center Architecture & Features

**Change ID**: `optimize-match-center`
**Created**: 2025-11-02
**Status**: In Progress - Phase 0 (MatchCenter.tsx Parent Component)

---

## Overview

Match Center (MatchCenter.tsx) is a 472-line parent component managing 5 lazy-loaded tabs via React Suspense. Current architecture works but has debt: props drilling, manual refetching, inline error handling, hardcoded team names, client-side date logic causing timezone bugs.

**Implementation Strategy**: Optimize parent component first (Phase 0), then incremental tab-by-tab optimization. Each phase goes through complete cycle:
1. **Manual Testing** → Document current behavior, identify bugs
2. **Bug Fixes** → Fix critical issues found during testing
3. **Feature Expansion** → Identify and implement improvements
4. **Documentation** → Update design.md, proposal.md, tasks.md, specs/, ARCHITECTURE.md
5. **Code Updates** → Implement fixes and features
6. **Move to Next Phase** → Repeat cycle

**Phase Sequence**:
0. **MatchCenter.tsx (Parent)** - 472 lines - **START HERE** (Fix architecture foundation)
1. PlayersTab (175 lines)
2. UpcomingMatchesTab (188 lines)
3. MatchHistoryTab (~200 lines)
4. MatchManagementTab (admin only)
5. TeamManagementTab (139 lines) - **END HERE**

---

## Current Architecture

### Component Hierarchy

```
MatchCenter (parent, 472 lines)
├─ State: activeTab, filters, modal flags, selectedMatch
├─ Data: useTeamList(), usePlayerList(), useMatchList()
├─ Mutations: deleteMatch, toggleAvailability, syncPlayers
├─ Lazy Tabs (Suspense)
│  ├─ PlayersTab (175 lines) - props: players, teams, callbacks
│  ├─ UpcomingMatchesTab (188 lines) - props: matches, user
│  ├─ MatchHistoryTab (~200 lines) - props: matches, yearFilter
│  ├─ MatchManagementTab - props: matches, onCRUD
│  └─ TeamManagementTab (139 lines) - props: teams, players
└─ Modals: Schedule, Edit, Lineup, Details (4 modals)
```

### Data Flow

**Fetch Pattern**:
```typescript
// Parent fetches all data upfront
const { data: teams } = TeamService.useTeamList();
const { data: players } = PlayerService.usePlayerList();
const { data: matches, refetch } = MatchService.useMatchList();

// Props drilled to tabs
<PlayersTab players={players} teams={teams} />
<UpcomingMatchesTab matches={matches} />
```

**Mutation Pattern**:
```typescript
// Mutations in parent, manual refetch
await deleteMatchMutation.mutateAsync(matchId);
// Then:
await refetchMatches(); // Fetches ALL matches again
```

**Issue**: Tight coupling. Tabs can't optimize queries. Refetch entire dataset after single mutation.

---

## Identified Issues

### 1. Props Drilling
**Location**: MatchCenter.tsx lines 279-355
**Problem**: Parent fetches, passes down. Tabs can't control loading states.

**Example**:
```typescript
<PlayersTab
  players={players}          // ~50 players
  teams={teams}              // All teams
  searchTerm={searchTerm}    // State in parent
  onSearchChange={setSearchTerm}  // Callback chain
/>
```

**Impact**: Tight coupling, can't lazy-load tab data.

### 2. Hardcoded Team Names
**Location**: UpcomingMatchesTab filtering
**Code**:
```typescript
const isTeam1Match = match.homeTeamName === 'Team 1';
const isTeam2Match = match.homeTeamName === 'Team 2';
```

**Problem**: Breaks if teams renamed. Should use team.id.

### 3. Client-Side Date Comparison
**Location**: UpcomingMatchesTab line 32
**Code**:
```typescript
const matchDate = new Date(match.date);
return matchDate > new Date() && !isNaN(matchDate.getTime());
```

**Problem**: Timezone-dependent. Match at midnight may show wrong tab.

### 4. No Pagination
**Impact**: Loading 500+ matches at once. Performance degrades.

### 5. Error Handling
**Current**:
```typescript
const PlayersTab = lazy(() =>
  import('./matchTabs/PlayersTab').catch(err => {
    console.error('Error loading PlayersTab:', err);
    return { default: () => <div>Error loading tab</div> };
  })
);
```

**Problem**: Inline error fallback. No retry, no Error Boundary.

### 6. Type Mixing
**Found**: Imports from `@app/lib/types` (User, Player, Team, Match)
**Expected**: Should use View layer types from `@club/shared-types/view/`

---

## Proposed Solutions

### AD-1: Colocate Data Fetching

**Decision**: Move service hooks into tabs.

**Before**:
```typescript
// Parent
const { data: players } = PlayerService.usePlayerList();
<PlayersTab players={players} />
```

**After**:
```typescript
// PlayersTab.tsx
export default function PlayersTab() {
  const { data: players } = PlayerService.usePlayerList();
  // Tab controls its data
}
```

**Benefits**:
- Tab loads data only when active
- React Query cache deduplicates requests
- No props drilling

**Tradeoff**: Shared data (teams) fetched multiple times, but RQ caches.

---

### AD-2: Fix Hardcoded Names with Team IDs

**Decision**: Use team.id for filtering, not homeTeamName.

**Before**:
```typescript
const isTeam1Match = match.homeTeamName === 'Team 1';
```

**After**:
```typescript
const { data: teams } = TeamService.useTeamList();
const team1 = teams.find(t => t.name === 'Team 1');
const isTeam1Match = match.homeTeamId === team1?.id;
```

**Better**: Store teamId in filter state, not name.

---

### AD-3: Server-Side Date Filtering

**Decision**: Add date filter to API endpoint.

**API Change**:
```typescript
GET /api/matches?status=scheduled&dateAfter=2025-11-02T00:00:00Z
```

**Frontend**:
```typescript
const { data: upcomingMatches } = MatchService.useMatchList({
  status: 'scheduled',
  dateAfter: new Date().toISOString()
});
```

**Benefits**: UTC comparison, consistent across timezones.

**Tradeoff**: Requires backend changes (Phase 2).

---

### AD-4: Add Pagination or Virtual Scrolling

**Option A**: Pagination (10-20 per page)
**Option B**: Virtual scrolling (react-window)

**Decision**: Start with pagination (simpler).

**Implementation**:
```typescript
const [page, setPage] = useState(1);
const { data: matches } = MatchService.useMatchList({ page, limit: 20 });
```

**Tradeoff**: Pagination requires backend support. Virtual scrolling client-only but complex.

---

### AD-5: Error Boundaries for Tabs

**Decision**: Wrap Suspense in ErrorBoundary.

**Implementation**:
```typescript
<ErrorBoundary fallback={<TabErrorFallback />}>
  <Suspense fallback={<TabLoader />}>
    <PlayersTab />
  </Suspense>
</ErrorBoundary>
```

**Benefits**: Graceful degradation, retry mechanism.

---

### AD-6: Enforce View Layer Types

**Decision**: Replace all `@app/lib/types` imports with `@club/shared-types/view/`.

**Linting Rule**:
```json
{
  "no-restricted-imports": ["error", {
    "patterns": ["@app/lib/types"]
  }]
}
```

**Migration**: Search `rg "from '@app/lib/types'" apps/web`, replace imports.

---

## Implementation Phases

### Incremental Phase-by-Phase Workflow

Each phase follows this cycle (estimate varies per phase):

**Cycle Steps**:
1. **Manual Testing** (1-2h) - Systematic testing per tasks.md checklist
2. **Document Findings** (30min) - Note bugs, edge cases, feature gaps
3. **Write Basic Unit Tests** (1-2h) - **NEW** - Essential tests before refactoring (regression protection)
4. **Bug Fixes & Refactoring** (2-4h) - Fix critical issues, architecture improvements
5. **Expand Tests** (30min-1h) - Add tests for new features/fixes
6. **Update Documentation** (1h) - Update design.md, proposal.md, tasks.md, ARCHITECTURE.md § 5
7. **Code Review & Test** (30min) - Manual regression testing + verify all tests pass
8. **Commit & Move to Next Phase**

**Testing Philosophy**:
- **Before Refactoring**: Write minimal tests covering current behavior (regression protection)
- **After Refactoring**: Expand tests for new features and edge cases
- **Focus**: Essential functionality only, not exhaustive coverage
- **Goal**: Catch breaking changes, not 100% coverage

**Total Estimate**: 30-50 hours (6 phases × 5-8h each, including testing)

---

### Phase 0: MatchCenter.tsx Parent Component (START HERE)

**Status**: Not Started
**Priority**: Critical - Foundation for all tabs
**File**: `apps/web/app/components/Dashboard/MatchCenter.tsx` (472 lines)
**Rationale**: Fix architectural debt in parent before optimizing individual tabs. Parent controls data fetching, mutations, and lazy loading - needs optimization first.

#### Manual Testing Checklist
- [ ] Tab navigation performance (<200ms switch time)
- [ ] Hover preloading investigation (network tab analysis)
- [ ] Props drilling measurement (React DevTools Profiler)
- [ ] Mutation refetch behavior (network tab: full dataset refetch?)
- [ ] Lazy loading error handling (force tab load failure)
- [ ] Modal state management (no leaks between tabs?)
- [ ] Initial load performance (50 players + 100 matches + 5 teams)
- [ ] Re-render analysis (how many on single mutation?)

#### Basic Unit Tests (Write BEFORE Refactoring)
**Purpose**: Regression protection - ensure refactoring doesn't break existing behavior

**Essential Tests** (1-2h to write):
```typescript
// apps/web/app/components/Dashboard/__tests__/MatchCenter.test.tsx

describe('MatchCenter', () => {
  // Tab Navigation
  it('renders Players tab by default', () => { ... });
  it('switches tabs when tab button clicked', () => { ... });
  it('preserves tab state from URL param (?tab=upcoming)', () => { ... });

  // Lazy Loading
  it('shows loading skeleton while tab loads', () => { ... });
  it('shows error fallback when tab fails to load', () => { ... });

  // Data Fetching (current behavior - will change after refactor)
  it('fetches teams, players, matches on mount', () => { ... });

  // Modal Management (current behavior - will change after refactor)
  it('opens ScheduleMatch modal when button clicked', () => { ... });
  it('closes modal when navigating to different tab', () => { ... });
});
```

**Test Strategy**:
- Use React Testing Library (already configured)
- Mock service hooks (MSW or jest.mock)
- Focus on user interactions, not implementation details
- Aim for ~60% coverage (essential paths only)

#### Expected Architectural Issues
1. **Props Drilling** (lines 279-355)
   - Parent fetches: `useTeamList()`, `usePlayerList()`, `useMatchList()`
   - Data passed as props to all tabs
   - Tabs can't control loading states
   - Unnecessary re-renders in parent

2. **Manual Refetch After Mutations**
   - `await deleteMatchMutation.mutateAsync(matchId); await refetchMatches();`
   - Fetches entire match dataset after single deletion
   - No optimistic updates (UI waits for API)

3. **Inline Error Handling** (lines 260-277)
   ```typescript
   const PlayersTab = lazy(() =>
     import('./matchTabs/PlayersTab').catch(err => {
       console.error('Error loading PlayersTab:', err);
       return { default: () => <div>Error loading tab</div> };
     })
   );
   ```
   - Basic error fallback, no retry mechanism
   - No Error Boundary wrapper

4. **State Management Complexity**
   - 7 modal states (ScheduleMatch, MatchLineup, EditMatch, etc.)
   - Search/filter state in parent (should be in tabs)
   - Tight coupling between parent and tab modals

#### Refactoring Priorities
1. **Remove Props Drilling** - Stop fetching data in parent
   - Remove `useTeamList()`, `usePlayerList()`, `useMatchList()` from MatchCenter
   - Let each tab fetch its own data
   - Keep only shared state (activeTab, global modals if needed)

2. **Add Error Boundaries** - Replace inline error handling
   ```typescript
   // Create reusable ErrorBoundary component
   <ErrorBoundary fallback={<TabErrorFallback onRetry={handleRetry} />}>
     <Suspense fallback={<TabSkeleton />}>
       <PlayersTab />
     </Suspense>
   </ErrorBoundary>
   ```

3. **Extract Modal Management** - Move modals closer to tabs
   - ScheduleMatch modal → UpcomingMatchesTab
   - MatchLineup modal → MatchManagementTab
   - EditMatch modal → MatchManagementTab
   - Keep only cross-tab modals in parent (if any)

4. **Simplify Parent Responsibilities**
   - **Keep**: Tab navigation state, lazy loading config, layout structure
   - **Remove**: Data fetching, mutations, tab-specific modals, search/filter state
   - **Result**: Parent becomes thin orchestrator (~150 lines instead of 472)

#### Expand Tests After Refactoring
**New Tests** (30min-1h):
```typescript
describe('MatchCenter - After Refactoring', () => {
  // Verify props drilling removed
  it('does not fetch data in parent component', () => { ... });

  // Error Boundary tests
  it('shows error boundary fallback when tab crashes', () => { ... });
  it('retries tab load when retry button clicked', () => { ... });

  // URL navigation
  it('updates URL when tab changed', () => { ... });
  it('supports browser back/forward with tab state', () => { ... });
});
```

#### Feature Improvements
- Persistent tab selection (URL param: `?tab=players`)
- Tab loading progress indicator (show which tabs are preloading)
- Keyboard navigation (Arrow keys to switch tabs)
- Tab state preservation (scroll position when switching back)

#### Documentation Updates After Completion
- [ ] Update `design.md` § Phase 0 with findings
- [ ] Mark architectural debt fixed in `proposal.md`
- [ ] Update `tasks.md` Phase 0 - mark completed
- [ ] Create `specs/match-center-parent.md` with refactored architecture
- [ ] Update `openspec/ARCHITECTURE.md` § 5 with "Parent: Refactored, [date]"

---

### Phase 1: PlayersTab

**Status**: Blocked (pending Phase 0 completion)
**Priority**: High
**File**: `apps/web/app/components/Dashboard/matchTabs/PlayersTab.tsx` (175 lines)

#### Manual Testing Checklist
- [ ] Search functionality (name, case-insensitive, partial match)
- [ ] Team filter dropdown (All Teams → specific team)
- [ ] Combined search + filter
- [ ] Player table display (all columns render correctly)
- [ ] Edit player action (modal opens, saves correctly)
- [ ] Availability toggle (immediate UI update, persists)
- [ ] Data fetching now colocated in tab (verify no props from parent)
- [ ] Performance with 50+ players

#### Basic Unit Tests (Write BEFORE Refactoring)
**Purpose**: Regression protection for existing PlayersTab functionality

**Essential Tests** (1-2h):
```typescript
// apps/web/app/components/Dashboard/matchTabs/__tests__/PlayersTab.test.tsx

describe('PlayersTab', () => {
  // Search & Filter
  it('filters players by search term', () => {
    // Type "John" in search, verify only Johns displayed
  });

  it('filters players by team selection', () => {
    // Select "Team 1", verify only Team 1 players displayed
  });

  it('combines search and filter', () => {
    // Search "John" + filter "Team 1"
  });

  // Table Display
  it('displays player table with all columns', () => {
    // Verify: #, Name, Status, Teams, Actions
  });

  it('shows correct status badges', () => {
    // Active → green badge, Inactive → gray badge
  });

  // Actions
  it('opens edit modal when edit button clicked', () => { ... });
  it('toggles player availability', () => { ... });
});
```

**Test Strategy**:
- Mock `players` and `teams` props (current architecture)
- After refactor: Mock `usePlayerList()`, `useTeamList()` hooks
- Focus on user-visible behavior

#### Expected Bugs to Find
- Type inconsistencies (`@app/lib/types` vs `@club/shared-types/view`)
- No loading state during data fetch
- No pagination (all players rendered at once)

#### Bug Fixes (Priority)
1. **Colocate data fetching** - Add `usePlayerList()`, `useTeamList()` in PlayersTab (parent no longer provides props)
2. **Add loading state** - Show skeleton while fetching
3. **Fix type imports** - Use View layer types
4. **Add pagination** (if >50 players) - 20 players per page

#### Expand Tests After Refactoring
**New Tests** (30min-1h):
```typescript
describe('PlayersTab - After Refactoring', () => {
  it('fetches players on mount', () => {
    // Verify usePlayerList() called
  });

  it('shows loading skeleton while fetching', () => { ... });

  it('handles fetch error gracefully', () => { ... });

  // New features
  it('paginates players (20 per page)', () => { ... });
  it('filters by status (Active/Inactive)', () => { ... });
  it('filters by ranking range', () => { ... });
});
```

#### Feature Expansions (Identify During Testing)
- Advanced filters (status, ranking range)
- Bulk operations (multi-select, batch update status)
- Export player list (CSV, PDF)
- Player statistics (matches played, win rate)

#### Documentation Updates After Completion
- [ ] Update `design.md` § PlayersTab with findings
- [ ] Update `proposal.md` with actual bugs found
- [ ] Mark tasks complete in `tasks.md`
- [ ] Create `specs/players-tab.md` with detailed spec
- [ ] Update `openspec/ARCHITECTURE.md` § 5.1 with "Status: Optimized, [date]"

---

### Phase 2: Match Tabs - Manual Testing Findings & Technical Decisions

**Status**: 🔄 IN PROGRESS (Manual testing completed 2025-11-05)
**Affected Components**:
- UpcomingMatchesTab (239 lines)
- MatchHistoryTab (248 lines)
- MatchManagementTab (342 lines)
- MatchDetailsModal, ScheduleMatchModal, MatchLineupModal, EditMatchModal

**Findings Documents**:
- `findings/manual-testing-phase2.md` - 10 issues with detailed analysis
- `findings/architecture-analysis.md` - 12 optimization opportunities

#### Issues Summary

**P0 Critical (4 issues)**:
1. Modal Blocking - All 4 modals don't dismiss on backdrop click/ESC
2. Edit Match Failure - Changes don't persist
3. Delete Match Failure - Deletion doesn't work
4. Save Lineup Failure - Player assignments don't persist

**P1 High (4 issues)**:
5. Missing Translations - Hardcoded English strings (i18n broken)
6. Modal Scroll Behavior - Entire modal scrolls, header moves
7. Auto-Complete Status - No SCHEDULED→COMPLETED transition
8. Cancellation Description - No field for cancellation reason

**P2 Medium (2 issues)**:
9. Lineup Card Spacing - Excessive padding, doubles not horizontal
10. Smart Lineup Filtering - No team/gender/availability filters

---

#### Architectural Decision: Modal Interaction Pattern

**Problem**: All match modals lack standard dismissal mechanisms (backdrop click, ESC key)

**Decision**: Implement standardized Dialog pattern using shadcn/ui primitives

**Technical Approach**:
```typescript
// Standard modal pattern for all 4 modals
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent
    className="sm:max-w-[600px]"
    onEscapeKeyDown={() => setIsOpen(false)}
    onPointerDownOutside={() => setIsOpen(false)}
  >
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
    </DialogHeader>

    {/* Content */}

    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSave}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Key Properties**:
- `onOpenChange`: Controls open state (enables backdrop/ESC dismissal)
- `onEscapeKeyDown`: Explicit ESC handler (adds unsaved changes check if needed)
- `onPointerDownOutside`: Backdrop click handler

**Special Case - EditMatchModal**:
Add unsaved changes warning:
```typescript
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

<Dialog open={isOpen} onOpenChange={(open) => {
  if (!open && hasUnsavedChanges) {
    if (confirm('Discard unsaved changes?')) {
      setIsOpen(false);
    }
  } else {
    setIsOpen(false);
  }
}}>
```

**Rationale**:
- Consistent UX across all modals
- Follows platform conventions (ESC = cancel)
- Prevents accidental data loss (EditMatchModal warning)
- shadcn/ui handles accessibility (focus trap, aria-labels)

---

#### Architectural Decision: CRUD Mutation Pattern

**Problem**: Edit/delete/save operations fail - unclear if frontend or backend issue

**Investigation Required** (Root Cause Analysis):
1. Network layer: Are requests sent? Check status codes, payloads
2. Backend layer: Do endpoints exist? Check logs, test with Postman
3. State layer: Are mutations configured correctly?
4. Type layer: View vs Domain type mismatches?

**Decision**: Standardize React Query mutation pattern with proper error handling

**Standard Mutation Pattern**:
```typescript
// Pattern for all CRUD operations
const updateMutation = useUpdateEntity({
  onMutate: async (data) => {
    // 1. Cancel ongoing queries (avoid race conditions)
    await queryClient.cancelQueries(['entity']);

    // 2. Snapshot previous data (for rollback)
    const previous = queryClient.getQueryData(['entity']);

    // 3. Optimistic update (instant UI feedback)
    queryClient.setQueryData(['entity'], (old) => {
      // Update logic
    });

    return { previous };
  },
  onError: (err, data, context) => {
    // 4. Rollback on error
    queryClient.setQueryData(['entity'], context.previous);

    // 5. User feedback
    toast.error(`Failed: ${err.message}`);
  },
  onSuccess: () => {
    // 6. Success feedback
    toast.success('Updated successfully');
  },
  onSettled: () => {
    // 7. Background refetch (sync with server)
    queryClient.invalidateQueries(['entity']);
  }
});
```

**Apply to**:
- `useUpdateMatch()` - Edit match (Task 2.2)
- `useDeleteMatch()` - Delete match (Task 2.3)
- `useSaveLineup()` - Save lineup (Task 2.4)

**Debugging Checklist** (if mutation fails):
```typescript
// Add to each mutation hook
onError: (error) => {
  console.group('Mutation Error');
  console.error('Error object:', error);
  console.error('Error message:', error.message);
  console.error('Error response:', error.response?.data);
  console.groupEnd();

  // Check network tab for:
  // - Request URL (correct endpoint?)
  // - Request method (PUT/PATCH/DELETE?)
  // - Request payload (correct format?)
  // - Response status (400/401/403/404/500?)
  // - Response body (error message?)
}
```

**Rationale**:
- Optimistic updates: <50ms UI feedback (instant)
- Error handling: Graceful rollback + user notification
- Cache sync: Background refetch ensures consistency
- Debugging: Detailed error logs for troubleshooting

---

#### Architectural Decision: Internationalization (i18n) Strategy

**Problem**: Hardcoded English strings throughout match components

**Decision**: Migrate to next-intl with namespace organization

**Translation Structure**:
```typescript
// messages/en/match.json (NEW file)
{
  "status": {
    "scheduled": "Scheduled",
    "completed": "Completed",
    "cancelled": "Cancelled",
    "inProgress": "In Progress"
  },
  "actions": {
    "edit": "Edit Match",
    "delete": "Delete Match",
    "schedule": "Schedule Match",
    "viewDetails": "View Details",
    "saveLineup": "Save Lineup",
    "manageLineup": "Manage Lineup"
  },
  "form": {
    "labels": {
      "date": "Date",
      "time": "Time",
      "location": "Location",
      "homeTeam": "Home Team",
      "awayTeam": "Away Team",
      "matchLevel": "Match Level"
    },
    "placeholders": {
      "selectTeam": "Select a team...",
      "selectPlayer": "Select a player...",
      "enterLocation": "Enter location..."
    }
  },
  "errors": {
    "saveFailed": "Failed to save match",
    "deleteFailed": "Failed to delete match",
    "notFound": "Match not found",
    "unauthorized": "You don't have permission"
  },
  "modals": {
    "titles": {
      "details": "Match Details",
      "schedule": "Schedule New Match",
      "edit": "Edit Match",
      "lineup": "Match Lineup"
    }
  }
}
```

**Component Usage**:
```typescript
import { useTranslations } from 'next-intl';

export default function MatchDetailsModal({ match }: Props) {
  const t = useTranslations('match');

  return (
    <Dialog>
      <DialogTitle>{t('modals.titles.details')}</DialogTitle>
      <div>
        <Label>{t('form.labels.date')}</Label>
        <span>{formatDate(match.date)}</span>
      </div>
      <Badge>{t(`status.${match.status.toLowerCase()}`)}</Badge>
      <Button>{t('actions.edit')}</Button>
    </Dialog>
  );
}
```

**Migration Checklist**:
1. [ ] Audit all match components for hardcoded strings
2. [ ] Create `messages/en/match.json`, `messages/de/match.json`, `messages/zh/match.json`
3. [ ] Add translations for all identified strings
4. [ ] Replace hardcoded strings with `t()` calls
5. [ ] Test language switching (EN → DE → ZH)
6. [ ] Verify status badge colors remain consistent

**Rationale**:
- Namespace isolation: `match.*` separates from other translations
- Type safety: next-intl provides TypeScript autocomplete
- Consistency: Centralized translations prevent duplicates
- Maintainability: Easy to add new languages

---

#### Architectural Decision: Modal Layout Pattern (Scrollable Content)

**Problem**: Entire modal scrolls, header/footer move out of view (MatchLineupModal)

**Decision**: Fixed header/footer with scrollable content area

**Layout Structure**:
```typescript
<DialogContent className="sm:max-w-[800px] p-0 flex flex-col max-h-[90vh]">
  {/* 1. FIXED HEADER (always visible) */}
  <div className="p-6 border-b bg-background z-10 shrink-0">
    <DialogHeader>
      <DialogTitle>Match Lineup</DialogTitle>
      <DialogDescription>
        Assign players to positions
      </DialogDescription>
    </DialogHeader>
  </div>

  {/* 2. SCROLLABLE CONTENT (flex-1, overflow) */}
  <div className="flex-1 overflow-y-auto p-6">
    <div className="space-y-4">
      {/* Position cards */}
      <PositionCard position="singles1" />
      <PositionCard position="singles2" />
      <PositionCard position="doubles1" />
      {/* ... more cards */}
    </div>
  </div>

  {/* 3. FIXED FOOTER (always visible) */}
  <div className="p-6 border-t bg-background shrink-0">
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button onClick={handleSave}>Save Lineup</Button>
    </DialogFooter>
  </div>
</DialogContent>
```

**Key CSS Classes**:
- `max-h-[90vh]`: Modal constrained to viewport height
- `flex flex-col`: Vertical layout (header, content, footer)
- `shrink-0`: Header/footer don't shrink
- `flex-1 overflow-y-auto`: Content area takes remaining space and scrolls
- `bg-background z-10`: Header/footer have background (no content bleed-through)

**Mobile Considerations**:
```typescript
// Adjust max height for mobile
<DialogContent className="sm:max-w-[800px] max-h-[90vh] sm:max-h-[85vh]">
```

**Rationale**:
- Header always visible: User knows context (modal title)
- Footer always visible: Actions (Save/Cancel) always accessible
- Smooth scrolling: Only content area scrolls, no jank
- Consistent pattern: Apply to all large modals (>800px height)

---

#### Architectural Decision: Match Status Auto-Completion

**Problem**: No automatic SCHEDULED → COMPLETED transition after match date

**Decision**: Implement server-side cron job (not client-side)

**Why Cron Job?**
- **Reliability**: Runs regardless of user sessions
- **Consistency**: UTC-based, no timezone issues
- **Performance**: Server-side, no client load

**Implementation**:
```typescript
// apps/api/src/scripts/auto-complete-matches.ts
import cron from 'node-cron';
import { Match } from '../models/Match';

// Run daily at 2 AM UTC
cron.schedule('0 2 * * *', async () => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999); // End of yesterday

    const result = await Match.updateMany(
      {
        status: 'SCHEDULED',
        date: { $lt: yesterday }
      },
      {
        $set: {
          status: 'COMPLETED',
          autoCompleted: true, // Track auto vs manual completion
          autoCompletedAt: new Date()
        }
      }
    );

    console.log(`[CRON] Auto-completed ${result.modifiedCount} matches`);
  } catch (error) {
    console.error('[CRON] Auto-complete failed:', error);
  }
});

export default cron;
```

**Server Integration**:
```typescript
// apps/api/src/server.ts
import autoCompleteMatches from './scripts/auto-complete-matches';

// Start cron jobs after server starts
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  autoCompleteMatches; // Start cron
});
```

**Admin Override**:
```typescript
// Allow admins to manually change status (cron respects manual changes)
const handleStatusChange = async (matchId: string, newStatus: MatchStatus) => {
  await Match.updateOne(
    { _id: matchId },
    {
      $set: {
        status: newStatus,
        manualOverride: true // Prevents cron from overriding
      }
    }
  );
};

// Cron logic updated:
const result = await Match.updateMany(
  {
    status: 'SCHEDULED',
    date: { $lt: yesterday },
    manualOverride: { $ne: true } // Skip manually overridden matches
  },
  { /* ... */ }
);
```

**Rationale**:
- Cron more reliable than client-side checks
- Reduces admin workload (no manual status updates)
- UTC-based eliminates timezone bugs
- Admin override preserves manual corrections

---

#### Architectural Decision: Cancellation Reason Field

**Problem**: No way to add/view cancellation reason when match cancelled

**Decision**: Add optional `cancellationReason` field to Match model

**Schema Update**:
```typescript
// @club/shared-types/src/core/match.ts
interface Match {
  // ... existing fields
  cancellationReason?: string;    // NEW: Optional text
  rescheduledMatchId?: string;    // NEW: Optional link to rescheduled match
}
```

**UI Integration - EditMatchModal**:
```typescript
{status === 'CANCELLED' && (
  <div className="space-y-2 mt-4 p-4 bg-destructive/10 rounded-lg">
    <Label htmlFor="cancellationReason">
      {t('match.form.labels.cancellationReason')}
    </Label>
    <Textarea
      id="cancellationReason"
      value={cancellationReason}
      onChange={(e) => setCancellationReason(e.target.value)}
      placeholder={t('match.form.placeholders.cancellationReason')}
      rows={3}
      className="resize-none"
    />
    <p className="text-xs text-muted-foreground">
      {t('match.form.hints.cancellationReason')}
    </p>
  </div>
)}
```

**Display - MatchDetailsModal**:
```typescript
{match.status === 'CANCELLED' && (
  <Alert variant="destructive" className="mt-4">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>{t('match.status.cancelled')}</AlertTitle>
    {match.cancellationReason && (
      <AlertDescription className="mt-2">
        <strong>{t('match.cancellationReasonLabel')}:</strong>{' '}
        {match.cancellationReason}
      </AlertDescription>
    )}
    {match.rescheduledMatchId && (
      <AlertDescription className="mt-1">
        <Link
          href={`/matches/${match.rescheduledMatchId}`}
          className="underline hover:no-underline"
        >
          {t('match.viewRescheduledMatch')} →
        </Link>
      </AlertDescription>
    )}
  </Alert>
)}
```

**Database Migration**:
```typescript
// Add field to existing matches (optional, defaults to undefined)
db.matches.updateMany(
  {},
  {
    $set: {
      cancellationReason: undefined,
      rescheduledMatchId: undefined
    }
  }
);
```

**Rationale**:
- Optional field: Backward compatible (no migration required)
- Rescheduling link: Helps users find replacement match
- Alert UI: Visible cancellation notice
- Better communication: Reduces confusion about cancellations

---

#### Architectural Decision: Smart Lineup Filtering

**Problem**: No intelligent player filtering in lineup modal (team, gender, availability)

**Decision**: Multi-level filtering with UI indicators

**Filter Logic**:
```typescript
interface FilterCriteria {
  teamAffiliation: boolean;     // Player in match team
  genderRequirement: boolean;    // Meets position gender rules (if any)
  maxPositions: boolean;         // <2 positions assigned
  availability: boolean;         // Marked available for match
}

const getAvailablePlayers = (position: PositionType): Player[] => {
  return allPlayers.filter(player => {
    // Filter 1: Team affiliation
    const isTeamMember = player.teamIds?.includes(match.homeTeamId) ?? false;

    // Filter 2: Gender requirement (position-specific rules)
    const meetsGenderReq = checkGenderRequirement(position, player.gender);

    // Filter 3: Max 2 positions per player
    const assignedCount = countAssignedPositions(player.id, currentLineup);
    const withinLimit = assignedCount < 2;

    // Filter 4: Availability
    const isAvailable = player.availability?.[match.id] ?? false;

    return isTeamMember && meetsGenderReq && withinLimit && isAvailable;
  });
};

const checkGenderRequirement = (
  position: PositionType,
  playerGender: string
): boolean => {
  // Example: If league has gender-specific positions
  const requirements = {
    'singles1': null,      // Any gender
    'singles2': null,
    'doubles1': null,
    'mixedDoubles': 'mixed' // Must have 1 male + 1 female
  };

  const req = requirements[position];
  return req === null || req === 'mixed'; // Implement mixed logic
};
```

**UI Indicators**:
```typescript
<Select
  value={selectedPlayerId}
  onValueChange={setSelectedPlayerId}
>
  <SelectTrigger>
    <SelectValue placeholder="Select player..." />
  </SelectTrigger>
  <SelectContent>
    {getAvailablePlayers(position).map(player => (
      <SelectItem key={player.id} value={player.id}>
        <div className="flex items-center justify-between w-full">
          <span>{player.name}</span>
          <div className="flex items-center gap-2">
            {/* Availability badge */}
            {player.availability?.[match.id] && (
              <Badge variant="success" className="text-xs">
                ✓ Available
              </Badge>
            )}

            {/* Position counter */}
            <span className="text-xs text-muted-foreground">
              {countAssignedPositions(player.id, currentLineup)}/2
            </span>

            {/* Gender indicator (if relevant) */}
            {showGenderIndicator && (
              <span className="text-xs">{player.gender}</span>
            )}
          </div>
        </div>
      </SelectItem>
    ))}

    {/* Show unavailable players toggle */}
    <SelectSeparator />
    <div className="p-2">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={showUnavailable}
          onChange={(e) => setShowUnavailable(e.target.checked)}
        />
        Show unavailable players
      </label>
    </div>
  </SelectContent>
</Select>
```

**Validation**:
```typescript
const validateLineup = (lineup: Lineup): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Check max 2 positions per player
  const playerCounts = new Map<string, number>();
  Object.values(lineup).forEach(playerId => {
    if (playerId) {
      playerCounts.set(playerId, (playerCounts.get(playerId) || 0) + 1);
    }
  });

  playerCounts.forEach((count, playerId) => {
    if (count > 2) {
      errors.push({
        type: 'MAX_POSITIONS',
        playerId,
        message: `Player assigned to ${count} positions (max 2)`
      });
    }
  });

  return errors;
};
```

**Rationale**:
- Progressive filtering: Narrows down valid choices
- Visual feedback: Badges show availability, position count
- Flexibility: Toggle to show all players if needed
- Validation: Prevents invalid lineups
- UX: Reduces cognitive load (only show valid options)

---

### Phase 3: UpcomingMatchesTab (Deprecated - Covered in Phase 2)

**Status**: Blocked (pending PlayersTab completion)
**Priority**: High
**File**: `apps/web/app/components/Dashboard/matchTabs/UpcomingMatchesTab.tsx` (188 lines)

#### Manual Testing Checklist
- [ ] Match filters (All/Team 1/Team 2)
- [ ] Hardcoded team name bug (rename team, verify filter breaks)
- [ ] Countdown display (14 days, <24 hours)
- [ ] Date/time formatting (locale-specific)
- [ ] Timezone edge case (midnight match, wrong tab?)
- [ ] "View Details" modal

#### Expected Bugs to Find
- **Critical**: Hardcoded team names (`match.homeTeamName === 'Team 1'`)
- **Critical**: Client-side date comparison (timezone bugs)
- Props drilling (matches passed from parent)
- No pagination for large datasets

#### Bug Fixes (Priority)
1. **Remove hardcoded team names** - Use team IDs, dynamic team list
2. **Server-side date filtering** - UTC comparison (requires API change)
3. **Colocate data fetching** - Move `useMatchList()` into tab
4. **Add pagination** (if >50 matches)

#### Feature Expansions (Identify During Testing)
- Date range filter (next 7 days, next 30 days)
- Countdown precision (<24h show hours/minutes)
- Calendar view (optional)
- Match reminders (notification system)

#### Documentation Updates After Completion
- [ ] Update `design.md` § UpcomingMatchesTab
- [ ] Mark timezone bug as fixed in `proposal.md`
- [ ] Create `specs/upcoming-matches-tab.md`
- [ ] Update `openspec/ARCHITECTURE.md` § 5.2

---

### Phase 3: MatchHistoryTab

**Status**: Blocked (pending UpcomingMatchesTab completion)
**Priority**: Medium
**File**: `apps/web/app/components/Dashboard/matchTabs/MatchHistoryTab.tsx` (~200 lines)

#### Manual Testing Checklist
- [ ] Historical match display (scores, dates)
- [ ] Team filters (All/Team 1/Team 2)
- [ ] Year filter (All Years → specific year)
- [ ] "View Details" for past matches
- [ ] Sorting (newest first vs oldest first)
- [ ] Performance with 1000+ historical matches

#### Expected Bugs to Find
- Props drilling (matches passed from parent)
- No pagination (all history loaded at once)
- Client-side year filtering (slow with large datasets)
- Same hardcoded team name bug as UpcomingMatchesTab

#### Bug Fixes (Priority)
1. **Add pagination** - 20 matches per page, crucial for performance
2. **Server-side year filtering** - Offload to database query
3. **Fix hardcoded team names** - Use team IDs
4. **Colocate data fetching** - Move `useMatchList()` into tab

#### Feature Expansions (Identify During Testing)
- Advanced search (opponent name, location, date range)
- Statistics summary (win/loss record per year)
- Export history (CSV, PDF report)
- Match comparison (compare two past matches)

#### Documentation Updates After Completion
- [ ] Update `design.md` § MatchHistoryTab
- [ ] Create `specs/match-history-tab.md`
- [ ] Update `openspec/ARCHITECTURE.md` § 5.3

---

### Phase 4: MatchManagementTab (Admin Only)

**Status**: Blocked (pending MatchHistoryTab completion)
**Priority**: Medium
**File**: `apps/web/app/components/Dashboard/matchTabs/MatchManagementTab.tsx`

#### Manual Testing Checklist
- [ ] Admin access control (non-admin cannot access)
- [ ] Global search (teams, location, date, time)
- [ ] Create match modal (all required fields)
- [ ] Edit match modal (pre-filled data)
- [ ] Delete match (confirmation, cascade check)
- [ ] Match lineup modal (player assignment)
- [ ] Refetch after CRUD (entire dataset fetched?)

#### Expected Bugs to Find
- Manual `refetchMatches()` after mutations (inefficient)
- Inline error handling (no Error Boundary)
- No optimistic updates (UI waits for API)
- Props drilling (matches passed from parent)

#### Bug Fixes (Priority)
1. **Optimistic updates** - Instant UI feedback on CRUD
2. **Add Error Boundary** - Graceful error handling with retry
3. **Colocate data fetching** - Move `useMatchList()` into tab
4. **Improve search** - Debounce, highlight matches

#### Feature Expansions (Identify During Testing)
- Bulk operations (multi-select matches, batch delete)
- Match templates (recurring matches, copy lineup)
- Conflict detection (venue/time overlaps)
- Auto-lineup suggestions (based on availability, ranking)

#### Documentation Updates After Completion
- [ ] Update `design.md` § MatchManagementTab
- [ ] Document optimistic update pattern
- [ ] Create `specs/match-management-tab.md`
- [ ] Update `openspec/ARCHITECTURE.md` § 5.4

---

### Phase 5: TeamManagementTab (END HERE)

**Status**: Blocked (pending MatchManagementTab completion)
**Priority**: Low
**File**: `apps/web/app/components/Dashboard/matchTabs/TeamManagementTab.tsx` (139 lines)

#### Manual Testing Checklist
- [ ] Admin access control
- [ ] Team cards display (statistics correct?)
- [ ] Total players count (matches Players tab?)
- [ ] Gender breakdown (male + female = total?)
- [ ] Match level display (Class A-F)
- [ ] Create team modal
- [ ] Edit team (if exists)

#### Expected Bugs to Find
- Props drilling (teams, players passed from parent)
- Statistics calculation (client-side or server-side?)
- No validation on duplicate team names

#### Bug Fixes (Priority)
1. **Colocate data fetching** - Move `useTeamList()` into tab
2. **Server-side statistics** - Calculate player counts in API
3. **Add validation** - Prevent duplicate team names
4. **Add loading state** - Skeleton for team cards

#### Feature Expansions (Identify During Testing)
- Team performance stats (win/loss record)
- Player transfer (move player between teams)
- Team captain assignment
- Team archives (inactive teams)

#### Documentation Updates After Completion
- [ ] Update `design.md` § TeamManagementTab
- [ ] Create `specs/team-management-tab.md`
- [ ] Update `openspec/ARCHITECTURE.md` § 5.5
- [ ] **Final**: Update ARCHITECTURE.md with "Match Center Optimization Complete" status

---

## Implementation Phases

### ~~Phase 1: Testing Foundation~~ REMOVED
**Reason**: Manual testing per tab is sufficient. Automated tests deferred to per-tab basis.

### ~~Phase 2: Bug Fixes~~ RESTRUCTURED
**New Approach**: Bugs fixed incrementally per tab during manual testing phase.

### ~~Phase 3: Architecture Refactor~~ RESTRUCTURED
**New Approach**: Architecture improvements (colocate data, Error Boundaries) applied per tab.

### ~~Phase 4: Feature Expansion~~ RESTRUCTURED
**New Approach**: Features identified and implemented per tab based on manual testing findings.

---

## Phase 1: PlayersTab - Manual Testing Findings

**Date**: 2025-11-03
**Status**: Issues Identified
**Findings Document**: `findings/players-tab.md`

### Critical Issues Identified (P0)

#### Issue #1: Global Modal Scroll Lock Missing
**Severity**: Critical - Affects all modals
**Problem**: When modal opens, background page remains scrollable
**Root Cause**: No `body` scroll lock implementation
**Proposed Solution**:
```typescript
// Create global Modal wrapper component
useEffect(() => {
  if (isOpen) {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }
}, [isOpen]);
```
**Impact**: Affects EditPlayerModal, MatchDetailsModal, ScheduleMatchModal, etc. (5+ modals)

#### Issue #2: Inconsistent Component Naming
**Problem**: `EditPlayerTeamsModal` only describes part of functionality
- Modal edits: player status, ranking, AND teams
- Name implies only team management
**Proposed Solution**: Rename to `EditPlayerModal`
**Files to Update**:
- `EditPlayerTeamsModal.tsx` → `EditPlayerModal.tsx`
- Update imports in: PlayersTab.tsx, MatchManagementTab.tsx, TeamManagementTab.tsx

#### Issue #3: EditPlayerModal UI/UX Issues
**3a. Incorrect Section Order**
- Current: Ranking → Status → Teams
- Proposed: Status → Ranking → Teams
- Rationale: Status (active/inactive) is more critical than ranking

**3b. Player Status Toggle Too Small**
- Current: 48x48px button with small icon (h-8 w-12)
- Issue: Borderline touch target for mobile, low visual prominence
- Proposed: Larger toggle (64x64px touch target, h-12 w-20 button, h-8 w-8 icon)

**3c. Inconsistent UI Components**
- Team/Role selects use native HTML `<select>` elements
- Other components use shadcn UI (Button, Badge, Input)
- Proposed: Replace with shadcn `<Select>` component for consistency

### High Priority Features (P1)

#### Feature #1: Batch Player Operations
**Problem**: No multi-select or bulk actions for players
**Use Cases**:
- Admin needs to deactivate 10 inactive players at once
- Admin needs to add 5 new players to "Team 1" simultaneously
- Admin needs to adjust rankings after tournament (+50 to all winners)

**Proposed Implementation** (3 phases):

**Phase 1: Multi-Select UI**
```typescript
// Add checkbox column to player table
const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

// Header checkbox (select all)
<input
  type="checkbox"
  checked={selectedPlayerIds.length === filteredPlayers.length}
  onChange={handleSelectAll}
/>

// Row checkbox
<input
  type="checkbox"
  checked={selectedPlayerIds.includes(player.id)}
  onChange={() => handleToggleSelect(player.id)}
/>
```

**Phase 2: Bulk Actions Toolbar**
```typescript
// Fixed position toolbar when players selected
{selectedPlayerIds.length > 0 && (
  <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-primary p-4 rounded-lg shadow-lg">
    <span>{selectedPlayerIds.length} players selected</span>
    <Button onClick={handleBatchActivate}>Activate</Button>
    <Button onClick={handleBatchDeactivate}>Deactivate</Button>
    <Button onClick={handleBatchAddToTeam}>Add to Team</Button>
    <Button onClick={handleBatchUpdateRanking}>Update Ranking</Button>
  </div>
)}
```

**Phase 3: Batch API Endpoint**
```typescript
// New backend endpoint needed
POST /api/players/batch-update
Body: {
  playerIds: string[],
  updates: {
    isActivePlayer?: boolean,
    ranking?: number,
    rankingOffset?: number, // +100, -50, etc.
    addToTeams?: string[],
    removeFromTeams?: string[]
  }
}
```

**Estimated Effort**: 4-6 hours (2h UI + 2h API + 1-2h testing)

#### Feature #2: Inconsistent Select Components
**Problem**: Native `<select>` elements don't match shadcn design system
**Locations**:
- EditPlayerModal team select (line ~285)
- EditPlayerModal role select (line ~300)

**Proposed Solution**:
```typescript
// Replace native select
<select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
  <option value="">Select a team...</option>
</select>

// With shadcn Select
<Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Select a team..." />
  </SelectTrigger>
  <SelectContent>
    {availableTeams.map(team => (
      <SelectItem key={team.id} value={team.id}>
        {team.name} {team.matchLevel && `(${team.matchLevel})`}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Medium Priority Features (P2)

#### Feature #1: Advanced Filtering
**Current**: Basic search + team filter only
**Proposed Enhancements**:
- Status filter: All / Active / Inactive
- Ranking range filter: Slider (0-5000) or min/max inputs
- Multi-team filter: Select multiple teams (show players in ANY selected team)

**UI Layout**:
```tsx
<div className="filters grid grid-cols-4 gap-4">
  <Input placeholder="Search players..." />                    {/* Existing */}
  <Select>...</Select>                                          {/* Existing team filter */}
  <Select>                                                      {/* NEW: Status filter */}
    <SelectItem value="all">All Status</SelectItem>
    <SelectItem value="active">Active Only</SelectItem>
    <SelectItem value="inactive">Inactive Only</SelectItem>
  </Select>
  <Popover>                                                     {/* NEW: Ranking range */}
    <PopoverTrigger>Ranking: {rankingMin}-{rankingMax}</PopoverTrigger>
    <PopoverContent>
      <Slider min={0} max={5000} value={[rankingMin, rankingMax]} />
    </PopoverContent>
  </Popover>
</div>
```

**Estimated Effort**: 2-3 hours

#### Feature #2: Sortable Columns
**Current**: No sorting, fixed display order
**Proposed**: Clickable headers with sort indicators (↑/↓)
**Columns**: Name (alphabetical), Ranking (numerical), Status (active first)

**Implementation**:
```typescript
const [sortBy, setSortBy] = useState<'name' | 'ranking' | null>(null);
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

const sortedPlayers = [...filteredPlayers].sort((a, b) => {
  if (!sortBy) return 0;
  if (sortBy === 'name') {
    return sortOrder === 'asc'
      ? a.userName.localeCompare(b.userName)
      : b.userName.localeCompare(a.userName);
  }
  if (sortBy === 'ranking') {
    return sortOrder === 'asc' ? a.ranking - b.ranking : b.ranking - a.ranking;
  }
  return 0;
});
```

**Estimated Effort**: 1-2 hours

#### Feature #3: Player Statistics (Deferred)
**Proposed**: Show inline stats (matches played, win rate, last match date)
**Challenge**: Performance impact with 50+ players × N matches
**Solution**: Backend precomputation (materialized view or cache)
**Estimated Effort**: 4-5 hours (3h backend + 2h frontend)
**Decision**: Defer to separate performance optimization proposal

### Performance Considerations

#### Large Dataset Pagination
**Finding**: 50+ players causes ~500ms lag, no pagination
**Recommendation**: Implement pagination at 20 players/page
**Priority**: P1 (high) - Will be needed as club grows

**Metrics**:
- 10 players: ~150ms (acceptable)
- 50 players: ~500ms (borderline)
- 100+ players: Not tested (likely >1s)

#### Search Performance
**Current**: Client-side filter, <50ms latency
**Status**: Acceptable for <100 players
**No changes needed** at this time

### Type Architecture Fix

**Issue**: Imports from `@app/lib/types` (domain/service layer)
**Location**: Line 21 - `import { Player } from '@app/lib/types';`
**Problem**: Violates layer separation (see `openspec/architecture/system-layers.md`)
**Proposed Solution**: Import from `@shared/types/view` instead
**Files Affected**:
- PlayersTab.tsx
- UpcomingMatchesTab.tsx
- MatchHistoryTab.tsx
- MatchManagementTab.tsx
- TeamManagementTab.tsx

**Estimated Effort**: 1-2 hours (find/replace + type adjustments)

### Testing Recommendations

**Unit Tests Needed**:
- Player search (full name, partial, case-insensitive)
- Team filter (all teams, specific team, combined with search)
- Edit modal open/close
- Player status toggle
- Ranking input validation (0-5000 range)
- Batch select (select all, select individual, clear selection)
- Batch operations (activate, deactivate, add to team)

**Target Coverage**: 60-70%
**Estimated Effort**: 2-3 hours (1.5h basic tests + 1h batch operations tests)

### Edge Cases Verified ✅

- ✅ Player with no team: Displays "—" in Teams column
- ✅ Player with multiple teams: Multiple checkmarks displayed
- ✅ Player with ranking 0: Displays "0" (not blank)
- ✅ Player with maximum ranking (5000): Displays correctly
- ⚠️ Large dataset (50+ players): Performance issue - pagination needed
- ✅ Empty state: Shows "No players found" message

### Props Drilling Status ✅ RESOLVED

**Previous Issue**: Parent passed 28 props to tabs, causing unnecessary re-renders
**Current State**: Phase 0 refactored - PlayersTab fetches own data (usePlayerList, useTeamList)
**Verification**: React DevTools confirms only PlayersTab re-renders on updates, parent and other tabs do not re-render

---

## Trade-offs

### Colocated Data vs Props Drilling

| Aspect | Current (Props) | Proposed (Colocated) |
|--------|----------------|----------------------|
| Coupling | High | Low |
| Data Control | Parent only | Tab controls |
| Performance | All upfront | Lazy per tab |
| Cache | Single fetch | RQ deduplicates |
| Complexity | Simple | Moderate (more hooks) |

**Decision**: Colocate. Benefits outweigh complexity.

### Client vs Server Date Filtering

| Aspect | Client | Server |
|--------|--------|--------|
| Timezone | Inconsistent | UTC |
| Performance | Filter in JS | DB query |
| Backend Change | No | Yes |
| Accuracy | Midnight bugs | Correct |

**Decision**: Server-side. Requires backend work but fixes bugs.

### Pagination vs Virtual Scroll

| Aspect | Pagination | Virtual Scroll |
|--------|------------|----------------|
| Backend | Required | No |
| Complexity | Low | High |
| UX | Click next | Smooth scroll |
| Performance | <20 items | All items |

**Decision**: Pagination first. Virtual scroll if needed.

---

## Open Questions

1. **Should tabs share team/player data via RQ cache, or pass as props?**
   - Answer: Cache. Each tab fetches, RQ deduplicates.

2. **Backend API changes in scope?**
   - Answer: Yes, for date filtering + pagination endpoints.

3. **Keep 5 tabs or consolidate Upcoming/History/Management?**
   - Answer: Keep 5. Consolidation separate proposal.

4. **Testing strategy: manual only or add automated?**
   - Answer: Manual testing Phase 1. Automated per-tab deferred.

---

## Success Criteria

### Phase 2 (Bugs)
- ✅ Team filters work after rename
- ✅ Matches in correct tab at midnight
- ✅ <1s load with 1000+ matches

### Phase 3 (Architecture)
- ✅ 0 props drilling (tabs fetch own data)
- ✅ Error boundaries catch failures
- ✅ 100% View layer types
- ✅ <100ms refetch latency (optimistic updates)

---

## References

- `openspec/specs/match-center-page-overview.md` - Functional requirements
- `openspec/ARCHITECTURE.md` - Type system, patterns, **Match Center architecture (§5)**
- `apps/web/app/components/Dashboard/MatchCenter.tsx` - Current implementation

---

## Documentation Maintenance

**IMPORTANT:** After each tab improvement is completed:

1. **Update openspec/ARCHITECTURE.md § 5 (Match Center)**:
   - Document new architecture changes (component hierarchy, data flow)
   - Add/update functional points for the improved tab
   - Note resolved issues and any new technical debt
   - Update performance optimizations list
   - Keep maintenance protocol current

2. **Update this design.md**:
   - Mark architectural decisions as implemented
   - Document actual implementation vs planned
   - Note any deviations or new findings

3. **Update proposal.md**:
   - Mark completed tasks
   - Document outcomes and metrics

4. **Create new specs** (if applicable):
   - Add detailed specs under `specs/` for new features
   - Reference from ARCHITECTURE.md

This ensures ARCHITECTURE.md remains the authoritative source for Match Center implementation details.
