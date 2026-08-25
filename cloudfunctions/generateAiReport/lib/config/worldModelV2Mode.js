/**
 * lib/config/worldModelV2Mode.js
 *
 * RC8.3 Stage 17A — World Model V2 runtime mode + single-user allowlist.
 *
 * Independent from world_model_v1 config (worldModelWhitelist.js / rolloutMode.js).
 * V2 is NEVER controlled by the V1 MODE / allowlist.
 *
 * Env:
 *   RC83_WORLD_MODEL_V2_MODE      = SHADOW | SELECTIVE_PRIMARY
 *   RC83_WORLD_MODEL_V2_ALLOWLIST = comma-separated openids
 *
 * Fail-closed: missing / malformed / empty / invalid → SHADOW, authorize nobody.
 */

// ═══════════════════════════════════════════════════════════════
// Mode
// ═══════════════════════════════════════════════════════════════

function parseV2Mode(raw) {
  if (!raw || typeof raw !== 'string') return 'SHADOW'
  var mode = raw.trim().toUpperCase()
  if (mode === 'SELECTIVE_PRIMARY') return 'SELECTIVE_PRIMARY'
  // SHADOW or any invalid value → SHADOW (fail-closed)
  return 'SHADOW'
}

function getV2ModeFromEnv() {
  try { return process.env.RC83_WORLD_MODEL_V2_MODE || 'SHADOW' }
  catch (e) { return 'SHADOW' }
}

// ═══════════════════════════════════════════════════════════════
// Allowlist
// ═══════════════════════════════════════════════════════════════

function parseV2Allowlist(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return new Set()
  try {
    return new Set(
      raw.split(',')
        .map(function (e) { return e.trim() })
        .filter(function (e) { return e.length > 0 })
    )
  } catch (e) {
    return new Set() // malformed → fail closed
  }
}

function getV2AllowlistFromEnv() {
  try { return process.env.RC83_WORLD_MODEL_V2_ALLOWLIST || '' }
  catch (e) { return '' }
}

// ═══════════════════════════════════════════════════════════════
// Authorization (single-user gate)
// ═══════════════════════════════════════════════════════════════

function isV2PrimaryAuthorized(openid, raw) {
  if (!openid || typeof openid !== 'string' || openid.trim() === '') return false
  try {
    return parseV2Allowlist(raw).has(openid)
  } catch (e) {
    return false // fail closed
  }
}

module.exports = {
  parseV2Mode,
  getV2ModeFromEnv,
  parseV2Allowlist,
  getV2AllowlistFromEnv,
  isV2PrimaryAuthorized,
}
