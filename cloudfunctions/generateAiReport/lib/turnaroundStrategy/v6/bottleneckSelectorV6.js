'use strict'
/**
 * turnaroundStrategy/v6/bottleneckSelectorV6.js
 *
 * Selection algorithm (frozen):
 *   STEP 1 eligibility (done upstream)
 *   STEP 2 collect eligible
 *   STEP 3 stage-aware priority ONLY among eligible
 *   STEP 4 evidence-strength tie-break
 *   STEP 5 NO_PRIMARY when evidence does not justify one
 *
 * ELIGIBILITY_FIRST = YES · PRIORITY_SECOND = YES · TIE_BREAK_THIRD = YES
 * STAGE_PRIORITY_FORCES_DIAGNOSIS = NO
 */

const { STAGE, Q6, OPT } = require('./bottleneckEligibilityV6.js')

// Frozen stage priority (higher index = higher precedence). Only among eligible.
const PRIORITY = {
  THINKING: ['DIRECTION_GAP', 'ACTION_GAP'],
  RESEARCHING: ['ACTION_GAP', 'DIRECTION_GAP'],
  LEARNING: ['ACTION_GAP', 'DIRECTION_GAP'],
  STARTED: ['CONSISTENCY_GAP', 'VALIDATION_GAP'],
  TESTING: ['VALIDATION_GAP', 'CONSISTENCY_GAP'],
  EARLY_TRACTION: ['REPEATABILITY_GAP', 'VALIDATION_GAP'],
  STABLE_TRACTION: ['REPEATABILITY_GAP']
}

/**
 * Evidence-strength score for tie-break (higher = stronger). Deterministic:
 *   A. direct execution-stage evidence (Q6 exact stage anchor)
 *   B. direct Q7/Q8/Q9 behavior evidence (count of ok direct evidence used)
 *   C. userBelief relation strength
 *   D. primaryProblem relevance
 * No alphabetical / id / random ordering.
 */
function evidenceStrength (candidate, profile) {
  const stage = profile.executionStage.currentStage
  const q6 = profile._optionIds.Q6
  const q5 = profile.userBelief.perceivedRootCause
  const q4 = profile.desiredChange.primaryProblem

  // A: direct stage anchor (Q6 exact) — always true for a REQUIRED-stage candidate
  const stageAnchor = candidate.requiredEvidence.some(
    e => e.questionId === 'Q6' && e.ok && String(e.value || '')
  )
  const A = stageAnchor ? 1 : 0

  // B: count of direct behavior evidence (Q7/Q8/Q9) satisfied among required+supporting
  const behaviorOk = candidate.requiredEvidence.concat(candidate.supportingEvidence)
    .filter(e => e.ok && ['Q7', 'Q8', 'Q9'].includes(e.questionId)).length
  const B = Math.min(behaviorOk, 3)

  // C: belief relation strength (hard gap = 2, partial = 1, match = 0)
  const C = 0 // computed by caller via beliefRelation; kept as explicit slot

  // D: primary-problem relevance
  const relevantProbs = {
    DIRECTION_GAP: [OPT.PROBLEM_NO_FUTURE, OPT.PROBLEM_CAREER_SWITCH, OPT.PROBLEM_MONETIZE],
    ACTION_GAP: [OPT.PROBLEM_INCOME_STUCK, OPT.PROBLEM_SIDE_UNSTARTED],
    CONSISTENCY_GAP: [OPT.PROBLEM_SIDE_UNSTARTED, OPT.PROBLEM_INCOME_STUCK],
    VALIDATION_GAP: [OPT.PROBLEM_MONETIZE, OPT.PROBLEM_SIDE_UNSTARTED],
    REPEATABILITY_GAP: [OPT.PROBLEM_INCOME_STUCK]
  }
  const D = (relevantProbs[candidate.bottleneck] || []).includes(q4) ? 1 : 0

  return { total: A * 8 + B * 2 + C + D, parts: { A, B, C, D } }
}

/**
 * @param {Object} profile canonical profile
 * @param {Array} candidates output of evaluateEligibility (all 5)
 * @returns {{primaryBottleneck:string|null, diagnosisState:string,
 *   eligibleCandidates:string[], selectionPriority:string[],
 *   tieBreakReason:string|null, selectedRuleId:string|null}}
 */
function selectPrimary (profile, candidates) {
  const eligible = candidates.filter(c => c.eligible)
  const eligibleNames = eligible.map(c => c.bottleneck)

  // STEP 5 (early): no eligible candidate -> NO_PRIMARY
  if (eligible.length === 0) {
    return {
      primaryBottleneck: null,
      diagnosisState: 'NO_PRIMARY',
      eligibleCandidates: [],
      selectionPriority: [],
      tieBreakReason: null,
      selectedRuleId: null
    }
  }

  if (eligible.length === 1) {
    return {
      primaryBottleneck: eligible[0].bottleneck,
      diagnosisState: 'PRIMARY',
      eligibleCandidates: eligibleNames,
      selectionPriority: [eligible[0].bottleneck],
      tieBreakReason: 'only eligible candidate',
      selectedRuleId: eligible[0].ruleId
    }
  }

  // STEP 3: stage priority among eligible
  const stage = profile.executionStage.currentStage
  const order = PRIORITY[stage] || []
  const ranked = eligible.slice().sort((a, b) => {
    const ia = order.indexOf(a.bottleneck)
    const ib = order.indexOf(b.bottleneck)
    const ra = ia === -1 ? Number.MAX_SAFE_INTEGER : ia
    const rb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib
    return ra - rb
  })

  const top = ranked[0]
  const second = ranked[1]
  const topRank = order.indexOf(top.bottleneck)
  const secondRank = order.indexOf(second.bottleneck)

  if (topRank !== -1 && secondRank !== -1 && topRank < secondRank) {
    return {
      primaryBottleneck: top.bottleneck,
      diagnosisState: 'PRIMARY',
      eligibleCandidates: eligibleNames,
      selectionPriority: ranked.map(c => c.bottleneck),
      tieBreakReason: 'stage priority among eligible',
      selectedRuleId: top.ruleId
    }
  }

  // STEP 4: evidence-strength tie-break
  const scored = ranked.map(c => ({ c, s: evidenceStrength(c, profile) }))
  scored.sort((a, b) => b.s.total - a.s.total)
  if (scored.length > 1 && scored[0].s.total > scored[1].s.total) {
    return {
      primaryBottleneck: scored[0].c.bottleneck,
      diagnosisState: 'PRIMARY',
      eligibleCandidates: eligibleNames,
      selectionPriority: ranked.map(c => c.bottleneck),
      tieBreakReason: 'evidence-strength tie-break',
      selectedRuleId: scored[0].c.ruleId
    }
  }

  // Unresolved equal candidates -> NO_PRIMARY (fail-closed)
  return {
    primaryBottleneck: null,
    diagnosisState: 'NO_PRIMARY',
    eligibleCandidates: eligibleNames,
    selectionPriority: ranked.map(c => c.bottleneck),
    tieBreakReason: 'unresolved equal candidates',
    selectedRuleId: null
  }
}

module.exports = { PRIORITY, evidenceStrength, selectPrimary }
