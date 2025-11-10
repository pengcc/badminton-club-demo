# Match Center Optimization Workflow

**Change ID**: `optimize-match-center`
**Strategy**: Parent-First, Then Incremental Tab-by-Tab Optimization
**Current Phase**: Phase 0 - MatchCenter.tsx Parent Component

---

## Workflow Overview

**Phase 0** refactors parent component first (fix architectural debt). **Phases 1-5** optimize each tab through complete test-driven cycle:

```
┌─────────────────────────────────────────────────────────────┐
│           PHASE 0: PARENT COMPONENT REFACTORING              │
└─────────────────────────────────────────────────────────────┘

Special Phase: Fix architecture foundation with test safety net

1. Analysis & Testing (1-2h)
   ├─ Measure props drilling impact (re-render counts)
   ├─ Analyze refetch behavior (network tab)
   ├─ Test error handling (force failures)
   └─ Document modal coupling

2. Document Findings (30min)
   ├─ Create findings/parent-component.md
   ├─ Quantify performance impact
   └─ Propose refactoring strategy

3. Write Basic Unit Tests (1-2h) **BEFORE Refactoring**
   ├─ Tab navigation tests (8 tests)
   ├─ Lazy loading tests
   ├─ Data fetching tests (current behavior)
   └─ Modal management tests
   → Regression protection during refactoring

4. Architecture Refactoring (2-3h) **With Test Safety Net**
   ├─ Remove props drilling (stop fetching data in parent)
   ├─ Add Error Boundaries (replace inline error handling)
   ├─ Extract modal management (move to tabs)
   └─ Simplify parent (472 lines → ~150 lines)
   → Tests catch breaking changes immediately

5. Expand Tests (30min-1h) **After Refactoring**
   ├─ Verify no data fetching in parent
   ├─ Error Boundary tests (crash recovery, retry)
   └─ URL navigation tests (browser back/forward)
   → Verify refactoring goals achieved

6. Feature Improvements (1h)
   ├─ URL-based tab navigation (?tab=players)
   ├─ Keyboard navigation (Arrow keys)
   └─ Tab state preservation

7. Update Documentation (1h)
   ├─ Update design.md § Phase 0
   ├─ Create specs/match-center-parent.md
   └─ Update ARCHITECTURE.md § 5

8. Code Review & Test (30min)
   ├─ Run full test suite (basic + expanded)
   └─ Manual regression testing

9. Commit & Move to Phase 1

┌─────────────────────────────────────────────────────────────┐
│              PHASES 1-5: TAB OPTIMIZATION CYCLE              │
└─────────────────────────────────────────────────────────────┘

Standard cycle for each tab (Test-Driven Refactoring):

1. Manual Testing (1-2h)
   ├─ Execute test scenarios from tasks.md
   ├─ Document bugs with severity ratings
   └─ Identify feature gaps

2. Document Findings (30min)
   ├─ Create findings/[tab-name].md
   ├─ List bugs, edge cases, performance metrics
   └─ Propose feature expansions (prioritized)

3. Write Basic Unit Tests (1-2h) **BEFORE Refactoring**
   ├─ Test current tab behavior (~5-8 tests)
   ├─ Cover critical paths: search, filters, actions
   ├─ Mock props (current architecture)
   └─ Regression protection for refactoring
   → Tests catch breaking changes during fixes

4. Bug Fixes & Refactoring (2-4h) **With Test Safety Net**
   ├─ Fix critical bugs first
   ├─ Colocate data fetching (add hooks to tab)
   ├─ Add loading states, error handling
   ├─ Fix type imports (View layer)
   └─ Run tests frequently during changes
   → Tests validate each change

5. Expand Tests (30min-1h) **After Refactoring**
   ├─ Update tests for new data fetching pattern
   ├─ Add tests for bug fixes
   ├─ Add tests for new features
   └─ Verify coverage ~60-70%
   → Ensure new functionality works

6. Update Documentation (1h)
   ├─ Update design.md § [Tab] with findings & fixes
   ├─ Mark bugs fixed in proposal.md
   ├─ Update tasks.md (mark completed, update next phase)
   ├─ Create specs/[tab-name].md with detailed spec
   └─ Update openspec/ARCHITECTURE.md § 5.X

7. Code Review & Regression Test (30min)
   ├─ Run full test suite (all tests pass)
   ├─ Manual regression test critical scenarios
   ├─ Verify no new bugs introduced
   ├─ Check performance improvement (before/after metrics)
   └─ Cross-tab integration test (if applicable)

8. Commit & Move to Next Phase
   ├─ Write descriptive commit message
   ├─ Reference closed issues
   └─ Update change status in proposal.md
```

