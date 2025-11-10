# Architecture Refactoring: Query-Based Modal Pattern

**Date:** 2025-11-06
**Status:** Completed
**Impact:** High - Simplifies data flow, improves maintainability

## Problem Statement

After implementing player availability toggle feature, the architecture became overly complex:

1. **Props Drilling**: Parent component fetched data, passed full match objects to modals
2. **Manual Synchronization**: `useEffect` hooks watching for changes and manually syncing state
3. **Complex Cache Updates**: 40+ lines of optimistic update logic with onMutate/onError/onSettled
4. **Tight Coupling**: Modal couldn't update without parent re-rendering and passing new props

**User Feedback:** *"it looks very complicated...just update one player's availability, has to trigger so many places"*

This correctly identified a violation of React Query best practices.

## Solution: Query-Based Architecture

**Core Principle:** Components should query their own data needs, not receive via props.

### Before (Props-Based)

```typescript
// Parent: UpcomingMatchesTab.tsx
const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
const { data: matches } = MatchService.useMatchList();

// Complex synchronization logic
useEffect(() => {
  if (selectedMatch && matches.length > 0) {
    const updated = matches.find(m => m.id === selectedMatch.id);
    if (updated && JSON.stringify(updated) !== JSON.stringify(selectedMatch)) {
      setSelectedMatch(updated);  // Manual sync
    }
  }
}, [matches, selectedMatch]);

<MatchDetailsModal match={selectedMatch} onClose={...} />

// Mutation with complex optimistic updates
const mutation = useMutation({
  onMutate: async ({ matchId, playerId, isAvailable }) => {
    await queryClient.cancelQueries({ queryKey: ['matches'] });
    const previousMatches = queryClient.getQueryData(['matches', 'list']);

    // Manually modify cache structure
    queryClient.setQueryData(['matches', 'list'], (old) => {
      return old.map(match => {
        if (match.id === matchId) {
          const unavailablePlayers = [...match.unavailablePlayers];
          if (isAvailable) {
            const index = unavailablePlayers.indexOf(playerId);
            if (index > -1) unavailablePlayers.splice(index, 1);
          } else {
            if (!unavailablePlayers.includes(playerId)) {
              unavailablePlayers.push(playerId);
            }
          }
          return { ...match, unavailablePlayers };
        }
        return match;
      });
    });

    return { previousMatches };
  },
  onError: (err, variables, context) => {
    if (context?.previousMatches) {
      queryClient.setQueryData(['matches', 'list'], context.previousMatches);
    }
  },
  onSettled: (_, __, variables) => {
    queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
    queryClient.invalidateQueries({ queryKey: ['matches', 'profile', { id: variables.matchId }] });
  },
});
```

**Lines of Code:** ~80 lines (state + useEffect + mutation logic)

### After (Query-Based)

```typescript
// Parent: UpcomingMatchesTab.tsx
const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
// No useEffect needed!

<MatchDetailsModal matchId={selectedMatchId} onClose={...} />

// Modal: MatchDetailsModal.tsx
const { data: match } = MatchService.useMatchProfile(matchId || '');
// Automatically updates when cache changes!

// Simplified mutation
const mutation = useMutation({
  mutationFn: async ({ matchId, playerId, isAvailable }) => {
    return await matchApi.toggleMatchPlayerAvailability(matchId, playerId, isAvailable);
  },
  onSuccess: async (_, variables) => {
    // Use proper query key format
    const queryKey = BaseService.queryKey('matches', 'profile', { id: variables.matchId });

    // Force immediate refetch
    await queryClient.refetchQueries({ queryKey, exact: true });

    // Also invalidate list
    queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
  },
});
```

**Lines of Code:** ~25 lines (state + mutation)

**Reduction:** 55 lines removed (~69% simpler)

## Implementation Details

### Step 1: Update Modal Interface

```typescript
// Before
interface MatchDetailsModalProps {
  match: Match | null;  // Full object
  isOpen: boolean;
  onClose: () => void;
  // ... other props
}

// After
interface MatchDetailsModalProps {
  matchId: string | null;  // Just ID
  isOpen: boolean;
  onClose: () => void;
  // ... other props
}
```

### Step 2: Add Query Hook to Modal

```typescript
// MatchDetailsModal.tsx
export default function MatchDetailsModal({ matchId, isOpen, onClose, ... }) {
  // Query match data directly
  const { data: match, isLoading, isFetching } = MatchService.useMatchProfile(matchId || '');

  // Rest of component uses `match` as before
}
```

### Step 3: Update Parent Components

```typescript
// UpcomingMatchesTab.tsx
const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

const handleViewDetails = (match: Match) => {
  setSelectedMatchId(match.id);  // Store ID only
  setShowMatchDetails(true);
};

<MatchDetailsModal
  matchId={selectedMatchId}
  isOpen={showMatchDetails}
  onClose={() => {
    setShowMatchDetails(false);
    setSelectedMatchId(null);
  }}
  // ... other props
/>
```

### Step 4: Configure Query for Real-Time Updates

