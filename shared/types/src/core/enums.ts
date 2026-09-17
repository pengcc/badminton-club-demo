// shared/types/core/enums.ts
export enum AccountKind {
  PERSON = 'person',
  SUPER_ADMIN = 'super_admin',
}

/**
 * Access levels for navigation and feature visibility
 */
export type AccessLevel = 'all' | 'admin' | 'player';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  NON_BINARY = 'non-binary',
}

export enum PlayerGender {
  MALE = Gender.MALE,
  FEMALE = Gender.FEMALE,
}

export enum MatchDirection {
  HOME = 'home',
  AWAY = 'away',
}

export enum MatchListView {
  ALL = 'all',
  UPCOMING = 'upcoming',
  HISTORY = 'history',
}

export enum MatchOutcome {
  WIN = 'win',
  LOSS = 'loss',
  DRAW = 'draw',
}

export enum MatchAvailabilityParticipation {
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
}

export enum Language {
  ENGLISH = 'en',
  GERMAN = 'de',
  CHINESE = 'zh',
}

export enum LineupPosition {
  MEN_SINGLES_1 = 'men_singles_1',
  MEN_SINGLES_2 = 'men_singles_2',
  OPEN_SINGLES = 'open_singles',
  WOMEN_SINGLES = 'women_singles',
  MENS_DOUBLES = 'mens_doubles',
  OPEN_DOUBLES = 'open_doubles',
  WOMEN_DOUBLES = 'women_doubles',
  MIXED_DOUBLES = 'mixed_doubles',
}

export enum LineupViolationCode {
  PLAYER_REFERENCE_UNAVAILABLE = 'player_reference_unavailable',
  PLAYER_NOT_CURRENTLY_ELIGIBLE = 'player_not_currently_eligible',
  PLAYER_NOT_ON_MATCH_TEAM = 'player_not_on_match_team',
  PLAYER_UNAVAILABLE = 'player_unavailable',
  POSITION_GENDER_MISMATCH = 'position_gender_mismatch',
  MIXED_PAIR_COMPOSITION_INVALID = 'mixed_pair_composition_invalid',
  POSITION_CAPACITY_EXCEEDED = 'position_capacity_exceeded',
  DUPLICATE_POSITION_ASSIGNMENT = 'duplicate_position_assignment',
  PLAYER_EVENT_LIMIT_EXCEEDED = 'player_event_limit_exceeded',
  PLAYER_MULTIPLE_SINGLES = 'player_multiple_singles',
  DISTINCT_PLAYER_LIMIT_EXCEEDED = 'distinct_player_limit_exceeded',
}

export enum MembershipStatus {
  ACTIVE = 'active',
  PASSIVE = 'passive',
  INACTIVE = 'inactive',
}

export enum MembershipTerminationStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EFFECTIVE = 'effective',
}

export enum MembershipTerminationSource {
  ONLINE = 'online',
  EMAIL = 'email',
  PHONE = 'phone',
  IN_PERSON = 'in_person',
  OTHER = 'other',
  BATCH = 'batch',
}

export enum AccountOnboardingStatus {
  READY = 'ready',
  PASSWORD_SETUP_PENDING = 'password_setup_pending',
  PASSWORD_SETUP_EXPIRED = 'password_setup_expired',
}

export enum PlayerType {
  MEMBER = 'member',
  EXTERNAL = 'external',
}

/**
 * Backend-authoritative capabilities derived from current User and Player state.
 */
export enum Capability {
  ADMINISTRATION = 'administration',
  AUTHENTICATED_ACCOUNT = 'authenticated_account',
  CURRENT_MEMBER = 'current_member',
  ACTIVE_PLAYER = 'active_player',
  EXTERNAL_PLAYER = 'external_player',
  MEMBERSHIP_SELF_SERVICE = 'membership_self_service',
}

export enum MemberListFilter {
  CURRENT = 'current',
  ACTIVE = 'active',
  PASSIVE = 'passive',
  INACTIVE = 'inactive',
  ALL = 'all',
}

export enum MembershipType {
  REGULAR = 'regular',
  STUDENT = 'student',
}

export enum MemberApplicationStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
  /** @deprecated Use PENDING. */
  PENDING_REVIEW = 'pending',
  /** @deprecated Use APPROVED. */
  APPLICATION_APPROVED = 'approved',
  /** @deprecated Use REJECTED. */
  APPLICATION_REJECTED = 'rejected',
}

