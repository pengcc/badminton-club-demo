# Proposal: Optimize Match Center Architecture & Features

**Status**: ✅ **COMPLETED** (2025-11-07)
**Change ID**: `optimize-match-center`
**Created**: 2025-11-02
**Completed**: 2025-11-07
**Author**: System
**Priority**: High
**Total Time**: ~54 hours (all phases)

---

## Completion Summary

**All Phases Completed** ✅:
- ✅ **Phase 0**: MatchCenter Parent Component (6h) - Architecture foundation
- ✅ **Phase 1**: PlayersTab (6h) - Batch operations, UI polish
- ✅ **Phase 2**: P0-P2 Bugs (21.5h) - Critical/high/medium priority fixes
- ✅ **Post-P2**: Bug Fixes (2.5h) - Backend bugs, component extraction
- ✅ **Phase 4**: Tab Optimizations (18h) - MatchHistoryTab, UpcomingMatchesTab, MatchManagementTab, TeamManagementTab

**Final Results**:
- **Code Quality**: 0 TypeScript errors across entire Match Center
- **i18n Coverage**: 100% (0 hardcoded strings, 3 languages: en/de/zh)
- **Pattern Consistency**: 100% (all tabs use Service Layer with React Query)
- **User Experience**: Professional skeleton loading, multilingual support, accurate real-time data
- **Performance**: <1s initial loads, instant client-side filtering, optimistic UI updates

**Documentation**:
- Complete implementation details: `/openspec/changes/optimize-match-center/PHASE4-COMPLETION.md`
- Comprehensive task tracking: `/openspec/changes/optimize-match-center/tasks.md`
- TeamManagementTab analysis: `/openspec/changes/optimize-match-center/findings/team-management-optimization-analysis.md`

---

## Problem Statement (Resolved)

Match Center (MatchCenter.tsx, 472 lines) had architectural debt and missing features that hindered scalability and user experience. Implementation used props drilling, had zero test coverage, and contained timezone bugs and hardcoded values.

**All Issues Resolved** ✅:

### Phase 0 - Parent Component Issues ✅ COMPLETED:
1. ✅ Props Drilling Architecture → FIXED: Data fetching colocated to tabs
2. ✅ Manual Refetch Strategy → FIXED: React Query auto-invalidation
3. ✅ Inline Error Handling → FIXED: Error Boundaries added
4. ✅ Modal Management → FIXED: Modals moved to tabs/query-based
5. ✅ State Complexity → FIXED: State colocated to tabs

### Phase 1 - PlayersTab Issues ✅ COMPLETED:
6. ✅ Batch operations missing → IMPLEMENTED: Multi-team assignment
7. ✅ Mobile viewport overflow → FIXED: Responsive cards
8. ✅ Team-player operation confusion → REFACTORED: Clear UI patterns

### Phase 2 - Match Tabs Issues ✅ COMPLETED:

12. **🟡 HIGH: Auto-Complete Match Status** - No automatic transition from `SCHEDULED` → `COMPLETED` when match date passes, requires manual admin intervention

13. **🟡 HIGH: Cancellation Description** - When match status set to `CANCELLED`, no way to add/view cancellation reason or rescheduling information

14. **🔴 CRITICAL: Delete Match Failure** - Delete match functionality fails silently, matches remain in database after delete action

15. **🟢 MEDIUM: Smart Lineup Filtering** - Player selection in MatchLineupModal lacks intelligent filtering by team affiliation, gender requirements, and availability (max 2 positions per player)

**Remaining Tab Issues** (to be addressed in Phases 3-5):
16. **Zero Test Coverage** - No unit, integration, or E2E tests for Match Center components
17. **Performance** - No pagination, all matches loaded at once (500+ matches slow)
18. **Type Inconsistencies** - Mix of `@app/lib/types` vs `@club/shared-types/view` imports
19. **Hardcoded Values** - Team filters use `match.homeTeamName === 'Team 1'` (UpcomingMatchesTab) → breaks if team renamed
20. **Date Timezone Bug** - Client-side `new Date(match.date) > new Date()` comparison (UpcomingMatchesTab) → midnight matches show in wrong tab

**Code References**:
- `apps/web/app/components/Dashboard/MatchCenter.tsx` (149 lines) - ✅ Phase 0 Complete
- `apps/web/app/components/Dashboard/matchTabs/PlayersTab.tsx` (186 lines) - ✅ Phase 1 Complete
- `apps/web/app/components/Dashboard/matchTabs/UpcomingMatchesTab.tsx` (188 lines) - 🔄 Phase 2 In Progress
- `apps/web/app/components/Dashboard/matchTabs/MatchHistoryTab.tsx` (~200 lines) - 🔄 Phase 2 In Progress
- `apps/web/app/components/Dashboard/matchTabs/MatchManagementTab.tsx` - 🔄 Phase 2 In Progress
- `apps/web/app/components/Dashboard/modals/MatchDetailsModal.tsx` - 🔄 Phase 2 In Progress
- `apps/web/app/components/Dashboard/modals/ScheduleMatchModal.tsx` - 🔄 Phase 2 In Progress
- `apps/web/app/components/Dashboard/modals/MatchLineupModal.tsx` - 🔄 Phase 2 In Progress
- `apps/web/app/components/Dashboard/modals/EditMatchModal.tsx` - 🔄 Phase 2 In Progress
- See `openspec/changes/optimize-match-center/design.md` for detailed architecture analysis
- See `findings/manual-testing-phase2.md` for Issue #9-15 analysis and proposed solutions

---

## Proposed Solution

### Implementation Strategy: Parent-First, Then Tab-by-Tab Optimization

**Approach**: Optimize parent component architecture first (Phase 0), establishing clean foundation. Then optimize each tab independently through complete test-fix-document-code cycle. This allows:
- Fix architectural debt at root (props drilling, refetch strategy, error handling)
- Establish patterns in parent that tabs will follow
- Reduced risk (parent refactor isolated, then incremental tab improvements)
- Easier code review (parent refactor separate from tab optimizations)

