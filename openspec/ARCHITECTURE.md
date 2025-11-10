# Badminton Club App - Architecture Overview

**Status:** Living Document
**Last Updated:** 2025-11-06
**Maintainers:** Development Team

## Recent Updates

### 2025-11-06: Phase 3 - Unidirectional Relationship Model
- **BREAKING CHANGE**: Removed `Team.playerIds` field from database and schema
- Team roster now computed from `Player.teamIds` (single source of truth)
- Simplified PlayerService: No bidirectional sync needed
- Reduced code complexity by ~40% in relationship management
- Added efficient aggregate queries for team roster computation
- Migration script successfully executed with zero data loss

### 2025-11-06: Phase 2 - Event-Driven Auto-Sync
- Implemented transaction-based auto-sync for player-team operations
- `PlayerService.removePlayerFromTeam()`: Automatically cleans matches (unavailablePlayers + lineup)
- `UserService.deletePlayerEntity()`: Cascade delete across all matches
- Removed manual "Sync Roster" endpoint and UI button
- Added fallback for standalone MongoDB (local dev without replica set)

### 2025-11-06: Player Availability & Architecture Refactoring
- Added Player Availability Management feature documentation
- Documented query-based modal architecture pattern
- Updated Backend Security & Authorization section with access control matrix
- Changed member access: Players list and Matches list now accessible to MEMBER_ROLES
- New API endpoint: `PATCH /api/matches/:id/availability/:playerId` (MEMBER_ROLES)
- Documented React Query cache synchronization patterns

### 2025-11-05: Type System & Computed Properties
- Added comprehensive Type System Architecture documentation
- Documented Computed Properties Pattern with examples
- Updated Data Flow Patterns with complete request/response flows

## Table of Contents
1. [System Overview](#system-overview)
2. [Type System Architecture](#type-system-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Data Flow Patterns](#data-flow-patterns)
6. [Computed Properties Pattern](#computed-properties-pattern)
7. [Key Design Principles](#key-design-principles)
8. [Feature Modules](#feature-modules)
9. [Development Guidelines](#development-guidelines)

---

## System Overview

### Purpose
Full-stack web application for badminton club operations management:
- Member registration & management (admin-controlled approval workflow)
- Player profiles with team affiliations & skill tracking
- Match scheduling with lineup management
- Training session coordination
- Multi-language CMS for club homepage
- PDF generation for membership applications

### Tech Stack
**Frontend:**
- Next.js 15 (App Router, React Server Components)
- TypeScript (strict mode)
- Tailwind CSS + shadcn/ui
- next-intl (i18n: de/en/zh)
- TanStack Query (data fetching/caching)

**Backend:**
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- JWT authentication
- RESTful API

**Monorepo:**
- pnpm workspace
- `apps/api/` - Backend service
- `apps/web/` - Frontend Next.js app
- `shared/types/` - Shared TypeScript types

---

## Type System Architecture

### Layered Type System (4 Layers + View)

The type system uses **strict layer separation** with transformers bridging between layers. All types live in `shared/types/src/`.

```
┌─────────────────────────────────────────────────────────────────┐
│                         TYPE LAYERS                              │
└─────────────────────────────────────────────────────────────────┘

1. Core Layer (core/)
   ├── Base types, enums, errors
   ├── Framework-agnostic primitives
   └── Used by: All layers

2. Domain Layer (domain/)
   ├── Business logic types (Date objects, string IDs)
   ├── Pure TypeScript, no framework dependencies
   └── Used by: Services, business logic

3. Persistence Layer (persistence/)
   ├── MongoDB document structure (ObjectId, timestamps)
   ├── Specification for database schema
   └── Used by: Transformers

4. API Layer (api/)
   ├── HTTP request/response types (string IDs, ISO dates)
   ├── JSON-compatible for network transport
   └── Used by: Controllers, frontend API clients

5. View Layer (view/)
   ├── UI display types with computed fields
   ├── Extends API types with badges, formatting, display logic
   └── Used by: Frontend components
```

### Layer Responsibilities

#### 1. Core Layer (`core/`)
```typescript
// core/enums.ts
export enum UserRole { SUPER_ADMIN = 'super admin', ADMIN = 'admin', MEMBER = 'member' }
export enum MembershipStatus { PENDING = 'pending', ACTIVE = 'active', INACTIVE = 'inactive' }
export enum LineupPosition { MEN_SINGLES_1 = 'men_singles_1', ... }

// core/base.ts
export interface BaseEntity { id: string; createdAt: Date; updatedAt: Date; }
export interface BaseDocument { _id: Types.ObjectId; createdAt: Date; updatedAt: Date; }

// core/errors.ts
export class ValidationError extends Error { ... }
export class NotFoundError extends Error { ... }
```

**Rule:** Core types never import from other layers. Used everywhere.

#### 2. Domain Layer (`domain/`)
```typescript
// domain/user.ts
export namespace Domain {
  export interface UserCore {
    id: string;                    // string ID
    email: string;
    name: string;
    role: UserRole;
    membershipStatus: MembershipStatus;
    createdAt: Date;               // Date object
    updatedAt: Date;
  }

  export interface UserRelations {
    playerId?: string;             // Optional player reference
  }

  export type User = UserCore & UserRelations;
}
```

**Rule:** Domain types use `Date` objects and string IDs. Framework-agnostic. Used in services for business logic.

#### 3. Persistence Layer (`persistence/`)
```typescript
// persistence/user.ts
import { Types } from 'mongoose';

export namespace Persistence {
  export interface UserDocument extends Omit<Domain.UserCore, 'id' | 'createdAt' | 'updatedAt'>, BaseDocument {
    playerId?: Types.ObjectId;     // ObjectId instead of string
    // _id, createdAt, updatedAt from BaseDocument
  }
}
```

**Rule:** Persistence types use `Types.ObjectId` for references. Specifies exact MongoDB structure. Used by transformers.

#### 4. API Layer (`api/`)
```typescript
// api/user.ts
export namespace UserApi {
  export interface CreateUserRequest {
    email: string;
    password: string;
    name: string;
    role: UserRole;
    membershipStatus: MembershipStatus;
  }

  export interface UserResponse {
    id: string;                    // string ID (converted from ObjectId)
    email: string;
    name: string;
    role: UserRole;
    membershipStatus: MembershipStatus;
    playerId?: string;             // string ID (converted from ObjectId)
    createdAt: string;             // ISO string (JSON-compatible)
    updatedAt: string;
  }
}
```

**Rule:** API types use string IDs and ISO date strings. JSON-compatible. Used by controllers and frontend.

#### 5. View Layer (`view/`)
```typescript
// view/user.ts
export namespace UserView {
  export interface UserCard extends UserApi.UserResponse {
    // Computed display fields
    displayName: string;           // Formatted name
    statusBadge: { label: string; className: string; };
    roleBadge: { label: string; className: string; };
    avatarUrl?: string;
  }

  export interface UserFormData {
    email: string;
    name: string;
    role: UserRole;
    membershipStatus: MembershipStatus;
    // No password (not shown in edit forms)
  }
}
```

**Rule:** View types extend API types with computed fields. Used by frontend components. Services populate via transformers.

### Transformers (Type Bridges)

Transformers convert between layers. Located in `view/transformers/` and handle all conversions.

```typescript
// view/transformers/user.ts
export class UserViewTransformers {
  // API → View (add computed display fields)
  static toUserCard(apiUser: UserApi.UserResponse): UserView.UserCard {
    return {
      ...apiUser,
      displayName: apiUser.name || apiUser.email,
      statusBadge: this.getStatusBadge(apiUser.membershipStatus),
      roleBadge: this.getRoleBadge(apiUser.role),
      avatarUrl: `/avatars/${apiUser.id}.jpg`
    };
  }

  // View → API (strip computed fields for updates)
  static toUpdateRequest(formData: UserView.UserFormData): UserApi.UpdateUserRequest {
    return {
      name: formData.name,
      role: formData.role,
      membershipStatus: formData.membershipStatus
    };
  }

  private static getStatusBadge(status: MembershipStatus) { ... }
  private static getRoleBadge(role: UserRole) { ... }
}

### Date Handling in MembershipApplication

Decision: Keep `personalInfo.dateOfBirth` as a string (YYYY-MM-DD) across Persistence, Domain, and API layers. Only convert to `Date` objects in View/UI or in dedicated presentation code paths (e.g., PDF service) when needed for formatting or calculations.

Why:
- Mongoose schema validates `YYYY-MM-DD` using a regex; storing and transporting as string avoids premature Date conversions that can break validation.
- API transport remains JSON-friendly with no implicit serialization.
- Domain aligns with persistence to remove back-and-forth transformations and reduce bugs.

Implications:
- Backend services must parse on-demand for calculations: `const birthDate = new Date(dateOfBirth)`.
- Transformers must pass `dateOfBirth` through unchanged; no `new Date()` inside transformers.
- PDF generation formats dates for display using locale-aware formatting after parsing the string.

---

### Validation Strategy: Intentional Duplication

**Decision:** Maintain separate validation logic in frontend and backend layers. This duplication is intentional and serves different purposes.

**Frontend Validation** (`apps/web/app/lib/validation.ts`):
- **Purpose:** Fast UX feedback without network round-trips
- **Behavior:** Progressive disclosure (shows errors as user types/touches fields)
- **Benefits:** Immediate accessibility feedback, custom user-friendly messages
- **Scope:** Client-side convenience, can be bypassed by malicious users

**Backend Validation** (`apps/api/src/models/MembershipApplication.ts`):
- **Purpose:** Security boundary and data integrity enforcement
- **Behavior:** Strict validation on all incoming data
- **Benefits:** Prevents invalid data from reaching database, enforces business rules
- **Scope:** Server-side authority, cannot be bypassed

**Intentionally Duplicated Rules:**
- Email format validation (regex patterns)
- Phone number format validation
- IBAN validation
- Date format and constraints (YYYY-MM-DD, no future dates, minimum age)
- Required field validation

**Maintenance Process:**
1. Update backend schema validation first (security boundary)
2. Update frontend validation to match user experience
3. Update integration tests to verify both layers stay consistent
4. Document any intentional differences (e.g., frontend may be more lenient for partial validation)

**Why Not Share Validation?**
- Frontend needs partial validation (validate fields as user fills form)
- Backend needs complete validation (all-or-nothing for data integrity)
- Frontend may want custom error messages for UX
- Backend error messages focus on security/data integrity
- Tight coupling between frontend and backend would increase complexity
- Runtime validation library overhead not needed on backend (Mongoose handles it)

**Future Consideration:**
If duplication becomes a significant maintenance burden, consider creating a shared validation schema package. See deferred proposal: `consolidate-validation-rules`.

---

### Critical Rules

**❌ NEVER:**
- Define local types in components (Member, Team, LineupSlot, etc.)
- Use `_id` in frontend (always `id` from API layer)
- Mix layer types (e.g., Domain in API responses)
- Add redundant properties to shared types
- Import from Model layer in frontend

**✅ ALWAYS:**
- Import types from `shared/types` View layer in frontend
- Use transformers for layer conversions
- Use `id` (string) in API/View layers, `_id` (ObjectId) in Persistence
- Define form types in View layer (`*FormData`)
- Keep computed fields in View layer only

---

### 6. Player Availability Management
**Feature:** Real-time player availability tracking for upcoming matches
**Status:** Active (Implemented 2025-11-06)
**Components:** `PlayerAvailability.tsx`, `MatchDetailsModal.tsx`
**API:** `PATCH /api/matches/:id/availability/:playerId`

#### Overview

The Player Availability feature allows team members to indicate their availability for specific matches. This enables better lineup planning and team coordination.

#### Architecture Pattern: Query-Based Modal

**Design Decision (2025-11-06):** Refactored from prop-drilling to query-based architecture for better cache synchronization.

**Before (Prop-Based):**
```typescript
// Parent component
const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
const { data: matches } = MatchService.useMatchList();

// Manual synchronization needed
useEffect(() => {
  if (selectedMatch && matches) {
    const updated = matches.find(m => m.id === selectedMatch.id);
    if (updated) setSelectedMatch(updated);  // Manual sync
  }
}, [matches, selectedMatch]);

<MatchDetailsModal match={selectedMatch} />
```

**After (Query-Based):**
```typescript
// Parent component
const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
// No useEffect needed!

<MatchDetailsModal matchId={selectedMatchId} />

// Modal component
const { data: match } = MatchService.useMatchProfile(matchId || '');
// Automatically updates when cache changes!
```

**Benefits:**
- ✅ **Automatic Synchronization**: React Query cache invalidation triggers automatic refetch
- ✅ **Simpler Code**: Removed 40+ lines of complex optimistic updates and manual sync
- ✅ **Better Performance**: Fewer unnecessary re-renders, smaller state footprint
- ✅ **React Query Best Practice**: Components query their own data needs
- ✅ **Maintainable**: Clear separation of concerns, easier to debug

**Trade-off:** Slightly more network requests, but negligible with proper `staleTime` configuration.

#### Component Architecture

**PlayerAvailability Component** (`apps/web/app/components/Dashboard/PlayerAvailability.tsx`)
- **Purpose**: Reusable display of available/unavailable players for a match
- **Features**:
  - Gender breakdown with counts (e.g., "Male: 5, Female: 3")
  - Current player displayed first in both lists
  - Gender icons (Mars/Venus/User) for visual identification
  - Horizontal flowing layout with subtle styling
  - Toggle availability button (visible to match participants)

**Props Interface:**
```typescript
interface PlayerAvailabilityProps {
  match: Match;
  teamPlayers: Player[];
  availabilityMap: Record<string, boolean>;
  currentUserId?: string;
  onToggleAvailability?: (matchId: string, playerId: string, isAvailable: boolean) => Promise<void>;
}
```

**Key Features:**
1. **Gender Counts**: Displays male/female breakdown for both available and unavailable lists
2. **Current Player Priority**: Logged-in player appears first in their respective list
3. **Visual Indicators**: Uses GenderIcon component for consistent gender display
4. **Conditional Actions**: Toggle button only visible to team members in the match

#### API Endpoint

**Route:** `PATCH /api/matches/:id/availability/:playerId`

**Authorization:** `MEMBER_ROLES` (Admin + Member) - All team members can update their availability

**Request:**
```typescript
PATCH /api/matches/507f1f77bcf86cd799439011/availability/507f191e810c19729de860ea
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "isAvailable": false
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "unavailablePlayers": ["507f191e810c19729de860ea", ...],
    ...
  }
}
```

**Backend Flow:**
```typescript
// Route (apps/api/src/routes/matches.ts)
router.patch('/:id/availability/:playerId',
  protect,
  authorize(MEMBER_ROLES),  // Changed from ADMIN_ROLES to MEMBER_ROLES
  MatchController.togglePlayerAvailability
);

// Controller (apps/api/src/controllers/matchController.ts)
static async togglePlayerAvailability(req, res, next) {
  const { id: matchId, playerId } = req.params;
  const { isAvailable } = req.body;
  const result = await MatchService.togglePlayerAvailability(matchId, playerId, isAvailable);
  res.json({ success: true, data: result });
}

// Service (apps/api/src/services/matchService.ts)
static async togglePlayerAvailability(matchId, playerId, isAvailable) {
  const match = await Match.findById(matchId);
  if (isAvailable) {
    // Remove from unavailablePlayers array
    match.unavailablePlayers = match.unavailablePlayers.filter(id => id.toString() !== playerId);
  } else {
    // Add to unavailablePlayers array if not already there
    if (!match.unavailablePlayers.includes(playerId)) {
      match.unavailablePlayers.push(playerId);
    }
  }
  await match.save();
  return match;
}
```

#### Frontend Service Layer

**React Query Mutation** (`apps/web/app/services/matchService.ts`):
```typescript
static useTogglePlayerAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, playerId, isAvailable }) => {
      return await matchApi.toggleMatchPlayerAvailability(matchId, playerId, isAvailable);
    },
    onSuccess: async (_, variables) => {
      // Use queryKey helper for consistency
      const queryKey = BaseService.queryKey('matches', 'profile', { id: variables.matchId });

      // Force immediate refetch of specific match
      await queryClient.refetchQueries({ queryKey, exact: true });

      // Also invalidate list for consistency
      queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
    },
  });
}
```

**Query Configuration:**
```typescript
static useMatchProfile(id: string) {
  return useQuery({
    queryKey: BaseService.queryKey('matches', 'profile', { id }),
    queryFn: () => MatchService.getMatchProfile(id),
    enabled: !!id,
    staleTime: 0,  // Always consider stale for instant updates
    refetchOnMount: 'always',  // Always refetch when modal opens
  });
}
```

**Key Configuration:**
- `staleTime: 0`: Ensures cache invalidation immediately triggers refetch
- `refetchOnMount: 'always'`: Fetches fresh data when modal opens
- `refetchQueries()` with `exact: true`: Targets specific match query
- `BaseService.queryKey()`: Ensures consistent key format (stringified params)

#### Data Flow Pattern

**Complete Flow (Toggle Availability):**
```
1. User clicks "Available/Unavailable" button in modal

