/**
 * lib/config/v21CognitivePreviewMode.js
 *
 * RC8.3 Stage1B R3.1 — World Model V2.1 Cognitive Preview AUTHORITY.
 *
 * Dedicated SERVER-SIDE trust for the V2.1 cognitive preview report path
 * (TEST_PREVIEW_ONLY). It is deliberately INDEPENDENT of:
 *   - worldModelV21Mode.js  (frozen OFF|SHADOW runtime parser — MUST NOT change)
 *   - worldModelV2Mode.js   (V2 SELECTIVE_PRIMARY / allowlist)
 *   - worldModelWhitelist.js / rolloutMode.js (V1 shadow allowlist)
 *   - Gate-B / Primary rollout / payment authority
 *
 * The client `previewMode === 'TEST_PREVIEW'` string is NEVER sufficient
 * authority. Preview executes ONLY when BOTH hold:
 *   1. trusted env `RC83_V21_COGNITIVE_PREVIEW_ENABLED === 'ENABLED'`
 *   2. (when an allowlist is configured) server-derived OPENID is eligible.
 *
 * STRICT POSITIVE SEMANTICS — fail-closed:
 *   missing / malformed / false / unknown / any other value → DISABLED.
 *   allowlist missing / empty → authorize nobody (do NOT default to open).
 *
 * No secrets in source. No hard-coded owner openid. Pure parser, no runtime,
 * no DB, no cognition, no persistence.
 *
 * @version world_model_v2_1 (cognitive preview authority)
 */

// Env keys
const V21_COGNITIVE_PREVIEW_ENABLED_ENV = 'RC83_V21_COGNITIVE_PREVIEW_ENABLED'
const V21_COGNITIVE_PREVIEW_ALLOWLIST_ENV = 'RC83_V21_COGNITIVE_PREVIEW_ALLOWLIST'

// The ONLY value that enables preview. Strict positive semantics.
const V21_COGNITIVE_PREVIEW_ENABLED_VALUE = 'ENABLED'

/**
 * Parse the trusted preview-enabled env value. Fail-closed: only the exact
 * string 'ENABLED' (case-insensitive, trimmed) enables; everything else
 * (missing / malformed / 'true' / '1' / 'on' / empty) → DISABLED.
 *
 * @param {*} raw
 * @returns {boolean}
 */
function parseV21CognitivePreviewEnabled(raw) {
  if (typeof raw !== 'string') return false
  var v = raw.trim().toUpperCase()
  return v === V21_COGNITIVE_PREVIEW_ENABLED_VALUE
}

function getV21CognitivePreviewEnabledFromEnv() {
  try { return process.env[V21_COGNITIVE_PREVIEW_ENABLED_ENV] || '' }
  catch (e) { return '' }
}

/**
 * Parse the optional preview allowlist (comma-separated openids).
 * Fail-closed: missing / malformed / empty → empty set (authorize nobody).
 *
 * @param {*} raw
 * @returns {Set<string>}
 */
function parseV21CognitivePreviewAllowlist(raw) {
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

function getV21CognitivePreviewAllowlistFromEnv() {
  try { return process.env[V21_COGNITIVE_PREVIEW_ALLOWLIST_ENV] || '' }
  catch (e) { return '' }
}

/**
 * Authorize a server-derived openid for cognitive preview.
 *
 * When an allowlist IS configured (non-empty env), the openid MUST be in it.
 * When NO allowlist is configured, preview is DISABLED for everyone — this
 * keeps the authority strictly trusted: an operator must explicitly list
 * eligible openids (no implicit open access).
 *
 * @param {string|null|undefined} openid  server-derived OPENID
 * @param {*} allowlistRaw
 * @returns {boolean}
 */
function isV21CognitivePreviewAuthorized(openid, allowlistRaw) {
  if (!openid || typeof openid !== 'string' || openid.trim() === '') return false
  try {
    const set = parseV21CognitivePreviewAllowlist(allowlistRaw)
    // Strict: empty allowlist → nobody (fail closed, no implicit open).
    if (set.size === 0) return false
    return set.has(openid)
  } catch (e) {
    return false
  }
}

/**
 * Full trusted preview gate. Combines the enabled flag AND (when configured)
 * the allowlist. Returns { enabled, authorized, reason }.
 *
 * @param {string|null|undefined} openid
 * @param {object} [opts]  injectable env readers (test seams)
 * @param {() => string} [opts.enabledEnv]
 * @param {() => string} [opts.allowlistEnv]
 * @returns {{enabled:boolean, authorized:boolean, reason:string}}
 */
function resolveV21CognitivePreviewAuthority(openid, opts) {
  const enabledEnv = opts && opts.enabledEnv ? opts.enabledEnv() : getV21CognitivePreviewEnabledFromEnv()
  const allowlistEnv = opts && opts.allowlistEnv ? opts.allowlistEnv() : getV21CognitivePreviewAllowlistFromEnv()

  const enabled = parseV21CognitivePreviewEnabled(enabledEnv)
  if (!enabled) {
    return { enabled: false, authorized: false, reason: 'PREVIEW_DISABLED' }
  }

  const authorized = isV21CognitivePreviewAuthorized(openid, allowlistEnv)
  if (!authorized) {
    return { enabled: true, authorized: false, reason: 'OPENID_NOT_AUTHORIZED' }
  }

  return { enabled: true, authorized: true, reason: 'AUTHORIZED' }
}

module.exports = {
  V21_COGNITIVE_PREVIEW_ENABLED_ENV,
  V21_COGNITIVE_PREVIEW_ALLOWLIST_ENV,
  V21_COGNITIVE_PREVIEW_ENABLED_VALUE,
  parseV21CognitivePreviewEnabled,
  getV21CognitivePreviewEnabledFromEnv,
  parseV21CognitivePreviewAllowlist,
  getV21CognitivePreviewAllowlistFromEnv,
  isV21CognitivePreviewAuthorized,
  resolveV21CognitivePreviewAuthority,
}