export enum TeamLevel {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F',
  G = 'G',
}

export enum TeamRole {
  PLAYER = 'player',
  CAPTAIN = 'captain',
  VICE_CAPTAIN = 'vice-captain',
}

export enum PlayerPosition {
  SINGLES = 'singles',
  DOUBLES = 'doubles',
  MIXED_DOUBLES = 'mixed-doubles',
}

/**
 * HTTP status codes enum
 */
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_ERROR = 500,
}

/**
 * Audit log event types
 */
export enum AuditEventType {
  // User events
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  USERS_BATCH_UPDATED = 'users_batch_updated',
  USER_PLAYER_STATUS_CHANGED = 'user_player_status_changed',
  USER_INVITATION_SENT = 'user_invitation_sent',
  USER_EMAIL_CHANGED = 'user_email_changed',
  MEMBERSHIP_LIFECYCLE_CHANGED = 'membership_lifecycle_changed',
  MEMBERSHIP_TERMINATION_REQUESTED = 'membership_termination_requested',
  MEMBERSHIP_TERMINATION_APPROVED = 'membership_termination_approved',
  MEMBERSHIP_TERMINATION_REJECTED = 'membership_termination_rejected',
  MEMBERSHIP_TERMINATION_RECORDED = 'membership_termination_recorded',
  MEMBERSHIP_TERMINATION_BATCH_RECORDED = 'membership_termination_batch_recorded',
  MEMBERSHIP_TERMINATION_EFFECTIVE = 'membership_termination_effective',

  // Team events
  TEAM_CREATED = 'team_created',
  TEAM_UPDATED = 'team_updated',
  TEAM_DELETED = 'team_deleted',
  TEAM_PLAYER_ADDED = 'team_player_added',
  TEAM_PLAYER_REMOVED = 'team_player_removed',

  // Player events
  PLAYER_UPDATED = 'player_updated',
  PLAYER_STATUS_CHANGED = 'player_status_changed',
  PLAYER_DELETED = 'player_deleted',
  PLAYERS_BATCH_UPDATED = 'players_batch_updated',

  // Match events
  MATCH_CREATED = 'match_created',
  MATCH_UPDATED = 'match_updated',
  MATCH_DELETED = 'match_deleted',
  MATCH_RESULT_RECORDED = 'match_result_recorded',
  MATCH_RESULT_CORRECTED = 'match_result_corrected',
  /** @deprecated Read-only recognition for retained audit history. */
  MATCH_SCORE_UPDATED = 'match_score_updated',
  /** @deprecated Read-only recognition for retained audit history. */
  MATCH_STATUS_CHANGED = 'match_status_changed',

  // Membership application events
  APPLICATION_CREATED = 'application_created',
  APPLICATION_UPDATED = 'application_updated',
  APPLICATION_APPROVED = 'application_approved',
  APPLICATION_REJECTED = 'application_rejected',
  APPLICATION_DELETED = 'application_deleted',
  APPLICATION_CONTACTED = 'application_contacted',

  // Settings events
  SETTINGS_UPDATED = 'settings_updated',

  // Email template events
  EMAIL_TEMPLATE_CREATED = 'email_template_created',
  EMAIL_TEMPLATE_UPDATED = 'email_template_updated',
  EMAIL_TEMPLATE_DELETED = 'email_template_deleted',

  // Guest Play events
  GUEST_PLAY_DECIDED = 'guest_play_decided',
  GUEST_PLAY_DECISION_CORRECTED = 'guest_play_decision_corrected',
  GUEST_PLAY_ARCHIVED = 'guest_play_archived',
  GUEST_PLAY_RESTORED = 'guest_play_restored',
}

/**
 * Entity types for audit logging
 */
export enum EntityType {
  USER = 'User',
  TEAM = 'Team',
  PLAYER = 'Player',
  MATCH = 'Match',
  MEMBERSHIP_APPLICATION = 'MembershipApplication',
  MEMBERSHIP_TERMINATION = 'MembershipTermination',
  SETTINGS = 'Settings',
  EMAIL_TEMPLATE = 'EmailTemplate',
  GUEST_PLAY = 'GuestPlay',
}

/**
 * Audit action types
 */
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  BATCH = 'BATCH',
}