2. Component calls mutation:
   toggleAvailabilityMutation.mutateAsync({ matchId, playerId, isAvailable })

3. Frontend sends PATCH request:
   PATCH /api/matches/:id/availability/:playerId
   Body: { isAvailable: true/false }

4. Backend processes request:
   protect → authorize(MEMBER_ROLES) → Controller → Service → Database

5. Backend returns updated match:
   { success: true, data: { ...match, unavailablePlayers: [...] } }

6. Frontend onSuccess callback:
   - Construct exact query key: ['matches', 'profile', '{"id":"..."}']
   - Call refetchQueries() with exact: true
   - React Query immediately fetches fresh data

7. Modal useMatchProfile hook receives updated data:
   - match.unavailablePlayers array updated
   - availabilityMap recomputed via useMemo
   - PlayerAvailability component re-renders with new state

8. UI updates instantly:
   - Player moves from available to unavailable list (or vice versa)
   - Gender counts recalculated
   - No page refresh needed
```

#### UI/UX Considerations

**User Feedback:**
- Instant UI updates (no loading spinner needed due to optimistic UX)
- Real-time synchronization via React Query cache
- Clear visual state: Available vs Unavailable sections

**Permissions:**
- Only team members see toggle button (non-members see read-only view)
- Admins can view but not override individual availability (respects player autonomy)
- Current user always displayed first for quick access

**Accessibility:**
- Gender icons with semantic meaning (Mars=male, Venus=female, User=other)
- Horizontal layout prevents excessive vertical scrolling
- Clear section headers: "Available Players" / "Unavailable Players"

#### Integration Points

**Used In:**
- `MatchDetailsModal`: Main availability management interface
- `UpcomingMatchesTab`: View details → availability section
- `MatchHistoryTab`: Historical availability (read-only)

**Related Components:**
- `GenderIcon`: Reusable gender indicator component
- `MatchDetailsModal`: Parent container
- `UnifiedMatchCard`: Match card with "View Details" action

#### Testing Considerations

**Test Cases:**
1. Member toggles availability → player moves between lists immediately
2. Refresh page → availability persists
3. Non-member views modal → no toggle button shown
4. Admin views modal → can see availability, cannot override
5. Multiple members toggle simultaneously → last write wins (backend handles race conditions)
6. Gender counts update correctly after toggle
7. Current player remains first in sorted list

**Known Issues (Resolved):**
- ~~Query key mismatch causing refetch to fail~~ → Fixed by using `BaseService.queryKey()` helper
- ~~Manual useEffect synchronization~~ → Removed with query-based pattern
- ~~Complex optimistic updates~~ → Simplified to just refetch

#### Maintenance Notes

**When Adding New Modals:**
- Follow query-based pattern: Pass IDs, not objects
- Let modal query its own data with service hooks
- Use `staleTime: 0` and `refetchOnMount: 'always'` for real-time modals
- Use `refetchQueries()` instead of complex optimistic updates

**When Adding New Mutations:**
- Use `BaseService.queryKey()` for consistent cache keys
- Invalidate specific queries, not entire cache
- Consider `refetchQueries()` for critical real-time updates
- Document query key structure in service layer

---

## Backend Security & Authorization

### Authentication Middleware

**File:** `apps/api/src/middleware/auth.ts`

#### `protect` Middleware
Verifies JWT token and attaches authenticated user to request.

```typescript
export const protect: RequestHandler = async (req, res, next) => {
  // 1. Extract token from Authorization header
  const token = req.headers.authorization?.split(' ')[1];

  // 2. Verify JWT and decode payload
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // 3. Fetch user from database
  const user = await User.findById(decoded.sub);

  // 4. Attach user to request
  req.user = { id, role, email, firstName, lastName };
  next();
};
```

**Usage:**
```typescript
router.get('/api/protected-route', protect, controller.method);
```

#### `authorize` Middleware
Role-based access control - restricts routes to specific user roles.

```typescript
export const authorize = (roles: UserRole | UserRole[]): RequestHandler => {
  return (req, res, next) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Not authorized', 403));
    }
    next();
  };
};
```

**Usage:**
```typescript
// Admin only
router.delete('/api/users/:id', protect, authorize(ADMIN_ROLES), controller.delete);

// Admin or Member
router.get('/api/matches', protect, authorize(MEMBER_ROLES), controller.list);

