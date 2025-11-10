# Layered Type System Architecture

## Overview

This type system implements a layered architecture pattern that provides clear separation of concerns across the application stack. Each layer has its own types, validation rules, and transformation logic, ensuring type safety from database to UI while maintaining flexibility and maintainability.

## Core Concepts

### Layered Architecture

The type system is organized into four distinct layers:

```
┌─────────────────────────────────────────────────┐
│                   View Layer                    │
│         (UI Components, Forms, Display)         │
└─────────────────┬───────────────────────────────┘
                  │ Transformers
┌─────────────────▼───────────────────────────────┐
│                   API Layer                     │
│       (HTTP Transport, Request/Response)        │
└─────────────────┬───────────────────────────────┘
                  │ Transformers
┌─────────────────▼───────────────────────────────┐
│                 Domain Layer                    │
│         (Business Logic, Validation)            │
└─────────────────┬───────────────────────────────┘
                  │ Transformers
┌─────────────────▼───────────────────────────────┐
│              Persistence Layer                  │
│        (Database, MongoDB, ObjectId)            │
└─────────────────────────────────────────────────┘
```

Each layer:
- Has its own dedicated type definitions
- Maintains clear boundaries with other layers
- Uses transformers for type-safe data flow
- Implements layer-specific validation
- Handles errors appropriate to its context

### Why Layered Types?

**Single Responsibility**: Each layer focuses on its specific concern—persistence handles database operations, domain handles business logic, API handles transport, and view handles display.

**Type Safety Across Boundaries**: Transformers ensure type-safe conversions between layers, catching errors at compile time rather than runtime.

**Maintainability**: Changes in one layer don't cascade through the entire application. Database schema changes are isolated to the persistence layer, UI changes to the view layer.

**Testability**: Each layer can be tested independently with mock data that matches its type contracts.

**Flexibility**: Different layers can evolve independently. You can change your database without affecting business logic or UI.

## Layer Definitions

### 1. Domain Layer

**Purpose**: Contains pure business logic types, independent of infrastructure or UI concerns.

**Location**: `shared/types/domain/`

**Characteristics**:
- No database-specific types (no ObjectId)
- No UI-specific fields (no display formatting)
- Pure business entities and rules
- Validation focused on business constraints

**Example**:
```typescript
// domain/player.ts
export namespace Domain {
  export interface Player {
    id: string;                    // UUID, not ObjectId
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: Date;             // Date object for business logic
    gender: Gender;
    isActivePlayer: boolean;
    teamIds: string[];
    createdAt: Date;
    updatedAt: Date;
  }

  export interface PlayerRegistration {
    personalInfo: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      dateOfBirth: Date;
    };
    emergencyContact: {
      name: string;
      phone: string;
      relationship: string;
    };
  }
}

// Validation schema - business rules
export const playerSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.email(),
  dateOfBirth: z.date().refine(
    (date) => isAtLeast16YearsOld(date),
    'Player must be at least 16 years old'
  )
});
```

**Benefits**:
- Reusable across different persistence implementations
- Easy to test business logic in isolation
- Clear business rules and constraints
- Technology-agnostic

### 2. Persistence Layer

**Purpose**: Handles database-specific types and operations.

**Location**: `shared/types/persistence/`

**Characteristics**:
- Extends domain types with database fields
- Uses MongoDB ObjectId types
- Includes database-specific metadata
- Inherits from BaseDocument for consistency

**Example**:
```typescript
// persistence/player.ts
import { Schema } from 'mongoose';
import { BaseDocument } from '../core/base';
import { Domain } from '../domain/player';

export interface PlayerPersistence
  extends Omit<Domain.Player, 'id' | 'createdAt' | 'updatedAt'>,
          BaseDocument {
  readonly _id: Schema.Types.ObjectId;  // MongoDB ID
  teamIds: Schema.Types.ObjectId[];     // References as ObjectId
}

// Validation schema - adds database constraints
export const playerPersistenceSchema = playerSchema
  .omit({ id: true })
  .extend({
    _id: z.custom<Schema.Types.ObjectId>(),
    teamIds: z.array(z.custom<Schema.Types.ObjectId>())
  });
```

**Benefits**:
- Type-safe database operations
- Clear mapping between domain and database
- Reuses domain validation logic
- Prevents mixing of ObjectId and string IDs

### 3. API Layer

**Purpose**: Handles HTTP transport and API contracts.

**Location**: `shared/types/api/`

**Characteristics**:
- Request and response types
- HTTP status codes and error responses
- Transport-layer validation
- Serializable data only (no Date objects, use ISO strings)

