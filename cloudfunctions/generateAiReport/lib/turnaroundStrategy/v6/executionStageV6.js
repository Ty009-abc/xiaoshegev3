'use strict'
/**
 * turnaroundStrategy/v6/executionStageV6.js
 *
 * Frozen 1:1 execution-stage mapping (Q6 optionId -> stage).
 * EXECUTION_STAGE_COUNT = 7. No inferred stage beyond Q6 in V6.0.
 */

const { resolveOption } = require('./questionnaireContractV6.js')

const STAGE_BY_OPTION = {
  STAGE_THINKING: 'THINKING',
  STAGE_RESEARCHING: 'RESEARCHING',
  STAGE_LEARNING: 'LEARNING',
  STAGE_STARTED: 'STARTED',
  STAGE_TESTING: 'TESTING',
  STAGE_EARLY_TRACTION: 'EARLY_TRACTION',
  STAGE_STABLE_TRACTION: 'STABLE_TRACTION'
}

const EXECUTION_STAGES = Object.values(STAGE_BY_OPTION)
const EXECUTION_STAGE_COUNT = EXECUTION_STAGES.length // 7

/**
 * @param {string} q6Value semantic optionId or canonical text
 * @returns {{stage:string|null, optionId:string|null, sourceQuestionId:string|null}}
 */
function mapExecutionStage (q6Value) {
  const optionId = resolveOption('Q6', q6Value)
  const stage = optionId ? (STAGE_BY_OPTION[optionId] || null) : null
  return {
    stage,
    optionId: optionId || null,
    sourceQuestionId: optionId ? 'Q6' : null
  }
}

module.exports = {
  STAGE_BY_OPTION,
  EXECUTION_STAGES,
  EXECUTION_STAGE_COUNT,
  mapExecutionStage
}