// Multiple roles (alternative)
router.post('/api/resource', protect, authorize([UserRole.ADMIN, UserRole.MEMBER]), ...);
```

#### `authorizeOwner` Middleware
Resource ownership check - allows users to access only their own resources, admins can access all.

```typescript
export const authorizeOwner = (
  resourceIdParam: string | ((req) => string),
  ownershipCheck?: OwnershipCheck
): RequestHandler => {
  return async (req, res, next) => {
    // Admin bypass
    if (req.user.role === UserRole.ADMIN) return next();

    // Extract resource ID and compare with user ID
    const resourceId = typeof resourceIdParam === 'string'
      ? req.params[resourceIdParam]
      : resourceIdParam(req);

    if (resourceId !== req.user.id) {
      return next(new AppError('Not authorized', 403));
    }
    next();
  };
};
```

**Usage:**
```typescript
// Update own profile only
router.put('/api/users/:id', protect, authorizeOwner('id'), controller.update);

// With custom ownership check
router.put('/api/players/:playerId',
  protect,
  authorizeOwner('playerId', async (playerId, userId) => {
    const player = await Player.findById(playerId);
    return player.userId.toString() === userId;
  }),
  controller.update
);
```

### Role Constants

**File:** `apps/api/src/utils/roles.ts`

```typescript
import { UserRole } from '@club/shared-types/core/enums';

export const ADMIN_ROLES = [UserRole.ADMIN];
export const MEMBER_ROLES = [...ADMIN_ROLES, UserRole.MEMBER];
```

**Roles Hierarchy:**
- `ADMIN`: Full system access (create/edit/delete all resources)
- `MEMBER`: Access to matches, players, own profile
- `APPLICANT`: Limited access (pending approval, not included in MEMBER_ROLES)

### Access Control Matrix

| Resource | Endpoint | Method | Authorization | Notes |
|----------|----------|--------|---------------|-------|
| **Users** | `/api/users` | GET | `ADMIN_ROLES` | List all users |
| | `/api/users/:id` | GET | `authorizeOwner` | View own profile or admin |
| | `/api/users` | POST | `ADMIN_ROLES` | Create new user |
| | `/api/users/:id` | PUT | `authorizeOwner` | Update own profile or admin |
| | `/api/users/:id` | DELETE | `ADMIN_ROLES` | Delete user |
| **Players** | `/api/players` | GET | `MEMBER_ROLES` | ✅ Members can view players |
| | `/api/players/:id` | GET | `MEMBER_ROLES` | View player details |
| | `/api/players` | POST | `ADMIN_ROLES` | Create player |
| | `/api/players/:id` | PUT | `ADMIN_ROLES` | Update player |
| | `/api/players/:id` | DELETE | `ADMIN_ROLES` | Delete player |
| **Matches** | `/api/matches` | GET | `MEMBER_ROLES` | ✅ Members can view matches |
| | `/api/matches/:id` | GET | `MEMBER_ROLES` | View match details |
| | `/api/matches` | POST | `ADMIN_ROLES` | Create match |
| | `/api/matches/:id` | PUT | `ADMIN_ROLES` | Update match |
| | `/api/matches/:id` | DELETE | `ADMIN_ROLES` | Delete match |
| | `/api/matches/:id/availability/:playerId` | PATCH | `MEMBER_ROLES` | ✅ **Toggle own availability** |
| | `/api/matches/:id/sync-players` | POST | `ADMIN_ROLES` | Sync team players |
| | `/api/matches/:id/lineup` | PUT | `ADMIN_ROLES` | Update lineup |
| **Teams** | `/api/teams` | GET | `MEMBER_ROLES` | ✅ Members can view teams |
| | `/api/teams/:id` | GET | `MEMBER_ROLES` | View team details |
| | `/api/teams` | POST | `ADMIN_ROLES` | Create team |
| | `/api/teams/:id` | PUT | `ADMIN_ROLES` | Update team |
| | `/api/teams/:id` | DELETE | `ADMIN_ROLES` | Delete team |
| **Auth** | `/api/auth/register` | POST | `public` | Registration |
| | `/api/auth/login` | POST | `public` | Login |
| | `/api/auth/me` | GET | `protect` | Current user |

**Key Changes (2025-11-06):**
- ✅ **Players List**: Changed from `ADMIN_ROLES` to `MEMBER_ROLES` - Members need to see team rosters
- ✅ **Matches List**: Changed from `ADMIN_ROLES` to `MEMBER_ROLES` - Members need to view schedules
- ✅ **Player Availability**: New endpoint with `MEMBER_ROLES` - Members can indicate their own availability
- ℹ️ **Teams List**: Already `MEMBER_ROLES` - Members can view team information

**Rationale:**
- Members need visibility into match schedules to plan attendance
- Members need to see player lists for team coordination
- Members should control their own availability for matches
- Admin-only operations remain protected (create/edit/delete resources)

### Route Protection Pattern

**Standard Pattern:**
```typescript
import { protect, authorize } from '../middleware/auth';
import { ADMIN_ROLES, MEMBER_ROLES } from '../utils/roles';

// Public route
router.post('/register', AuthController.register);

// Authenticated route (any logged-in user)
router.get('/me', protect, AuthController.getCurrentUser);

// Member access (read-only)
router.get('/matches', protect, authorize(MEMBER_ROLES), MatchController.getMatches);

// Admin access (write operations)
router.post('/matches', protect, authorize(ADMIN_ROLES), MatchController.createMatch);

// Owner or admin access
router.put('/users/:id', protect, authorizeOwner('id'), UserController.updateUser);
```

**Middleware Order:**
1. `protect` - Always first, verifies JWT
2. `authorize` - Role check (if needed)
3. `authorizeOwner` - Ownership check (if needed)
4. Controller method

**Error Responses:**
- `401 Unauthorized`: Invalid/missing JWT token (protect middleware)
- `403 Forbidden`: Valid token but insufficient permissions (authorize middleware)

### Security Best Practices

1. **Always use `protect`** before any role or ownership checks
2. **Use role constants** (`ADMIN_ROLES`, `MEMBER_ROLES`) instead of hardcoding roles
3. **Admin bypass** in `authorizeOwner` allows admins to manage all resources
4. **Custom ownership checks** for complex relationships (e.g., player → user)
5. **Token expiration** configured in JWT_SECRET environment variable
6. **Secure routes by default** - explicitly mark routes as public if needed

### Testing Authorization

**Test Cases:**
```typescript
// ✅ Should allow admin access
it('allows admin to delete user', async () => {
  const res = await request(app)
    .delete('/api/users/123')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
});

// ✅ Should deny member access to admin endpoint
it('denies member access to delete user', async () => {
  const res = await request(app)
    .delete('/api/users/123')
    .set('Authorization', `Bearer ${memberToken}`)
    .expect(403);
});

// ✅ Should allow member to view matches
it('allows member to view matches', async () => {
  const res = await request(app)
    .get('/api/matches')
    .set('Authorization', `Bearer ${memberToken}`)
    .expect(200);
});

// ✅ Should allow member to toggle own availability
it('allows member to toggle availability', async () => {
  const res = await request(app)
    .patch('/api/matches/123/availability/456')
    .set('Authorization', `Bearer ${memberToken}`)
    .send({ isAvailable: false })
    .expect(200);
});
```

---

## Frontend Architecture
````

### Directory Structure
```
apps/web/
├── app/
│   ├── [lang]/                    # i18n routing
│   │   ├── dashboard/             # Protected routes
│   │   │   ├── members/           # Member management
│   │   │   ├── matches/           # Match scheduling
│   │   │   ├── training/          # Training sessions
│   │   │   ├── guests/            # Guest player management
│   │   │   └── applications/      # Membership applications
│   │   ├── login/
│   │   └── page.tsx               # Public homepage
│   ├── components/
│   │   └── Dashboard/             # Dashboard feature components
│   │       ├── tabs/              # Tab content components
│   │       ├── modals/            # Modal dialogs
│   │       └── [Feature]Center.tsx # Main feature components
│   ├── hooks/                     # Custom React hooks
│   ├── lib/
│   │   ├── api/                   # API client functions
│   │   ├── types.ts               # Frontend type re-exports
│   │   └── utils.ts               # Utilities
│   ├── providers/                 # Context providers
│   └── services/                  # Frontend service layer
├── messages/                      # i18n translations (de/en/zh)
└── public/                        # Static assets
```

### Component Patterns

#### 1. Service Layer Pattern
Services fetch data and transform API → View layer. Components receive View types.

```typescript
// services/userService.ts
import { UserView, UserViewTransformers } from '@club/shared-types';
import { userApi } from '@app/lib/api/userApi';

export class UserService {
  static async getUserCards(): Promise<UserView.UserCard[]> {
    const apiUsers = await userApi.getUsers();
    return apiUsers.map(user => UserViewTransformers.toUserCard(user));
  }

  static async updateUser(id: string, formData: UserView.UserFormData): Promise<UserView.UserCard> {
    const updateRequest = UserViewTransformers.toUpdateRequest(formData);
    const apiUser = await userApi.updateUser(id, updateRequest);
    return UserViewTransformers.toUserCard(apiUser);
  }
}
```

#### 2. Component Pattern
Components use View types and services. No manual transformations.

```typescript
// components/Dashboard/MemberCenter.tsx
import { UserService } from '@app/services/userService';
import type { User } from '@app/lib/types';  // Re-exports UserView.UserCard

export function MemberCenter() {
  const [members, setMembers] = useState<User[]>([]);

  useEffect(() => {
    UserService.getUserCards().then(setMembers);
  }, []);

  return (
    <div>
      {members.map(member => (
        <div key={member.id}>  {/* Use id, not _id */}
          <h3>{member.displayName}</h3>
          <Badge className={member.statusBadge.className}>
            {member.statusBadge.label}
          </Badge>
          <Badge className={member.roleBadge.className}>
            {member.roleBadge.label}
          </Badge>
        </div>
      ))}
    </div>
  );
}
```

#### 3. Form Pattern
Forms use `*FormData` types from View layer.

```typescript
// modals/EditMemberModal.tsx
import type { UserFormData } from '@app/lib/types';

interface EditMemberModalProps {
  member: User;  // UserView.UserCard
  onSave: (formData: UserFormData) => void;
}