**Example**:
```typescript
// api/player.ts
export namespace Api {
  // Request types
  export interface CreatePlayerRequest {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;           // ISO date string for transport
    gender: string;
  }

  export interface UpdatePlayerRequest {
    firstName?: string;
    lastName?: string;
    email?: string;
    isActivePlayer?: boolean;
  }

  // Response types
  export interface PlayerResponse {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;           // ISO string
    gender: string;
    isActivePlayer: boolean;
    teamCount: number;             // Computed field
    createdAt: string;             // ISO string
    updatedAt: string;             // ISO string
  }

  export interface PlayersListResponse {
    players: PlayerResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }
}

// Validation schemas for API
export const createPlayerRequestSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.email(),
  phone: z.string().regex(/^\+?[\d\s-()]+$/),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(['male', 'female', 'other'])
});
```

**Benefits**:
- Clear API contracts
- Runtime validation of requests
- Serialization-safe types
- HTTP-specific error handling

### 4. View Layer

**Purpose**: Handles UI-specific types and display logic.

**Location**: `shared/types/view/`

**Characteristics**:
- UI-optimized data structures
- Display-specific fields
- Form types with validation messages
- Read-only types for display components

**Example**:
```typescript
// view/player.ts
export interface PlayerView {
  id: string;
  displayName: string;              // Computed: firstName + lastName
  email: string;
  phone: string;
  age: number;                      // Computed from dateOfBirth
  statusBadge: {
    text: string;
    color: 'green' | 'red' | 'gray';
  };
  teams: {
    id: string;
    name: string;
    role: string;
  }[];
}

export interface PlayerCardView {
  id: string;
  displayName: string;
  avatarUrl: string;
  status: 'active' | 'inactive';
  teamCount: number;
}

// Form types
export interface PlayerFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
}

export interface PlayerFormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
}

// Validation with user-friendly messages
export const playerFormSchema = z.object({
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters'),
  email: z.string()
    .email('Please enter a valid email address'),
  dateOfBirth: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
});
```

**Benefits**:
- Optimized for UI rendering
- User-friendly validation messages
- Display-specific computations
- Framework-agnostic view types

## Error Handling System

The error handling system follows the same layered architecture, providing type-safe error handling at each layer.

### Error Type Hierarchy

```typescript
// Base error interface
interface BaseError {
  code: string;
  message: string;
  timestamp: Date;
  stack?: string;
  details?: Record<string, unknown>;
}

// Layer-specific errors
namespace Domain {
  export interface Error extends BaseError {
    type: 'domain';
  }

  export interface ValidationError extends Error {
    code: 'DOMAIN_VALIDATION_ERROR';
    details: {
      field: string;
      constraint: string;
      value: unknown;
    };
  }

  export interface BusinessError extends Error {
    code: 'BUSINESS_RULE_VIOLATION';
    details: {
      rule: string;
      context?: Record<string, unknown>;
    };
  }
}

namespace Persistence {
  export interface Error extends BaseError {
    type: 'persistence';
  }

  export interface NotFoundError extends Error {
    code: 'ENTITY_NOT_FOUND';
    details: {
      collection: string;
      documentId: string;
    };
  }
}

namespace Api {
  export interface Error extends BaseError {
    type: 'api';
    statusCode: number;
  }

  export interface ValidationError extends Error {
    code: 'API_VALIDATION_ERROR';
    statusCode: 400;
    details: {
      validationErrors: Array<{
        field: string;
        message: string;
        rule?: string;
      }>;
    };
  }
}

namespace View {
  export interface Error extends BaseError {
    type: 'view';
    userMessage: string;
    recoverable: boolean;
  }

  export interface FormError extends Error {
    code: 'FORM_VALIDATION_ERROR';
    details: {
      fields: Array<{
        name: string;
        message: string;
        value?: unknown;
      }>;
    };
  }
}
```

### Error Transformation

Errors are transformed between layers using type-safe transformers:

```typescript
class ErrorTransformer {
  // Transform persistence error to API error
  static persistenceToApi(error: Persistence.Error): Api.Error {
    if (error.code === 'ENTITY_NOT_FOUND') {
      return {
        type: 'api',
        code: 'API_NOT_FOUND',
        message: `${error.details.collection} not found`,
        statusCode: 404,
        timestamp: error.timestamp,
        details: {
          resource: error.details.collection,
          id: error.details.documentId
        }
      };
    }
    // ... other transformations
  }

  // Transform API error to view error
  static apiToView(error: Api.Error): View.Error {
    if (error.code === 'API_VALIDATION_ERROR') {
      return {
        type: 'view',
        code: 'FORM_VALIDATION_ERROR',
        message: error.message,
        userMessage: 'Please fix the validation errors',
        recoverable: true,
        timestamp: error.timestamp,
        details: {
          fields: error.details.validationErrors
        }
      };
    }
    // ... other transformations
  }
}
```

### Error Factories

Type-safe error creation with validation:

