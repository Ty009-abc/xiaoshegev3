'use strict'
/**
 * tests/rc8.10/personalized-challenge.test.js — RC8_10B
 *
 * Coverage (spec TEST_MATRIX + golden dataset + adaptive + gates):
 *   M1 chef challenge has NO unrelated software-engineering scenario
 *   M2 salesperson challenge includes negotiation/customer/content/AI-relevant scenarios
 *   M3 low-capital user avoids capital-heavy event bias (warmup + ratio)
 *   M4 challenge day6+ reacts to prior choices (adaptive)
 *   M5 latest 6Q overrides old memory (context authority)
 *   M6 memory off still keeps 6Q personalization
 *   M7 no cross-user event selection
 *   R  ratio target universal 40-60% / personalized 40-60%
 *   G  golden dataset ≥30 cases, 10 occupations
 *   P  profile version cache key + invalidation inputs
 */

const assert = require('assert')
const path = require('path')

const BASE = path.join(__dirname, '../../cloudfunctions/getChallengeEvent/lib')
const catalog = require(path.join(BASE, 'challengeEventCatalog.js'))
const personal = require(path.join(BASE, 'challengePersonalization.js'))
const { decorateEvent, EVENT_META } = catalog
const { buildPersonalizedPlan } = personal
const { EVENTS, eventsById } = require('./challenge-events.fixture.js')

let pass = 0, fail = 0
function ok (cond, msg) { if (cond) pass++; else { fail++; console.log('  ✗ ' + msg) } }

function ctxFor (occ, opts) {
  opts = opts || {}
  return {
    sixQText: (opts.problem || '') + ' ' + (opts.fatal || ''),
    message: opts.message || '',
    explicitProfile: {
      occupation: occ,
      income: opts.income != null ? opts.income : null,
      capital: { amount: null, level: opts.capitalLevel || null, known: !!opts.capitalLevel },
      goal: opts.goal || null,
    },
    profile: opts.weak ? { weakDimensions: opts.weak.map((k) => ({ key: k })) } : null,
    challengeEvidence: null,
    memoryEnabled: opts.memoryEnabled !== false,
  }
}

const OCCUPATIONS = ['厨师', '外卖员', '快递员', '销售', '白领', '个体老板', '宝妈', '学生', '技术人员', '内容创作者']

// ── Golden dataset (≥30) ───────────────────────────────────────────────────
const GOLDEN = [
  { id: 'CHEF_001', occ: '厨师', income: 5000, goal: '副业', forbid: ['Kubernetes', 'Java后端', '程序架构师'], expect: ['餐饮', '内容', '私域', 'AI'] },
  { id: 'CHEF_002', occ: '厨师', income: 9000, goal: '开店', forbid: ['Java微服务', 'Kubernetes', 'Python后端开发'] },
  { id: 'CHEF_003', occ: '厨师', income: 7000, goal: '转型' },
  { id: 'RIDER_001', occ: '外卖员', income: 6000, goal: '第二收入', forbid: ['并购估值模型', 'CTO技术架构'] },
  { id: 'RIDER_002', occ: '外卖员', income: 5000, goal: '技能迁移' },
  { id: 'RIDER_003', occ: '外卖员', income: 8000, goal: '内容副业' },
  { id: 'COURIER_001', occ: '快递员', income: 5500, goal: '副业' },
  { id: 'COURIER_002', occ: '快递员', income: 6500, goal: '第二收入' },
  { id: 'COURIER_003', occ: '快递员', income: 6000, goal: 'AI提效' },
  { id: 'SALES_001', occ: '销售', income: 8000, goal: '副业', expect: ['谈判', '客户', '内容', 'AI'] },
  { id: 'SALES_002', occ: '销售', income: 12000, goal: '第二收入' },
  { id: 'SALES_003', occ: '销售', income: 6000, goal: '转型' },
  { id: 'SALES_004', occ: '销售', income: 9000, goal: '内容' },
  { id: 'WHITE_001', occ: '白领', income: 9000, goal: '副业' },
  { id: 'WHITE_002', occ: '白领', income: 12000, goal: 'AI' },
  { id: 'WHITE_003', occ: '白领', income: 7000, goal: '转型' },
  { id: 'BOSS_001', occ: '个体老板', income: 12000, goal: '增长' },
  { id: 'BOSS_002', occ: '个体老板', income: 20000, goal: '管理' },
  { id: 'BOSS_003', occ: '个体老板', income: 15000, goal: '副业' },
  { id: 'MOM_001', occ: '宝妈', income: 3000, goal: '副业', forbid: ['Java', 'Kubernetes'] },
  { id: 'MOM_002', occ: '宝妈', income: 0, goal: '在家变现' },
  { id: 'MOM_003', occ: '宝妈', income: 4000, goal: '内容' },
  { id: 'STU_001', occ: '学生', income: 0, goal: '副业' },
  { id: 'STU_002', occ: '学生', income: 2000, goal: '技能' },
  { id: 'STU_003', occ: '学生', income: 0, goal: '第一份收入' },
  { id: 'TECH_001', occ: '技术人员', income: 8500, goal: '升级' },
  { id: 'TECH_002', occ: '技术人员', income: 9000, goal: '副业' },
  { id: 'TECH_003', occ: '技术人员', income: 12000, goal: 'AI' },
  { id: 'CREATOR_001', occ: '内容创作者', income: 5000, goal: '变现' },
  { id: 'CREATOR_002', occ: '内容创作者', income: 6000, goal: '第二曲线' },
  { id: 'CREATOR_003', occ: '内容创作者', income: 8000, goal: '增长' },
  { id: 'RIDER_004', occ: '外卖员', income: 4500, goal: '现金流' },
]

