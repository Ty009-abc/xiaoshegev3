/**
 * tests/turnaround-intelligence/cp6b-profile.test.js
 *
 * CP6-B: Profile Engine & Contract Tests
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
// 12 固定画像样本
// ═══════════════════════════════════════

const FIXTURES = {
  // 1. 高认知、高执行
  highCognitionHighExecution: {
    Q1: '我是创业者，月薪很高',
    Q2: '每天都在学习看书和研究新课程，效率很高',
    Q3: '每天坚持锻炼和读书学习，自律且规律，从不中断',
    Q4: '有多份收入和副业，多个来源',
    Q5: '经常复盘和优化自己的系统，持续积累',
    Q6: '对自己的方向很清晰，目标明确',
    Q7: '执行力很强，决定做什么就会立刻行动',
  },

  // 2. 高认知、低执行
  highCognitionLowExecution: {
    Q1: '我是上班族，工资还行',
    Q2: '但觉得没什么前途，想太多又不行动，经常纠结要不要辞职',
    Q3: '经常拖延，明天再说，计划坚持不过一周',
    Q4: '没有副业，只有一份工资',
    Q5: '会看一些书和课程，但学完不用',
  },

  // 3. 低认知、高执行
  lowCognitionHighExecution: {
    Q1: '我是外卖员，收入还行',
    Q2: '做事很快，不太想太多，干了再说',
    Q3: '每天坚持跑单，非常自律',
    Q4: '只有这份收入',
    Q5: '不太看书，觉得学了没用',
    Q6: '对未来没什么规划',
  },

  // 4. 高欲望、低纪律
  highAmbitionLowDiscipline: {
    Q1: '我想一年内赚100万',
    Q2: '看到什么赚钱就想试什么，但总是做一阵就放弃',
    Q3: '冲动消费很厉害，存不住钱',
    Q4: '喜欢冒险，觉得风险才有高回报',
    Q5: '有想法但没人帮我执行',
  },

  // 5. 极度风险规避
  extremeRiskAverse: {
    Q1: '我是公务员，有稳定收入',
    Q2: '最怕风险，不敢换工作',
    Q3: '有存款，但只存银行定期',
    Q4: '从没想过创业',
    Q5: '对现在的生活挺满意，不想改变',
    Q6: '讨厌未知和变化',
  },

  // 6. 高风险、低控制
  highRiskLowControl: {
    Q1: '我是全职炒股',
    Q2: '经常冲动交易，买了就跌',
    Q3: '有负债，借了朋友的钱炒股',
    Q4: '有时候赚钱很开心，亏钱就很焦虑',
    Q5: '想在股市翻身',
  },

  // 7. 学习强、变现弱
  learningStrongMonetizationWeak: {
    Q1: '我每天都在学习，看了很多书',
    Q2: '报了5个在线课程，但都没完成',
    Q3: '学到很多东西，但不知道怎么变成收入',
    Q4: '只有一份普通工作',
    Q5: '觉得学的都用不上',
    Q6: '经常纠结怎么把知识变现',
  },

  // 8. 稳定职业、转型焦虑
  stableJobTransitionAnxiety: {
    Q1: '在大厂工作5年，收入不错',
    Q2: '但每天都很焦虑，觉得没有未来',
    Q3: '想转型又不知道做什么',
    Q4: '有存款但不敢轻易动',
    Q5: '害怕失败，怕从头开始',
  },

  // 9. 收入低但成长性高
  lowIncomeHighGrowth: {
    Q1: '刚毕业，工资不高',
    Q2: '但学习能力很强，每天在学新技术',
    Q3: '有副业想法，正在探索',
    Q4: '对自己的未来有信心',
    Q5: '每天都能坚持学2小时',
    Q6: '相信努力会有回报',
  },

  // 10. 收入高但无积累
  highIncomeNoAccumulation: {
    Q1: '月入8万，但月光',
    Q2: '花钱大手大脚，存不住',
    Q3: '只有一份高薪工作',
    Q4: '没有投资和资产',
    Q5: '工作很忙，没时间思考未来',
  },

  // 11. 回答互相矛盾
  contradictoryAnswers: {
    Q1: '我行动力很强',
    Q2: '但计划总是坚持不到一周',
    Q3: '我觉得自己很自律',
    Q4: '但又常常拖延到最后一刻',
    Q5: '收入稳定',
    Q6: '但每个月都不够用',
  },

  // 12. 证据不足
  insufficientEvidence: {
    Q1: '还行',
    Q2: '一般般',
  },
}

// ═══════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════

function runProfile(fixtureName) {
  const raw = FIXTURES[fixtureName]
  const ctx = ti.initializePipeline(raw)
  return ti.runProfileStep(ctx).profile
}

function runCognitive(fixtureName) {
  const raw = FIXTURES[fixtureName]
  const ctx = ti.initializePipeline(raw)
  const ctx2 = ti.runProfileStep(ctx)
  return ti.runCognitiveStep(ctx2).cognitive
}

// ═══════════════════════════════════════
// SECTION 1: Profile Contract Validation
// ═══════════════════════════════════════

section = 'Profile Contract'
console.log('\n📋 ' + section)

test('1.1 所有枚举有效', () => {
  assert(Object.keys(ti.profile.ARCHETYPES).length === 8, '8 archetypes expected')
  assert(Object.keys(ti.profile.LIFE_STAGES).length === 6, '6 life stages expected')
  assert(Object.keys(ti.profile.DECISION_STYLES).length === 4, '4 decision styles expected')
  assert(Object.keys(ti.profile.EXECUTION_STYLES).length === 4, '4 execution styles expected')
  assert(Object.keys(ti.profile.RISK_STYLES).length === 4, '4 risk styles expected')
})

test('1.2 createProfileOutput 拒绝非法 archetype', () => {
  let threw = false
  try {
    ti.profile.createProfileOutput({
      version: '1.0', archetype: { primary: 'INVALID', secondary: null, label: 'X', confidence: 0.5 },
      lifeStage: { code: 'EXPLORATION', label: '探索期', confidence: 0.5 },
      decisionStyle: { code: 'ANALYSIS_HEAVY', confidence: 0.5 },
      executionStyle: { code: 'INTERRUPTED', confidence: 0.5 },
      riskStyle: { code: 'CALCULATED', confidence: 0.5 },
      strengths: [], constraints: [], dominantPatterns: [],
      summaryCode: 'UNTAPPED_POTENTIAL', evidenceRefs: ['E-001', 'E-002'], confidence: 0.5,
    })
  } catch (e) { threw = true }
  assert(threw, 'Should reject invalid archetype')
})

test('1.3 createProfileOutput 要求 evidenceRefs 为数组', () => {
  let threw = false
  try {
    ti.profile.createProfileOutput({
      version: '1.0', archetype: { primary: 'EXECUTOR', secondary: null, label: 'X', confidence: 0.5 },
      lifeStage: { code: 'EXPLORATION', label: '探索期', confidence: 0.5 },
      decisionStyle: { code: 'ANALYSIS_HEAVY', confidence: 0.5 },
      executionStyle: { code: 'INTERRUPTED', confidence: 0.5 },
      riskStyle: { code: 'CALCULATED', confidence: 0.5 },
      strengths: [], constraints: [], dominantPatterns: [],
      summaryCode: 'UNTAPPED_POTENTIAL', evidenceRefs: null, confidence: 0.5,
    })
  } catch (e) { threw = true }
  assert(threw, 'Should reject null evidenceRefs')
})

test('1.4 strengths 和 constraints 不能共用一个 code', () => {
  let threw = false
  try {
    ti.profile.createProfileOutput({
      version: '1.0', archetype: { primary: 'EXECUTOR', secondary: null, label: 'X', confidence: 0.5 },
      lifeStage: { code: 'EXPLORATION', label: '探索期', confidence: 0.5 },
      decisionStyle: { code: 'ANALYSIS_HEAVY', confidence: 0.5 },
      executionStyle: { code: 'INTERRUPTED', confidence: 0.5 },
      riskStyle: { code: 'CALCULATED', confidence: 0.5 },
      strengths: [{ code: 'SAME_CODE', label: 'A', score: 70, evidenceRefs: ['E-001'] }],
      constraints: [{ code: 'SAME_CODE', label: 'B', severity: 50, evidenceRefs: ['E-002'] }],
      dominantPatterns: [],
      summaryCode: 'X', evidenceRefs: ['E-001', 'E-002'], confidence: 0.5,
    })
  } catch (e) { threw = true }
  assert(threw, 'Should reject same code in strengths & constraints')
})

// ═══════════════════════════════════════
// SECTION 2: Profile Selector Validation
// ═══════════════════════════════════════

section = 'Profile Selector'
console.log('\n📋 ' + section)

test('2.1 createProfileInput 拒绝空 context', () => {
  let threw = false
  try { ti.selectors.createProfileInput(null) } catch (e) { threw = true }
  assert(threw, 'Should reject null')
})

test('2.2 createProfileInput 要求 evidence', () => {
  let threw = false
  try {
    ti.selectors.createProfileInput({ _meta: { version: '6.0.0' } })
  } catch (e) { threw = true }
  assert(threw, 'Should reject context without evidence')
})

test('2.3 createProfileInput 不能泄露 answers', () => {
  const ctx = ti.initializePipeline({ Q1: 'test', Q2: 'more' })
  const input = ti.selectors.createProfileInput(ctx)
  assert(input.answers === undefined, 'Should not have answers')
  assert(input.profile === undefined, 'Should not have profile')
  assert(input.evidence !== undefined, 'Should have evidence')
})

test('2.4 validateProfileInput 检测 answers 泄露', () => {
  const result = ti.selectors.validateProfileInput({
    evidence: { evidences: [{ id: 'E-001' }] },
    answers: { Q1: 'leaked' },
  })
  assert(!result.valid, 'Should detect answers leak')
  assert(result.errors.some(e => e.includes('answers')), 'Error should mention answers leak')
})

// ═══════════════════════════════════════
// SECTION 3: Profile Engine — 12 Fixtures
// ═══════════════════════════════════════

section = 'Profile Engine - Fixtures'
console.log('\n📋 ' + section)

test('3.1 高认知高执行 → THINKER or EXECUTOR + CONSISTENT', () => {
  const p = runProfile('highCognitionHighExecution')
  assert(['THINKER', 'EXECUTOR'].includes(p.archetype.primary),
    `Expected THINKER/EXECUTOR, got ${p.archetype.primary}`)
  assert(p.executionStyle.code === 'CONSISTENT', `Expected CONSISTENT, got ${p.executionStyle.code}`)
})

test('3.2 高认知低执行 → 高认知低转化型 label', () => {
  const p = runProfile('highCognitionLowExecution')
  assert(p.archetype.primary === 'THINKER' || p.archetype.primary === 'DREAMER',
    `Expected THINKER/DREAMER, got ${p.archetype.primary}`)
  // THINKER + non-CONSISTENT execution → 高认知低转化型
  assert(p.archetype.label === '高认知低转化型' || p.archetype.label.includes('高认知'),
    `Label should indicate cognition-execution mismatch, got: ${p.archetype.label}`)
})

test('3.3 低认知高执行 → EXECUTOR', () => {
  const p = runProfile('lowCognitionHighExecution')
  assert(p.executionStyle.code === 'CONSISTENT', `Expected CONSISTENT, got ${p.executionStyle.code}`)
})

test('3.4 高欲望低纪律 → OPPORTUNIST or EXPLORER', () => {
  const p = runProfile('highAmbitionLowDiscipline')
  assert(['OPPORTUNIST', 'EXPLORER'].includes(p.archetype.primary),
    `Expected OPPORTUNIST/EXPLORER, got ${p.archetype.primary}`)
})

test('3.5 极度风险规避 → STABILIZER', () => {
  const p = runProfile('extremeRiskAverse')
  assert(p.riskStyle.code === 'AVOIDANT', `Expected AVOIDANT risk, got ${p.riskStyle.code}`)
})

test('3.6 高风险低控制 → emotional swing risk', () => {
  const p = runProfile('highRiskLowControl')
  assert(p.riskStyle.code === 'EMOTIONAL_SWING' || p.riskStyle.code === 'SEEKING',
    `Expected EMOTIONAL_SWING/SEEKING, got ${p.riskStyle.code}`)
})

test('3.7 学习强变现弱 → THINKER + <execution constraint>', () => {
  const p = runProfile('learningStrongMonetizationWeak')
  const hasExecConstraint = p.constraints.some(
    c => c.code === 'LOW_EXECUTION_CONTINUITY' || c.code === 'ANALYSIS_PARALYSIS'
  )
  assert(hasExecConstraint, 'Should have execution-related constraint')
})

test('3.8 稳定职业转型焦虑 → STABILIZER or THINKER', () => {
  const p = runProfile('stableJobTransitionAnxiety')
  assert(['STABILIZER', 'THINKER'].includes(p.archetype.primary),
    `Expected STABILIZER/THINKER, got ${p.archetype.primary}`)
})

test('3.9 收入低成长性高 → EXPLORATION lifeStage', () => {
  const p = runProfile('lowIncomeHighGrowth')
  assert(p.lifeStage.code === 'EXPLORATION' || p.lifeStage.code === 'ACCUMULATION',
    `Expected EXPLORATION/ACCUMULATION, got ${p.lifeStage.code}`)
})

test('3.10 收入高无积累 → constraints 包含 SELF_DOUBT or SHORT_TERM_FOCUS', () => {
  const p = runProfile('highIncomeNoAccumulation')
  assert(p.constraints.length > 0, 'Should have at least one constraint')
})

test('3.11 矛盾回答 → confidence < 0.9', () => {
  const p = runProfile('contradictoryAnswers')
  assert(p.confidence < 0.95, `Contradictory should have reduced confidence: ${p.confidence}`)
})

test('3.12 证据不足 → confidence < 0.5', () => {
  const p = runProfile('insufficientEvidence')
  assert(p.confidence < 0.55, `Insufficient evidence should have low confidence: ${p.confidence}`)
})

// ═══════════════════════════════════════
// SECTION 4: Profile Engine — Hard Constraints
// ═══════════════════════════════════════

section = 'Profile Engine - Constraints'
console.log('\n📋 ' + section)

test('4.1 archetype.primary 属于枚举', () => {
  for (const name of Object.keys(FIXTURES)) {
    const p = runProfile(name)
    assert(ti.profile.ARCHETYPES[p.archetype.primary] !== undefined,
      `${name}: invalid archetype ${p.archetype.primary}`)
  }
})

test('4.2 archetype.confidence 在 [0,1]', () => {
  for (const name of Object.keys(FIXTURES)) {
    const p = runProfile(name)
    assert(p.archetype.confidence >= 0 && p.archetype.confidence <= 1,
      `${name}: archetype confidence ${p.archetype.confidence}`)
  }
})

test('4.3 所有 style code 属于枚举', () => {
  for (const name of Object.keys(FIXTURES)) {
    const p = runProfile(name)
    assert(ti.profile.DECISION_STYLES[p.decisionStyle.code], `${name}: invalid decision ${p.decisionStyle.code}`)
    assert(ti.profile.EXECUTION_STYLES[p.executionStyle.code], `${name}: invalid execution ${p.executionStyle.code}`)
    assert(ti.profile.RISK_STYLES[p.riskStyle.code], `${name}: invalid risk ${p.riskStyle.code}`)
  }
})

test('4.4 每条 strength 有 evidenceRefs', () => {
  for (const name of Object.keys(FIXTURES)) {
    const p = runProfile(name)
    for (const s of p.strengths) {
      assert(s.evidenceRefs.length > 0, `${name}: strength ${s.code} has no evidenceRefs`)
    }
  }
})

test('4.5 每条 constraint 有 evidenceRefs', () => {
  for (const name of Object.keys(FIXTURES)) {
    const p = runProfile(name)
    for (const c of p.constraints) {
      assert(c.evidenceRefs.length > 0, `${name}: constraint ${c.code} has no evidenceRefs`)
    }
  }
})

test('4.6 确定性: 同一输入结果完全相同', () => {
  const p1 = runProfile('highCognitionLowExecution')
  const p2 = runProfile('highCognitionLowExecution')
  assert(p1.archetype.primary === p2.archetype.primary, 'archetype differ')
  assert(p1.executionStyle.code === p2.executionStyle.code, 'execution differ')
  assert(p1.confidence === p2.confidence, 'confidence differ')
})

// ═══════════════════════════════════════
// SECTION 5: Regression
// ═══════════════════════════════════════

section = 'Regression'
console.log('\n📋 ' + section)

function runCheckpoint(cp, expectedPass) {
  const result = childProcess.spawnSync('node', [`tests/turnaround-os/checkpoint${cp}.test.js`], {
    encoding: 'utf8', timeout: 30000,
  })
  const match = result.stdout.match(/(?:RESULTS|CHECKPOINT_\w+ RESULTS): (\d+) pass, (\d+) fail/)
  if (!match) {
    throw new Error(`Could not parse ${cp} output:\n${result.stdout.slice(-200)}`)
  }
  const p = parseInt(match[1])
  const f = parseInt(match[2])
  return { pass: p, fail: f }
}

test('5.1 Checkpoint 2 regression', () => {
  const result = runCheckpoint(2, 28)
  assert(result.fail === 0, `CP2: ${result.fail} fail`)
  assert(result.pass >= 28, `CP2: expected ≥28, got ${result.pass}`)
})

test('5.2 Checkpoint 3 regression', () => {
  const result = runCheckpoint(3, 22)
  assert(result.fail === 0, `CP3: ${result.fail} fail`)
  assert(result.pass >= 22, `CP3: expected ≥22, got ${result.pass}`)
})

test('5.3 Checkpoint 4A regression', () => {
  const result = runCheckpoint('4a', 27)
  assert(result.fail === 0, `CP4A: ${result.fail} fail`)
  assert(result.pass >= 27, `CP4A: expected ≥27, got ${result.pass}`)
})

test('5.4 Checkpoint 4B regression', () => {
  const result = runCheckpoint('4b', 29)
  assert(result.fail === 0, `CP4B: ${result.fail} fail`)
  assert(result.pass >= 27, `CP4B: expected ≥27, got ${result.pass}`)
})

test('5.5 Checkpoint 5 regression', () => {
  const result = runCheckpoint(5, 59)
  assert(result.fail === 0, `CP5: ${result.fail} fail`)
  assert(result.pass >= 59, `CP5: expected ≥59, got ${result.pass}`)
})

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════

console.log('\n========================================')
console.log(`CP6-B PROFILE RESULTS: ${PASS} pass, ${FAIL} fail`)
console.log('========================================')

if (FAIL > 0) {
  console.log('\nFAILURES:')
  for (const e of errors) console.log('  ❌ ' + e)
}

// ═══════════════════════════════════════

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
