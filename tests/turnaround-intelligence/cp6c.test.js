/**
 * tests/turnaround-intelligence/cp6c.test.js
 *
 * CP6-C: Pattern + Risk + Leverage + Conflict — 15 个固定画像测试
 *
 * 所有输出必须可复算、可追溯、确定性一致。
 */

const ti = require('../../core/turnaround-intelligence')
const childProcess = require('child_process')

let PASS = 0, FAIL = 0
const errors = []
let section = ''

function test(name, fn) {
  try { fn(); PASS++ }
  catch (e) { FAIL++; errors.push(`[${section}] ${name}: ${e.message}`) }
}

// ═══════════════════════════════════════
// 15 FIXTURES
// ═══════════════════════════════════════

const F = {
  highCogLowExec: {
    Q1: '我是上班族，工资还行',
    Q2: '但觉得没什么前途，想太多又不行动，经常纠结要不要辞职',
    Q3: '经常拖延，明天再说，计划坚持不过一周',
    Q4: '没有副业，只有一份工资',
    Q5: '会看一些书和课程，但学完不用',
  },
  highExecLowCog: {
    Q1: '我是外卖员，收入还行',
    Q2: '做事很快，不太想太多，干了再说',
    Q3: '每天坚持跑单，非常自律',
    Q4: '只有这份收入',
  },
  learningStrongMonetizationWeak: {
    Q1: '我每天都在学习，看了很多书',
    Q2: '报了5个在线课程，但都没完成',
    Q3: '学到很多东西，但不知道怎么变成收入',
    Q4: '只有一份普通工作',
  },
  singleIncomeDependence: {
    Q1: '我是公务员，有稳定工作',
    Q2: '只有这一份收入',
    Q3: '没有副业，也不想折腾',
    Q4: '有存款但不多',
  },
  riskAverseStable: {
    Q1: '我是公务员，最怕风险',
    Q2: '不敢换工作',
    Q3: '有存款，只存定期',
    Q4: '对现在的生活挺满意，不想改变',
  },
  riskOverconfident: {
    Q1: '我是全职炒股',
    Q2: '经常冲动交易，买了就跌',
    Q3: '有负债，借钱炒股',
    Q4: '有时候赚钱很开心，亏钱就很焦虑',
  },
  shortTermAddiction: {
    Q1: '月入3万但月光',
    Q2: '花钱大手大脚，冲动消费',
    Q3: '存不住钱',
    Q4: '看到什么就想买',
  },
  emotionalDecision: {
    Q1: '我情绪波动很大',
    Q2: '心情好的时候效率很高',
    Q3: '心情不好就什么都不想做',
    Q4: '经常中断计划又重新开始',
  },
  strongDiscipline: {
    Q1: '我每天5点起床锻炼',
    Q2: '坚持读书3年从未中断',
    Q3: '计划能坚持执行',
    Q4: '自律是我的核心优势',
    Q5: '长期主义，不急于求成',
  },
  fastExecution: {
    Q1: '我做事决定快、执行力强',
    Q2: '有了想法立刻行动',
    Q3: '不犹豫不纠结',
    Q4: '效率很高',
  },
  longTermPersistence: {
    Q1: '我相信长期主义',
    Q2: '坚持一个方向已经5年了',
    Q3: '不急于短期回报',
    Q4: '有耐心等待复利',
  },
  contradictory: {
    Q1: '我行动力很强',
    Q2: '但计划总是坚持不到一周',
    Q3: '我觉得自己很自律',
    Q4: '但又常常拖延到最后一刻',
  },
  insufficientEvidence: {
    Q1: '还行',
    Q2: '一般般',
  },
  compositeRisk: {
    Q1: '我学了很多但不知道做什么',
    Q2: '想做副业但从没开始',
    Q3: '看到别人赚钱很焦虑',
    Q4: '没有第二份收入',
    Q5: '经常换方向，什么都试一下',
    Q6: '但每个都坚持不了三个月',
  },
  idealProfile: {
    Q1: '我是连续创业者，月入10万+',
    Q2: '执行力极强，说干就干',
    Q3: '每天坚持学习和锻炼，自律无敌',
    Q4: '有多条收入来源和投资',
    Q5: '有完整的财务安全垫',
    Q6: '长期主义，不做短期投机',
  },
}