```typescript
export const DomainErrors = {
  validation: (field: string, constraint: string, value: unknown) => ({
    type: 'domain' as const,
    code: 'DOMAIN_VALIDATION_ERROR',
    message: `Validation failed for field ${field}`,
    timestamp: new Date(),
    details: { field, constraint, value }
  }),

  businessRule: (rule: string, context?: Record<string, unknown>) => ({
    type: 'domain' as const,
    code: 'BUSINESS_RULE_VIOLATION',
    message: `Business rule violation: ${rule}`,
    timestamp: new Date(),
    details: { rule, context }
  })
};

export const ApiErrors = {
  validation: (errors: Array<{ field: string; message: string }>) => ({
    type: 'api' as const,
    code: 'API_VALIDATION_ERROR',
    statusCode: 400,
    message: 'Request validation failed',
    timestamp: new Date(),
    details: { validationErrors: errors }
  }),

  notFound: (resource: string, id: string) => ({
    type: 'api' as const,
    code: 'API_NOT_FOUND',
    statusCode: 404,
    message: `${resource} with id ${id} not found`,
    timestamp: new Date(),
    details: { resource, id }
  })
};
```

## Type Transformers

Transformers handle type-safe conversion between layers:

### Domain to Persistence

```typescript
class PlayerPersistenceTransformer {
  static toPersistence(player: Domain.Player): Omit<PlayerPersistence, keyof BaseDocument> {
    return {
      _id: new Types.ObjectId(player.id),
      firstName: player.firstName,
      lastName: player.lastName,
      email: player.email,
      phone: player.phone,
      dateOfBirth: player.dateOfBirth,
      gender: player.gender,
      isActivePlayer: player.isActivePlayer,
      teamIds: player.teamIds.map(id => new Types.ObjectId(id))
    };
  }

  static toDomain(doc: PlayerPersistence): Domain.Player {
    return {
      id: doc._id.toString(),
      firstName: doc.firstName,
      lastName: doc.lastName,
      email: doc.email,
      phone: doc.phone,
      dateOfBirth: doc.dateOfBirth,
      gender: doc.gender,
      isActivePlayer: doc.isActivePlayer,
      teamIds: doc.teamIds.map(id => id.toString()),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }
}
```

### Domain to API

```typescript
class PlayerApiTransformer {
  static toResponse(player: Domain.Player): Api.PlayerResponse {
    return {
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      email: player.email,
      phone: player.phone,
      dateOfBirth: player.dateOfBirth.toISOString().split('T')[0],
      gender: player.gender,
      isActivePlayer: player.isActivePlayer,
      teamCount: player.teamIds.length,
      createdAt: player.createdAt.toISOString(),
      updatedAt: player.updatedAt.toISOString()
    };
  }

  static fromRequest(req: Api.CreatePlayerRequest): Omit<Domain.Player, 'id' | 'teamIds' | 'createdAt' | 'updatedAt'> {
    return {
      firstName: req.firstName,
      lastName: req.lastName,
      email: req.email,
      phone: req.phone,
      dateOfBirth: new Date(req.dateOfBirth),
      gender: req.gender as Gender,
      isActivePlayer: true
    };
  }
}
```

### API to View

```typescript
class PlayerViewTransformer {
  static toPlayerView(response: Api.PlayerResponse): PlayerView {
    const age = calculateAge(new Date(response.dateOfBirth));

    return {
      id: response.id,
      displayName: `${response.firstName} ${response.lastName}`,
      email: response.email,
      phone: response.phone,
      age,
      statusBadge: {
        text: response.isActivePlayer ? 'Active' : 'Inactive',
        color: response.isActivePlayer ? 'green' : 'gray'
      },
      teams: [] // Would be populated from teams data
    };
  }

  static toCardView(response: Api.PlayerResponse): PlayerCardView {
    return {
      id: response.id,
      displayName: `${response.firstName} ${response.lastName}`,
      avatarUrl: `/avatars/${response.id}`,
      status: response.isActivePlayer ? 'active' : 'inactive',
      teamCount: response.teamCount
    };
  }
}
```

## Benefits

### 1. Type Safety

**Compile-time Guarantees**: TypeScript catches type mismatches before runtime
```typescript
// ✅ Compile error - caught early
const persistencePlayer: PlayerPersistence = domainPlayer;  // Error: missing _id

// ✅ Type-safe with transformer
const persistencePlayer = PlayerPersistenceTransformer.toPersistence(domainPlayer);
```

**Refactoring Confidence**: Changes propagate through the type system
```typescript
// Add a field to Domain.Player
interface Player {
  // ... existing fields
  membershipTier: 'bronze' | 'silver' | 'gold';  // New field
}

// TypeScript now requires updates to:
// - Persistence layer (schema, transformers)
// - API layer (request/response types)
// - View layer (display components)
```

