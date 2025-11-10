# Manual Testing Findings - Phase 2: Match Tabs

**Date**: 2025-11-05
**Tester**: User
**Scope**: Upcoming Match, Match History, Match Management tabs
**Status**: Issues Identified - Awaiting Solution Proposals

---

## Executive Summary

Manual testing of the three match-related tabs (Upcoming Match, Match History, Match Management) revealed **7 critical and high-priority issues** across UI/UX, functionality, and data management categories. Issues range from modal blocking problems to missing core features like automatic match status updates and cancellation reasons.

**Issue Breakdown**:
- 🔴 **Critical (3)**: Modal blocking, Edit match failure, Delete match failure
- 🟡 **High (3)**: Missing translations, Auto-complete status feature, Cancellation descriptions
- 🟢 **Medium (1)**: Smart lineup filtering enhancement

**Recommended Approach**: Address issues in priority order with thorough analysis of current implementation before proposing solutions.

---

## Issue #1: Modal Blocking Problem 🔴 CRITICAL

**Category**: UI/UX - Interaction Blocking
**Severity**: Critical
**Affected Components**:
- MatchDetailsModal
- ScheduleMatchModal
- MatchLineupModal
- EditMatchModal

**Description**:
All match-related modals exhibit blocking behavior preventing normal user interaction. Users cannot dismiss modals or interact with page content behind modals.

**Symptoms**:
- Modal does not close when clicking outside modal area
- ESC key does not dismiss modal
- Background content remains interactive (scroll/click bleeding through)
- Multiple modals can stack causing z-index issues

**Reproduction Steps**:
1. Open any match modal (Details, Schedule, Lineup, or Edit)
2. Click outside the modal boundaries
3. **Expected**: Modal closes
4. **Actual**: Modal remains open, no close action

**Root Cause Analysis Needed**:
- [ ] Check Modal component `onClose` prop wiring
- [ ] Verify backdrop click handlers in each modal
- [ ] Check z-index layering and pointer-events
- [ ] Review Headless UI Dialog implementation (if used)
- [ ] Test keyboard event handlers (ESC key)

**Impact**:
- **User Experience**: Frustrating, users feel trapped
- **Accessibility**: Keyboard navigation broken
- **Mobile**: No way to dismiss on touch devices without close button

**Files to Review**:
```
apps/web/app/components/Dashboard/modals/MatchDetailsModal.tsx
apps/web/app/components/Dashboard/modals/ScheduleMatchModal.tsx
apps/web/app/components/Dashboard/modals/MatchLineupModal.tsx
apps/web/app/components/Dashboard/modals/EditMatchModal.tsx
apps/web/app/components/ui/modal.tsx (Base Modal component)
```

**Proposed Investigation**:
1. Review base Modal component implementation
2. Check each match modal's props: `isOpen`, `onClose`, backdrop handlers
3. Verify Headless UI Dialog patterns if used
4. Test fix across all 4 modals
5. Add regression test to prevent future breaks

**Priority**: 🔴 **CRITICAL** - Must fix before any other modal-related work

---

## Issue #2: Missing Translations 🟡 HIGH

**Category**: I18n/Localization
**Severity**: High
**Affected Components**: Match-related UI elements across all 3 tabs

**Description**:
Hardcoded English strings found in match components, breaking i18n support for German (de) and Chinese (zh) languages.

**Missing Translation Keys** (Preliminary - needs full audit):
```typescript
// Match Status Labels
"Scheduled"
"In Progress"
"Completed"
"Cancelled"

// Match Actions
"Schedule New Match"
"Edit Match"
"Delete Match"
"View Details"
"Manage Lineup"

// Match Details
"Home Team"
"Away Team"
"Date"
"Time"
"Location"
"Status"
"Score"

// Match Lineup
"Men's Singles 1"
"Men's Singles 2"
"Men's Singles 3"
"Men's Doubles 1"
"Men's Doubles 2"
"Women's Singles"
"Women's Doubles"
"Mixed Doubles 1"
"Mixed Doubles 2"

// Error/Success Messages
"Match created successfully"
"Match updated successfully"
"Match deleted successfully"
"Failed to load match details"
"No matches found"
```