**Testing Philosophy**:
- **Before Refactoring**: Lightweight tests (~60% coverage, critical paths only)
- **After Refactoring**: Expand tests for new features and bug fixes
- **Goal**: Catch breaking changes, not 100% coverage (balance effort vs value)

---

## Phase Sequence

### Phase 0: MatchCenter.tsx Parent (START HERE)
**Status**: Not Started
**Priority**: Critical - Foundation for all tabs
**Rationale**: Parent controls architecture (props drilling, refetch, error handling). Must fix foundation before tab optimizations.

**Key Goals**:
- Remove props drilling (stop fetching data in parent)
- Add Error Boundaries (replace inline error handling)
- Extract modal management (move modals to tabs)
- Simplify parent (472 → ~150 lines)

**Success Criteria**:
- Parent fetches no data (0 service hooks)
- Parent passes no props to tabs
- Error Boundaries wrap all lazy tabs
- Parent ~150 lines (orchestrator only)

---

### Phase 1: PlayersTab
**Status**: Blocked (pending Phase 0)
**Priority**: High
**Rationale**: Foundation for patterns reused in other tabs

**Key Goals**:
- Add colocated data fetching (tab fetches own data)
- Fix type imports (View layer)
- Add loading states
- Pattern for manual testing documentation

**Success Criteria**:
- Tab fetches own data (players, teams)
- <500ms load with 50 players
- Loading skeleton displayed
- 100% View layer types

---

### Phase 2: UpcomingMatchesTab
**Status**: Blocked (pending Phase 1)
**Priority**: High
**Rationale**: Critical bugs (timezone, hardcoded names) need fixing

**Key Goals**:
- Fix timezone bug (server-side UTC filtering)
- Remove hardcoded team names (use team IDs)
- Add date range filters
- Backend API changes (date filtering endpoint)

**Success Criteria**:
- 0 timezone bugs
- Filters work after team rename
- <1s load with 100+ matches
- UTC date comparison

---

### Phase 3: MatchHistoryTab
**Status**: Blocked (pending Phase 2)
**Priority**: Medium
**Rationale**: Performance optimization (pagination for large datasets)

**Key Goals**:
- Add pagination (20 matches/page)
- Server-side year filtering
- Statistics summary card
- Export history (CSV)

**Success Criteria**:
- <1s load with 1000+ matches
- Pagination functional
- Statistics accurate
- Export works

---

### Phase 4: MatchManagementTab (Admin)
**Status**: Blocked (pending Phase 3)
**Priority**: Medium
**Rationale**: Advanced patterns (optimistic updates, Error Boundaries)

**Key Goals**:
- Implement optimistic updates (instant UI feedback)
- Add Error Boundary (graceful error handling)
- Improve search (debounce)
- Match templates (save/apply lineups)

**Success Criteria**:
- <50ms perceived latency on CRUD
- Error Boundary catches failures
- Search debounced (300ms)
- Templates functional

---

### Phase 5: TeamManagementTab (END)
**Status**: Blocked (pending Phase 4)
**Priority**: Low
**Rationale**: Final cleanup, apply lessons learned

**Key Goals**:
- Server-side statistics (player counts, gender breakdown)
- Validation (prevent duplicate team names)
- Team performance stats (win/loss record)
- Final architecture cleanup

**Success Criteria**:
- Server-side stats calculation
- Validation prevents duplicates
- Performance stats accurate
- All 5 tabs optimized

---

## Documentation Maintenance

**After EACH tab completion, update**:

1. **design.md**
   - Add § [Tab Name] with findings, fixes, features
   - Update architectural decisions if new patterns emerge
   - Note lessons learned for next tabs

2. **proposal.md**
   - Mark phase complete in Progress Tracking
   - Update bug status (fixed/in-progress/deferred)
   - Update success metrics

3. **tasks.md**
   - Mark tasks complete
   - Update next phase status (unblock)
   - Add new tasks if bugs discovered

4. **specs/[tab-name].md** (NEW)
   - Detailed spec for the tab
   - Component API (props, state, hooks)
   - User interactions (clicks, inputs, modals)
   - Edge cases and validation rules