**Phase Sequence**:
0. **MatchCenter.tsx Parent** → Fix architecture foundation (props drilling, Error Boundaries, modal management)
1. **PlayersTab** → Foundation (data fetching patterns, type consistency)
2. **UpcomingMatchesTab** → Fix critical bugs (timezone, hardcoded names)
3. **MatchHistoryTab** → Performance (pagination for large datasets)
4. **MatchManagementTab** → Advanced patterns (optimistic updates)
5. **TeamManagementTab** → Final cleanup, lessons learned applied

### Scope Per Phase

Each phase goes through **Test-Driven Refactoring** cycle:
1. **Manual Testing** (1-2h) - Systematic testing per checklist
2. **Document Findings** (30min) - Bugs, edge cases, feature gaps
3. **Write Basic Unit Tests** (1-2h) - **Essential regression protection BEFORE refactoring**
4. **Bug Fixes & Refactoring** (2-4h) - Fix issues with test safety net
5. **Expand Tests** (30min-1h) - Add tests for new features/fixes
6. **Update Documentation** (1h) - Update design.md, proposal.md, tasks.md, specs/, ARCHITECTURE.md
7. **Code Review & Test** (30min) - Manual regression + verify all tests pass
8. **Commit & Move to Next Phase**

**Testing Philosophy**:
- **Before Refactoring**: Write minimal tests covering current behavior (~60% coverage, essential paths)
- **After Refactoring**: Expand tests for new features and edge cases
- **Goal**: Catch breaking changes during refactoring, not 100% coverage
- **Estimate**: 1-2h for basic tests, 30min-1h for expansion per phase

**Total Estimate**: 30-50 hours (6 phases × 5-8h each, including testing overhead)

---

## Implementation Plan - Parent-First, Then Tab-by-Tab

### Phase 0: MatchCenter.tsx Parent Component (START HERE)

**Status**: Not Started
**Estimated**: 6-9 hours
**File**: `apps/web/app/components/Dashboard/MatchCenter.tsx` (472 lines)
**Priority**: Critical - Foundation for all subsequent phases

#### Step 1: Manual Testing (1-2h)
Execute comprehensive analysis of parent component:
- Tab navigation performance (measure switch time with React DevTools)
- Hover preloading behavior (network tab: prefetch working?)
- **Critical**: Props drilling measurement (Profiler: how many re-renders on mutation?)
- **Critical**: Refetch behavior (network tab: full dataset refetch after single mutation?)
- Lazy loading error handling (force tab load failure, verify error UI)
- Modal state management (switch tabs, verify no state leaks)
- Initial load performance (measure with 50 players + 100 matches + 5 teams)

#### Step 2: Document Findings (30min)
- **Confirm architectural issues**:
  - Props drilling causes X re-renders across parent + all tabs
  - Manual `refetchMatches()` fetches Y KB after single deletion
  - Inline error handling shows basic div, no retry
  - 7 modal states create tight coupling
  - Search/filter state in parent causes re-renders

#### Step 3: Write Basic Unit Tests (1-2h) - **BEFORE Refactoring**
Create regression protection for current behavior:

