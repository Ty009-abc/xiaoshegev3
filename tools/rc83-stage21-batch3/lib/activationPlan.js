/**
 * tools/rc83-stage21-batch3/lib/activationPlan.js
 *
 * SELECTIVE_PRIMARY_ACTIVATION_PLAN governance.
 *
 * Produces a machine-readable activation plan, but the plan is ALWAYS:
 *   NOT_AUTHORIZED (default) or DRY_RUN
 *
 * ACTIVATION_ALLOWED is FALSE while Gate-B is not PASS. This module cannot
 * authorize activation; it only declares authorization state.
 *
 * Contains NO secret / identity / raw subject token.
 */

'use strict'

var preSelectiveGate = require('./preSelectiveGate')

var ACTIVATION_STATE = {
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  DRY_RUN: 'DRY_RUN',
}

/**
 * Build a selective-primary activation plan (governance artifact).
 *
 * @param {object} p
 *   - environmentId        {string}
 *   - rolloutSaltVersion   {string}
 *   - rolloutBasisPoints   {number}
 *   - cohortAlgorithmVersion {string}
 *   - targetSha            {string} code SHA under consideration
 *   - preSelectiveGateResult {object} (from evaluatePreSelectiveGate)
 * @returns {object} plan (identity/secret-free)
 */
function buildActivationPlan(p) {
  p = p || {}
  var gateResult = p.preSelectiveGateResult || null
  var activationAllowed = !!(gateResult && gateResult.decision === 'READY')

  return {
    planType: 'SELECTIVE_PRIMARY_ACTIVATION_PLAN',
    activationState: activationAllowed ? ACTIVATION_STATE.DRY_RUN : ACTIVATION_STATE.NOT_AUTHORIZED,
    activationAllowed: activationAllowed,
    environmentId: p.environmentId || null,
    rolloutSaltVersion: p.rolloutSaltVersion || null,
    rolloutBasisPoints: p.rolloutBasisPoints || null,
    cohortAlgorithmVersion: p.cohortAlgorithmVersion || null,
    targetSha: p.targetSha || null,
    gateDecision: gateResult ? gateResult.decision : 'BLOCKED',
    gateReasons: gateResult ? gateResult.reasons.slice() : [],
  }
}

module.exports = {
  ACTIVATION_STATE: ACTIVATION_STATE,
  buildActivationPlan: buildActivationPlan,
}