### 2. Separation of Concerns

**Clear Boundaries**: Each layer handles its specific responsibilities
```typescript
// ✅ Domain layer - business logic only
function canPlayerJoinTeam(player: Domain.Player, team: Domain.Team): boolean {
  return player.isActivePlayer && team.hasOpenSlots();
}

// ✅ View layer - display logic only
function getPlayerStatusColor(player: PlayerView): string {
  return player.statusBadge.color;
}

// ❌ Would be wrong - mixing concerns
function canPlayerJoinTeam(player: PlayerView): boolean {
  // View types shouldn't contain business logic
}
```

### 3. Maintainability

**Isolated Changes**: Modify one layer without affecting others
```typescript
// Change database from MongoDB to PostgreSQL
// Only persistence layer changes needed
interface PlayerPersistence {
  id: number;  // Changed from ObjectId to number
  // ... other fields remain the same
}

// Domain, API, and View layers unchanged!
```

**Easy Testing**: Test each layer independently
```typescript
describe('Domain Layer', () => {
  it('validates player age', () => {
    const player: Domain.Player = createTestPlayer({ dateOfBirth: new Date('2020-01-01') });
    expect(isEligibleForCompetition(player)).toBe(false);
  });
});

describe('API Layer', () => {
  it('serializes dates correctly', () => {
    const response = PlayerApiTransformer.toResponse(domainPlayer);
    expect(response.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

### 4. Developer Experience

**Autocomplete**: IDE provides accurate suggestions for each layer
```typescript
// In a controller
const player: Domain.Player = // ... fetch from service
player.  // IDE suggests: firstName, lastName, email, etc.

// In a view component
const playerView: PlayerView = // ... from API
playerView.  // IDE suggests: displayName, statusBadge, age, etc.
```

**Self-Documenting**: Types serve as documentation
```typescript
// Clear what data is available at each layer
function displayPlayer(player: PlayerView) {
  // PlayerView type shows exactly what fields are available
  // and their computed values (age, displayName, etc.)
}
```

### 5. Flexibility

**Multiple Views**: Create different views for different contexts
```typescript
// List view - minimal data
interface PlayerListItemView {
  id: string;
  displayName: string;
  status: 'active' | 'inactive';
}

// Detail view - full data
interface PlayerDetailView extends PlayerView {
  teams: TeamCardView[];
  recentMatches: MatchSummaryView[];
  statistics: PlayerStatsView;
}

// Card view - optimized for cards
interface PlayerCardView {
  id: string;
  displayName: string;
  avatarUrl: string;
  teamCount: number;
}
```

**API Versioning**: Support multiple API versions
```typescript
namespace ApiV1 {
  export interface PlayerResponse {
    id: string;
    name: string;  // Combined name
  }
}

namespace ApiV2 {
  export interface PlayerResponse {
    id: string;
    firstName: string;  // Separated fields
    lastName: string;
  }
}
```

## Extending the System

### Adding a New Entity

1. **Create Domain Types**:
```typescript
// domain/match.ts
export namespace Domain {
  export interface Match {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    scheduledDate: Date;
    status: MatchStatus;
    score?: {
      home: number;
      away: number;
    };
  }
}

export const matchSchema = z.object({
  homeTeamId: z.string().uuid(),
  awayTeamId: z.string().uuid(),
  scheduledDate: z.date().min(new Date()),
  status: z.enum(MatchStatus)
});
```

2. **Create Persistence Types**:
```typescript
// persistence/match.ts
export interface MatchPersistence
  extends Omit<Domain.Match, 'id' | 'homeTeamId' | 'awayTeamId' | 'createdAt' | 'updatedAt'>,
          BaseDocument {
  readonly _id: Schema.Types.ObjectId;
  homeTeamId: Schema.Types.ObjectId;
  awayTeamId: Schema.Types.ObjectId;
}
```

3. **Create API Types**:
```typescript
// api/match.ts
export namespace Api {
  export interface MatchResponse {
    id: string;
    homeTeam: { id: string; name: string };
    awayTeam: { id: string; name: string };
    scheduledDate: string;
    status: string;
    score?: { home: number; away: number };
  }

