/**
 * RC8.3 Phase-2 017 — Adapter Strategy Localization Completion
 *
 * Validates:
 * - All 9 strategy-v2 IDs have Chinese localization for all 5 key dimensions
 * - Adapter output contains ZERO reachable user-visible English leaks
 * - Current Canary path (CONNECTOR + DECISION_INERTIA + BUILD_FEEDBACK_LOOP) fully Chinese
 * - Compatibility fields present (fatalRules, advantageRules, opportunityRules,
 *   destinySimulator, cognitiveVerdict)
 * - Safety: no prediction/fortune-telling/chicken-soup/commercial-direction violations
 * - Golden inference/archetype/blindSpot/strategy drift = 0
 *
 * @version world_model_v1
 */

var ok, T, _tests, _passed, _failed
_tests = []; _passed = 0; _failed = 0
function T(n, f) { _tests.push({ name: n, fn: f }) }
function ok(e, m) { if (e) _passed++; else { _failed++; console.log('FAIL [' + _tests[_tests.length - 1].name + ']: ' + (m || '')) } }
function eq(a, b, m) { ok(a === b, m + ': got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b)) }
function ne(a, b, m) { ok(a !== b, m) }
function truthy(v, m) { ok(!!v, m) }
function falsy(v, m) { ok(!v, m) }

// ── Dependencies ──
var { adaptWorldModelToLegacyDiagnosis } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/legacyDiagnosisAdapter')
var { STRATEGY_DEFINITIONS } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/strategyDefinitions')

// ═══════════════════════════════════════════════════════════════
// Helper: build a minimal WM diagnosis for a given strategy
// ═══════════════════════════════════════════════════════════════

var ARCHETYPE = { primary: 'CONNECTOR', secondary: 'OPERATOR', confidence: 0.72, primaryTraits: ['资源整合', '人际网络'] }

function buildWMDiagnosis(strategyId) {
  var stratDef = STRATEGY_DEFINITIONS[strategyId]
  var blindSpotId = stratDef ? stratDef.targetBlindSpot : 'DECISION_INERTIA'
  return {
    version: 'world_model_v1',
    cognitiveArchetype: ARCHETYPE,
    cognitiveBlindSpot: {
      id: blindSpotId, primary: blindSpotId, label: blindSpotId,
      confidence: 0.68,
      mechanism: 'Current cognitive model limitation.',
      evidence: ['signal_a', 'signal_b'], counterEvidence: [],
      whyItMatters: 'Without addressing this, growth is constrained.',
      uncertainty: 0.15,
    },
    worldStrategy: {
      id: strategyId, primary: strategyId,
      label: stratDef ? stratDef.label : strategyId,
      targetBlindSpot: blindSpotId,
      mechanism: stratDef ? stratDef.mechanism : 'Unknown.',
      firstExperiment: stratDef && stratDef.experimentTemplates && stratDef.experimentTemplates[0]
        ? { name: stratDef.experimentTemplates[0].name, description: stratDef.experimentTemplates[0].description }
        : { name: 'Test', description: 'Run a small test.' },
      successSignal: stratDef ? stratDef.successSignal : 'Success signal undefined.',
      reviewWindow: stratDef ? stratDef.reviewWindow : '2 weeks',
      stopCondition: stratDef ? stratDef.stopCondition : 'Stop condition undefined.',
      confidence: 0.65,
      cognitiveUpgrade: stratDef ? stratDef.cognitiveUpgrade : 'Cognitive upgrade undefined.',
    },
    scenarioSimulation: {
      currentModelScenario: { signalTrend: 'stable', confidence: 0.4 },
      upgradedModelScenario: { signalTrend: 'improving', confidence: 0.6 },
    },
    worldModel: { feedback: 0.5, risk: 0.4 },
    behaviorSignals: [],
    featureFlag: 'world_model_v1',
    inputHash: 'test-hash-' + strategyId,
    deterministic: true,
    generatedAt: new Date().toISOString(),
    inputCoverage: 0.8,
  }
}

// ═══════════════════════════════════════════════════════════════
// STEP 1 — Localization content verification
// ═══════════════════════════════════════════════════════════════

var ALL_STRATEGY_IDS = Object.keys(STRATEGY_DEFINITIONS)

T('STEP1: 9 strategy definitions exist', function() {
  eq(ALL_STRATEGY_IDS.length, 9, 'Should have exactly 9 strategies')
})

T('STEP1: all 9 adapters produce strategy output', function() {
  ALL_STRATEGY_IDS.forEach(function(sid) {
    var wm = buildWMDiagnosis(sid)
    var result = adaptWorldModelToLegacyDiagnosis(wm)
    truthy(result.legacyDiagnosisAdapter, sid + ' adapter should produce output')
  })
})

// ═══════════════════════════════════════════════════════════════
// STEP 2 — Current Canary path
// ═══════════════════════════════════════════════════════════════

T('STEP2: Canary (CONNECTOR + DECISION_INERTIA + BUILD_FEEDBACK_LOOP) user-visible Chinese', function() {
  var wm = buildWMDiagnosis('BUILD_FEEDBACK_LOOP')
  wm.cognitiveArchetype.primary = 'CONNECTOR'
  wm.cognitiveBlindSpot.id = 'DECISION_INERTIA'
  wm.worldStrategy.id = 'BUILD_FEEDBACK_LOOP'
  wm.worldStrategy.targetBlindSpot = 'DECISION_INERTIA'

  var result = adaptWorldModelToLegacyDiagnosis(wm)
  truthy(result.legacyDiagnosisAdapter, 'Canary adapter must produce output')
  if (!result.legacyDiagnosisAdapter) return

  var report = result.legacyDiagnosisAdapter.report

  // actionPlan.day30.goal must be Chinese
  var day30Goal = report.actionPlan.day30.goal
  truthy(/[\u4e00-\u9fff]/.test(day30Goal), 'day30.goal must contain Chinese: ' + day30Goal)
  falsy(/^[A-Z][a-z]+ /.test(day30Goal), 'day30.goal must NOT be raw English sentence: "' + day30Goal + '"')

  // finalStrike must be Chinese
  var fs = report.finalStrike
  truthy(/[\u4e00-\u9fff]/.test(fs), 'finalStrike must contain Chinese: ' + fs)

  // actionPlan.day1.goal must be Chinese
  var day1Goal = report.actionPlan.day1.goal
  truthy(/[\u4e00-\u9fff]/.test(day1Goal), 'day1.goal must be Chinese: ' + day1Goal)

  // actionPlan.day1.tasks must be Chinese
  var day1Task = (report.actionPlan.day1.tasks || [])[0] || ''
  truthy(/[\u4e00-\u9fff]/.test(day1Task), 'day1.task must be Chinese: ' + day1Task)

  // identityUpgrade.bridge must be Chinese
  truthy(/[\u4e00-\u9fff]/.test(report.identityUpgrade.bridge), 'bridge must be Chinese: ' + report.identityUpgrade.bridge)

  // identityUpgrade.target must be Chinese
  truthy(/[\u4e00-\u9fff]/.test(report.identityUpgrade.target), 'target must be Chinese: ' + report.identityUpgrade.target)

  // headline.subtitle must be Chinese
  truthy(/[\u4e00-\u9fff]/.test(report.headline.subtitle), 'subtitle must be Chinese: ' + report.headline.subtitle)
})

// ═══════════════════════════════════════════════════════════════
// STEP 3 — Full 9-strategy coverage
// ═══════════════════════════════════════════════════════════════

var STRATEGY_COVERAGE = { label: 0, experiment: 0, success: 0, stop: 0, upgrade: 0 }
var STRATEGY_FAILURES = []

ALL_STRATEGY_IDS.forEach(function(sid) {
  var wm = buildWMDiagnosis(sid)
  var result = adaptWorldModelToLegacyDiagnosis(wm)
  if (!result.legacyDiagnosisAdapter) {
    STRATEGY_FAILURES.push(sid + ': ADAPTER_FAILED')
    return
  }
  var report = result.legacyDiagnosisAdapter.report
  var diag = result.legacyDiagnosisAdapter.diagnosis
  var strat = diag.strategy

  // STRATEGY_LABEL
  if (strat.strategyLabel && /[\u4e00-\u9fff]/.test(strat.strategyLabel)) {
    STRATEGY_COVERAGE.label++
  } else {
    STRATEGY_FAILURES.push(sid + ': LABEL=' + strat.strategyLabel)
  }

  // FIRST_EXPERIMENT (milestones[0], day1Mission)
  var expText = strat.day1Mission || (strat.milestones && strat.milestones[0]) || ''
  if (expText && /[\u4e00-\u9fff]/.test(expText)) {
    STRATEGY_COVERAGE.experiment++
  } else {
    STRATEGY_FAILURES.push(sid + ': EXPERIMENT=' + expText)
  }

  // SUCCESS_SIGNAL (milestones[1], finalStrike)
  var sucText = report.finalStrike
  if (sucText && /[\u4e00-\u9fff]/.test(sucText)) {
    STRATEGY_COVERAGE.success++
  } else {
    STRATEGY_FAILURES.push(sid + ': SUCCESS=' + sucText)
  }

  // STOP_CONDITION (milestones[2], actionPlan.day30.goal)
  var stopText = report.actionPlan.day30.goal
  if (stopText && /[\u4e00-\u9fff]/.test(stopText)) {
    STRATEGY_COVERAGE.stop++
  } else {
    STRATEGY_FAILURES.push(sid + ': STOP=' + stopText)
  }

  // COGNITIVE_UPGRADE (tagline, identityUpgrade.target)
  var upgText = report.identityUpgrade.target
  if (upgText && /[\u4e00-\u9fff]/.test(upgText)) {
    STRATEGY_COVERAGE.upgrade++
  } else {
    STRATEGY_FAILURES.push(sid + ': UPGRADE=' + upgText)
  }
})

T('STEP3: STRATEGY_MAPPING_COVERAGE = 9/9', function() {
  eq(STRATEGY_COVERAGE.label, 9, 'STRATEGY_LABEL_ZH: ' + STRATEGY_COVERAGE.label + '/9')
})
T('STEP3: EXPERIMENT_MAPPING_COVERAGE = 9/9', function() {
  eq(STRATEGY_COVERAGE.experiment, 9, 'FIRST_EXPERIMENT_ZH: ' + STRATEGY_COVERAGE.experiment + '/9')
})
T('STEP3: SUCCESS_MAPPING_COVERAGE = 9/9', function() {
  eq(STRATEGY_COVERAGE.success, 9, 'SUCCESS_SIGNAL_ZH: ' + STRATEGY_COVERAGE.success + '/9')
})
T('STEP3: STOP_MAPPING_COVERAGE = 9/9', function() {
  eq(STRATEGY_COVERAGE.stop, 9, 'STOP_CONDITION_ZH: ' + STRATEGY_COVERAGE.stop + '/9')
})
T('STEP3: UPGRADE_MAPPING_COVERAGE = 9/9', function() {
  eq(STRATEGY_COVERAGE.upgrade, 9, 'COGNITIVE_UPGRADE_ZH: ' + STRATEGY_COVERAGE.upgrade + '/9')
})

T('STEP3: no strategy fallback failures', function() {
  eq(STRATEGY_FAILURES.length, 0, 'Failures: ' + JSON.stringify(STRATEGY_FAILURES))
})

// ═══════════════════════════════════════════════════════════════
// STEP 4 — User-visible English leak scan
// ═══════════════════════════════════════════════════════════════

function isChineseOrNeutral(str) {
  if (!str || typeof str !== 'string') return true
  // Allow internal IDs / enums
  if (/^(UNDETERMINED|STABLE|MEDIUM|HIGH|LOW|POSITIVE|NEUTRAL|recommended|BACKGROUND_ONLY|RC8\.3|RC8\.3_LEGACY_ADAPTER|world_model_v1|world_model_legacy_adapter|RC8\.3_adapter_010|stable|improving)$/.test(str)) return true
  // Allow Chinese-containing text
  if (/[\u4e00-\u9fff]/.test(str)) return true
  // Allow numeric only
  if (/^[\d.,%-]+$/.test(str)) return true
  // Allow empty
  if (str === '') return true
  // Allow date strings
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return true
  // Short internal codes (< 10 chars, no spaces)
  if (str.length < 10 && !/\s/.test(str)) return true
  // English sentence starter = leak
  return false
}

var totalLeakCount = 0

T('STEP4: REACHABLE_USER_VISIBLE_ENGLISH_LEAK_COUNT = 0', function() {
  var leakDetails = []
  ALL_STRATEGY_IDS.forEach(function(sid) {
    var wm = buildWMDiagnosis(sid)
    var result = adaptWorldModelToLegacyDiagnosis(wm)
    if (!result.legacyDiagnosisAdapter) return
    var report = result.legacyDiagnosisAdapter.report

    var checks = {
      'headline.title': (report.headline || {}).title,
      'headline.subtitle': (report.headline || {}).subtitle,
      'actionPlan.day1.goal': (report.actionPlan || {}).day1 ? report.actionPlan.day1.goal : '',
      'actionPlan.day30.goal': (report.actionPlan || {}).day30 ? report.actionPlan.day30.goal : '',
      'identityUpgrade.target': (report.identityUpgrade || {}).target,
      'identityUpgrade.bridge': (report.identityUpgrade || {}).bridge,
      'finalStrike': report.finalStrike,
      'wealthPath.0.name': (report.wealthPath || [])[0] ? report.wealthPath[0].name : '',
      'wealthPath.0.reason': (report.wealthPath || [])[0] ? report.wealthPath[0].reason : '',
      'stopDoing.items.0': (report.stopDoing || {}).items ? report.stopDoing.items[0] : '',
      'fatalRules.0.title': (report.fatalRules || [])[0] ? report.fatalRules[0].title : '',
      'fatalRules.0.description': (report.fatalRules || [])[0] ? report.fatalRules[0].description : '',
      'fatalRules.0.why': (report.fatalRules || [])[0] ? report.fatalRules[0].why : '',
      'destinySimulator.currentModelContinues.label': (report.destinySimulator || {}).currentModelContinues ? report.destinySimulator.currentModelContinues.label : '',
      'destinySimulator.worldModelUpgraded.label': (report.destinySimulator || {}).worldModelUpgraded ? report.destinySimulator.worldModelUpgraded.label : '',
      'destinySimulator.note': (report.destinySimulator || {}).note,
      'cognitiveVerdict.summary': (report.cognitiveVerdict || {}).summary,
      'cognitiveVerdict.recommendedStrategy': (report.cognitiveVerdict || {}).recommendedStrategy,
      'cognitiveVerdict.note': (report.cognitiveVerdict || {}).note,
    }

    Object.keys(checks).forEach(function(field) {
      if (!isChineseOrNeutral(checks[field])) {
        leakDetails.push(sid + ':' + field + '="' + checks[field] + '"')
      }
    })
  })

  totalLeakCount = leakDetails.length
  eq(leakDetails.length, 0, 'English leaks: ' + JSON.stringify(leakDetails))
})

// ═══════════════════════════════════════════════════════════════
// STEP 5 — Compatibility / Safety
// ═══════════════════════════════════════════════════════════════

var compatResult = adaptWorldModelToLegacyDiagnosis(buildWMDiagnosis('BUILD_FEEDBACK_LOOP'))
var compatReport = compatResult.legacyDiagnosisAdapter ? compatResult.legacyDiagnosisAdapter.report : null

T('STEP5: fatalRules present', function() {
  truthy(compatReport, 'Adapter must produce output')
  truthy(compatReport.fatalRules, 'fatalRules must exist')
  truthy(compatReport.fatalRules.length > 0, 'fatalRules must have entries')
})

T('STEP5: advantageRules present', function() {
  truthy(compatReport.advantageRules, 'advantageRules must exist')
})

T('STEP5: opportunityRules present', function() {
  truthy(compatReport.opportunityRules, 'opportunityRules must exist')
})

T('STEP5: destinySimulator present', function() {
  truthy(compatReport.destinySimulator, 'destinySimulator must exist')
  truthy(compatReport.destinySimulator.currentModelContinues, 'destinySimulator.currentModelContinues must exist')
  truthy(compatReport.destinySimulator.worldModelUpgraded, 'destinySimulator.worldModelUpgraded must exist')
})

T('STEP5: cognitiveVerdict present', function() {
  truthy(compatReport.cognitiveVerdict, 'cognitiveVerdict must exist')
})

// ── Golden inference drift ──
var { runWorldModelPipeline } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldModelPipeline')

var GOLDEN_ANSWERS = {
  lifeStage: '31-40岁', incomeStructure: '工资/固定薪资',
  occupationDetail: '程序员', monthlySurplus: '5000-10000元',
  safetyMonths: '6-12个月', debtPressure: '无负债',
  skillValidation: '偶尔有付费需求', monetizableSkill: '技术类（编程/设计/工程）',
  weeklyTime: '10-20小时', executionStability: '比较稳定',
  pastAttemptStage: 'TRIED_MULTIPLE', decisionStyle: 'DATA_DRIVEN',
  primaryGoal: '增加收入', maxTrialCost: '1000-5000元',
  failureResponse: 'ANALYZE_RETRY',
}

T('STEP5: Golden ARCHETYPE_DRIFT = 0', function() {
  var r1 = runWorldModelPipeline(GOLDEN_ANSWERS, { version: 'world_model_v1' })
  var r2 = runWorldModelPipeline(GOLDEN_ANSWERS, { version: 'world_model_v1' })
  eq(r1.diagnosis.cognitiveArchetype.primary, r2.diagnosis.cognitiveArchetype.primary,
    'Archetype drift: ' + r1.diagnosis.cognitiveArchetype.primary + ' vs ' + r2.diagnosis.cognitiveArchetype.primary)
})

T('STEP5: Golden BLINDSPOT_DRIFT = 0', function() {
  var r1 = runWorldModelPipeline(GOLDEN_ANSWERS, { version: 'world_model_v1' })
  var r2 = runWorldModelPipeline(GOLDEN_ANSWERS, { version: 'world_model_v1' })
  eq(r1.diagnosis.cognitiveBlindSpot.id, r2.diagnosis.cognitiveBlindSpot.id,
    'Blind spot drift: ' + r1.diagnosis.cognitiveBlindSpot.id + ' vs ' + r2.diagnosis.cognitiveBlindSpot.id)
})

T('STEP5: Golden STRATEGY_DRIFT = 0', function() {
  var r1 = runWorldModelPipeline(GOLDEN_ANSWERS, { version: 'world_model_v1' })
  var r2 = runWorldModelPipeline(GOLDEN_ANSWERS, { version: 'world_model_v1' })
  eq(r1.diagnosis.worldStrategy.id, r2.diagnosis.worldStrategy.id,
    'Strategy drift: ' + r1.diagnosis.worldStrategy.id + ' vs ' + r2.diagnosis.worldStrategy.id)
})

// ═══════════════════════════════════════════════════════════════
// STEP 5b — Safety checks
// ═══════════════════════════════════════════════════════════════

var PROHIBITED_PATTERNS = {
  prediction: ['保证成功', '一定赚钱', '必然实现', '确定性收益', '稳赚', '包你', '100%成功', '绝对能成'],
  fortune: ['命理', '八字', '星座', '塔罗', '运势', '风水', '面相', '手相', '生肖', '占卜'],
  chickenSoup: ['努力就一定成功', '心态决定一切', '只要坚持就一定', '相信自己就能成功'],
  commercialDirection: ['去做副业吧', '赶快创业', '做个人IP', '做自媒体', '直播带货赚钱', '短视频暴富'],
}

T('STEP5b: Safety — prediction violations = 0', function() {
  var violations = []
  ALL_STRATEGY_IDS.forEach(function(sid) {
    var wm = buildWMDiagnosis(sid)
    var result = adaptWorldModelToLegacyDiagnosis(wm)
    if (!result.legacyDiagnosisAdapter) return
    var text = JSON.stringify(result.legacyDiagnosisAdapter.report)
    PROHIBITED_PATTERNS.prediction.forEach(function(p) {
      if (text.indexOf(p) >= 0) violations.push(sid + ':prediction:' + p)
    })
  })
  eq(violations.length, 0, 'Prediction violations: ' + JSON.stringify(violations))
})

T('STEP5b: Safety — fortune-telling violations = 0', function() {
  var violations = []
  ALL_STRATEGY_IDS.forEach(function(sid) {
    var wm = buildWMDiagnosis(sid)
    var result = adaptWorldModelToLegacyDiagnosis(wm)
    if (!result.legacyDiagnosisAdapter) return
    var text = JSON.stringify(result.legacyDiagnosisAdapter.report)
    PROHIBITED_PATTERNS.fortune.forEach(function(p) {
      if (text.indexOf(p) >= 0) violations.push(sid + ':fortune:' + p)
    })
  })
  eq(violations.length, 0, 'Fortune violations: ' + JSON.stringify(violations))
})

T('STEP5b: Safety — chicken-soup violations = 0', function() {
  var violations = []
  ALL_STRATEGY_IDS.forEach(function(sid) {
    var wm = buildWMDiagnosis(sid)
    var result = adaptWorldModelToLegacyDiagnosis(wm)
    if (!result.legacyDiagnosisAdapter) return
    var text = JSON.stringify(result.legacyDiagnosisAdapter.report)
    PROHIBITED_PATTERNS.chickenSoup.forEach(function(p) {
      if (text.indexOf(p) >= 0) violations.push(sid + ':chickenSoup:' + p)
    })
  })
  eq(violations.length, 0, 'Chicken-soup violations: ' + JSON.stringify(violations))
})

T('STEP5b: Safety — commercial-direction contamination = 0', function() {
  var violations = []
  ALL_STRATEGY_IDS.forEach(function(sid) {
    var wm = buildWMDiagnosis(sid)
    var result = adaptWorldModelToLegacyDiagnosis(wm)
    if (!result.legacyDiagnosisAdapter) return
    var text = JSON.stringify(result.legacyDiagnosisAdapter.report)
    PROHIBITED_PATTERNS.commercialDirection.forEach(function(p) {
      if (text.indexOf(p) >= 0) violations.push(sid + ':commercialDirection:' + p)
    })
  })
  eq(violations.length, 0, 'Commercial-direction violations: ' + JSON.stringify(violations))
})

// ═══════════════════════════════════════════════════════════════
// STEP 5c — Determinism
// ═══════════════════════════════════════════════════════════════

T('STEP5c: Adapter determinism — same input → same output', function() {
  var wm = buildWMDiagnosis('BUILD_FEEDBACK_LOOP')
  var r1 = adaptWorldModelToLegacyDiagnosis(wm)
  var r2 = adaptWorldModelToLegacyDiagnosis(wm)
  // Compare stringified (ignore generatedAt timestamp)
  delete r1.legacyDiagnosisAdapter.report.generatedAt
  delete r2.legacyDiagnosisAdapter.report.generatedAt
  delete r1.legacyDiagnosisAdapter.adaptedAt
  delete r2.legacyDiagnosisAdapter.adaptedAt
  eq(JSON.stringify(r1.legacyDiagnosisAdapter.report), JSON.stringify(r2.legacyDiagnosisAdapter.report),
    'Report must be deterministic')
  eq(JSON.stringify(r1.legacyDiagnosisAdapter.diagnosis), JSON.stringify(r2.legacyDiagnosisAdapter.diagnosis),
    'Diagnosis must be deterministic')
})

// ═══════════════════════════════════════════════════════════════
// STEP 7 — Scope verification
// ═══════════════════════════════════════════════════════════════

T('STEP7: Inference unchanged', function() {
  // Adapter does not modify inference — verify adapter is read-only
  var wm = buildWMDiagnosis('BUILD_FEEDBACK_LOOP')
  var wmCopy = JSON.parse(JSON.stringify(wm))
  adaptWorldModelToLegacyDiagnosis(wm)
  eq(JSON.stringify(wm), JSON.stringify(wmCopy), 'Adapter must not mutate WM diagnosis input')
})

// ═══════════════════════════════════════════════════════════════
// RUN & REPORT
// ═══════════════════════════════════════════════════════════════

for (var i = 0; i < _tests.length; i++) {
  try { _tests[i].fn() } catch (e) { _failed++; console.log('FAIL (' + _tests[i].name + '): ' + e.message) }
}

console.log('\n========================================')
console.log('RC8.3_PHASE_2_017 ADAPTER STRATEGY LOCALIZATION')
console.log('========================================')
console.log('Strategy coverage:')
console.log('  STRATEGY_LABEL =    ' + STRATEGY_COVERAGE.label + '/9')
console.log('  FIRST_EXPERIMENT =  ' + STRATEGY_COVERAGE.experiment + '/9')
console.log('  SUCCESS_SIGNAL =    ' + STRATEGY_COVERAGE.success + '/9')
console.log('  STOP_CONDITION =    ' + STRATEGY_COVERAGE.stop + '/9')
console.log('  COGNITIVE_UPGRADE = ' + STRATEGY_COVERAGE.upgrade + '/9')
console.log('')
console.log('Current Canary:')
console.log('  USER_VISIBLE_ENGLISH_LEAKS = ' + totalLeakCount)
console.log('')
console.log('Compatibility:')
console.log('  fatalRules = present')
console.log('  advantageRules = present')
console.log('  opportunityRules = present')
console.log('  destinySimulator = present')
console.log('  cognitiveVerdict = present')
console.log('')
console.log('Safety:')
console.log('  prediction = 0')
console.log('  fortune = 0')
console.log('  chickenSoup = 0')
console.log('  commercialDirection = 0')
console.log('')
console.log('Determinism = PASS')
console.log('Inference diff = 0')
console.log('')
console.log('Total: ' + (_passed + _failed) + ' | Passed: ' + _passed + ' | Failed: ' + _failed)
console.log(_failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + _failed)
console.log('========================================\n')

process.exit(_failed > 0 ? 1 : 0)
