/**
 * RC8.3 Stage 14 — World Model V2 Implementation Acceptance Tests
 *
 * Validates the frozen world_model_v2 contract end-to-end:
 *   A. 9/9 semantic clean reachability
 *   B. 5/5 near-neighbor discrimination
 *   C. 18-question complete-answer paths
 *   D. no missingness inference
 *   E. context perturbation invariance
 *   F. single-answer sensitivity
 *   G. conflicting evidence behavior
 *   H. determinism
 *   I. no ontology-priority normal path
 *   J. output collapse = NO
 *   K. localization = 0 leaks
 *   L. client contract
 *   M. safety
 *
 * @version world_model_v2
 */

var ok, T, _tests, _passed, _failed
_tests = []; _passed = 0; _failed = 0
function T(n, f) { _tests.push({ name: n, fn: f }) }
function ok(e, m) { if (e) _passed++; else { _failed++; console.log('FAIL [' + _tests[_tests.length - 1].name + ']: ' + (m || '')) } }
function eq(a, b, m) { ok(a === b, m + ': got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b)) }
function ne(a, b, m) { ok(a !== b, m) }
function truthy(v, m) { ok(!!v, m) }
function falsy(v, m) { ok(!v, m) }

var V2 = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2')

// ── Frozen profile helpers ──
var HEALTHY = { Q_DEC_01:'A', Q_DEC_02:'A', Q_FB_01:'A', Q_FB_02:'A', Q_PROB_01:'A', Q_PROB_02:'A', Q_RISK_01:'A', Q_RISK_02:'A', Q_LEV_01:'C', Q_LEV_02:'A', Q_TIME_01:'A', Q_TIME_02:'A', Q_ID_01:'C', Q_ID_02:'A', Q_OPP_01:'A', Q_OPP_02:'A', Q_SYS_01:'A', Q_SYS_02:'A' }
var DEFICIT = {
  DECISION_INERTIA: { Q_DEC_01:'E', Q_DEC_02:'E' },
  FEEDBACK_LOOP_GAP: { Q_FB_01:'C', Q_FB_02:'D' },
  PROBABILITY_MISJUDGMENT: { Q_PROB_01:'C', Q_PROB_02:'D' },
  RISK_MODEL_DISTORTION: { Q_RISK_01:'C', Q_RISK_02:'D' },
  LEVERAGE_MODEL_GAP: { Q_LEV_01:'A', Q_LEV_02:'D' },
  TIME_HORIZON_TRAP: { Q_TIME_01:'D', Q_TIME_02:'C' },
  IDENTITY_CONSTRAINT: { Q_ID_01:'A', Q_ID_02:'C' },
  OPPORTUNITY_BLINDNESS: { Q_OPP_01:'C', Q_OPP_02:'D' },
  SYSTEM_THINKING_GAP: { Q_SYS_01:'C', Q_SYS_02:'D' },
}
var ORDER = Object.keys(DEFICIT)
function profile(target) { return Object.assign({}, HEALTHY, DEFICIT[target]) }

// ═══ A. 9/9 semantic clean reachability ═══
var REACH = {}
ORDER.forEach(function (t) {
  var r = V2.runWorldModelPipelineV2(profile(t))
  REACH[t] = (r.diagnosis.cognitiveBlindSpot.id === t && !r.diagnosis.cognitiveBlindSpot.tieDetected)
})
T('A: 9/9 semantic clean reachability', function () {
  var fails = ORDER.filter(function (t) { return !REACH[t] })
  eq(fails.length, 0, 'unreachable: ' + JSON.stringify(fails))
})

// ═══ B. 5/5 near-neighbor discrimination ═══
var PAIRS = [
  ['DECISION_INERTIA', 'FEEDBACK_LOOP_GAP'],
  ['OPPORTUNITY_BLINDNESS', 'IDENTITY_CONSTRAINT'],
  ['PROBABILITY_MISJUDGMENT', 'DECISION_INERTIA'],
  ['SYSTEM_THINKING_GAP', 'TIME_HORIZON_TRAP'],
  ['RISK_MODEL_DISTORTION', 'TIME_HORIZON_TRAP'],
]
T('B: 5/5 near-neighbor discrimination (distinct primary per pair)', function () {
  var fails = []
  PAIRS.forEach(function (pair) {
    var a = V2.runWorldModelPipelineV2(profile(pair[0])).diagnosis.cognitiveBlindSpot.id
    var b = V2.runWorldModelPipelineV2(profile(pair[1])).diagnosis.cognitiveBlindSpot.id
    if (a !== pair[0] || b !== pair[1] || a === b) fails.push(pair[0] + 'vs' + pair[1] + '=' + a + '/' + b)
  })
  eq(fails.length, 0, 'pairs failed: ' + JSON.stringify(fails))
})

// ═══ C. 18 questions / 74 options complete ═══
T('C: exactly 18 questions', function () { eq(V2.QUESTIONS_V2.length, 18, 'question count') })
T('C: exactly 74 options', function () { eq(V2.OPTIONS_V2.length, 74, 'option count') })
T('C: every question has >=2 options', function () {
  var bad = []
  V2.QUESTIONS_V2.forEach(function (q) {
    var cnt = V2.OPTIONS_V2.filter(function (o) { return o.questionId === q.id }).length
    if (cnt < 2) bad.push(q.id + ':' + cnt)
  })
  eq(bad.length, 0, JSON.stringify(bad))
})
T('C: 18-question complete-answer path valid', function () {
  var r = V2.runWorldModelPipelineV2(HEALTHY)
  eq(r.diagnosis.answeredCount, 18, 'answeredCount')
  eq(r.diagnosis.coverageRatio, 1, 'coverage')
})

// ═══ D. no missingness inference ═══
T('D: empty answers → insufficient (no spurious blindspot)', function () {
  var r = V2.runWorldModelPipelineV2({})
  eq(r.diagnosis.cognitiveBlindSpot.id, null, 'should be null')
  truthy(r.diagnosis.cognitiveBlindSpot.insufficient, 'insufficient flag')
})
T('D: missing both DEC questions → DECISION_MODEL unknown, not DECISION_INERTIA', function () {
  var d = Object.assign({}, HEALTHY); delete d.Q_DEC_01; delete d.Q_DEC_02
  var r = V2.runWorldModelPipelineV2(d)
  eq(r.diagnosis.worldModel.DECISION_MODEL.score, null, 'DECISION_MODEL unknown')
  ne(r.diagnosis.cognitiveBlindSpot.id, 'DECISION_INERTIA', 'must NOT infer DECISION_INERTIA from missingness')
})

// ═══ E. context perturbation invariance ═══
T('E: context fields have zero inference weight', function () {
  var base = V2.runWorldModelPipelineV2(profile('DECISION_INERTIA'))
  var withCtx = V2.runWorldModelPipelineV2(Object.assign({}, profile('DECISION_INERTIA'), {
    lifeStage: '18-24岁', incomeStructure: '工资/固定薪资', occupationDetail: '程序员', monthlySurplus: '1000元以下', safetyMonths: '不到1个月', debtPressure: '无负债',
  }))
  eq(JSON.stringify(withCtx.diagnosis.signals), JSON.stringify(base.diagnosis.signals), 'signals identical')
  eq(JSON.stringify(withCtx.diagnosis.worldModel), JSON.stringify(base.diagnosis.worldModel), 'dimensions identical')
  eq(withCtx.diagnosis.cognitiveBlindSpot.id, base.diagnosis.cognitiveBlindSpot.id, 'blindspot identical')
  eq(withCtx.diagnosis.worldStrategy.id, base.diagnosis.worldStrategy.id, 'strategy identical')
})

// ═══ F. single-answer sensitivity ═══
T('F: single-answer flip changes only target dimension, not wild flips', function () {
  var base = V2.runWorldModelPipelineV2(profile('DECISION_INERTIA'))
  var flipped = Object.assign({}, profile('DECISION_INERTIA'), { Q_DEC_01: 'A' })
  var fr = V2.runWorldModelPipelineV2(flipped)
  ne(fr.diagnosis.worldModel.DECISION_MODEL.score, base.diagnosis.worldModel.DECISION_MODEL.score, 'DECISION dim changed')
  // unrelated dimension must NOT change
  eq(JSON.stringify(fr.diagnosis.worldModel.OPPORTUNITY_MODEL), JSON.stringify(base.diagnosis.worldModel.OPPORTUNITY_MODEL), 'OPPORTUNITY unchanged')
  eq(JSON.stringify(fr.diagnosis.worldModel.SYSTEMS_MODEL), JSON.stringify(base.diagnosis.worldModel.SYSTEMS_MODEL), 'SYSTEMS unchanged')
})

// ═══ G. conflicting evidence behavior ═══
T('G: conflicting evidence bounded (no NaN, no crash)', function () {
  var mixed = { Q_DEC_01:'A', Q_DEC_02:'E', Q_FB_01:'A', Q_FB_02:'D', Q_PROB_01:'A', Q_PROB_02:'D', Q_RISK_01:'A', Q_RISK_02:'D', Q_LEV_01:'C', Q_LEV_02:'D', Q_TIME_01:'A', Q_TIME_02:'C', Q_ID_01:'A', Q_ID_02:'A', Q_OPP_01:'A', Q_OPP_02:'D', Q_SYS_01:'A', Q_SYS_02:'D' }
  var r = V2.runWorldModelPipelineV2(mixed)
  truthy(r.valid, 'valid')
  var gap = r.diagnosis.cognitiveBlindSpot.gapScore
  ok(typeof gap === 'number' && gap >= 0 && gap <= 1, 'gap bounded: ' + gap)
})

// ═══ H. determinism ═══
T('H: deterministic (3 runs identical)', function () {
  var a = V2.runWorldModelPipelineV2(profile('FEEDBACK_LOOP_GAP'))
  var b = V2.runWorldModelPipelineV2(profile('FEEDBACK_LOOP_GAP'))
  var c = V2.runWorldModelPipelineV2(profile('FEEDBACK_LOOP_GAP'))
  eq(a.diagnosis.inputHash, b.diagnosis.inputHash, 'hash stable')
  eq(b.diagnosis.inputHash, c.diagnosis.inputHash, 'hash stable 2')
  eq(JSON.stringify(a.diagnosis.worldModel), JSON.stringify(b.diagnosis.worldModel), 'dimensions stable')
})

// ═══ I. no ontology-priority normal path ═══
T('I: no ontology-priority dependency (no ONTOLOGY_PRIORITY in inference)', function () {
  var fs = require('fs')
  var src = fs.readFileSync('cloudfunctions/generateAiReport/lib/engine/worldModel/v2/blindSpotEngineV2.js', 'utf8')
  eq(src.indexOf('ONTOLOGY_PRIORITY'), -1, 'blindSpotEngineV2 must not reference ontology priority')
})
T('I: tie-break is ID_OFFSET (rare near-tie only), not ontology priority', function () {
  var r = V2.runWorldModelPipelineV2(profile('DECISION_INERTIA'))
  eq(r.diagnosis.cognitiveBlindSpot.tieBrokenBy, null, 'normal path has no tie-break')
})

// ═══ J. output collapse = NO ═══
T('J: output collapse = NO (>=7 distinct primaries across 9 profiles)', function () {
  var primaries = {}
  ORDER.forEach(function (t) {
    primaries[V2.runWorldModelPipelineV2(profile(t)).diagnosis.cognitiveBlindSpot.id] = true
  })
  var distinct = Object.keys(primaries).length
  ok(distinct >= 9, 'distinct primaries = ' + distinct)
})

// ═══ K. localization = 0 leaks ═══
function isEnglishSentence(v) {
  if (typeof v !== 'string') return false
  // internal enums / ids / versions are allowed (not user-visible prose)
  if (/^(stable|improving|high|medium|low|recommended|MEDIUM|HIGH|LOW|world_model_v2|WORLD_MODEL_V2)$/i.test(v)) return false
  if (/^\d+$/.test(v)) return false
  // English sentence = 2+ English words with spaces, no Chinese
  if (/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(v) && !/[\u4e00-\u9fff]/.test(v)) return true
  return false
}
function collectLeaks(obj, path, out) {
  if (obj === null || obj === undefined) return
  if (typeof obj === 'string') { if (isEnglishSentence(obj)) out.push(path + '="' + obj + '"'); return }
  if (Array.isArray(obj)) { obj.forEach(function (v, i) { collectLeaks(v, path + '[' + i + ']', out) }); return }
  if (typeof obj === 'object') { Object.keys(obj).forEach(function (k) { collectLeaks(obj[k], path + '.' + k, out) }); return }
}
T('K: adapter output has zero user-visible English prose leaks', function () {
  var diag = V2.runWorldModelPipelineV2(profile('DECISION_INERTIA')).diagnosis
  var report = V2.adaptWorldModelToLegacyV2(diag)
  var leaks = []
  collectLeaks(report, 'report', leaks)
  eq(leaks.length, 0, 'english leaks: ' + JSON.stringify(leaks))
})

// ═══ L. client contract ═══
T('L: client contract fields present', function () {
  var diag = V2.runWorldModelPipelineV2(profile('DECISION_INERTIA')).diagnosis
  var report = V2.adaptWorldModelToLegacyV2(diag)
  ;['headline', 'fatalDiagnosis', 'scoreCard', 'wealthPath', 'actionPlan', 'stopDoing', 'identityUpgrade', 'finalStrike', 'fatalRules', 'advantageRules', 'opportunityRules', 'destinySimulator', 'cognitiveVerdict'].forEach(function (k) {
    truthy(report[k] !== undefined, 'missing: ' + k)
  })
})

// ═══ M. safety ═══
T('M: safety — no fortune-telling / chicken-soup / commercial-direction', function () {
  var diag = V2.runWorldModelPipelineV2(profile('DECISION_INERTIA')).diagnosis
  var report = JSON.stringify(V2.adaptWorldModelToLegacyV2(diag))
  var banned = ['命理', '八字', '星座', '塔罗', '一定发财', '必然失败', '加油', '坚持就会成功', '做副业', '做个人IP', '直播带货', '短视频赚钱']
  var hits = banned.filter(function (b) { return report.indexOf(b) >= 0 })
  eq(hits.length, 0, 'safety violations: ' + JSON.stringify(hits))
})

// ═══ RUN ═══
for (var i = 0; i < _tests.length; i++) {
  try { _tests[i].fn() } catch (e) { _failed++; console.log('FAIL (' + _tests[i].name + '): ' + e.message) }
}

console.log('\n========================================')
console.log('RC8.3 Stage 14 — World Model V2 Acceptance')
console.log('========================================')
console.log('Semantic reachability: ' + ORDER.filter(function (t) { return REACH[t] }).length + '/9')
console.log('Total: ' + (_passed + _failed) + ' | Passed: ' + _passed + ' | Failed: ' + _failed)
console.log(_failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + _failed)
console.log('========================================\n')

process.exit(_failed > 0 ? 1 : 0)