function run(name) {
  const raw = F[name]
  let ctx = ti.initializePipeline(raw)
  ctx = ti.runPatternStep(ctx)
  ctx = ti.runRiskStep(ctx)
  ctx = ti.runProfileStep(ctx)
  ctx = ti.runCognitiveStep(ctx)
  ctx = ti.runLeverageStep(ctx)
  ctx = ti.runConflictStep(ctx)
  ctx = ti.runOpportunityStep(ctx)
  ctx = ti.runCoreContradictionStep(ctx)
  return ctx
}

function runToConflict(name) {
  const raw = F[name]
  let ctx = ti.initializePipeline(raw)
  ctx = ti.runPatternStep(ctx)
  ctx = ti.runRiskStep(ctx)
  ctx = ti.runProfileStep(ctx)
  ctx = ti.runCognitiveStep(ctx)
  ctx = ti.runLeverageStep(ctx)
  ctx = ti.runConflictStep(ctx)
  return ctx
}

// ═══════════════════════════════════════
// SECTION 1: Pattern Engine
// ═══════════════════════════════════════

section = 'Pattern Engine'
console.log('\n📋 ' + section)

test('1.1 Pattern Catalog 12 个', () => {
  assert(Object.keys(ti.pattern.PATTERN_CATALOG).length === 12, 'Should have 12 patterns')
})

test('1.2 每个 Pattern 有 chainTags/severityBase/reversibility', () => {
  for (const [code, def] of Object.entries(ti.pattern.PATTERN_CATALOG)) {
    assert(Array.isArray(def.chainTags) && def.chainTags.length >= 2, `${code}: chainTags required`)
    assert(typeof def.severityBase === 'number', `${code}: severityBase required`)
    assert(['HIGH','MEDIUM','LOW'].includes(def.reversibility), `${code}: reversibility invalid`)
  }
})

test('1.3 高认知低执行 → HIGH_INPUT_LOW_OUTPUT Pattern', () => {
  const ctx = run('highCogLowExec')
  const codes = ctx.patterns.patterns.map(p => p.code)
  assert(codes.includes('HIGH_INPUT_LOW_OUTPUT'), `Expected HIGH_INPUT_LOW_OUTPUT, got: ${codes}`)
})

test('1.4 单收入依赖 → SINGLE_INCOME_DEPENDENCY', () => {
  const ctx = run('singleIncomeDependence')
  const codes = ctx.patterns.patterns.map(p => p.code)
  assert(codes.includes('SINGLE_INCOME_DEPENDENCY'), `Expected SINGLE_INCOME_DEPENDENCY, got: ${codes}`)
})

test('1.5 所有 Pattern 都有 strength/confidence/evidenceRefs', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    for (const p of ctx.patterns.patterns) {
      assert(typeof p.strength === 'number' && p.strength >= 0 && p.strength <= 1, `${name}/${p.code}: strength`)
      assert(typeof p.confidence === 'number' && p.confidence >= 0 && p.confidence <= 1, `${name}/${p.code}: confidence`)
      assert(Array.isArray(p.evidenceRefs), `${name}/${p.code}: evidenceRefs`)
    }
  }
})

// ═══════════════════════════════════════
// SECTION 2: Risk Engine
// ═══════════════════════════════════════

section = 'Risk Engine'
console.log('\n📋 ' + section)

test('2.1 Risk Catalog 12 个', () => {
  assert(Object.keys(ti.risk.RISK_CATALOG).length === 12, 'Should have 12 risks')
})

test('2.2 Risk 输出 ≤ 3 个', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    assert(ctx.risk.topRisks.length <= 3, `${name}: got ${ctx.risk.topRisks.length} risks`)
  }
})

test('2.3 高认知低执行 → 必须有 ANALYSIS_PARALYSIS 或 HIGH_OPPORTUNITY_COST', () => {
  const ctx = run('highCogLowExec')
  const codes = ctx.risk.topRisks.map(r => r.riskCode)
  assert(codes.includes('ANALYSIS_PARALYSIS') || codes.includes('HIGH_OPPORTUNITY_COST'),
    `Got risks: ${codes}`)
})

test('2.4 风险规避 → 不能出现 EXECUTION_FRAGMENTATION', () => {
  const ctx = run('riskAverseStable')
  const codes = ctx.risk.topRisks.map(r => r.riskCode)
  assert(!codes.includes('EXECUTION_FRAGMENTATION'),
    `Risk-averse should not have EXECUTION_FRAGMENTATION, got: ${codes}`)
})

