/**
 * tools/rc83-stage21-batch3/lib/rollbackTooling.js
 *
 * W8 — Rollback Operational Tooling (DRY-RUN ONLY by default).
 *
 * Produces machine-readable rollback plans and validates fail-closed rollback
 * preconditions. It NEVER performs a real production mutation:
 *
 *   - default mode is DRY_RUN
 *   - any production writer must be INJECTED and ABSENT in the default runner
 *   - tests have NO real production credentials
 *
 * FAIL-CLOSED ROLLBACK: if any precondition is unmet, ROLLBACK_EXECUTION_ALLOWED
 *   = NO. Never best-effort.
 *
 * CODE DEPLOY ≠ CONFIG ROLLBACK (Batch1 frozen principle): this tooling plans
 *   mode/config rollback only; it must NOT mutate mode via a code deploy.
 */

'use strict'

var crypto = require('crypto')

var VALID_TARGET_MODES = {
  SHADOW: true,
  SELECTIVE_PRIMARY: true,
  PRIMARY: true,
}

// ── Valid current (observed) modes ──
var VALID_MODES = {
  SHADOW: true,
  SELECTIVE_PRIMARY: true,
  PRIMARY: true,
}

// ── FROZEN legal rollback transitions (R1) ──
// Only these two are legal for rollback execution:
//   SELECTIVE_PRIMARY → SHADOW
//   PRIMARY → SHADOW
// ALL other transitions fail-closed (INVALID_MODE_TRANSITION).
var ALLOWED_ROLLBACK_TRANSITIONS = {
  SELECTIVE_PRIMARY: { SHADOW: true },
  PRIMARY: { SHADOW: true },
}

// ── The ONLY legal rollback target mode ──
var ROLLBACK_TARGET_MODE = 'SHADOW'

var TRIGGER_CLASS = {
  HARD_BLOCKER: 'HARD_BLOCKER',
  ROLLOUT_ABORT: 'ROLLOUT_ABORT',
  ROLLOUT_PAUSE: 'ROLLOUT_PAUSE',
  MANUAL: 'MANUAL',
}

var MODE = {
  DRY_RUN: 'DRY_RUN',
  EXECUTE: 'EXECUTE',
}

/**
 * Build a machine-readable rollback plan. Contains NO secret/identity.
 *
 * @param {object} p
 *   - currentMode         {string} SELECTIVE_PRIMARY | PRIMARY | SHADOW
 *   - targetMode          {string} SHADOW (typically)
 *   - environmentId       {string}
 *   - expectedConfigFingerprint {string} (identity/secret-free fingerprint)
 *   - rollbackTargetSha   {string} target commit SHA to roll back to
 *   - triggerClass        {string} one of TRIGGER_CLASS
 *   - verificationSteps   {Array<string>}
 *   - abortConditions     {Array<string>}
 * @returns {object} plan
 */
function buildRollbackPlan(p) {
  p = p || {}
  var plan = {
    currentMode: p.currentMode || null,
    targetMode: p.targetMode || 'SHADOW',
    environmentId: p.environmentId || null,
    expectedConfigFingerprint: p.expectedConfigFingerprint || null,
    rollbackTargetSha: p.rollbackTargetSha || null,
    triggerClass: p.triggerClass || TRIGGER_CLASS.MANUAL,
    verificationSteps: Array.isArray(p.verificationSteps) ? p.verificationSteps.slice() : [],
    abortConditions: Array.isArray(p.abortConditions) ? p.abortConditions.slice() : [],
    planGeneratedAt: null, // no Date.now → deterministic; timestamp intentionally omitted
  }
  return plan
}

/**
 * Validate fail-closed rollback preconditions.
 *
 * @param {object} plan   a rollback plan (from buildRollbackPlan)
 * @param {object} state  live state evidence
 *   - liveEnvironmentId      {string}
 *   - liveConfigFingerprint  {string}
 *   - knownDeploymentState   {boolean}
 *   - authorityReadable      {boolean}
 *   - mode                   {string} current live mode
 * @returns {object} { allowed, reasons:[], mode }
 */