```typescript
// apps/web/app/components/Dashboard/__tests__/MatchCenter.test.tsx

describe('MatchCenter', () => {
  // Tab Navigation
  it('renders Players tab by default', () => {
    render(<MatchCenter />);
    expect(screen.getByRole('tabpanel', { name: /players/i })).toBeInTheDocument();
  });

  it('switches tabs when tab button clicked', () => {
    render(<MatchCenter />);
    fireEvent.click(screen.getByRole('tab', { name: /upcoming matches/i }));
    expect(screen.getByRole('tabpanel', { name: /upcoming matches/i })).toBeInTheDocument();
  });

  it('preserves tab state from URL param (?tab=upcoming)', () => {
    mockSearchParams({ tab: 'upcoming' });
    render(<MatchCenter />);
    expect(screen.getByRole('tabpanel', { name: /upcoming matches/i })).toBeInTheDocument();
  });

  // Lazy Loading
  it('shows loading skeleton while tab loads', async () => {
    render(<MatchCenter />);
    expect(screen.getByTestId('tab-skeleton')).toBeInTheDocument();
    await waitForElementToBeRemoved(() => screen.getByTestId('tab-skeleton'));
  });

  it('shows error fallback when tab fails to load', async () => {
    mockTabLoadError();
    render(<MatchCenter />);
    expect(await screen.findByText(/error loading tab/i)).toBeInTheDocument();
  });

  // Data Fetching (current behavior - will change after refactor)
  it('fetches teams, players, matches on mount', () => {
    render(<MatchCenter />);
    expect(useTeamList).toHaveBeenCalled();
    expect(usePlayerList).toHaveBeenCalled();
    expect(useMatchList).toHaveBeenCalled();
  });

  // Modal Management (current behavior - will change after refactor)
  it('opens ScheduleMatch modal when button clicked', () => {
    render(<MatchCenter />);
    fireEvent.click(screen.getByRole('button', { name: /schedule match/i }));
    expect(screen.getByRole('dialog', { name: /schedule match/i })).toBeInTheDocument();
  });

  it('closes modal when navigating to different tab', () => {
    render(<MatchCenter />);
    fireEvent.click(screen.getByRole('button', { name: /schedule match/i }));
    fireEvent.click(screen.getByRole('tab', { name: /players/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

**Test Strategy**:
- Mock service hooks: `useTeamList()`, `usePlayerList()`, `useMatchList()`
- Use React Testing Library (already configured in workspace)
- Focus on user-visible behavior (tab switching, modals, loading states)
- Aim for ~60% coverage of critical paths

**Why Test Before Refactoring?**
- Parent is 472 lines with complex state management
- Refactoring will restructure data fetching, modal management, error handling
- Tests catch breaking changes immediately (tab navigation, modal behavior, lazy loading)
- Saves time vs manual testing after every change

#### Step 4: Architecture Refactoring (2-3h)
**Priority Refactors**:

1. **Remove Props Drilling** (1-2h)
   ```typescript
   // BEFORE (MatchCenter.tsx lines 279-355)
   const { data: teams } = TeamService.useTeamList();
   const { data: players } = PlayerService.usePlayerList();
   const { data: matches, refetch: refetchMatches } = MatchService.useMatchList();

   <PlayersTab players={players} teams={teams} />
   <UpcomingMatchesTab matches={matches} user={user} />

   // AFTER (Simplified parent - data fetching moved to tabs)
   export default function MatchCenter() {
     const [activeTab, setActiveTab] = useState<TabType>('players');

     return (
       <div>
         <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
         <ErrorBoundary fallback={<TabErrorFallback />}>
           <Suspense fallback={<TabSkeleton />}>
             {activeTab === 'players' && <PlayersTab />}
             {activeTab === 'upcoming' && <UpcomingMatchesTab />}
             {/* ... other tabs */}
           </Suspense>
         </ErrorBoundary>
       </div>
     );
   }
   // Parent now ~150 lines instead of 472
   ```

2. **Add Error Boundaries** (1h)
   ```typescript
   // Create apps/web/app/components/ErrorBoundary.tsx
   export class ErrorBoundary extends React.Component {
     state = { hasError: false, error: null };

     static getDerivedStateFromError(error) {
       return { hasError: true, error };
     }

     componentDidCatch(error, errorInfo) {
       logError('MatchCenter', error, errorInfo);
     }

     render() {
       if (this.state.hasError) {
         return this.props.fallback;
       }
       return this.props.children;
     }
   }

   // Wrap tabs in MatchCenter
   <ErrorBoundary fallback={<TabErrorFallback onRetry={() => window.location.reload()} />}>
     <Suspense fallback={<TabSkeleton />}>
       <PlayersTab />
     </Suspense>
   </ErrorBoundary>
   ```

3. **Extract Modal Management** (1h)
   - Move ScheduleMatch modal → UpcomingMatchesTab component
   - Move MatchLineup modal → MatchManagementTab component
   - Move EditMatch modal → MatchManagementTab component
   - Keep only cross-tab modals in parent (if any - likely none needed)

   **Result**: Parent manages only tab navigation, not tab-specific UI

4. **Remove Manual Refetch** (30min)
   - Delete `refetchMatches()` calls in parent
   - Tabs will handle their own refetch with React Query cache invalidation
   - Prepare for optimistic updates in Phase 4

#### Step 5: Expand Tests (30min-1h) - **After Refactoring**
Verify refactoring goals achieved + new features work:

```typescript
describe('MatchCenter - After Refactoring', () => {
  // Verify props drilling removed
  it('does not fetch data in parent component', () => {
    render(<MatchCenter />);
    expect(useTeamList).not.toHaveBeenCalled();
    expect(usePlayerList).not.toHaveBeenCalled();
    expect(useMatchList).not.toHaveBeenCalled();
  });

  // Error Boundary tests
  it('shows error boundary fallback when tab crashes', () => {
    mockTabCrash();
    render(<MatchCenter />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('retries tab load when retry button clicked', () => {
    mockTabCrash();
    render(<MatchCenter />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(window.location.reload).toHaveBeenCalled();
  });

  // URL navigation
  it('updates URL when tab changed', () => {
    render(<MatchCenter />);
    fireEvent.click(screen.getByRole('tab', { name: /upcoming/i }));
    expect(window.location.search).toBe('?tab=upcoming');
  });

  it('supports browser back/forward with tab state', () => {
    render(<MatchCenter />);
    fireEvent.click(screen.getByRole('tab', { name: /upcoming/i }));
    window.history.back();
    expect(screen.getByRole('tabpanel', { name: /players/i })).toBeInTheDocument();
  });
});
```

#### Step 6: Feature Improvements (1h)
- Persistent tab selection: URL param `?tab=players`
- Keyboard navigation: Arrow keys to switch tabs
- Tab state preservation: Scroll position when switching back

#### Step 7: Update Documentation (1h)
- [ ] Update `design.md` § Phase 0 - document refactored architecture
- [ ] Mark architectural debt fixed in `proposal.md`
- [ ] Create `specs/match-center-parent.md` - new parent component spec
- [ ] Update `openspec/ARCHITECTURE.md` § 5 with "Parent: Refactored, simplified to ~150 lines"

#### Step 8: Code Review & Regression Test (30min)
- **Run all tests**: Verify both basic + expanded tests pass
- Test all tabs still load correctly (no props from parent now)
- Verify Error Boundary catches failures
- Test tab navigation (URL params work)
- Performance check (re-render count reduced?)

#### Step 9: Commit & Move to Phase 1

**Commit Message**:
```
refactor(match-center): optimize MatchCenter parent component

- Removed props drilling (data fetching moved to tabs)
- Added Error Boundaries (replace inline error handling)
- Extracted modal management to tabs (reduce coupling)
- Simplified parent: 472 lines → ~150 lines
- Added URL-based tab navigation (?tab=players)

BREAKING CHANGE: Tabs now fetch their own data (no props from parent)

Closes #XXX
Phase 0/5 complete: MatchCenter.tsx Parent
```

---

### Phase 1: PlayersTab (UPDATED WITH MANUAL TESTING FINDINGS)

**Status**: Manual Testing Complete - Issues Identified
**Findings Document**: `findings/players-tab.md`
**Estimated**: 8-12 hours (increased from 4-6h due to new requirements)
**File**: `apps/web/app/components/Dashboard/matchTabs/PlayersTab.tsx` (186 lines)

#### Manual Testing Results (Completed 2025-11-03)

**Critical Issues Found (P0)**: 3 issues
1. **Global modal scroll lock missing** - All modals allow background scrolling
2. **Component naming inconsistency** - EditPlayerTeamsModal should be EditPlayerModal
3. **EditPlayerModal UI/UX issues** - Wrong section order, toggle too small, inconsistent UI components

**High Priority Features (P1)**: 2 items
1. **Batch player operations missing** - No multi-select or bulk actions
2. **Inconsistent select components** - Native HTML selects instead of shadcn UI

**Medium Priority Features (P2)**: 3 items
1. Advanced filtering (status, ranking range)
2. Sortable columns (name, ranking)
3. Player statistics (deferred to separate proposal)

#### Step 1: Manual Testing ✅ COMPLETED (1.5h actual)
- ✅ Executed comprehensive test scenarios from `tasks.md` Task 1.1
- ✅ Documented in `findings/players-tab.md`
- ✅ Identified 5 critical issues + 3 feature gaps

#### Step 2: Document Findings ✅ COMPLETED (0.5h actual)
- ✅ Created `findings/players-tab.md` with detailed analysis
- ✅ Listed bugs with severity levels (P0/P1/P2)
- ✅ Proposed solutions for each issue
- ✅ Estimated effort for each fix

#### Step 3: Write Unit Tests (1-2h)
**Test Coverage Needed**:
- Basic player rendering and search functionality
- Team filter combinations
- Edit modal open/close workflow
- Player status toggle
- Ranking input validation (0-5000 range)
- Batch select functionality (NEW)
- Batch operations (NEW)

**Target Coverage**: 60-70%

#### Step 4: Fix Critical Issues (P0) - 4-6 hours

**4a. Implement Global Modal Scroll Lock** (1-2h)
```typescript
// Create apps/web/app/components/ui/modal.tsx
export function Modal({ isOpen, onClose, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50">
      {children}
    </div>
  );
}
```

**Impact**: Apply to all modals (EditPlayerModal, MatchDetailsModal, ScheduleMatchModal, etc.)

**4b. Rename EditPlayerTeamsModal → EditPlayerModal** (30min)
```bash
# Rename file
mv apps/web/app/components/Dashboard/modals/EditPlayerTeamsModal.tsx \
   apps/web/app/components/Dashboard/modals/EditPlayerModal.tsx

# Update imports in:
# - PlayersTab.tsx
# - MatchManagementTab.tsx
# - TeamManagementTab.tsx
```

**4c. Fix EditPlayerModal Layout and UI** (2-3h)

**Sub-task 4c.1: Reorder sections**
```typescript
// NEW ORDER:
1. Player Status Toggle (move to top)
2. Player Ranking (move below status)
3. Current Teams (keep position)
4. Add to Team (keep position)
```

**Sub-task 4c.2: Enlarge status toggle button**
```typescript
// CURRENT:
<Button className="h-8 w-12 p-0">
  <ToggleRight className="h-5 w-5" />
</Button>

// PROPOSED:
<Button className="h-12 w-20 p-0">
  <ToggleRight className="h-8 w-8" />
</Button>
```

**Sub-task 4c.3: Replace native selects with shadcn Select**
```typescript
// Replace team select (line ~285)
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

// Replace role select (line ~300)
<Select value={selectedRole} onValueChange={setSelectedRole}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Select role..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="player">Player</SelectItem>
    <SelectItem value="captain">Captain</SelectItem>
    <SelectItem value="vice-captain">Vice Captain</SelectItem>
  </SelectContent>
</Select>
```

#### Step 5: Implement Batch Operations (P1) - 4-6 hours

**5a. Add Multi-Select UI** (2h)
```typescript
// Add to PlayersTab state
const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

// Add checkbox column
<th className="w-12">
  <input
    type="checkbox"
    checked={selectedPlayerIds.length === filteredPlayers.length && filteredPlayers.length > 0}
    onChange={handleSelectAll}
  />
</th>

// Each row checkbox
<td>
  <input
    type="checkbox"
    checked={selectedPlayerIds.includes(player.id)}
    onChange={() => handleToggleSelect(player.id)}
  />
</td>
```

**5b. Add Bulk Actions Toolbar** (1h)
```typescript
{selectedPlayerIds.length > 0 && (
  <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg z-50">
    <span className="mr-4">{selectedPlayerIds.length} players selected</span>
    <Button onClick={handleBatchActivate} variant="secondary" size="sm">
      Activate
    </Button>
    <Button onClick={handleBatchDeactivate} variant="secondary" size="sm">
      Deactivate
    </Button>
    <Button onClick={handleBatchAddToTeam} variant="secondary" size="sm">
      Add to Team
    </Button>
    <Button onClick={handleBatchUpdateRanking} variant="secondary" size="sm">
      Update Ranking
    </Button>
    <Button onClick={() => setSelectedPlayerIds([])} variant="ghost" size="sm">
      Clear Selection
    </Button>
  </div>
)}
```

**5c. Implement Backend API** (2h)
```typescript
// apps/api/src/controllers/playerController.ts
export async function batchUpdatePlayers(req: Request, res: Response) {
  const { playerIds, updates } = req.body;

  // Validate inputs
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return res.status(400).json({ error: 'Invalid playerIds' });
  }

  // Build update operations
  const operations = [];

  if (updates.isActivePlayer !== undefined) {
    operations.push({
      updateMany: {
        filter: { _id: { $in: playerIds } },
        update: { $set: { isActivePlayer: updates.isActivePlayer } }
      }
    });
  }

  if (updates.rankingOffset) {
    operations.push({
      updateMany: {
        filter: { _id: { $in: playerIds } },
        update: { $inc: { ranking: updates.rankingOffset } }
      }
    });
  }

  if (updates.addToTeams) {
    // Implement team assignment logic
  }

  if (updates.removeFromTeams) {
    // Implement team removal logic
  }

  // Execute batch operations
  await Player.bulkWrite(operations);

  res.json({ success: true, updated: playerIds.length });
}

// Route
router.post('/api/players/batch-update', requireAdmin, batchUpdatePlayers);
```

**5d. Frontend API Client** (30min)
```typescript
// apps/web/app/lib/api.ts
export async function batchUpdatePlayers(
  playerIds: string[],
  updates: {
    isActivePlayer?: boolean;
    ranking?: number;
    rankingOffset?: number;
    addToTeams?: string[];
    removeFromTeams?: string[];
  }
) {
  const response = await fetch('/api/players/batch-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerIds, updates })
  });

  if (!response.ok) throw new Error('Batch update failed');
  return response.json();
}
```

**5e. Batch Operation Tests** (1h)
```typescript
describe('PlayersTab - Batch Operations', () => {
  it('selects all players when header checkbox clicked', () => {
    render(<PlayersTab />);
    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }));
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(11); // 10 players + header
  });

  it('shows bulk actions toolbar when players selected', () => {
    render(<PlayersTab />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]); // Select first player
    expect(screen.getByText(/1 players selected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /activate/i })).toBeInTheDocument();
  });

  it('activates selected players when activate button clicked', async () => {
    render(<PlayersTab />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /activate/i }));
    await waitFor(() => {
      expect(batchUpdatePlayers).toHaveBeenCalledWith(
        [expect.any(String)],
        { isActivePlayer: true }
      );
    });
  });
});
```

#### Step 6: Optional Features (P2) - Deferred or Time-Permitting

**6a. Advanced Filtering** (2-3h) - If time permits
- Status filter dropdown (All / Active / Inactive)
- Ranking range slider (0-5000)
- Multi-team filter

**6b. Sortable Columns** (1-2h) - If time permits
- Clickable column headers
- Sort by name, ranking, status
- Sort indicators (↑/↓)

**6c. Player Statistics** - DEFERRED to separate proposal
- Requires backend aggregation
- Performance considerations with large datasets
- Estimated 4-5 hours (separate from this phase)

#### Step 7: Update Documentation (1h)
- [x] Update `design.md` § Phase 1 with findings and solutions - COMPLETED
- [ ] Update `proposal.md` § Phase 1 with new requirements - IN PROGRESS
- [ ] Update `tasks.md` Phase 1 with detailed task breakdown
- [ ] Create `specs/edit-player-modal.md` with updated modal spec
- [ ] Update `openspec/ARCHITECTURE.md` § 5.1 with "PlayersTab: Optimized, 2025-11-0X"

#### Step 6: Code Review & Regression Test (30min)
- Manual regression test all PlayersTab scenarios
- Verify no new bugs introduced
- Check performance improvement (measure load time, re-renders)

#### Step 7: Commit & Move to Phase 2

**Commit Message**:
```
feat(match-center): optimize PlayersTab