  export interface CreateMatchRequest {
    homeTeamId: string;
    awayTeamId: string;
    scheduledDate: string;
  }
}
```

4. **Create View Types**:
```typescript
// view/match.ts
export interface MatchCardView {
  id: string;
  displayDate: string;  // "Today, 3:00 PM" or "Mon, Jan 1"
  homeTeam: {
    name: string;
    score?: number;
  };
  awayTeam: {
    name: string;
    score?: number;
  };
  statusBadge: {
    text: string;
    color: string;
  };
}
```

5. **Create Transformers**:
```typescript
// view/transformers/match.ts
export class MatchViewTransformer {
  static toCardView(match: Api.MatchResponse): MatchCardView {
    return {
      id: match.id,
      displayDate: formatMatchDate(match.scheduledDate),
      homeTeam: {
        name: match.homeTeam.name,
        score: match.score?.home
      },
      awayTeam: {
        name: match.awayTeam.name,
        score: match.score?.away
      },
      statusBadge: getMatchStatusBadge(match.status)
    };
  }
}
```

### Adding Computed Fields

```typescript
// domain/player.ts - add business logic
export namespace Domain {
  export interface Player {
    // ... existing fields
  }

  export interface PlayerWithStats extends Player {
    stats: {
      matchesPlayed: number;
      winRate: number;
      averageScore: number;
    };
  }
}

// api/player.ts - expose in API
export namespace Api {
  export interface PlayerWithStatsResponse extends PlayerResponse {
    stats: {
      matchesPlayed: number;
      winRate: number;
      averageScore: number;
    };
  }
}

// view/player.ts - format for display
export interface PlayerStatsView {
  matchesPlayed: string;     // "42 matches"
  winRate: string;           // "65%"
  averageScore: string;      // "4.2 / 5.0"
  performanceTrend: 'up' | 'down' | 'stable';
}
```

### Adding Validation Rules

```typescript
// domain/player.ts - business rules
export const playerBusinessRules = {
  minAge: 16,
  maxTeams: 3,

  canJoinTeam(player: Domain.Player, existingTeamCount: number): boolean {
    return existingTeamCount < this.maxTeams && player.isActivePlayer;
  }
};

// api/player.ts - API validation
export const createPlayerRequestSchema = z.object({
  // ... fields
}).refine(
  (data) => calculateAge(data.dateOfBirth) >= playerBusinessRules.minAge,
  { message: 'Player must be at least 16 years old' }
);

// view/forms/player.ts - form validation with user messages
export const playerFormSchema = z.object({
  dateOfBirth: z.string().refine(
    (date) => calculateAge(new Date(date)) >= 16,
    { message: 'You must be at least 16 years old to register' }
  )
});
```

### Adding Error Types

```typescript
// core/errors.ts
namespace Domain {
  export interface TeamFullError extends Error {
    code: 'TEAM_FULL';
    details: {
      teamId: string;
      maxPlayers: number;
      currentPlayers: number;
    };
  }
}

// core/errorFactories.ts
export const DomainErrors = {
  teamFull: (teamId: string, maxPlayers: number, currentPlayers: number) => ({
    type: 'domain' as const,
    code: 'TEAM_FULL',
    message: `Team ${teamId} is full`,
    timestamp: new Date(),
    details: { teamId, maxPlayers, currentPlayers }
  })
};

// core/errorTransformer.ts
static domainToApi(error: Domain.Error): Api.Error {
  if (error.code === 'TEAM_FULL') {
    return ApiErrors.validation([{
      field: 'teamId',
      message: 'This team has reached its maximum capacity',
      rule: 'capacity'
    }]);
  }
  // ... other transformations
}
```

## File Structure

```
shared/types/
├── core/                      # Core utilities
│   ├── errors.ts             # Error type definitions
│   ├── errorFactories.ts     # Error creation functions
│   ├── errorTransformer.ts   # Error transformation logic
│   ├── typeUtils.ts          # Type utility functions
│   └── validation.ts         # Validation utilities
│
├── domain/                    # Business logic types
│   ├── player.ts
│   ├── team.ts
│   ├── match.ts
│   └── user.ts
│
├── persistence/               # Database types
│   ├── player.ts
│   ├── team.ts
│   ├── match.ts
│   └── user.ts
│
├── api/                       # HTTP transport types
│   ├── player.ts
│   ├── team.ts
│   ├── match.ts
│   └── user.ts
│
├── view/                      # UI types
│   ├── player.ts
│   ├── team.ts
│   ├── match.ts
│   ├── user.ts
│   ├── forms/                # Form-specific types
│   │   ├── playerForm.ts
│   │   └── teamForm.ts
│   └── transformers/         # View transformers
│       ├── player.ts
│       ├── team.ts
│       └── match.ts
│
├── models/                    # Mongoose models
│   ├── base.ts
│   ├── player.ts
│   ├── team.ts
│   └── match.ts
│
└── enums.ts                   # Shared enumerations
```

## Best Practices

### 1. Type Safety

✅ **DO**:
```typescript
// Use transformers for layer transitions
const apiResponse = PlayerApiTransformer.toResponse(domainPlayer);

// Use factory functions for error creation
throw DomainErrors.validation('email', 'format', invalidEmail);

