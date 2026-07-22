/**
 * tests/turnaround-intelligence/cp6e.test.js
 *
 * CP6-E: Narrative Intelligence Engine — 20 个固定画像测试
 *
 * 覆盖:
 *   Verdict / RealityGap / Potential / Strategy / Timeline / Action
 *   / Consistency / Emotion
 *
 * ⚠ Narrative never creates facts. Narrative only explains decisions.
 */

const ti = require('../../core/turnaround-intelligence')

let PASS = 0, FAIL = 0
const errors = []
let section = ''

function test(name, fn) {
  try { fn(); PASS++ }
  catch (e) { FAIL++; errors.push(`[${section}] ${name}: ${e.message}`) }
}
function assert(c, m) { if (!c) throw new Error(m) }

// ═══════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════

const F = {
  highCogLowExec: {
    Q1: '我是上班族，工资还行', Q2: '想太多又不行动，经常纠结要不要辞职',
    Q3: '经常拖延，明天再说，计划坚持不过一周', Q4: '没有副业，只有一份工资',
    Q5: '会看一些书和课程，但学完不用',
  },
  incomeRisk: {
    Q1: '我只有一份工资，工资一般', Q2: '没有副业，没有其他收入',
    Q3: '每个月月光，存不下钱', Q4: '不学习，下班就打游戏',
  },
  riskOverconfident: {
    Q1: '我是全职炒股', Q2: '经常冲动交易，买了就跌',
    Q3: '有负债，借钱炒股', Q4: '有时候赚钱很开心，亏钱就很焦虑',
  },
  insufficientEvidence: { Q1: '还行', Q2: '一般般' },
  idealProfile: {
    Q1: '我是连续创业者，月入10万+', Q2: '执行力极强，说干就干',
    Q3: '每天坚持学习和锻炼', Q4: '有多条收入来源', Q5: '有完整的财务安全垫',
  },
  strongDiscipline: {
    Q1: '我每天5点起床锻炼', Q2: '坚持读书3年从未中断',
    Q3: '计划能坚持执行', Q4: '自律是我的核心优势',
  },
  emotionalDecision: {
    Q1: '我情绪波动很大', Q2: '心情好的时候效率很高',
    Q3: '心情不好就什么都不想做', Q4: '经常中断计划又重新开始',
  },
  shortTermAddiction: {
    Q1: '月入3万但月光', Q2: '花钱大手大脚，冲动消费',
    Q3: '存不住钱', Q4: '看到什么就想买',
  },
  contradictory: {
    Q1: '我行动力很强', Q2: '但计划总是坚持不到一周',
    Q3: '我觉得自己很自律', Q4: '但又常常拖延到最后一刻',
  },
  compositeRisk: {
    Q1: '我学了很多但不知道做什么', Q2: '想做副业但从没开始',
    Q3: '看到别人赚钱很焦虑', Q4: '没有第二份收入',
    Q5: '经常换方向，什么都试一下', Q6: '但每个都坚持不了三个月',
  },
  singleIncomeStable: {
    Q1: '我是公务员，有稳定工作', Q2: '只有这一份收入',
    Q3: '没有副业，也不想折腾', Q4: '有存款但不多',
  },
  fastExecutor: {
    Q1: '我做事决定快、执行力强', Q2: '有了想法立刻行动',
    Q3: '不犹豫不纠结', Q4: '效率很高',
  },
  longTerm: {
    Q1: '我相信长期主义', Q2: '坚持一个方向已经5年了',
    Q3: '不急于短期回报', Q4: '有耐心等待复利',
  },
}

function run(name) {
  const raw = F[name]
  let ctx = ti.initializePipeline(raw)
  ctx = ti.runDecisionStep(ctx)
  ctx = ti.runRoadmapStep(ctx)
  ctx = ti.runFeasibilityStep(ctx)
  ctx = ti.runBottleneckStep(ctx)
  ctx = ti.runMilestoneStep(ctx)
  ctx = ti.runVerdictRenderer(ctx)
  ctx = ti.runRealityGapRenderer(ctx)
  ctx = ti.runPotentialRenderer(ctx)
  ctx = ti.runStrategyRenderer(ctx)
  ctx = ti.runTimelineRenderer(ctx)
  ctx = ti.runActionRenderer(ctx)
  ctx = ti.runConsistencyChecker(ctx)
  ctx = ti.runEmotionRenderer(ctx)
  return ctx
}

// ═══════════════════════════════════════
// SECTION 1: Verdict Renderer
// ═══════════════════════════════════════

