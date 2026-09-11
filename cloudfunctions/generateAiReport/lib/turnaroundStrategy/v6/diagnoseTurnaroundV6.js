'use strict'
/**
 * turnaroundStrategy/v6/diagnoseTurnaroundV6.js
 *
 * V6 deterministic diagnosis kernel orchestrator.
 *
 * Pipeline:
 *   questionnaireContract -> profileBuilder -> executionStage
 *   -> bottleneckEligibility -> bottleneckSelector
 *   -> beliefRelation (indep) -> realityConstraint (indep)
 *   -> nextStage -> actionType -> trace
 *
 * DIAGNOSIS KERNEL ONLY. No report prose. No AI. No I/O. No network.
 */

const { CONTRACT_VERSION } = require('./questionnaireContractV6.js')
const { buildProfileV6 } = require('./profileBuilderV6.js')
const { EXECUTION_STAGE_COUNT } = require('./executionStageV6.js')
const { evaluateEligibility, PRIMARY_BOTTLENECKS } = require('./bottleneckEligibilityV6.js')
const { selectPrimary } = require('./bottleneckSelectorV6.js')
const { computeBeliefRelation } = require('./beliefRelationV6.js')
const { computeRealityConstraint } = require('./realityConstraintV6.js')
const { recommendNextStage } = require('./nextStageV6.js')
const { deriveActionType } = require('./actionTypeV6.js')
const { buildTrace } = require('./diagnosisTraceV6.js')

/**
 * @param {Object} rawAnswers 9Q answers (optionId or canonical text) + optional occupation
 * @returns {Object} canonical diagnosis output per contract §21
 */
function diagnoseTurnaroundV6 (rawAnswers) {
  const built = buildProfileV6(rawAnswers)

  // Questionnaire contract invalid -> explicit INVALID_INPUT (fail-closed).
  // This is deliberately DISTINCT from NO_PRIMARY: NO_PRIMARY is a valid
  // submission with no justified primary; INVALID_INPUT is a broken submission
  // (missing required Q1-Q9, unknown/unresolvable answer, or malformed
  // top-level representation). Downstream routing must never render a normal
  // report card for INVALID_INPUT.
  if (!built.valid) {
    return {
      contractVersion: CONTRACT_VERSION,
      schema: 'v6-diagnosis/1',
      profile: null,
      diagnosisState: 'INVALID_INPUT',
      primaryBottleneck: null,
      eligibleCandidates: [],
      beliefRelation: null,
      realityConstraint: null,
      executionStage: null,
      recommendedNextStage: null,
      firstActionType: null,
      inputErrors: {
        missing: built.missing,
        malformed: built.malformed,
        unresolved: built.unresolved
      },
      trace: null
    }
  }

  const profile = built.profile

  // STEP 1-2: eligibility
  const candidates = evaluateEligibility(profile)
  // STEP 3-5: selection
  const selection = selectPrimary(profile, candidates)

  // Independent modifiers
  const beliefRelation = computeBeliefRelation(profile)
  const realityConstraint = computeRealityConstraint(profile)

  const nextStage = recommendNextStage(profile.executionStage.currentStage, selection.primaryBottleneck)
  const action = deriveActionType(
    profile.executionStage.currentStage,
    selection.primaryBottleneck,
    realityConstraint
  )

  const trace = buildTrace({
    profile,
    candidates,
    selection,
    beliefRelation,
    realityConstraint,
    action
  })
  trace.sourceOptionIds = trace.sourceOptionIds
  trace.eligibleCandidateRules = candidates
    .filter(c => c.eligible)
    .map(c => ({ bottleneck: c.bottleneck, ruleId: c.ruleId }))

  return {
    contractVersion: CONTRACT_VERSION,
    schema: 'v6-diagnosis/1',
    profile: {
      reality: profile.reality,
      desiredChange: profile.desiredChange,
      userBelief: profile.userBelief,
      executionStage: profile.executionStage,
      behavior: profile.behavior
    },
    diagnosisState: selection.diagnosisState, // PRIMARY | NO_PRIMARY
    primaryBottleneck: selection.primaryBottleneck,
    eligibleCandidates: selection.eligibleCandidates,
    beliefRelation,
    realityConstraint,
    executionStage: profile.executionStage.currentStage,
    recommendedNextStage: nextStage.recommendedNextStage,
    firstActionType: action.firstActionType,
    inputErrors: { missing: [], malformed: [], unresolved: [] },
    trace
  }
}

module.exports = {
  diagnoseTurnaroundV6,
  CONTRACT_VERSION,
  EXECUTION_STAGE_COUNT,
  PRIMARY_BOTTLENECKS
}
