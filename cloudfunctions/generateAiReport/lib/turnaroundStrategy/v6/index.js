'use strict'
/**
 * turnaroundStrategy/v6/index.js
 *
 * Public surface of the V6 diagnosis runtime kernel.
 * Not wired into generateAiReport/index.js. Design → kernel only.
 */

const questionnaireContractV6 = require('./questionnaireContractV6.js')
const profileBuilderV6 = require('./profileBuilderV6.js')
const executionStageV6 = require('./executionStageV6.js')
const bottleneckEligibilityV6 = require('./bottleneckEligibilityV6.js')
const bottleneckSelectorV6 = require('./bottleneckSelectorV6.js')
const beliefRelationV6 = require('./beliefRelationV6.js')
const realityConstraintV6 = require('./realityConstraintV6.js')
const nextStageV6 = require('./nextStageV6.js')
const actionTypeV6 = require('./actionTypeV6.js')
const diagnosisTraceV6 = require('./diagnosisTraceV6.js')
const { diagnoseTurnaroundV6, CONTRACT_VERSION, EXECUTION_STAGE_COUNT, PRIMARY_BOTTLENECKS } =
  require('./diagnoseTurnaroundV6.js')

module.exports = {
  diagnoseTurnaroundV6,
  CONTRACT_VERSION,
  EXECUTION_STAGE_COUNT,
  PRIMARY_BOTTLENECKS,
  questionnaireContractV6,
  profileBuilderV6,
  executionStageV6,
  bottleneckEligibilityV6,
  bottleneckSelectorV6,
  beliefRelationV6,
  realityConstraintV6,
  nextStageV6,
  actionTypeV6,
  diagnosisTraceV6
}
