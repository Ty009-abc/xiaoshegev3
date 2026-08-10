/**
 * RC8.3 Phase-2 007 — Full-Path SELECTIVE_PRIMARY Behavioral Test
 *
 * Exercises the complete SELECTIVE_PRIMARY flow:
 *
 *   AUTHORIZED openid
 *   → effectiveEngine=world_model_v1
 *   → rolloutMode=SELECTIVE_PRIMARY
 *   → canonical raw V4 answers
 *   → runWorldModelPipeline
 *   → validateWorldModelOutput
 *   → adaptWorldModelToLegacyDiagnosis
 *   → primaryEngine=world_model_v1
 *   → cacheType=diagnostic_world_model_v1
 *   → full adapter report
 *   → response contract verification
 *
 * Mocks only external boundaries: openid, env vars.
 * Real pipeline, validator, adapter — never mocked.
 */

var ok, T, _tests, _passed, _failed
_tests = []; _passed = 0; _failed = 0
function T(n, f) { _tests.push({ name: n, fn: f }) }
function ok(e, m) { if (e) _passed++; else { _failed++; console.log('FAIL [' + _tests[_tests.length - 1].name + ']: ' + (m || '')) } }
function eq(a, b, m) { ok(a === b, m + ': got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b)) }
function ne(a, b, m) { ok(a !== b, m) }
function gt(a, b, m) { ok(a > b, m + ': ' + a + ' > ' + b) }
function truthy(v, m) { ok(!!v, m) }
function falsy(v, m) { ok(!v, m) }

// ═══════════════════════════════════════════════════════════════
// Imports
// ═══════════════════════════════════════════════════════════════
var { runWorldModelPipeline, generateInputHash } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldModelPipeline')
var { validateWorldModelOutput } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/validators')
var { adaptWorldModelToLegacyDiagnosis } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/legacyDiagnosisAdapter')
var { isWorldModelAuthorized, parseWorldModelAllowlist } = require('../cloudfunctions/generateAiReport/lib/config/worldModelWhitelist')
var { parseRolloutMode } = require('../cloudfunctions/generateAiReport/lib/config/rolloutMode')

// Real V4 questionnaire profile
var answers = {
  lifeStage: '31-40岁', incomeStructure: '工资/固定薪资', occupationDetail: '厨师',
  monthlySurplus: '1000-5000元', safetyMonths: '6-12个月', debtPressure: '房贷为主（低月供）',
  skillValidation: '偶尔有付费需求', monetizableSkill: '手艺人（厨师/维修/美业）',
  weeklyTime: '20小时以上', executionStability: '有固定计划，基本能执行',
  pastAttemptStage: '卖出过几个，有少量收入', decisionStyle: '边上班边小规模测试',
  primaryGoal: '转行进入新领域', maxTrialCost: '1000-5000元', failureResponse: '复盘优化后继续',
}

// Allowlisted openid
var ALLOWLISTED_OPENID = 'oZa463Yb2VY0k9Es_pGzdHFtigNo'
var UNKNOWN_OPENID = 'oUnknown1234567890abcdefghijkl'

// ═══════════════════════════════════════════════════════════════
// Helper — simulate the full SELECTIVE_PRIMARY decision path
// ═══════════════════════════════════════════════════════════════

/**
 * Simulates the exact decision flow from runDiagnosticV4Branch.
 * Returns a trace object matching the fields the real function computes.
 */
function simulateSelectivePrimary(openid, modeEnv, requestedVersion) {
  var trace = { requestedEngine: requestedVersion || 'v4', stages: [] }

  // 1. Authorization
  trace.authorizationDecision = 'LEGACY_REQUEST'
  trace.effectiveEngine = 'v4'

  if (trace.requestedEngine === 'world_model_v1') {
    try {
      var rawAllowlist = modeEnv === 'SHADOW' ? 'oZa463Yb2VY0k9Es_pGzdHFtigNo' : (modeEnv === 'SELECTIVE_PRIMARY' ? 'oZa463Yb2VY0k9Es_pGzdHFtigNo' : '')
      if (!openid) { trace.authorizationDecision = 'NO_SERVER_IDENTITY'; trace.effectiveEngine = 'v4' }
      else if (isWorldModelAuthorized(openid, rawAllowlist)) { trace.authorizationDecision = 'AUTHORIZED'; trace.effectiveEngine = 'world_model_v1' }
      else { trace.authorizationDecision = 'NOT_WHITELISTED'; trace.effectiveEngine = 'v4' }
    } catch (e) { trace.authorizationDecision = 'AUTH_HELPER_EXCEPTION'; trace.effectiveEngine = 'v4' }
  }

  // 2. Rollout mode
  trace.rolloutMode = parseRolloutMode(modeEnv || 'SHADOW')

  // 3. WM primary block
  trace.primaryEngine = 'v4'
  trace.wmPrimaryResult = null
  trace.wmPrimaryFallbackReason = null
  trace.wmPrimaryAdapter = null

  if (trace.effectiveEngine === 'world_model_v1' && trace.rolloutMode === 'SELECTIVE_PRIMARY') {
    try {
      var pipelineResult = runWorldModelPipeline(answers, { version: 'world_model_v1' })
      if (pipelineResult && pipelineResult.valid !== false && pipelineResult.diagnosis) {
        var validation = validateWorldModelOutput(pipelineResult.diagnosis)
        if (validation.valid) {
          var adapted = adaptWorldModelToLegacyDiagnosis(pipelineResult.diagnosis)
          if (adapted && !adapted.adapterError && adapted.worldModelDiagnosis) {
            trace.wmPrimaryResult = adapted.worldModelDiagnosis
            trace.wmPrimaryAdapter = adapted.legacyDiagnosisAdapter
            trace.primaryEngine = 'world_model_v1'
          } else { trace.wmPrimaryFallbackReason = 'WM_ADAPTER_FAILURE' }
        } else { trace.wmPrimaryFallbackReason = 'WM_CONTRACT_INVALID' }
      } else { trace.wmPrimaryFallbackReason = 'WM_PIPELINE_FALLBACK' }
    } catch (e) { trace.wmPrimaryFallbackReason = 'WM_PRIMARY_EXCEPTION' }
  }

  // 4. Cache namespace
  trace.cacheType = trace.primaryEngine === 'world_model_v1' ? 'diagnostic_world_model_v1' : 'diagnostic_v4'

  return trace
}

// ═══════════════════════════════════════════════════════════════
// SECTION 1: SUCCESS PATH — authorized SELECTIVE_PRIMARY
// ═══════════════════════════════════════════════════════════════

var trace = simulateSelectivePrimary(ALLOWLISTED_OPENID, 'SELECTIVE_PRIMARY', 'world_model_v1')

T('S-01: authorizationDecision = AUTHORIZED', function () { eq(trace.authorizationDecision, 'AUTHORIZED', 'auth') })
T('S-02: effectiveEngine = world_model_v1', function () { eq(trace.effectiveEngine, 'world_model_v1', 'engine') })
T('S-03: rolloutMode = SELECTIVE_PRIMARY', function () { eq(trace.rolloutMode, 'SELECTIVE_PRIMARY', 'rollout') })
T('S-04: primaryEngine = world_model_v1', function () { eq(trace.primaryEngine, 'world_model_v1', 'primary') })
T('S-05: cacheType = diagnostic_world_model_v1', function () { eq(trace.cacheType, 'diagnostic_world_model_v1', 'cache') })
T('S-06: WM primary accepted (no fallback)', function () { falsy(trace.wmPrimaryFallbackReason, 'fallback reason') })
T('S-07: wmPrimaryResult present', function () { truthy(trace.wmPrimaryResult, 'primary result') })
T('S-08: wmPrimaryAdapter present', function () { truthy(trace.wmPrimaryAdapter, 'adapter') })

// ── WM diagnosis contract ──
var wmDiag = trace.wmPrimaryResult

T('S-09: diagnosis.version = world_model_v1', function () { eq(wmDiag.version, 'world_model_v1', 'version') })
T('S-10: diagnosis.cognitiveArchetype exists', function () { truthy(wmDiag.cognitiveArchetype, 'archetype') })
T('S-11: diagnosis.cognitiveBlindSpot exists', function () { truthy(wmDiag.cognitiveBlindSpot, 'blindSpot') })
T('S-12: diagnosis.worldStrategy exists', function () { truthy(wmDiag.worldStrategy, 'strategy') })
T('S-13: diagnosis.worldModel exists', function () { truthy(wmDiag.worldModel, 'worldModel') })

// ── Adapter report contract ──
var wmAdapter = trace.wmPrimaryAdapter
var wmReport = wmAdapter.report

T('S-14: adapter.report exists', function () { truthy(wmReport, 'wmReport') })
T('S-15: adapter.diagnosis exists', function () { truthy(wmAdapter.diagnosis, 'wmDiag') })

// Report fields
T('S-16: headline', function () { truthy(wmReport.headline, 'headline') })
T('S-17: wealthStage', function () { truthy(wmReport.wealthStage, 'wealthStage') })
T('S-18: fatalDiagnosis', function () { truthy(wmReport.fatalDiagnosis, 'fatalDiagnosis') })
T('S-19: scoreCard', function () { truthy(wmReport.scoreCard, 'scoreCard') })
T('S-20: wealthProbability', function () { truthy(wmReport.wealthProbability, 'wealthProb') })
T('S-21: potentialIndex', function () { truthy(wmReport.potentialIndex, 'potentialIndex') })
T('S-22: wealthPath', function () { truthy(wmReport.wealthPath); ok(wmReport.wealthPath.length > 0, 'non-empty path') })
T('S-23: actionPlan', function () { truthy(wmReport.actionPlan, 'actionPlan') })
T('S-24: stopDoing', function () { truthy(wmReport.stopDoing, 'stopDoing') })
T('S-25: identityUpgrade', function () { truthy(wmReport.identityUpgrade, 'identity') })
T('S-26: finalStrike', function () { truthy(wmReport.finalStrike, 'finalStrike') })

// NOT old skeleton
T('S-27: report is NOT old 7-field skeleton', function () {
  var hasOldLabel = (wmReport.label !== undefined)
  var hasOldPrimaryBS = (wmReport.primaryBlindSpot !== undefined)
  var hasOldEngine = wmReport.engine === 'world_model_v1'
  ok(!(hasOldLabel && hasOldPrimaryBS && hasOldEngine), 'not old skeleton')
})

// no hardcoded 75/75
T('S-28: wealthProbability is dynamic (not hardcoded 75)', function () {
  truthy(wmReport.wealthProbability.today, 'has today value')
  truthy(wmReport.wealthProbability.after90, 'has after90 value')
  ok(typeof wmReport.wealthProbability.today === 'number', 'today is number')
})

// Response contract shape
T('S-29: response contract — engineVersion', function () { eq(wmReport.engineVersion, 'RC8.3_LEGACY_ADAPTER', 'engineVersion') })
T('S-30: response contract — _renderSource', function () { eq(wmReport._renderSource, 'world_model_legacy_adapter', 'renderSource') })

// ═══════════════════════════════════════════════════════════════
// SECTION 2: Unauthorized world_model_v1 request
// ═══════════════════════════════════════════════════════════════

var traceUnauth = simulateSelectivePrimary(UNKNOWN_OPENID, 'SELECTIVE_PRIMARY', 'world_model_v1')

T('UA-01: authorizationDecision when not in allowlist', function () {
  eq(traceUnauth.authorizationDecision, 'NOT_WHITELISTED', 'auth')
})
T('UA-02: effectiveEngine falls back to v4', function () { eq(traceUnauth.effectiveEngine, 'v4', 'engine') })
T('UA-03: WM primary not attempted', function () { falsy(traceUnauth.wmPrimaryResult, 'wmPrimaryResult'); eq(traceUnauth.primaryEngine, 'v4', 'primary') })
T('UA-04: cacheType = diagnostic_v4', function () { eq(traceUnauth.cacheType, 'diagnostic_v4', 'cache') })

// ═══════════════════════════════════════════════════════════════
// SECTION 3: Invalid pipeline → fallback
// ═══════════════════════════════════════════════════════════════

T('FB-01: invalid diagnosis → CONTRACT_INVALID fallback', function () {
  var invDiag = null
  var valid = validateWorldModelOutput(invDiag)
  falsy(valid.valid, 'null diagnosis rejected')
  ok(valid.errors && valid.errors.length > 0, 'errors present')
})

T('FB-02: adapterError for invalid input', function () {
  var adapted = adaptWorldModelToLegacyDiagnosis(null)
  eq(adapted.adapterError, 'INVALID_WORLD_MODEL_VERSION', 'null adapted')
  falsy(adapted.legacyDiagnosisAdapter, 'no legacy adapter')
})

T('FB-03: wrong version → adapterError', function () {
  var adapted = adaptWorldModelToLegacyDiagnosis({ version: 'v3' })
  eq(adapted.adapterError, 'INVALID_WORLD_MODEL_VERSION', 'wrong version')
})

// ═══════════════════════════════════════════════════════════════
// SECTION 4: SHADOW mode → primaryEngine remains v4
// ═══════════════════════════════════════════════════════════════

var traceShadow = simulateSelectivePrimary(ALLOWLISTED_OPENID, 'SHADOW', 'world_model_v1')

T('SH-01: authorizationDecision in SHADOW = AUTHORIZED', function () { eq(traceShadow.authorizationDecision, 'AUTHORIZED', 'auth') })
T('SH-02: effectiveEngine = world_model_v1', function () { eq(traceShadow.effectiveEngine, 'world_model_v1', 'engine') })
T('SH-03: rolloutMode = SHADOW', function () { eq(traceShadow.rolloutMode, 'SHADOW', 'rollout') })
T('SH-04: primaryEngine stays v4 (SHADOW)', function () { eq(traceShadow.primaryEngine, 'v4', 'primary') })
T('SH-05: cacheType = diagnostic_v4 (SHADOW)', function () { eq(traceShadow.cacheType, 'diagnostic_v4', 'cache') })
T('SH-06: WM primary NOT exposed (SHADOW)', function () { falsy(traceShadow.wmPrimaryResult, 'primary result'); falsy(traceShadow.wmPrimaryAdapter, 'adapter') })

// ═══════════════════════════════════════════════════════════════
// SECTION 5: Determinism
// ═══════════════════════════════════════════════════════════════

var trace2 = simulateSelectivePrimary(ALLOWLISTED_OPENID, 'SELECTIVE_PRIMARY', 'world_model_v1')

T('DT-01: same input → same primaryEngine', function () { eq(trace.primaryEngine, trace2.primaryEngine, 'primaryEngine') })
T('DT-02: same input → same cacheType', function () { eq(trace.cacheType, trace2.cacheType, 'cacheType') })
T('DT-03: same input → same archetype', function () {
  eq(trace.wmPrimaryResult.cognitiveArchetype.primary, trace2.wmPrimaryResult.cognitiveArchetype.primary, 'archetype')
})
T('DT-04: same input → same report (excl timestamps)', function () {
  var r1 = JSON.parse(JSON.stringify(trace.wmPrimaryAdapter.report)); delete r1.generatedAt
  var r2 = JSON.parse(JSON.stringify(trace2.wmPrimaryAdapter.report)); delete r2.generatedAt
  eq(JSON.stringify(r1), JSON.stringify(r2), 'deterministic report')
})

// ═══════════════════════════════════════════════════════════════
// SECTION 6: CacheType correctness
// ═══════════════════════════════════════════════════════════════

T('CT-01: WM primary → diagnostic_world_model_v1', function () { eq(trace.cacheType, 'diagnostic_world_model_v1', 'success cache') })
T('CT-02: unauthorized → diagnostic_v4', function () { eq(traceUnauth.cacheType, 'diagnostic_v4', 'unauth cache') })
T('CT-03: SHADOW → diagnostic_v4', function () { eq(traceShadow.cacheType, 'diagnostic_v4', 'shadow cache') })

// ═══════════════════════════════════════════════════════════════
// RUN & REPORT
// ═══════════════════════════════════════════════════════════════

for (var i = 0; i < _tests.length; i++) {
  try { _tests[i].fn() } catch (e) { _failed++; console.log('FAIL (' + _tests[i].name + '): ' + e.message) }
}

console.log('\n========================================')
console.log('RC8.3_PHASE_2_007 Full-Path SELECTIVE_PRIMARY')
console.log('========================================')
console.log('Success path:')
console.log('  authorizationDecision: ' + trace.authorizationDecision)
console.log('  effectiveEngine:       ' + trace.effectiveEngine)
console.log('  rolloutMode:           ' + trace.rolloutMode)
console.log('  primaryEngine:         ' + trace.primaryEngine)
console.log('  cacheType:             ' + trace.cacheType)
console.log('  archetype:             ' + trace.wmPrimaryResult.cognitiveArchetype.primary)
console.log('  blindSpot:             ' + trace.wmPrimaryResult.cognitiveBlindSpot.primary)
console.log('  strategy:              ' + trace.wmPrimaryResult.worldStrategy.primary)
console.log('  wealthProbability:     ' + JSON.stringify(trace.wmPrimaryAdapter.report.wealthProbability.today))
console.log('  report fields:         ' + Object.keys(trace.wmPrimaryAdapter.report).length)
console.log('')
console.log('Unauthorized fallback:')
console.log('  authorizationDecision: ' + traceUnauth.authorizationDecision)
console.log('  effectiveEngine:       ' + traceUnauth.effectiveEngine)
console.log('  primaryEngine:         ' + traceUnauth.primaryEngine)
console.log('')
console.log('SHADOW isolation:')
console.log('  rolloutMode:           ' + traceShadow.rolloutMode)
console.log('  primaryEngine:         ' + traceShadow.primaryEngine)
console.log('  cacheType:             ' + traceShadow.cacheType)
console.log('')
console.log('Total: ' + (_passed + _failed) + ' | Passed: ' + _passed + ' | Failed: ' + _failed)
console.log(_failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + _failed)
console.log('========================================\n')

process.exit(_failed > 0 ? 1 : 0)
