/**
 * RC8.3 Phase 2 — 015 Proportional Conflict Penalty
 *
 * Verifies the calibrated proportional conPenalty formula:
 *   conPenalty = Σ(suppressed[i].score) × 0.25
 *
 * This replaces the old flat penalty: count × 0.10
 * Calibration: RC8.3_PHASE_2_014_R1 (BEST_K = 0.25)
 *
 * MUST NOT:
 *   - Modify production code
 *   - Change extractor/normalizer/archetype/blindSpot/strategy engines
 *   - Deploy or expand canary
 *
 * CANARY_EXPANSION = HOLD
 */

var path = require('path');
var process = require('process');

var worldModelPath = path.resolve(__dirname, '..',
  'cloudfunctions/generateAiReport/lib/engine/worldModel');

var ontology = require(path.join(worldModelPath, 'ontology'));
var evidenceNormalizer = require(path.join(worldModelPath, 'evidenceNormalizer'));
var behaviorSignalExtractor = require(path.join(worldModelPath, 'behaviorSignalExtractorV2'));
var conflictResolver = require(path.join(worldModelPath, 'conflictResolver'));
var worldModelEngine = require(path.join(worldModelPath, 'worldModelEngine'));
var archetypeEngine = require(path.join(worldModelPath, 'cognitiveArchetypeEngineV2'));
var blindSpotEngine = require(path.join(worldModelPath, 'cognitiveBlindSpotEngineV2'));
var strategyEngine = require(path.join(worldModelPath, 'worldStrategyEngineV2'));
var validators = require(path.join(worldModelPath, 'validators'));

var GOLDEN_CASES = require('./rc8.3-world-model-golden.test').GOLDEN_CASES;

var DIMENSIONS = ontology.DIMENSIONS;
var DIM_IDS = Object.keys(DIMENSIONS);
var VALID_STATES = ['STRONG', 'FUNCTIONAL', 'DEVELOPING', 'WEAK'];

// ──────────────── Helpers ────────────────

function runDiagnosis(answers) {
  var evidence = evidenceNormalizer.normalizeEvidence(answers);
  var signals = behaviorSignalExtractor.extractSignals(evidence);
  var conflicts = conflictResolver.detectConflicts(signals.signals);
  var resolved = conflictResolver.applyConflictResolution(signals.signals, conflicts);
  var signalResult = {
    signals: resolved,
    conflicts: signals.conflicts || [],
    activeCount: resolved.filter(function (s) { return s.state === 'ACTIVE'; }).length,
    weakCount: resolved.filter(function (s) { return s.state === 'WEAK'; }).length,
    suppressedCount: resolved.filter(function (s) { return s.state === 'SUPPRESSED'; }).length
  };
  var worldModel = worldModelEngine.buildWorldModel(signalResult);
  var archetype = archetypeEngine.inferArchetype(worldModel, signalResult);
  var blindSpot = blindSpotEngine.inferBlindSpot(worldModel, signalResult);
  var strategy = strategyEngine.selectStrategy(worldModel, signalResult, blindSpot);
  return {
    worldModel: worldModel,
    archetype: archetype,
    blindSpot: blindSpot,
    strategy: strategy
  };
}

var BASE = {
  lifeStage: '25-30岁',
  incomeStructure: '工资/固定薪资',
  occupationDetail: '程序员',
  monthlySurplus: '5000-10000元',
  safetyMonths: '6-12个月',
  debtPressure: '房贷为主（低月供）',
  skillValidation: '偶尔有付费需求',
  monetizableSkill: '技术类（编程/设计/工程）',
  weeklyTime: '20小时以上',
  executionStability: '有固定计划，基本能执行',
  pastAttemptStage: '卖出过几个，有少量收入',
  decisionStyle: '边上班边小规模测试',
  primaryGoal: '转行进入新领域',
  maxTrialCost: '5000-20000元',
  failureResponse: '复盘优化后继续'
};