// Use type guards for runtime checks
if (ErrorTransformer.isDomainError(error)) {
  const apiError = ErrorTransformer.domainToApi(error);
}
```

❌ **DON'T**:
```typescript
// Mix types from different layers
const player: Domain.Player = apiResponse;  // Type error

// Create errors manually
throw { code: 'ERROR', message: 'Something went wrong' };

// Use type assertions to bypass checks
const domainPlayer = apiResponse as Domain.Player;  // Unsafe
```

### 2. Validation

✅ **DO**:
```typescript
// Validate at layer boundaries
const validatedRequest = createPlayerRequestSchema.parse(req.body);

// Use layer-appropriate validation
// Domain: business rules
// API: transport format
// View: user-friendly messages
```

❌ **DON'T**:
```typescript
// Skip validation
const player = await createPlayer(req.body);  // Unsafe

// Mix validation concerns
// Don't put business rules in view validation
```

### 3. Error Handling

✅ **DO**:
```typescript
// Transform errors between layers
try {
  await domainService.createPlayer(data);
} catch (error) {
  if (ErrorTransformer.isDomainError(error)) {
    const apiError = ErrorTransformer.domainToApi(error);
    return res.status(apiError.statusCode).json({ error: apiError });
  }
}
```

❌ **DON'T**:
```typescript
// Return domain errors directly to clients
catch (error) {
  return res.json({ error });  // Exposes internal details
}
```

### 4. Transformers

✅ **DO**:
```typescript
// Keep transformers pure and stateless
class PlayerTransformer {
  static toView(player: Api.PlayerResponse): PlayerView {
    return {
      displayName: `${player.firstName} ${player.lastName}`,
      // ... other fields
    };
  }
}

// Use transformer methods consistently
const playerView = PlayerViewTransformer.toView(apiResponse);
```

❌ **DON'T**:
```typescript
// Add side effects to transformers
static toView(player: Api.PlayerResponse): PlayerView {
  logPlayerView(player);  // Side effect
  return { /* ... */ };
}

// Transform manually without transformers
const playerView = {
  displayName: player.firstName + ' ' + player.lastName
};  // Not type-safe, error-prone
```

### 5. Code Organization

✅ **DO**:
```typescript
// Group related types by entity
shared/types/domain/player.ts
shared/types/api/player.ts
shared/types/view/player.ts

// Use barrel exports for clean imports
// shared/types/index.ts
export * from './domain';
export * from './api';
export * from './view';
export * from './core';

// Import from layer-specific paths
import { Domain } from '@shared-types/domain/player';
import { Api } from '@shared-types/api/player';
```

❌ **DON'T**:
```typescript
// Mix entity types in one file
shared/types/allTypes.ts  // Contains player, team, match, etc.

// Deep nested imports
import { Player } from '@shared-types/domain/entities/player/types';
```

## Migration Guide

### From Old Type System

If you're migrating from a non-layered type system:

**Step 1**: Identify your current types
```typescript
// Old system - mixed concerns
interface Player extends Document {
  _id: ObjectId;           // Persistence
  firstName: string;       // Domain
  lastName: string;        // Domain
  displayName: string;     // View
  createdAt: Date;        // Persistence
}
```

**Step 2**: Split into layers
```typescript
// Domain layer - business logic
namespace Domain {
  export interface Player {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActivePlayer: boolean;
  }
}

// Persistence layer - database
export interface PlayerPersistence
  extends Omit<Domain.Player, 'id'>, BaseDocument {
  readonly _id: Schema.Types.ObjectId;
}

// View layer - display
export interface PlayerView {
  id: string;
  displayName: string;      // Computed
  firstName: string;
  lastName: string;
  statusBadge: { text: string; color: string };
}
```

**Step 3**: Create transformers
```typescript
// Transform between layers
export class PlayerTransformer {
  static toDomain(doc: PlayerPersistence): Domain.Player {
    return {
      id: doc._id.toString(),
      firstName: doc.firstName,
      lastName: doc.lastName,
      email: doc.email,
      isActivePlayer: doc.isActivePlayer
    };
  }

  static toView(player: Domain.Player): PlayerView {
    return {
      id: player.id,
      displayName: `${player.firstName} ${player.lastName}`,
      firstName: player.firstName,
      lastName: player.lastName,
      statusBadge: {
        text: player.isActivePlayer ? 'Active' : 'Inactive',
        color: player.isActivePlayer ? 'green' : 'gray'
      }
    };
  }
}
```

**Step 4**: Update services and controllers
```typescript
// Before
class PlayerService {
  async getPlayer(id: string): Promise<Player> {
    return this.model.findById(id);
  }
}

// After
class PlayerService {
  async getPlayer(id: string): Promise<Domain.Player> {
    const doc = await this.model.findById(id);
    if (!doc) throw PersistenceErrors.notFound('Player', id);
    return PlayerTransformer.toDomain(doc);
  }
}

