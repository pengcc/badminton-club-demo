export const COMBINED_DEVELOPMENT_SESSION_ENV =
  'CLUB_COMBINED_DEVELOPMENT_SESSION';

export const DEVELOPMENT_API_STARTUP_SIGNALS = Object.freeze({
  ready: '@club/api-startup:v1:ready',
  initialMongoFailure: '@club/api-startup:v1:blocked:mongo-connect',
  listenerFailure: '@club/api-startup:v1:blocked:listener',
});
