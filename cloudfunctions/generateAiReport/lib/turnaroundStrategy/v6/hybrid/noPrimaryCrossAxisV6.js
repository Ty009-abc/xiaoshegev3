'use strict'
/**
 * turnaroundStrategy/v6/hybrid/noPrimaryCrossAxisV6.js
 *
 * RC8.4 V6 R53 — NO_PRIMARY CROSS-AXIS STRATEGY SCOPE (fail-closed).
 *
 * PROBLEM (R52 audit): the R48 compatibility gate returns EARLY for every
 * non-PRIMARY diagnosis (`compatible('NO_PRIMARY_CLAIM')`), so a NO_PRIMARY
 * report ALWAYS carried crossAxisScope = COMPATIBLE. Consequence: when the user
 * held a market-validated asset but their CURRENT desired change was a NEW
 * direction (career switch / no future), the NO_PRIMARY strategy still assumed
 * the proven asset WAS the current path and told the user to repeat /
 * systematize / scale it — a cross-axis path overreach (12,680 reachable cases).
 *
 * FIX: for the NO_PRIMARY path only, evaluate a dedicated, deterministic scope:
 *   COMPATIBLE  — the evidence supports linking the proven asset to the current
 *                 desired change (same captured asset, anchored, monetization /
 *                 income problem).
 *   UNPROVEN    — the link can NOT be proven (direction shift, or any ambiguity).
 *
 * MARKET PROOF establishes ONLY that an asset has market evidence. It does NOT
 * establish that the asset is the correct path for the current desired change.
 * Therefore the default is UNPROVEN: the system must FAIL CLOSED on ambiguity.
 *
 * AUTHORITY: this module has ZERO diagnosis authority. It reads existing
 * evidence fields and returns a scope string. It never touches
 * primaryBottleneck / stage / action type / belief / reality constraint.
 * Deterministic. No AI. No I/O. No network.
 *
 * EVIDENCE_CONFLICT remains owned by the R48 gate (evaluated BEFORE this) and is
 * never routed here.
 */

// Desired-change signals that mean the user is moving to a DIFFERENT objective.
const DIRECTION_SHIFT_PROBLEMS = ['PROBLEM_CAREER_SWITCH', 'PROBLEM_NO_FUTURE']
const DIRECTION_SHIFT_GOALS = ['GOAL_CAREER_SWITCH', 'GOAL_FIND_DIRECTION']

// Desired-change signals that can plausibly be about the SAME captured asset's
// monetization — eligible for COMPATIBLE *only* when the asset is anchored.
const SAME_ASSET_PROBLEMS = ['PROBLEM_MONETIZE', 'PROBLEM_INCOME_STUCK']

const SCOPE_COMPATIBLE = 'COMPATIBLE'
const SCOPE_UNPROVEN = 'UNPROVEN'

const LINK_DIRECTION = 'LINK_DIRECTION'
const LINK_INCREMENTAL_INCOME = 'LINK_INCREMENTAL_INCOME'

/**
 * Deterministic NO_PRIMARY cross-axis scope.
 * @param {Object} p
 * @param {boolean} [p.marketValidated] asset axis paid flag (authority for proof)
 * @param {string} [p.primaryProblem] desiredChange.primaryProblem
 * @param {string} [p.primaryGoal] desiredChange.primaryGoal
 * @param {string} [p.occupation] reality.occupation
 * @param {string} [p.monetizableSkill] asset.type (raw option id)
 * @param {boolean} [p.assetNamed] asset is a concretely named capability
 * @param {string} [p.incomeStructure] reality.incomeStructure
 * @param {string} [p.pastAttemptStage] hybrid pastAttemptStage
 * @returns {'COMPATIBLE'|'UNPROVEN'}
 */
function evaluateNoPrimaryCrossAxisScope (p) {
  const params = p || {}

  // No market-validated asset -> there is nothing that could be mis-linked.
  // (The R51 proof-stage progression is the correct strategy here.)
  if (!params.marketValidated) return SCOPE_COMPATIBLE

  const problem = params.primaryProblem || null
  const goal = params.primaryGoal || null

  // The user is explicitly moving to a DIFFERENT objective -> the proven asset's
  // path is UNPROVEN, regardless of anything else.
  if (DIRECTION_SHIFT_PROBLEMS.indexOf(problem) !== -1) return SCOPE_UNPROVEN
  if (DIRECTION_SHIFT_GOALS.indexOf(goal) !== -1) return SCOPE_UNPROVEN

  // Only when the current problem is about monetizing the SAME captured asset,
  // AND that asset is concretely anchored (named + a real occupation), may the
  // link be treated as proven.
  const anchored = !!(params.occupation && params.assetNamed)
  if (SAME_ASSET_PROBLEMS.indexOf(problem) !== -1 && anchored) return SCOPE_COMPATIBLE

  // Everything else (unrelated problem, unnamed asset, missing anchor) -> fail closed.
  return SCOPE_UNPROVEN
}

/**
 * Which LINK uncertainty the UNPROVEN scope should test (R53 §8/§9).
 * @param {{primaryProblem?:string, primaryGoal?:string}} ev
 * @returns {'LINK_DIRECTION'|'LINK_INCREMENTAL_INCOME'}
 */
function noPrimaryLinkKind (ev) {
  const e = ev || {}
  if (DIRECTION_SHIFT_PROBLEMS.indexOf(e.primaryProblem) !== -1) return LINK_DIRECTION
  if (DIRECTION_SHIFT_GOALS.indexOf(e.primaryGoal) !== -1) return LINK_DIRECTION
  return LINK_INCREMENTAL_INCOME
}

module.exports = {
  evaluateNoPrimaryCrossAxisScope,
  noPrimaryLinkKind,
  DIRECTION_SHIFT_PROBLEMS,
  DIRECTION_SHIFT_GOALS,
  SAME_ASSET_PROBLEMS,
  SCOPE_COMPATIBLE,
  SCOPE_UNPROVEN,
  LINK_DIRECTION,
  LINK_INCREMENTAL_INCOME
}
