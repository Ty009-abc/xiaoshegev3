/**
 * tests/rc6-destiny-engine.test.js — RC6.0 Destiny Engine Tests
 *
 * 覆盖:
 * - Case A: 有技能验证，无获客系统
 * - Case B: 无技能验证，收入低，执行时间少
 * - Case C: 已有稳定客户，但交付过重
 * - Case D: 收入结构健康、执行能力高
 * - Case E: 旧版 V4/V5 报告迁移
 * - Case F: 字段全部缺失 fallback
 */

var DestinySim = require('../utils/reportDestinySimulator')
var CogVerdict = require('../utils/cognitiveVerdictBuilder')
var V6Migration = require('../utils/reportV6Migration')
var SemValidator = require('../utils/reportSemanticValidator')

var passed = 0
var failed = 0
var suite = ''

function assert(cond, msg) {
  if (cond) { passed++; return }
  failed++
  console.error('  FAIL [' + suite + ']: ' + msg)
}

function describe(name) {
  suite = name
  console.log('\n=== ' + name + ' ===')
}

function ok(msg) {
  passed++
  console.log('  ✓ ' + msg)
}

// ═══════════════════════════════════════════════════════════════
// Case A: 有技能验证，无获客系统
// ═══════════════════════════════════════════════════════════════
describe('Case A: 技能已验证，无获客系统')

var profileA = {
  skillValidationRaw: { level: 'market_validated' },
  clientAcquisitionRaw: { level: 'none' },
  productizationRaw: { level: 'none' },
  incomeStructureRaw: { level: 'single' },
  weeklyTimeRaw: { level: 'moderate' },
  skillType: 'technical',
}

var contextA = {
  scoreCard: { overall: 62, skill: 72, execution: 38, time: 45, cashflow: 55, risk: 40 },
  fatalRules: [{ id: 'R_SINGLE_INCOME', name: 'SINGLE_INCOME', title: '单一收入依赖' }],
  advantageRules: [{ title: '技能已验证' }, { title: '专业能力强' }],
  matchedRules: [],
}

var dsA = DestinySim.computeDestinySimulator(profileA, contextA)

assert(typeof dsA === 'object', 'dsA is object')
assert(dsA.currentIndex === 62, 'currentIndex=62')
assert(dsA.currentLevel === 'medium', 'level=medium')
assert(dsA.currentLevelLabel === '中等', 'levelLabel=中等')
assert(dsA.horizonDays === 365, 'horizonDays=365')
assert(dsA.repairCycleDays >= 30 && dsA.repairCycleDays <= 180, 'repairCycleDays in [30,180] (got ' + dsA.repairCycleDays + ')')
assert(dsA.baselinePath.title === '继续保持现状', 'baselinePath.title')
assert(dsA.actionPath.title === '执行翻身方案', 'actionPath.title')
assert(dsA.actionPath.projectedIndex >= dsA.currentIndex, 'projectedIndex>=currentIndex (' + dsA.actionPath.projectedIndex + '>=' + dsA.currentIndex + ')')
assert(dsA.actionPath.projectedIndex <= 92, 'projectedIndex<=92')
assert(dsA.turningPoints.length >= 3, 'turningPoints>=3')
assert(dsA.keyVariable.length > 0, 'keyVariable not empty')
assert(dsA.strengths.length > 0, 'strengths not empty')
assert(dsA.constraints.length > 0, 'constraints not empty')
assert(dsA.baselinePath.outcome !== dsA.actionPath.outcome, 'baseline and action outcomes differ')

ok('Case A: ' + passed + ' assertions OK')

// ═══════════════════════════════════════════════════════════════
// Case B: 无技能验证，收入低，执行时间少
// ═══════════════════════════════════════════════════════════════
describe('Case B: 无技能验证，收入低')

var profileB = {
  skillValidationRaw: { level: 'none' },
  clientAcquisitionRaw: { level: 'none' },
  productizationRaw: { level: 'none' },
  incomeStructureRaw: { level: 'single' },
  weeklyTimeRaw: { level: 'limited' },
  skillType: 'technical',
}

