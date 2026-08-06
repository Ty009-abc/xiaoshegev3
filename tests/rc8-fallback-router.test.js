/**
 * tests/rc8-fallback-router.test.js
 * RC8.2: Fallback Router unification — verify legacy NEVER invoked when diagnosis exists
 */
var router = require('../cloudfunctions/generateAiReport/lib/v4/fallbackRouter')
var safety = require('../cloudfunctions/generateAiReport/lib/config/contentSafetyGate')

var diagnosis = {
  engineVersion: 'RC8.2',
  behaviorTags: [
    { id: 'T1', label: '获客不稳定', weight: 0.85, category: 'TRAFFIC', signal: 'NEGATIVE' },
    { id: 'T2', label: '技能已成交', weight: 0.7, category: 'SKILL', signal: 'POSITIVE' },
  ],
  wealthProfile: { primary: 'OPERATOR', primaryTitle: '手艺人', primaryTraits: ['已验证技能'], primaryTagline: 'test', confidence: 0.7, secondary: 'CREATOR' },
  bottleneck: { id: 'TRAFFIC', label: '获客缺失', confidence: 0.78, description: '技能已验证且能小额成交，但缺乏持续获客渠道' },
  strategy: { id: 'BUILD_PRODUCT', strategyLabel: '产品化', strategyTagline: '建立持续获客能力', day1Mission: '整理服务套餐并报价', milestones: ['整理', '定价', '推广'], confidence: 0.65, alternatives: [] },
  rInc001Status: 'BACKGROUND_ONLY',
}

var passed = 0
var failed = 0

function assert(label, condition) {
  if (condition) { passed++; console.log('  ✓ ' + label) }
  else { failed++; console.log('  ✗ ' + label) }
}

function assertEq(label, actual, expected) {
  if (actual === expected) { passed++; console.log('  ✓ ' + label) }
  else { failed++; console.log('  ✗ ' + label + ' | expected=' + expected + ' actual=' + actual) }
}

// ===== T1-T7: Diagnosis exists → SAFE_MINIMAL for ALL failure types =====
var failureTypes = [
  { name: 'JSON_PARSE_FAILED', stage: 'STEP_7_PARSE_AI', reasonCode: 'V4_AI_JSON_PARSE_FAILED', reason: 'Could not extract JSON' },
  { name: 'CONTENT_VALIDATION', stage: 'STEP_9_5_CONTENT_SAFETY', reasonCode: 'CONTENT_SAFETY_VIOLATION', reason: 'Content violations', guardErrors: ['err1'] },
  { name: 'AI_TIMEOUT', stage: 'STEP_6_CALL_AI', reasonCode: 'AI_CALL_EXCEPTION', reason: 'Request timeout' },
  { name: 'AI_EMPTY', stage: 'STEP_6_CALL_AI', reasonCode: 'AI_CALL_NON_SUCCESS', reason: 'AI empty' },
  { name: 'MERGE_FAILED', stage: 'STEP_8_MERGE', reasonCode: 'REPORT_MERGE_VIOLATION', reason: 'Merge fail', guardErrors: ['err'] },
  { name: 'REPORT_GUARD_FAILED', stage: 'STEP_9_GUARD', reasonCode: 'REPORT_CONTRACT_FAILED', reason: 'Guard fail', guardErrors: ['err'] },
  { name: 'UNKNOWN_EXCEPTION', stage: 'UNKNOWN', reasonCode: 'UNKNOWN_ERROR', reason: 'Something went wrong' },
]

failureTypes.forEach(function(ft) {
  console.log('=== ' + ft.name + ' | ' + ft.reasonCode + ' ===')

  var result = router.routeFinalFallback({
    diagnosis: diagnosis,
    baseContract: null,
    stages: [],
    stage: ft.stage,
    reasonCode: ft.reasonCode,
    reason: ft.reason,
    guardErrors: ft.guardErrors || [],
  })

  var trace = result.data.fallbackRouterTrace

  // When diagnosis exists: must NOT be legacy. Can be diagnosis_fallback (full report succeeded) or SAFE_MINIMAL_DIAGNOSIS.
  assert(ft.name + ': NOT legacy', result.data.fallbackSource !== 'legacy_fallback')
  assert(ft.name + ': selected not legacy', trace.selectedFallback !== 'legacy_fallback')
  assert(ft.name + ': finalSource not legacy', trace.finalSource !== 'legacy_fallback')
  assert(ft.name + ': diagnosis has priority', trace.diagnosisAvailable === true)
  assert(ft.name + ': legacyAllowed=false', trace.legacyAllowed === false)
  assert(ft.name + ': legacyNotInvoked', result.data.legacyFallbackInvoked === false)
  assert(ft.name + ': trace has reasonCode', trace.reasonCode === ft.reasonCode)
  console.log()
})

