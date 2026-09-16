'use strict'
/**
 * turnaroundStrategy/v6/hybrid/assetAxisV6.js
 *
 * RC8.4 V6 R44 — ADDITIVE ASSET / VALUE AXIS.
 *
 * Evidence sources: occupation, monetizableSkill, skillValidation, incomeStructure.
 * Deterministic ladder. ZERO bottleneck authority.
 *
 * ASSET_AXIS_DIAGNOSIS_MUTATION_COUNT = 0 (frozen): this module is never read by
 * any B1 file. It only produces report context.
 *
 * Ladder (evidence-grounded, non-overlapping):
 *   NO_CLEAR_ASSET             no named capability + never monetized
 *   SKILL_IDENTIFIED_UNPROVEN  a named capability exists, never monetized
 *   SKILL_USED_FREE            capability used and appreciated, unpaid
 *   PROBLEM_SOLVING_PROOF      capability solved a real problem, unpaid
 *   PAID_ONCE                  capability earned money exactly once
 *   OCCASIONAL_PAID            capability earns money occasionally
 *   REPEATABLE_PAID            capability has stable paying customers
 *
 * CONSUMER LAYER ONLY. Deterministic. No AI. No I/O.
 */

const PROOF_LADDER = [
  'NO_CLEAR_ASSET',
  'SKILL_IDENTIFIED_UNPROVEN',
  'SKILL_USED_FREE',
  'PROBLEM_SOLVING_PROOF',
  'PAID_ONCE',
  'OCCASIONAL_PAID',
  'REPEATABLE_PAID'
]

// Proof option -> ladder index (deterministic; no inference beyond the ladder).
const PROOF_TO_INDEX = {
  PROOF_NEVER: 0, // refined to 0/1 by asset type presence
  PROOF_FREE_THANKED: 2,
  PROOF_FREE_HELPED: 3,
  PROOF_PAID_ONCE: 4,
  PROOF_OCCASIONAL: 5,
  PROOF_STABLE: 6
}

// How far the proof level lets the report ASSERT market validation.
// 0..2 => may NOT claim the capability has been validated by the market.
const MARKET_VALIDATED_FROM_INDEX = 4 // PAID_ONCE and above

/**
 * @param {Object} hybrid HybridProfile
 * @returns {{state:string, index:number, canMonetize:boolean,
 *   marketValidated:boolean, assetNamed:boolean, sources:string[]}}
 */
function computeAssetStateV6 (hybrid) {
  if (!hybrid || !hybrid.asset) {
    return { state: 'NO_CLEAR_ASSET', index: 0, canMonetize: false, marketValidated: false, assetNamed: false, sources: [] }
  }
  const type = hybrid.asset.type
  const proof = hybrid.asset.marketProof
  const assetNamed = !!(type && type !== 'ASSET_UNCLEAR')

  let index
  if (proof === 'PROOF_NEVER') {
    index = assetNamed ? 1 : 0
  } else {
    index = Object.prototype.hasOwnProperty.call(PROOF_TO_INDEX, proof)
      ? PROOF_TO_INDEX[proof]
      : 0
  }

  return {
    state: PROOF_LADDER[index],
    index,
    canMonetize: assetNamed,
    marketValidated: index >= MARKET_VALIDATED_FROM_INDEX,
    assetNamed,
    sources: ['monetizableSkill', 'skillValidation'].concat(
      hybrid.reality && hybrid.reality.occupation ? ['occupationDetail'] : []
    )
  }
}

module.exports = { computeAssetStateV6, PROOF_LADDER, MARKET_VALIDATED_FROM_INDEX }