export function EditMemberModal({ member, onSave }: EditMemberModalProps) {
  const [formData, setFormData] = useState<UserFormData>({
    email: member.email,
    name: member.name,
    role: member.role,
    membershipStatus: member.membershipStatus
  });

  const handleSubmit = () => {
    onSave(formData);  // Service handles transformation
  };

  return <form>...</form>;
}
```

### Key Frontend Patterns

**Data Fetching:**
1. Component calls Service method
2. Service calls API client
3. Service transforms API → View using transformer
4. Component receives View types with computed fields

**Data Updates:**
1. Form uses `*FormData` type
2. Component calls Service with form data
3. Service transforms View → API using transformer
4. Service calls API client
5. Service transforms response API → View
6. Component receives updated View type

**State Management:**
- Local state: `useState` for component-specific state
- Server state: TanStack Query for cached API data
- Auth state: Context provider (`useAuth` hook)
- No global state manager (Redux, Zustand) needed

---

## Backend Architecture

### Directory Structure
```
apps/api/
├── src/
│   ├── controllers/               # Request handlers
│   │   ├── userController.ts
│   │   ├── matchController.ts
│   │   └── ...
│   ├── services/                  # Business logic
│   │   ├── userService.ts
│   │   ├── matchService.ts
│   │   └── ...
│   ├── models/                    # Mongoose schemas
│   │   ├── User.ts
│   │   ├── Match.ts
│   │   └── ...
│   ├── middleware/
│   │   ├── auth.ts                # JWT authentication
│   │   ├── validation.ts          # Request validation
│   │   └── errorHandler.ts        # Error handling
│   ├── routes/                    # Express routes
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   └── ...
│   ├── transformers/              # Layer conversions
│   │   ├── userTransformer.ts
│   │   └── ...
│   ├── utils/                     # Utilities
│   └── server.ts                  # Express app
└── __tests__/                     # Integration tests
```

### Layer Flow

```
Request → Controller → Service → Model → Database
                ↓          ↓        ↓
            Validation  Business  Data Access
                ↓       Logic      ↓
            Transform               Transform
              API ←────────────── Persistence
```

### Backend Patterns

#### 1. Controller Pattern
Controllers handle HTTP, validate input, call services, transform responses.

```typescript
// controllers/userController.ts
import { UserService } from '../services/userService';
import { UserApiTransformers } from '../transformers/userTransformer';

export const getUsers = async (req: Request, res: Response) => {
  try {
    // Service returns Domain.User[]
    const domainUsers = await UserService.getAllUsers();

    // Transform Domain → API for response
    const apiUsers = domainUsers.map(user =>
      UserApiTransformers.toResponse(user)
    );

    res.json(apiUsers);
  } catch (error) {
    next(error);  // Error middleware handles
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    // Transform API request → Domain
    const domainUser = UserApiTransformers.fromCreateRequest(req.body);

    // Service handles business logic
    const createdUser = await UserService.createUser(domainUser);

    // Transform Domain → API for response
    const apiUser = UserApiTransformers.toResponse(createdUser);

    res.status(201).json(apiUser);
  } catch (error) {
    next(error);
  }
};
```

#### 2. Service Pattern
Services contain business logic, work with Domain types, call models.

```typescript
// services/userService.ts
import { User } from '../models/User';
import { UserPersistenceTransformers } from '../transformers/userTransformer';
import type { Domain } from '@club/shared-types';

export class UserService {
  static async getAllUsers(): Promise<Domain.User[]> {
    // Model returns Mongoose documents
    const docs = await User.find().populate('playerId');

    // Transform Persistence → Domain
    return docs.map(doc =>
      UserPersistenceTransformers.toDomain(doc)
    );
  }

  static async createUser(domainUser: Domain.UserCreate): Promise<Domain.User> {
    // Validate business rules
    const existingUser = await User.findOne({ email: domainUser.email });
    if (existingUser) {
      throw new ValidationError('Email already exists');
    }

    // Transform Domain → Persistence
    const persistenceData = UserPersistenceTransformers.fromDomain(domainUser);

    // Create in database
    const doc = await User.create(persistenceData);

    // Transform back to Domain
    return UserPersistenceTransformers.toDomain(doc);
  }
}
```

#### 3. Model Pattern
Models define Mongoose schemas. Local interface extends Document.

```typescript
// models/User.ts
import { Schema, model, Document, Types } from 'mongoose';
import { UserRole, MembershipStatus } from '@club/shared-types';

/**
 * Local interface - must extend Document for Mongoose
 * Structure aligns with Persistence.UserDocument
 */
export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  membershipStatus: MembershipStatus;
  playerId?: Types.ObjectId;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: Object.values(UserRole), required: true },
  membershipStatus: { type: String, enum: Object.values(MembershipStatus), required: true },
  playerId: { type: Schema.Types.ObjectId, ref: 'Player' }
}, { timestamps: true });

export const User = model<IUser>('User', userSchema);
```

**Why local interface?**
- Mongoose requires extending `Document`
- TypeScript needs full definition at compile time
- Transformers handle conversion to/from shared types

---

## Data Flow Patterns

### Complete Request Flow (Read)

```
┌─────────────────────────────────────────────────────────────┐
│                    GET /api/users                            │
└─────────────────────────────────────────────────────────────┘

1. Frontend Component
   └─> UserService.getUserCards()
       └─> userApi.getUsers()  // Fetch from API

2. Backend Controller (userController.getUsers)
   └─> UserService.getAllUsers()  // Returns Domain.User[]
       └─> Model.find()  // Returns Mongoose docs
           └─> UserPersistenceTransformers.toDomain()
   └─> UserApiTransformers.toResponse()  // Domain → API
   └─> res.json(apiUsers)  // Send UserApi.UserResponse[]

3. Frontend Service
   └─> Receives UserApi.UserResponse[]
   └─> UserViewTransformers.toUserCard()  // API → View
   └─> Returns UserView.UserCard[]  // With computed fields

4. Frontend Component
   └─> Receives UserView.UserCard[]
   └─> Render with displayName, statusBadge, roleBadge
```

### Complete Request Flow (Write)

```
┌─────────────────────────────────────────────────────────────┐
│                   POST /api/users                            │
└─────────────────────────────────────────────────────────────┘

1. Frontend Component
   └─> Form with UserView.UserFormData
   └─> UserService.createUser(formData)
       └─> UserViewTransformers.toCreateRequest()  // View → API
       └─> userApi.createUser(request)

2. Backend Controller (userController.createUser)
   └─> UserApiTransformers.fromCreateRequest()  // API → Domain
   └─> UserService.createUser(domainUser)
       └─> Validate business rules
       └─> UserPersistenceTransformers.fromDomain()  // Domain → Persistence
       └─> Model.create()  // Save to MongoDB
       └─> UserPersistenceTransformers.toDomain()  // Persistence → Domain
   └─> UserApiTransformers.toResponse()  // Domain → API
   └─> res.json(apiUser)

3. Frontend Service
   └─> Receives UserApi.UserResponse
   └─> UserViewTransformers.toUserCard()  // API → View
   └─> Returns UserView.UserCard

4. Frontend Component
   └─> Receives UserView.UserCard with computed fields
   └─> Update UI
```

### Player-User Synchronization Pattern

**Architecture Decision:** Player entities are managed through UserService, not PlayerService.

**Rationale:**
- Player is a dependent entity of User (User is the aggregate root)
- Player lifecycle is tied to User.isPlayer flag
- User operations should maintain referential integrity with Player
- PlayerService/PlayerController handle only Player-specific operations (rankings, positions, stats)

**Implementation Pattern:**

```typescript
// ✅ CORRECT: UserService manages Player lifecycle
class UserService {
  static async createUser(userData: CreateUserRequest): Promise<User> {
    const user = await User.create(userData);

    if (userData.isPlayer) {
      await this.createPlayerForUser(user._id);
    }

    return user;
  }

  static async updateUser(userId: string, updateData: UpdateUserRequest): Promise<User> {
    const user = await User.findById(userId);
    const wasPlayer = user.isPlayer;

    Object.assign(user, updateData);
    await user.save();

    if (updateData.isPlayer !== undefined && updateData.isPlayer !== wasPlayer) {
      if (updateData.isPlayer) {
        await this.createPlayerForUser(user._id);
      } else {
        await this.deletePlayerForUser(user._id);
      }
    }

    return user;
  }

  private static async createPlayerForUser(userId: ObjectId): Promise<void> {
    await Player.create({
      userId,
      ranking: 0,
      preferredPositions: [],
      isActivePlayer: true,
      teamIds: []
    });
  }

  private static async deletePlayerForUser(userId: ObjectId): Promise<void> {
    // Hard delete - Player is dependent on User
    await Player.findOneAndDelete({ userId });
  }
}

// ✅ CORRECT: PlayerController handles Player-specific updates only
class PlayerController {
  static async updatePlayerStatus(req, res, next) {
    // Updates Player.isActivePlayer only
    // Does NOT modify User.isPlayer
  }

  static async updatePlayerRanking(req, res, next) {
    // Updates Player.ranking only
  }
}

// ❌ WRONG: Don't manage Player lifecycle in PlayerService
class PlayerService {
  // ❌ WRONG: This breaks aggregate root pattern
  static async createPlayer(userData) {
    // PlayerService should NOT create Player entities
  }
}
```

**Key Rules:**
1. **User Creation/Update:** UserService creates/deletes Player entities when `isPlayer` changes
2. **Player Updates:** PlayerController updates Player-specific fields (ranking, positions, isActivePlayer)
3. **Hard Delete:** When `User.isPlayer` becomes false, Player entity is deleted (not soft-deleted)
4. **User Deletion:** When User is deleted, associated Player entity is deleted first
5. **Aggregate Root:** User is the aggregate root; Player is a dependent entity
6. **Cache Invalidation:** Player list changes require cache/query invalidation in frontend

**User Deletion with Player Cleanup:**
```typescript
// ✅ CORRECT: Delete Player before User deletion
static async deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Delete associated Player entity if user is a player
    if (user.isPlayer) {
      try {
        await UserService.deletePlayerEntity(user._id as any);
      } catch (playerError: any) {
        // Log error but continue with user deletion
        console.error(`Failed to delete Player entity for user ${user._id}:`, playerError.message);
      }
    }

    await user.deleteOne();
    ResponseHelper.success(res, null, 'User successfully deleted');
  } catch (error) {
    next(error);
  }
}

// ❌ WRONG: Don't delete User without cleaning up Player
static async deleteUser(req, res, next) {
  await User.findByIdAndDelete(req.params.id);
  // Missing Player cleanup - creates orphaned records!
}
```

**Frontend User Deletion:**
```typescript
// Component handles deletion with cache invalidation
```

---

### Team-Player Relationship Management

**Architecture Decision (2025-11-03):** Team-player relationship operations are managed through PlayerService, not TeamService.

**Rationale:**
- Player is the primary entity being modified (Player.teamIds array)
- One player can belong to multiple teams (many-to-many relationship)
- Player-centric operations should live in PlayerService
- TeamService focuses on team entity operations
- Consistent with batch update operations already in PlayerService

**Implementation Pattern:**

```typescript
// ✅ CORRECT: PlayerService manages team-player relationships
class PlayerService {
  /**
   * Add a player to a team (bidirectional update)
   * @param playerId - Player being modified (primary entity)
   * @param teamId - Team to add player to
   */
  static async addPlayerToTeam(playerId: string, teamId: string): Promise<Domain.Player> {
    const player = await Player.findById(playerId);
    const team = await Team.findById(teamId);

    // Update player.teamIds (primary operation)
    player.teamIds.push(new Types.ObjectId(teamId));
    await player.save();

    // Update team.playerIds (bidirectional sync)
    team.playerIds.push(new Types.ObjectId(playerId));
    await team.save();

    return PlayerPersistenceTransformer.toDomain(player.toObject());
  }

