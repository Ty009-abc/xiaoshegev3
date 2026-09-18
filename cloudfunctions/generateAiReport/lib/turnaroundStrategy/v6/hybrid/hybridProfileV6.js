'use strict'
/**
 * turnaroundStrategy/v6/hybrid/hybridProfileV6.js
 *
 * RC8.4 V6 R44 — normalized HYBRID profile.
 *
 * Input:  validated raw hybrid answers (10 screens / 18 fields).
 * Output: ONE canonical HybridProfile:
 *
 *   reality       { lifeStage, incomeStructure, occupation, monthlySurplus,
 *                   safetyMonths, debtPressure }
 *   asset         { type, marketProof, skillDetail }
 *   capacity      { weeklyTime, executionStability, maxTrialCost }
 *   desiredChange { primaryProblem, primaryGoal }
 *   belief        { perceivedRootCause }
 *   stage         { pastAttemptStage }
 *   behavior      { decisionStyle, timeAllocation, noResultResponse }
 *
 * AUTHORITY: pure normalization. NO bottleneck authority. NO scoring. NO AI.
 * The asset/reality layer is CONTEXT ONLY — it may never change primaryBottleneck.
 *
 * No field silently overwrites another: every raw field lands in exactly one
 * destination slot, and the canonical V6 semantic fields (selfBelief /
 * timeBehavior / primaryProblem) are kept separate from the V4-rich fields.
 */

const C = require('./hybridContractV6.js')
const { computeRealEconomyModelV6 } = require('./realEconomyModelV6.js')
const { computeGameModelV6 } = require('./gameModelV6.js')

// R85-C §4 — pricing authority is normalized to its own value vocabulary (who
// decides the final income). ZERO B1 authority (B1 inputs unchanged).
const PRICING_AUTHORITY_VALUE = Object.freeze({
  PRICE_EMPLOYER: 'EMPLOYER',
  PRICE_PLATFORM: 'PLATFORM',
  PRICE_CLIENT: 'CLIENT',
  PRICE_SELF: 'USER',
  PRICE_MIXED: 'MIXED',
  PRICE_UNKNOWN: 'UNKNOWN'
})

/**
 * @param {Object} raw validated hybrid answers
 * @returns {Object|null} HybridProfile or null when the contract is invalid
 */
function buildHybridProfileV6 (raw) {
  const check = C.validateHybridRaw(raw)
  if (!check.valid) return null

  const txt = (k) => {
    const v = raw[k]
    return (typeof v === 'string' && v.trim()) ? raw[k].trim() : null
  }

  const profile = {
    reality: {
      lifeStage: raw.lifeStage,
      incomeStructure: raw.incomeStructure,
      incomeModeCanonical: C.canonicalFor('incomeStructure', raw.incomeStructure),
      occupation: txt('occupationDetail'), // R85-B: REQUIRED free text — never invented
      occupationCategory: raw.occupationCategory || null, // R85-B: required quick-select
      // R85-C §4 — pricing authority (REQUIRED on S2; direct GAME/RULE authority,
      // ZERO B1 authority). Stored raw + normalized; never invented.
      pricingAuthority: raw.pricingAuthority || null,
      pricingAuthorityValue: PRICING_AUTHORITY_VALUE[raw.pricingAuthority] || null,
      monthlySurplus: raw.monthlySurplus,
      surplusCanonical: C.canonicalFor('monthlySurplus', raw.monthlySurplus),
      safetyMonths: raw.safetyMonths,
      debtPressure: raw.debtPressure
    },
    asset: {
      type: raw.monetizableSkill, // ASSET_* family
      marketProof: raw.skillValidation, // PROOF_* ladder
      skillDetail: null // no free-text skill field in this contract
    },
    capacity: {
      weeklyTime: raw.weeklyTime,
      executionStability: raw.executionStability,
      maxTrialCost: raw.maxTrialCost
    },
    desiredChange: {
      primaryProblem: raw.primaryProblem, // canonical PROBLEM_* (B1 evidence)
      primaryGoal: raw.primaryGoal // V4 goal (REPORT-ONLY)
    },
    belief: {
      perceivedRootCause: raw.selfBelief // canonical BELIEF_* (B1 evidence)
    },
    stage: {
      pastAttemptStage: raw.pastAttemptStage
    },
    behavior: {
      decisionStyle: raw.decisionStyle,
      timeAllocation: raw.timeBehavior, // canonical TIME_* (B1 evidence)
      noResultResponse: raw.failureResponse
    },
    _raw: Object.assign({}, raw)
  }

  // R85-B §11 — attach the deterministic real economy model as RUNTIME context.
  // ZERO B1 authority (never read by any B1 file); not a second profile store.
  profile.realEconomyModel = computeRealEconomyModelV6(profile)
  // R85-C §3 — attach the deterministic GAME MODEL (derived ABOVE the economy
  // model) as RUNTIME context. EVIDENCE_LAYER only: ZERO B1 authority, never
  // read by any B1 file, and NEVER persisted as a permanent profile fact.
  profile.gameModel = computeGameModelV6(profile.realEconomyModel, profile)
  return profile
}

module.exports = { buildHybridProfileV6 }