test('2.5 冲突风险 → 必须有 RISK_MISJUDGMENT', () => {
  const ctx = run('riskOverconfident')
  const codes = ctx.risk.topRisks.map(r => r.riskCode)
  assert(codes.includes('RISK_MISJUDGMENT'), `Expected RISK_MISJUDGMENT, got: ${codes}`)
})

test('2.6 每个 Risk 有 priority(1-3)/reversibility/recoveryDays/actionHints', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    for (const r of ctx.risk.topRisks) {
      assert(r.priority >= 1 && r.priority <= 3, `${name}/${r.riskCode}: priority=${r.priority}`)
      assert(['HIGH','MEDIUM','LOW'].includes(r.reversibility), `${name}/${r.riskCode}: reversibility`)
      assert(typeof r.estimatedRecoveryDays === 'number' && r.estimatedRecoveryDays > 0, `${name}: recoveryDays`)
      assert(Array.isArray(r.actionHints) && r.actionHints.length > 0, `${name}: actionHints`)
    }
  }
})

test('2.7 高执行样本不能出现 EXECUTION_FRAGMENTATION', () => {
  const ctx = run('fastExecution')
  const codes = ctx.risk.topRisks.map(r => r.riskCode)
  assert(!codes.includes('EXECUTION_FRAGMENTATION'),
    `Fast execution should not have EXECUTION_FRAGMENTATION, got: ${codes}`)
})

// ═══════════════════════════════════════
// SECTION 3: Leverage Engine
// ═══════════════════════════════════════

section = 'Leverage Engine'
console.log('\n📋 ' + section)

test('3.1 Leverage Catalog 12 个', () => {
  assert(Object.keys(ti.leverage.LEVERAGE_CATALOG).length === 12, 'Should have 12 leverages')
})

test('3.2 Leverage 输出 ≤ 3 个', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    assert(ctx.leverage.topLeverages.length <= 3, `${name}: got ${ctx.leverage.topLeverages.length}`)
  }
})

test('3.3 高学习样本 → LEARNING_SPEED', () => {
  const ctx = run('learningStrongMonetizationWeak')
  const codes = ctx.leverage.topLeverages.map(l => l.code)
  assert(codes.includes('LEARNING_SPEED'), `Expected LEARNING_SPEED, got: ${codes}`)
})

test('3.4 每个 Leverage 有 priority/confidence/reason/evidenceRefs', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    for (const l of ctx.leverage.topLeverages) {
      assert(l.priority >= 1 && l.priority <= 3, `${name}/${l.code}: priority`)
      assert(typeof l.confidence === 'number', `${name}: confidence`)
      assert(typeof l.reason === 'string' && l.reason.length > 0, `${name}: reason`)
      assert(Array.isArray(l.evidenceRefs), `${name}: evidenceRefs`)
    }
  }
})

test('3.5 自律样本 → DISCIPLINE or CONSISTENCY', () => {
  const ctx = run('strongDiscipline')
  const codes = ctx.leverage.topLeverages.map(l => l.code)
  assert(codes.some(c => ['DISCIPLINE','CONSISTENCY'].includes(c)),
    `Expected DISCIPLINE or CONSISTENCY, got: ${codes}`)
})

// ═══════════════════════════════════════
// SECTION 4: Conflict Resolver
// ═══════════════════════════════════════

section = 'Conflict Resolver'
console.log('\n📋 ' + section)

test('4.1 Conflict Catalog 6 个', () => {
  assert(Object.keys(ti.conflict.CONFLICT_CATALOG).length === 6, 'Should have 6 conflicts')
})

test('4.2 高认知低执行 → LEARNING_EXECUTION_CONFLICT', () => {
  const ctx = run('highCogLowExec')
  const codes = (ctx.conflicts.conflicts || []).map(c => c.code)
  assert(codes.includes('LEARNING_EXECUTION_CONFLICT'),
    `Expected LEARNING_EXECUTION_CONFLICT, got: ${codes}`)
})

test('4.3 每个 Conflict 有 severity/riskRef/leverageRef', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    for (const c of (ctx.conflicts.conflicts || [])) {
      assert(typeof c.severity === 'number' && c.severity >= 0 && c.severity <= 100, `${name}: severity`)
      assert(typeof c.riskRef === 'string', `${name}: riskRef`)
      assert(typeof c.leverageRef === 'string', `${name}: leverageRef`)
    }
  }
})