**Root Cause**:
- Components use literal strings instead of `useTranslations()` hook
- No translation keys defined in `messages/{en,de,zh}/` structure

**Impact**:
- **German users**: See English text
- **Chinese users**: See English text
- **Consistency**: Breaks app-wide i18n pattern

**Files to Review**:
```
apps/web/app/components/Dashboard/matchTabs/UpcomingMatchesTab.tsx
apps/web/app/components/Dashboard/matchTabs/MatchHistoryTab.tsx
apps/web/app/components/Dashboard/matchTabs/MatchManagementTab.tsx
apps/web/app/components/Dashboard/modals/MatchDetailsModal.tsx
apps/web/app/components/Dashboard/modals/ScheduleMatchModal.tsx
apps/web/app/components/Dashboard/modals/MatchLineupModal.tsx
apps/web/app/components/Dashboard/modals/EditMatchModal.tsx
apps/web/messages/config.ts
apps/web/messages/{en,de,zh}/match.json (create if missing)
```

**Investigation Tasks**:
1. **Audit**: Search all match components for hardcoded strings
2. **Catalog**: List all unique strings needing translation
3. **Structure**: Decide translation key hierarchy (e.g., `match.status.scheduled`)
4. **Messages**: Create translation files for en/de/zh
5. **Implementation**: Replace strings with `t('match.key')` calls

**Priority**: 🟡 **HIGH** - Required for production deployment

---

## Issue #3: Edit Match Not Working Properly 🔴 CRITICAL

**Category**: Functionality - Data Mutation
**Severity**: Critical
**Affected Component**: EditMatchModal
**Related Issue**: #1 (Modal blocking may mask this)

**Description**:
EditMatchModal fails to update match properties. Changes submitted in the form do not persist to the database or reflect in the UI after modal closes.

