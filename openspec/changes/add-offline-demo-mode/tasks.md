# Implementation Tasks: Add Offline Demo Mode

**Change ID**: `add-offline-demo-mode`
**Total Estimated**: 16-20 hours

---

## Phase 1: Foundation (4-5h)

### 1.1 Storage Adapter Interface (1h)
- [ ] Create `apps/web/app/lib/storage/adapter.ts`
- [ ] Define `StorageAdapter` interface with all CRUD methods
- [ ] Add type imports from `@club/shared-types/api`
- [ ] Document interface contract and responsibilities
- [ ] Add JSDoc comments for each method

### 1.2 Server Adapter (1h)
- [ ] Create `apps/web/app/lib/storage/serverAdapter.ts`
- [ ] Implement `ServerAdapter` class implementing `StorageAdapter`
- [ ] Delegate all methods to existing API clients (authApi, userApi, matchApi, etc.)
- [ ] Ensure zero behavior changes from current implementation
- [ ] Add unit tests for ServerAdapter delegation

### 1.3 Storage Context & Provider (2h)
- [ ] Create `apps/web/app/providers/StorageProvider.tsx`
- [ ] Implement `StorageContext` with mode state
- [ ] Add `switchMode()` function with mode validation
- [ ] Implement mode persistence in localStorage
- [ ] Add online/offline status detection with event listeners
- [ ] Create `useStorage()` hook with error handling
- [ ] Wrap app in StorageProvider in root layout
- [ ] Test provider mounting and context access

### 1.4 Demo Data Seed Preparation (1h)
- [ ] Create `apps/web/app/lib/storage/seedData.json`
- [ ] Extract seed data structure from backend `seedData.ts`
- [ ] Format as JSON with users, matches, teams, players
- [ ] Ensure data matches production schema and types
- [ ] Add TypeScript types for seed data structure
- [ ] Validate seed data against shared types

---

## Phase 2: Local Adapter Implementation (5.5-6.5h)

### 2.1 IndexedDB Setup with Dexie (1h)
- [ ] Install Dexie.js: `pnpm add dexie --filter @club/web`
- [ ] Create `apps/web/app/lib/storage/db.ts`
- [ ] Define `DemoDatabase` class extending Dexie
- [ ] Define tables: users, matches, teams, players
- [ ] Set up indexes for common queries (email, role, date, etc.)
- [ ] Add version management and migration strategy
- [ ] Test database initialization

### 2.2 Local Adapter - Auth Operations (1h)
- [ ] Create `apps/web/app/lib/storage/localAdapter.ts`
- [ ] Implement `LocalAdapter` class with database instance
- [ ] Add `currentUser` state management
- [ ] Implement `login()` - validate against seeded users
- [ ] Implement `verifyToken()` - check current session
- [ ] Implement `logout()` - clear current user
- [ ] Generate mock JWT tokens (base64 encoded JSON)
- [ ] Add token expiration logic
- [ ] Test auth flow

### 2.3 Local Adapter - User CRUD (1.5h)
- [ ] Implement `getUsers()` with pagination
- [ ] Add filtering by role, membershipStatus, isPlayer
- [ ] Add text search on name and email
- [ ] Implement sorting (by name, email, createdAt)
- [ ] Implement `createUser()` with ID generation
- [ ] Implement `updateUser()` with validation
- [ ] Implement `deleteUser()` with cascade logic
- [ ] Test all user operations

### 2.4 Local Adapter - Match CRUD (1.5h)
- [ ] Implement `getMatches()` with pagination
- [ ] Add filtering by date range, opponent, status
- [ ] Add sorting by date, opponent
- [ ] Implement `createMatch()` with validation
- [ ] Implement `updateMatch()` with lineup validation
- [ ] Implement `deleteMatch()`
- [ ] Handle player availability updates
- [ ] Test match operations

### 2.5 Local Adapter - Team & Player Operations (1h)
- [ ] Implement `getTeams()` with roster computation
- [ ] Implement `createTeam()`, `updateTeam()`, `deleteTeam()`
- [ ] Implement `getPlayers()` with team filtering
- [ ] Implement `updatePlayer()` with team sync
- [ ] Handle player-team relationship consistency
- [ ] Test team/player operations