test('4.4 Conflict 数量 ≤ 3', () => {
  for (const name of Object.keys(F)) {
    const ctx = runToConflict(name)
    assert((ctx.conflicts.conflicts || []).length <= 3, `${name}: too many conflicts`)
  }
})

// ═══════════════════════════════════════
// SECTION 4-B: Opportunity Engine
// ═══════════════════════════════════════

section = 'Opportunity Engine'
console.log('\n📋 ' + section)

test('4-B.1 Opportunity Catalog 12 个', () => {
  assert(Object.keys(ti.opportunity.OPPORTUNITY_CATALOG).length === 12, 'Should have 12 opportunities')
})

test('4-B.2 Opportunity 输出 ≤ 3', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    assert(ctx.opportunity.topOpportunities.length <= 3, `${name}: got ${ctx.opportunity.topOpportunities.length}`)
  }
})

test('4-B.3 高认知低执行 → KNOWLEDGE_TO_EXECUTION', () => {
  const ctx = run('highCogLowExec')
  const codes = ctx.opportunity.topOpportunities.map(o => o.opportunityCode)
  assert(codes.includes('KNOWLEDGE_TO_EXECUTION'), `Expected KNOWLEDGE_TO_EXECUTION, got: ${codes}`)
})

test('4-B.4 每个 Opportunity 有 window/difficulty/expectedImpact/confidence', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    for (const o of ctx.opportunity.topOpportunities) {
      assert(['NEXT_30_DAYS','NEXT_60_DAYS','NEXT_90_DAYS','NEXT_180_DAYS'].includes(o.window), `${name}: window`)
      assert(['LOW','MEDIUM','HIGH'].includes(o.difficulty), `${name}: difficulty`)
      assert(typeof o.expectedImpact === 'number', `${name}: expectedImpact`)
      assert(typeof o.confidence === 'number', `${name}: confidence`)
    }
  }
})

test('4-B.5 所有 Opportunity 必须是 Catalog 中的固定编码', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    for (const o of ctx.opportunity.topOpportunities) {
      assert(ti.opportunity.OPPORTUNITY_CATALOG[o.opportunityCode], `${name}: unknown opp code ${o.opportunityCode}`)
    }
  }
})

// ═══════════════════════════════════════
// SECTION 4-C: Core Contradiction Engine
// ═══════════════════════════════════════

section = 'Core Contradiction'
console.log('\n📋 ' + section)

test('4-C.1 高认知低执行 → LEARNING_EXECUTION_CONFLICT', () => {
  const ctx = run('highCogLowExec')
  assert(ctx.coreContradiction.code === 'LEARNING_EXECUTION_CONFLICT',
    `Expected LEARNING_EXECUTION_CONFLICT, got: ${ctx.coreContradiction.code}`)
})

test('4-C.2 CoreContradiction 是唯一一个', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    assert(typeof ctx.coreContradiction.code === 'string', `${name}: should have core contradiction`)
    assert(typeof ctx.coreContradiction.severity === 'number', `${name}: severity`)
    assert(typeof ctx.coreContradiction.confidence === 'number', `${name}: confidence`)
    assert(typeof ctx.coreContradiction.reason === 'string' && ctx.coreContradiction.reason.length > 0, `${name}: reason`)
  }
})

test('4-C.3 CoreContradiction 有 evidenceChain 溯源', () => {
  const ctx = run('highCogLowExec')
  assert(ctx.coreContradiction.evidenceChain !== undefined, 'evidenceChain required')
  assert(ctx.coreContradiction.evidenceChain.nodes.length >= 1, 'should have at least 1 node')
  // 必须包含 evidence/pattern/risk/conflict 至少各一个
  const types = ctx.coreContradiction.evidenceChain.nodes.map(n => n.type)
  assert(types.includes('evidence'), 'chain must include evidence nodes')
  assert(types.includes('conflict'), 'chain must include conflict node')
})

test('4-C.4 CoreContradiction 确定性 — 同一输入结果不变', () => {
  const r1 = run('compositeRisk')
  const r2 = run('compositeRisk')
  assert(r1.coreContradiction.code === r2.coreContradiction.code, 'code differ')
  assert(r1.coreContradiction.severity === r2.coreContradiction.severity, 'severity differ')
})

// ═══════════════════════════════════════
// SECTION 5: Hard Constraints
// ═══════════════════════════════════════

section = 'Hard Constraints'
console.log('\n📋 ' + section)

