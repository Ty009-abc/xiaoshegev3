/**
 * tools/rc83-stage21-release-safety/lib/allowlistGovernance.js
 *
 * P2 (R1) — Allowlist Drift Governance.
 *
 * The config fingerprint intentionally collapses allowlist identity to a
 * presence/count abstraction (see fingerprint.js). This is a DESIGN
 * LIMITATION, not a hash bug: a same-count membership replacement is NOT
 * DETECTABLE by the release fingerprint. This module declares that
 * capability/limitation as a machine-readable constant and defines the
 * CONTRACT for a future privileged control-plane verification (no identity
 * export, no raw identity artifact, no per-user stable hash).
 *
 * This module is CONTRACT-ONLY. It does NOT read the production allowlist and
 * does NOT implement any identity export.
 */

'use strict'

// ── Machine-readable capability / limitation declaration ──
var ALLOWLIST_CAPABILITY = {
  // The release/config fingerprint abstracts allowlist to presence/count.
  privacyFingerprintModel: 'PRESENCE_COUNT_ABSTRACTION',
  // Consequence of the privacy-safe abstraction.
  allowlistMembershipDriftDetection: 'REQUIRES_PRIVILEGED_CONTROL_PLANE_VERIFICATION',
  // Same-count member swap is structurally invisible to the fingerprint.
  sameCountMemberSwapDetectableByFingerprint: false,
}

// ── Privileged verification status enum (frozen) ──
// Answers ONLY: authorized-match / drift / not-verified. Never emits a member list.
var PRIVILEGED_VERIFICATION_STATUSES = [
  'AUTHORIZED_MATCH',
  'DRIFT_DETECTED',
  'NOT_VERIFIED',
]

function isValidVerificationStatus(v) {
  return PRIVILEGED_VERIFICATION_STATUSES.indexOf(v) !== -1
}

// ── Privileged verification CONTRACT (interface only, no implementation) ──
//
// A future control-plane verifier MUST satisfy ALL of the following:
//   - PRIVILEGED: requires elevated control-plane read access (not release repo).
//   - EPHEMERAL: no persistent artifact of raw identities.
//   - NO_RAW_IDENTITY_ARTIFACT: never writes the allowlist membership list.
//   - NO_IDENTITY_LOGGING: never logs openid/unionid/phone/etc.
//   - NO_STABLE_PER_USER_HASH: no reversible/stable per-user identity hash.
//   - OUTPUT: one of PRIVILEGED_VERIFICATION_STATUSES only.
var PRIVILEGED_VERIFICATION_CONTRACT = {
  access: 'PRIVILEGED_CONTROL_PLANE_READ_ONLY',
  ephemeral: true,
  noRawIdentityArtifact: true,
  noIdentityLogging: true,
  noStablePerUserHash: true,
  output: 'PRIVILEGED_VERIFICATION_STATUSES', // AUTHORIZED_MATCH | DRIFT_DETECTED | NOT_VERIFIED
}

module.exports = {
  ALLOWLIST_CAPABILITY: ALLOWLIST_CAPABILITY,
  PRIVILEGED_VERIFICATION_STATUSES: PRIVILEGED_VERIFICATION_STATUSES,
  PRIVILEGED_VERIFICATION_CONTRACT: PRIVILEGED_VERIFICATION_CONTRACT,
  isValidVerificationStatus: isValidVerificationStatus,
}
