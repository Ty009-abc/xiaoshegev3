'use strict'
/**
 * turnaroundStrategy/v6/actionTypeV6.js
 *
 * Action TYPE only (no user-facing prose). Deterministic derivation from
 *   execution stage + primary bottleneck + reality constraint.
 * No AI call.
 *
 * Canonical V6 action-type enum:
 *   DIRECTION_NARROWING
 *   SMALLEST_EXTERNAL_TEST
 *   CONSISTENCY_PROTECTION
 *   BUYER_FEEDBACK_COLLECTION
 *   REPEAT_SUCCESS_PATH
 *   CASHFLOW_SAFE_EXPERIMENT
 */

const BASE_BY_BOTTLENECK = {
  DIRECTION_GAP: 'DIRECTION_NARROWING',
  ACTION_GAP: 'SMALLEST_EXTERNAL_TEST',
  CONSISTENCY_GAP: 'CONSISTENCY_PROTECTION',
  VALIDATION_GAP: 'BUYER_FEEDBACK_COLLECTION',
  REPEATABILITY_GAP: 'REPEAT_SUCCESS_PATH'
}

// Legacy equivalents from the frozen contract §15 table (kept for traceability).
const LEGACY_EQUIVALENT = {
  DIRECTION_GAP: 'MINIMAL_REAL_EXPERIMENT',
  ACTION_GAP: 'MINIMAL_DELIVERY_TO_REAL_PERSON',
  CONSISTENCY_GAP: 'LOCK_RECURRING_SLOT',
  VALIDATION_GAP: 'ASK_BUYERS_DEMAND_QUESTION',
  REPEATABILITY_GAP: 'REPLICATE_CLOSING_STEPS'
}

/**
 * @param {string} stage current execution stage
 * @param {string|null} primaryBottleneck
 * @param {{present:boolean, types:string[]}} realityConstraint
 * @returns {{firstActionType:string|null, stageSource:string|null,
 *   bottleneckSource:string|null, constraintSources:string[], reasoning:string}}
 */
function deriveActionType (stage, primaryBottleneck, realityConstraint) {
  if (!primaryBottleneck) {
    return {
      firstActionType: null,
      stageSource: stage || null,
      bottleneckSource: null,
      constraintSources: realityConstraint ? realityConstraint.types : [],
      reasoning: 'NO_PRIMARY -> no action type asserted'
    }
  }

  const constraintTypes = (realityConstraint && realityConstraint.types) || []
  const cashflow = constraintTypes.includes('CASHFLOW_PRESSURE')

  // Cashflow pressure forces a capital-safe experiment regardless of the base type.
  if (cashflow) {
    return {
      firstActionType: 'CASHFLOW_SAFE_EXPERIMENT',
      stageSource: stage,
      bottleneckSource: primaryBottleneck,
      constraintSources: constraintTypes,
      reasoning: 'CASHFLOW_PRESSURE constraint -> capital-safe experiment'
    }
  }

  return {
    firstActionType: BASE_BY_BOTTLENECK[primaryBottleneck] || null,
    stageSource: stage,
    bottleneckSource: primaryBottleneck,
    constraintSources: constraintTypes,
    reasoning: 'stage + bottleneck mapping'
  }
}

module.exports = { BASE_BY_BOTTLENECK, LEGACY_EQUIVALENT, deriveActionType }