5. **openspec/ARCHITECTURE.md § 5.X**
   - Update tab-specific section
   - Note "Status: Optimized, [date]"
   - Document new features, resolved issues
   - Keep functional points current

**After ALL tabs complete**:
- Update ARCHITECTURE.md § 5 header: "Status: Complete, [date]"
- Create summary in design.md: "Optimization Complete"
- Close change in proposal.md

---

## Commit Message Template

```
<type>(match-center): <brief description>

<detailed description of changes>
- Bullet point 1
- Bullet point 2

<optional breaking changes>

<optional footer>
Closes #XXX
Phase X/5 complete: [Tab Name]
```

**Examples**:

```
feat(match-center): optimize PlayersTab

- Colocated data fetching (eliminate props drilling)
- Added loading skeleton and pagination
- Fixed type imports (View layer)
- Added advanced filters (status, ranking range)

Closes #123
Phase 1/5 complete: PlayersTab
```

```
fix(match-center): fix critical bugs in UpcomingMatchesTab

- Fixed timezone bug (server-side UTC filtering)
- Fixed hardcoded team names (use team IDs)
- Colocated data fetching
- Added date range filters

BREAKING CHANGE: Requires backend API changes (date filtering endpoint)

Closes #124, #125
Phase 2/5 complete: UpcomingMatchesTab
```

---

## Risk Management

**Risk: Tab-by-Tab Approach Creates Inconsistency**
- **Mitigation**: Establish patterns in Phase 1, document in design.md, reuse in subsequent phases

**Risk: Backend API Changes Break Frontend**
- **Mitigation**: Test in dev environment, coordinate with backend team, use feature flags for gradual rollout

**Risk: Manual Testing Fatigue**
- **Mitigation**: Use detailed checklist in tasks.md, automate critical paths after Phase 3 if patterns established

**Risk: Feature Expansion Scope Creep**
- **Mitigation**: Limit features to 1-2 hours per tab, defer complex features to future proposals

---

## Success Indicators

**Per-Tab Success**:
- All test scenarios pass
- Critical bugs fixed
- 1-2 feature expansions implemented
- Documentation updated
- Regression tests pass

**Overall Success** (End of Phase 5):
- 0 props drilling across all tabs
- <1s load time with large datasets
- Error Boundaries on all tabs
- 100% View layer types
- <100ms perceived latency on mutations
- ARCHITECTURE.md § 5 complete

---

## Quick Reference

**Current Phase**: Phase 0 - MatchCenter.tsx Parent Component
**Next Action**: Start Task 0.1 (Manual Testing & Analysis)
**Documentation**: tasks.md Phase 0
**Estimated Time**: 6-8 hours for Phase 0
**Blocker**: None (can start immediately)

**Files to Update After Phase 0**:
- [ ] design.md (add § Phase 0 findings)
- [ ] proposal.md (mark Phase 0 complete)
- [ ] tasks.md (mark tasks 0.1-0.7 complete, unblock Phase 1)
- [ ] specs/match-center-parent.md (NEW)
- [ ] openspec/ARCHITECTURE.md § 5 (update parent architecture)

**Commit After Phase 0**:
```bash
git add .
git commit -m "refactor(match-center): optimize MatchCenter parent component

- Removed props drilling (data fetching moved to tabs)
- Added Error Boundaries (replace inline error handling)
- Extracted modal management to tabs (reduce coupling)
- Simplified parent: 472 lines → ~150 lines
- Added URL-based tab navigation (?tab=players)

BREAKING CHANGE: Tabs now fetch their own data (no props from parent)

Closes #XXX
Phase 0/5 complete: MatchCenter.tsx Parent"
git push origin optimize-match-center
```

---

## Phase 0 Testing Checklist

Before starting refactoring, complete this analysis:

- [ ] **Tab Navigation**: Measure switch time (<200ms?)
- [ ] **Props Drilling**: Count re-renders on mutation
- [ ] **Refetch Behavior**: Measure dataset size fetched after mutation
- [ ] **Error Handling**: Verify inline error div (no retry)
- [ ] **Modal State**: Check for leaks between tabs
- [ ] **Initial Load**: Measure Time to Interactive
- [ ] **Document All**: Create `findings/parent-component.md`

**Critical Measurements**:
- Re-render count: ___
- Tab switch time: ___ ms
- Initial load time: ___ ms
- Refetch dataset size: ___ KB

Use these baselines to validate improvements after refactoring.