  /**
   * Remove a player from a team (bidirectional update)
   */
  static async removePlayerFromTeam(playerId: string, teamId: string): Promise<Domain.Player> {
    // Similar pattern: update both Player.teamIds and Team.playerIds
  }

  /**
   * Batch update multiple players' team memberships
   */
  static async batchUpdatePlayers(playerIds: string[], updates: {
    addToTeams?: string[];
    removeFromTeams?: string[];
    // ... other updates
  }): Promise<{ modifiedCount: number }> {
    // Handles batch team operations with smart filtering
  }
}

// ✅ CORRECT: TeamController delegates to PlayerService
class TeamController {
  /**
   * POST /teams/:teamId/players/:playerId
   * Add a player to a team
   */
  static async addPlayerToTeam(req, res, next): Promise<void> {
    // Delegate to PlayerService (player-centric operation)
    const player = await PlayerService.addPlayerToTeam(
      req.params.playerId,  // Player is primary entity
      req.params.teamId
    );
    res.json({ success: true, data: PlayerApiTransformer.toApi(player) });
  }
}

// 🔄 DEPRECATED: TeamService methods kept for backward compatibility
class TeamService {
  /**
   * @deprecated Use PlayerService.addPlayerToTeam instead
   * This method delegates to PlayerService
   */
  static async addPlayerToTeam(teamId: string, playerId: string): Promise<Domain.Team> {
    const { PlayerService } = await import('./playerService');
    await PlayerService.addPlayerToTeam(playerId, teamId);
    return this.getTeamById(teamId);
  }
}
```

**Key Rules:**
1. **Player-Centric:** Player is the primary entity; PlayerService owns the operation
2. **Bidirectional Updates:** Always update both Player.teamIds AND Team.playerIds
3. **Parameter Order:** `(playerId, teamId)` reflects player-centric approach
4. **Return Type:** Returns `Domain.Player` (primary entity being modified)
5. **Batch Operations:** Use `batchUpdatePlayers()` for bulk team assignments
6. **Smart Filtering:** Only update players that need changes (no redundant operations)
7. **Backward Compatibility:** TeamService keeps deprecated stubs that delegate to PlayerService

**Smart Batch Updates:**
```typescript
// ✅ CORRECT: Smart filtering prevents redundant operations
async function handleBatchUpdateTeam() {
  const selectedPlayers = players.filter(p => selectedPlayerIds.includes(p.id));

  if (mode === 'add') {
    // Only add players NOT already in team
    const playerIdsToUpdate = selectedPlayers
      .filter(p => !p.teamIds?.includes(teamId))
      .map(p => p.id);

    if (playerIdsToUpdate.length === 0) {
      alert('All selected players are already in this team.');
      return;
    }

    await batchUpdatePlayers(playerIdsToUpdate, { addToTeams: [teamId] });
  } else {
    // Only remove players currently in team
    const playerIdsToUpdate = selectedPlayers
      .filter(p => p.teamIds?.includes(teamId))
      .map(p => p.id);

    if (playerIdsToUpdate.length === 0) {
      alert('None of the selected players are in this team.');
      return;
    }

    await batchUpdatePlayers(playerIdsToUpdate, { removeFromTeams: [teamId] });
  }
}
```

**Documentation:**
- See: `openspec/changes/optimize-match-center/specs/team-player-operations-refactor.md`
- Change Log: `openspec/changes/optimize-match-center/PHASE1-COMPLETION.md`

---

**Frontend User Deletion:**
```typescript
// ✅ CORRECT: Confirm with player warning, invalidate caches
const handleDeleteMember = useCallback(async (member: User) => {
  const confirmed = window.confirm(
    `Are you sure you want to delete ${member.name}? This action cannot be undone.${
      member.isPlayer ? '\n\nNote: This will also remove their player profile.' : ''
    }`
  );

  if (!confirmed) return;

  try {
    await deleteUser(member.id);
    refetch(); // Invalidates users cache
    // Player cache automatically invalidated via useDeleteUser hook
  } catch (error) {
    console.error('Error deleting member:', error);
    alert(`Failed to delete member: ${error.message}`);
  }
}, [refetch]);
```

**Frontend Cache Invalidation:**
```typescript
// ✅ CORRECT: Conditional invalidation - only when isPlayer changes
const updateUserMutation = UserService.useUpdateUser({
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries(['users', 'list']);

    // Only invalidate player queries if isPlayer status was updated
    if ('isPlayer' in variables.formData) {
      queryClient.invalidateQueries(['players']);
    }
  }
});

// ✅ CORRECT: Batch update with conditional invalidation
const batchUpdateMutation = UserService.useBatchUpdate({
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries(['users', 'list']);

    // Only invalidate player queries if isPlayer was in the update
    if ('isPlayer' in variables.updateData) {
      queryClient.invalidateQueries(['players']);
    }
  }
});

// ✅ CORRECT: Always invalidate on delete (user might be player)
const deleteUserMutation = UserService.useDeleteUser({
  onSuccess: () => {
    queryClient.invalidateQueries(['users']);
    queryClient.invalidateQueries(['players']); // Always invalidate - deleted user might have been player
  }
});

// ❌ WRONG: Unconditional invalidation on every update
const updateUserMutation = UserService.useUpdateUser({
  onSuccess: () => {
    queryClient.invalidateQueries(['users']);
    queryClient.invalidateQueries(['players']); // ❌ Wasteful - invalidates even for name/email changes
  }
});
```

---

## Computed Properties Pattern

**Last Updated:** 2025-11-04

### Overview

The Computed Properties Pattern is a core architectural decision for handling derived/calculated fields in the application. Instead of storing computed values in the database, they are calculated on-demand at the API transformation layer.

**Philosophy:** "Never store what can be computed from source fields."

### Pattern Definition

**Computed Property:** A field whose value is derived from other fields and should never be stored in the database.

**Examples:**
- `fullName` = `"${lastName}, ${firstName}"` (derived from firstName + lastName)
- `rankingDisplay` = `"${singlesRanking}/${doublesRanking}"` (derived from two ranking fields)
- `displayName` = `fullName || email` (derived with fallback logic)
- `statusBadge` = UI badge config based on membershipStatus

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                   COMPUTED PROPERTY FLOW                         │
└─────────────────────────────────────────────────────────────────┘

Database (Persistence)        API Transformer               Frontend (View)
─────────────────────         ────────────────             ─────────────────
┌──────────────────┐         ┌──────────────────┐        ┌─────────────────┐
│ User Document    │         │ API Transformer  │        │ Display         │
│                  │────────>│                  │───────>│                 │
│ firstName: "John"│         │ Computes:        │        │ Shows:          │
│ lastName: "Doe"  │         │ fullName =       │        │ "Doe, John"     │
│                  │         │ "Doe, John"      │        │                 │
└──────────────────┘         └──────────────────┘        └─────────────────┘
     ↑                              ↑                            ↑
     │                              │                            │
   STORED                       COMPUTED                      CONSUMED
 (Source Fields)           (During Transformation)        (Read-Only)
```

### Implementation: User Name Example

#### 1. Database Layer (Persistence)

```typescript
// apps/api/src/models/User.ts
const userSchema = new Schema({
  // ✅ Source fields - STORED in database
  firstName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },

  // ❌ fullName NOT stored in database
  // It's computed on-demand during transformation

  // Deprecated field (kept for backward compatibility)
  /** @deprecated Use firstName and lastName. Will be removed in v2.0.0 */
  name: String
});

// Indexes for efficient sorting
userSchema.index({ lastName: 1, firstName: 1 });
```

#### 2. Domain Layer

```typescript
// shared/types/src/domain/user.ts
export namespace Domain {
  export interface User extends BaseEntity {
    id: string;
    email: string;

    // Source fields
    firstName: string;
    lastName: string;

    // NO computed fields at domain layer
    // Domain represents the pure business entity

    role: UserRole;
    membershipStatus: MembershipStatus;
    // ... other fields
  }
}
```

#### 3. API Layer (Where Computation Happens)

```typescript
// shared/types/src/api/user.ts
export namespace Api {
  export interface UserResponse {
    id: string;
    email: string;

    // Source fields
    firstName: string;
    lastName: string;

    // ✅ COMPUTED field - calculated during transformation
    fullName: string;  // "Lastname, Firstname"

    // Deprecated (kept for backward compatibility)
    /** @deprecated Use firstName and lastName. Will be removed in v2.0.0 */
    name?: string;

    role: string;
    membershipStatus: string;
    // ... other fields
  }
}
```

#### 4. API Transformer (Computation Logic)

```typescript
// apps/api/src/transformers/user.ts
export class UserApiTransformer {
  /**
   * Convert Domain.User to API.UserResponse
   * This is where computed fields are calculated
   */
  static toApi(user: Domain.User): Api.UserResponse {
    return {
      id: user.id,
      email: user.email,

      // Pass through source fields
      firstName: user.firstName,
      lastName: user.lastName,

      // ✅ COMPUTE fullName from source fields
      fullName: `${user.lastName}, ${user.firstName}`,

      // Backward compatibility
      name: `${user.firstName} ${user.lastName}`,

      role: user.role,
      membershipStatus: user.membershipStatus,
      // ... other fields
    };
  }

  /**
   * Convert API request to Domain (creation)
   * Validates that source fields are provided
   */
  static fromCreateRequest(request: Api.CreateUserRequest): Domain.User {
    if (!request.firstName || !request.lastName) {
      throw new Error('firstName and lastName are required');
    }

    return {
      // Map source fields only
      // NO computed fields in domain
      firstName: request.firstName,
      lastName: request.lastName,
      email: request.email,
      // ... other fields
    } as Domain.User;
  }
}
```

#### 5. Model Method (Alternative Pattern)

```typescript
// apps/api/src/models/User.ts
userSchema.methods.toView = async function() {
  const obj = this.toObject();

  return {
    id: (obj._id as any).toString(),
    email: obj.email,
    firstName: obj.firstName,
    lastName: obj.lastName,

    // ✅ Compute fullName when converting to view
    fullName: `${obj.lastName}, ${obj.firstName}`,

    // ... other fields
  };
};
```

#### 6. Frontend Usage