**Symptoms**:
- Form submits without error message
- Modal closes (or stays open - related to Issue #1)
- Match data unchanged in list view
- Network tab shows no PUT/PATCH request (or request fails silently)

**Reproduction Steps**:
1. Open a match card → "Edit Match"
2. Change any field (date, time, location, status)
3. Click "Save" or "Update Match"
4. Close modal
5. **Expected**: Match card reflects new values
6. **Actual**: Match card shows original values

**Root Cause Analysis Needed**:
- [ ] Check if `updateMatch` mutation is called
- [ ] Verify API endpoint: `PATCH /api/matches/:id`
- [ ] Check request payload structure (matches API expectations?)
- [ ] Verify response handling (success/error)
- [ ] Check React Query cache invalidation
- [ ] Review form validation (blocks submission silently?)

**Potential Causes**:
1. **Form not submitting**: Missing `onSubmit` handler or event.preventDefault()
2. **API call failing**: Wrong endpoint, malformed payload, or backend error
3. **Cache not invalidating**: React Query not refetching after mutation
4. **Optimistic update reverting**: UI updates then reverts due to failed mutation
5. **Modal blocking**: Related to Issue #1, submission handler not firing

**Files to Review**:
```
apps/web/app/components/Dashboard/modals/EditMatchModal.tsx
apps/web/app/services/match-service.ts (updateMatch hook)
apps/api/src/controllers/matchController.ts (updateMatch endpoint)
apps/api/src/services/matchService.ts (update logic)
```

**Investigation Steps**:
1. Add console.log in form onSubmit
2. Check Network tab for PATCH request
3. Inspect request/response payloads
4. Review React Query DevTools (mutation status)
5. Test API endpoint directly (Postman/curl)

**Priority**: 🔴 **CRITICAL** - Core functionality broken

---

## Issue #4: Auto-Complete Match Status Feature 🟡 HIGH

**Category**: Feature Request - Business Logic
**Severity**: High (Missing feature, not a bug)
**Affected Component**: Match status management system

**Description**:
Request to automatically transition match status from `SCHEDULED` → `COMPLETED` when the current date passes the match date. Currently requires manual status update by admin.

**Current Behavior**:
- Match status set to `SCHEDULED` when created
- Status remains `SCHEDULED` even after match date passes
- Admin must manually change status to `COMPLETED`
- Upcoming Matches tab shows past matches still scheduled

**Desired Behavior**:
- Match status automatically becomes `COMPLETED` when `Date.now() > match.date + 24h`
- Upcoming Matches tab filters out auto-completed matches
- Match History tab includes auto-completed matches
- Manual override still possible (admin can change to `CANCELLED`)

**Design Considerations**:

### Option 1: Client-Side Display Logic (Simple, No Breaking Changes)
**Approach**: Compute effective status at display time
```typescript
// In match card component
const effectiveStatus = match.status === 'scheduled' && isPast(match.date)
  ? 'completed'
  : match.status;
```

**Pros**:
- ✅ Zero backend changes
- ✅ No database migration
- ✅ Easy to implement (2-3 files)
- ✅ No API breaking changes

**Cons**:
- ❌ Status not persisted (always computed)
- ❌ API still returns 'scheduled' for past matches
- ❌ Filters/sorts based on stored status
- ❌ No audit trail of transition

### Option 2: Scheduled Job (Robust, Production-Ready)
**Approach**: Cron job updates status daily
```typescript
// Run at 1 AM daily
const job = cron.schedule('0 1 * * *', async () => {
  await Match.updateMany(
    { status: 'scheduled', date: { $lt: new Date() } },
    { status: 'completed' }
  );
});
```

**Pros**:
- ✅ Status persisted in database
- ✅ Audit trail via updatedAt
- ✅ Consistent across all clients
- ✅ Works with existing filters/sorts

**Cons**:
- ❌ Requires cron infrastructure (node-cron or external)
- ❌ Adds system complexity
- ❌ Delayed update (up to 24h lag)

### Option 3: Lazy Update on Read (Hybrid)
**Approach**: Update status when match is fetched
```typescript
// In matchService.getMatches()
matches.forEach(match => {
  if (match.status === 'scheduled' && isPast(match.date)) {
    match.status = 'completed';
    match.save(); // Persist to DB
  }
});
```

**Pros**:
- ✅ No cron jobs needed
- ✅ Status eventually persisted
- ✅ Works with existing infrastructure

**Cons**:
- ❌ Inconsistent (depends on reads)
- ❌ Extra DB writes on read path
- ❌ Race conditions possible

### Option 4: Middleware Hook (Event-Driven)
**Approach**: Mongoose pre-find middleware
```typescript
matchSchema.pre(/^find/, function() {
  // Update expired matches before query
  Match.updateMany(
    { status: 'scheduled', date: { $lt: new Date() } },
    { status: 'completed' }
  );
});
```

**Pros**:
- ✅ Automatic on every query
- ✅ No client-side changes
- ✅ Status always current

**Cons**:
- ❌ Performance impact (extra query every time)
- ❌ Can't opt-out for specific queries

**Recommended Approach**: **Option 1 (Client-Side) + Scheduled Job (Option 2) - Phased Implementation**

**Phase 1** (Immediate):
- Implement client-side display logic
- Filter past matches from Upcoming tab
- Show in History tab

**Phase 2** (v1.1):
- Add scheduled job for persistence
- Migrate to stored status
- Remove computed logic

**Why**:
- Quick win, no backend changes
- Safe, no breaking changes
- Can iterate to full solution later

**Priority**: 🟡 **HIGH** - Needed for production UX

---

## Issue #5: Cancelled Match Description Feature 🟡 HIGH

**Category**: Feature Enhancement
**Severity**: High (Missing feature)
**Affected Component**: Match cards, MatchDetailsModal

**Description**:
When a match is marked `CANCELLED`, there's no way to add/view the cancellation reason or rescheduling information. Users see status badge only, no context.

**Current Behavior**:
- Admin changes match status to `CANCELLED`
- Match card shows "Cancelled" badge
- No explanation visible
- Users confused why match cancelled

**Desired Behavior**:
- When status set to `CANCELLED`, prompt for cancellation reason
- Display reason on match card (truncated)
- Show full reason in MatchDetailsModal
- Support rescheduling info: "Cancelled - Rescheduled to Dec 15"

**Design Considerations**:

### Data Model Changes

**Option A: Add `cancellationReason` field to Match**
```typescript
// Domain Match type
export interface MatchCore {
  id: string;
  date: Date;
  status: MatchStatus;
  cancellationReason?: string; // NEW: Optional text field
  // ... other fields
}
```

**Pros**:
- ✅ Simple, explicit field
- ✅ Easy to query/filter
- ✅ Clear schema

**Cons**:
- ❌ Field exists even when not cancelled
- ❌ No structure for rescheduling info

**Option B: Add `metadata` object with cancellation sub-object**
```typescript
export interface MatchCore {
  id: string;
  date: Date;
  status: MatchStatus;
  metadata?: {
    cancellation?: {
      reason: string;
      rescheduledDate?: Date;
      cancelledBy: string; // User ID
      cancelledAt: Date;
    };
  };
  // ... other fields
}
```

**Pros**:
- ✅ Structured data for complex scenarios
- ✅ Audit trail (who/when cancelled)
- ✅ Extensible for other metadata

**Cons**:
- ❌ More complex schema
- ❌ Nested object handling

**Recommended**: **Option A** (Simple field) - Start simple, can refactor to Option B later if needed.

### UI/UX Changes

**Match Card Display**:
```tsx
{match.status === 'cancelled' && match.cancellationReason && (
  <p className="text-sm text-gray-600 mt-1 truncate">
    {match.cancellationReason}
  </p>
)}
```

**EditMatchModal Enhancement**:
- When status changed to `CANCELLED`, show textarea: "Reason for cancellation (optional)"
- Validate: Max 200 characters
- Show character counter

**MatchDetailsModal**:
- Add "Cancellation Details" section when status is `CANCELLED`
- Show full reason (no truncation)
- Show cancellation timestamp (from `updatedAt`)

### Implementation Steps

1. **Backend**:
   - Add `cancellationReason?: string` to Match model
   - Update `UpdateMatchRequest` API type
   - Update `updateMatch` controller to accept new field
   - Add validation: Max 500 chars, optional

2. **Frontend**:
   - Update EditMatchModal form:
     - Watch status field
     - Show reason textarea when status === 'cancelled'
     - Include in form payload
   - Update match cards (Upcoming, History):
     - Display truncated reason below status badge
   - Update MatchDetailsModal:
     - Add cancellation section

3. **Types**:
   - Update `Domain.MatchCore` in `shared/types/src/domain/match.ts`
   - Update `Api.UpdateMatchRequest` in `shared/types/src/api/match.ts`
   - Update `View.MatchCard` (no changes needed, uses MatchDisplay)

**Migration**: Not required (optional field, backwards compatible)

**Priority**: 🟡 **HIGH** - Improves user communication

---

## Issue #6: Delete Match Not Working 🔴 CRITICAL

**Category**: Functionality - Data Mutation
**Severity**: Critical
**Affected Component**: MatchManagementTab delete action

**Description**:
Delete match functionality fails silently or with error. Matches remain in database and UI after delete action.

**Symptoms**:
- Click "Delete" button on match card
- Confirmation dialog appears (or doesn't)
- After confirming, match still visible
- Network tab shows no DELETE request (or request fails)
- No error toast/message displayed

**Reproduction Steps**:
1. Navigate to Match Management tab (Admin only)
2. Find a match card → Click "Delete" or trash icon
3. Confirm deletion in dialog (if appears)
4. **Expected**: Match removed from list, success toast
5. **Actual**: Match remains, no feedback

**Root Cause Analysis Needed**:
- [ ] Check if delete button handler is wired
- [ ] Verify confirmation dialog integration
- [ ] Check API call: `DELETE /api/matches/:id`
- [ ] Verify backend endpoint exists and works
- [ ] Check React Query cache invalidation
- [ ] Review error handling (silent failure?)

**Potential Causes**:
1. **Button handler missing**: onClick not calling delete mutation
2. **API endpoint not implemented**: Backend returns 404/405
3. **Authorization failure**: User lacks permission (admin check)
4. **Database constraint**: Foreign key preventing deletion (matches in lineup?)
5. **Cache not updating**: Mutation succeeds but UI doesn't reflect

**Files to Review**:
```
apps/web/app/components/Dashboard/matchTabs/MatchManagementTab.tsx
apps/web/app/services/match-service.ts (deleteMatch hook)
apps/api/src/controllers/matchController.ts (deleteMatch endpoint)
apps/api/src/services/matchService.ts (delete logic)
apps/api/src/routes/match.ts (DELETE route registration)
```

**Investigation Steps**:
1. Add console.log in delete button onClick
2. Check Network tab for DELETE request
3. Test API endpoint directly: `curl -X DELETE /api/matches/:id`
4. Check backend logs for errors
5. Review database for cascading delete rules

**Priority**: 🔴 **CRITICAL** - Core admin functionality broken

---

## Issue #7: Lineup Modal Issues 🔴 CRITICAL + 🟢 MEDIUM

**Category**: Functionality + UI/UX
**Severity**: Critical (Save failure) + Medium (UI improvements)
**Affected Component**: MatchLineupModal

### Issue #7a: Save Lineup Not Working 🔴 CRITICAL

**Severity**: Critical
**Category**: Functionality - Data Mutation

**Description**:
Save lineup button fails to persist player assignments. Changes submitted do not save to database or reflect in UI after modal closes.

**Symptoms**:
- Click "Save Lineup" button
- Modal closes (or stays open)
- Player assignments reverted to previous state
- No error message displayed
- Network tab shows no PUT/PATCH request (or request fails silently)

**Reproduction Steps**:
1. Open match → "Manage Lineup"
2. Assign players to positions (e.g., Men's Singles 1)
3. Click "Save Lineup"
4. Close modal
5. **Expected**: Assignments persist
6. **Actual**: Assignments lost, reverted to empty/previous state

**Root Cause Analysis Needed**:
- [ ] Check if `updateLineup` mutation is called
- [ ] Verify API endpoint: `PATCH /api/matches/:id/lineup`
- [ ] Check request payload structure
- [ ] Verify response handling
- [ ] Check React Query cache invalidation
- [ ] Review form submission handler

**Priority**: 🔴 **CRITICAL** - Core functionality broken

---

### Issue #7b: Modal Scroll Behavior 🟡 HIGH

**Severity**: High
**Category**: UI/UX

**Description**:
Entire modal scrolls when lineup list is long. Modal header/footer should be fixed, only lineup cards container should scroll.

**Current Behavior**:
- Modal content scrollable as one unit
- Header and "Save" button scroll out of view
- Poor UX on mobile with many positions

**Desired Behavior**:
- Modal header fixed at top
- Lineup cards container scrollable (middle section)
- "Save Lineup" button fixed at bottom
- Sticky positioning for better accessibility

**Priority**: 🟡 **HIGH** - Usability issue

---

### Issue #7c: Lineup Card Spacing 🟢 MEDIUM

**Severity**: Medium
**Category**: UI/UX - Visual Polish

**Description**:
Lineup slot cards too spacious, wasting vertical space. Doubles slots take 2 rows unnecessarily.

**Current Issues**:
- Excessive padding on cards
- Doubles player selections stacked vertically
- Mobile viewport shows only 2-3 positions at once
- Requires excessive scrolling

**Desired Improvements**:

**Singles Position Card** (Compact):
```tsx
<div className="p-3 border rounded-lg"> {/* Reduced from p-4/p-6 */}
  <h3 className="text-sm font-medium mb-2">Men's Singles 1</h3>
  <Select>...</Select>
</div>
```

**Doubles Position Card** (Horizontal on Mobile):
```tsx
<div className="p-3 border rounded-lg">
  <h3 className="text-sm font-medium mb-2">Men's Doubles 1</h3>
  <div className="flex gap-2"> {/* Horizontal layout */}
    <Select className="flex-1">Player 1</Select>
    <Select className="flex-1">Player 2</Select>
  </div>
</div>
```

**Benefits**:
- See 5-6 positions on mobile without scrolling
- Doubles cards half the height
- Cleaner, more compact UI
- Better space utilization

**Priority**: 🟢 **MEDIUM** - Visual polish

---

### Issue #7d: Smart Lineup Filtering 🟢 MEDIUM

**Severity**: Medium (Enhancement, not a bug)
**Category**: Feature Enhancement - UX Improvement

**Description**:
Request to implement intelligent filtering of player selection options in lineup modal based on:
1. Team affiliation (only show players from `match.homeTeamId`)
2. Gender requirements per lineup position
3. Player availability (max 2 positions per player)

**Current Behavior**:
- All players shown in selection dropdown regardless of:
  - Team membership
  - Gender
  - Already assigned to other positions
- Users can assign ineligible players
- No validation until save (or no validation at all)

**Desired Behavior**:

### Filter Rule 1: Team Affiliation
```typescript
// Only show players where player.teamIds includes match.homeTeamId
const eligiblePlayers = allPlayers.filter(player =>
  player.teamIds.includes(match.homeTeamId)
);
```

**Rationale**: Players can only play for their own team.

### Filter Rule 2: Gender Requirements
```typescript
// Lineup position gender rules
const positionGenderRules: Record<LineupPosition, PlayerGender[]> = {
  men_singles_1: [PlayerGender.MALE],
  men_singles_2: [PlayerGender.MALE],
  men_singles_3: [PlayerGender.MALE],
  mens_doubles_1: [PlayerGender.MALE],
  mens_doubles_2: [PlayerGender.MALE],
  women_singles: [PlayerGender.FEMALE],
  women_doubles: [PlayerGender.FEMALE],
  mixed_doubles_1: [PlayerGender.MALE, PlayerGender.FEMALE], // Special case
  mixed_doubles_2: [PlayerGender.MALE, PlayerGender.FEMALE]
};

// Filter by gender for position
const genderEligible = eligiblePlayers.filter(player =>
  positionGenderRules[position].includes(player.gender)
);
```

### Filter Rule 3: Availability (Max 2 Positions)
```typescript
// Count how many positions player is already assigned to
const playerAssignments = Object.values(lineup).flat()
  .filter(p => p.id === player.id).length;

const availablePlayers = genderEligible.filter(player => {
  const assigned = countPlayerAssignments(player.id, lineup);
  return assigned < 2;
});
```

### Special Case: Mixed Doubles Filtering

**Challenge**: Mixed doubles requires 1 male + 1 female player. How to filter the second selection based on first?

**Option A: Independent Filtering (Simple)**
```typescript
// Both selections show ALL eligible players (no gender filter)
// Validation on save ensures 1 male + 1 female
const mixedDoublesPlayers = eligiblePlayers.filter(p =>
  countPlayerAssignments(p.id, lineup) < 2
);
```

**Pros**:
- ✅ Simple implementation
- ✅ No complex state management
- ✅ User can change order freely

**Cons**:
- ❌ User can select 2 males or 2 females (caught at validation)
- ❌ Requires error message on save

**Option B: Dynamic Filtering (Smart)**
```typescript
// First selection: No gender filter
const firstPlayerOptions = eligiblePlayers;

// Second selection: Filter based on first player's gender
const secondPlayerOptions = eligiblePlayers.filter(p => {
  if (!firstPlayer) return true; // First not selected yet
  return p.gender !== firstPlayer.gender; // Opposite gender
});
```

**Pros**:
- ✅ Guides user to correct selection
- ✅ Prevents invalid combinations
- ✅ Better UX

**Cons**:
- ❌ More complex state management
- ❌ Depends on selection order (player 1 vs player 2)
- ❌ Changing first selection clears second

**Option C: No Gender Filter + Smart UI (Hybrid)**
```typescript
// Show all eligible players
// But visually indicate incompatible selections
const getPlayerClassName = (player, existingPlayer) => {
  if (!existingPlayer) return 'text-gray-900';
  if (player.gender === existingPlayer.gender) {
    return 'text-gray-400 cursor-not-allowed'; // Gray out same gender
  }
  return 'text-gray-900';
};
```

**Pros**:
- ✅ User sees all options
- ✅ Visual guidance
- ✅ Can still select if needed (override)

**Cons**:
- ❌ Disabled options still visible (clutter)
- ❌ Requires custom select component styling

**Recommended Approach**: **Option B (Dynamic Filtering)** with **Option A fallback**

**Rationale**:
- **Primary**: Use Option B for best UX (smart filtering)
- **Fallback**: If first player not selected, use Option A (no filter)
- **Validation**: Always validate on save as safety net

### Implementation Plan

1. **Create Filter Helper** (`apps/web/app/lib/match-lineup-filters.ts`):
```typescript
export function filterEligiblePlayers(
  allPlayers: Player[],
  match: Match,
  position: LineupPosition,
  currentLineup: Lineup,
  excludePlayerId?: string // For mixed doubles second selection
): Player[] {
  // Rule 1: Team affiliation
  let eligible = allPlayers.filter(p =>
    p.teamIds.includes(match.homeTeamId)
  );

  // Rule 2: Gender (position-specific)
  eligible = filterByGender(eligible, position, excludePlayerId);

  // Rule 3: Max 2 positions
  eligible = eligible.filter(p =>
    countAssignments(p.id, currentLineup) < 2
  );

  return eligible;
}
```

2. **Update MatchLineupModal**:
   - Replace static player list with filtered list
   - Add state for tracking mixed doubles first selection
   - Implement dynamic filtering for second selection
   - Add validation on save

3. **Add Tests**:
   - Unit test: filterEligiblePlayers with various scenarios
   - Integration test: Mixed doubles selection flow

4. **UI Feedback**:
   - Show count: "12 eligible players"
   - If no eligible players: "No players available for this position"
   - Tooltip explaining filter rules

**Files to Modify**:
```
apps/web/app/lib/match-lineup-filters.ts (NEW)
apps/web/app/components/Dashboard/modals/MatchLineupModal.tsx
apps/web/app/components/Dashboard/modals/__tests__/MatchLineupModal.test.tsx (NEW)
```

**Priority**: 🟢 **MEDIUM** - Enhancement, not blocking

---

## Summary of Issues

| # | Issue | Severity | Category | Files Affected | Priority |
|---|-------|----------|----------|----------------|----------|
| 1 | Modal Blocking | 🔴 Critical | UI/UX | 4 modals + base Modal | P0 |
| 2 | Missing Translations | 🟡 High | I18n | 7 components + messages | P1 |
| 3 | Edit Match Failure | 🔴 Critical | Functionality | EditMatchModal + service | P0 |
| 4 | Auto-Complete Status | 🟡 High | Feature | Match status system | P1 |
| 5 | Cancellation Descriptions | 🟡 High | Feature | Match model + 3 components | P1 |
| 6 | Delete Match Failure | 🔴 Critical | Functionality | MatchManagementTab + service | P0 |
| 7a | Save Lineup Failure | 🔴 Critical | Functionality | MatchLineupModal + service | P0 |
| 7b | Modal Scroll Behavior | 🟡 High | UI/UX | MatchLineupModal layout | P1 |
| 7c | Lineup Card Spacing | 🟢 Medium | UI/UX | MatchLineupModal cards | P2 |
| 7d | Smart Lineup Filtering | 🟢 Medium | Enhancement | MatchLineupModal + filters | P2 |

**Recommended Implementation Order**:
1. **P0 Issues** (Critical - 8-14 hours):
   - Issue #1 (Modal Blocking) - Blocks all modal work
   - Issue #3 (Edit Match) - Core functionality
   - Issue #6 (Delete Match) - Core functionality
   - Issue #7a (Save Lineup) - Core functionality

2. **P1 Issues** (High - 14-20 hours):
   - Issue #2 (Translations) - Required for production
   - Issue #7b (Modal Scroll) - Usability blocker
   - Issue #5 (Cancellation) - User communication
   - Issue #4 (Auto-Complete) - Business logic

3. **P2 Issues** (Medium - 6-10 hours):
   - Issue #7c (Card Spacing) - Visual polish
   - Issue #7d (Smart Filtering) - UX enhancement

**Total Estimate**: 28-44 hours (3.5-5.5 days)

---

## Next Steps

1. **Review & Approve**: Review this findings document and proposed solutions
2. **Update Proposal**: Add issues to `proposal.md` as new requirements
3. **Update Design**: Document technical decisions in `design.md`
4. **Update Tasks**: Break down into actionable tasks in `tasks.md`
5. **Begin Implementation**: Start with P0 issues (Modal Blocking, Edit/Delete/Save failures)

**Estimated Implementation Time**:
- P0 Issues: 8-14 hours
- P1 Issues: 14-20 hours
- P2 Issues: 6-10 hours
- **Total**: 28-44 hours (3.5-5.5 days)

---

**Document Status**: ✅ Complete - Ready for Review
**Next Action**: Await confirmation on proposed solutions before updating other documentation