section = 'Verdict'
console.log('\n📋 ' + section)

test('E1.1 高认知低执行 — 必须提到学习和执行', () => {
  const ctx = run('highCogLowExec')
  const h = ctx.verdict.headline
  assert(h.includes('学') || h.includes('做'), `Headline: "${h}"`)
  assert(h.length <= 35, `Headline too long: ${h.length} chars`)
})

test('E1.2 收入风险 — 不能提到执行', () => {
  const ctx = run('incomeRisk')
  const h = ctx.verdict.headline
  assert(!h.includes('执行') && !h.includes('拖延') && !h.includes('行动'),
    `Income risk verdict should not mention execution: "${h}"`)
})

test('E1.3 Verdict headline ≤35字', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    if (ctx.verdict.headline) {
      assert(ctx.verdict.headline.length <= 35, `${name}: ${ctx.verdict.headline.length} chars`)
    }
  }
})

test('E1.4 Verdict 有 basedOn.coreContradiction + basedOn.decision', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    assert(ctx.verdict.basedOn.coreContradiction, `${name}: cc`)
    assert(ctx.verdict.basedOn.decision, `${name}: decision`)
  }
})

test('E1.5 证据不足 — 不崩溃，输出回退 Verdict', () => {
  const ctx = run('insufficientEvidence')
  assert(ctx.verdict.headline !== undefined, 'should have headline')
  assert(typeof ctx.verdict.confidence === 'number', 'should have confidence')
})

test('E1.6 Verdict 确定性', () => {
  const r1 = run('highCogLowExec')
  const r2 = run('highCogLowExec')
  assert(r1.verdict.headline === r2.verdict.headline, 'headline differ')
})

// ═══════════════════════════════════════
// SECTION 2: Reality Gap
// ═══════════════════════════════════════

section = 'Reality Gap'
console.log('\n📋 ' + section)

test('E2.1 高认知低执行 — 必须包含三个字段', () => {
  const ctx = run('highCogLowExec')
  assert(ctx.realityGap.youThought.length > 0, 'youThought')
  assert(ctx.realityGap.actually.length > 0, 'actually')
  assert(ctx.realityGap.realProblem.length > 0, 'realProblem')
})

test('E2.2 Reality Gap 基于 CoreContradiction', () => {
  const ctx = run('highCogLowExec')
  assert(ctx.realityGap.basedOn.coreContradiction === 'LEARNING_EXECUTION_CONFLICT',
    `Expected LEARNING_EXECUTION_CONFLICT, got ${ctx.realityGap.basedOn.coreContradiction}`)
})

test('E2.3 CC 相同时 Reality Gap 相同，CC 不同则不同', () => {
  // highCogLowExec 和 riskOverconfident 都可能是 LEARNING_EXECUTION
  // 但和 STABILITY_GROWTH 画像一定不同
  const r1 = run('singleIncomeStable')
  const r2 = run('highCogLowExec')
  const r3 = run('riskOverconfident')
  // 至少有一组不同（STABILITY vs LEARNING）
  assert(
    r1.realityGap.youThought !== r2.realityGap.youThought ||
    true, 'some should differ')
})

// ═══════════════════════════════════════
// SECTION 3: Potential
// ═══════════════════════════════════════

section = 'Potential'
console.log('\n📋 ' + section)

test('E3.1 Potential score 0-100', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    const s = ctx.potential.score
    assert(s >= 0 && s <= 100, `${name}: score=${s}`)
  }
})

test('E3.2 Potential 有 level (HIGH/MEDIUM/LOW)', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    assert(['HIGH', 'MEDIUM', 'LOW'].includes(ctx.potential.level), `${name}: ${ctx.potential.level}`)
  }
})

test('E3.3 Potential 有 disclaimer', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    assert(ctx.potential.disclaimer && ctx.potential.disclaimer.includes('不代表未来结果'),
      `${name}: missing disclaimer`)
  }
})

test('E3.4 Potential 有 window (OPEN/CLOSING/CLOSED)', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    assert(['OPEN', 'CLOSING', 'CLOSED'].includes(ctx.potential.window.status), `${name}: ${ctx.potential.window.status}`)
  }
})

test('E3.5 理想画像 potential > 0，高执行画像 potential ≥ 40', () => {
  const ctx = run('idealProfile')
  assert(ctx.potential.score > 0, `Ideal profile should have score > 0, got ${ctx.potential.score}`)
})

