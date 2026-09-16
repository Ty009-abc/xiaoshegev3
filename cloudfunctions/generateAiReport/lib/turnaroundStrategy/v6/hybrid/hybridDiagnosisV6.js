'use strict'
/**
 * turnaroundStrategy/v6/hybrid/hybridDiagnosisV6.js
 *
 * RC8.4 V6 R44 — HYBRID diagnosis orchestration.
 *
 * Pipeline (R44 §22):
 *   validate Hybrid contract
 *     -> build HybridProfile
 *     -> adapt safe canonical B1 evidence (hybridB1AdapterV6)
 *     -> run V6 B1                          (SAME kernel sub-functions, unmodified)
 *     -> build asset/reality context        (hybridReportContextV6)
 *     -> V6 report                          (buildReportV6 + context)
 *
 * AUTHORITY: V6 B1 is the SOLE bottleneck-diagnosis authority. This file performs
 * NO diagnosis of its own — it calls the exact V6 kernel functions in the exact
 * V6 order. It never calls the V4 engine (V4_ENGINE_RUNTIME_CALL_COUNT = 0).
 *
 * EQUIVALENCE: for a fully-mappable submission this yields byte-identical V6
 * output to `diagnoseTurnaroundV6(v6RawAnswers)` (proven by the golden
 * differential test: B1_EQUIVALENT_INPUT_DIFF_COUNT = 0).
 *
 * REDUCED COVERAGE (no fabrication): an unmapped behavior option (e.g. the
 * hybrid All-in / avoid / add-money / unsure choices, which have NO genuinely
 * equivalent V6 semantic) contributes NO evidence. The relevant B1 gate then
 * fails legitimately -> the kernel's own fail-closed state (often NO_PRIMARY).
 * It is NEVER coerced into a valid semantic answer.
 *
 * Kernel only. No report prose. No AI. No I/O. No network.
 */

const { CONTRACT_VERSION } = require('../questionnaireContractV6.js')
const { EXECUTION_STAGE_COUNT } = require('../executionStageV6.js')
const { evaluateEligibility, PRIMARY_BOTTLENECKS } = require('../bottleneckEligibilityV6.js')
const { selectPrimary } = require('../bottleneckSelectorV6.js')
const { computeBeliefRelation } = require('../beliefRelationV6.js')
const { computeRealityConstraint } = require('../realityConstraintV6.js')
const { recommendNextStage } = require('../nextStageV6.js')
const { deriveActionType } = require('../actionTypeV6.js')
const { buildTrace } = require('../diagnosisTraceV6.js')

const { buildHybridProfileV6 } = require('./hybridProfileV6.js')
const { adaptHybridToV6 } = require('./hybridB1AdapterV6.js')
const { buildHybridReportContextV6 } = require('./hybridReportContextV6.js')

/**
 * Run the V6 kernel against an ALREADY-BUILT canonical profile. Mirrors
 * diagnoseTurnaroundV6's orchestration exactly (same calls, same order) so a
 * hybrid profile produces the same diagnosis a native V6 profile would.
 * @param {Object} profile canonical V6 profile (may carry null behavior slots)
 * @returns {Object} diagnosis (same schema as diagnoseTurnaroundV6)
 */
function diagnoseFromProfile (profile) {
  const candidates = evaluateEligibility(profile)
  const selection = selectPrimary(profile, candidates)
  const beliefRelation = computeBeliefRelation(profile)
  const realityConstraint = computeRealityConstraint(profile)
  const nextStage = recommendNextStage(profile.executionStage.currentStage, selection.primaryBottleneck)
  const action = deriveActionType(
    profile.executionStage.currentStage,
    selection.primaryBottleneck,
    realityConstraint
  )
  const trace = buildTrace({ profile, candidates, selection, beliefRelation, realityConstraint, action })
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
    diagnosisState: selection.diagnosisState,
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

/**
 * Full hybrid pipeline.
 * @param {Object} rawAnswers raw hybrid submission (10 screens / 18 fields)
 * @returns {{valid:boolean, hybridProfile:Object|null, diagnosis:Object,
 *   hybridContext:Object|null, mapped:Object, unmapped:Array}}
 */
function runHybridDiagnosisV6 (rawAnswers) {
  const hybridProfile = buildHybridProfileV6(rawAnswers)
  if (!hybridProfile) {
    return {
      valid: false,
      hybridProfile: null,
      hybridContext: null,
      mapped: {},
      unmapped: [],
      diagnosis: {
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
        inputErrors: { missing: [], malformed: ['HYBRID_CONTRACT_INVALID'], unresolved: [] },
        trace: null
      }
    }
  }

  const adapted = adaptHybridToV6(hybridProfile)
  const diagnosis = diagnoseFromProfile(adapted.profile)
  // R46 §6: the report context reads the diagnosis (bottleneck / action type) to
  // produce proof-aware wording; it NEVER changes those authority fields.
  const hybridContext = buildHybridReportContextV6(hybridProfile, diagnosis)

  return {
    valid: true,
    hybridProfile,
    hybridContext,
    mapped: adapted.mapped,
    unmapped: adapted.unmapped,
    diagnosis
  }
}

module.exports = {
  runHybridDiagnosisV6,
  diagnoseFromProfile,
  CONTRACT_VERSION,
  EXECUTION_STAGE_COUNT,
  PRIMARY_BOTTLENECKS
}
