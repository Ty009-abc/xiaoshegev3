'use strict'
/**
 * turnaroundStrategy/v6/hybrid/hybridB1AdapterV6.js
 *
 * RC8.4 V6 R44 — EXPLICIT HybridProfile -> TurnaroundProfileV6 adapter.
 *
 * AUTHORITY: V6 B1 remains the SOLE bottleneck-diagnosis authority.
 * This adapter ONLY prepares canonical V6 semantic inputs. It never diagnoses,
 * never scores, never selects a bottleneck, never calls the V4 engine.
 *
 * Mapping table (frozen — every B1 field is documented):
 *
 *   TARGET_V6_FIELD                    SOURCE                     TYPE       CONFIDENCE
 *   userBelief.perceivedRootCause      selfBelief                 DIRECT     HIGH
 *   behavior.timeAllocation            timeBehavior               DIRECT     HIGH
 *   desiredChange.primaryProblem       primaryProblem             DIRECT     HIGH
 *   executionStage.currentStage        pastAttemptStage           NORMALIZED MEDIUM-HIGH
 *   behavior.uncertaintyResponse       decisionStyle              NORMALIZED MEDIUM
 *   behavior.noResultResponse          failureResponse            NORMALIZED MEDIUM
 *
 * NONE mappings (deliberately NOT mapped — meaning is not genuinely equivalent):
 *   occupation / monetizableSkill / skillValidation / incomeStructure (raw) /
 *   safetyMonths / debtPressure / weeklyTime / executionStability /
 *   maxTrialCost / lifeStage / primaryGoal  ->  (no B1 field)
 *
 * SEMANTICALLY_UNSAFE_MAPPING_COUNT = 0.
 *
 * Fail-closed: an option without a v6 equivalent is DROPPED, never coerced.
 * The user's downstream consequence is NO_PRIMARY (V6's own fail-closed state),
 * NEVER a fabricated primary.
 */

const C = require('./hybridContractV6.js')
const { mapExecutionStage } = require('../executionStageV6.js')

// Explicit mapping descriptors for the two NORMALIZED behavior fields.
// A source option maps ONLY when it is genuinely equivalent to the V6 semantic.
// `null` = deliberately unmapped (not equivalent) -> drop.
const DECISION_STYLE_TO_V6 = {
  DECISION_ALL_IN: null, // V6 Q7 has no all-in semantic — NOT equivalent
  DECISION_SMALL_TEST: 'UNCERT_SMALL_TEST',
  DECISION_LEARN_FIRST: 'UNCERT_ANALYZE',
  DECISION_WAIT_OTHERS: 'UNCERT_WAIT',
  DECISION_AVOID: null // V6 Q7 has no avoid-everything semantic — NOT equivalent
}

const FAILURE_RESPONSE_TO_V6 = {
  // R86-C — the EVIDENCE scenario now lives on this slot (visible text reframed).
  EVID_PRAISE: null, // no "pride/praise" semantic in V6 Q9 — NOT equivalent
  EVID_REPEATABLE: 'NORESULT_RECHECK', // "是否可重复" ≡ 复盘后再试
  EVID_LUCK: null, // no "luck" semantic — NOT equivalent
  EVID_UNREFLECTIVE: 'NORESULT_SWITCH', // 不复盘、直接换下一件 ≡ 换方向
  // LEGACY ids (historical submissions only; never rendered by the R86-C client).
  FAIL_GIVE_UP: 'NORESULT_STOP',
  FAIL_SWITCH: 'NORESULT_SWITCH',
  FAIL_RECHECK: 'NORESULT_RECHECK',
  FAIL_ADD_MONEY: null, // V6 Q9 has no add-money semantic — NOT equivalent
  FAIL_UNSURE: null // V6 Q9 has no unsure semantic — NOT equivalent
}

// Explicit mapping descriptors for executionStage (NORMALIZED).
// The hybrid ladder is a coarser 6-band scale; each band maps to the V6 stage
// whose DEFINITION it genuinely matches. No marketProof-based upgrade.
const PAST_ATTEMPT_TO_STAGE = {
  ATTEMPT_NONE: 'STAGE_THINKING',
  ATTEMPT_COURSE_ONLY: 'STAGE_LEARNING',
  ATTEMPT_UNDER_30D: 'STAGE_STARTED',
  ATTEMPT_NO_SALE: 'STAGE_TESTING',
  ATTEMPT_FEW_SALES: 'STAGE_EARLY_TRACTION',
  ATTEMPT_STABLE_SIDE: 'STAGE_STABLE_TRACTION'
}

function mapOrNull (table, value) {
  if (typeof value !== 'string') return null
  return Object.prototype.hasOwnProperty.call(table, value) ? table[value] : null
}

/**
 * @param {Object} hybrid HybridProfile (from buildHybridProfileV6)
 * @returns {{profile:Object|null, mapped:Object, unmapped:string[]}}
 *   profile = canonical V6 profile-shaped object for profileBuilderV6 /
 *   diagnoseTurnaroundV6 consumption (or null when any REQUIRED B1 semantic is
 *   unavailable — fail-closed to NO_PRIMARY, never a fabricated primary).
 */