- Colocated data fetching (eliminate props drilling)
- Added loading skeleton and pagination
- Fixed type imports (View layer)
- Added advanced filters and bulk operations

Closes #XXX
```

---

### Phase 2: UpcomingMatchesTab

**Status**: Blocked (pending Phase 1 completion)
**Estimated**: 5-7 hours (includes backend API changes)
**File**: `apps/web/app/components/Dashboard/matchTabs/UpcomingMatchesTab.tsx` (188 lines)

#### Step 1: Manual Testing (1-2h)
- Match filters (All/Team 1/Team 2)
- **Critical Test**: Hardcoded team name bug (rename team, verify filter breaks)
- Countdown display accuracy
- **Critical Test**: Timezone edge case (midnight match, wrong tab?)
- "View Details" modal workflow

#### Step 2: Document Findings (30min)
- Confirm hardcoded team names bug
- Confirm timezone bug (client-side date comparison)
- Props drilling impact
- Performance with 100+ upcoming matches

#### Step 3: Bug Fixes (2-3h)
**Priority Fixes**:
1. **Critical**: Remove hardcoded team names - Use team IDs, dynamic team list
   ```typescript
   // BEFORE
   const isTeam1Match = match.homeTeamName === 'Team 1';

   // AFTER
   const { data: teams } = TeamService.useTeamList();
   const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
   const filteredMatches = matches?.filter(m =>
     !selectedTeamId || m.homeTeamId === selectedTeamId
   );
   ```

2. **Critical**: Server-side date filtering (requires backend change)
   ```typescript
   // Backend: apps/api/src/controllers/matchController.ts
   const dateAfter = req.query.dateAfter ? new Date(req.query.dateAfter) : undefined;
   const query = { ...(dateAfter && { date: { $gt: dateAfter } }) };

   // Frontend: UpcomingMatchesTab.tsx
   const { data: upcomingMatches } = MatchService.useMatchList({
     status: 'scheduled',
     dateAfter: new Date().toISOString() // UTC timestamp
   });
   ```

3. Colocate data fetching - Move `useMatchList()` into tab
4. Add pagination (if >50 matches)

#### Step 4: Feature Expansion (1-2h)
- Date range filter (next 7 days, next 30 days, custom range)
- Countdown precision (<24h show hours/minutes, not just days)
- Match availability tracking (players who marked available)

#### Step 5: Update Documentation (1h)
- [ ] Update `design.md` § UpcomingMatchesTab - note fixed bugs
- [ ] Mark timezone bug, hardcoded names as FIXED in `proposal.md`
- [ ] Create `specs/upcoming-matches-tab.md`
- [ ] Update `openspec/ARCHITECTURE.md` § 5.2

#### Step 6: Code Review & Regression Test (30min)
- Test timezone edge cases (midnight, DST boundaries)
- Test dynamic team filtering after team rename
- Manual regression test

#### Step 7: Commit & Move to Phase 3

**Commit Message**:
```
fix(match-center): fix critical bugs in UpcomingMatchesTab

