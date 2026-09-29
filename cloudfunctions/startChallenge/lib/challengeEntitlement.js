/**
 * cloudfunctions/startChallenge/lib/challengeEntitlement.js
 *
 * PAYMENT_STAGE5A_R6_CHALLENGE_ENTRY_AUTHORITY
 *
 * Single source of truth for "does this TRUSTED openid own the challenge_39_9
 * product entitlement?".
 *
 * It deliberately DELEGATES to the canonical server-side permission engine
 * (`permissionEngine.hasPermission`, which reads the `entitlements` collection
 * first — written by the payment finalizer — then falls back to `memberships`).
 * We must NOT create a second/divergent entitlement resolver, and we must NOT
 * derive ownership from `users.membershipLevel` or any client-provided flag.
 *
 * Product mapping (permissionEngine.PRODUCT_PERMISSIONS): challenge_39_9 grants
 * `challenge_full`. That permission is the authoritative challenge-access token.
 */

const permissionEngine = require('./permissionEngine.js')

// challenge_39_9 → PRODUCT_PERMISSIONS[challenge_39_9] includes 'challenge_full'.
const CHALLENGE_PERMISSION = 'challenge_full'

/**
 * @param {object} db
 * @param {string} openid — trusted caller identity (wxContext.OPENID)
 * @returns {Promise<boolean>}
 */
async function hasChallengeEntitlement (db, openid) {
  if (!openid) return false
  try {
    return (await permissionEngine.hasPermission(db, openid, CHALLENGE_PERMISSION)) === true
  } catch (_) {
    // fail-closed on the entitlement check would wrongly lock a paying user out;
    // but we must never award access on an error either. Deny (trial) is safe
    // because the owned-record precedence in startChallenge can still resume a
    // record the finalizer already unlocked.
    return false
  }
}

module.exports = { CHALLENGE_PERMISSION, hasChallengeEntitlement }