function adaptHybridToV6 (hybrid) {
  if (!hybrid) return { profile: null, mapped: {}, unmapped: [], reason: 'NO_HYBRID_PROFILE' }

  const mapped = {}
  const unmapped = []

  // DIRECT: canonical semantics reused verbatim (HIGH confidence).
  const selfBelief = hybrid.belief && hybrid.belief.perceivedRootCause
  const timeBehavior = hybrid.behavior && hybrid.behavior.timeAllocation
  const primaryProblem = hybrid.desiredChange && hybrid.desiredChange.primaryProblem

  if (selfBelief) mapped.perceivedRootCause = selfBelief
  else unmapped.push('selfBelief')

  if (timeBehavior) mapped.timeAllocation = timeBehavior
  else unmapped.push('timeBehavior')

  if (primaryProblem) mapped.primaryProblem = primaryProblem
  else unmapped.push('primaryProblem')

  // NORMALIZED: only where semantically equivalent (else dropped).
  // The hybrid attempt ladder yields a canonical Q6 optionId; it MUST be run
  // through the frozen 1:1 executionStage mapper so `currentStage` is the STAGE
  // enum ('TESTING') that B1 gates compare — never the raw optionId.
  const stageOptionId = mapOrNull(PAST_ATTEMPT_TO_STAGE, hybrid.stage && hybrid.stage.pastAttemptStage)
  const stageInfo = stageOptionId ? mapExecutionStage(stageOptionId) : { stage: null, optionId: null }
  if (stageInfo.stage) mapped.executionStage = stageInfo.stage
  else unmapped.push('pastAttemptStage')

  const uncert = mapOrNull(DECISION_STYLE_TO_V6, hybrid.behavior && hybrid.behavior.decisionStyle)
  if (uncert) mapped.uncertaintyResponse = uncert
  else unmapped.push('decisionStyle')

  const noResult = mapOrNull(FAILURE_RESPONSE_TO_V6, hybrid.behavior && hybrid.behavior.noResultResponse)
  if (noResult) mapped.noResultResponse = noResult
  else unmapped.push('failureResponse')

  // Fail-closed: B1 needs ALL of Q4/Q5/Q6/Q7/Q8/Q9 as canonical semantics.
  // If any is missing (unmapped source), we do NOT invent one. Instead we still
  // hand V6 a profile that will legitimately evaluate to NO_PRIMARY.
  const profile = {
    reality: {
      ageStage: hybrid.reality.lifeStage ? C.canonicalFor('lifeStage', hybrid.reality.lifeStage) : null,
      incomeMode: hybrid.reality.incomeModeCanonical,
      monthlySurplus: hybrid.reality.surplusCanonical,
      occupation: hybrid.reality.occupation
    },
    desiredChange: { primaryProblem: mapped.primaryProblem || null },
    userBelief: { perceivedRootCause: mapped.perceivedRootCause || null },
    executionStage: { currentStage: mapped.executionStage || null },    behavior: {
      uncertaintyResponse: mapped.uncertaintyResponse || null,
      timeAllocation: mapped.timeAllocation || null,
      noResultResponse: mapped.noResultResponse || null
    },
    // internal optionId lookup (V6 rules read this)
    _optionIds: {
      Q1: hybrid.reality.lifeStage ? C.canonicalFor('lifeStage', hybrid.reality.lifeStage) : null,
      Q2: hybrid.reality.incomeModeCanonical,
      Q3: hybrid.reality.surplusCanonical,
      Q4: mapped.primaryProblem || null,
      Q5: mapped.perceivedRootCause || null,
      Q6: stageInfo.optionId,
      Q7: mapped.uncertaintyResponse || null,
      Q8: mapped.timeAllocation || null,
      Q9: mapped.noResultResponse || null
    }
  }

  return { profile, mapped, unmapped, reason: null }
}

/**
 * The frozen mapping table (for audit/reporting). One row per B1 field.
 */
const B1_MAPPING_TABLE = [
  { target: 'userBelief.perceivedRootCause', source: 'selfBelief', type: 'DIRECT', confidence: 'HIGH' },
  { target: 'behavior.timeAllocation', source: 'timeBehavior', type: 'DIRECT', confidence: 'HIGH' },
  { target: 'desiredChange.primaryProblem', source: 'primaryProblem', type: 'DIRECT', confidence: 'HIGH' },
  { target: 'executionStage.currentStage', source: 'pastAttemptStage', type: 'NORMALIZED', confidence: 'MEDIUM' },
  { target: 'behavior.uncertaintyResponse', source: 'decisionStyle', type: 'NORMALIZED', confidence: 'MEDIUM' },
  { target: 'behavior.noResultResponse', source: 'failureResponse', type: 'NORMALIZED', confidence: 'MEDIUM' },
  { target: '(no B1 field)', source: 'lifeStage', type: 'NONE', confidence: 'NONE' },
  { target: '(no B1 field)', source: 'incomeStructure', type: 'NONE', confidence: 'NONE' },
  { target: '(no B1 field)', source: 'occupationDetail', type: 'NONE', confidence: 'NONE' },
  { target: '(no B1 field)', source: 'safetyMonths', type: 'NONE', confidence: 'NONE' },
  { target: '(no B1 field)', source: 'debtPressure', type: 'NONE', confidence: 'NONE' },
  { target: '(no B1 field)', source: 'skillValidation', type: 'NONE', confidence: 'NONE' },
  { target: '(no B1 field)', source: 'monetizableSkill', type: 'NONE', confidence: 'NONE' },
  { target: '(no B1 field)', source: 'weeklyTime', type: 'NONE', confidence: 'NONE' },
  { target: '(no B1 field)', source: 'executionStability', type: 'NONE', confidence: 'NONE' },
  { target: '(no B1 field)', source: 'maxTrialCost', type: 'NONE', confidence: 'NONE' },
  { target: '(no B1 field)', source: 'primaryGoal', type: 'NONE', confidence: 'NONE' }
]

module.exports = {
  adaptHybridToV6,
  DECISION_STYLE_TO_V6,
  FAILURE_RESPONSE_TO_V6,
  PAST_ATTEMPT_TO_STAGE,
  B1_MAPPING_TABLE
}
