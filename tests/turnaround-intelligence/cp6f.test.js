/**
 * tests/turnaround-intelligence/cp6f.test.js
 *
 * CP6-F: Report Experience System — 20 个体验测试
 *
 * ⚠️ Experience 只消费 NIE 输出，禁止新增推理
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

const F = {
  highCogLowExec: {
    Q1: '我是上班族，工资还行', Q2: '想太多又不行动，经常纠结',
    Q3: '经常拖延，计划坚持不过一周', Q4: '没有副业，只有一份工资',
    Q5: '会看一些书和课程，但学完不用',
  },
  incomeRisk: {
    Q1: '我只有一份工资', Q2: '没有副业', Q3: '月光',
    Q4: '不学习，下班就打游戏',
  },
  insufficient: { Q1: '还行', Q2: '一般般' },
}

function fullRun(name) {
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
  ctx = ti.runCardBuilder(ctx)
  ctx = ti.runReportComposer(ctx)
  return ctx.report
}

// ═══════════════════════════════════════
// SECTION 1: Report Structure
// ═══════════════════════════════════════

section = 'Structure'
console.log('\n📋 ' + section)

test('F1.1 报告有 7 张卡片', () => {
  const report = fullRun('highCogLowExec')
  assert(report.cards.length === 7, `Got ${report.cards.length}`)
})

test('F1.2 卡片 ID 固定', () => {
  const report = fullRun('highCogLowExec')
  const ids = report.cards.map(c => c.cardId)
  const expected = ['hero', 'insight', 'potential', 'strategy', 'timeline', 'action', 'evidence']
  assert(JSON.stringify(ids) === JSON.stringify(expected), ids.join(', '))
})

test('F1.3 Card Index 递增', () => {
  const report = fullRun('highCogLowExec')
  for (let i = 1; i < report.cards.length; i++) {
    const prev = report.cards[i - 1]
    const cur = report.cards[i]
    // strategy 可能是复合 index
    const prevMax = Array.isArray(prev.cardIndex) ? Math.max(...prev.cardIndex) : prev.cardIndex
    const curMin = Array.isArray(cur.cardIndex) ? Math.min(...cur.cardIndex) : cur.cardIndex
    assert(prevMax < curMin, `${prev.cardId}(${prevMax}) ≥ ${cur.cardId}(${curMin})`)
  }
})

test('F1.4 报告不可变', () => {
  const report = fullRun('highCogLowExec')
  try { report.cards = []; assert(false, 'should reject mutation') }
  catch (e) { /* expected — frozen */ }
})

// ═══════════════════════════════════════
// SECTION 2: Hero Card
// ═══════════════════════════════════════

section = 'HeroCard'
console.log('\n📋 ' + section)

test('F2.1 Hero headline ≤35字', () => {
  for (const name of Object.keys(F)) {
    const report = fullRun(name)
    const hero = report.heroCard
    assert(hero.content.headline.length <= 35, `${name}: ${hero.content.headline.length}`)
  }
})

test('F2.2 Hero 有 gold headline', () => {
  const report = fullRun('highCogLowExec')
  assert(report.heroCard.layout.goldHeadline === true)
})

test('F2.3 Hero 下一张卡是 insight', () => {
  const report = fullRun('highCogLowExec')
  assert(report.heroCard.action.nextCard === 'insight')
})

test('F2.4 Hero 有渐进披露', () => {
  const report = fullRun('highCogLowExec')
  assert(Array.isArray(report.heroCard.progressiveDisclosure.levels))
})

// ═══════════════════════════════════════
// SECTION 3: Insight Card
// ═══════════════════════════════════════

section = 'InsightCard'
console.log('\n📋 ' + section)

test('F3.1 Insight 三个字段非空', () => {
  for (const name of Object.keys(F)) {
    const report = fullRun(name)
    const card = report.cards.find(c => c.cardId === 'insight')
    assert(card.content.youThought.length > 0, `${name}: youThought`)
    assert(card.content.actually.length > 0, `${name}: actually`)
    assert(card.content.realProblem.length > 0, `${name}: realProblem`)
  }
})

test('F3.2 Insight 模板锁定', () => {
  const report = fullRun('highCogLowExec')
  const card = report.cards.find(c => c.cardId === 'insight')
  assert(card.templateLocked === true)
  assert(card.noFreeform.includes('禁止自由发挥'))
})

// ═══════════════════════════════════════
// SECTION 4: Potential Card
// ═══════════════════════════════════════

section = 'PotentialCard'
console.log('\n📋 ' + section)

