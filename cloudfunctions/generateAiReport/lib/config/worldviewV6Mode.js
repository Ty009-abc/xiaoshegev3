/**
 * lib/config/worldviewV6Mode.js
 *
 * RC8.4 V6 — Turnaround Strategy V6 worldview runtime mode parser.
 *
 * Independent from every other mode/allowlist in this project:
 *   - world_model_v1  (worldModelWhitelist.js / rolloutMode.js)
 *   - world_model_v2  (worldModelV2Mode.js)
 *   - world_model_v2_1 (worldModelV21Mode.js)
 * V6 is NEVER controlled by the V1/V2/V2.1 MODE or allowlist.
 *
 * Env:
 *   RC84_V6_WORLDVIEW_MODE   = OFF | SHADOW | ON
 *   RC84_V6_SHADOW_ALLOWLIST = comma-separated openids (only consulted in SHADOW)
 *
 * Fail-closed: missing / malformed / empty / non-string → OFF.
 * SHADOW allowlist fail-closed: missing / empty → authorize NOBODY.
 * `ON` is PARSED (so a future owner-authorized task can flip it) but this task
 * never sets it; default is OFF and OFF is the production-safe state.
 *
 * This module is a pure parser — no runtime execution, no DB, no network,
 * no persistence, no user-visible mutation.
 *
 * @version turnaround_strategy_v6
 */

const V6_WORLDVIEW_MODE_ENV = 'RC84_V6_WORLDVIEW_MODE'
const V6_SHADOW_ALLOWLIST_ENV = 'RC84_V6_SHADOW_ALLOWLIST'

// Closed allowed-mode set.
const V6_ALLOWED_MODES = Object.freeze(['OFF', 'SHADOW', 'ON'])

const V6_DEFAULT_MODE = 'OFF'

/**
 * Parse a raw V6 worldview mode value. Fail-closed to OFF.
 * @param {*} raw raw env value
 * @returns {'OFF'|'SHADOW'|'ON'}
 */
function parseV6WorldviewMode (raw) {
  if (!raw || typeof raw !== 'string') return V6_DEFAULT_MODE
  const mode = raw.trim().toUpperCase()
  if (mode === 'SHADOW') return 'SHADOW'
  if (mode === 'ON') return 'ON'
  // OFF or any invalid / empty value → OFF (fail-closed).
  return V6_DEFAULT_MODE
}

function getV6WorldviewModeFromEnv () {
  try { return process.env[V6_WORLDVIEW_MODE_ENV] || V6_DEFAULT_MODE } catch (e) { return V6_DEFAULT_MODE }
}

/**
 * Parse the optional SHADOW allowlist (comma-separated openids).
 * Fail-closed: missing / malformed / empty / non-string → empty set
 * (authorize NOBODY). No hard-coded openid in source.
 * @param {*} raw
 * @returns {Set<string>}
 */
function parseV6ShadowAllowlist (raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return new Set()
  try {
    return new Set(
      raw.split(',')
        .map(function (e) { return e.trim() })
        .filter(function (e) { return e.length > 0 })
    )
  } catch (e) {
    return new Set()
  }
}

function getV6ShadowAllowlistFromEnv () {
  try { return process.env[V6_SHADOW_ALLOWLIST_ENV] || '' } catch (e) { return '' }
}

/**
 * Authorize a SERVER-DERIVED openid for V6 SHADOW.
 * An empty / missing allowlist authorizes NOBODY (no implicit open access).
 * Client-supplied openid is never consulted anywhere in this module.
 * @param {string|null|undefined} openid  server-derived OPENID
 * @param {*} allowlistRaw
 * @returns {boolean}
 */
function isV6ShadowAuthorized (openid, allowlistRaw) {
  if (!openid || typeof openid !== 'string' || openid.trim() === '') return false
  try {
    const set = parseV6ShadowAllowlist(allowlistRaw)
    if (set.size === 0) return false
    return set.has(openid)
  } catch (e) {
    return false
  }
}

module.exports = {
  V6_WORLDVIEW_MODE_ENV,
  V6_SHADOW_ALLOWLIST_ENV,
  V6_ALLOWED_MODES,
  V6_DEFAULT_MODE,
  parseV6WorldviewMode,
  getV6WorldviewModeFromEnv,
  parseV6ShadowAllowlist,
  getV6ShadowAllowlistFromEnv,
  isV6ShadowAuthorized,
}