- Fixed timezone bug (server-side UTC filtering)
- Fixed hardcoded team names (use team IDs)
- Colocated data fetching
- Added date range filters

BREAKING CHANGE: Requires backend API changes
Closes #XXX, #YYY
```

---

### Phase 3: MatchHistoryTab

**Status**: Blocked (pending Phase 2 completion)
**Estimated**: 4-6 hours
**File**: `apps/web/app/components/Dashboard/matchTabs/MatchHistoryTab.tsx` (~200 lines)

#### Step 1: Manual Testing (1-2h)
- Historical match display (scores, dates correct?)
- Team filters (same bug as UpcomingMatchesTab?)
- Year filter accuracy
- Sorting (chronological order?)
- Performance with 1000+ historical matches

#### Step 2: Document Findings (30min)
- Confirm hardcoded team name bug
- Performance bottleneck with large datasets
- Year filter implementation (client-side or server-side?)

#### Step 3: Bug Fixes (1-2h)
**Priority Fixes**:
1. **Critical**: Add pagination - 20 matches per page (performance)
2. Fix hardcoded team names - Apply same fix as UpcomingMatchesTab
3. Server-side year filtering - Offload to database query
4. Colocate data fetching - Move `useMatchList()` into tab

#### Step 4: Feature Expansion (1-2h)
- Advanced search (opponent name, location, date range)
- Statistics summary card (win/loss record per year, per team)
- Export history (CSV download)

#### Step 5: Update Documentation (1h)
- [ ] Update `design.md` § MatchHistoryTab
- [ ] Create `specs/match-history-tab.md`
- [ ] Update `openspec/ARCHITECTURE.md` § 5.3

#### Step 6: Code Review & Regression Test (30min)

#### Step 7: Commit & Move to Phase 4

---

### Phase 4: MatchManagementTab (Admin Only)

**Status**: Blocked (pending Phase 3 completion)
**Estimated**: 6-8 hours
**File**: `apps/web/app/components/Dashboard/matchTabs/MatchManagementTab.tsx`

#### Step 1: Manual Testing (2-3h)
- Admin access control (test with non-admin account)
- Global search (teams, location, date, time)
- Create match modal (all required fields, validation)
- Edit match modal (pre-filled data correctness)
- Delete match (confirmation, cascade effects?)
- Match lineup modal (player assignment, doubles pairing)
- **Critical**: Refetch behavior after CRUD (network tab analysis)

#### Step 2: Document Findings (30min)
- Confirm manual `refetchMatches()` inefficiency
- Inline error handling inadequacy
- No optimistic updates (UI latency)

#### Step 3: Bug Fixes (2-3h)
**Priority Fixes**:
1. **Critical**: Optimistic updates - Instant UI feedback
   ```typescript
   const deleteMatchMutation = MatchService.useDeleteMatch({
     onMutate: async (matchId) => {
       await queryClient.cancelQueries(['matches']);
       const previousMatches = queryClient.getQueryData(['matches']);
       queryClient.setQueryData(['matches'], (old: Match[]) =>
         old.filter(m => m.id !== matchId)
       );
       return { previousMatches };
     },
     onError: (err, matchId, context) => {
       queryClient.setQueryData(['matches'], context.previousMatches);
       toast.error('Failed to delete match');
     }
   });
   ```

2. Add Error Boundary - Wrap tab in ErrorBoundary with retry
3. Colocate data fetching - Move `useMatchList()` into tab
4. Improve search - Debounce input, highlight matches

#### Step 4: Feature Expansion (1-2h)
- Bulk operations (multi-select matches, batch delete)
- Match templates (save lineup template, apply to future matches)
- Conflict detection (venue/time overlaps warning)

#### Step 5: Update Documentation (1h)
- [ ] Update `design.md` § MatchManagementTab - document optimistic update pattern
- [ ] Create `specs/match-management-tab.md`
- [ ] Update `openspec/ARCHITECTURE.md` § 5.4

#### Step 6: Code Review & Regression Test (30min)

#### Step 7: Commit & Move to Phase 5

---

### Phase 5: TeamManagementTab (END HERE)

**Status**: Blocked (pending Phase 4 completion)
**Estimated**: 3-5 hours
**File**: `apps/web/app/components/Dashboard/matchTabs/TeamManagementTab.tsx` (139 lines)

#### Step 1: Manual Testing (1-2h)
- Admin access control
- Team cards display (statistics accuracy)
- Total players count (cross-check with Players tab)
- Gender breakdown (male + female = total?)
- Match level display
- Create team modal
- Edit team functionality

#### Step 2: Document Findings (30min)
- Props drilling (teams, players passed from parent)
- Statistics calculation location (client vs server)
- Validation gaps (duplicate team names)

#### Step 3: Bug Fixes (1-2h)
**Priority Fixes**:
1. Colocate data fetching - Move `useTeamList()` into tab
2. Server-side statistics - Calculate player counts in API (performance)
3. Add validation - Prevent duplicate team names
4. Add loading skeleton - Team cards skeleton

#### Step 4: Feature Expansion (1h)
- Team performance stats (win/loss record from matches)
- Player transfer UI (drag-and-drop between teams)
- Team captain designation

#### Step 5: Update Documentation (1h)
- [ ] Update `design.md` § TeamManagementTab
- [ ] Create `specs/team-management-tab.md`
- [ ] Update `openspec/ARCHITECTURE.md` § 5.5
- [ ] **FINAL**: Update ARCHITECTURE.md with "Match Center Optimization: Complete (2025-11-0X)"

#### Step 6: Code Review & Regression Test (30min)
- Full Match Center regression test (all 5 tabs)
- Cross-tab integration testing
- Performance benchmark (before/after comparison)

#### Step 7: Final Commit & Close Change

**Commit Message**:
```
feat(match-center): complete TeamManagementTab optimization

