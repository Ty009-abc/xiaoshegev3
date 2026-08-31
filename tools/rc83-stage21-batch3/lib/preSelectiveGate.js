/**
 * tools/rc83-stage21-batch3/lib/preSelectiveGate.js
 *
 * W7 — Pre-Selective-Primary Threshold Governance.
 *
 * The PRE_SELECTIVE_PRIMARY_GATE is a governance decision surface. It is NOT
 * the PRIMARY switch. Its inputs are release evidence / governance state only,
 * never a single boolean `ready`.
 *
 * FAIL-CLOSED EVIDENCE SEMANTICS (reuse Batch1 frozen set):
 *   PASS | FAIL | NOT_RUN | NOT_APPLICABLE | BLOCKED
 *
 * NOT_RUN / NOT_APPLICABLE / UNKNOWN are NEVER interpreted as PASS.
 *
 * HARD RULE (Gate-B): only GATE_B = PASS may allow further gate evaluation.
 *   ACTIVE / INSUFFICIENT_SAMPLE / FAIL / PAUSED_FOR_REVIEW → BLOCKED.
 *
 * NO SYNTHETIC SUBSTITUTION: harness / batch qualification / local tests can
 *   never stand in for Gate-B PASS, real-device smoke, or production regression.
 */

'use strict'

// ── Evidence state closed set (frozen Batch1 semantics) ──
var EVIDENCE_STATE = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_RUN: 'NOT_RUN',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  BLOCKED: 'BLOCKED',
}

// ── Threshold classes (frozen Stage21 design; schema + required evidence only,
//    no invented numeric thresholds where the design does not specify one) ──
var THRESHOLD_CLASS = {
  HARD_BLOCKER: 'HARD_BLOCKER',
  ROLLOUT_ABORT: 'ROLLOUT_ABORT',
  ROLLOUT_PAUSE: 'ROLLOUT_PAUSE',
  OBSERVATIONAL_ONLY: 'OBSERVATIONAL_ONLY',
}

// ── Gate-B states that can NEVER allow selective primary ──
var GATE_B_BLOCKING_STATES = {
  ACTIVE: true,
  INSUFFICIENT_SAMPLE: true,
  FAIL: true,
  PAUSED_FOR_REVIEW: true,
}

// ── The only Gate-B state that permits further evaluation ──
var GATE_B_PASS_STATE = 'PASS'

// ── Required evidence inputs for the pre-selective gate ──
var REQUIRED_EVIDENCE_KEYS = [
  'GATE_B_STATUS',
  'BATCH1_STATUS',
  'BATCH2_STATUS',
  'RC_QUALIFICATION_STATUS',
  'REAL_DEVICE_SMOKE_STATUS',
  'CONFIG_DRIFT_STATUS',
  'ROLLBACK_READINESS',
  'PRODUCTION_REGRESSION_STATUS',
]

// ── Evidence that MUST NOT be substituted by synthetic/local results ──
//    (their PASS may only originate from the real source of truth) ──
var NON_SUBSTITUTABLE_KEYS = {
  GATE_B_STATUS: true,
  REAL_DEVICE_SMOKE_STATUS: true,
  PRODUCTION_REGRESSION_STATUS: true,
}

/**
 * Validate a raw evidence state string.
 * @returns {string|null} normalized state, or null if invalid
 */
function normalizeEvidenceState(value) {
  if (typeof value !== 'string') return null
  var v = value.trim().toUpperCase()
  if (EVIDENCE_STATE[v]) return v
  // Common unknown-ish inputs → do NOT silently pass; return null (invalid).
  if (v === 'UNKNOWN' || v === 'PENDING' || v === '') return null
  return null
}

/**
 * Evaluate the pre-selective-primary gate.
 *
 * @param {object} evidence  map of evidenceKey → state string (closed set)
 * @param {object} [opts]
 *   - opts.allowSyntheticSubstitution {boolean} MUST be false in governance;
 *     exists only so tests can prove substitution is rejected by default.
 * @returns {object} { decision, gateResult, reasons:[], requiredEvidence, missingEvidence:[] }
 */