// ===== T8: No diagnosis → legacy =====
console.log('=== T8: No diagnosis → legacy (expected) ===')
var r8 = router.routeFinalFallback({
  diagnosis: null, baseContract: null, stages: [],
  stage: 'STEP_7_PARSE_AI', reasonCode: 'V4_AI_JSON_PARSE_FAILED',
  reason: 'Could not extract', guardErrors: [],
})
assertEq('T8: legacyFallbackInvoked', r8.data.legacyFallbackInvoked, true)
assertEq('T8: fallbackSource', r8.data.fallbackSource, 'legacy_fallback')
console.log()

// ===== T9: Router trace has all fields =====
console.log('=== T9: Router trace completeness ===')
var r = router.routeFinalFallback({
  diagnosis: diagnosis, baseContract: null, stages: [],
  stage: 'STEP_7_PARSE_AI', reasonCode: 'V4_AI_JSON_PARSE_FAILED',
  reason: 'test', guardErrors: [],
})
var rt = r.data.fallbackRouterTrace
assertEq('T9: routerVersion', rt.routerVersion, 'RC8.2')
assert('T9: has stage', typeof rt.stage === 'string' && rt.stage.length > 0)
assert('T9: has reasonCode', typeof rt.reasonCode === 'string' && rt.reasonCode.length > 0)
assert('T9: has diagnosisAvailable', typeof rt.diagnosisAvailable === 'boolean')
assert('T9: has selectedFallback', typeof rt.selectedFallback === 'string')
assert('T9: has legacyAllowed', typeof rt.legacyAllowed === 'boolean')
assert('T9: has finalSource', typeof rt.finalSource === 'string')
assert('T9: has safeMinimalBuilt', typeof rt.safeMinimalBuilt === 'boolean')
assert('T9: has safeMinimalValidated', typeof rt.safeMinimalValidated === 'boolean')
assert('T9: has diagnosisReportBuilt', typeof rt.diagnosisReportBuilt === 'boolean')
console.log()

// ===== T10: Report content is chef-compatible =====
console.log('=== T10: Chef case content ===')
var rep = r.data.report
console.log('  headline: ' + rep.headline.title)
console.log('  fatalDiag: ' + rep.fatalDiagnosis.mainProblem)
console.log('  day1: ' + rep.actionPlan.day1.goal)
var dump = JSON.stringify(rep)
assert('T10: TRAFFIC bottleneck', rep.headline.title.indexOf('获客') >= 0)
assert('T10: No R_INC_001', dump.indexOf('R_INC_001') === -1)
assert('T10: No multi-direction', dump.indexOf('freelance') === -1 && dump.indexOf('AI副业') === -1)
assert('T10: No extreme metaphor', dump.indexOf('慢性自杀') === -1)
assert('T10: No unsupported %', dump.indexOf('80%的人') === -1)
console.log()

// ===== T11: Safe minimal passes content safety =====
console.log('=== T11: Safe minimal passes safety ===')
var smCheck = safety.validateFullReport(rep, { strategyId: 'BUILD_PRODUCT' })
assertEq('T11: zero violations', smCheck.errorCount, 0)
console.log()

// ===== T12: baseContract with R_INC_001 still doesn't produce legacy =====
console.log('=== T12: baseContract has R_INC_001 but diagnosis wins ===')
var fakeBase = { report: { fatalRules: [{ ruleId: 'R_INC_001', title: '单工资依赖暴露', description: '...' }], advantageRules: [] } }
var r12 = router.routeFinalFallback({
  diagnosis: diagnosis, baseContract: fakeBase, stages: [],
  stage: 'STEP_7_PARSE_AI', reasonCode: 'V4_AI_JSON_PARSE_FAILED',
  reason: 'JSON parse', guardErrors: [],
})
assert('T12: NOT legacy', r12.data.fallbackSource !== 'legacy_fallback')
assert('T12: legacyNotInvoked', r12.data.legacyFallbackInvoked === false)
console.log()

// ===== SUMMARY =====
var total = passed + failed
console.log('========================================')
console.log('RESULTS: ' + passed + '/' + total + ' pass')
if (failed > 0) console.log('FAILURES: ' + failed)
console.log('========================================')

process.exit(failed > 0 ? 1 : 0)
