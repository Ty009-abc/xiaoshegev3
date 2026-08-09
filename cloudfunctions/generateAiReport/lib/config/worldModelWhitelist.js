/**
 * lib/config/worldModelWhitelist.js
 *
 * RC8.3 Phase-2 003B — World Model Whitelist Authorization.
 *
 * Server-side allowlist for world_model_v1 shadow access.
 * Identity: wxContext.OPENID only. Client-supplied openid not trusted.
 *
 * Fail-closed: missing/malformed/empty env → authorize nobody.
 */

// ═══════════════════════════════════════════════════════════════
// Parse raw env var into deduplicated set
// ═══════════════════════════════════════════════════════════════

function parseWorldModelAllowlist(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return new Set()
  }

  try {
    var entries = raw
      .split(',')
      .map(function (e) { return e.trim() })
      .filter(function (e) { return e.length > 0 })

    return new Set(entries)
  } catch (e) {
    // malformed → fail closed
    return new Set()
  }
}

// ═══════════════════════════════════════════════════════════════
// Check authorization
// ═══════════════════════════════════════════════════════════════

function isWorldModelAuthorized(openid, raw) {
  if (!openid || typeof openid !== 'string' || openid.trim() === '') {
    return false
  }

  try {
    var allowlist = parseWorldModelAllowlist(raw)
    return allowlist.has(openid)
  } catch (e) {
    return false // fail closed
  }
}

// ═══════════════════════════════════════════════════════════════
// Load from environment
// ═══════════════════════════════════════════════════════════════

function getAllowlistFromEnv() {
  try {
    return process.env.RC83_WORLD_MODEL_ALLOWLIST || ''
  } catch (e) {
    return ''
  }
}

module.exports = {
  parseWorldModelAllowlist,
  isWorldModelAuthorized,
  getAllowlistFromEnv,
}