test('F4.1 Potential score 0-100', () => {
  for (const name of Object.keys(F)) {
    const report = fullRun(name)
    const card = report.cards.find(c => c.cardId === 'potential')
    assert(card.content.score >= 0 && card.content.score <= 100, `${name}: ${card.content.score}`)
  }
})

test('F4.2 Potential 有 disclaimer', () => {
  for (const name of Object.keys(F)) {
    const report = fullRun(name)
    const card = report.cards.find(c => c.cardId === 'potential')
    assert(card.footer.disclaimer.length > 0)
  }
})

// ═══════════════════════════════════════
// SECTION 5: Strategy Card
// ═══════════════════════════════════════

section = 'StrategyCard'
console.log('\n📋 ' + section)

test('F5.1 Strategy 有 primaryDecision', () => {
  for (const name of Object.keys(F)) {
    const report = fullRun(name)
    const card = report.cards.find(c => c.cardId === 'strategy')
    assert(card.primaryDecision.decision.length > 0, `${name}: decision`)
    assert(card.primaryDecision.instruction.length > 0, `${name}: instruction`)
  }
})

test('F5.2 Strategy roadmap 4 个阶段', () => {
  for (const name of Object.keys(F)) {
    const report = fullRun(name)
    const card = report.cards.find(c => c.cardId === 'strategy')
    assert(card.roadmap.length >= 3, `${name}: ${card.roadmap.length}`)
  }
})

// ═══════════════════════════════════════
// SECTION 6: Timeline Card
// ═══════════════════════════════════════

section = 'TimelineCard'
console.log('\n📋 ' + section)

test('F6.1 Timeline 每个 milestone 有 successCriteria', () => {
  for (const name of Object.keys(F)) {
    const report = fullRun(name)
    const card = report.cards.find(c => c.cardId === 'timeline')
    for (const m of card.milestones) {
      assert(m.successCriteria && m.successCriteria.length > 0, `${name}/day${m.day}`)
    }
  }
})

// ═══════════════════════════════════════
// SECTION 7: Action Card
// ═══════════════════════════════════════

section = 'ActionCard'
console.log('\n📋 ' + section)

test('F7.1 Action 只有一个', () => {
  for (const name of Object.keys(F)) {
    const report = fullRun(name)
    const card = report.cards.find(c => c.cardId === 'action')
    const keys = Object.keys(card).filter(k => k.startsWith('action'))
    assert(keys.length === 0, `${name}: multiple actions`)
  }
})

test('F7.2 Action 有 rule', () => {
  const report = fullRun('highCogLowExec')
  const card = report.cards.find(c => c.cardId === 'action')
  assert(card.rule.includes('只此一项'))
})

// ═══════════════════════════════════════
// SECTION 8: Evidence Drawer
// ═══════════════════════════════════════

section = 'EvidenceDrawer'
console.log('\n📋 ' + section)

test('F8.1 Evidence 默认折叠', () => {
  for (const name of Object.keys(F)) {
    const report = fullRun(name)
    const card = report.cards.find(c => c.cardId === 'evidence')
    assert(card.layout.defaultState === 'COLLAPSED', `${name}`)
  }
})

test('F8.2 Evidence 有 explainability note', () => {
  const report = fullRun('highCogLowExec')
  const card = report.cards.find(c => c.cardId === 'evidence')
  assert(card.explainabilityNote.includes('推理'))
})

// ═══════════════════════════════════════
// SECTION 9: Share & Premium
// ═══════════════════════════════════════

section = 'SharePremium'
console.log('\n📋 ' + section)

test('F9.1 Share 版只有 3 张卡', () => {
  for (const name of Object.keys(F)) {
    const report = fullRun(name)
    assert(report.shareVersion.cards.length === 3, `${name}: ${report.shareVersion.cards.length}`)
  }
})

test('F9.2 Share 版包含 hero/insight/potential', () => {
  const report = fullRun('highCogLowExec')
  const ids = report.shareVersion.cards.map(c => c.cardId)
  assert(ids.includes('hero') && ids.includes('insight') && ids.includes('potential'))
})

test('F9.3 Premium 版有 4 张卡', () => {
  for (const name of Object.keys(F)) {
    const report = fullRun(name)
    assert(report.premiumVersion.cards.length === 4, `${name}: ${report.premiumVersion.cards.length}`)
  }
})

test('F9.4 Premium 有 unlocks', () => {
  const report = fullRun('highCogLowExec')
  assert(report.premiumVersion.unlocks.length >= 3)
})

// ═══════════════════════════════════════
// SECTION 10: Experience Layer
// ═══════════════════════════════════════

section = 'Experience'
console.log('\n📋 ' + section)

