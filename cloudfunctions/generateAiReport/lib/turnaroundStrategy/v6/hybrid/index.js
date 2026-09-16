'use strict'
/**
 * turnaroundStrategy/v6/hybrid/index.js
 *
 * Public surface of the RC8.4 V6 R44 HYBRID 10-screen questionnaire runtime.
 *
 * Authority (frozen):
 *   - V6 B1 = SOLE bottleneck-diagnosis authority.
 *   - asset/reality layer = strategy specificity ONLY (zero bottleneck authority).
 *   - AI = zero diagnosis authority.
 *   - V4 engine = NEVER a runtime authority (V4_ENGINE_RUNTIME_CALL_COUNT = 0).
 */

const contract = require('./hybridContractV6.js')
const { buildHybridProfileV6 } = require('./hybridProfileV6.js')
const { computeAssetStateV6 } = require('./assetAxisV6.js')
const { adaptHybridToV6, B1_MAPPING_TABLE } = require('./hybridB1AdapterV6.js')
const { buildHybridReportContextV6 } = require('./hybridReportContextV6.js')
const { runHybridDiagnosisV6, diagnoseFromProfile } = require('./hybridDiagnosisV6.js')

module.exports = {
  hybridContractV6: contract,
  buildHybridProfileV6,
  computeAssetStateV6,
  adaptHybridToV6,
  B1_MAPPING_TABLE,
  buildHybridReportContextV6,
  runHybridDiagnosisV6,
  diagnoseFromProfile
}
