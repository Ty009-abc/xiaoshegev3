/**
 * tools/rc83-stage21-batch2/lib/authorityGuardV21.js
 *
 * W1 — V2.1 AI Authority Guard.
 *
 * FROZEN PRINCIPLE:
 *   ENGINE = DIAGNOSTIC AUTHORITY
 *   AI     = EXPRESSION AUTHORITY ONLY
 *
 * The AI must never create / delete / replace / nullify / retype any
 * authoritative semantic field produced by the World Model V2.1 engine.
 *
 * This guard is V2.1-SPECIFIC. It does NOT reuse reportGuardV4 LOCKED_PATHS
 * (V4 lock set ≠ V2.1 contract). Protected paths are derived from the actual
 * V2.1 engine contract (docs/RC8.3_STAGE20_R0_V21_RUNTIME_SHADOW_CONTRACT.md
 * + runtimeShadowAdapterV21.js + primaryDecisionEngineV21.js).
 *
 * DESIGN ABSTRACT NAME → CANONICAL V2.1 CONTRACT MAPPING (reported per §2/§3):
 *   cognitiveArchetype      → primaryConstruct (+ eligibleConstructs,
 *                             dimensionSummary[].construct)
 *   cognitiveBlindSpot      → primaryBlindSpotId (+ eligibleCandidateIds)
 *   worldStrategy           → cognitionTerminalStatus (terminal decision)
 *   scenarioSimulation      → followupPair (follow-up semantic identity)
 *                             + dimensionSummary[].{orientation,state}
 *   (plus the validity gate + cognition-executed flag)
 *
 * AI MAY CHANGE (expression-only): headline, summary, explanation, narrative,
 *   actionWording, humanReadableCopy — but only to EXPRESS facts already
 *   determined by the engine. It must NOT create a second diagnostic
 *   conclusion through extra fields (semantic smuggling).
 */

'use strict'

var util = require('./util')

// ── Exact protected paths (authoritative V2.1 semantic fields) ──
var PROTECTED_PATHS = [
  'responseValidityStatus',
  'cognitionExecuted',
  'cognitionTerminalStatus',
  'primaryBlindSpotId',
  'primaryConstruct',
  'followupPair',
  'eligibleCandidateIds',
  'eligibleConstructs',
  'dimensionSummary',
]

// ── Sanctioned expression-only fields the AI is allowed to produce ──
var AI_ALLOWED_PATHS = [
  'headline',
  'summary',
  'explanation',
  'narrative',
  'actionWording',
  'humanReadableCopy',
]

// ── Sanctioned wrapper name for AI echoing the engine conclusion verbatim ──
var AUTHORITATIVE_BLOCK = 'authoritativeDiagnosis'

// ── Diagnostic-semantic key pattern (for semantic-smuggling detection) ──
var DIAGNOSTIC_SEMANTIC_KEY_RE = /blindspot|archetype|construct|strategy|scenario|diagnos|primary|dimension|eligible|followup|validity|cognition|deficit|reasoncode/i

// ── Frozen render-source enum (W2) ──
var RENDER_SOURCE = {
  AI_RENDERED: 'AI_RENDERED',
  DETERMINISTIC_FALLBACK: 'DETERMINISTIC_FALLBACK',
}

/**
 * Build a deterministic authority snapshot containing ONLY the protected
 * semantic fields. Canonical ordering, deep-frozen, identity-free,
 * secret-free, timestamp-free.
 *
 * @param {object} engineResult  V2.1 engine conclusion (decision + validity + dims)
 * @returns {object} frozen snapshot
 */
function buildAuthoritySnapshot(engineResult) {
  if (!engineResult || typeof engineResult !== 'object') {
    throw new Error('buildAuthoritySnapshot: engineResult must be an object')
  }
  var snapshot = {}
  for (var i = 0; i < PROTECTED_PATHS.length; i++) {
    var p = PROTECTED_PATHS[i]
    if (engineResult[p] !== undefined) snapshot[p] = engineResult[p]
  }
  return util.deepFreezeCopy(snapshot)
}

/**
 * Extract the value of a protected field from the AI output.
 *
 * The AI may place authoritative fields EITHER directly at top level OR under
 * the sanctioned `authoritativeDiagnosis` wrapper. Returns { found, value }.
 */
function locateProtectedField(aiOutput, field) {
  if (!aiOutput || typeof aiOutput !== 'object') return { found: false, value: undefined }
  if (Object.prototype.hasOwnProperty.call(aiOutput, field)) {
    return { found: true, value: aiOutput[field] }
  }
  var block = aiOutput[AUTHORITATIVE_BLOCK]
  if (block && typeof block === 'object' && !Array.isArray(block) &&
      Object.prototype.hasOwnProperty.call(block, field)) {
    return { found: true, value: block[field] }
  }
  return { found: false, value: undefined }
}

