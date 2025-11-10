// shared/types/core/enums.ts
export enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member',
  APPLICANT = 'applicant', // for membership application process
  GUEST_PLAYER = 'guest_player' // External player with limited access or Short-term participant
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  NON_BINARY = 'non-binary'
}

export enum PlayerGender{
  MALE = Gender.MALE,
  FEMALE = Gender.FEMALE
}

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum Language {
  ENGLISH = 'en',
  GERMAN = 'de',
  CHINESE = 'zh'
}

export enum LineupPosition {
  MEN_SINGLES_1 = 'men_singles_1',
  MEN_SINGLES_2 = 'men_singles_2',
  MEN_SINGLES_3 = 'men_singles_3',
  WOMEN_SINGLES = 'women_singles',
  MENS_DOUBLES_1 = 'mens_doubles_1',
  MENS_DOUBLES_2 = 'mens_doubles_2',
  WOMEN_DOUBLES = 'women_doubles',
  MIXED_DOUBLES = 'mixed_doubles'
}

export enum MembershipStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

export enum MembershipType {
  REGULAR = 'regular',
  STUDENT = 'student'
}

export enum MemberApplicationStatus {
  PENDING_REVIEW = 'pending',
  APPLICATION_APPROVED = 'approved',
  APPLICATION_REJECTED = 'rejected'
}

export enum TeamLevel {
  C = 'Class C',
  F = 'Class F'
}

export enum TeamRole {
  PLAYER = 'player',
  CAPTAIN = 'captain',
  VICE_CAPTAIN = 'vice-captain'
}

export enum PlayerPosition {
  SINGLES = 'singles',
  DOUBLES = 'doubles',
  MIXED_DOUBLES = 'mixed-doubles'
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
  INTERNAL_ERROR = 500
}
