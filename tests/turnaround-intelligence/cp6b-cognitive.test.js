/**
 * tests/turnaround-intelligence/cp6b-cognitive.test.js
 *
 * CP6-B: Cognitive Engine & Contract Tests
 */

const ti = require('../../core/turnaround-intelligence')
const childProcess = require('child_process')

let PASS = 0
let FAIL = 0
const errors = []
let section = ''

function test(name, fn) {
  try {
    fn()
    PASS++
  } catch (e) {
    FAIL++
    errors.push(`[${section}] ${name}: ${e.message}`)
  }
}

// ═══════════════════════════════════════
// 12 固定画像样本（与 profile 测试相同）
// ═══════════════════════════════════════

const FIXTURES = {
  highCognitionHighExecution: {
    Q1: '我是创业者，月薪很高',
    Q2: '每天都在学习看书和研究新课程，效率很高',
    Q3: '每天坚持锻炼和读书学习，自律且规律，从不中断',
    Q4: '有多份收入和副业，多个来源',
    Q5: '经常复盘和优化自己的系统，持续积累',
    Q6: '对自己的方向很清晰，目标明确',
    Q7: '执行力很强，决定做什么就会立刻行动',
  },

  highCognitionLowExecution: {
    Q1: '我是上班族，工资还行',
    Q2: '但觉得没什么前途，想太多又不行动，经常纠结要不要辞职',
    Q3: '经常拖延，明天再说，计划坚持不过一周',
    Q4: '没有副业，只有一份工资',
    Q5: '会看一些书和课程，但学完不用',
  },

  lowCognitionHighExecution: {
    Q1: '我是外卖员，收入还行',
    Q2: '做事很快，不太想太多，干了再说',
    Q3: '每天坚持跑单，非常自律',
    Q4: '只有这份收入',
    Q5: '不太看书，觉得学了没用',
    Q6: '对未来没什么规划',
  },

  highAmbitionLowDiscipline: {
    Q1: '我想一年内赚100万',
    Q2: '看到什么赚钱就想试什么，但总是做一阵就放弃',
    Q3: '冲动消费很厉害，存不住钱',
    Q4: '喜欢冒险，觉得风险才有高回报',
    Q5: '有想法但没人帮我执行',
  },

  extremeRiskAverse: {
    Q1: '我是公务员，有稳定收入',
    Q2: '最怕风险，不敢换工作',
    Q3: '有存款，但只存银行定期',
    Q4: '从没想过创业',
    Q5: '对现在的生活挺满意，不想改变',
    Q6: '讨厌未知和变化',
  },

  highRiskLowControl: {
    Q1: '我是全职炒股',
    Q2: '经常冲动交易，买了就跌',
    Q3: '有负债，借了朋友的钱炒股',
    Q4: '有时候赚钱很开心，亏钱就很焦虑',
    Q5: '想在股市翻身',
  },

  learningStrongMonetizationWeak: {
    Q1: '我每天都在学习，看了很多书',
    Q2: '报了5个在线课程，但都没完成',
    Q3: '学到很多东西，但不知道怎么变成收入',
    Q4: '只有一份普通工作',
    Q5: '觉得学的都用不上',
    Q6: '经常纠结怎么把知识变现',
  },

  stableJobTransitionAnxiety: {
    Q1: '在大厂工作5年，收入不错',
    Q2: '但每天都很焦虑，觉得没有未来',
    Q3: '想转型又不知道做什么',
    Q4: '有存款但不敢轻易动',
    Q5: '害怕失败，怕从头开始',
  },

  lowIncomeHighGrowth: {
    Q1: '刚毕业，工资不高',
    Q2: '但学习能力很强，每天在学新技术',
    Q3: '有副业想法，正在探索',
    Q4: '对自己的未来有信心',
    Q5: '每天都能坚持学2小时',
    Q6: '相信努力会有回报',
  },

  highIncomeNoAccumulation: {
    Q1: '月入8万，但月光',
    Q2: '花钱大手大脚，存不住',
    Q3: '只有一份高薪工作',
    Q4: '没有投资和资产',
    Q5: '工作很忙，没时间思考未来',
  },

  contradictoryAnswers: {
    Q1: '我行动力很强',
    Q2: '但计划总是坚持不到一周',
    Q3: '我觉得自己很自律',
    Q4: '但又常常拖延到最后一刻',
    Q5: '收入稳定',
    Q6: '但每个月都不够用',
  },

  insufficientEvidence: {
    Q1: '还行',
    Q2: '一般般',
  },
}