```typescript
// Frontend component
function UserProfile({ user }: { user: Api.UserResponse }) {
  return (
    <div>
      {/* ✅ Use computed field directly */}
      <h1>{user.fullName}</h1>

      {/* ✅ Or use fallback pattern */}
      <h1>{user.fullName || `${user.lastName}, ${user.firstName}`}</h1>

      {/* ❌ NEVER try to construct fullName in component */}
      {/* This defeats the purpose of computed properties */}
    </div>
  );
}

// Frontend form (editing)
function EditUserForm({ user }: { user: Api.UserResponse }) {
  const [formData, setFormData] = useState({
    // ✅ Edit source fields, not computed field
    firstName: user.firstName,
    lastName: user.lastName,
    // NOT: fullName - it's computed!
  });

  const handleSubmit = async () => {
    // ✅ Send source fields only
    await updateUser(user.id, {
      firstName: formData.firstName,
      lastName: formData.lastName
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.firstName}
        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
      />
      <input
        value={formData.lastName}
        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
      />
      {/* Show preview of computed value */}
      <p>Preview: {formData.lastName}, {formData.firstName}</p>
    </form>
  );
}
```

### Implementation: Player Ranking Example

```typescript
// 1. Database (Persistence) - Source fields only
const playerSchema = new Schema({
  singlesRanking: { type: Number, default: 0, min: 0, max: 5000 },
  doublesRanking: { type: Number, default: 0, min: 0, max: 5000 },
  // NO rankingDisplay field in database
});

// 2. API Type - Includes computed field
export interface PlayerResponse {
  singlesRanking: number;
  doublesRanking: number;
  rankingDisplay: string;  // COMPUTED: "singles/doubles"
}

// 3. API Transformer - Computation logic
export class PlayerApiTransformer {
  static toApi(player: Domain.Player): Api.PlayerResponse {
    return {
      singlesRanking: player.singlesRanking,
      doublesRanking: player.doublesRanking,
      // ✅ COMPUTE rankingDisplay from source fields
      rankingDisplay: `${player.singlesRanking}/${player.doublesRanking}`,
    };
  }
}

// 4. Frontend - Display computed field
function PlayerCard({ player }: { player: Api.PlayerResponse }) {
  return (
    <div>
      <span>Ranking: {player.rankingDisplay}</span>
      {/* Shows "10/20" instead of separate values */}
    </div>
  );
}
```

### Benefits

#### 1. Single Source of Truth
- Source fields (`firstName`, `lastName`) are the only stored values
- Computed field (`fullName`) is always derived from source fields
- No risk of computed field becoming out-of-sync with source fields

#### 2. Data Consistency
```typescript
// ❌ BAD: Storing computed values can lead to inconsistency
{
  firstName: "John",
  lastName: "Doe",
  fullName: "Smith, Jane"  // ❌ Inconsistent! How did this happen?
}

// ✅ GOOD: Computed on-demand = always consistent
{
  firstName: "John",
  lastName: "Doe",
  // fullName computed as "Doe, John" - always correct
}
```

#### 3. Flexibility
- Change display format without database migration
- Easy to add new computed variations (shortName, formalName, etc.)
- No database updates needed when computation logic changes

```typescript
// Easy to change format
// Old: fullName = `${lastName}, ${firstName}`
// New: fullName = `${firstName} ${lastName}`
// Only change: One line in transformer!
```

#### 4. Performance
- No extra storage cost for computed values
- Computation is cheap (string concatenation)
- Indexes only on source fields (firstName, lastName)

#### 5. Type Safety
- TypeScript enforces that computed fields are read-only in frontend
- Cannot accidentally send computed fields in update requests
- Clear separation between source and derived data

### Common Patterns

#### Pattern 1: Display-Only Computed Fields

```typescript
// Computed fields that are ONLY for display
export interface UserResponse {
  // Source fields
  firstName: string;
  lastName: string;
  email: string;

  // Display-only computed fields
  fullName: string;           // "Lastname, Firstname"
  displayName: string;        // fullName || email (with fallback)
  initials: string;           // "JD"
  formalName: string;         // "Mr. John Doe"
}
```

#### Pattern 2: Badge/Status Computed Fields

```typescript
// Computed fields for UI state/badges
export interface UserCard {
  // Source field
  membershipStatus: MembershipStatus;

  // Computed badge configuration
  statusBadge: {
    label: string;           // "Active", "Pending", "Inactive"
    variant: BadgeVariant;   // "success", "warning", "default"
    color: string;           // "green", "yellow", "gray"
  };
}

// Transformer
static toUserCard(user: Api.UserResponse): View.UserCard {
  return {
    ...user,
    statusBadge: this.getStatusBadge(user.membershipStatus)
  };
}
```

#### Pattern 3: Computed Fields with Fallbacks

```typescript
// Computed with graceful degradation
export interface UserResponse {
  firstName?: string;
  lastName?: string;
  email: string;

  // Computed with fallback logic
  fullName: string;  // lastName + firstName, or email if missing
}

// Transformer
static toApi(user: Domain.User): Api.UserResponse {
  const fullName = user.firstName && user.lastName
    ? `${user.lastName}, ${user.firstName}`
    : user.email;

  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    fullName
  };
}
```

#### Pattern 4: Multi-Source Computed Fields

```typescript
// Computed from multiple entities
export interface PlayerResponse {
  // From User entity (populated)
  userFirstName: string;
  userLastName: string;

  // From Player entity
  singlesRanking: number;
  doublesRanking: number;

  // Computed from User fields
  userName: string;  // "Doe, John"

  // Computed from Player fields
  rankingDisplay: string;  // "10/20"
}

// Service layer (populates User, then computes)
const player = await Player.findById(id).populate('userId');
const userName = player.userId?.firstName && player.userId?.lastName
  ? `${player.userId.lastName}, ${player.userId.firstName}`
  : '';

// Or in transformer
static toApi(player: Domain.Player, user: Domain.User): Api.PlayerResponse {
  return {
    userFirstName: user.firstName,
    userLastName: user.lastName,
    singlesRanking: player.singlesRanking,
    doublesRanking: player.doublesRanking,
    userName: `${user.lastName}, ${user.firstName}`,
    rankingDisplay: `${player.singlesRanking}/${player.doublesRanking}`
  };
}
```

### Anti-Patterns

#### ❌ Anti-Pattern 1: Storing Computed Values

```typescript
// ❌ BAD: Storing fullName in database
const userSchema = new Schema({
  firstName: String,
  lastName: String,
  fullName: String  // ❌ Redundant, can become inconsistent
});

await User.create({
  firstName: "John",
  lastName: "Doe",
  fullName: "Doe, John"  // ❌ What if we update firstName but forget fullName?
});
```

#### ❌ Anti-Pattern 2: Computing in Components

```typescript
// ❌ BAD: Computing in every component
function UserProfile({ user }) {
  // ❌ Duplicating computation logic across components
  const fullName = `${user.lastName}, ${user.firstName}`;
  return <h1>{fullName}</h1>;
}

function UserCard({ user }) {
  // ❌ Same logic duplicated again
  const fullName = `${user.lastName}, ${user.firstName}`;
  return <div>{fullName}</div>;
}

// ✅ GOOD: Compute once in transformer, use everywhere
function UserProfile({ user }) {
  return <h1>{user.fullName}</h1>;  // Already computed
}
```

#### ❌ Anti-Pattern 3: Sending Computed Fields in Updates

```typescript
// ❌ BAD: Including computed fields in update requests
await updateUser(userId, {
  firstName: "Jane",
  lastName: "Smith",
  fullName: "Smith, Jane"  // ❌ Redundant, will be ignored/cause confusion
});

// ✅ GOOD: Only send source fields
await updateUser(userId, {
  firstName: "Jane",
  lastName: "Smith"
  // fullName will be computed automatically
});
```

#### ❌ Anti-Pattern 4: Inconsistent Computation

```typescript
// ❌ BAD: Different computation in different places
// In transformer A
fullName: `${user.firstName} ${user.lastName}`  // "John Doe"

// In transformer B
fullName: `${user.lastName}, ${user.firstName}`  // "Doe, John"

// ✅ GOOD: Single computation function
class UserFormatters {
  static formatFullName(firstName: string, lastName: string): string {
    return `${lastName}, ${firstName}`;
  }
}

// Use everywhere
fullName: UserFormatters.formatFullName(user.firstName, user.lastName)
```

### Testing Computed Properties

```typescript
// Test transformer computation logic
describe('UserApiTransformer', () => {
  describe('toApi', () => {
    it('should compute fullName from firstName and lastName', () => {
      const domainUser: Domain.User = {
        id: '123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        // ... other fields
      };

      const apiUser = UserApiTransformer.toApi(domainUser);

      expect(apiUser.fullName).toBe('Doe, John');
      expect(apiUser.firstName).toBe('John');
      expect(apiUser.lastName).toBe('Doe');
    });

    it('should handle missing names gracefully', () => {
      const domainUser: Domain.User = {
        id: '123',
        firstName: '',
        lastName: '',
        email: 'test@example.com',
      };

      const apiUser = UserApiTransformer.toApi(domainUser);

      // Fallback to email or empty string
      expect(apiUser.fullName).toBeDefined();
    });
  });
});
```

### Migration Strategy

When introducing computed properties to replace stored fields:

1. **Add New Source Fields** (e.g., firstName, lastName)
2. **Keep Old Field** (e.g., name) marked as @deprecated
3. **Create Migration Script** to populate new fields from old field
4. **Update Transformers** to compute new display field (fullName)
5. **Update Frontend** to use computed field
6. **Remove Old Field** in next major version (v2.0.0)

Example migration:
```typescript
// Migration script: split name → firstName + lastName
await User.updateMany({}, [
  {
    $set: {
      lastName: { $arrayElemAt: [{ $split: ["$name", " "] }, -1] },
      firstName: {
        $reduce: {
          input: { $slice: [{ $split: ["$name", " "] }, 0, -1] },
          initialValue: "",
          in: { $concat: ["$$value", " ", "$$this"] }
        }
      }
    }
  }
]);
```

### Best Practices

1. **✅ DO** compute fields at API transformer layer
2. **✅ DO** include computed fields in API response types
3. **✅ DO** exclude computed fields from API request types
4. **✅ DO** use computed fields for display in frontend
5. **✅ DO** edit source fields in forms, not computed fields
6. **✅ DO** add indexes on source fields for sorting
7. **✅ DO** document which fields are computed with comments
8. **✅ DO** test computation logic in transformer tests

9. **❌ DON'T** store computed values in database
10. **❌ DON'T** compute in components (compute once in transformer)
11. **❌ DON'T** send computed fields in update/create requests
12. **❌ DON'T** duplicate computation logic across codebase
13. **❌ DON'T** make computed fields required in domain types
14. **❌ DON'T** add validation for computed fields in schemas

### Real-World Examples in Codebase

#### User Names (Implemented 2025-11-04)
- **Source**: `firstName`, `lastName`
- **Computed**: `fullName = "Lastname, Firstname"`
- **Location**: `UserApiTransformer.toApi()`
- **Files Modified**: 32 files across stack

#### Player Rankings (Implemented 2025-11-04)
- **Source**: `singlesRanking`, `doublesRanking`
- **Computed**: `rankingDisplay = "singles/doubles"`
- **Location**: `PlayerApiTransformer.toApi()`
- **Usage**: Player lists, match lineups, team management

