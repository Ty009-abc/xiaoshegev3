/**
 * tools/rc83-stage21-release-safety/lib/deploymentSafety.js
 *
 * W5 — Deployment Safety Guard + Pre/Post Config Comparator.
 *
 * Classifies deployment paths and enforces the hard invariant:
 *
 *   CODE_ONLY_DEPLOY MUST NOT SYNC_RUNTIME_MODE_CONFIG
 *
 * Classification set (frozen Stage21 design §7):
 *   SAFE_CODE_ONLY       — deploys function code only, no env/config sync
 *   UNSAFE_CONFIG_SYNC   — may auto-sync env/config (e.g. cloudbaserc.json)
 *   UNKNOWN_REQUIRES_REVIEW — cannot be determined from available evidence
 *
 * Also provides a pure secret-safe pre/post config comparator.
 */

'use strict'

var fingerprintLib = require('./fingerprint')

// ── Known risk: cloudbaserc.json contains stale SELECTIVE_PRIMARY / allowlist ──
var KNOWN_STALE_CONFIG_RISK = {
  source: 'cloudbaserc.json',
  risk: 'RC83_WORLD_MODEL_MODE=SELECTIVE_PRIMARY + allowlist (stale)',
  effect: 'auto-sync would set production to SELECTIVE_PRIMARY and shrink allowlist',
}

// ── Strict positive structured schema (R2) ──
//
// SAFE_CODE_ONLY for a structured identifier requires an EXACT positive match:
//   - plain object (own enumerable keys only, no prototype-inherited fields)
//   - ALLOWED_KEYS exactly {tool, operation, syncEnvironment}
//   - all three required, exact types, exact values
// Any extra/unknown key ⇒ NOT SAFE. SAFE is NEVER inferred; it is only
// granted on strict positive schema match.

var APPROVED_STRUCTURED_TOOLS = { 'tcb': true, 'scf': true }

var STRUCTURED_SCHEMA = {
  allowedKeys: ['tool', 'operation', 'syncEnvironment'],
  requiredKeys: ['tool', 'operation', 'syncEnvironment'],
  tool: { type: 'string' },
  operation: { type: 'string' },
  syncEnvironment: { type: 'boolean' },
}

// Extra structured field names that clearly express config/deploy mutation → UNSAFE.
var STRUCTURED_DANGER_FIELD_NAMES = [
  'deploy', 'syncconfig', 'syncconfiguration', 'command', 'configfile', 'config',
  'environmentmutation', 'env', 'environment', 'variables', 'sync',
  'metadata', 'options', 'flags',
]