/**
 * Validate AI expression output against the pre-AI authority snapshot.
 *
 * Behavior (fail-closed, NO partial accept):
 *   - non-object AI output → REJECTED
 *   - authoritative block present → must contain ALL protected fields present
 *     in the snapshot, each deep-equal; changed/missing/nullified/retyped → REJECTED
 *   - any protected field found outside the sanctioned block with a DIFFERENT
 *     value → REJECTED (authority violation)
 *   - any top-level key matching a diagnostic-semantic name but not sanctioned
 *     (prose / authoritative wrapper / known protected) → REJECTED (smuggling)
 *   - prose fields must be string|null (no structured sub-diagnosis smuggled in)
 *
 * @param {object} engineResult  V2.1 engine conclusion (pre-AI)
 * @param {*} aiOutput  AI-produced expression object
 * @returns {object}
 *   { status, protectedFieldCount, violations:[{path,reason}], snapshot }
 */
function validateAuthority(engineResult, aiOutput) {
  var snapshot = buildAuthoritySnapshot(engineResult)
  var violations = []
  var protectedFieldCount = PROTECTED_PATHS.length

  if (!aiOutput || typeof aiOutput !== 'object' || Array.isArray(aiOutput)) {
    return {
      status: 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION',
      protectedFieldCount: protectedFieldCount,
      violations: [{ path: '<root>', reason: 'AI output is not a plain object' }],
      snapshot: snapshot,
    }
  }

  // ── 1. Authoritative block (if present) must fully match snapshot ──
  var block = aiOutput[AUTHORITATIVE_BLOCK]
  if (block !== undefined) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      violations.push({ path: AUTHORITATIVE_BLOCK, reason: 'authoritative block must be a plain object' })
    } else {
      for (var i = 0; i < PROTECTED_PATHS.length; i++) {
        var p = PROTECTED_PATHS[i]
        if (!Object.prototype.hasOwnProperty.call(snapshot, p)) continue
        if (!Object.prototype.hasOwnProperty.call(block, p)) {
          violations.push({ path: AUTHORITATIVE_BLOCK + '.' + p, reason: 'missing protected field' })
        } else if (!util.deepEqual(block[p], snapshot[p])) {
          violations.push({ path: AUTHORITATIVE_BLOCK + '.' + p, reason: 'protected field changed / nullified / retyped' })
        }
      }
    }
  }

  // ── 2. Any protected field placed directly on AI output ──
  for (var j = 0; j < PROTECTED_PATHS.length; j++) {
    var field = PROTECTED_PATHS[j]
    if (!Object.prototype.hasOwnProperty.call(aiOutput, field)) continue
    var loc = locateProtectedField(aiOutput, field)
    if (loc.found && !util.deepEqual(loc.value, snapshot[field])) {
      violations.push({ path: field, reason: 'authoritative field changed by AI' })
    }
  }

  // ── 3. Semantic smuggling: unexpected diagnostic-semantic keys ──
  var topKeys = Object.keys(aiOutput)
  for (var k = 0; k < topKeys.length; k++) {
    var key = topKeys[k]
    if (AI_ALLOWED_PATHS.indexOf(key) !== -1) continue
    if (key === AUTHORITATIVE_BLOCK) continue
    if (PROTECTED_PATHS.indexOf(key) !== -1) continue
    if (DIAGNOSTIC_SEMANTIC_KEY_RE.test(key)) {
      violations.push({ path: key, reason: 'non-authoritative diagnostic field (semantic smuggling)' })
    }
  }

  // ── 4. Prose fields must be string|null (no structured sub-diagnosis) ──
  for (var m = 0; m < AI_ALLOWED_PATHS.length; m++) {
    var prose = AI_ALLOWED_PATHS[m]
    if (!Object.prototype.hasOwnProperty.call(aiOutput, prose)) continue
    var v = aiOutput[prose]
    if (v !== null && typeof v !== 'string') {
      violations.push({ path: prose, reason: 'prose field must be string or null (no structured sub-diagnosis)' })
    }
  }

  return {
    status: violations.length === 0
      ? 'AI_RENDER_ACCEPTED'
      : 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION',
    protectedFieldCount: protectedFieldCount,
    violations: violations,
    snapshot: snapshot,
  }
}

module.exports = {
  PROTECTED_PATHS: PROTECTED_PATHS,
  AI_ALLOWED_PATHS: AI_ALLOWED_PATHS,
  AUTHORITATIVE_BLOCK: AUTHORITATIVE_BLOCK,
  DIAGNOSTIC_SEMANTIC_KEY_RE: DIAGNOSTIC_SEMANTIC_KEY_RE,
  RENDER_SOURCE: RENDER_SOURCE,
  buildAuthoritySnapshot: buildAuthoritySnapshot,
  validateAuthority: validateAuthority,
}
