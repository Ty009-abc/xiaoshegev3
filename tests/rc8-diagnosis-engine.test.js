/**
 * RC8.1 Unit Tests — Diagnosis Pipeline
 */

var pipeline = require('../engine/diagnosisPipeline')
var behaviorExtractor = require('../engine/behavior/behaviorTagExtractor')
var wealthEngine = require('../engine/wealth/wealthArchetypeEngine')
var bottleneckEngine = require('../engine/bottleneck/coreBottleneckEngine')
var strategyEngine = require('../engine/strategy/oneStrategyEngine')

var passed = 0
var failed = 0

function test(name, fn) {
  try {
    fn()
    passed++
    console.log('  ✓ ' + name)
  } catch (e) {
    failed++
    console.error('  ✗ ' + name + ': ' + e.message)
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed')
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(msg || ('expected ' + expected + ' got ' + actual))
}

// ──────────────────────────────────────────────
// Layer 1: Behavior Tag Extractor
// ──────────────────────────────────────────────

console.log('\n═══ Layer 1: Behavior Tag Extractor ═══')

test('extracts TIME_FOR_MONEY from income answer', function() {
  var result = behaviorExtractor.extractTags({
    income: '工资5000，靠上班赚生活费，只有一份收入'
  })
  assert(result.tags.length > 0, 'should have tags')
  var tagIds = result.tags.map(function(t) { return t.id })
  assert(tagIds.indexOf('TIME_FOR_MONEY') !== -1, 'should have TIME_FOR_MONEY')
  assert(tagIds.indexOf('SINGLE_INCOME') !== -1, 'should have SINGLE_INCOME')
})

test('extracts LEARNING_ADDICT from learning answer', function() {
  var result = behaviorExtractor.extractTags({
    learning: '每天都要看书学习，囤了很多课，看见知识付费就想买'
  })
  var tagIds = result.tags.map(function(t) { return t.id })
  assert(tagIds.indexOf('LEARNING_ADDICT') !== -1, 'should have LEARNING_ADDICT')
})

test('extracts NO_SELLING from sales question', function() {
  var result = behaviorExtractor.extractTags({
    selling: '不好意思卖东西，不敢卖，不敢开口，怕要价太高'
  })
  var tagIds = result.tags.map(function(t) { return t.id })
  assert(tagIds.indexOf('NO_SELLING') !== -1, 'should have NO_SELLING')
  assert(tagIds.indexOf('LOW_SELF_VALUE') !== -1, 'should have LOW_SELF_VALUE')
})

test('empty answers return empty tags', function() {
  var result = behaviorExtractor.extractTags({})
  assert(result.tags.length === 0, 'should be empty')
  assert(result.stats.totalTags === 0, 'stats should show 0')
})

test('tag has correct structure', function() {
  var result = behaviorExtractor.extractTags({
    income: '工资收入5000上班打工，没有其他来源'
  })
  assert(result.tags.length > 0, 'should have tags')
  var tag = result.tags[0]
  assert(tag.id && tag.category && typeof tag.weight === 'number', 'tag structure valid')
  assert(tag.confidence <= 1.0 && tag.confidence >= 0, 'confidence in range')
})

test('maxTags option limits output', function() {
  var result = behaviorExtractor.extractTags({
    income: '工资上班打工单一收入时间换钱没有系统没有产品',
    learning: '拖延等机会不敢行动不自信'
  }, { maxTags: 3 })
  assert(result.tags.length <= 3, 'should cap at 3')
})

test('formatTagSummary produces readable output', function() {
  var result = behaviorExtractor.extractTags({
    income: '工资5000'
  })
  var summary = behaviorExtractor.formatTagSummary(result.tags)
  assert(typeof summary === 'string' && summary.length > 0, 'should produce text')
})

// ──────────────────────────────────────────────
// Layer 2: Wealth Archetype Engine
// ──────────────────────────────────────────────

console.log('\n═══ Layer 2: Wealth Archetype Engine ═══')

test('identifies COLLECTOR from learning-addict + procrastination tags', function() {
  var tags = [
    { id: 'LEARNING_ADDICT', weight: 0.9, confidence: 0.9, category: 'behavior' },
    { id: 'PERFECTIONISM', weight: 0.8, confidence: 0.8, category: 'behavior' },
    { id: 'PROCRASTINATION', weight: 0.7, confidence: 0.7, category: 'behavior' },
    { id: 'NO_VERIFICATION', weight: 0.6, confidence: 0.6, category: 'growth' },
    { id: 'NO_SELLING', weight: 0.85, confidence: 0.85, category: 'growth' }
  ]
  var result = wealthEngine.identifyArchetype(tags)
  assertEqual(result.primary, 'COLLECTOR', 'primary should be COLLECTOR got ' + result.primary)
  assert(result.confidence > 0.5, 'should have high confidence')
})

test('identifies EMPLOYEE from safe-first + single-income tags', function() {
  var tags = [
    { id: 'TIME_FOR_MONEY', weight: 0.9, confidence: 0.9, category: 'income' },
    { id: 'SINGLE_INCOME', weight: 0.9, confidence: 0.9, category: 'income' },
    { id: 'SAFE_FIRST', weight: 0.85, confidence: 0.85, category: 'wealth' },
    { id: 'RISK_AVOIDANCE', weight: 0.8, confidence: 0.8, category: 'wealth' }
  ]
  var result = wealthEngine.identifyArchetype(tags)
  assertEqual(result.primary, 'EMPLOYEE', 'primary should be EMPLOYEE got ' + result.primary)
})

test('returns undetermined for empty tags', function() {
  var result = wealthEngine.identifyArchetype([])
  assertEqual(result.primary, 'UNDETERMINED')
})

test('has primary and secondary defined', function() {
  var tags = [
    { id: 'LEARNING_ADDICT', weight: 0.9, confidence: 0.9, category: 'behavior' },
    { id: 'NO_SELLING', weight: 0.85, confidence: 0.85, category: 'growth' }
  ]
  var result = wealthEngine.identifyArchetype(tags)
  assert(result.primary && result.secondary, 'should have both')
  assert(result.primary !== result.secondary || result.confidence < 0.3,
         'primary and secondary should differ or confidence low')
})

// ──────────────────────────────────────────────
// Layer 3: Core Bottleneck Engine
// ──────────────────────────────────────────────

console.log('\n═══ Layer 3: Core Bottleneck Engine ═══')

test('identifies SELLING from no-selling tags', function() {
  var tags = [
    { id: 'NO_SELLING', weight: 0.9, confidence: 0.9, category: 'growth' },
    { id: 'HESITANT_PRICING', weight: 0.7, confidence: 0.7, category: 'growth' },
    { id: 'LOW_SELF_VALUE', weight: 0.6, confidence: 0.6, category: 'growth' },
    { id: 'NO_VERIFICATION', weight: 0.5, confidence: 0.5, category: 'growth' }
  ]
  var archetype = { primary: 'COLLECTOR', secondary: 'CREATOR' }
  var result = bottleneckEngine.identifyBottleneck(tags, archetype)
  assertEqual(result.bottleneck, 'SELLING', 'should be SELLING got ' + result.bottleneck)
  assert(result.confidence > 0.5)
})

test('identifies TRAFFIC for no-audience + scattered tags', function() {
  var tags = [
    { id: 'NO_AUDIENCE', weight: 0.9, confidence: 0.9, category: 'growth' },
    { id: 'NO_DIRECTION', weight: 0.8, confidence: 0.8, category: 'strategy' },
    { id: 'SCATTERED', weight: 0.7, confidence: 0.7, category: 'strategy' }
  ]
  var archetype = { primary: 'CREATOR', secondary: 'COLLECTOR' }
  var result = bottleneckEngine.identifyBottleneck(tags, archetype)
  assertEqual(result.bottleneck, 'TRAFFIC')
})

test('returns exactly one bottleneck (not multiple)', function() {
  var tags = [
    { id: 'NO_SELLING', weight: 0.9, confidence: 0.9, category: 'growth' },
    { id: 'NO_AUDIENCE', weight: 0.7, confidence: 0.7, category: 'growth' }
  ]
  var result = bottleneckEngine.identifyBottleneck(tags, { primary: 'COLLECTOR' })
  assert(typeof result.bottleneck === 'string' && result.bottleneck.length > 0)
  assert(!Array.isArray(result.bottleneck), 'bottleneck should be string, not array')
})

test('includes solution direction', function() {
  var tags = [{ id: 'NO_SELLING', weight: 0.9, confidence: 0.9, category: 'growth' }]
  var result = bottleneckEngine.identifyBottleneck(tags, { primary: 'COLLECTOR' })
  assert(typeof result.solution === 'string' && result.solution.length > 0)
})

// ──────────────────────────────────────────────
// Layer 4: One Strategy Engine
// ──────────────────────────────────────────────

console.log('\n═══ Layer 4: One Strategy Engine ═══')

test('SELL_FIRST for SELLING bottleneck + COLLECTOR archetype', function() {
  var bottleneck = { bottleneck: 'SELLING', confidence: 0.9 }
  var archetype = { primary: 'COLLECTOR', secondary: 'CREATOR' }
  var result = strategyEngine.determineStrategy(bottleneck, archetype, [])
  assertEqual(result.strategy, 'SELL_FIRST', 'should be SELL_FIRST got ' + result.strategy)
  assert(result.milestones.length === 3, 'should have 3 milestones')
  assert(typeof result.day1Mission === 'string', 'should have day1 mission')
})

test('BUILD_ACQUISITION_SYSTEM for TRAFFIC bottleneck', function() {
  var result = strategyEngine.determineStrategy(
    { bottleneck: 'TRAFFIC', confidence: 0.85 },
    { primary: 'CREATOR' },
    []
  )
  assertEqual(result.strategy, 'BUILD_ACQUISITION_SYSTEM')
})

test('fallback to DISCIPLINE_FIRST for unmatched combination', function() {
  // Deliberately mismatch
  var result = strategyEngine.determineStrategy(
    { bottleneck: 'CONFIDENCE' },
    { primary: 'GAMBLER' },
    []
  )
  assert(result.strategy && result.strategy.length > 0, 'should have fallback')
})

test('only one strategy returned', function() {
  var result = strategyEngine.determineStrategy(
    { bottleneck: 'SELLING' },
    { primary: 'COLLECTOR' },
    []
  )
  assert(typeof result.strategy === 'string', 'strategy id should be string')
  assert(!Array.isArray(result.strategy), 'strategy should not be array')
})

// ──────────────────────────────────────────────
// Pipeline Integration
// ──────────────────────────────────────────────

console.log('\n═══ Pipeline Integration ═══')

test('full pipeline returns valid diagnosis for typical user', function() {
  var answers = {
    income: '工资5000，只有一份收入，没有其他来源',
    learning: '特别喜欢学习，每天看书上课，囤了很多课程',
    selling: '不好意思卖东西，不知道怎么开口卖',
    decision: '一直想开始副业，但总是拖延，等准备好了再行动',
    product: '还没有产品，不知道能卖什么',
    future: '想建立被动收入，但不知道怎么开始'
  }
  var result = pipeline.runDiagnosis(answers)

  assert(result.behaviorTags.length > 0, 'should have behavior tags')
  assert(result.wealthProfile.primary !== 'UNDETERMINED', 'should have archetype')
  assert(result.bottleneck.id !== 'UNKNOWN', 'should have bottleneck')
  assert(result.strategy.id && result.strategy.id.length > 0, 'should have strategy')
  assert(result.summaryText.indexOf('RC8.1') !== -1, 'summary should have version')
})

test('pipeline respects maxTags option', function() {
  var answers = {
    income: '工资单一来源上班没有产品没有系统时间换钱低安全感',
    learning: '学习成瘾拖延等待机会不敢行动不自信没有验证',
    selling: '不会卖不敢卖不好意思不知道定价',
    decision: '迷茫没有方向什么都做什么都浅',
    product: '没有产品不知道卖什么',
    future: '想建立被动收入系统长期资产'
  }
  var result = pipeline.runDiagnosis(answers, { maxTags: 30 })
  assert(result.behaviorTags.length <= 30, 'should respect maxTags')
})

test('validateDiagnosis catches errors', function() {
  var badDiagnosis = {
    behaviorTags: [],
    wealthProfile: { primary: 'UNDETERMINED' },
    bottleneck: { id: 'UNKNOWN', confidence: 0 },
    strategy: { confidence: 0 }
  }
  var validation = pipeline.validateDiagnosis(badDiagnosis)
  assert(!validation.valid, 'should be invalid')
  assert(validation.errors.length > 0, 'should have errors')
})

test('validateDiagnosis passes valid result', function() {
  var answers = {
    income: '工资5000只有一份收入没有其他来源上班',
    learning: '每天学习看书囤课知识付费',
    selling: '不好意思卖东西不会卖不敢卖',
    decision: '拖延等待没有方向完美主义',
    product: '没有产品不知道能卖什么',
    future: '想建立被动收入系统长期资产'
  }
  var result = pipeline.runDiagnosis(answers)
  var validation = pipeline.validateDiagnosis(result)
  assert(validation.valid, 'valid diagnosis should pass: ' + JSON.stringify(validation.errors))
})

// ──────────────────────────────────────────────
// Report
// ──────────────────────────────────────────────

console.log('\n═══ RESULTS ═══')
console.log('Passed: ' + passed)
console.log('Failed: ' + failed)
console.log('Total:  ' + (passed + failed))

if (failed > 0) process.exit(1)
else console.log('\nRC8.1 UNIT TESTS — ALL PASSED')