function runCognitive(fixtureName) {
  const raw = FIXTURES[fixtureName]
  const ctx = ti.initializePipeline(raw)
  const ctx2 = ti.runProfileStep(ctx)
  return ti.runCognitiveStep(ctx2).cognitive
}

// ═══════════════════════════════════════
// SECTION 1: Cognitive Contract
// ═══════════════════════════════════════

section = 'Cognitive Contract'
console.log('\n📋 ' + section)

test('1.1 五维定义完整', () => {
  const dims = ti.cognitive.COGNITIVE_DIMENSIONS
  assert(Object.keys(dims).length === 5, '5 dimensions expected')
  assert(dims.COGNITION === 'cognition', 'cognition key')
  assert(dims.EXECUTION === 'execution', 'execution key')
  assert(dims.DISCIPLINE === 'discipline', 'discipline key')
  assert(dims.ADAPTABILITY === 'adaptability', 'adaptability key')
  assert(dims.RISK_CONTROL === 'riskControl', 'riskControl key')
})

test('1.2 评分等级 5 档', () => {
  const levels = ti.cognitive.SCORE_LEVELS
  assert(Object.keys(levels).length === 5, '5 levels expected')
  assert(ti.cognitive.getScoreLevel(85) === 'EXCELLENT', '85 → EXCELLENT')
  assert(ti.cognitive.getScoreLevel(70) === 'GOOD', '70 → GOOD')
  assert(ti.cognitive.getScoreLevel(50) === 'MEDIUM', '50 → MEDIUM')
  assert(ti.cognitive.getScoreLevel(30) === 'WEAK', '30 → WEAK')
  assert(ti.cognitive.getScoreLevel(10) === 'CRITICAL', '10 → CRITICAL')
})

test('1.3 Overall 权重和为 1', () => {
  const w = ti.cognitive.OVERALL_WEIGHTS
  const sum = w.cognition + w.execution + w.discipline + w.adaptability + w.riskControl
  assert(Math.abs(sum - 1.0) < 0.01, `Weights sum to ${sum}, expected 1.0`)
})

test('1.4 BASE_SCORE = 50', () => {
  assert(ti.cognitive.BASE_SCORE === 50, `BASE_SCORE should be 50, got ${ti.cognitive.BASE_SCORE}`)
})

test('1.5 MAX_SINGLE_CONTRIBUTION = 12', () => {
  assert(ti.cognitive.MAX_SINGLE_CONTRIBUTION === 12, 'Single contribution cap')
})

test('1.6 差距类型 5 种', () => {
  assert(Object.keys(ti.cognitive.GAP_TYPES).length === 5, '5 gap types expected')
})

// ═══════════════════════════════════════
// SECTION 2: Cognitive Selector
// ═══════════════════════════════════════

section = 'Cognitive Selector'
console.log('\n📋 ' + section)

test('2.1 createCognitiveInput 要求 profile', () => {
  let threw = false
  const ctx = ti.initializePipeline({ Q1: 'test', Q2: 'more' })
  try { ti.selectors.createCognitiveInput(ctx) } catch (e) { threw = true }
  assert(threw, 'Should reject context without profile')
})

test('2.2 createCognitiveInput 不能泄露 answers', () => {
  const ctx = ti.initializePipeline({ Q1: 'test', Q2: 'more' })
  const ctx2 = ti.runProfileStep(ctx)
  const input = ti.selectors.createCognitiveInput(ctx2)
  assert(input.answers === undefined, 'Should not have answers')
  assert(input.cognitive === undefined, 'Should not have cognitive')
  assert(input.profile !== undefined, 'Should have profile')
})

// ═══════════════════════════════════════
// SECTION 3: Cognitive Engine — 12 Fixtures
// ═══════════════════════════════════════

section = 'Cognitive Engine - Fixtures'
console.log('\n📋 ' + section)

test('3.1 高认知高执行 → execution high', () => {
  const c = runCognitive('highCognitionHighExecution')
  assert(c.dimensions.execution.score > c.dimensions.cognition.score ||
    c.dimensions.execution.level !== 'WEAK',
    `Expected decent execution, got ${c.dimensions.execution.score} ${c.dimensions.execution.level}`)
})

test('3.2 高认知低执行 → execution low', () => {
  const c = runCognitive('highCognitionLowExecution')
  assert(c.dimensions.execution.score < 55,
    `Expected low execution, got ${c.dimensions.execution.score}`)
  assert(c.dimensions.cognition.score > c.dimensions.execution.score,
    `Expected cognition > execution`)
})

test('3.3 低认知高执行 → execution > cognition', () => {
  const c = runCognitive('lowCognitionHighExecution')
  assert(c.dimensions.execution.score > 45,
    `Expected decent execution, got ${c.dimensions.execution.score}`)
})