- Colocated data fetching
- Server-side statistics calculation
- Added team performance stats
- Final architecture cleanup

This completes the Match Center optimization initiative.
All 5 tabs now use colocated data fetching, proper error handling,
and consistent View layer types.

Closes #XXX
Closes optimize-match-center change
```

---
2. PlayersTab (search/filter logic)
3. MatchHistoryTab (date validation)
4. TeamManagementTab (stats calculations)
5. MatchManagementTab (admin CRUD)

**When to Automate**:
- Before refactoring (regression protection)
- After bugs found in manual testing
- When tab undergoes major feature addition

### Phase 2: Bug Fixes (High Priority)

**Task 2.1: Fix Timezone Issue** (2h)
**Location**: `UpcomingMatchesTab.tsx` line ~32, filter logic

```typescript
// BEFORE (client timezone-dependent)
const matchDate = new Date(match.date);
return matchDate > new Date() && !isNaN(matchDate.getTime());

// AFTER (server-side UTC comparison - requires API change)
// Backend: Add ?dateAfter=2025-11-02T00:00:00Z filter to /api/matches
const { data: upcomingMatches } = MatchService.useMatchList({
  status: 'scheduled',
  dateAfter: new Date().toISOString()
});
```

**Task 2.2: Remove Hardcoded Teams** (2h)
**Location**: `UpcomingMatchesTab.tsx` filter handlers

```typescript
// BEFORE (hardcoded team names)
const isTeam1Match = match.homeTeamName === 'Team 1';
const isTeam2Match = match.homeTeamName === 'Team 2';

// AFTER (use team IDs from service)
const { data: teams } = TeamService.useTeamList();
const team1 = teams?.find(t => t.name === 'Team 1');
const team2 = teams?.find(t => t.name === 'Team 2');
const isTeam1Match = match.homeTeamId === team1?.id;
const isTeam2Match = match.homeTeamId === team2?.id;