var contextB = {
  scoreCard: { overall: 28, skill: 22, execution: 25, time: 20, cashflow: 15, risk: 25 },
  fatalRules: [
    { id: 'R_LOW_SKILL', title: '技能未验证' },
    { id: 'R_SINGLE_INCOME', title: '单一收入来源' },
    { id: 'R_LOW_TIME', title: '缺少时间投入' },
  ],
  advantageRules: [],
  matchedRules: [],
}

var dsB = DestinySim.computeDestinySimulator(profileB, contextB)

assert(dsB.currentIndex === 28, 'currentIndex=28')
assert(dsB.currentLevel === 'very_low', 'level=very_low')
assert(dsB.repairCycleDays >= dsA.repairCycleDays, 'repairCycleDays >= Case A (more things to fix)')
assert(dsB.turningPoints.length === 3, 'turningPoints=3')
assert(dsB.keyVariable.indexOf('市场验证') !== -1 || dsB.keyVariable.indexOf('市场反馈') !== -1, 'keyVariable mentions market validation')

// Different profiles produce different results
assert(dsA.repairCycleDays !== dsB.repairCycleDays || dsA.currentIndex !== dsB.currentIndex,
  'Case A and B produce different results')

ok('Case B: currentIndex=' + dsB.currentIndex + ' level=' + dsB.currentLevel + ' repairDays=' + dsB.repairCycleDays)

// ═══════════════════════════════════════════════════════════════
// Case C: 已有稳定客户，但交付过重
// ═══════════════════════════════════════════════════════════════
describe('Case C: 稳定客户，交付过重')

var profileC = {
  skillValidationRaw: { level: 'stable_clients' },
  clientAcquisitionRaw: { level: 'stable' },
  productizationRaw: { level: 'partial' },
  incomeStructureRaw: { level: 'multiple' },
  weeklyTimeRaw: { level: 'busy' },
  skillType: 'content',
}

var contextC = {
  scoreCard: { overall: 68, skill: 75, execution: 55, time: 20, cashflow: 65, risk: 50 },
  fatalRules: [],
  advantageRules: [{ title: '稳定客户群' }, { title: '内容能力' }],
  matchedRules: [],
}

var dsC = DestinySim.computeDestinySimulator(profileC, contextC)

assert(dsC.currentIndex === 68, 'currentIndex=68')
assert(dsC.currentLevel === 'medium', 'level=medium')
assert(dsC.repairCycleDays >= 30 && dsC.repairCycleDays <= 180, 'repairCycleDays valid')
assert(dsC.keyVariable.length > 0, 'keyVariable exists')

// Should produce turning points of type C
assert(dsC.turningPoints[0].label.indexOf('拆分') !== -1 || dsC.turningPoints[0].label.indexOf('交付') !== -1,
  'turning points type C')

ok('Case C: currentIndex=' + dsC.currentIndex + ' repairDays=' + dsC.repairCycleDays)

// ═══════════════════════════════════════════════════════════════
// Case D: 收入结构健康、执行能力高
// ═══════════════════════════════════════════════════════════════
describe('Case D: 高执行，收入健康')

var profileD = {
  skillValidationRaw: { level: 'market_validated' },
  clientAcquisitionRaw: { level: 'growing' },
  productizationRaw: { level: 'done' },
  incomeStructureRaw: { level: 'multiple' },
  weeklyTimeRaw: { level: 'high' },
  skillType: 'technical',
}

var contextD = {
  scoreCard: { overall: 82, skill: 85, execution: 78, time: 70, cashflow: 80, risk: 55 },
  fatalRules: [],
  advantageRules: [{ title: '已验证技能' }, { title: '稳定收入' }, { title: '充足时间' }],
  matchedRules: [],
}

var dsD = DestinySim.computeDestinySimulator(profileD, contextD)