class PlayerController {
  async getPlayer(req: Request, res: Response) {
    try {
      const domainPlayer = await this.service.getPlayer(req.params.id);
      const apiResponse = PlayerApiTransformer.toResponse(domainPlayer);
      res.json({ success: true, data: apiResponse });
    } catch (error) {
      const apiError = this.handleError(error);
      res.status(apiError.statusCode).json({ success: false, error: apiError });
    }
  }
}
```

### Adding Error Handling

**Step 1**: Replace generic errors
```typescript
// Before
throw new Error('Player not found');
throw new Error('Validation failed');

// After
throw PersistenceErrors.notFound('Player', playerId);
throw DomainErrors.validation('email', 'format', email);
```

**Step 2**: Transform errors in controllers
```typescript
// Before
catch (error) {
  res.status(500).json({ error: error.message });
}

// After
catch (error) {
  const apiError = this.handleError(error);
  res.status(apiError.statusCode).json({
    success: false,
    error: apiError
  });
}

protected handleError(error: unknown): Api.Error {
  if (ErrorTransformer.isDomainError(error)) {
    return ErrorTransformer.domainToApi(error);
  }
  if (ErrorTransformer.isPersistenceError(error)) {
    return ErrorTransformer.persistenceToApi(error);
  }
  return ApiErrors.internal(error);
}
```

**Step 3**: Handle errors in UI
```typescript
// Before
catch (error) {
  alert('An error occurred');
}

// After
catch (error) {
  const viewError = ErrorTransformer.apiToView(error);
  if (viewError.code === 'FORM_VALIDATION_ERROR') {
    setFormErrors(viewError.details.fields);
  } else {
    showErrorNotification(viewError.userMessage);
  }
}
```

## Testing

### Unit Testing by Layer

**Domain Layer Tests**:
```typescript
describe('Domain.Player', () => {
  it('validates business rules', () => {
    const player: Domain.Player = createTestPlayer();
    expect(playerBusinessRules.canJoinTeam(player, 2)).toBe(true);
    expect(playerBusinessRules.canJoinTeam(player, 3)).toBe(false);
  });

  it('enforces age requirement', () => {
    expect(() => {
      playerSchema.parse({
        ...validPlayerData,
        dateOfBirth: new Date('2020-01-01')
      });
    }).toThrow();
  });
});
```

**API Layer Tests**:
```typescript
describe('PlayerApiTransformer', () => {
  it('converts dates to ISO strings', () => {
    const domainPlayer = createTestPlayer({
      createdAt: new Date('2024-01-01T10:00:00Z')
    });
    const apiResponse = PlayerApiTransformer.toResponse(domainPlayer);
    expect(apiResponse.createdAt).toBe('2024-01-01T10:00:00.000Z');
  });

  it('computes team count', () => {
    const domainPlayer = createTestPlayer({
      teamIds: ['team1', 'team2', 'team3']
    });
    const apiResponse = PlayerApiTransformer.toResponse(domainPlayer);
    expect(apiResponse.teamCount).toBe(3);
  });
});
```

**View Layer Tests**:
```typescript
describe('PlayerViewTransformer', () => {
  it('creates display name', () => {
    const apiResponse: Api.PlayerResponse = {
      firstName: 'John',
      lastName: 'Doe',
      // ... other fields
    };
    const view = PlayerViewTransformer.toView(apiResponse);
    expect(view.displayName).toBe('John Doe');
  });

  it('computes status badge', () => {
    const activePlayer = createApiResponse({ isActivePlayer: true });
    const inactivePlayer = createApiResponse({ isActivePlayer: false });

    expect(PlayerViewTransformer.toView(activePlayer).statusBadge).toEqual({
      text: 'Active',
      color: 'green'
    });
    expect(PlayerViewTransformer.toView(inactivePlayer).statusBadge).toEqual({
      text: 'Inactive',
      color: 'gray'
    });
  });
});
```

**Error Handling Tests**:
```typescript
describe('ErrorTransformer', () => {
  it('transforms persistence errors to API errors', () => {
    const persistenceError = PersistenceErrors.notFound('Player', 'id123');
    const apiError = ErrorTransformer.persistenceToApi(persistenceError);

    expect(apiError.type).toBe('api');
    expect(apiError.statusCode).toBe(404);
    expect(apiError.code).toBe('API_NOT_FOUND');
  });

  it('transforms API validation errors to form errors', () => {
    const apiError = ApiErrors.validation([
      { field: 'email', message: 'Invalid email format' }
    ]);
    const viewError = ErrorTransformer.apiToView(apiError);

    expect(viewError.type).toBe('view');
    expect(viewError.code).toBe('FORM_VALIDATION_ERROR');
    expect(viewError.recoverable).toBe(true);
  });
});
```

### Integration Testing

```typescript
describe('Player API Integration', () => {
  it('handles full request-response cycle', async () => {
    // API Request
    const request: Api.CreatePlayerRequest = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      dateOfBirth: '1990-01-01',
      gender: 'male'
    };

    // Create player through full stack
    const response = await request(app)
      .post('/api/players')
      .send(request)
      .expect(201);

    // Verify response type
    const playerResponse: Api.PlayerResponse = response.body.data;
    expect(playerResponse.id).toBeDefined();
    expect(playerResponse.firstName).toBe('John');
    expect(playerResponse.teamCount).toBe(0);

    // Verify database
    const doc = await PlayerModel.findById(playerResponse.id);
    expect(doc).toBeDefined();
    expect(doc!.firstName).toBe('John');
  });

  it('handles validation errors correctly', async () => {
    const invalidRequest = {
      firstName: 'J',  // Too short
      lastName: 'Doe',
      email: 'invalid-email',  // Invalid format
      dateOfBirth: '2020-01-01',  // Too young
      gender: 'male'
    };

    const response = await request(app)
      .post('/api/players')
      .send(invalidRequest)
      .expect(400);

    const error: Api.ValidationError = response.body.error;
    expect(error.code).toBe('API_VALIDATION_ERROR');
    expect(error.details.validationErrors).toHaveLength(3);
  });
});
```

## Troubleshooting

### Common Issues

**Issue**: Type mismatch between layers
```typescript
// Error: Type 'Date' is not assignable to type 'string'
const apiResponse: Api.PlayerResponse = domainPlayer;
```
**Solution**: Use transformers
```typescript
const apiResponse = PlayerApiTransformer.toResponse(domainPlayer);
```

---

**Issue**: ObjectId vs string confusion
```typescript
// Error: Type 'string' is not assignable to type 'ObjectId'
const doc: PlayerPersistence = { teamIds: ['team1', 'team2'] };
```
**Solution**: Use correct types for each layer
```typescript
// Domain uses strings
const domain: Domain.Player = { teamIds: ['team1', 'team2'] };