// BETTER: Store teamId in filter state, not name
const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
const filteredMatches = matches?.filter(m =>
  !selectedTeamId || m.homeTeamId === selectedTeamId
);
```

**Task 2.3: Add Pagination** (2h)
- 20 matches per page (backend support needed)
- Virtual scrolling for mobile (react-window alternative)
- URL param persistence (`?page=2`)

### Phase 3: Architecture Refactor (Medium Priority)

**Task 3.1: Colocate Data Fetching** (4h)
**Applies to**: All 5 tabs (PlayersTab, UpcomingMatchesTab, MatchHistoryTab, MatchManagementTab, TeamManagementTab)

```typescript
// BEFORE (MatchCenter.tsx lines 279-355)
// Parent fetches all data upfront
const { data: teams } = TeamService.useTeamList();
const { data: players } = PlayerService.usePlayerList();
const { data: matches, refetch: refetchMatches } = MatchService.useMatchList();

// Props drilled to tabs
<PlayersTab players={players} teams={teams} searchTerm={searchTerm} onSearchChange={setSearchTerm} />
<UpcomingMatchesTab matches={matches} user={user} />
<MatchHistoryTab matches={matches} yearFilter={yearFilter} />

// AFTER (PlayersTab.tsx)
export default function PlayersTab() {
  const { data: players, isLoading } = PlayerService.usePlayerList();
  const { data: teams } = TeamService.useTeamList();
  const [searchTerm, setSearchTerm] = useState('');

  // Tab controls its own data and state
  if (isLoading) return <TabSkeleton />;
  // ...
}
```

**Benefits**:
- Tabs independently fetchable (only active tab loads data)
- React Query cache deduplicates shared data (teams fetched once)
- Easier to test in isolation
- No props drilling (0 data props passed from parent)
- Each tab controls loading states

**Trade-off**: Shared data (teams) may be fetched by multiple tabs, but React Query cache handles deduplication automatically.

**Task 3.2: Error Boundaries** (2h)
**Location**: `MatchCenter.tsx` lines 260-277 (replace inline error handling)

```tsx
// BEFORE (inline catch in lazy())
const PlayersTab = lazy(() =>
  import('./matchTabs/PlayersTab').catch(err => {
    console.error('Error loading PlayersTab:', err);
    return { default: () => <div>Error loading tab</div> };
  })
);

// AFTER (Error Boundary wrapper)
<ErrorBoundary
  fallback={<TabErrorFallback onRetry={() => window.location.reload()} />}
  onError={(error, errorInfo) => logError('PlayersTab', error, errorInfo)}
>
  <Suspense fallback={<TabSkeleton />}>
    <PlayersTab />
  </Suspense>
</ErrorBoundary>
```

**Task 3.3: Type Consistency** (2h)
- Audit all imports in MatchCenter.tsx and tab files
- Replace `import { User, Player, Team, Match } from '@app/lib/types'` with `@club/shared-types/view`
- Add ESLint rule: `"no-restricted-imports": ["error", { "patterns": ["@app/lib/types"] }]`
- Search command: `rg "from '@app/lib/types'" apps/web/app/components/Dashboard`

**Task 3.4: Optimistic Updates** (2h)
**Location**: `MatchCenter.tsx` mutation handlers (deleteMatch, toggleAvailability, syncPlayers)

```typescript
// BEFORE (manual refetch fetches entire dataset)
const deleteMatchMutation = MatchService.useDeleteMatch();
const handleDeleteMatch = async (matchId: string) => {
  await deleteMatchMutation.mutateAsync(matchId);
  await refetchMatches(); // ❌ Fetches ALL matches again
};

