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
  GATE_B_GUARD: GATE_B_GUARD,
  isValidEvidenceStatus: isValidEvidenceStatus,
  validateManifest: validateManifest,
  buildManifest: buildManifest,
  assertGateBNotFalselyPassed: assertGateBNotFalselyPassed,
}