function evaluateRollbackPreconditions(plan, state) {
  state = state || {}
  var reasons = []
  var allowed = true

  // Environment mismatch
  if (plan.environmentId && state.liveEnvironmentId !== undefined &&
      state.liveEnvironmentId !== plan.environmentId) {
    allowed = false
    reasons.push('ENVIRONMENT_MISMATCH')
  }
  // Config fingerprint mismatch
  if (plan.expectedConfigFingerprint && state.liveConfigFingerprint !== undefined &&
      state.liveConfigFingerprint !== plan.expectedConfigFingerprint) {
    allowed = false
    reasons.push('CONFIG_FINGERPRINT_MISMATCH')
  }
  // Unknown deployment state
  if (state.knownDeploymentState !== true) {
    allowed = false
    reasons.push('UNKNOWN_DEPLOYMENT_STATE')
  }
  // Missing rollback SHA
  if (!plan.rollbackTargetSha) {
    allowed = false
    reasons.push('MISSING_ROLLBACK_SHA')
  } else if (!/^[0-9a-f]{7,40}$/i.test(String(plan.rollbackTargetSha))) {
    allowed = false
    reasons.push('INVALID_ROLLBACK_SHA_FORMAT')
  }
  // Missing config fingerprint (cannot verify drift) → fail-closed
  if (!plan.expectedConfigFingerprint) {
    allowed = false
    reasons.push('MISSING_CONFIG_FINGERPRINT')
  }
  // Invalid target mode (general enum check; kept for planning schemas)
  if (!VALID_TARGET_MODES[plan.targetMode]) {
    allowed = false
    reasons.push('INVALID_TARGET_MODE')
  }
  // Authority unreadable
  if (state.authorityReadable !== true) {
    allowed = false
    reasons.push('AUTHORITY_UNREADABLE')
  }

  // ── Mode-transition legality (R1) ──
  // AUTHORITY: observed state.mode is authoritative; plan.currentMode is only
  // an expected value. If both exist and disagree → CURRENT_MODE_MISMATCH.
  var observedMode = state.mode
  var expectedMode = plan.currentMode
  var hasObserved = observedMode !== undefined && observedMode !== null && observedMode !== ''
  var hasExpected = expectedMode !== undefined && expectedMode !== null && expectedMode !== ''

  if (hasObserved && hasExpected &&
      String(expectedMode).toUpperCase() !== String(observedMode).toUpperCase()) {
    allowed = false
    reasons.push('CURRENT_MODE_MISMATCH')
  }

  // Current mode must be an authoritative observed mode (no silent normalize).
  var currentMode = hasObserved ? String(observedMode).toUpperCase() : null
  if (!currentMode || !VALID_MODES[currentMode]) {
    allowed = false
    reasons.push('INVALID_MODE_TRANSITION')
  } else {
    var target = plan.targetMode === undefined || plan.targetMode === null
      ? null
      : String(plan.targetMode).toUpperCase()
    if (target !== ROLLBACK_TARGET_MODE) {
      allowed = false
      reasons.push('INVALID_MODE_TRANSITION')
    } else if (!ALLOWED_ROLLBACK_TRANSITIONS[currentMode] ||
               !ALLOWED_ROLLBACK_TRANSITIONS[currentMode][target]) {
      allowed = false
      reasons.push('INVALID_MODE_TRANSITION')
    }
  }

  return {
    allowed: allowed,
    rollbackExecutionAllowed: allowed ? 'YES' : 'NO',
    reasons: reasons,
    mode: MODE.DRY_RUN,
  }
}

/**
 * Dry-run a rollback plan against live state (zero mutation by construction).
 * The `writer` parameter, if provided, is a TEST-ONLY injection point; the
 * default runner does NOT supply one, so no production mutation is possible.
 *
 * @param {object} plan    rollback plan
 * @param {object} state   live state evidence
 * @param {object} [opts]  { writer, allowExecute } — writer absent by default
 * @returns {object} { executed, mode, rollbackExecutionAllowed, reasons, mutationsApplied }
 */