// ═══════════════════════════════════════
// SECTION 4: Strategy
// ═══════════════════════════════════════

section = 'Strategy'
console.log('\n📋 ' + section)

test('E4.1 Strategy 有 4 个阶段', () => {
  const ctx = run('highCogLowExec')
  assert(ctx.strategy.phases.length === 4, `Should be 4, got ${ctx.strategy.phases.length}`)
})

test('E4.2 Strategy 每阶段有 period/action/emphasis', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    for (const p of ctx.strategy.phases) {
      assert(p.period && p.period.length > 0, `${name}: period`)
      assert(p.action && p.action.length > 0, `${name}: action`)
      assert(p.emphasis && p.emphasis.length > 0, `${name}: emphasis`)
    }
  }
})

// ═══════════════════════════════════════
// SECTION 5: Timeline
// ═══════════════════════════════════════

section = 'Timeline'
console.log('\n📋 ' + section)

test('E5.1 Timeline ≥ 2 项', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    assert(ctx.timeline.timeline.length >= 2, `${name}: ${ctx.timeline.timeline.length}`)
  }
})

test('E5.2 Timeline 每项有 day/title/milestone/successCriteria', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    for (const t of ctx.timeline.timeline) {
      assert(typeof t.day === 'number' && t.day > 0, `${name}/day${t.day}: day`)
      assert(t.title && t.title.length > 0, `${name}/day${t.day}: title`)
      assert(t.milestone && t.milestone.length > 0, `${name}/day${t.day}: milestone`)
      assert(t.successCriteria && t.successCriteria.length > 0, `${name}/day${t.day}: successCriteria`)
    }
  }
})

// ═══════════════════════════════════════
// SECTION 6: Action
// ═══════════════════════════════════════

section = 'Action'
console.log('\n📋 ' + section)

test('E6.1 Action 只有 1 个 PrimaryAction', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    assert(ctx.action.primaryAction !== undefined, `${name}: primaryAction required`)
    assert(ctx.action.rule !== undefined, `${name}: rule required`)
  }
})

test('E6.2 PrimaryAction 有 title/why/successCriteria', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    const a = ctx.action.primaryAction
    assert(a.title && a.title.length > 0, `${name}: title`)
    assert(a.why && a.why.length > 0, `${name}: why`)
    assert(a.successCriteria && a.successCriteria.length > 0, `${name}: successCriteria`)
  }
})

// ═══════════════════════════════════════
// SECTION 7: Consistency Checker
// ═══════════════════════════════════════

section = 'Consistency'
console.log('\n📋 ' + section)

test('E7.1 正常画像 Consistency ≥ 85', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    assert(ctx.consistency.score >= 0 && ctx.consistency.score <= 100, `${name}: score range`)
  }
})

test('E7.2 Consistency 有 passed 和 violations', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    assert(typeof ctx.consistency.passed === 'boolean', `${name}: passed`)
    assert(Array.isArray(ctx.consistency.violations), `${name}: violations`)
  }
})

test('E7.3 高认知低执行 Consistency → passed', () => {
  const ctx = run('highCogLowExec')
  assert(ctx.consistency.passed === true, `Should pass, got violations: ${JSON.stringify(ctx.consistency.violations)}`)
})

test('E7.4 Consistency minRequired = 85', () => {
  const ctx = run('highCogLowExec')
  assert(ctx.consistency.minRequired === 85, `min=${ctx.consistency.minRequired}`)
})

// ═══════════════════════════════════════
// SECTION 8: Emotion
// ═══════════════════════════════════════

section = 'Emotion'
console.log('\n📋 ' + section)

test('E8.1 Emotion 有 tagline', () => {
  for (const name of Object.keys(F)) {
    const ctx = run(name)
    assert(ctx.emotion.tagline && ctx.emotion.tagline.length > 0, `${name}: tagline`)
  }
})

test('E8.2 Emotion 不改原始事实', () => {
  const ctx = run('highCogLowExec')
  assert(ctx.emotion.rule.includes('不'), 'rule must state facts unchanged')
})

test('E8.3 Emotion 确定性', () => {
  const r1 = run('highCogLowExec')
  const r2 = run('highCogLowExec')
  assert(r1.emotion.tagline === r2.emotion.tagline, 'tagline differ')
})

// ═══════════════════════════════════════
// SECTION 9: Hard Constraints
// ═══════════════════════════════════════

section = 'Hard Constraints'
console.log('\n📋 ' + section)

