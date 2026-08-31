/**
 * tools/rc83-stage21-release-safety/lib/fingerprint.js
 *
 * W4 — Config Fingerprint (pure functions).
 *
 * Deterministic, secret-free, identity-free fingerprint of release-relevant
 * config. Used to detect config drift (EXPECTED vs LIVE) and to feed the
 * release manifest. Pure Node built-ins only — no network, no DB, no env.
 *
 * Privacy invariants (frozen Stage21 design §6):
 *   - canonical key ordering
 *   - deterministic serialization (same input → same fingerprint)
 *   - EXCLUDE secrets (API key / token / private key / credential)
 *   - EXCLUDE identity (OPENID / UNIONID / phone / nickname / profile / identity list)
 *   - allowlist identity is NEVER stored raw — only presence/count or
 *     privacy-safe normalized non-identity state
 *   - NO reversible identity hash
 */

'use strict'

var crypto = require('crypto')

// ── Canonical payload field order (frozen Stage21 design §6) ──
var PAYLOAD_FIELD_ORDER = [
  'environmentId',
  'engineMode',
  'v2Mode',
  'v21Mode',
  'allowlistState',
  'cohortConfig',
]

// ── Secret key patterns (excluded from fingerprint) ──
var SECRET_KEY_PATTERNS = [
  /secret/i, /token/i, /password/i, /passwd/i,
  /private.?key/i, /api.?key/i, /apikey/i, /credential/i,
  /access.?key/i, /signature/i, /cookie/i, /session/i,
  /salt/i, /nonce/i,
]

// ── Identity key patterns (excluded from fingerprint) ──
var IDENTITY_KEY_PATTERNS = [
  /openid/i, /unionid/i, /phone/i, /mobile/i, /nickname/i,
  /profile/i, /avatar/i, /email/i, /userid/i, /identity/i,
  /real.?name/i, /id.?card/i, /address/i,
]

// ── Keys that may hold an allowlist / cohort identity set (special handling) ──
var ALLOWLIST_KEY_PATTERN = /allowlist|whitelist|cohort|subject/i

function isSecretKey(key) {
  for (var i = 0; i < SECRET_KEY_PATTERNS.length; i++) {
    if (SECRET_KEY_PATTERNS[i].test(String(key))) return true
  }
  return false
}

function isIdentityKey(key) {
  for (var i = 0; i < IDENTITY_KEY_PATTERNS.length; i++) {
    if (IDENTITY_KEY_PATTERNS[i].test(String(key))) return true
  }
  return false
}

function isAllowlistKey(key) {
  return ALLOWLIST_KEY_PATTERN.test(String(key))
}

// ── Deterministic canonical JSON: recursively sort object keys ──
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value === undefined ? null : value)
  }
  if (Array.isArray(value)) {
    var arr = []
    for (var i = 0; i < value.length; i++) arr.push(canonicalJson(value[i]))
    return '[' + arr.join(',') + ']'
  }
  var keys = Object.keys(value).sort()
  var parts = []
  for (var j = 0; j < keys.length; j++) {
    var k = keys[j]
    parts.push(JSON.stringify(k) + ':' + canonicalJson(value[k]))
  }
  return '{' + parts.join(',') + '}'
}

// ── Privacy-safe allowlist state: presence + count ONLY, never raw identity ──
function normalizeAllowlist(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'object' && !Array.isArray(value)) {
    // Already a state object: keep only present/count (drop any raw list).
    var state = {}
    if (value.present !== undefined) state.present = !!value.present
    if (typeof value.count === 'number') state.count = value.count
    return state
  }
  // Raw list (array or CSV string) → collapse to presence + count.
  var list = value
  if (typeof value === 'string') {
    list = value.split(',').map(function (s) { return s.trim() }).filter(Boolean)
  }
  if (Array.isArray(list)) {
    return { present: list.length > 0, count: list.length }
  }
  // Unrecognized → presence only, no raw value.
  return { present: true }
}