### 2.6 Data Seeding Method (0.5h)
- [ ] Add `seedData()` method to LocalAdapter
- [ ] Load seed data from JSON file
- [ ] Insert users, teams, players, matches into IndexedDB
- [ ] Handle seed errors gracefully
- [ ] Add reset functionality to clear and reseed

### 2.7 Data Management Methods (0.5h)
- [ ] Add `clearAllData()` method to LocalAdapter
- [ ] Add `getStorageSize()` method for storage info
- [ ] Add `checkStorageQuota()` method for quota monitoring
- [ ] Add `exportData()` method (optional - JSON export)
- [ ] Add `importData()` method (optional - JSON import)
- [ ] Test all data management operations

---

## Phase 3: Service Layer Integration (3-4h)

### 3.1 Update AuthService (0.5h)
- [ ] Inject `useStorage()` hook
- [ ] Replace `authApi` calls with `adapter.method()`
- [ ] Update query keys to include mode
- [ ] Test login/logout in both modes
- [ ] Verify token management works

### 3.2 Update UserService (1h)
- [ ] Inject `useStorage()` in all hooks
- [ ] Replace `userApi` calls with `adapter` calls
- [ ] Update query keys: `['users', 'list', params, mode]`
- [ ] Update mutation hooks (create, update, delete)
- [ ] Test CRUD operations in both modes
- [ ] Verify cache invalidation works

### 3.3 Update MatchService (1h)
- [ ] Inject `useStorage()` in all hooks
- [ ] Replace `matchApi` calls with `adapter` calls
- [ ] Update query keys to include mode
- [ ] Update mutations for match operations
- [ ] Test match center in demo mode
- [ ] Verify player availability updates

### 3.4 Update TeamService & PlayerService (0.5h)
- [ ] Update TeamService hooks with adapter
- [ ] Update PlayerService hooks with adapter
- [ ] Test team management in demo mode
- [ ] Verify player-team sync

### 3.5 Component Updates (1h)
- [ ] Verify all components work with updated services
- [ ] Test MemberCenter in demo mode
- [ ] Test MatchCenter in demo mode
- [ ] Test team management in demo mode
- [ ] Fix any UI issues specific to demo mode

---

## Phase 4: UI & User Experience (3-4h)

### 4.1 Demo Mode Banner Component (1h)
- [ ] Create `apps/web/app/components/DemoModeBanner.tsx`
- [ ] Show active mode indicator
- [ ] Add mode switching button
- [ ] Add online/offline status indicator
- [ ] Style with appropriate colors (amber for demo)
- [ ] Add animations and transitions
- [ ] Test banner in both modes

### 4.2 Enhanced Loading Component (1h)
- [ ] Update `DashboardLoading` component
- [ ] Add 10-second timer for demo prompt
- [ ] Show "Try Demo Mode" dialog after timeout
- [ ] Add mode switching handler
- [ ] Show appropriate messages for each scenario
- [ ] Style dialog with clear CTAs
- [ ] Test loading states and transitions

### 4.3 Mode Indicators Throughout UI (0.5h)
- [ ] Add subtle indicators in dashboard header
- [ ] Add tooltip explaining current mode
- [ ] Show data source in footer (optional)
- [ ] Add mode badge to user menu (optional)

### 4.4 Data Management UI Component (1h)
- [ ] Create `DataManagement.tsx` component
- [ ] Show storage size and usage info
- [ ] Add "Clear All Data" button with confirmation
- [ ] Add "Reset to Defaults" button with confirmation
- [ ] Add export/import buttons (optional features)
- [ ] Handle loading and error states
- [ ] Show success/error toasts
- [ ] Integrate in account/settings page
- [ ] Test all data management operations

### 4.5 Environment Flag Integration (0.5h)
- [ ] Add `NEXT_PUBLIC_ENABLE_LOCAL_MODE` to .env.example
- [ ] Conditionally show local mode in StorageModeSelector
- [ ] Handle when flag is false (server-only mode)
- [ ] Add flag documentation
- [ ] Test with flag enabled and disabled