// AFTER (optimistic update with cache manipulation)
const deleteMatchMutation = MatchService.useDeleteMatch({
  onMutate: async (matchId) => {
    await queryClient.cancelQueries(['matches']);
    const previousMatches = queryClient.getQueryData(['matches']);

    // Optimistically remove match from cache
    queryClient.setQueryData(['matches'], (old: Match[]) =>
      old.filter(m => m.id !== matchId)
    );

    return { previousMatches };
  },
  onError: (err, matchId, context) => {
    // Rollback on error
    queryClient.setQueryData(['matches'], context.previousMatches);
    toast.error('Failed to delete match');
  },
  onSettled: () => {
    queryClient.invalidateQueries(['matches']); // Background refetch
  }
});

    // Optimistically update
    queryClient.setQueryData(['matches'], (old) =>
      updateMatchAvailability(old, newAvailability)
    );

    return { previousMatches };
  },
  onError: (err, newAvailability, context) => {
    // Rollback on error
    queryClient.setQueryData(['matches'], context.previousMatches);
  }
});
```

---

## Dependencies

**Blocked By**:
- None (can start immediately)

**Blocks**:
- Future match scheduling enhancements (pending architecture stabilization)
- Player analytics features (pending data model consistency)
- Match Center performance improvements (pending baseline metrics)

**Requires**:
- React Query knowledge (mutations, cache, optimistic updates)
- Jest/RTL setup (already configured in `apps/web/jest.config.ts`)
- Error Boundary implementation (create reusable component in Phase 4)
- Backend API updates (date filtering in Phase 2, pagination in Phases 2-3, statistics in Phase 5)

**References**:
- `openspec/ARCHITECTURE.md` § 5 - Match Center architecture (updated after each phase)
- `openspec/changes/optimize-match-center/design.md` - Architectural decisions (updated per tab)
- `openspec/specs/match-center-page-overview.md` - Functional requirements

---

## Success Metrics

### Per-Tab Metrics

**Phase 1 (PlayersTab)**:
- [ ] 0 props drilling (data fetched in tab)
- [ ] <500ms initial load with 50 players
- [ ] Loading skeleton displayed during fetch
- [ ] 100% View layer types (`@club/shared-types/view`)

**Phase 2 (UpcomingMatchesTab)**:
- [ ] **Critical**: 0 timezone bugs (UTC server-side filtering)
- [ ] **Critical**: Filters work after team rename (no hardcoded names)
- [ ] <1s load with 100+ upcoming matches
- [ ] Date range filter functional

**Phase 3 (MatchHistoryTab)**:
- [ ] Pagination implemented (20 matches/page)
- [ ] <1s load with 1000+ historical matches
- [ ] Server-side year filtering
- [ ] Statistics summary accurate

**Phase 4 (MatchManagementTab)**:
- [ ] Optimistic updates: <50ms perceived latency on CRUD
- [ ] Error Boundary catches failures with retry option
- [ ] Search debounced (300ms delay)
- [ ] Match templates functional

**Phase 5 (TeamManagementTab)**:
- [ ] Server-side statistics (player counts, gender breakdown)
- [ ] Validation prevents duplicate team names
- [ ] Team performance stats accurate
- [ ] All 5 tabs optimized (architecture complete)

### Overall Metrics (End of Phase 5)

- [ ] **Architecture**: 0 props drilling across all tabs
- [ ] **Performance**: <1s load time for all tabs with large datasets
- [ ] **Error Handling**: Error Boundaries on all tabs
- [ ] **Type Consistency**: 100% View layer types in all components
- [ ] **User Experience**: <100ms perceived latency on mutations (optimistic updates)
- [ ] **Documentation**: ARCHITECTURE.md § 5 fully updated
- [ ] **Code Quality**: No manual `refetchMatches()`, React Query cache managed properly

---

## Risks & Mitigation

**Risk 1: Backend API Changes Break Frontend**
- *Mitigation*: Coordinate backend changes with frontend per phase. Test in dev environment first. Use feature flags for gradual rollout.

**Risk 2: Tab-by-Tab Approach Creates Inconsistency**
- *Mitigation*: Establish patterns in Phase 1 (PlayersTab), reuse in subsequent phases. Document patterns in design.md.

**Risk 3: Performance Regressions During Refactor**
- *Mitigation*: Benchmark before/after each phase. Manual regression testing per cycle. Monitor re-render counts with React DevTools.

**Risk 4: Feature Expansion Scope Creep**
- *Mitigation*: Limit features per tab to 1-2 hours. Defer complex features to future proposals. Focus on bug fixes first.

**Risk 5: Manual Testing Fatigue**
- *Mitigation*: Use detailed checklist in tasks.md. Automate critical paths after Phase 3 if patterns established.

---

## Open Questions

1. **Should optimistic updates be applied to all mutations or just deletes?**
   - **Answer TBD**: Test in Phase 4, evaluate UX impact. Start with delete, expand if successful.

2. **Pagination: Client-side or server-side?**
   - **Answer**: Server-side (requires backend changes). Better performance with large datasets.

3. **Error Boundary scope: Per tab or entire MatchCenter?**
   - **Answer**: Per tab (isolate failures). Implement in Phase 4, apply to all tabs.

4. **Automated tests: When to add?**
   - **Answer**: After Phase 3 if patterns established. Focus on critical paths (UpcomingMatchesTab timezone logic).

5. **Feature expansion priority per tab?**
   - **Answer**: Determined during manual testing. Document in findings, implement highest-value features only.

---

## Progress Tracking

### Phase Completion Status

- [ ] Phase 1: PlayersTab (0% complete)
  - [ ] Manual testing
  - [ ] Bug fixes (colocate data, types, loading state)
  - [ ] Feature expansion (filters, bulk ops)
  - [ ] Documentation updates

- [ ] Phase 2: UpcomingMatchesTab (0% complete)
  - [ ] Manual testing (timezone, hardcoded names)
  - [ ] Critical bug fixes (UTC filtering, dynamic teams)
  - [ ] Feature expansion (date range filter)
  - [ ] Documentation updates

- [ ] Phase 3: MatchHistoryTab (0% complete)
  - [ ] Manual testing (pagination need)
  - [ ] Bug fixes (pagination, year filtering)
  - [ ] Feature expansion (statistics, export)
  - [ ] Documentation updates

- [ ] Phase 4: MatchManagementTab (0% complete)
  - [ ] Manual testing (refetch inefficiency)
  - [ ] Bug fixes (optimistic updates, Error Boundary)
  - [ ] Feature expansion (templates, conflict detection)
  - [ ] Documentation updates

- [ ] Phase 5: TeamManagementTab (0% complete)
  - [ ] Manual testing (statistics accuracy)
  - [ ] Bug fixes (server stats, validation)
  - [ ] Feature expansion (performance stats)
  - [ ] Final documentation & regression test

**Overall Progress**: 0/5 phases complete (0%)

---

## Notes

### Deferred to Future Proposals

The following were in original proposal but split out:
- **Analytics Dashboard** - Separate proposal after data model stabilizes
- **Bulk Operations** - User feedback needed on UX design
- **Advanced Filters** - Depends on search service implementation

### Manual Testing Checklist

Until automated tests added, manually verify each tab:

**PlayersTab** (175 lines):
- [ ] Player search functionality (filter by name)
- [ ] Team filter dropdown ("All Teams" → specific team)
- [ ] Player status toggle (Active/Inactive)
- [ ] Edit player modal (ranking, status, team assignment)
- [ ] Player table displays: #, Name, Status, Teams (checkmarks), Actions

**UpcomingMatchesTab** (188 lines):
- [ ] Match filters: "All Matches", "Team 1", "Team 2"
- [ ] Countdown displays correctly (14 days, 21 days)
- [ ] Date/time format: "Sonntag, 16.11.2025 um 14:00 Uhr"
- [ ] "View Details" button opens match details modal
- [ ] Timezone edge case: Match at midnight shows in correct tab

**MatchHistoryTab** (~200 lines):
- [ ] Historical match display with final scores
- [ ] Year filter dropdown ("All Years" → specific year)
- [ ] Team filters work correctly
- [ ] "View Details" for past matches

**MatchManagementTab** (admin only):
- [ ] Global search: teams, location, date, time
- [ ] "Create Match" modal (required: date, time, location, team)
- [ ] "Edit Match" modal pre-fills existing data
- [ ] "Delete Match" with confirmation
- [ ] Match Lineup modal: player assignment to positions (Singles 1, Doubles 1, etc.)
- [ ] Team filter radio buttons

**TeamManagementTab** (139 lines):
- [ ] Team cards display: Total Players, Gender breakdown, Match Level
- [ ] "Create Team" button functional
- [ ] Team statistics calculated correctly

**Cross-Tab Testing**:
- [ ] Tab navigation performance (<200ms switch)
- [ ] Hover preloading works (network tab shows prefetch)
- [ ] Error handling: Network failure shows error state (not blank)
- [ ] Modal interactions don't leak state between tabs
- [ ] Data refetch after mutations updates all affected tabs