// ── Privacy-safe cohort config: drop secret/identity keys, keep structure ──
function normalizeCohort(value) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    // Opaque → presence only (never raw).
    return { present: true }
  }
  var out = {}
  var keys = Object.keys(value).sort()
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i]
    if (isSecretKey(k) || isIdentityKey(k)) continue
    var v = value[k]
    if (v !== undefined && v !== null && typeof v !== 'object') {
      out[k] = v
    } else if (v !== undefined && v !== null) {
      out[k] = normalizeCohort(v)
    }
  }
  return out
}

// ── Build the canonical fingerprint payload (6 fields, ordered) ──
function buildConfigFingerprintPayload(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('buildConfigFingerprintPayload: config must be an object')
  }
  var payload = {}
  if (config.environmentId !== undefined) payload.environmentId = config.environmentId
  if (config.engineMode !== undefined) payload.engineMode = normalizeMode(config.engineMode)
  if (config.v2Mode !== undefined) payload.v2Mode = normalizeMode(config.v2Mode)
  if (config.v21Mode !== undefined) payload.v21Mode = normalizeMode(config.v21Mode)

  // allowlist: prefer explicit allowlistState, else discover allowlist key.
  var allowlistVal = config.allowlistState !== undefined
    ? config.allowlistState
    : findFirst(config, isAllowlistKey)
  var allowlistState = normalizeAllowlist(allowlistVal)
  if (allowlistState !== null) payload.allowlistState = allowlistState

  var cohortVal = config.cohortConfig !== undefined ? config.cohortConfig : config.cohort
  var cohortState = normalizeCohort(cohortVal)
  if (cohortState !== null) payload.cohortConfig = cohortState

  // Enforce canonical field order.
  var ordered = {}
  for (var i = 0; i < PAYLOAD_FIELD_ORDER.length; i++) {
    var field = PAYLOAD_FIELD_ORDER[i]
    if (payload[field] !== undefined) ordered[field] = payload[field]
  }
  return ordered
}

function normalizeMode(v) {
  if (typeof v === 'string') return v.trim().toUpperCase()
  return v
}

// Recursively find the first value whose key matches `pred`.
function findFirst(obj, pred) {
  if (!obj || typeof obj !== 'object') return undefined
  var keys = Object.keys(obj)
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i]
    if (pred(k)) return obj[k]
  }
  return undefined
}

// ── SHA-256 fingerprint of the canonical payload ──
function fingerprintConfig(config, algorithm) {
  var payload = buildConfigFingerprintPayload(config)
  var json = canonicalJson(payload)
  return crypto.createHash(algorithm || 'sha256').update(json, 'utf8').digest('hex')
}

// ── Redact a full config object (for logging / diff) to secret/identity-free form ──
function redactConfig(config) {
  if (config === null || typeof config !== 'object') return config
  if (Array.isArray(config)) return config.map(redactConfig)
  var out = {}
  var keys = Object.keys(config).sort()
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i]
    if (isSecretKey(k) || isIdentityKey(k)) {
      out[k] = '[REDACTED]'
      continue
    }
    if (isAllowlistKey(k)) {
      out[k] = normalizeAllowlist(config[k])
      continue
    }
    var v = config[k]
    if (v !== null && typeof v === 'object') out[k] = redactConfig(v)
    else out[k] = v
  }
  return out
}

module.exports = {
  PAYLOAD_FIELD_ORDER: PAYLOAD_FIELD_ORDER,
  SECRET_KEY_PATTERNS: SECRET_KEY_PATTERNS,
  IDENTITY_KEY_PATTERNS: IDENTITY_KEY_PATTERNS,
  isSecretKey: isSecretKey,
  isIdentityKey: isIdentityKey,
  isAllowlistKey: isAllowlistKey,
  canonicalJson: canonicalJson,
  normalizeAllowlist: normalizeAllowlist,
  normalizeCohort: normalizeCohort,
  buildConfigFingerprintPayload: buildConfigFingerprintPayload,
  fingerprintConfig: fingerprintConfig,
  redactConfig: redactConfig,
}