#### User Display Name (Existing Pattern)
- **Source**: `fullName`, `email`
- **Computed**: `displayName = fullName || email`
- **Location**: `UserViewTransformers.toUserCard()`
- **Usage**: UI components, avatars

### Summary

The Computed Properties Pattern ensures:
- ✅ **Data Integrity**: Source fields are single source of truth
- ✅ **Consistency**: Computed values always match source fields
- ✅ **Maintainability**: Change format in one place
- ✅ **Performance**: No redundant storage
- ✅ **Type Safety**: Clear separation between source and derived data

**Golden Rule**: "If it can be computed from other fields, don't store it—compute it on-demand at the API layer."

---

## Key Design Principles

### 1. Single Source of Truth
- **Types:** All types in `shared/types/`, layered architecture
- **Validation:** Zod schemas in API layer, Mongoose schemas in models
- **Business Rules:** Services layer only
- **Computed Fields:** View layer transformers only

### 2. Layer Separation
- Controllers: HTTP handling, no business logic
- Services: Business logic, no HTTP knowledge
- Models: Data access, no business rules
- Transformers: Layer bridging, pure functions

### 3. Type Safety
- Strict TypeScript mode enabled
- No `any` types (use `unknown` if needed)
- All API responses typed with API layer types
- All components typed with View layer types

### 4. Data Transformation
- Transformers are pure functions
- One-way flow: never mutate input
- Computed fields only in View layer
- ID conversion: ObjectId → string at API boundary

### 5. Error Handling
- Custom error classes in `core/errors.ts`
- Controllers catch and pass to error middleware
- Services throw domain errors
- Frontend displays user-friendly messages

---

## Feature Modules

### 1. Member Management (User Management)
**Pages:** `/dashboard/members`
**Components:** `MemberCenter`, `EditMemberModal`, `BatchUpdateMembersModal`, `AddMemberModal`
**API:** `/api/users`

**Key Features:**
- **Search & Filter**: Search by name/email, filter by status (All/Active/Inactive) and role (Players/Admins)
- **Member List**: Display member details with actions (edit, delete)
- **Add Member**: Create new members with role, status, gender, and player registration
- **Edit Member**: Modify existing member details (read-only Member ID and creation date)
- **Batch Update**: Select multiple members and update role/status in bulk
- **Role Management**: Super Admin, Admin, Member
- **Status Tracking**: Active, Inactive, Suspended

**Data Flow:**
- View: `UserView.UserCard` (with statusBadge, roleBadge, displayName)
- API: `UserApi.UserResponse`
- Domain: `Domain.User`
- Persistence: `Persistence.UserDocument`

**UI Patterns:**

*Desktop View:*
- Multi-column data table with full member details (name, email, gender, birthday, status, role, invited date)
- Comprehensive table with 17+ members visible at once
- Sort by column headers
- Action icons for each member

*Mobile View:*
- Single-column card layout (simplified to name, status)
- Tappable filter tabs with counts
- Kebab menu for actions
- Truncated list with pagination (9 members shown)

**Modal Patterns:**

*Add/Edit Member Modal:*
- Desktop: Centered modal with multi-column potential
- Mobile: Full-screen overlay with vertical scroll
- Sections: Basic Info, Membership Details, System Info (edit only)
- Actions: Cancel, Add/Save buttons

*Batch Update Modal:*
- Desktop: Comprehensive modal with table-like member selection
- Mobile: Full-screen with expandable filter sections, card-based selection
- Features: Search/filter, Select All, checkbox selection, field update settings
- Shows selected member count in action button

### 2. Match Management
**Pages:** `/dashboard/matches`
**Components:** `MatchCenter`, `MatchCard`, `ScheduleMatchModal`, `EditMatchModal`, `MatchLineupModal`
**API:** `/api/matches`
**Key Features:**
- Schedule matches with teams and opponents
- Track match status (scheduled, ongoing, completed, cancelled)
- Manage lineups (assign players to positions)
- Record scores and results
- Player availability tracking

**Data Flow:**
- View: `MatchView.MatchCard` (with dateTimeDisplay, statusBadge, scoreDisplay, isToday, isTomorrow, daysRemaining, result)
- API: `MatchApi.MatchResponse`
- Domain: `Domain.Match`
- Persistence: `Persistence.MatchDocument`

**Key Pattern:** Services populate homeTeamName by fetching teams, transformers compute display fields (date calculations, result from scores).

### 3. Player Management
**Pages:** `/dashboard/members` (Players tab)
**Components:** `PlayersTab`, `PlayerCard`, `EditPlayerModal`
**API:** `/api/players`
**Key Features:**
- Player profiles with skills and positions
- Team affiliations
- Availability status
- Performance tracking

**Data Flow:**
- View: `PlayerView.PlayerCard`
- API: `PlayerApi.PlayerResponse`
- Domain: `Domain.Player`
- Persistence: `Persistence.PlayerDocument`

### 4. Team Management
**Pages:** `/dashboard/members` (Teams tab)
**Components:** `TeamManagementTab`, `CreateTeamModal`
**API:** `/api/teams`
**Key Features:**
- Create and manage teams
- Assign players to teams
- Captain designation

**Data Flow:**
- View: `TeamView.TeamCard`
- API: `TeamApi.TeamResponse`
- Domain: `Domain.Team`
- Persistence: `Persistence.TeamDocument`

### 5. Match Center (Unified Match Management Hub)
**Pages:** `/dashboard` (main dashboard component)
**Component:** `MatchCenter.tsx` (472 lines, parent with 5 lazy-loaded tabs)
**APIs:** `/api/teams`, `/api/players`, `/api/matches`
**Status:** Active, under optimization (see `openspec/changes/optimize-match-center/`)

#### Architecture Overview

**Component Hierarchy:**
```
MatchCenter (parent component)
├── Data Fetching: useTeamList(), usePlayerList(), useMatchList()
├── State: activeTab, search/filter state, 7 modal states
├── Mutations: deleteMatch, toggleAvailability, syncPlayers
│
├── PlayersTab (lazy-loaded via React.lazy + Suspense)
│   ├── Props: players, teams, callbacks
│   ├── Features: Search, filter by team, player status toggle
│   └── Actions: Edit player, team assignment, availability toggle
│
├── UpcomingMatchesTab (lazy-loaded)
│   ├── Props: matches, user
│   ├── Filters: All/Team 1/Team 2 matches
│   ├── Features: Match countdown, "View Details"
│   └── Display: Match cards with date/time, venue, opponent
│
├── MatchHistoryTab (lazy-loaded)
│   ├── Props: matches, yearFilter
│   ├── Filters: All/Team 1/Team 2, year selection
│   ├── Features: Historical results, scores
│   └── Display: Completed match cards with final scores
│
├── MatchManagementTab (admin only, lazy-loaded)
│   ├── Props: matches, onEdit, onDelete, onCreate
│   ├── Features: Global search (team/location/date/time)
│   ├── CRUD: Create, Edit, Delete matches
│   └── Lineup: Player assignment to match positions
│
└── TeamManagementTab (admin only, lazy-loaded)
    ├── Props: teams, players
    ├── Features: Create teams, view statistics
    └── Display: Team cards with player counts, gender breakdown, match level
```

#### Data Flow Pattern

**Current Implementation (Props Drilling):**
```typescript
// MatchCenter.tsx (parent)
const { data: teams } = TeamService.useTeamList();
const { data: players } = PlayerService.usePlayerList();
const { data: matches, refetch: refetchMatches } = MatchService.useMatchList();

// Props passed to tabs
<PlayersTab players={players} teams={teams} />
<UpcomingMatchesTab matches={matches} user={user} />
<MatchHistoryTab matches={matches} yearFilter={yearFilter} />
```

**Known Issue:** Parent fetches all data upfront. Tabs can't control their own loading states or optimize queries. Manual `refetchMatches()` after mutations fetches entire dataset.

**Planned Improvement:** Colocate data fetching in tabs, leverage React Query cache deduplication (see `openspec/changes/optimize-match-center/design.md` AD-1).

#### Tab-Specific Functional Points

##### 5.1 Players Tab
**Features:**
- **Search**: "Search players..." input for filtering by name
- **Team Filter**: "All Teams" dropdown for team-specific views
- **Player Table**: Sequential #, Name, Status (Active/Inactive), Teams (checkmarks), Actions
- **Player Status Toggle**: Toggle availability for matches
- **Player Edit**: Modify ranking (0-5000), status, team assignment, role

**Data:**
- View: `PlayerView.PlayerCard[]`
- Service: `PlayerService.usePlayerList()`

**UI Patterns:**
- Desktop: Multi-column table with full details, ~12+ players visible
- Mobile: Compact card layout with essential info (name, status, teams), 6 players visible

**Current Issues:**
- Props drilling from parent (players fetched in MatchCenter)
- No pagination (loads all players at once)

##### 5.2 Upcoming Matches Tab
**Features:**
- **Match Filtering**: "All Matches", "Team 1", "Team 2" radio button filters
- **Match Cards**: Team vs Opponent, Date/Time (full format: "Sonntag, 16.11.2025 um 14:00 Uhr"), Countdown (14 days, 21 days), Venue with full address
- **Quick Actions**: "View Details" button per match
- **Status Indicators**: "Geplant" (Planned) badge

**Data:**
- View: `MatchView.MatchCard[]` (filtered by scheduled status, date > now)
- Service: `MatchService.useMatchList()`

**Current Issues:**
- **Hardcoded team names**: Filters use `match.homeTeamName === 'Team 1'` instead of team.id
- **Client-side date comparison**: `new Date(match.date) > new Date()` causes timezone bugs (matches at midnight may show in wrong tab)
- Props drilling from parent

**Planned Fixes:**
- Use team.id for filtering (not hardcoded names)
- Server-side date filtering with UTC timestamps (AD-3)

##### 5.3 Match History Tab
**Features:**
- **Match Filtering**: "All Matches", "Team 1", "Team 2" filters
- **Year Filtering**: "All Years" dropdown for historical views
- **Match Results**: Team vs Opponent, Complete date/time, Venue, Final scores (0-0 displayed)
- **Chronological Organization**: Historical match listing
- **Details Access**: "View Details" for past match deep dive

**Data:**
- View: `MatchView.MatchCard[]` (filtered by completed status)
- Service: `MatchService.useMatchList()`

**UI Patterns:**
- Desktop: Match cards with full details
- Mobile: Condensed entries with essential result data (scores, dates, opponents)

**Current Issues:**
- Props drilling from parent
- No pagination for large historical datasets

##### 5.4 Match Management Tab (Admin Only)
**Features:**
- **Match Overview**: "9 von 9 Spielen" total count display
- **Global Search**: "Suchen nach Teams, Ort, Datum oder Uhrzeit..." comprehensive search
- **Team-Based Sections**: "Team 1 Management", "Team 2 Management" separate sections
- **Match Filtering**: "All Matches", "Team 1", "Team 2" with radio buttons
- **Match Cards**: Opponent, Date/Time, Venue (full address), Current scores
- **Quick Actions**: "Bearbeiten" (Edit), "Löschen" (Delete) per match
- **Create Match**: "+ Neues Spiel planen" button