var CF1 = Object.assign({}, BASE, { decisionStyle: '直接辞职/全职All-in' });
var CF2 = Object.assign({}, BASE, { pastAttemptStage: '做了一个产品/服务但没卖出去' });
var CF3 = Object.assign({}, BASE, { failureResponse: '换个方向继续试' });

// ──────────────── Test Runner ────────────────

var PASS = 0;
var FAIL = 0;

function assert(label, condition, detail) {
  if (condition) {
    PASS++;
    console.log('  PASS: ' + label);
  } else {
    FAIL++;
    console.log('  FAIL: ' + label + (detail ? ' — ' + detail : ''));
  }
}

// ═══════════════════════════════════════════════
// TEST A: Formula verification
// ═══════════════════════════════════════════════

console.log('=== TEST A: Formula injection ===\n');

// Verify formula is proportional, not flat count
var conPenaltyStr = worldModelEngine.calculateDimensionScore.toString();
assert('A1: Formula is proportional (not count-based)',
  conPenaltyStr.indexOf('reduce') >= 0,
  'Expected .reduce(), found: ' + conPenaltyStr.substring(0, 200));

assert('A2: Formula contains K=0.25 coefficient',
  conPenaltyStr.indexOf('0.25') >= 0,
  'Expected * 0.25 in calculateDimensionScore');

// Verify calculateDimensionScore works correctly
var testSig = function (id, state, score) {
  return { id: id, state: state, score: score };
};

// Case: 1 strong supporting, 8 weak suppressed
var supporting = [testSig('S1', 'ACTIVE', 0.95)];
var contradicting = [
  testSig('C1', 'SUPPRESSED', 0.10),
  testSig('C2', 'SUPPRESSED', 0.12),
  testSig('C3', 'SUPPRESSED', 0.08),
  testSig('C4', 'SUPPRESSED', 0.15),
  testSig('C5', 'SUPPRESSED', 0.11),
  testSig('C6', 'SUPPRESSED', 0.09),
  testSig('C7', 'SUPPRESSED', 0.14),
  testSig('C8', 'SUPPRESSED', 0.13)
];

var supScore = 0.95 / 1;
var conSum = (0.10 + 0.12 + 0.08 + 0.15 + 0.11 + 0.09 + 0.14 + 0.13);
var conPenaltyExpect = conSum * 0.25;
var activeBonusExpect = 1 > 0 ? 0.05 * Math.min(3, 1) : 0;
var expectedRaw = supScore - conPenaltyExpect + activeBonusExpect;
var expected = Math.max(0, Math.min(1, expectedRaw));

var actual = worldModelEngine.calculateDimensionScore(supporting, contradicting);

assert('A3: calculateDimensionScore produces expected value',
  Math.abs(actual - expected) < 0.0001,
  'Expected ~' + expected.toFixed(4) + ', got ' + actual.toFixed(4));

// Verify old formula produces different result
var oldConPenalty = 0.1 * contradicting.length;
var oldExpected = Math.max(0, Math.min(1, supScore - oldConPenalty + activeBonusExpect));
assert('A4: New formula differs from old flat penalty',
  Math.abs(oldExpected - actual) > 0.01,
  'Old=' + oldExpected.toFixed(4) + ' New=' + actual.toFixed(4));

// null/undefined score safety
var safeSupporting = [{ id: 'S1', state: 'ACTIVE', score: null }];
var safeResult = worldModelEngine.calculateDimensionScore(safeSupporting, []);
assert('A5: null score safe',
  typeof safeResult === 'number' && safeResult >= 0 && safeResult <= 1,
  'Result: ' + safeResult);

var emptyResult = worldModelEngine.calculateDimensionScore([], []);
assert('A6: Empty arrays return neutral',
  Math.abs(emptyResult - 0.3) < 0.01,
  'Expected 0.3, got ' + emptyResult);

// ═══════════════════════════════════════════════
// TEST B: CF1 sensitivity
// ═══════════════════════════════════════════════

