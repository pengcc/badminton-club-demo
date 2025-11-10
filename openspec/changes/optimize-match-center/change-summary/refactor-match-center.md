refactor(match-center): Phase 0 - optimize parent component architecture

BREAKING CHANGE: MatchCenter parent no longer manages data fetching or passes props to tabs.
Each tab is now self-contained and fetches its own data.

## Summary
- **Code Reduction**: 472 → 149 lines (68% reduction, 323 lines removed)
- **Props Drilling**: Eliminated all 28 props passed from parent to tabs
- **Error Handling**: Added ErrorBoundary component for graceful error recovery
- **Architecture**: Parent is now simple orchestrator, tabs are self-contained
- **i18n**: Added translations for EN/DE/ZH languages

## Changes

### Parent Component (MatchCenter.tsx)
- Removed all data fetching (useTeamList, usePlayerList, useMatchList)
- Removed all mutation handlers (7 handlers deleted)
- Removed all modal state management (7 modal states deleted)
- Removed search/filter state (moved to individual tabs)
- Added ErrorBoundary wrapper for tab content
- Simplified to tab navigation + lazy loading only

### Tab Components (All 5 tabs)
- PlayersTab: Added usePlayerList(), useTeamList() hooks
- UpcomingMatchesTab: Added useMatchList(), useAuth() hooks + modals
- MatchHistoryTab: Added useMatchList(), useTeamList(), usePlayerList() hooks + modals
- MatchManagementTab: Added useMatchList(), useTeamList(), usePlayerList() hooks + modals + delete mutation
- TeamManagementTab: Added useTeamList(), usePlayerList() hooks + delete mutation

### New Components
- ErrorBoundary.tsx: Class component with error recovery and fallback UI

### i18n
- Added matchCenter.title and matchCenter.tabs.* keys to en/de/zh dashboard.json

### Tests
- Updated MatchCenter.test.tsx for refactored architecture
- 5 tests passing: basic rendering, tab navigation, admin access control

## Performance Impact
- ✅ Reduced parent component complexity (323 lines removed)
- ✅ Eliminated unnecessary re-renders from props drilling
- ✅ React Query handles cache updates automatically (no manual refetch needed)
- ✅ Each tab only fetches data when active (lazy loading + lazy data fetching)

## Technical Debt Addressed
- ❌ FIXED: Props drilling causing unnecessary re-renders
- ❌ FIXED: Manual refetch calls (React Query handles this)
- ❌ FIXED: Parent managing tab-specific state
- ❌ FIXED: Inline error handling in lazy() imports
- ✅ IMPROVED: Error recovery with ErrorBoundary

## Files Changed
- apps/web/app/components/Dashboard/MatchCenter.tsx (472→149 lines)
- apps/web/app/components/Dashboard/matchTabs/PlayersTab.tsx
- apps/web/app/components/Dashboard/matchTabs/UpcomingMatchesTab.tsx
- apps/web/app/components/Dashboard/matchTabs/MatchHistoryTab.tsx
- apps/web/app/components/Dashboard/matchTabs/MatchManagementTab.tsx
- apps/web/app/components/Dashboard/matchTabs/TeamManagementTab.tsx
- apps/web/app/components/ErrorBoundary.tsx (new, 93 lines)
- apps/web/app/components/Dashboard/__tests__/MatchCenter.test.tsx
- apps/web/messages/en/dashboard.json
- apps/web/messages/de/dashboard.json
- apps/web/messages/zh/dashboard.json

## Next Steps
Phase 0 (Parent) complete ✅
- Phase 1: Optimize PlayersTab
- Phase 2: Optimize UpcomingMatchesTab
- Phase 3: Optimize MatchHistoryTab
- Phase 4: Optimize MatchManagementTab
- Phase 5: Optimize TeamManagementTab

Refs: #optimize-match-center