assert(dsD.currentIndex === 82, 'currentIndex=82')
assert(dsD.currentLevel === 'high', 'level=high')
// projectedIndex should not drop below current
assert(dsD.actionPath.projectedIndex >= 82, 'projectedIndex>=82')
assert(dsD.actionPath.projectedIndex <= 92, 'projectedIndex<=92')
assert(dsD.repairCycleDays <= dsA.repairCycleDays, 'repairCycleDays <= Case A (less to fix)')

ok('Case D: currentIndex=' + dsD.currentIndex + ' level=' + dsD.currentLevel + ' projected=' + dsD.actionPath.projectedIndex)

// ═══════════════════════════════════════════════════════════════
// Case E: V4/V5 Migration
// ═══════════════════════════════════════════════════════════════
describe('Case E: V4/V5 报告迁移')

var oldPotential = {
  score: 58,
  level: 'medium',
  advantages: ['技能已验证', '有一定积蓄'],
  constraints: ['单一收入', '缺少获客'],
  estimatedRecoveryDays: 120,
}

var oldReport = { scoreCard: { overall: 58 } }

var migrated = V6Migration.migratePotentialToDestinySimulator(oldPotential, oldReport)

assert(migrated.currentIndex === 58, 'migration: currentIndex=58')
assert(migrated.currentLevel === 'medium', 'migration: level=medium')
assert(migrated.repairCycleDays === 120, 'migration: repairCycleDays=120')
assert(migrated.strengths.length === 2, 'migration: 2 strengths')
assert(migrated.constraints.length === 2, 'migration: 2 constraints')
assert(migrated.baselinePath.title === '继续保持现状', 'migration: baseline title')
assert(migrated.actionPath.title === '执行翻身方案', 'migration: action title')
assert(migrated.turningPoints.length === 3, 'migration: 3 turning points')

var ensured = V6Migration.ensureV6Fields({ potential: oldPotential, scoreCard: { overall: 58 } })
assert(ensured.destinySimulator !== null, 'ensureV6Fields: destiny added')
assert(ensured.cognitiveVerdict !== null, 'ensureV6Fields: cognitive added')
assert(ensured.potential === oldPotential, 'ensureV6Fields: potential preserved')

ok('Case E: migration complete')

// ═══════════════════════════════════════════════════════════════
// Case F: 字段全部缺失
// ═══════════════════════════════════════════════════════════════
describe('Case F: 全部缺失 fallback')

var dsEmpty = DestinySim.computeDestinySimulator({}, { scoreCard: {} })

assert(typeof dsEmpty === 'object', 'Empty: is object')
assert(dsEmpty.currentIndex >= 0 && dsEmpty.currentIndex <= 100, 'Empty: currentIndex in range')
assert(dsEmpty.currentLevel.length > 0, 'Empty: level exists')
assert(dsEmpty.repairCycleDays >= 30 && dsEmpty.repairCycleDays <= 180, 'Empty: repairCycleDays valid')
assert(dsEmpty.baselinePath.systemProgress >= 5, 'Empty: baseline systemProgress')
assert(dsEmpty.actionPath.projectedIndex >= dsEmpty.currentIndex, 'Empty: projectedIndex>=currentIndex')
assert(dsEmpty.turningPoints.length >= 3, 'Empty: turningPoints>=3')
assert(dsEmpty.keyVariable.length > 0, 'Empty: keyVariable exists')

var cogV = CogVerdict.cognitiveVerdictFallback({ overallScore: 35 })
assert(cogV.statement.length > 0, 'Fallback: statement exists')
assert(cogV.explanation.length > 0, 'Fallback: explanation exists')
assert(cogV.actionAnchor.length > 0, 'Fallback: actionAnchor exists')

ok('Case F: empty fallback OK')

// ═══════════════════════════════════════════════════════════════
// Semantic Validator
// ═══════════════════════════════════════════════════════════════
describe('Semantic Validator')