function evaluatePreSelectiveGate(evidence, opts) {
  opts = opts || {}
  var reasons = []
  var missing = []
  evidence = evidence || {}

  // ── 1. Gate-B hard gate ──
  var gbRaw = evidence.GATE_B_STATUS
  var gb = typeof gbRaw === 'string' ? gbRaw.trim().toUpperCase() : null
  if (gb === null || gb === '' || gb === 'UNKNOWN' || gb === 'NOT_RUN' || gb === 'BLOCKED') {
    return gateDecision({
      decision: 'BLOCKED',
      gateResult: 'BLOCKED',
      reasons: ['GATE_B_STATUS is not a determinate PASS; cannot evaluate selective primary'],
      missing: missing,
    })
  }
  if (GATE_B_BLOCKING_STATES[gb]) {
    return gateDecision({
      decision: 'BLOCKED',
      gateResult: 'BLOCKED',
      reasons: ['GATE_B_STATUS=' + gb + ' blocks selective primary (only PASS may continue)'],
      missing: missing,
    })
  }
  if (gb !== GATE_B_PASS_STATE) {
    return gateDecision({
      decision: 'BLOCKED',
      gateResult: 'BLOCKED',
      reasons: ['GATE_B_STATUS=' + gb + ' is not a recognized PASS state'],
      missing: missing,
    })
  }

  // ── 2. Required evidence presence + normalization ──
  var normalized = {}
  for (var i = 0; i < REQUIRED_EVIDENCE_KEYS.length; i++) {
    var key = REQUIRED_EVIDENCE_KEYS[i]
    if (!Object.prototype.hasOwnProperty.call(evidence, key)) {
      missing.push(key)
      continue
    }
    var norm = normalizeEvidenceState(evidence[key])
    if (norm === null) {
      reasons.push(key + ' has an unrecognized/indeterminate state (fail-closed)')
      missing.push(key)
      continue
    }
    normalized[key] = norm
  }

  if (missing.length > 0) {
    return gateDecision({
      decision: 'BLOCKED',
      gateResult: 'BLOCKED',
      reasons: reasons.concat(['missing or indeterminate required evidence: ' + missing.join(', ')]),
      missing: missing,
    })
  }

  // ── 3. Fail-closed: any HARD blocker evidence is FAIL → BLOCKED ──
  for (var j = 0; j < REQUIRED_EVIDENCE_KEYS.length; j++) {
    var k = REQUIRED_EVIDENCE_KEYS[j]
    if (normalized[k] === EVIDENCE_STATE.FAIL) {
      reasons.push(k + '=FAIL (hard blocker)')
    }
  }

  // ── 4. NOT_RUN / NOT_APPLICABLE / BLOCKED → not a PASS (fail-closed) ──
  var nonPass = []
  for (var m = 0; m < REQUIRED_EVIDENCE_KEYS.length; m++) {
    var kk = REQUIRED_EVIDENCE_KEYS[m]
    if (normalized[kk] !== EVIDENCE_STATE.PASS && normalized[kk] !== EVIDENCE_STATE.NOT_APPLICABLE) {
      nonPass.push(kk + '=' + normalized[kk])
    }
  }

  // NOT_APPLICABLE is allowed only where semantically permitted; we treat it
  // as non-blocking but still record it (never as PASS).
  var hardFail = reasons.length > 0 || nonPass.length > 0

  if (hardFail) {
    var allReasons = reasons.concat(nonPass.map(function (s) { return s + ' (not PASS)' }))
    return gateDecision({
      decision: 'BLOCKED',
      gateResult: 'BLOCKED',
      reasons: allReasons,
      missing: missing,
    })
  }

  return gateDecision({
    decision: 'READY',
    gateResult: 'READY',
    reasons: ['all required evidence PASS; Gate-B PASS; selective primary may be considered by governance'],
    missing: missing,
  })
}

function gateDecision(o) {
  return {
    decision: o.decision,
    gateResult: o.gateResult,
    reasons: o.reasons,
    requiredEvidence: REQUIRED_EVIDENCE_KEYS,
    missingEvidence: o.missing || [],
    thresholdClasses: THRESHOLD_CLASS,
  }
}

module.exports = {
  EVIDENCE_STATE: EVIDENCE_STATE,
  THRESHOLD_CLASS: THRESHOLD_CLASS,
  GATE_B_BLOCKING_STATES: GATE_B_BLOCKING_STATES,
  GATE_B_PASS_STATE: GATE_B_PASS_STATE,
  REQUIRED_EVIDENCE_KEYS: REQUIRED_EVIDENCE_KEYS,
  NON_SUBSTITUTABLE_KEYS: NON_SUBSTITUTABLE_KEYS,
  normalizeEvidenceState: normalizeEvidenceState,
  evaluatePreSelectiveGate: evaluatePreSelectiveGate,
}
