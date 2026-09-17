export const TASTER_SESSION_COLLECTION = 'trialtrainings' as const;
export const TASTER_SESSION_PENDING_EMAIL_INDEX =
  'one_pending_taster_session_request_per_email' as const;
export const TASTER_SESSION_PENDING_EMAIL_INDEX_KEYS = { email: 1 } as const;
export const TASTER_SESSION_PENDING_EMAIL_INDEX_OPTIONS = {
  unique: true,
  partialFilterExpression: { status: 'pending' },
  name: TASTER_SESSION_PENDING_EMAIL_INDEX,
} as const;

export const TASTER_SESSION_INDEX_MANIFEST = [
  {
    keys: TASTER_SESSION_PENDING_EMAIL_INDEX_KEYS,
    options: TASTER_SESSION_PENDING_EMAIL_INDEX_OPTIONS,
  },
  {
    keys: { status: 1, archived: 1, createdAt: -1 },
    options: { name: 'status_1_archived_1_createdAt_-1' },
  },
  {
    keys: { playerLevel: 1 },
    options: { name: 'playerLevel_1' },
  },
] as const;