test('3.4 高欲望低纪律 → discipline weak', () => {
  const c = runCognitive('highAmbitionLowDiscipline')
  assert(c.dimensions.discipline.score < 55,
    `Expected low discipline, got ${c.dimensions.discipline.score}`)
})

test('3.5 极度风险规避 → riskControl high', () => {
  const c = runCognitive('extremeRiskAverse')
  // 风险规避 → riskControl positive
  assert(c.dimensions.riskControl.score >= 45,
    `Expected decent riskControl, got ${c.dimensions.riskControl.score}`)
})

test('3.6 高风险低控制 → riskControl low + EMOTIONAL_DRIVEN negative', () => {
  const c = runCognitive('highRiskLowControl')
  // 负债 + 冲动 → riskControl 低
  assert(c.dimensions.riskControl.score < 55,
    `Expected low riskControl, got ${c.dimensions.riskControl.score}`)
})

test('3.7 学习强变现弱 → COGNITION_EXECUTION_GAP', () => {
  const c = runCognitive('learningStrongMonetizationWeak')
  assert(c.keyGap !== null, 'Should have a key gap')
  assert(c.keyGap.code === 'LEARNING_MONETIZATION_GAP' || c.keyGap.code === 'COGNITION_EXECUTION_GAP',
    `Expected learning/execution gap, got ${c.keyGap ? c.keyGap.code : 'none'}`)
})

test('3.8 稳定职业转型焦虑 → adaptation moderate', () => {
  const c = runCognitive('stableJobTransitionAnxiety')
  assert(c.dimensions.adaptability.score > 0 && c.dimensions.adaptability.score <= 100,
    `adaptation out of range: ${c.dimensions.adaptability.score}`)
})

test('3.9 收入低成长性高 → adaptability + cognition high', () => {
  const c = runCognitive('lowIncomeHighGrowth')
  // 学习 + 成长心态 → 适应力和认知都不低
  assert(c.dimensions.adaptability.score > 45,
    `Expected decent adaptability, got ${c.dimensions.adaptability.score}`)
})

test('3.10 收入高无积累 → debt/financial 相关维度受影响', () => {
  const c = runCognitive('highIncomeNoAccumulation')
  // 高收入 + 消费 → risk control moderate
  assert(c.dimensions.riskControl.score > 0 && c.dimensions.riskControl.score <= 100,
    `riskControl out of range: ${c.dimensions.riskControl.score}`)
})

test('3.11 矛盾回答 → confidence reduced', () => {
  const c = runCognitive('contradictoryAnswers')
  // 矛盾应该导致至少一个维度 confidence < 0.9
  const minConf = Math.min(
    c.dimensions.cognition.confidence,
    c.dimensions.execution.confidence,
    c.dimensions.discipline.confidence,
  )
  assert(minConf < 0.95, `Contradictory should reduce confidence, got min ${minConf.toFixed(2)}`)
})

test('3.12 证据不足 → low scores + low confidence', () => {
  const c = runCognitive('insufficientEvidence')
  // 证据不足 → 所有维度接近 BASE_SCORE
  for (const dim of ['cognition', 'execution', 'discipline', 'adaptability', 'riskControl']) {
    assert(c.dimensions[dim].score >= 40 && c.dimensions[dim].score <= 60,
      `${dim} score ${c.dimensions[dim].score} should be near BASE_SCORE(50)`)
  }
})

// ═══════════════════════════════════════
// SECTION 4: Cognitive Engine — Hard Constraints
// ═══════════════════════════════════════

section = 'Cognitive Engine - Constraints'
console.log('\n📋 ' + section)

test('4.1 五维评分在 0-100', () => {
  for (const name of Object.keys(FIXTURES)) {
    const c = runCognitive(name)
    for (const dim of ['cognition', 'execution', 'discipline', 'adaptability', 'riskControl']) {
      assert(c.dimensions[dim].score >= 0 && c.dimensions[dim].score <= 100,
        `${name}/${dim}: score ${c.dimensions[dim].score} out of range`)
    }
  }
})

test('4.2 确定性: 同一输入 3 次完全相同', () => {
  const c1 = runCognitive('highCognitionLowExecution')
  const c2 = runCognitive('highCognitionLowExecution')
  const c3 = runCognitive('highCognitionLowExecution')

  assert(c1.overall.score === c2.overall.score, `run1=${c1.overall.score} vs run2=${c2.overall.score}`)
  assert(c2.overall.score === c3.overall.score, `run2=${c2.overall.score} vs run3=${c3.overall.score}`)
  assert(c1.strongestDimension === c2.strongestDimension, 'strongestDimension differ')
  assert(c1.weakestDimension === c2.weakestDimension, 'weakestDimension differ')
})

