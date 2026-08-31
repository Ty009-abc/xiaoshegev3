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

// ── Deployment method registry ──
var DEPLOY_METHODS = {
  'tcb fn deploy': {
    classification: 'UNSAFE_CONFIG_SYNC',
    reason: 'applies cloudbaserc.json envVariables (config sync risk)',
  },
  'tcb fn code update': {
    classification: 'SAFE_CODE_ONLY',
    reason: 'function code only; no env/config fields (verified precedent)',
  },
  'cloudbaserc deploy': {
    classification: 'UNSAFE_CONFIG_SYNC',
    reason: 'applies cloudbaserc.json envVariables',
  },
}

/**
 * Classify a deployment path given a method name and optional description.
 * @param {string} method - deployment command/method identifier.
 * @param {Object} [opts] - { description }
 * @returns {Object} { method, classification, reason }
 */
function classifyDeploymentPath(method, opts) {
  opts = opts || {}
  var m = String(method || '').trim()
  var known = DEPLOY_METHODS[m]
  if (known) {
    return { method: m, classification: known.classification, reason: known.reason }
  }
  // Heuristic scan over the raw method string (and description) for config-sync hints.
  var hay = (m + ' ' + (opts.description || '')).toLowerCase()
  if (/deploy\b/.test(hay) && /(env|config|cloudbaserc|variables|sync)/.test(hay)) {
    return { method: m, classification: 'UNSAFE_CONFIG_SYNC', reason: 'method string suggests env/config sync' }
  }
  if (/code\s*(only|update)/.test(hay)) {
    return { method: m, classification: 'SAFE_CODE_ONLY', reason: 'method string suggests code-only update' }
  }
  return { method: m, classification: 'UNKNOWN_REQUIRES_REVIEW', reason: 'cannot determine from available evidence' }
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
  DEPLOY_METHODS: DEPLOY_METHODS,
  classifyDeploymentPath: classifyDeploymentPath,
  assertCodeOnlyDeploySafe: assertCodeOnlyDeploySafe,
  detectStaleCloudbaserc: detectStaleCloudbaserc,
  compareConfigState: compareConfigState,
}
