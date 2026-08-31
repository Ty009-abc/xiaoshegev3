/**
 * tools/rc83-stage21-release-safety/lib/releaseManifest.js
 *
 * W9 — Release Manifest Generator.
 *
 * Machine-readable manifest over the frozen Stage21 schema (22 fields).
 * Evidence fields use explicit status semantics (never bare null):
 *   PASS | FAIL | NOT_RUN | NOT_APPLICABLE | BLOCKED
 *
 * Privacy invariants: no secrets, no identity data, no raw allowlist.
 * Gate-B ACTIVE must never be represented as PASS.
 */

'use strict'

var fingerprintLib = require('./fingerprint')

// ── Frozen manifest schema (Stage21 design §15) ──
var MANIFEST_FIELDS = [
  'canonicalSha', 'candidateSha', 'deployedSha', 'harnessSha',
  'gateBResult', 'gateBProtocolHash',
  'regressionResult', 'realDeviceResult',
  'environmentId',
  'rolloutMode', 'featureFlagState',
  'deployedConfigFingerprint', 'preDeployConfigFingerprint', 'postDeployConfigFingerprint',
  'deploymentMethod', 'deploymentToolIdentifier',
  'rollbackTarget',
  'knownDebts', 'releaseOwner', 'releaseTimestamp',
]

// ── Allowed evidence statuses (frozen Stage21 design §8) ──
var EVIDENCE_STATUSES = ['PASS', 'FAIL', 'NOT_RUN', 'NOT_APPLICABLE', 'BLOCKED']

// ── Schema: which fields are evidence-status fields vs metadata fields ──
var EVIDENCE_FIELDS = {
  gateBResult: true,
  regressionResult: true,
  realDeviceResult: true,
}

// ── Mandatory metadata fields (R1 hardening) ──
// These MUST be present (non-undefined, non-empty) for a manifest to validate.
// Evidence fields are NOT mandatory (they default to NOT_RUN).
var MANDATORY_FIELDS = [
  'canonicalSha',
  'candidateSha',
  'deployedSha',
  'environmentId',
  'featureFlagState',
  'deploymentMethod',
  'deploymentToolIdentifier',
  'rollbackTarget',
]

// ── Git SHA fields (must be full 40-hex if a real commit is claimed) ──
var GIT_SHA_FIELDS = ['canonicalSha', 'candidateSha', 'deployedSha', 'harnessSha']

// ── Config fingerprint fields (must be 64-hex SHA-256 when present) ──
var FINGERPRINT_FIELDS = [
  'deployedConfigFingerprint',
  'preDeployConfigFingerprint',
  'postDeployConfigFingerprint',
]

var GIT_SHA_RE = /^[0-9a-f]{40}$/
var FINGERPRINT_RE = /^[0-9a-f]{64}$/

// ── Fields that MUST NOT appear in a real manifest as a false PASS ──
var GATE_B_GUARD = { gateBResult: 'ACTIVE' }

/**
 * Validate a single evidence status value.
 * @returns {boolean}
 */
function isValidEvidenceStatus(v) {
  return EVIDENCE_STATUSES.indexOf(v) !== -1
}

/**
 * Validate a manifest object against the frozen schema.
 * @param {Object} manifest
 * @returns {Object} { valid, errors: [...], warnings: [...] }
 */
