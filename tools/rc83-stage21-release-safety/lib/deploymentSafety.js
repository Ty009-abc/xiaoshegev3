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

// ── Exact structured deployment identifiers (SAFE_CODE_ONLY allowlist) ──
//
// FAIL-CLOSED model (R1): SAFE_CODE_ONLY is returned ONLY for an exact
// allowlisted structured identifier. Free-text strings are normalized and
// then matched against an exact DANGER-signal list; anything ambiguous (or
// mixed safe+unsafe tokens) becomes UNKNOWN_REQUIRES_REVIEW. SAFE is NEVER
// inferred from a substring/regex.

var SAFE_CODE_ONLY_OPERATIONS = {
  'tcb:code_update': { tool: 'tcb', operation: 'CODE_UPDATE', syncEnvironment: false },
  'scf:update_function_code': { tool: 'scf', operation: 'CODE_UPDATE', syncEnvironment: false },
}

// Exact (normalized) DANGER identifiers → UNSAFE_CONFIG_SYNC.
var UNSAFE_CONFIG_SYNC_OPERATIONS = {
  'tcb:deploy': { tool: 'tcb', operation: 'DEPLOY', syncEnvironment: true },
  'tcb:fn_deploy': { tool: 'tcb', operation: 'DEPLOY', syncEnvironment: true },
  'cloudbaserc:deploy': { tool: 'cloudbaserc', operation: 'DEPLOY', syncEnvironment: true },
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

  // ── Structured identifier path (preferred, authoritative) ──
  if (method && typeof method === 'object') {
    var op = String(method.operation || '').toUpperCase()
    var syncEnv = method.syncEnvironment === true
    var structured = {
      tool: method.tool || null,
      operation: op,
      syncEnvironment: syncEnv,
    }
    if (op === 'CODE_UPDATE' && !syncEnv) {
      return { method: structured, classification: 'SAFE_CODE_ONLY', reason: 'structured CODE_UPDATE, syncEnvironment=false (explicit allowlist)' }
    }
    if (syncEnv) {
      return { method: structured, classification: 'UNSAFE_CONFIG_SYNC', reason: 'structured identifier has syncEnvironment=true' }
    }
    // Structured but neither explicit-safe nor explicit-danger ⇒ require review.
    return { method: structured, classification: 'UNKNOWN_REQUIRES_REVIEW', reason: 'structured identifier is not in the safe allowlist' }
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
  SAFE_CODE_ONLY_OPERATIONS: SAFE_CODE_ONLY_OPERATIONS,
  UNSAFE_CONFIG_SYNC_OPERATIONS: UNSAFE_CONFIG_SYNC_OPERATIONS,
  DEPLOY_METHODS: DEPLOY_METHODS,
  DANGER_TOKENS: DANGER_TOKENS,
  normalizeMethodString: normalizeMethodString,
  classifyDeploymentPath: classifyDeploymentPath,
  assertCodeOnlyDeploySafe: assertCodeOnlyDeploySafe,
  detectStaleCloudbaserc: detectStaleCloudbaserc,
  compareConfigState: compareConfigState,
}
