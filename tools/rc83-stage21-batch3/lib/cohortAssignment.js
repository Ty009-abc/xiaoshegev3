/**
 * tools/rc83-stage21-batch3/lib/cohortAssignment.js
 *
 * W6 — Deterministic Selective-Primary Cohort Assignment.
 *
 * Core invariant:
 *   same eligible subject + same rollout configuration = same cohort.
 *
 * Uses a stable cryptographic deterministic hash (SHA-256) over:
 *   algorithmVersion | rolloutSaltVersion | rolloutSalt | subjectToken
 * and maps the first 4 bytes to a 0..9999 bucket (basis points).
 *
 * FORBIDDEN entropy: Math.random, Date.now, request-order, process-local
 * counter, or any unstable runtime entropy.
 *
 * PRIVACY BOUNDARY (frozen):
 *   - subjectToken is EPHEMERAL runtime input; it is NEVER returned, logged,
 *     persisted, or written to any artifact.
 *   - No raw OPENID / unionid / nickname / phone / avatar is ever read here.
 *   - No stable per-user hash / bucket index is exposed from assignCohort's
 *     public result (cohort only), so no reversible identity artifact is
 *     produced by this module's public surface.
 *
 * ROLLOUT SCALE: integer basis points 0..10000 (0 = all SHADOW, 10000 = all
 * PRIMARY). Boundary determinism is guaranteed; no floating-point percentages.
 */

'use strict'

var crypto = require('crypto')

// ── Cohort algorithm version (frozen; change requires explicit governance) ──
var COHORT_ALGORITHM_VERSION = 'V1'

// ── Rollout salt version (change requires explicit governance; a new salt
//    version may re-assign cohorts explicitly, never silently) ──
var ROLLOUT_SALT_VERSION = 'V1'

// ── Supported salt versions (fail-closed: unknown version is rejected) ──
var SUPPORTED_SALT_VERSIONS = { V1: true }

// ── Cohort output labels ──
var COHORT = {
  PRIMARY: 'PRIMARY_COHORT',
  SHADOW: 'SHADOW_COHORT',
}

// ── Basis-point domain ──
var ROLLOUT_UNIT = 'BASIS_POINTS'
var ROLLOUT_MIN_BP = 0
var ROLLOUT_MAX_BP = 10000

/**
 * Deterministic bucket (internal): 0..9999.
 *
 * NOT exposed via assignCohort's public result (avoids a stable per-user
 * derived value escaping into artifacts). Kept as a pure internal helper so
 * distribution sanity can be reasoned about without leaking identity.
 *
 * @param {string} subjectToken   ephemeral subject token (never persisted)
 * @param {string} rolloutSalt    versioned rollout salt
 * @param {string} [saltVersion]  rollout salt version (default ROLLOUT_SALT_VERSION)
 * @param {string} [algoVersion]  algorithm version (default COHORT_ALGORITHM_VERSION)
 * @returns {number} bucket in [0, 9999]
 */
function bucketFor(subjectToken, rolloutSalt, saltVersion, algoVersion) {
  if (typeof subjectToken !== 'string' || subjectToken.length === 0) {
    throw new Error('bucketFor: subjectToken must be a non-empty string')
  }
  if (typeof rolloutSalt !== 'string' || rolloutSalt.length === 0) {
    throw new Error('bucketFor: rolloutSalt must be a non-empty string')
  }
  var sv = saltVersion || ROLLOUT_SALT_VERSION
  var av = algoVersion || COHORT_ALGORITHM_VERSION
  var material = av + '|' + sv + '|' + rolloutSalt + '|' + subjectToken
  var digest = crypto.createHash('sha256').update(material, 'utf8').digest()
  // First 4 bytes → unsigned 32-bit → mod 10000 (stable, uniform-enough bucket).
  var u32 = ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0
  return u32 % 10000
}

/**
 * Assign a cohort deterministically.
 *
 * @param {object} params
 *   - subjectToken        {string} ephemeral subject token (required)
 *   - rolloutSalt         {string} versioned rollout salt (required)
 *   - rolloutSaltVersion  {string} optional salt version (default V1)
 *   - rolloutBasisPoints  {number} integer 0..10000 (required)
 * @returns {object}
 *   { cohort, rolloutBasisPoints, algorithmVersion, saltVersion }
 *   NOTE: no subjectToken, no hash, no bucket index in the result.
 */
function assignCohort(params) {
  if (!params || typeof params !== 'object') {
    throw new Error('assignCohort: params must be an object')
  }
  var bp = params.rolloutBasisPoints
  if (typeof bp !== 'number' || !Number.isInteger(bp) || bp < ROLLOUT_MIN_BP || bp > ROLLOUT_MAX_BP) {
    throw new Error('assignCohort: rolloutBasisPoints must be an integer in [' + ROLLOUT_MIN_BP + ', ' + ROLLOUT_MAX_BP + ']')
  }
  var sv = params.rolloutSaltVersion || ROLLOUT_SALT_VERSION
  // Fail-closed: unknown salt version must NOT be silently accepted.
  if (!SUPPORTED_SALT_VERSIONS[sv]) {
    throw new Error('assignCohort: unknown rolloutSaltVersion=' + sv + ' (fail-closed)')
  }
  // Fail-closed: algorithm version is pinned; attempts to override are rejected.
  if (params.algorithmVersion !== undefined && params.algorithmVersion !== COHORT_ALGORITHM_VERSION) {
    throw new Error('assignCohort: unknown cohort algorithmVersion=' + params.algorithmVersion + ' (fail-closed)')
  }
  var bucket = bucketFor(params.subjectToken, params.rolloutSalt, sv, COHORT_ALGORITHM_VERSION)
  var cohort = bucket < bp ? COHORT.PRIMARY : COHORT.SHADOW
  return {
    cohort: cohort,
    rolloutBasisPoints: bp,
    algorithmVersion: COHORT_ALGORITHM_VERSION,
    saltVersion: sv,
  }
}

module.exports = {
  COHORT_ALGORITHM_VERSION: COHORT_ALGORITHM_VERSION,
  ROLLOUT_SALT_VERSION: ROLLOUT_SALT_VERSION,
  SUPPORTED_SALT_VERSIONS: SUPPORTED_SALT_VERSIONS,
  COHORT: COHORT,
  ROLLOUT_UNIT: ROLLOUT_UNIT,
  ROLLOUT_MIN_BP: ROLLOUT_MIN_BP,
  ROLLOUT_MAX_BP: ROLLOUT_MAX_BP,
  bucketFor: bucketFor,
  assignCohort: assignCohort,
}