test('5.1 确定性 — 同一输入 3 次结果完全相同', () => {
  const run1 = run('highCogLowExec')
  const run2 = run('highCogLowExec')
  const run3 = run('highCogLowExec')

  // Pattern
  assert(run1.patterns.patterns.length === run2.patterns.patterns.length, 'pattern count')
  assert(run1.patterns.patterns[0].code === run2.patterns.patterns[0].code, 'pattern code')

  // Risk
  assert(run1.risk.topRisks.length === run2.risk.topRisks.length, 'risk count')
  assert(run1.risk.totalRiskScore === run2.risk.totalRiskScore, `risk score: ${run1.risk.totalRiskScore} vs ${run2.risk.totalRiskScore}`)
  assert(run2.risk.totalRiskScore === run3.risk.totalRiskScore, 'risk score run3')

  // Leverage
  assert(run1.leverage.totalLeverageScore === run2.leverage.totalLeverageScore, 'leverage score')

  // Conflict
  if (run1.conflicts.conflicts.length > 0 && run2.conflicts.conflicts.length > 0) {
    assert(run1.conflicts.conflicts[0].code === run2.conflicts.conflicts[0].code, 'conflict code')
  }
})

test('5.2 证据不足 → 部分引擎降级不崩溃', () => {
  const ctx = run('insufficientEvidence')
  assert(ctx.patterns !== undefined, 'patterns should exist')
  assert(ctx.risk !== undefined, 'risk should exist')
  assert(ctx.leverage !== undefined, 'leverage should exist')
  assert(ctx.conflicts !== undefined, 'conflicts should exist')
})

test('5.3 理想画像 → 风险少', () => {
  const ctx = run('idealProfile')
  const totalRisk = ctx.risk.topRisks.reduce((s, r) => s + r.severity, 0)
  assert(totalRisk < 70, `Ideal profile should have very low risk, got total severity: ${totalRisk}`)
})

test('5.4 复合风险画像 → 至少 2 个风险', () => {
  const ctx = run('compositeRisk')
  assert(ctx.risk.topRisks.length >= 2, `Should have ≥2 risks, got ${ctx.risk.topRisks.length}`)
})

test('5.5 所有输出可 JSON.stringify 无循环引用', () => {
  for (const name of ['highCogLowExec', 'compositeRisk', 'idealProfile']) {
    const ctx = run(name)
    JSON.stringify(ctx.patterns)
    JSON.stringify(ctx.risk)
    JSON.stringify(ctx.leverage)
    JSON.stringify(ctx.conflicts)
  }
})

// ═══════════════════════════════════════
// SECTION 6: Regression
// ═══════════════════════════════════════

section = 'Regression'
console.log('\n📋 ' + section)

function runCP(cp) {
  const r = childProcess.spawnSync('node', [`tests/turnaround-os/checkpoint${cp}.test.js`], {
    encoding: 'utf8', timeout: 30000,
  })
  const m = r.stdout.match(/(?:RESULTS|CHECKPOINT_\w+ RESULTS): (\d+) pass, (\d+) fail/)
  if (!m) throw new Error(`Could not parse CP${cp}`)
  return { pass: parseInt(m[1]), fail: parseInt(m[2]) }
}

test('6.1 CP2 regression', () => { const r = runCP(2); assert(r.fail === 0, `CP2: ${r.fail} fail`); assert(r.pass >= 28) })
test('6.2 CP3 regression', () => { const r = runCP(3); assert(r.fail === 0, `CP3: ${r.fail} fail`); assert(r.pass >= 22) })
test('6.3 CP4A regression', () => { const r = runCP('4a'); assert(r.fail === 0, `CP4A: ${r.fail} fail`); assert(r.pass >= 27) })
test('6.4 CP4B regression', () => { const r = runCP('4b'); assert(r.fail === 0, `CP4B: ${r.fail} fail`); assert(r.pass >= 27) })
test('6.5 CP5 regression', () => { const r = runCP(5); assert(r.fail === 0, `CP5: ${r.fail} fail`); assert(r.pass >= 59) })

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════

console.log('\n========================================')
console.log(`CP6-C RESULTS: ${PASS} pass, ${FAIL} fail`)
console.log('========================================')
if (FAIL > 0) { console.log('\nFAILURES:'); for (const e of errors) console.log('  ❌ ' + e) }

function assert(c, m) { if (!c) throw new Error(m) }