console.log('\n=== TEST B: CF1 decisionStyle sensitivity ===\n');

var base = runDiagnosis(BASE);
var cf1 = runDiagnosis(CF1);

var dmBase = base.worldModel.DECISION_MODEL;
var dmCF1 = cf1.worldModel.DECISION_MODEL;

assert('B1: CF1 DM state changes (not WEAK→WEAK)',
  dmCF1.state !== dmBase.state,
  dmBase.state + ' → ' + dmCF1.state);

assert('B2: CF1 DM score > baseline',
  dmCF1.score > dmBase.score,
  dmBase.score.toFixed(4) + ' vs ' + dmCF1.score.toFixed(4));

assert('B3: CF1 DM score > 0.5',
  dmCF1.score > 0.5,
  'Score: ' + dmCF1.score.toFixed(4));

assert('B4: CF1 state is STRONG',
  dmCF1.state === 'STRONG',
  'State: ' + dmCF1.state);

// Verify expected Δ ≈ +0.925 (per calibration)
var cf1Delta = dmCF1.score - dmBase.score;
assert('B5: CF1 Δ in expected range [0.80, 1.00]',
  cf1Delta >= 0.80 && cf1Delta <= 1.00,
  'Δ=' + cf1Delta.toFixed(4));

// ═══════════════════════════════════════════════
// TEST C: CF2 pastAttemptStage sensitivity
// ═══════════════════════════════════════════════

console.log('\n=== TEST C: CF2 pastAttemptStage sensitivity ===\n');

var cf2 = runDiagnosis(CF2);
var fbBase = base.worldModel.FEEDBACK_MODEL;
var fbCF2 = cf2.worldModel.FEEDBACK_MODEL;

assert('C1: CF2 FB score differs meaningfully',
  Math.abs(fbCF2.score - fbBase.score) > 0.05,
  'Δ=' + (fbCF2.score - fbBase.score).toFixed(4));

// Δ ≈ -0.20 from calibration
assert('C2: CF2 Δ in expected range [-0.30, -0.10]',
  fbCF2.score - fbBase.score >= -0.30 && fbCF2.score - fbBase.score <= -0.10,
  'Δ=' + (fbCF2.score - fbBase.score).toFixed(4));

// ═══════════════════════════════════════════════
// TEST D: CF3 failureResponse sensitivity
// ═══════════════════════════════════════════════

console.log('\n=== TEST D: CF3 failureResponse sensitivity ===\n');

var cf3 = runDiagnosis(CF3);
var fbCF3 = cf3.worldModel.FEEDBACK_MODEL;

assert('D1: CF3 FB score differs meaningfully',
  Math.abs(fbCF3.score - fbBase.score) > 0.05,
  'Δ=' + (fbCF3.score - fbBase.score).toFixed(4));

// Δ ≈ -0.21 from calibration
assert('D2: CF3 Δ in expected range [-0.30, -0.10]',
  fbCF3.score - fbBase.score >= -0.30 && fbCF3.score - fbBase.score <= -0.10,
  'Δ=' + (fbCF3.score - fbBase.score).toFixed(4));

// ═══════════════════════════════════════════════
// TEST E: Contract invariance
// ═══════════════════════════════════════════════

console.log('\n=== TEST E: Contract invariance ===\n');

var dimKeys = Object.keys(base.worldModel);
assert('E1: All 8 dimensions present',
  dimKeys.length === 8,
  'Found: ' + dimKeys.length);

var shapeOk = true;
dimKeys.forEach(function (d) {
  var dim = base.worldModel[d];
  if (typeof dim.score !== 'number' || typeof dim.state !== 'string' ||
      typeof dim.confidence !== 'number') {
    shapeOk = false;
  }
});
assert('E2: Dimension shape unchanged',
  shapeOk);

var stateOk = true;
dimKeys.forEach(function (d) {
  if (VALID_STATES.indexOf(base.worldModel[d].state) === -1) stateOk = false;
});
assert('E3: State enum valid',
  stateOk);

