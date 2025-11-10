// shared/types/index.ts

// Core Infrastructure Types
export * from './core/enums';
export * from './core/base';
export * from './core/middlewareAuth';
export * from './core/errors';

// Note: Validation exports skipped to avoid ValidationError conflict with base.ts
// Import directly from '@club/shared-types/core/validation' if needed

// Layered Architecture Exports
// Domain Layer
export * as Domain from './domain/user';
export * as DomainPlayer from './domain/player';
export * as DomainTeam from './domain/team';
export * as DomainMatch from './domain/match';
export * as DomainMembershipApplication from './domain/membershipApplication';
export * as DomainPdf from './domain/pdf';

// API Layer
export * as Api from './api/user';
export * as ApiPlayer from './api/player';
export * as ApiTeam from './api/team';
export * as ApiMatch from './api/match';
export * as ApiMembershipApplication from './api/membershipApplication';
export * as ApiPdf from './api/pdf';

// View Layer
export * as View from './view/user';
export * as ViewTeam from './view/team';
export * as ViewMatch from './view/match';
export * as ViewMembershipApplication from './view/membershipApplication';
export * as ViewPdf from './view/pdf';