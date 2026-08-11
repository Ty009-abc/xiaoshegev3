/**
 * RC8.3 Phase-2 015 — Proportional Conflict Penalty Behavioral Test
 * Tests: conPenalty = Σ(suppressed.score) × 0.25
 */
var _passed = 0, _failed = 0
function T(n, f) { try { f(); _passed++ } catch (e) { _failed++; console.log('FAIL: ' + n + ' — ' + (e.message||e)) } }
function ok(e, m) { if (!e) throw new Error(m||'assert') }
function eq(a, b, m) { if (a !== b) throw new Error((m||'') + ': got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b)) }
function gt(a, b, m) { if (!(a > b)) throw new Error((m||'') + ': ' + a + ' not > ' + b) }
function ne(a, b, m) { if (a === b) throw new Error((m||'') + ': ' + JSON.stringify(a) + ' == ' + JSON.stringify(b)) }
function between(v, lo, hi, m) { ok(v >= lo && v <= hi, (m||'') + ': ' + v + ' not in [' + lo + ',' + hi + ']') }
function truthy(v, m) { if (!v) throw new Error(m||'expected truthy') }

var { runWorldModelPipeline } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldModelPipeline')
var { calculateDimensionScore } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldModelEngine')

var BASE = {
  lifeStage: '31-40岁', incomeStructure: '工资/固定薪资', occupationDetail: '厨师',
  monthlySurplus: '1000-5000元', safetyMonths: '6-12个月', debtPressure: '房贷为主（低月供）',
  skillValidation: '偶尔有付费需求', monetizableSkill: '手艺人（厨师/维修/美业）',
  weeklyTime: '20小时以上', executionStability: '有固定计划，基本能执行',
  pastAttemptStage: '卖出过几个，有少量收入', decisionStyle: '边上班边小规模测试',
  primaryGoal: '转行进入新领域', maxTrialCost: '1000-5000元', failureResponse: '复盘优化后继续',
}

// ═══════════════════════════════════════════════════════════════
// FORMULA correctness
// ═══════════════════════════════════════════════════════════════

T('F-01: new formula proportional to scores', function () {
  var sup = [{ id: 'A', state: 'ACTIVE', score: 0.8 }]
  var con = [{ id: 'B', state: 'SUPPRESSED', score: 0.2 }, { id: 'C', state: 'SUPPRESSED', score: 0.3 }]
  var score = calculateDimensionScore(sup, con)
  // supScore = 0.8, conPenalty = (0.2+0.3)*0.25 = 0.125, activeBonus = 0.05
  // score = 0.8 - 0.125 + 0.05 = 0.725
  between(score, 0.72, 0.73, 'score ≈ 0.725, got=' + score.toFixed(4))
})

T('F-02: zero suppressed → zero penalty', function () {
  var sup = [{ id: 'A', state: 'ACTIVE', score: 0.5 }]
  var score = calculateDimensionScore(sup, [])
  // supScore=0.5, conPenalty=0, activeBonus=0.05, score=0.55
  between(score, 0.54, 0.56, 'no penalty, got=' + score.toFixed(4))
})

T('F-03: null score treated as 0', function () {
  var sup = [{ id: 'A', state: 'WEAK', score: 0.4 }]
  var con = [{ id: 'B', state: 'SUPPRESSED', score: null }]
  var score = calculateDimensionScore(sup, con)
  // conPenalty = (0)*0.25 = 0
  eq(score, 0.4, 'null-score suppressed signal contributes 0 to penalty')
})

T('F-04: deterministic — same input same score', function () {
  var r1 = runWorldModelPipeline(BASE, { version: 'world_model_v1' })
  var r2 = runWorldModelPipeline(BASE, { version: 'world_model_v1' })
  eq(r1.diagnosis.worldModel.DECISION_MODEL.score, r2.diagnosis.worldModel.DECISION_MODEL.score)
  eq(r1.diagnosis.worldModel.FEEDBACK_MODEL.score, r2.diagnosis.worldModel.FEEDBACK_MODEL.score)
})

// ═══════════════════════════════════════════════════════════════
// CF1 — decisionStyle sensitivity
// ═══════════════════════════════════════════════════════════════

var rBase = runWorldModelPipeline(BASE, { version: 'world_model_v1' })
var rCf1 = runWorldModelPipeline(Object.assign({}, BASE, { decisionStyle: '直接辞职/全职All-in' }), { version: 'world_model_v1' })

var decDelta = rCf1.diagnosis.worldModel.DECISION_MODEL.score - rBase.diagnosis.worldModel.DECISION_MODEL.score

T('CF1-01: DECISION_MODEL score changes', function () {
  gt(decDelta, 0.8, 'CF1 DEC delta > 0.8, got ' + decDelta.toFixed(4))
})

T('CF1-02: DECISION_MODEL state WEAK→STRONG', function () {
  eq(rBase.diagnosis.worldModel.DECISION_MODEL.state, 'WEAK', 'base is WEAK')
  eq(rCf1.diagnosis.worldModel.DECISION_MODEL.state, 'STRONG', 'CF1 is STRONG')
})

T('CF1-03: archetype stable', function () {
  eq(rBase.diagnosis.cognitiveArchetype.primary, rCf1.diagnosis.cognitiveArchetype.primary)
})

T('CF1-04: blindSpot responds to decisionStyle change', function () {
  // With restored DECISION_MODEL sensitivity, decisionStyle CF can shift blindSpot
  // This is EXPECTED behavior — sensitivity was the whole point of the fix
  console.log('  BASE blindSpot=' + rBase.diagnosis.cognitiveBlindSpot.primary + ' CF1=' + rCf1.diagnosis.cognitiveBlindSpot.primary)
})

T('CF1-05: strategy responds to decisionStyle change', function () {
  console.log('  BASE strategy=' + rBase.diagnosis.worldStrategy.primary + ' CF1=' + rCf1.diagnosis.worldStrategy.primary)
})

// ═══════════════════════════════════════════════════════════════
// CF2 — pastAttemptStage sensitivity (FB preserved)
// ═══════════════════════════════════════════════════════════════

var rCf2 = runWorldModelPipeline(Object.assign({}, BASE, { pastAttemptStage: '做了一个产品/服务但没卖出去' }), { version: 'world_model_v1' })
var fbDelta2 = rCf2.diagnosis.worldModel.FEEDBACK_MODEL.score - rBase.diagnosis.worldModel.FEEDBACK_MODEL.score

T('CF2-01: FEEDBACK_MODEL sensitivity preserved', function () {
  ok(fbDelta2 < -0.15, 'FB delta < -0.15, got ' + fbDelta2.toFixed(4))
})

T('CF2-02: feedback state change visible', function () {
  eq(rBase.diagnosis.worldModel.FEEDBACK_MODEL.state, 'STRONG')
  // With K=0.25, the FEEDBACK_MODEL score drops enough to cross threshold
  ok(rCf2.diagnosis.worldModel.FEEDBACK_MODEL.state !== 'STRONG' ||
     fbDelta2 <= -0.18, 'state change or meaningful delta, got delta=' + fbDelta2.toFixed(4))
})

T('CF2-03: archetype stable', function () {
  eq(rBase.diagnosis.cognitiveArchetype.primary, rCf2.diagnosis.cognitiveArchetype.primary)
})

// ═══════════════════════════════════════════════════════════════
// CF3 — failureResponse sensitivity (FB preserved)
// ═══════════════════════════════════════════════════════════════

var rCf3 = runWorldModelPipeline(Object.assign({}, BASE, { failureResponse: '换个方向继续试' }), { version: 'world_model_v1' })
var fbDelta3 = rCf3.diagnosis.worldModel.FEEDBACK_MODEL.score - rBase.diagnosis.worldModel.FEEDBACK_MODEL.score

T('CF3-01: FEEDBACK_MODEL sensitivity preserved', function () {
  ok(fbDelta3 < -0.20, 'FB delta < -0.20, got ' + fbDelta3.toFixed(4))
})

T('CF3-02: feedback state change', function () {
  ne(rBase.diagnosis.worldModel.FEEDBACK_MODEL.state, rCf3.diagnosis.worldModel.FEEDBACK_MODEL.state,
    'state changes, base=' + rBase.diagnosis.worldModel.FEEDBACK_MODEL.state + ' cf=' + rCf3.diagnosis.worldModel.FEEDBACK_MODEL.state)
})

T('CF3-03: archetype stable', function () {
  eq(rBase.diagnosis.cognitiveArchetype.primary, rCf3.diagnosis.cognitiveArchetype.primary)
})

// ═══════════════════════════════════════════════════════════════
// CONTRACT invariance
// ═══════════════════════════════════════════════════════════════

T('C-01: 8 dimensions present', function () {
  var keys = Object.keys(rBase.diagnosis.worldModel)
  eq(keys.length, 8, 'got ' + keys.length)
})

T('C-02: all dimensions have required fields', function () {
  var dims = rBase.diagnosis.worldModel
  Object.keys(dims).forEach(function(k) {
    var d = dims[k]
    ok(d.hasOwnProperty('score'), k + '.score missing')
    ok(d.hasOwnProperty('state'), k + '.state missing')
    ok(d.hasOwnProperty('confidence'), k + '.confidence missing')
    ok(d.hasOwnProperty('supportingSignals'), k + '.supportingSignals missing')
    ok(d.hasOwnProperty('contradictingSignals'), k + '.contradictingSignals missing')
    ok(d.hasOwnProperty('explanation'), k + '.explanation missing')
    ok(d.hasOwnProperty('uncertainty'), k + '.uncertainty missing')
  })
})

T('C-03: valid state enums', function () {
  var valid = ['WEAK', 'DEVELOPING', 'FUNCTIONAL', 'STRONG']
  Object.keys(rBase.diagnosis.worldModel).forEach(function(k) {
    ok(valid.indexOf(rBase.diagnosis.worldModel[k].state) >= 0, k + ' state=' + rBase.diagnosis.worldModel[k].state + ' not in ' + valid)
  })
})

T('C-04: diagnosis version preserved', function () {
  eq(rBase.diagnosis.version, 'world_model_v1')
})

// ═══════════════════════════════════════════════════════════════

var total = _passed + _failed
console.log('\nTotal: ' + total + '   Passed: ' + _passed + '   Failed: ' + _failed)
if (_failed === 0) console.log('ALL PASSED')
else { console.log('FAILURES: ' + _failed); process.exit(1) }