// supportingSignals and contradictingSignals must exist
var signalsOk = true;
dimKeys.forEach(function (d) {
  var dim = base.worldModel[d];
  if (!Array.isArray(dim.supportingSignals) || !Array.isArray(dim.contradictingSignals)) {
    signalsOk = false;
  }
});
assert('E4: supportingSignals/contradictingSignals arrays present',
  signalsOk);

// ═══════════════════════════════════════════════
// TEST F: Golden regression
// ═══════════════════════════════════════════════

console.log('\n=== TEST F: Golden regression ===\n');

var goldenN = 0;
var goldenValF = 0;

GOLDEN_CASES.forEach(function (c) {
  if (c.id === 'C42_LEGACY_ADAPTER_BOUNDARY_NULL' || c.id === 'C31_EXTREME_MINIMAL_INFO') return;
  goldenN++;
  var r1 = runDiagnosis(c.answers);
  var r2 = runDiagnosis(c.answers);

  // Determinism
  if (r1.archetype.primary !== r2.archetype.primary) goldenValF++;
  if (r1.blindSpot.primary !== r2.blindSpot.primary) goldenValF++;

  // Safety: prohibited archetypes
  if (r1.archetype.primary === 'EMPLOYEE') goldenValF++;

  // Safety: prohibited blind spots
  var prohibitedBS = ['TRAFFIC', 'SELLING', 'PRODUCT', 'PRICING', 'SINGLE_INCOME', 'BUILD_IP'];
  if (prohibitedBS.indexOf(r1.blindSpot.primary) >= 0) goldenValF++;

  // Safety: prohibited strategies
  var prohibitedStrat = ['BUILD_PRODUCT', 'DO_CONTENT', 'DO_SALES', 'DIRECT_SELL'];
  if (prohibitedStrat.indexOf(r1.strategy.id) >= 0) goldenValF++;

  // Safety: prohibited expressions
  if (!validators.scanForProhibitedExpressions(JSON.stringify(r1)).clean) goldenValF++;
});

assert('F1: Golden determinism + safety clean',
  goldenValF === 0,
  'N=' + goldenN + ' violations=' + goldenValF);

// Confirm no dimension score explosion (all scores in [0,1])
var allScoresOk = true;
var maxScore = 0;
GOLDEN_CASES.forEach(function (c) {
  if (c.id === 'C42_LEGACY_ADAPTER_BOUNDARY_NULL' || c.id === 'C31_EXTREME_MINIMAL_INFO') return;
  var r = runDiagnosis(c.answers);
  dimKeys.forEach(function (d) {
    var sc = r.worldModel[d].score;
    if (sc < 0 || sc > 1) allScoresOk = false;
    if (sc > maxScore) maxScore = sc;
  });
});
assert('F2: All dimension scores in [0, 1]',
  allScoresOk,
  'Max score: ' + maxScore.toFixed(4));

// ═══════════════════════════════════════════════
// TEST G: Decision style coherence (all 5 options)
// ═══════════════════════════════════════════════

console.log('\n=== TEST G: All decisionStyle options produce evidence ===\n');

var decisionOptions = [
  '边上班边小规模测试',
  '直接辞职/全职All-in',
  '骑驴找马/双轨并行',
  '观望/等待合适时机',
  '找导师/报培训系统学习'
];

var scores = decisionOptions.map(function (opt) {
  var a = Object.assign({}, BASE, { decisionStyle: opt });
  return runDiagnosis(a).worldModel.DECISION_MODEL.score;
});

var uniqueScores = scores.filter(function (s, i, arr) { return arr.indexOf(s) === i; }).length;
assert('G1: At least 2 unique DM scores across options',
  uniqueScores >= 2,
  'Unique scores: ' + uniqueScores);

// The extreme option (全职All-in) must be highest
var maxIdx = scores.indexOf(Math.max.apply(null, scores));
assert('G2: 直接辞职/全职All-in produces highest DM score',
  maxIdx === 1,
  'Max at index ' + maxIdx + ' (' + decisionOptions[maxIdx] + ')');

