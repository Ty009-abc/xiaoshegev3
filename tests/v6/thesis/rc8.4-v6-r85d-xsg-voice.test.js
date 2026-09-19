'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r85d-xsg-voice.test.js
 *
 * RC8.4 V6 R85-D — XSG VOICE & JUDGMENT LAYER.
 *
 * Converts the grounded Game Thesis / World Model into 珠澳小事哥-style
 * JUDGMENT / 拆局 language on the FINAL VISIBLE five cards (NO new facts, NO
 * model change, NO extra model call, NO UI change).
 *
 * Covers:
 *   §2/§3  XSG voice module + abstract-term density
 *   §5/§6  Card01 verdict + swap test (occupation/game-specific)
 *   §7/§8  Card02 position (not essay, no psychology)
 *   §9-§11 Card03 reveal contract + memorable conclusion
 *   §12-§14 Card04 switch-type voice + quotable world rule
 *   §15-§17 Card05 ONE reality test (no business-plan voice, no 90-day drama)
 *   §19    grounding (no unsupported causal/psychology/fabrication)
 *   §20/§21 template rhythm + sentence rhythm
 *   §22/§23 real-provider controls + swap test
 *   §24/§25 most quotable line + IP classification C
 *   §26    freezes (game/pricing/ui/profile unchanged; model call max 1)
 *
 * Deterministic. No network.
 */

const path = require('path')
const assert = require('assert')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib')
const V6 = path.join(CF, 'turnaroundStrategy/v6')

const { runHybridDiagnosisV6 } = require(path.join(V6, 'hybrid/hybridDiagnosisV6.js'))
const { buildReportV6 } = require(path.join(V6, 'report/reportBuilderV6.js'))
const { mapV4RestoredToReport, V4R_TEMPERATURE } = require(path.join(V6, 'thesis/v4RestoredReportRuntimeV6.js'))
const XSG = require(path.join(V6, 'thesis/xsgJudgmentVoiceV1.js'))
const { buildGameThesis } = require(path.join(V6, 'thesis/gameThesisV6.js'))

let pass = 0, fail = 0
const fails = []
function t (name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name) } catch (e) { fail++; fails.push(name + ' :: ' + e.message); console.log('  ✗ ' + name + ' :: ' + e.message) }
}