**Modal Workflows:**

*Create Match Modal:*
- Required: Match Date (dd.mm.yyyy), Match Time, Location, Our Team
- Optional: Opponent team
- Clear date format placeholder guidance

*Edit Match Modal:*
- Pre-filled match data
- Status management ("Geplant" - Planned, "Abgeschlossen" - Completed)
- Comment/notes field
- Team selection

*Match Lineup Modal:*
- Sequential match positions (Men's Singles 1, 2, 3, Women's Singles, Men's Doubles 1, 2, etc.)
- Player selection dropdowns with confirmation checkmarks
- Doubles pairing capability (two players per doubles match)
- Position numbering for clear organization

**Data:**
- View: `MatchView.MatchCard[]`, `LineupView.LineupSlot[]`
- Service: `MatchService.useMatchList()`, mutations: `createMatch`, `updateMatch`, `deleteMatch`

**UI Patterns:**
- Desktop: Comprehensive match list with table-like structure
- Mobile: Stacked match cards, full-screen modals for create/edit

**Current Issues:**
- Manual `refetchMatches()` after mutations (fetches all matches, not optimistic updates)
- Inline error handling in lazy() (no Error Boundary, no retry mechanism)

##### 5.5 Team Management Tab (Admin Only)
**Features:**
- **Team Overview**: Visual cards for Team 1, Team 2 with clear separation
- **Team Statistics**:
  - Total Players count (e.g., "0 players" currently)
  - Gender breakdown: Male/Female counts
  - Match Level classification: "Class C", "Class F"
- **Team Creation**: "+ Create Team" button
- **Quick Metrics**: At-a-glance team composition and competitive level

**Data:**
- View: `TeamView.TeamCard[]`
- Service: `TeamService.useTeamList()`

**UI Patterns:**
- Desktop: Team cards with full statistics
- Mobile: Compact team cards, vertical stacking, essential metrics

**Current Issues:**
- Props drilling from parent (teams fetched in MatchCenter)

#### Performance Optimizations

**Implemented:**
1. **Lazy Loading**: All 5 tabs use `React.lazy()` with `Suspense` fallback
2. **Hover Preloading**: `handleTabHover()` preloads tab component on hover before click
3. **React Query Caching**: Service hooks use TanStack Query for automatic cache management

**Current Inline Error Handling (Issue):**
```typescript
const PlayersTab = lazy(() =>
  import('./matchTabs/PlayersTab').catch(err => {
    console.error('Error loading PlayersTab:', err);
    return { default: () => <div>Error loading tab</div> };
  })
);
```
**Problem:** No retry, no Error Boundary, basic error fallback.

**Planned (AD-5):**
```typescript
<ErrorBoundary fallback={<TabErrorFallback />}>
  <Suspense fallback={<TabLoader />}>
    <PlayersTab />
  </Suspense>
</ErrorBoundary>
```

#### Known Architectural Debt

1. **Props Drilling**: Parent fetches all data, passes to tabs → tight coupling, no lazy data fetching per tab
2. **Hardcoded Team Names**: Filters use `'Team 1'`, `'Team 2'` strings instead of team IDs → breaks if teams renamed
3. **Client-Side Date Logic**: Timezone-dependent date comparisons → midnight bugs
4. **No Pagination**: Loads all players/matches at once → performance degrades with large datasets (500+ matches)
5. **Manual Refetch**: `await refetchMatches()` after mutations → fetches entire dataset, no optimistic updates
6. **Type Mixing**: Some imports from `@app/lib/types` instead of `@club/shared-types/view/`
7. **Inline Error Handling**: lazy() catch blocks return simple error divs → no retry, no Error Boundary

#### Future Improvements (See optimize-match-center)

**Phase 2 (Bug Fixes):**
- Fix hardcoded team names with team.id filtering
- Add pagination (20 items per page)
- Server-side date filtering with UTC timestamps

**Phase 3 (Architecture Refactor):**
- Colocate data fetching in tabs (remove props drilling)
- Add Error Boundaries for graceful degradation
- Enforce View layer types (`@club/shared-types/view/`)
- Optimistic updates instead of manual refetch

**Phase 4 (Features):**
- Advanced filters (date range, multi-team selection)
- Bulk operations (multi-select players)
- Analytics dashboard (match statistics, player performance)

#### Maintenance Protocol

**After each tab improvement:**
1. Update this section with new architecture details
2. Document any new functional points or UI patterns
3. Update data flow diagrams if changed
4. Note resolved issues and any new technical debt
5. Keep performance optimizations list current

**Reference Documents:**
- `openspec/changes/optimize-match-center/design.md` - Architectural decisions and trade-offs
- `openspec/changes/optimize-match-center/proposal.md` - Current improvement proposal
- `openspec/specs/match-center-page-overview.md` - Functional requirements from screenshots

---

### 6. Training Management
**Pages:** `/dashboard/training`
**Components:** Training session scheduling
**API:** `/api/training` (if separate from matches)
**Key Features:**
- Schedule training sessions
- Track attendance
- Manage training content

### 7. Guest Player Management
**Pages:** `/dashboard/guests`
**Components:** Guest player registration
**API:** `/api/guests`
**Key Features:**
- Register temporary guest players
- Track guest participation
- Convert to members if needed

### 8. Membership Applications
**Pages:** `/dashboard/applications`
**Components:** Application review, PDF generation
**API:** `/api/membership-applications`
**Key Features:**
- Submit membership applications
- Admin review and approval workflow
- Generate PDF contracts
- Email notifications

---

## Development Guidelines

### Type System Rules

**❌ DON'T:**
```typescript
// ❌ Define local types in components
interface Member {
  _id: string;  // Wrong! Use shared types
  name: string;
}

// ❌ Use _id in frontend
const userId = user._id;

// ❌ Mix layer types
const apiResponse: Domain.User = await fetch(...);

// ❌ Manual transformations in components
const displayName = user.name || user.email;
```

**✅ DO:**
```typescript
// ✅ Import from shared types
import type { User } from '@app/lib/types';  // Re-exports UserView.UserCard

// ✅ Use id (not _id)
const userId = user.id;

// ✅ Use View types in components
const statusBadge = user.statusBadge;  // Computed in transformer

// ✅ Let services handle transformations
const users = await UserService.getUserCards();  // Returns View types
```

### Component Patterns

**Data Fetching:**
```typescript
// ✅ Use services, not direct API calls
const users = await UserService.getUserCards();

// ❌ Don't call API directly
const response = await fetch('/api/users');
const users = await response.json();
```

**Forms:**
```typescript
// ✅ Use *FormData types
const [formData, setFormData] = useState<UserFormData>({ ... });

// ✅ Let service handle transformation
await UserService.updateUser(userId, formData);

// ❌ Don't transform manually
const apiRequest = { ...formData, someField: transform(formData.field) };
```

**Display Computed Fields:**
```typescript
// ✅ Use pre-computed fields from View layer
<Badge className={user.statusBadge.className}>
  {user.statusBadge.label}
</Badge>

// ❌ Don't compute in component
<Badge className={getStatusClassName(user.membershipStatus)}>
  {getStatusLabel(user.membershipStatus)}
</Badge>
```

### File Naming Conventions

- **Components:** PascalCase (`MemberCenter.tsx`, `EditMemberModal.tsx`)
- **Hooks:** camelCase with `use` prefix (`useAuth.tsx`, `useMatchFilters.tsx`)
- **Services:** camelCase with `Service` suffix (`userService.ts`, `matchService.ts`)
- **Utils:** kebab-case (`match-utils.ts`, `date-utils.ts`)
- **Types:** camelCase (`types.ts`, `userTypes.ts`)

### Import Order
```typescript
// 1. External libraries
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. Shared types
import type { User, Match } from '@app/lib/types';
import { UserRole, MembershipStatus } from '@club/shared-types';

// 3. Services
import { UserService } from '@app/services/userService';

// 4. Components
import { Button } from '@app/components/ui/button';

// 5. Hooks
import { useAuth } from '@app/hooks/useAuth';

// 6. Utils
import { formatDate } from '@app/lib/utils';

// 7. Styles
import './styles.css';
```

### Code Organization

**Services:**
- One service per entity (`UserService`, `MatchService`)
- Static methods (no instances)
- Handle all data fetching and transformation
- Return View types to components

**Components:**
- Functional components with hooks
- Extract complex logic to custom hooks
- Keep components focused (single responsibility)
- Props typed with View layer types

**Transformers:**
- Pure functions (no side effects)
- One transformer file per entity
- Methods: `toUserCard()`, `toFormData()`, `toCreateRequest()`, etc.
- Located in `shared/types/src/view/transformers/`

### Testing Strategy

**Unit Tests:**
- Services: Mock API calls, test transformations
- Transformers: Test all conversion paths
- Utils: Test edge cases

**Integration Tests:**
- API endpoints: Test controller → service → model flow
- Test error handling
- Test validation

**E2E Tests (Future):**
- Critical user flows
- Authentication
- CRUD operations

---

## Common Pitfalls & Solutions

### Pitfall 1: Local Type Definitions
**Problem:** Component defines local `Member` interface
**Solution:** Use `User` from `@app/lib/types` (re-exports `UserView.UserCard`)

### Pitfall 2: Using `_id`
**Problem:** `member._id` causes TypeScript error
**Solution:** Use `member.id` (API/View layers use string IDs)

### Pitfall 3: Manual Transformations
**Problem:** Component computes badges, formatting manually
**Solution:** Use pre-computed fields from View layer (`statusBadge`, `displayName`)

### Pitfall 4: Direct API Calls
**Problem:** Component calls `fetch('/api/users')` directly
**Solution:** Use `UserService.getUserCards()` which handles transformation

### Pitfall 5: Mixing Layer Types
**Problem:** Controller returns `Domain.User` in API response
**Solution:** Transform to `UserApi.UserResponse` before sending

### Pitfall 6: Adding Redundant Properties
**Problem:** Adding `displayName` to API layer (it's computed)
**Solution:** Keep computed fields in View layer only

### Pitfall 7: Tight Coupling
**Problem:** Controller contains business logic
**Solution:** Move to Service layer, keep controllers thin

---

## Version History

- **v1.0** (2025-10-30): Initial comprehensive architecture document
  - Documented layered type system
  - Frontend/backend patterns
  - Development guidelines
  - Feature modules overview

---

## References

- [Type System Details](./architecture/system-layers.md)
- [Project Context](./project.md)
- [Cleanup Legacy Types Proposal](./changes/cleanup-legacy-types/proposal.md)
- [OpenSpec Conventions](./AGENTS.md)