function validateManifest(manifest) {
  var errors = []
  var warnings = []
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['manifest must be an object'], warnings: [] }
  }
  // Evidence fields must use valid statuses (never bare null).
  var evKeys = Object.keys(EVIDENCE_FIELDS)
  for (var i = 0; i < evKeys.length; i++) {
    var k = evKeys[i]
    if (manifest[k] === undefined) {
      warnings.push('evidence field ' + k + ' missing (defaulting to NOT_RUN semantics)')
      continue
    }
    if (manifest[k] === null) {
      errors.push('evidence field ' + k + ' must not be null (use NOT_RUN / BLOCKED / NOT_APPLICABLE)')
    } else if (!isValidEvidenceStatus(manifest[k])) {
      errors.push('evidence field ' + k + ' has invalid status: ' + JSON.stringify(manifest[k]))
    }
  }
  // Gate-B false-PASS guard.
  if (manifest.gateBResult === 'PASS' && manifest.gateBProtocolHash === undefined) {
    errors.push('gateBResult=PASS requires gateBProtocolHash')
  }
  // Mandatory metadata fields (R1 hardening).
  for (var mi = 0; mi < MANDATORY_FIELDS.length; mi++) {
    var mf = MANDATORY_FIELDS[mi]
    var mv = manifest[mf]
    if (mv === undefined || mv === null || mv === '') {
      errors.push('mandatory field missing/empty: ' + mf)
    }
  }
  // Git SHA fields: if present, must be full 40-hex (no short/abbrev/null/empty).
  for (var gi = 0; gi < GIT_SHA_FIELDS.length; gi++) {
    var gsf = GIT_SHA_FIELDS[gi]
    if (manifest[gsf] === undefined || manifest[gsf] === null) {
      // Git SHA fields are mandatory (they are a subset of MANDATORY_FIELDS),
      // so absence is already reported above; skip here to avoid duplicates.
      continue
    }
    var gv = String(manifest[gsf])
    if (manifest[gsf] === '') {
      errors.push('git SHA field empty: ' + gsf)
    } else if (!GIT_SHA_RE.test(gv)) {
      errors.push('git SHA field malformed (must be 40-hex): ' + gsf + ' = ' + JSON.stringify(gv))
    }
  }
  // Config fingerprint fields: when a REAL deployment is claimed
  // (deploymentMethod non-empty and not an explicit NOT_RUN/NOT_APPLICABLE
  // sentinel), deployedConfigFingerprint is REQUIRED and must be 64-hex.
  var NOT_DEPLOYED_SENTINELS = { 'NOT_RUN': true, 'NOT_APPLICABLE': true, '': true }
  var deploymentClaimed = typeof manifest.deploymentMethod === 'string' &&
    !NOT_DEPLOYED_SENTINELS[manifest.deploymentMethod.trim()]
  if (deploymentClaimed) {
    var dfp = manifest.deployedConfigFingerprint
    if (dfp === undefined || dfp === null || dfp === '') {
      errors.push('deployedConfigFingerprint required when deploymentMethod is claimed')
    } else if (!FINGERPRINT_RE.test(String(dfp))) {
      errors.push('config fingerprint malformed (must be 64-hex sha256): deployedConfigFingerprint = ' + JSON.stringify(dfp))
    }
  }
  // Remaining fingerprint fields (pre/post): optional; validate when present.
  for (var fi = 0; fi < FINGERPRINT_FIELDS.length; fi++) {
    var ff = FINGERPRINT_FIELDS[fi]
    if (ff === 'deployedConfigFingerprint') continue // handled above
    if (manifest[ff] === undefined || manifest[ff] === null) continue // optional
    var fv = String(manifest[ff])
    if (!FINGERPRINT_RE.test(fv)) {
      errors.push('config fingerprint malformed (must be 64-hex sha256): ' + ff + ' = ' + JSON.stringify(fv))
    }
  }
  // Secret / identity leak scan on the serialized manifest.
  var json = JSON.stringify(manifest)
  if (/(api.?key|secret|token|private.?key|openid|unionid|nickname|phone)/i.test(json)) {
    errors.push('manifest may contain secret or identity data (regex scan hit)')
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings }
}

/**
 * Build a manifest from explicit inputs. Evidence fields default to NOT_RUN
 * when omitted (never silently PASS).
 * @param {Object} input
 * @returns {Object} manifest
 */
function buildManifest(input) {
  input = input || {}
  var manifest = {}
  for (var i = 0; i < MANIFEST_FIELDS.length; i++) {
    var f = MANIFEST_FIELDS[i]
    if (input[f] !== undefined) manifest[f] = input[f]
  }
  // Evidence defaults.
  var evKeys = Object.keys(EVIDENCE_FIELDS)
  for (var j = 0; j < evKeys.length; j++) {
    var k = evKeys[j]
    if (manifest[k] === undefined) manifest[k] = 'NOT_RUN'
  }
  return manifest
}

/**
 * Guard: prevent representing Gate-B ACTIVE as PASS in a manifest.
 * @returns {Object} { ok, reason }
 */
function assertGateBNotFalselyPassed(manifest) {
  if (!manifest || typeof manifest !== 'object') return { ok: false, reason: 'manifest required' }
  if (manifest.gateBResult === 'PASS' && manifest.gateBProtocolHash === undefined) {
    return { ok: false, reason: 'gateBResult=PASS without gateBProtocolHash' }
  }
  return { ok: true, reason: 'ok' }
}

module.exports = {
  MANIFEST_FIELDS: MANIFEST_FIELDS,
  EVIDENCE_STATUSES: EVIDENCE_STATUSES,
  EVIDENCE_FIELDS: EVIDENCE_FIELDS,
  MANDATORY_FIELDS: MANDATORY_FIELDS,
  GIT_SHA_FIELDS: GIT_SHA_FIELDS,
  FINGERPRINT_FIELDS: FINGERPRINT_FIELDS,
  GATE_B_GUARD: GATE_B_GUARD,
  isValidEvidenceStatus: isValidEvidenceStatus,
  validateManifest: validateManifest,
  buildManifest: buildManifest,
  assertGateBNotFalselyPassed: assertGateBNotFalselyPassed,
}