const BASE = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationCategory: 'OCC_CONTENT_CREATIVE',
  occupationDetail: '短视频运营', pricingAuthority: 'PRICE_EMPLOYER', monthlySurplus: 'SURPLUS_1K_5K',
  safetyMonths: 'SAFETY_1_3', debtPressure: 'DEBT_NONE', skillValidation: 'PROOF_FREE_THANKED',
  monetizableSkill: 'ASSET_CONTENT', weeklyTime: 'TIME_5_10', maxTrialCost: 'COST_1K_5K',
  pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION', timeBehavior: 'TIME_PROTECT_LONG',
  primaryProblem: 'PROBLEM_MONETIZE'
}
const COG = (l, p, s, r, e) => ({ laborModel: l, decisionStyle: p, systemModel: s, ruleModel: r, failureResponse: e })
const RAW = (o) => Object.assign({}, BASE, o)
const OWNER = RAW(COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_PERSON', 'RULE_EFFORT', 'EVID_PRAISE'))

// §22 five real-provider control fixtures (deterministic shape; provider run is
// separate — this suite proves the deterministic readback of each).
const CONTROLS = {
  PROGRAMMER: RAW({ occupationCategory: 'OCC_TECH', occupationDetail: '程序员', monetizableSkill: 'ASSET_TECHNICAL', pricingAuthority: 'PRICE_EMPLOYER', ...COG('LABOR_MORE_WORK', 'DECISION_SMALL_TEST', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_REPEATABLE') }),
  CHEF: RAW({ occupationCategory: 'OCC_SERVICE', occupationDetail: '厨师', monetizableSkill: 'ASSET_CRAFT', pricingAuthority: 'PRICE_EMPLOYER', ...COG('LABOR_REUSABLE', 'DECISION_LEARN_FIRST', 'SYS_PERSON', 'RULE_AWARE', 'EVID_PRAISE') }),
  SALES: RAW({ occupationCategory: 'OCC_SALES', occupationDetail: '销售', monetizableSkill: 'ASSET_SALES', pricingAuthority: 'PRICE_CLIENT', ...COG('LABOR_LEVERAGE', 'DECISION_ALL_IN', 'SYS_STRUCTURE', 'RULE_DEMAND', 'EVID_REPEATABLE') }),
  DELIVERY_RIDER: RAW({ occupationCategory: 'OCC_PLATFORM_LABOR', occupationDetail: '外卖骑手', monetizableSkill: 'ASSET_UNCLEAR', pricingAuthority: 'PRICE_PLATFORM', ...COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_PER_EVENT', 'RULE_EFFORT', 'EVID_LUCK') }),
  CONTENT_CREATOR: RAW({ occupationCategory: 'OCC_CONTENT_CREATIVE', occupationDetail: '短视频运营', monetizableSkill: 'ASSET_CONTENT', pricingAuthority: 'PRICE_EMPLOYER', ...COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_PERSON', 'RULE_EFFORT', 'EVID_PRAISE') })
}

const LLM_OUT = {
  strategicThesis: { identityInterpretation: 'x', coreContradiction: 'x', systemTrap: 'x', worldRule: 'x', strategicMigration: { from: 'x', to: 'y', steps: ['a'] }, commercialThesis: { objective: 'o' } },
  cards: {
    card01: 'x', card02: '还看不清', card03: ['a', 'b'],
    card04: { from: '还看不清', to: 'y', steps: ['a'] },
    card05: { objective: 'o', actions: [{ title: 't', text: 't' }], successSignal: 's' }
  }
}

function render (raw) {
  const o = runHybridDiagnosisV6(raw)
  const fb = buildReportV6(o.diagnosis, o.hybridContext)
  const m = mapV4RestoredToReport(fb, LLM_OUT, o.hybridProfile, o.hybridContext)
  return { o, m, g: m.visibleStats.r86eGuard, vc: m.visibleCards }
}
function blob (vc) {
  const c4 = vc.card04 || {}; const c5 = vc.card05 || {}; const c3 = vc.card03 || {}
  return [vc.card01, vc.card02, (c3.steps || []).join('；'), c3.rule, c4.from, c4.to, c4.rule, c5.goal, (c5.actions || []).join('；'), c5.acceptance].filter(Boolean).join('｜')
}
function sents (texts) { const out = []; for (const x of texts) { for (const s of String(x || '').split(/(?<=[。；！？!?])/)) { const z = s.trim(); if (z) out.push(z) } } return out }

console.log('\nRC8.4 V6 R85-D — XSG VOICE & JUDGMENT LAYER\n')

// ── §2/§3 module + abstract density ─────────────────────────────────────────
t('§2 XSG voice module exists and is deterministic (no AI/IO)', () => {
  assert.strictEqual(XSG.XSG_VOICE_VERSION, 'r85d_xsg_judgment_voice_v1')
  const src = require('fs').readFileSync(path.join(V6, 'thesis/xsgJudgmentVoiceV1.js'), 'utf8')
  assert.ok(!/callAI|runV4RestoredAdapter|fetch|http/.test(src), 'voice must be deterministic')
})
t('§3 visible copy has LOW abstract-term density (no stacked economic jargon)', () => {
  const { g } = render(OWNER)
  assert.ok(g.ABSTRACT_TERM_COUNT <= 1, 'ABSTRACT_TERM_COUNT=' + g.ABSTRACT_TERM_COUNT)
  assert.ok(g.MAX_ABSTRACT_PER_SENTENCE <= 1, 'MAX_ABSTRACT_PER_SENTENCE=' + g.MAX_ABSTRACT_PER_SENTENCE)
})
t('§3 the banned consultant nouns do NOT appear in visible copy', () => {
  const { vc } = render(OWNER)
  const b = blob(vc)
  for (const term of ['市场验证', '价格信号', '价值结构', '收入结构', '独立付款人', '可重复交付', '商业闭环', '经营系统', '定价权', '第二个价格信号']) {
    assert.ok(b.indexOf(term) === -1, 'abstract term leaked: ' + term)
  }
})

// ── §5/§6 Card01 verdict + swap ─────────────────────────────────────────────
t('§5 CARD01 is a VERDICT: model collision + game-specific reality (≤ ~62 chars)', () => {
  const { vc, g } = render(OWNER)
  assert.ok([...vc.card01].length <= 62, 'len=' + [...vc.card01].length)
  assert.ok(/习惯|判断|只认/.test(vc.card01), 'carries the model')
  assert.ok(/公司|平台|客户|时间|单/.test(vc.card01), 'carries the game facts')
  assert.strictEqual(g.CARD01_IMPACT, 'PASS')
})
t('§6 Card01 is occupation/game-specific (swap test: embeds the user game noun)', () => {
  const { vc } = render(OWNER)
  assert.ok(/内容/.test(vc.card01), 'embeds the user skill noun')
  assert.strictEqual(render(OWNER).g.CARD01_SWAP_FAILURE_COUNT, 0)
})
t('§6 Card01 differs across the 5 occupations (not swappable)', () => {
  const lines = Object.keys(CONTROLS).map((k) => render(CONTROLS[k]).vc.card01)
  assert.ok(new Set(lines).size >= 4, 'distinct Card01: ' + new Set(lines).size)
})

// ── §7/§8 Card02 position ───────────────────────────────────────────────────
t('§7 CARD02 is a POSITION label + one line (≤ ~70 chars), not an essay', () => {
  const { vc } = render(OWNER)
  assert.ok([...vc.card02].length <= 70, 'len=' + [...vc.card02].length)
  assert.ok(/你现在/.test(vc.card02), 'reads as a diagnosis label')
})
t('§8 CARD02 carries NO unsupported psychology', () => {
  const { vc } = render(OWNER)
  assert.ok(!/你把自己当|你一直觉得|你不敢|你嘴上说/.test(vc.card02))
  assert.strictEqual(render(OWNER).g.UNSUPPORTED_PSYCHOLOGY_COUNT, 0)
})

// ── §9-§11 Card03 reveal ────────────────────────────────────────────────────
t('§9/§11 CARD03 reveals a loop the user likely never articulated', () => {
  const { vc } = render(OWNER)
  assert.ok(Array.isArray(vc.card03.steps) && vc.card03.steps.length >= 3, 'has a multi-step loop')
  assert.ok(vc.card03.rule && vc.card03.rule.length > 8, 'has a memorable conclusion')
})
t('§11 CARD03 conclusion is memorable and NOT a restated step', () => {
  const { vc } = render(OWNER)
  const steps = (vc.card03.steps || []).join('')
  assert.ok(!steps.includes(vc.card03.rule.replace(/[。]/g, '')), 'conclusion must not be a step restatement')
})
t('§10 CARD03_REVEAL = PASS (no consultant conclusion like 收入结构只有一条腿)', () => {
  const { vc, g } = render(OWNER)
  assert.strictEqual(g.CARD03_REVEAL, 'PASS')
  assert.ok(!/收入结构|只有一条腿|价值结构/.test(blob(vc)))
})

// ── §12-§14 Card04 ──────────────────────────────────────────────────────────
t('§12/§13 CARD04 clearly says what does NOT change and what DOES', () => {
  const { vc } = render(OWNER)
  assert.ok(vc.card04.from && vc.card04.to, 'has old → new')
  assert.ok(/保住|不换|不推翻|换一个|先把/.test(vc.card04.to + vc.card04.rule), 'names the non-change / change')
})
t('§13 SWITCH_TYPE voice: STAY / ADD / SWITCH_GAME render DISTINCT card04', () => {
  const stay = render(RAW({ ...COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_PERSON', 'RULE_EFFORT', 'EVID_PRAISE'), timeBehavior: 'TIME_BALANCE', monthlySurplus: 'SURPLUS_NEGATIVE', weeklyTime: 'TIME_2_5' }))
  const add = render(OWNER)
  const sw = render(CONTROLS.DELIVERY_RIDER)
  const tones = [stay.vc.card04.to, add.vc.card04.to, sw.vc.card04.to]
  assert.ok(new Set(tones).size === 3, 'switch voices distinct: ' + JSON.stringify(tones))
})
t('§14 CARD04 world rule is quotable / compressed (≤ ~40 chars core)', () => {
  const { vc } = render(OWNER)
  const core = vc.card04.rule.split('（应用')[0]
  assert.ok([...core].length <= 40, 'rule core len=' + [...core].length)
})

// ── §15-§17 Card05 ──────────────────────────────────────────────────────────
t('§15 CARD05 centers ONE decisive reality test (goal names the model)', () => {
  const { vc } = render(OWNER)
  assert.ok(/验证一件事/.test(vc.card05.goal), 'one test')
  assert.ok(/「.+」/.test(vc.card05.goal), 'the test references the model being tested')
})
t('§16 CARD05 has NO startup-checklist headings (定交付/找买家/跑复购/收反馈)', () => {
  const { vc } = render(OWNER)
  const b = blob(vc)
  assert.ok(!/定交付|找买家|跑复购|收反馈|找客户|跑一次/.test(b), 'no business-plan voice: ' + b)
})
t('§17 CARD05 does NOT inflate into a 90-day business plan', () => {
  const { vc } = render(OWNER)
  assert.ok(!/90\s*天|三个月|第一季度|季度/.test(blob(vc)), 'no 90-day drama')
})

// ── §19 grounding ───────────────────────────────────────────────────────────
t('§19 NO grounding regression on the final visible cards', () => {
  const { g, vc } = render(OWNER)
  assert.strictEqual(g.UNSUPPORTED_PSYCHOLOGY_COUNT, 0)
  assert.strictEqual(g.UNKNOWN_AS_USER_IDENTITY_COUNT, 0)
  assert.strictEqual(g.MIXED_AS_USER_IDENTITY_COUNT, 0)
  assert.strictEqual(g.CARD05_REALITY_TEST_FALSE_POSITIVE_COUNT, 0)
  assert.strictEqual(g.CARD02_LEAK_TOKEN_COUNT, 0)
  assert.strictEqual(render(OWNER).m.visibleStats.r86eVisibleGrounding.VISIBLE_UNSUPPORTED_PSYCHOLOGY_COUNT, 0)
  assert.ok(!/还看不清/.test(blob(vc)))
})
t('§19 no fabricated transaction / guaranteed outcome in visible copy', () => {
  const { vc } = render(OWNER)
  const b = blob(vc)
  assert.ok(!/保证|一定能赚|必定|百分之百|稳赚/.test(b))
})

// ── §20/§21 rhythm ──────────────────────────────────────────────────────────
t('§20 template rhythm is bounded (not the default rhythm)', () => {
  let total = 0
  for (const k of Object.keys(CONTROLS)) {
    const { vc } = render(CONTROLS[k])
    total += XSG.templateRhythmCount([vc.card01, vc.card02, (vc.card03 || {}).rule, (vc.card04 || {}).rule, (vc.card05 || {}).goal])
  }
  // 5 reports × 5 cards: the "不是A，是B" verdict appears at most once per report.
  assert.ok(total <= 10, 'TEMPLATE_RHYTHM total=' + total)
})
t('§21 sentence rhythm: no long balanced consultant sentences (max ≤ 60 chars)', () => {
  const { vc } = render(OWNER)
  const all = sents([vc.card01, vc.card02, (vc.card03.steps || []).join('。'), vc.card03.rule, vc.card04.to, vc.card05.goal])
  const maxLen = Math.max(...all.map((s) => [...s].length))
  assert.ok(maxLen <= 60, 'max sentence len=' + maxLen)
})

// ── §22/§23 controls + swap ─────────────────────────────────────────────────
t('§22 all 5 real-provider controls render COMPLETE Card01–05 (deterministic readback)', () => {
  for (const k of Object.keys(CONTROLS)) {
    const { vc, o } = render(CONTROLS[k])
    assert.ok(o.valid, k + ' fixture valid')
    for (const c of ['card01', 'card02', 'card03', 'card04', 'card05']) assert.ok(vc[c], k + ' missing ' + c)
    assert.ok(vc.card03.steps.length >= 3, k + ' card03 loop')
    assert.ok(vc.card05.acceptance, k + ' card05 acceptance')
  }
})
t('§23 INTERCHANGEABLE_CORE_LINE_COUNT = 0 (Card01/Card03 differ per occupation)', () => {
  const blobIds = {}
  for (const k of Object.keys(CONTROLS)) {
    const { vc } = render(CONTROLS[k])
    blobIds[k] = vc.card01 + '||' + vc.card03.rule
  }
  // no two occupations share the SAME (card01 + card03 rule) when the game noun differs
  const vals = Object.values(blobIds)
  assert.ok(new Set(vals).size === vals.length, 'interchangeable core lines present')
})

// ── §24/§25 quotable + IP ───────────────────────────────────────────────────
t('§24 at least ONE quotable line exists (rule-compression)', () => {
  const { vc } = render(OWNER)
  const candidates = [vc.card01, vc.card03.rule, vc.card04.rule].filter(Boolean)
  const quotable = candidates.find((s) => [...s].length <= 40 && /不是|才是|风险|规则|每天|一直/.test(s))
  assert.ok(quotable, 'no quotable line among: ' + JSON.stringify(candidates))
})
t('§25 IP classification = C (珠澳小事哥拆局), not A/B', () => {
  const { vc } = render(OWNER)
  const b = blob(vc)
  const A = /买家|客户|报价|成交|变现|副业|第一笔|90\s*天/.test(b)
  const B = /性格|人格|你是.{0,4}型|测试结果/.test(b)
  assert.ok(!A && !B, 'still AI/consultant feel')
})

// ── §26 freezes ─────────────────────────────────────────────────────────────
t('§26 MODEL_CALL_COUNT_MAX = 1 (voice layer adds NO call)', () => {
  assert.strictEqual(V4R_TEMPERATURE, 0.7)
  const src = require('fs').readFileSync(path.join(V6, 'thesis/worldModelCardScreenV2.js'), 'utf8')
  assert.ok(!/callAI|runV4RestoredAdapter|fetch/.test(src))
})
t('§26 legacy path unchanged: voice layer is a NO-OP when isR86C=false', () => {
  // A GENUINE R86 submission always answers all 3 new cognitive fields, so
  // isR86C=false is reachable only by nulling the world model at runtime level.
  const o = runHybridDiagnosisV6(OWNER)
  const fb = buildReportV6(o.diagnosis, o.hybridContext)
  const legacyProfile = Object.assign({}, o.hybridProfile, { worldModel: null, mismatch: null })
  const legacyCtx = Object.assign({}, o.hybridContext, { worldModel: null, mismatch: null })
  const m = mapV4RestoredToReport(fb, LLM_OUT, legacyProfile, legacyCtx)
  assert.strictEqual(m.visibleStats.r86eGuard, null)
  assert.strictEqual(m.visibleStats.r86eVisibleGrounding, null)
  assert.ok(m.visibleCards.card01, 'legacy visible card still present')
})
t('§26 XSG voice does not mutate the GameModel / PricingPower objects', () => {
  const o = runHybridDiagnosisV6(OWNER)
  const gm = JSON.stringify(o.hybridProfile.gameModel)
  const pp = JSON.stringify(o.hybridProfile.pricingPower)
  render(OWNER)
  assert.strictEqual(JSON.stringify(o.hybridProfile.gameModel), gm)
  assert.strictEqual(JSON.stringify(o.hybridProfile.pricingPower), pp)
})

console.log('\n══════════════════════════════════════')
console.log('R85-D XSG VOICE: ' + pass + ' passed, ' + fail + ' failed')
console.log('══════════════════════════════════════')
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