```typescript
// matchService.ts
static useMatchProfile(id: string) {
  return useQuery({
    queryKey: BaseService.queryKey('matches', 'profile', { id }),
    queryFn: () => MatchService.getMatchProfile(id),
    enabled: !!id,
    staleTime: 0,  // Always consider stale
    refetchOnMount: 'always',  // Refetch when modal opens
  });
}
```

### Step 5: Simplify Mutation

```typescript
static useTogglePlayerAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, playerId, isAvailable }) => {
      const response = await matchApi.toggleMatchPlayerAvailability(matchId, playerId, isAvailable);
      return response;
    },
    onSuccess: async (_, variables) => {
      // Critical: Use BaseService.queryKey() for consistent format
      const queryKey = BaseService.queryKey('matches', 'profile', { id: variables.matchId });

      // Force immediate refetch
      await queryClient.refetchQueries({ queryKey, exact: true });

      // Also invalidate list
      queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
    },
  });
}
```

## Critical Bug Fix: Query Key Format

**Problem:** Initial implementation failed because query keys didn't match.

```typescript
// Query creates key like this:
BaseService.queryKey('matches', 'profile', { id: '123' })
// Returns: ['matches', 'profile', '{"id":"123"}']  // JSON stringified

// But invalidation tried:
queryClient.refetchQueries({ queryKey: ['matches', 'profile', { id: '123' }] })
// Tries to match: ['matches', 'profile', { id: '123' }]  // Plain object

// These don't match! Refetch silently fails.
```

**Solution:** Always use `BaseService.queryKey()` helper:
```typescript
const queryKey = BaseService.queryKey('matches', 'profile', { id: variables.matchId });
await queryClient.refetchQueries({ queryKey, exact: true });
```

## Benefits

### 1. Automatic Synchronization
- React Query cache invalidation → automatic refetch
- No manual state management needed
- Component always has latest data

### 2. Simpler Code
- Removed 40+ lines of optimistic update logic
- Removed useEffect synchronization
- Single source of truth (query cache)

### 3. Better Performance
- Smaller state footprint (ID vs full object)
- Fewer unnecessary re-renders
- React Query deduplication

### 4. Maintainability
- Clear separation: Parent stores ID, modal queries data
- Easier to debug (follow React Query DevTools)
- Standard pattern for all modals

### 5. Scalability
- Easy to add more modals with same pattern
- No prop drilling through multiple levels
- Each component queries exactly what it needs

## Trade-offs

### Slightly More Network Requests
- **Before:** Data in memory, no refetch on modal open
- **After:** Refetch on modal open (configurable with staleTime)

**Mitigation:**
- React Query cache prevents redundant requests
- `staleTime` can be adjusted based on data volatility
- For this feature, real-time data is desired (staleTime: 0)

### Component Must Be Mounted to Query
- **Consideration:** Query only runs when modal is open (matchId != null)
- **Non-issue:** This is desired behavior - no data fetching when modal closed

## Lessons Learned

1. **Pass IDs, Not Objects**: Simplifies state management and reduces coupling
2. **Let Components Query**: React Query works best when components fetch their own data
3. **Query Key Consistency**: Always use helper functions for query keys
4. **Avoid Premature Optimization**: Optimistic updates add complexity, only use when UX demands it
5. **Listen to User Feedback**: "Too complicated" is a valid architectural concern

## Applicability

This pattern applies to:
- ✅ Modals that display server data
- ✅ Detail views that need real-time updates
- ✅ Components that might be reused in different contexts
- ✅ Situations where data changes frequently

This pattern may not apply to:
- ❌ Pure UI modals (no server data)
- ❌ Modals with complex derived state from multiple queries
- ❌ Cases where optimistic updates are critical for UX (e.g., drag-and-drop)

## Migration Guide

To convert existing prop-based modals to query-based:

1. Change modal props from `data: T | null` to `dataId: string | null`
2. Add query hook in modal: `const { data } = Service.useQueryHook(dataId)`
3. Update parent to store ID: `const [selectedId, setSelectedId] = useState<string | null>(null)`
4. Remove useEffect synchronization logic
5. Simplify mutations: remove optimistic updates, just invalidate/refetch
6. Test real-time updates work as expected

## References

- React Query Best Practices: https://tkdodo.eu/blog/react-query-render-optimizations
- Query Keys Documentation: https://tanstack.com/query/latest/docs/react/guides/query-keys
- Implementation PR: [Link to PR when available]
- Related Issue: Player availability real-time updates

## Future Improvements

1. **Error Boundary**: Add error handling for failed queries
2. **Loading States**: Improve skeleton/loading UX in modals
3. **Retry Logic**: Configure retry behavior for network failures
4. **Prefetching**: Prefetch match data on card hover for instant modal open
5. **Pattern Library**: Create reusable modal wrapper with built-in query pattern

---

**Impact Summary:**
- ✅ 55 lines of code removed (69% reduction)
- ✅ Real-time updates working correctly
- ✅ More maintainable architecture
- ✅ React Query best practices followed
- ✅ Pattern documented for future use