// Persistence uses ObjectId
const persistence = PlayerPersistenceTransformer.toPersistence(domain);
// persistence.teamIds is ObjectId[]
```

---

**Issue**: Errors not transformed correctly
```typescript
// Frontend receives internal error details
throw new Error('Database connection failed');
```
**Solution**: Use error factories and transformers
```typescript
// In service
throw PersistenceErrors.database('find', 'Player', error);

// In controller
const apiError = ErrorTransformer.persistenceToApi(error);
res.status(apiError.statusCode).json({ error: apiError });
```

---

**Issue**: Validation not working
```typescript
// No validation errors thrown for invalid data
await PlayerModel.create(invalidData);
```
**Solution**: Use validation schemas
```typescript
// Validate before persistence
const validated = createPlayerRequestSchema.parse(request);
const domainPlayer = PlayerApiTransformer.fromRequest(validated);
await playerService.create(domainPlayer);
```

## Performance Considerations

### Transformer Overhead

Transformers add a small overhead but provide significant benefits:

```typescript
// Negligible overhead for simple transformations
const apiResponse = PlayerApiTransformer.toResponse(domainPlayer);
// ~0.1ms per transformation

// For bulk operations, consider batch transformations
const apiResponses = players.map(p => PlayerApiTransformer.toResponse(p));
// Still very fast, ~10ms for 1000 players
```

### Validation Caching

```typescript
// Cache compiled schemas for reuse
const compiledSchema = z.object({ /* ... */ });

// Reuse across requests
app.post('/players', (req, res) => {
  const validated = compiledSchema.parse(req.body);
  // ...
});
```

### Selective Field Loading

```typescript
// Load only required fields at persistence layer
const player = await PlayerModel.findById(id)
  .select('firstName lastName email')
  .lean();

// Transform to domain with partial data
const domainPlayer = PlayerPersistenceTransformer.toDomain(player);

// API response only includes loaded fields
const apiResponse = PlayerApiTransformer.toResponse(domainPlayer);
```

## Summary

The layered type system provides:

1. **Type Safety**: Compile-time guarantees across the entire stack
2. **Separation of Concerns**: Each layer handles its specific responsibilities
3. **Maintainability**: Changes isolated to relevant layers
4. **Testability**: Easy to test each layer independently
5. **Flexibility**: Support multiple views and API versions
6. **Developer Experience**: Better autocomplete and self-documenting code
7. **Error Handling**: Consistent, type-safe error handling across layers
8. **Scalability**: Easy to extend with new entities and features

By following this architecture, you ensure consistent type safety from database to UI, reduce bugs, improve maintainability, and provide a better developer experience.