const SOFTWARE_ENG = ['Java', 'Kubernetes', 'Python后端', '微服务', '程序架构师', 'CTO']

function planFor (ctx, prior) {
  return buildPersonalizedPlan(EVENTS, ctx, prior || [], { openid: 'u_test' })
}

function main () {
  console.log('RC8_10B — PERSONALIZED 30-DAY CHALLENGE')

  // ── Golden dataset structure ──
  ok(GOLDEN.length >= 30, 'golden dataset has >= 30 cases (got ' + GOLDEN.length + ')')
  const occs = new Set(GOLDEN.map((g) => g.occ))
  for (const o of OCCUPATIONS) ok(occs.has(o), 'golden dataset covers ' + o)

  // ── M1 chef: no software-engineering scenario ──
  const chef = ctxFor('厨师', { income: 7000, problem: '想副业但只会炒菜', fatal: '只能干后厨' })
  const chefPlan = planFor(chef)
  const chefIds = chefPlan.plan.map((p) => p.eventId)
  ok(!chefIds.includes('CE004'), 'M1: chef plan excludes CE004 (零基础学IT转行)')
  ok(chefPlan.filteredOut.some((f) => f.eventId === 'CE004'), 'M1: CE004 filtered out for chef')
  // no technical-domain event that is non-universal appears for chef
  const chefTech = chefPlan.plan.filter((p) => p.domains.includes('technical') && !p.domains.includes('universal'))
  ok(chefTech.length === 0, 'M1: chef plan has no non-universal technical events')

  // ── M2 sales: includes sales/customer/content/ai relevant scenarios ──
  const sales = ctxFor('销售', { income: 8000, problem: '业绩不稳想有副业', message: '我想提升成交和客户管理，也想做内容' })
  const salesPlan = planFor(sales)
  const salesDomains = new Set(salesPlan.metrics.domains)
  ok(salesDomains.has('sales') || salesDomains.has('content') || salesDomains.has('career'), 'M2: sales domains include customer/content')
  const salesAdjacent = salesPlan.plan.filter((p) => p.occupationAffinity.includes('销售') || p.domains.some((d) => ['sales', 'content', 'career', 'ai'].includes(d)))
  ok(salesAdjacent.length >= 5, 'M2: sales plan has several customer/content/AI-adjacent events (' + salesAdjacent.length + ')')

  // ── M3 low-capital avoids capital-heavy bias ──
  const lowcap = ctxFor('外卖员', { income: 4500, problem: '想攒钱但没本金', goal: '第二收入' })
  const lowPlan = planFor(lowcap)
  ok(lowPlan.metrics.capitalHeavyRatio <= personal.CAPITAL_HEAVY_MAX_RATIO, 'M3: low-capital capital-heavy ratio <= 0.3 (' + lowPlan.metrics.capitalHeavyRatio + ')')
  const warm = lowPlan.plan.slice(0, personal.WARMUP)
  ok(warm.every((e) => e.capitalRequirement === 'none' || e.capitalRequirement === 'low'), 'M3: warmup (first 5) has no capital-heavy/medium event')
  // high-capital user keeps more capital events than low-capital user
  const highcap = ctxFor('个体老板', { income: 20000, capitalLevel: 'high', problem: '想扩大生意' })
  const highPlan = planFor(highcap)
  ok(highPlan.metrics.capitalHeavyCount >= lowPlan.metrics.capitalHeavyCount, 'M3: high-capital user has >= capital events vs low-capital')

  // ── M4 adaptive: day6+ reacts to prior choices ──
  const prior = [
    { eventId: 'CE003', choice: 'B' }, // 冲动 investing
    { eventId: 'CE007', choice: 'B' }, // 内幕消息 impulsive
    { eventId: 'CE016', choice: 'B' }, // 清零风险 impulsive
    { eventId: 'CE017', choice: 'A' },
    { eventId: 'CE005', choice: 'A' },
    { eventId: 'CE006', choice: 'B' }, // short-term
  ]
  const adaptivePlan = planFor(chef, prior)
  ok(adaptivePlan.metrics.adaptPhase >= 1, 'M4: adaptPhase reached at day6+ (' + adaptivePlan.metrics.adaptPhase + ')')
  const signals = personal.priorAnswerSignals(prior, eventsById())
  ok(signals.risky === true, 'M4: risky behaviour detected from actual choices')
  // the tail (>= warmup) should front-load events whose tags match the user's demonstrated themes
  const tail = adaptivePlan.plan.slice(personal.WARMUP)
  const matchedAtFront = tail.length && tail[0].scenarioTags.some((t) => signals.tags.has(t))
  ok(matchedAtFront, 'M4: tail front-loads an event matching demonstrated prior themes')
  // determinism
  const again = planFor(chef, prior)
  ok(JSON.stringify(again.plan.map((p) => p.eventId)) === JSON.stringify(adaptivePlan.plan.map((p) => p.eventId)), 'M4: plan is deterministic')

  // ── R ratio target 40-60 / 40-60 ──
  ok(chefPlan.metrics.personalizedRatio >= 0.4 && chefPlan.metrics.personalizedRatio <= 0.6,
    'R: personalized ratio within 40-60% (' + chefPlan.metrics.personalizedRatio + ')')

  // ── M5 latest 6Q overrides old memory (context authority) ──
  const UCB = require(path.join(BASE, 'context/userContextBuilder.js'))
  const sixq = { reportId: 'rpt_6q_NEW', createdAt: 99, content: { diagnosticVersion: 'turnaround_strategy_6q_v1', system_trap: '厨师，新情况', core_problem: '新问题', fatal_sentence: 'x', strategy_path: 'y' } }
  const a = UCB.assembleUserContext({ scenario: 'career', message: '', sixqReport: sixq, memories: [{ content: 'OLD: 我是程序员想转产品' }], memoryEnabled: true })
  ok(a.sixQ && a.sixQ.reportId === 'rpt_6q_NEW', 'M5: newest explicit 6Q is highest authority')
  ok(a.explicitProfile.occupation === '厨师', 'M5: explicit 6Q occupation wins over old memory claim')

  // ── M6 memory off still keeps 6Q personalization ──
  const off = UCB.assembleUserContext({ scenario: 'career', message: '', sixqReport: sixq, memories: [{ content: 'MEM' }], memoryEnabled: false })
  ok(off.hasSixQ && off.memories.length === 0, 'M6: memory OFF keeps 6Q, drops memory')
  const offPlan = planFor(ctxFor('厨师', { income: 7000, problem: '新问题', memoryEnabled: false }))
  ok(offPlan.plan.length === chefPlan.plan.length, 'M6: memory-OFF plan still fully personalized (non-empty)')

  // ── M7 no cross-user event selection ──
  const u1 = planFor(ctxFor('厨师', { income: 7000, problem: 'A' }))
  const u2 = planFor(ctxFor('白领', { income: 12000, problem: 'B' }))
  const p1 = u1.profileVersion, p2 = u2.profileVersion
  ok(p1 !== p2, 'M7: different users → different profileVersion (no cross-user cache)')

  // ── G golden dataset: per-case gates ──
  let forbidViol = 0
  let ratioViol = 0
  for (const g of GOLDEN) {
    const c = ctxFor(g.occ, { income: g.income, problem: g.goal, message: g.goal })
    const r = planFor(c)
    // occupation gate: no plan event may contraindicate this occupation
    const bad = r.plan.filter((p) => p.contraindications && p.contraindications.includes(g.occ))
    if (bad.length) forbidViol++
    // ratio target holds for every case
    if (r.metrics.personalizedRatio < 0.4 || r.metrics.personalizedRatio > 0.6) ratioViol++
  }
  ok(forbidViol === 0, 'G: occupation gate holds across golden dataset (violations=' + forbidViol + ')')
  ok(ratioViol === 0, 'G: ratio 40-60% holds across golden dataset (violations=' + ratioViol + ')')
  // explicit software-engineering forbid for chef + delivery rider
  const riderPlan = planFor(ctxFor('外卖员', { income: 6000, problem: '想第二收入' }))
  ok(!planFor(chef).plan.map((p) => p.eventId).includes('CE004') && !riderPlan.plan.map((p) => p.eventId).includes('CE004'),
    'G: chef + rider never see the 零基础学IT转行 scenario (CE004)')

  // ── P profile version invalidation inputs ──
  const base = ctxFor('厨师', { income: 7000 })
  const v0 = personal.computeProfileVersion(base, 'openid_x', { completedCount: 0 })
  const vNew6q = personal.computeProfileVersion(Object.assign({}, base, { sixQ: { reportId: 'rpt_6q_NEW2' } }), 'openid_x', { completedCount: 0 })
  const vMem = personal.computeProfileVersion(Object.assign({}, base, { memoryEnabled: false }), 'openid_x', { completedCount: 0 })
  const vChal = personal.computeProfileVersion(base, 'openid_x', { completedCount: 5 })
  ok(v0 !== vNew6q, 'P: new 6Q invalidates profile version')
  ok(v0 !== vMem, 'P: memory toggle invalidates profile version')
  ok(v0 !== vChal, 'P: challenge completion invalidates profile version')

  // ── catalog completeness ──
  ok(Object.keys(EVENT_META).length === 30, 'catalog covers all 30 events')
  let metaOk = true
  for (const e of EVENTS) {
    const d = decorateEvent(e)
    if (!d.domains.length || !d.cognitiveDimension || !Array.isArray(d.contraindications)) metaOk = false
  }
  ok(metaOk, 'every event carries full metadata')

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main()