---

## Phase 5: Testing & Documentation (2-3h)

### 5.1 Unit Tests (1h)
- [ ] Test ServerAdapter delegates correctly
- [ ] Test LocalAdapter CRUD operations
- [ ] Test LocalAdapter pagination and filtering
- [ ] Test mode switching logic
- [ ] Test data persistence after refresh
- [ ] Test seed data loading
- [ ] Achieve >80% coverage for new code

### 5.2 Integration Tests (1h)
- [ ] Test complete user workflows in demo mode
  - [ ] Login with demo credentials
  - [ ] Navigate dashboard pages
  - [ ] Create/update/delete users
  - [ ] Create/update matches
  - [ ] Manage teams
- [ ] Test mode switching during active session
- [ ] Test offline scenario (network disabled)
- [ ] Test data persistence across tab reloads
- [ ] Test concurrent tabs with same demo data

### 5.3 Manual QA Checklist (0.5h)
- [ ] Verify demo mode loads instantly (<1s)
- [ ] Verify all dashboard features work offline
- [ ] Test with Chrome DevTools network throttling
- [ ] Test with various browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile devices
- [ ] Verify mode indicators are clear
- [ ] Test mode switching multiple times
- [ ] Verify no console errors in either mode

### 5.4 Documentation (0.5h)
- [ ] Update README with demo mode section
- [ ] Add "Try Demo Mode" badge/link
- [ ] Document mode switching for users
- [ ] Add developer notes for testing with demo mode
- [ ] Update deployment guide with demo mode features
- [ ] Add troubleshooting section for IndexedDB issues

---

## Phase 6: Deployment & Monitoring (1h)

### 6.1 Feature Flag Setup (0.25h)
- [ ] Add `NEXT_PUBLIC_ENABLE_DEMO_MODE` env var
- [ ] Conditionally render demo mode UI
- [ ] Test flag in development
- [ ] Document flag in deployment guide

### 6.2 Vercel Preview Deployment (0.25h)
- [ ] Push feature branch
- [ ] Review Vercel preview build
- [ ] Test demo mode on preview
- [ ] Test server mode still works
- [ ] Verify no build errors

### 6.3 Production Deployment (0.25h)
- [ ] Merge to main after approval
- [ ] Monitor Vercel deployment
- [ ] Test production site immediately after deploy
- [ ] Verify both modes work
- [ ] Check error monitoring dashboard

### 6.4 Post-Deploy Validation (0.25h)
- [ ] Test from multiple devices/networks
- [ ] Verify IndexedDB permissions work
- [ ] Monitor for any errors in logs
- [ ] Gather initial user feedback
- [ ] Document any issues found

---

## Rollback Plan

If issues arise:
- [ ] Set `NEXT_PUBLIC_ENABLE_DEMO_MODE=false` in Vercel
- [ ] Redeploy without changes
- [ ] Server mode continues working
- [ ] Investigate and fix issues
- [ ] Re-enable after fixes

---

## Optional Enhancements (Future)

### Nice-to-Have Features
- [ ] Export demo data as JSON
- [ ] Import custom demo data
- [ ] Reset demo data button
- [ ] Mode preference sync across browser tabs
- [ ] Analytics tracking mode usage
- [ ] Demo data size indicator
- [ ] Clear IndexedDB from UI

### Phase 2 Features (Sync Capability)
- [ ] Detect when server becomes available
- [ ] Offer to sync local changes to server
- [ ] Implement conflict resolution UI
- [ ] Background sync API integration

### Phase 3 Features (PWA)
- [ ] Add service worker
- [ ] Cache static assets offline
- [ ] Add install prompt
- [ ] Push notifications support
- [ ] App manifest

---

## Progress Tracking

**Phase 1**: ☐ Not Started
**Phase 2**: ☐ Not Started
**Phase 3**: ☐ Not Started
**Phase 4**: ☐ Not Started
**Phase 5**: ☐ Not Started
**Phase 6**: ☐ Not Started

**Total Tasks**: 0 / 95 completed
**Estimated Completion**: 18-22 hours
**Actual Time**: TBD