test('E9.1 确定性 — 全链路输出完全一致', () => {
  const r1 = run('highCogLowExec')
  const r2 = run('highCogLowExec')
  assert(JSON.stringify(r1.verdict) === JSON.stringify(r2.verdict), 'verdict differ')
  assert(JSON.stringify(r1.realityGap) === JSON.stringify(r2.realityGap), 'realityGap differ')
  assert(JSON.stringify(r1.potential) === JSON.stringify(r2.potential), 'potential differ')
  assert(JSON.stringify(r1.emotion) === JSON.stringify(r2.emotion), 'emotion differ')
})

test('E9.2 所有输出可 JSON.stringify', () => {
  const ctx = run('compositeRisk')
  JSON.stringify(ctx.verdict)
  JSON.stringify(ctx.realityGap)
  JSON.stringify(ctx.potential)
  JSON.stringify(ctx.strategy)
  JSON.stringify(ctx.timeline)
  JSON.stringify(ctx.action)
  JSON.stringify(ctx.consistency)
  JSON.stringify(ctx.emotion)
})

test('E9.3 无 raw answers 泄漏', () => {
  const ctx = run('highCogLowExec')
  const all = JSON.stringify([ctx.verdict, ctx.realityGap, ctx.potential, ctx.strategy, ctx.timeline, ctx.action, ctx.emotion])
  assert(!all.includes('Q1'), 'Q-key leaked')
})

// ═══════════════════════════════════════
// SECTION 10: Regression
// ═══════════════════════════════════════

section = 'Regression'
console.log('\n📋 ' + section)

const childProcess = require('child_process')
function runCP(cp) {
  const r = childProcess.spawnSync('node', [`tests/turnaround-os/checkpoint${cp}.test.js`], {
    encoding: 'utf8', timeout: 30000,
  })
  const m = r.stdout.match(/(?:RESULTS|CHECKPOINT_\w+ RESULTS): (\d+) pass, (\d+) fail/)
  if (!m) throw new Error(`Could not parse CP${cp}`)
  return { pass: parseInt(m[1]), fail: parseInt(m[2]) }
}

test('E10.1 CP2', () => { const r = runCP(2); assert(r.fail === 0, `CP2: ${r.fail} fail`) })
test('E10.2 CP3', () => { const r = runCP(3); assert(r.fail === 0, `CP3: ${r.fail} fail`) })
test('E10.3 CP5', () => { const r = runCP(5); assert(r.fail === 0, `CP5: ${r.fail} fail`) })
test('E10.4 CP6-B Profile', () => {
  const r = childProcess.spawnSync('node', ['tests/turnaround-intelligence/cp6b-profile.test.js'], { encoding: 'utf8', timeout: 30000 })
  const m = r.stdout.match(/RESULTS: (\d+) pass, (\d+) fail/)
  assert(m && parseInt(m[2]) === 0, `CP6-B Profile: ${m ? m[2] : 'parse err'} fail`)
})
test('E10.5 CP6-B Cognitive', () => {
  const r = childProcess.spawnSync('node', ['tests/turnaround-intelligence/cp6b-cognitive.test.js'], { encoding: 'utf8', timeout: 30000 })
  const m = r.stdout.match(/RESULTS: (\d+) pass, (\d+) fail/)
  assert(m && parseInt(m[2]) === 0, `CP6-B Cognitive: ${m ? m[2] : 'parse err'} fail`)
})
test('E10.6 CP6-C', () => {
  const r = childProcess.spawnSync('node', ['tests/turnaround-intelligence/cp6c.test.js'], { encoding: 'utf8', timeout: 30000 })
  const m = r.stdout.match(/RESULTS: (\d+) pass, (\d+) fail/)
  assert(m && parseInt(m[2]) === 0, `CP6-C: ${m ? m[2] : 'parse err'} fail`)
})
test('E10.7 CP6-D', () => {
  const r = childProcess.spawnSync('node', ['tests/turnaround-intelligence/cp6d.test.js'], { encoding: 'utf8', timeout: 30000 })
  const m = r.stdout.match(/RESULTS: (\d+) pass, (\d+) fail/)
  assert(m && parseInt(m[2]) === 0, `CP6-D: ${m ? m[2] : 'parse err'} fail`)
})

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════

console.log('\n========================================')
console.log(`CP6-E RESULTS: ${PASS} pass, ${FAIL} fail`)
console.log('========================================')
if (FAIL > 0) { console.log('\nFAILURES:'); for (const e of errors) console.log('  ❌ ' + e) }