function isPlainObject(v) {
  if (typeof v !== 'object' || v === null) return false
  if (Array.isArray(v)) return false
  var proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

function structuredLooksDangerous(value) {
  var s
  try { s = JSON.stringify(value) } catch (e) { s = String(value) }
  if (s === undefined) s = String(value)
  s = (s || '').toLowerCase()
  for (var i = 0; i < DANGER_TOKENS.length; i++) {
    if (s.indexOf(DANGER_TOKENS[i]) !== -1) return true
  }
  return false
}

// Legacy string registry (exact, normalized, trimmed) for backward compat.
// Only EXACT matches are honored. No substring inference.
var DEPLOY_METHODS = {
  'tcb fn deploy': 'UNSAFE_CONFIG_SYNC',
  'tcb deploy': 'UNSAFE_CONFIG_SYNC',
  'cloudbaserc deploy': 'UNSAFE_CONFIG_SYNC',
  'tcb fn code update': 'SAFE_CODE_ONLY',
}

// DANGER tokens: presence (in the absence of an exact safe match) ⇒ UNSAFE.
var DANGER_TOKENS = ['deploy', 'cloudbaserc', 'env', 'config', 'variables', 'sync', 'environment']

function normalizeMethodString(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Classify a structured deployment identifier (strict positive schema).
 * SAFE only on exact schema match. Unknown/extra/wrong-type/non-plain → NOT SAFE.
 */
function classifyStructured(method) {
  // Non-plain-object (array, class instance, custom-proto, Date, function… ) → NOT SAFE.
  if (!isPlainObject(method)) {
    return { method: method, classification: 'UNKNOWN_REQUIRES_REVIEW', reason: 'structured input is not a plain object (rejected)' }
  }

  var keys = Object.keys(method)
  var allowed = STRUCTURED_SCHEMA.allowedKeys
  var extra = []
  for (var i = 0; i < keys.length; i++) {
    if (allowed.indexOf(keys[i]) === -1) extra.push(keys[i])
  }

  // Any extra/unknown key ⇒ NOT SAFE (fail-closed).
  if (extra.length > 0) {
    var dangerous = false
    for (var j = 0; j < extra.length; j++) {
      var ek = extra[j]
      if (STRUCTURED_DANGER_FIELD_NAMES.indexOf(String(ek).toLowerCase()) !== -1) dangerous = true
      else if (structuredLooksDangerous(method[ek])) dangerous = true
    }
    if (dangerous) {
      return { method: method, classification: 'UNSAFE_CONFIG_SYNC', reason: 'structured identifier has unknown/config-sync field(s): ' + extra.join(', ') }
    }
    return { method: method, classification: 'UNKNOWN_REQUIRES_REVIEW', reason: 'structured identifier has unknown field(s): ' + extra.join(', ') }
  }

  // Required keys presence.
  var required = STRUCTURED_SCHEMA.requiredKeys
  for (var r = 0; r < required.length; r++) {
    if (!Object.prototype.hasOwnProperty.call(method, required[r])) {
      return { method: method, classification: 'UNKNOWN_REQUIRES_REVIEW', reason: 'structured identifier missing required key: ' + required[r] }
    }
  }

  // Strict type validation (no coercion).
  if (typeof method.tool !== 'string') {
    return { method: method, classification: 'UNKNOWN_REQUIRES_REVIEW', reason: 'structured tool must be a string' }
  }
  if (typeof method.operation !== 'string') {
    return { method: method, classification: 'UNKNOWN_REQUIRES_REVIEW', reason: 'structured operation must be a string' }
  }
  if (typeof method.syncEnvironment !== 'boolean') {
    return { method: method, classification: 'UNKNOWN_REQUIRES_REVIEW', reason: 'structured syncEnvironment must be a boolean' }
  }

  var tool = method.tool
  var operation = method.operation
  var syncEnvironment = method.syncEnvironment

  // Approved tool set.
  if (!APPROVED_STRUCTURED_TOOLS[tool]) {
    return { method: method, classification: 'UNKNOWN_REQUIRES_REVIEW', reason: 'structured tool not in approved set: ' + JSON.stringify(tool) }
  }

  // Danger signals first (fail-closed toward unsafe).
  if (syncEnvironment === true) {
    return { method: method, classification: 'UNSAFE_CONFIG_SYNC', reason: 'structured syncEnvironment=true' }
  }
  if (operation !== 'CODE_UPDATE') {
    if (operation === 'DEPLOY' || structuredLooksDangerous(operation)) {
      return { method: method, classification: 'UNSAFE_CONFIG_SYNC', reason: 'structured operation implies config sync: ' + JSON.stringify(operation) }
    }
    return { method: method, classification: 'UNKNOWN_REQUIRES_REVIEW', reason: 'structured operation is not CODE_UPDATE: ' + JSON.stringify(operation) }
  }

  // Exact positive match → SAFE.
  return { method: method, classification: 'SAFE_CODE_ONLY', reason: 'structured identifier exactly matches approved schema (allowed tool, CODE_UPDATE, syncEnvironment=false)' }
}

/**
 * Classify a deployment path.
 *
 * Accepts EITHER:
 *   (a) a structured identifier: { tool, operation, syncEnvironment }
 *   (b) a string method name (backward compat, conservative).
 *
 * Priority (fail-closed):
 *   1. structured exact allowlist (SAFE only if operation=CODE_UPDATE &&
 *      syncEnvironment===false)
 *   2. structured exact danger match (syncEnvironment===true ⇒ UNSAFE)
 *   3. exact normalized string match
 *   4. DANGER token present ⇒ UNSAFE_CONFIG_SYNC
 *   5. otherwise ⇒ UNKNOWN_REQUIRES_REVIEW (NEVER SAFE by inference)
 *
 * @param {string|Object} method - deployment identifier.
 * @param {Object} [opts] - { description } (ignored for structured input;
 *   only used to append text for string normalization, NOT to infer SAFE).
 * @returns {Object} { method, classification, reason }
 */
function classifyDeploymentPath(method, opts) {
  opts = opts || {}

  // ── Structured identifier path (strict positive schema, R2) ──
  if (method && typeof method === 'object') {
    return classifyStructured(method)
  }

  // ── String path (conservative, fail-closed) ──
  var m = normalizeMethodString(method)
  var desc = normalizeMethodString(opts.description || '')
  var hay = (m + ' ' + desc).trim()

  // 1. Exact normalized match (safe or unsafe).
  var exact = DEPLOY_METHODS[m]
  if (exact) {
    return {
      method: m,
      classification: exact,
      reason: exact === 'SAFE_CODE_ONLY'
        ? 'exact allowlisted code-only method'
        : 'exact matched config-sync method',
    }
  }

  // 2. DANGER token present ⇒ UNSAFE (fail-closed toward unsafe, never safe).
  for (var i = 0; i < DANGER_TOKENS.length; i++) {
    if (hay.indexOf(DANGER_TOKENS[i]) !== -1) {
      return {
        method: m,
        classification: 'UNSAFE_CONFIG_SYNC',
        reason: 'danger token present: ' + DANGER_TOKENS[i],
      }
    }
  }

  // 3. No exact match, no danger token ⇒ ambiguous ⇒ UNKNOWN (NOT SAFE).
  return {
    method: m,
    classification: 'UNKNOWN_REQUIRES_REVIEW',
    reason: 'no exact match and no decisive signal (fail-closed; never inferred SAFE)',
  }
}

/**
 * Check whether a deployment method auto-syncs runtime-mode config.
 * Hard invariant guard: CODE_ONLY_DEPLOY MUST NOT SYNC_RUNTIME_MODE_CONFIG.
 * @returns {Object} { safe, classification, reason }
 */
function assertCodeOnlyDeploySafe(method, opts) {
  var r = classifyDeploymentPath(method, opts)
  var safe = r.classification === 'SAFE_CODE_ONLY'
  return { safe: safe, classification: r.classification, reason: r.reason }
}

/**
 * Detect stale cloudbaserc config risk in a parsed cloudbaserc.json object.
 * @param {Object} cloudbaserc - parsed cloudbaserc.json
 * @returns {Object} { staleDetected, functions: [{name, risk}] }
 */
function detectStaleCloudbaserc(cloudbaserc) {
  var hits = []
  if (!cloudbaserc || typeof cloudbaserc !== 'object') {
    return { staleDetected: false, functions: [] }
  }
  var funcs = Array.isArray(cloudbaserc.functions) ? cloudbaserc.functions : []
  for (var i = 0; i < funcs.length; i++) {
    var fn = funcs[i]
    var env = fn && fn.envVariables
    if (!env || typeof env !== 'object') continue
    var mode = env.RC83_WORLD_MODEL_MODE
    var v21 = env.RC83_WORLD_MODEL_V2_1_MODE
    var allowlist = env.RC83_WORLD_MODEL_ALLOWLIST
    var risky = false
    var reasons = []
    if (mode && String(mode).toUpperCase() === 'SELECTIVE_PRIMARY') {
      risky = true
      reasons.push('RC83_WORLD_MODEL_MODE=SELECTIVE_PRIMARY (stale)')
    }
    if (allowlist) {
      // allowlist presence in repo config is itself a config-sync risk signal
      reasons.push('allowlist present in repo config (config-sync risk)')
    }
    if (v21 && String(v21).toUpperCase() !== 'SHADOW') {
      risky = true
      reasons.push('RC83_WORLD_MODEL_V2_1_MODE=' + v21 + ' (not SHADOW)')
    }
    if (risky) {
      hits.push({ name: fn.name, risk: reasons })
    }
  }
  return { staleDetected: hits.length > 0, functions: hits }
}

/**
 * Pure secret-safe pre/post config comparator.
 * @param {Object} pre - pre-deploy config
 * @param {Object} post - post-deploy config
 * @returns {Object} { result: 'MATCH'|'DRIFT_DETECTED', diff: [...], preFingerprint, postFingerprint }
 */
function compareConfigState(pre, post) {
  var preFp = fingerprintLib.fingerprintConfig(pre)
  var postFp = fingerprintLib.fingerprintConfig(post)
  if (preFp === postFp) {
    return { result: 'MATCH', diff: [], preFingerprint: preFp, postFingerprint: postFp }
  }
  // Structured secret-safe diff (redacted payload comparison).
  var prePayload = fingerprintLib.buildConfigFingerprintPayload(pre)
  var postPayload = fingerprintLib.buildConfigFingerprintPayload(post)
  var diff = diffPayloads(prePayload, postPayload)
  return { result: 'DRIFT_DETECTED', diff: diff, preFingerprint: preFp, postFingerprint: postFp }
}

function diffPayloads(pre, post) {
  var fields = {}
  var keys = Object.keys(pre)
  var i
  for (i = 0; i < keys.length; i++) fields[keys[i]] = true
  keys = Object.keys(post)
  for (i = 0; i < keys.length; i++) fields[keys[i]] = true
  var fieldList = Object.keys(fields).sort()
  var out = []
  for (i = 0; i < fieldList.length; i++) {
    var f = fieldList[i]
    var a = fingerprintLib.canonicalJson(pre[f])
    var b = fingerprintLib.canonicalJson(post[f])
    if (a !== b) out.push({ field: f, pre: pre[f], post: post[f] })
  }
  return out
}

module.exports = {
  KNOWN_STALE_CONFIG_RISK: KNOWN_STALE_CONFIG_RISK,
  APPROVED_STRUCTURED_TOOLS: APPROVED_STRUCTURED_TOOLS,
  STRUCTURED_SCHEMA: STRUCTURED_SCHEMA,
  STRUCTURED_DANGER_FIELD_NAMES: STRUCTURED_DANGER_FIELD_NAMES,
  DEPLOY_METHODS: DEPLOY_METHODS,
  DANGER_TOKENS: DANGER_TOKENS,
  isPlainObject: isPlainObject,
  normalizeMethodString: normalizeMethodString,
  classifyStructured: classifyStructured,
  classifyDeploymentPath: classifyDeploymentPath,
  assertCodeOnlyDeploySafe: assertCodeOnlyDeploySafe,
  detectStaleCloudbaserc: detectStaleCloudbaserc,
  compareConfigState: compareConfigState,
}