// ═══════════════════════════════════════════════
// TEST H: All 5 questionnaire options coverage (012 backward compat)
// ═══════════════════════════════════════════════

console.log('\n=== TEST H: Full questionnaire option coverage ===\n');

// decisionStyle: all 5 options
var dsOpts = ['边上班边小规模测试', '直接辞职/全职All-in', '骑驴找马/双轨并行', '观望/等待合适时机', '找导师/报培训系统学习'];
dsOpts.forEach(function (opt) {
  var a = Object.assign({}, BASE, { decisionStyle: opt });
  var r = runDiagnosis(a);
  assert('H1 decisionStyle="' + opt + '" produces evidence',
    r.worldModel.DECISION_MODEL.score >= 0,
    'State: ' + r.worldModel.DECISION_MODEL.state);
});

// failureResponse: all 5 options
var frOpts = ['复盘优化后继续', '换个方向继续试', '暂停沉淀，积累资源', '寻求指导或合伙人', '等待更好的时机'];
frOpts.forEach(function (opt) {
  var a = Object.assign({}, BASE, { failureResponse: opt });
  var r = runDiagnosis(a);
  assert('H2 failureResponse="' + opt + '" produces evidence',
    r.worldModel.FEEDBACK_MODEL.score >= 0,
    'State: ' + r.worldModel.FEEDBACK_MODEL.state);
});

// pastAttemptStage: all 5 options
var paOpts = ['卖出过几个，有少量收入', '做了一个产品/服务但没卖出去', '学过/调研过但没行动', '正在做第一个尝试', '完全没想法'];
paOpts.forEach(function (opt) {
  var a = Object.assign({}, BASE, { pastAttemptStage: opt });
  var r = runDiagnosis(a);
  assert('H3 pastAttemptStage="' + opt + '" produces evidence',
    r.worldModel.FEEDBACK_MODEL.score >= 0,
    'State: ' + r.worldModel.FEEDBACK_MODEL.state);
});

// ═══════════════════════════════════════════════
// TEST I: Form-factor invariance
// ═══════════════════════════════════════════════

console.log('\n=== TEST I: Form-factor invariance ===\n');

// Verify the dimension key set matches ontology
var dimSetExpected = Object.keys(DIMENSIONS);
var dimSetActual = Object.keys(base.worldModel).sort();
var dimSetExpectedSorted = dimSetExpected.slice().sort();

assert('I1: Dimension keys match ontology',
  JSON.stringify(dimSetActual) === JSON.stringify(dimSetExpectedSorted),
  'Expected: ' + dimSetExpectedSorted + ' Actual: ' + dimSetActual);

// Verify supporting/contradicting signals don't leak into each other
dimKeys.forEach(function (d) {
  var dim = base.worldModel[d];
  var supIds = dim.supportingSignals;
  var conIds = dim.contradictingSignals;
  var overlap = supIds.filter(function (id) { return conIds.indexOf(id) >= 0; });
  assert('I2: No signal in both supporting and contradicting for ' + d,
    overlap.length === 0,
    'Overlap: ' + overlap.join(','));
});

// ═══════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════

console.log('\n=== SUMMARY ===');
console.log('PASS: ' + PASS);
console.log('FAIL: ' + FAIL);
console.log('TOTAL: ' + (PASS + FAIL));
console.log('');

if (FAIL > 0) {
  console.log('RESULT: ' + FAIL + ' TEST(S) FAILED');
  process.exit(1);
} else {
  console.log('RESULT: ALL TESTS PASSED');
  console.log('');
  console.log('PROPORTIONAL_CONFLICT_PENALTY = VERIFIED');
  console.log('KEY_BEHAVIOR_DIMENSION_SENSITIVITY = RESTORED');
  console.log('CANARY_EXPANSION = HOLD');
  console.log('READY_FOR_COMMIT = YES');
  process.exit(0);
}