// Valid poster data
var validPd = {
  verdict: { headline: '你的系统存在关键的知行缺口' },
  contradiction: { title: '学习×执行冲突', description: '输入快产出慢', leftSide: '学习', rightSide: '执行' },
  decision: { title: '建立第二收入线', reason: '单一收入风险', code: 'BUILD_SECOND_INCOME' },
  primaryAction: { title: '启动技能变现' },
  destinySimulator: dsA,
  cognitiveVerdict: CogVerdict.buildCognitiveVerdict(contextA, dsA),
}

var result = SemValidator.validatePosterSemantics(validPd)
assert(result.passed === true, 'Valid poster: passes (' + result.errors.join(',') + ')')
assert(result.errors.length === 0, 'Valid poster: 0 errors')

// Missing destiny
var noDestiny = JSON.parse(JSON.stringify(validPd))
noDestiny.destinySimulator = null
var r2 = SemValidator.validatePosterSemantics(noDestiny)
assert(r2.errors.indexOf('DESTINY_SIMULATOR_MISSING') !== -1, 'Detects DESTINY_SIMULATOR_MISSING')

// Missing cognitive
var noCog = JSON.parse(JSON.stringify(validPd))
noCog.cognitiveVerdict = null
var r3 = SemValidator.validatePosterSemantics(noCog)
assert(r3.errors.indexOf('COGNITIVE_VERDICT_MISSING') !== -1, 'Detects COGNITIVE_VERDICT_MISSING')

// Projected index < current
var badProj = JSON.parse(JSON.stringify(validPd))
badProj.destinySimulator = JSON.parse(JSON.stringify(dsA))
badProj.destinySimulator.actionPath.projectedIndex = badProj.destinySimulator.currentIndex - 1
var r4 = SemValidator.validatePosterSemantics(badProj)
assert(r4.errors.some(function(e) { return e.indexOf('DESTINY_PROJECTED_INDEX_INVALID') !== -1 }), 'Detects bad projectedIndex')

// Verdict = Decision duplicate
var dupVd = JSON.parse(JSON.stringify(validPd))
dupVd.decision.title = dupVd.verdict.headline
var r5 = SemValidator.validatePosterSemantics(dupVd)
assert(r5.errors.indexOf('VERDICT_DECISION_DUPLICATE') !== -1, 'Detects VERDICT_DECISION_DUPLICATE')

ok('Semantic Validator: all assertions OK')

// ═══════════════════════════════════════════════════════════════
// Cognitive Verdict — specific assertions
// ═══════════════════════════════════════════════════════════════
describe('Cognitive Verdict Checks')

var cvA = CogVerdict.buildCognitiveVerdict(contextA, dsA)
assert(cvA.title === '认知宣判', 'title = 认知宣判')
assert(cvA.statement.length >= 5, 'statement non-empty')
assert(cvA.explanation.length >= 5, 'explanation non-empty')
assert(cvA.actionAnchor.length >= 5, 'actionAnchor non-empty')
assert(cvA.shareQuote.length >= 5, 'shareQuote non-empty')

// No forbidden slogans
var slogans = ['相信自己', '未来可期', '坚持就是胜利', '努力终有回报', '你是最棒的', '一定会成功', '东山再起', '前程似锦']
for (var si = 0; si < slogans.length; si++) {
  var s = slogans[si]
  assert(cvA.statement.indexOf(s) === -1, 'statement has no slogan "' + s + '"')
  assert(cvA.explanation.indexOf(s) === -1, 'explanation has no slogan "' + s + '"')
}

// Different profiles → different verdicts
var cvB = CogVerdict.buildCognitiveVerdict(contextB, dsB)
assert(cvA.statement !== cvB.statement, 'Different profiles → different statements')

ok('Cognitive Verdict: all checks OK')

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════
console.log('\n========================================')
console.log('  RC6.0 Destiny Engine Test Summary')
console.log('========================================')
console.log('  Passed: ' + passed)
console.log('  Failed: ' + failed)
console.log('  Total:  ' + (passed + failed))
console.log('========================================')

if (failed > 0) {
  console.log('  ❌ TESTS FAILED')
  process.exit(1)
} else {
  console.log('  ✅ ALL TESTS PASS')
  process.exit(0)
}