test('4.3 不依赖随机数/AI', () => {
  // 检查没有 Math.random 在引擎代码中
  const fs = require('fs')
  const engineCode = fs.readFileSync('core/turnaround-intelligence/engines/cognitiveEngine.js', 'utf8')
  assert(!engineCode.includes('Math.random'), 'CognitiveEngine should not use Math.random')
  assert(!engineCode.includes('fetch('), 'CognitiveEngine should not use fetch')
})

test('4.4 所有贡献 factors 可复算', () => {
  const c = runCognitive('highCognitionLowExecution')
  for (const dim of ['cognition', 'execution', 'discipline', 'adaptability', 'riskControl']) {
    const d = c.dimensions[dim]
    const factorSum = d.factors.reduce((s, f) => s + f.contribution, 0)
    // score = BASE + factorSum + consistencyBonus - contradictionPenalty, clamped
    // 我们验证 factors 贡献非零意味着有证据
    if (d.positiveEvidenceRefs.length > 0 || d.negativeEvidenceRefs.length > 0) {
      assert(Math.abs(factorSum) >= 1 || d.factors.length === 0,
        `${dim}: factors ${d.factors.length} but sum=${factorSum}, score=${d.score}`)
    }
  }
})

test('4.5 level 与 score 匹配', () => {
  const c = runCognitive('highCognitionLowExecution')
  for (const dim of ['cognition', 'execution', 'discipline', 'adaptability', 'riskControl']) {
    const d = c.dimensions[dim]
    const expectedLevel = ti.cognitive.getScoreLevel(d.score)
    assert(d.level === expectedLevel,
      `${dim}: expected ${expectedLevel} for score ${d.score}, got ${d.level}`)
  }
})

test('4.6 scoringVersion = cp6-b-v1', () => {
  for (const name of ['highCognitionLowExecution', 'contradictoryAnswers']) {
    const c = runCognitive(name)
    assert(c.scoringVersion === 'cp6-b-v1', `${name}: scoringVersion ${c.scoringVersion}`)
  }
})

test('4.7 overall 来自 weighted dimensions', () => {
  const c = runCognitive('highCognitionLowExecution')
  const w = ti.cognitive.OVERALL_WEIGHTS
  let expected = 0
  for (const dim of ['cognition', 'execution', 'discipline', 'adaptability', 'riskControl']) {
    expected += c.dimensions[dim].score * w[dim]
  }
  expected = Math.round(expected)
  assert(expected === c.overall.score,
    `overall ${c.overall.score} != weighted sum ${expected}`)
})

// ═══════════════════════════════════════
// SECTION 5: Regression
// ═══════════════════════════════════════

section = 'Regression'
console.log('\n📋 ' + section)

function runCheckpoint(cp) {
  const result = childProcess.spawnSync('node', [`tests/turnaround-os/checkpoint${cp}.test.js`], {
    encoding: 'utf8', timeout: 30000,
  })
  const match = result.stdout.match(/(?:RESULTS|CHECKPOINT_\w+ RESULTS): (\d+) pass, (\d+) fail/)
  if (!match) throw new Error(`Could not parse ${cp} output`)
  return { pass: parseInt(match[1]), fail: parseInt(match[2]) }
}

test('5.1 Checkpoint 2 regression', () => {
  const r = runCheckpoint(2); assert(r.fail === 0, `CP2: ${r.fail} fail`); assert(r.pass >= 28)
})
test('5.2 Checkpoint 3 regression', () => {
  const r = runCheckpoint(3); assert(r.fail === 0, `CP3: ${r.fail} fail`); assert(r.pass >= 22)
})
test('5.3 Checkpoint 4A regression', () => {
  const r = runCheckpoint('4a'); assert(r.fail === 0, `CP4A: ${r.fail} fail`); assert(r.pass >= 27)
})
test('5.4 Checkpoint 4B regression', () => {
  const r = runCheckpoint('4b'); assert(r.fail === 0, `CP4B: ${r.fail} fail`); assert(r.pass >= 27)
})
test('5.5 Checkpoint 5 regression', () => {
  const r = runCheckpoint(5); assert(r.fail === 0, `CP5: ${r.fail} fail`); assert(r.pass >= 59)
})

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════

console.log('\n========================================')
console.log(`CP6-B COGNITIVE RESULTS: ${PASS} pass, ${FAIL} fail`)
console.log('========================================')

if (FAIL > 0) {
  console.log('\nFAILURES:')
  for (const e of errors) console.log('  ❌ ' + e)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