function runRollback(plan, state, opts) {
  opts = opts || {}
  var evalResult = evaluateRollbackPreconditions(plan, state)

  // Default: DRY_RUN. Real mutation only if EXPLICITLY authorized AND a writer
  // is injected AND preconditions pass.
  var execute = opts.allowExecute === true && typeof opts.writer === 'function'

  if (!execute) {
    return {
      executed: false,
      mode: MODE.DRY_RUN,
      rollbackExecutionAllowed: evalResult.rollbackExecutionAllowed,
      reasons: evalResult.reasons,
      mutationsApplied: 0,
    }
  }

  // Even with a writer, preconditions must hold (fail-closed).
  if (!evalResult.allowed) {
    return {
      executed: false,
      mode: MODE.DRY_RUN,
      rollbackExecutionAllowed: 'NO',
      reasons: evalResult.reasons,
      mutationsApplied: 0,
    }
  }

  // Authorized + injected writer + preconditions OK → call writer (test only).
  opts.writer(plan)
  return {
    executed: true,
    mode: MODE.EXECUTE,
    rollbackExecutionAllowed: 'YES',
    reasons: evalResult.reasons,
    mutationsApplied: 1,
  }
}

/**
 * Kill-switch model (SELECTIVE_PRIMARY → SHADOW).
 * Single-purpose, machine-readable, auditable, fail-closed.
 *
 * @param {object} p { environmentId, expectedConfigFingerprint, rollbackTargetSha }
 * @returns {object} kill-switch plan (DRY_RUN by construction)
 */
function buildKillSwitchPlan(p) {
  p = p || {}
  return buildRollbackPlan({
    currentMode: 'SELECTIVE_PRIMARY',
    targetMode: 'SHADOW',
    environmentId: p.environmentId || null,
    expectedConfigFingerprint: p.expectedConfigFingerprint || null,
    rollbackTargetSha: p.rollbackTargetSha || null,
    triggerClass: TRIGGER_CLASS.MANUAL,
    verificationSteps: [
      'confirm deployed mode has returned to SHADOW',
      'confirm function env V2_MODE/V21_MODE = SHADOW',
      'confirm zero user-visible report regression',
    ],
    abortConditions: [
      'environment mismatch',
      'config fingerprint mismatch',
      'authority unreadable',
    ],
  })
}

/**
 * Report whether the current real control plane can support a single-purpose
 * kill switch (mode-only) WITHOUT redeploying the full code bundle.
 *
 * This module CANNOT know the live control plane, so it reports a capability
 * gap by default unless authoritative evidence is injected.
 *
 * @param {object} [evidence] { supportsModeOnlyKillSwitch: boolean }
 * @returns {object} { rollbackCapabilityGap: 'PRESENT'|'NONE'|'UNKNOWN' }
 */
function assessKillSwitchCapability(evidence) {
  if (!evidence || typeof evidence.supportsModeOnlyKillSwitch !== 'boolean') {
    return { rollbackCapabilityGap: 'UNKNOWN', note: 'no authoritative control-plane evidence injected' }
  }
  return evidence.supportsModeOnlyKillSwitch
    ? { rollbackCapabilityGap: 'NONE' }
    : { rollbackCapabilityGap: 'PRESENT' }
}

module.exports = {
  VALID_TARGET_MODES: VALID_TARGET_MODES,
  VALID_MODES: VALID_MODES,
  ALLOWED_ROLLBACK_TRANSITIONS: ALLOWED_ROLLBACK_TRANSITIONS,
  ROLLBACK_TARGET_MODE: ROLLBACK_TARGET_MODE,
  TRIGGER_CLASS: TRIGGER_CLASS,
  MODE: MODE,
  buildRollbackPlan: buildRollbackPlan,
  evaluateRollbackPreconditions: evaluateRollbackPreconditions,
  runRollback: runRollback,
  buildKillSwitchPlan: buildKillSwitchPlan,
  assessKillSwitchCapability: assessKillSwitchCapability,
}