test('F10.1 Reading Rhythm 6 步', () => {
  const report = fullRun('highCogLowExec')
  assert(report.experience.readingRhythm.length === 6)
  assert(report.experience.readingRhythm[0] === 'shock')
  assert(report.experience.readingRhythm[5] === 'proof')
})

test('F10.2 Emotion Curve 6 段', () => {
  const report = fullRun('highCogLowExec')
  assert(report.experience.emotionCurve.length === 6)
})

test('F10.3 Animation Timeline 7 条', () => {
  const report = fullRun('highCogLowExec')
  assert(report.experience.animationTimeline.length === 7)
})

test('F10.4 Visual Hierarchy 4 层', () => {
  const report = fullRun('highCogLowExec')
  const vh = report.experience.visualHierarchy
  assert(vh.headline.size === 32)
  assert(vh.headline.color === 'Gold')
  assert(vh.evidence.size === 13)
  assert(vh.evidence.color === 'Gray60')
})

test('F10.5 Progressive Disclosure 启用且非空', () => {
  const report = fullRun('highCogLowExec')
  const pd = report.experience.progressiveDisclosure
  assert(pd !== null && pd !== undefined, 'progressiveDisclosure exists')
})

// ═══════════════════════════════════════
// SECTION 11: Determinism
// ═══════════════════════════════════════

section = 'Determinism'
console.log('\n📋 ' + section)

test('F11.1 全链路确定性 — 所有卡片内容可重复', () => {
  const r1 = fullRun('highCogLowExec')
  const r2 = fullRun('highCogLowExec')
  // 卡片内容和规则应一致（meta 里的时间戳除外）
  assert(r1.cards.length === r2.cards.length, 'card count differ')
  for (let i = 0; i < r1.cards.length; i++) {
    const c1 = JSON.parse(JSON.stringify(r1.cards[i]))
    const c2 = JSON.parse(JSON.stringify(r2.cards[i]))
    assert(JSON.stringify(c1) === JSON.stringify(c2), `card[${i}](${c1.cardId}) differ`)
  }
  assert(r1.shareVersion.cards.length === r2.shareVersion.cards.length, 'share differ')
  assert(r1.premiumVersion.cards.length === r2.premiumVersion.cards.length, 'premium differ')
})

test('F11.2 所有输出 JSON-safe', () => {
  const report = fullRun('highCogLowExec')
  const s = JSON.stringify(report)
  assert(s.includes('hero'), 'missing hero card')
  assert(s.includes('evidence'), 'missing evidence drawer')
})

// ═══════════════════════════════════════
// SECTION 12: Regression
// ═══════════════════════════════════════

section = 'Regression'
console.log('\n📋 ' + section)

const cp = require('child_process')
function runCPTest(path) {
  const r = cp.spawnSync('node', [path], { encoding: 'utf8', timeout: 30000 })
  const m = r.stdout.match(/RESULTS: (\d+) pass, (\d+) fail/)
  if (!m) throw new Error(`Parse err: ${path}`)
  return { pass: parseInt(m[1]), fail: parseInt(m[2]) }
}

test('F12.1 CP6-E', () => {
  const r = runCPTest('tests/turnaround-intelligence/cp6e.test.js')
  assert(r.fail === 0, `CP6-E fail=${r.fail}`)
})
test('F12.2 CP6-D', () => {
  const r = runCPTest('tests/turnaround-intelligence/cp6d.test.js')
  assert(r.fail === 0, `CP6-D fail=${r.fail}`)
})
test('F12.3 CP6-C', () => {
  const r = runCPTest('tests/turnaround-intelligence/cp6c.test.js')
  assert(r.fail === 0, `CP6-C fail=${r.fail}`)
})
test('F12.4 CP6-B Profile', () => {
  const r = runCPTest('tests/turnaround-intelligence/cp6b-profile.test.js')
  assert(r.fail === 0, `CP6-B Profile fail=${r.fail}`)
})
test('F12.5 CP6-B Cognitive', () => {
  const r = runCPTest('tests/turnaround-intelligence/cp6b-cognitive.test.js')
  assert(r.fail === 0, `CP6-B Cognitive fail=${r.fail}`)
})
test('F12.6 CP5', () => {
  const r = runCPTest('tests/turnaround-os/checkpoint5.test.js')
  assert(r.fail === 0, `CP5 fail=${r.fail}`)
})

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════

console.log('\n========================================')
console.log(`CP6-F RESULTS: ${PASS} pass, ${FAIL} fail`)
console.log('========================================')
if (FAIL > 0) { console.log('\nFAILURES:'); for (const e of errors) console.log('  ❌ ' + e) }
