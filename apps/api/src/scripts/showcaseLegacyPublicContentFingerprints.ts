// Normalized business-field SHA-256 fingerprints of pre-Issue-14 defaults.
// Provenance: private release-source snapshot 02dad2b9a713166b84eec0552da64f49316112f4.
// History is not required by this public artifact.
// canonicalContentDefaults.ts: singleton content and Contact fields (persisted QR defaults).
// bootstrapCanonicalContent.ts: canonicalLocations, excluding creator/updater identities.
// Object keys are sorted; array order and exact text are preserved. No raw legacy content is retained.
export const SHOWCASE_LEGACY_PUBLIC_CONTENT = {
  CANONICAL_HOMEPAGE_CONTENT:
    '58bd4bab85c04480002aa0f95f628f62dba10d6c52f710b8d7ffd8ee4d4e7d78',
  CANONICAL_CLUB_INFORMATION:
    '5b3b7b6e450b7d043e7452c2e43b9a6cba0957b1d0171f603071217fc93a4768',
  contacts: [
    '94e91d25d94416664b0ec3ff1eebe2a56cd673e4f04cfe062ba67be0f588095d',
    '2c081cf6652481b43dbbb43ef2e313235e0df881674887ba8dea406060d5dd66',
  ],
  CANONICAL_TASTER_SESSION_PUBLIC_CONTENT:
    'beb44a730e8af690b496acc181fb200f69b6bedc7961b611226c3d5d4145dac6',
  CANONICAL_MEMBERSHIP_PUBLIC_CONTENT:
    '65101373d1a12cfce184a4120d5e7a30aab1195f6aebe2a2f2e11b816f114ff5',
  CANONICAL_RECRUITMENT_PUBLIC_CONTENT:
    'bb0f132c87d48eefa4cc84029c12fcce93a42869e160bc7140ca4cf1001bae08',
  locations: [
    '79001a5a94a3ab3732c714d344370f9cc93e66f822385bc105c9f99061dd84d1',
    '6a9b6e892b11e2899d02f14da5ab9228d299cde25ee6ab173e86e7561640d6db',
  ],
} as const;
