'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r84a-five-card-personality.test.js
 *
 * RC8.4 V6 R84-A — FIVE-CARD PERSONALITY + ONE-THESIS CONTENT FINALIZATION.
 *
 * Covers §32:
 *   Card01 collision · Card02 identity naming · Card03 loop · Card03 no duplicate
 *   conclusion · Card04 FROM→TO · Card05 experiment · 90-day consistency ·
 *   price safety · fact safety · NO_PRIMARY · length limits · one thesis ·
 *   one AI call · profile compatibility · personalization compatibility.
 *
 * Deterministic. No network (stub provider). Reads the REAL runtime + prompt.
 */

const path = require('path')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib')
const TH = path.join(CF, 'turnaroundStrategy/v6/thesis')
const CP = path.join(CF, 'cognitiveProfile')
const PERS = path.join(CF, 'cognitiveProfile/personalization')

const { runHybridDiagnosisV6 } = require(path.join(CF, 'turnaroundStrategy/v6/hybrid/hybridDiagnosisV6.js'))
const { buildReportV6 } = require(path.join(CF, 'turnaroundStrategy/v6/report/reportBuilderV6.js'))
const { runV4RestoredReportRuntimeV6, RENDER_SOURCE, mapV4RestoredToReport, parseActionItems } = require(path.join(TH, 'v4RestoredReportRuntimeV6.js'))
const { normalizeV4RestoredOutput } = require(path.join(TH, 'v4RestoredAdapterV6.js'))
const { compressVisibleCards, charLen, BUDGET } = require(path.join(TH, 'v4RestoredCompressV6.js'))
const GUARD = require(path.join(TH, 'v4RestoredCopyGuardV6.js'))
const P = require(path.join(TH, 'v4RestoredPersonalityV6.js'))
const { buildV4RestoredPrompt, PROMPT_VERSION } = require(path.join(TH, 'v4RestoredPromptV6.js'))
const { buildV4RestoredPayload } = require(path.join(TH, 'v4RestoredContextV6.js'))
const { validateV4Restored } = require(path.join(TH, 'v4RestoredValidatorV6.js'))
const BRIDGE = require(path.join(CP, 'cognitiveProfileBridgeV6.js'))
const { buildPersonalizationFeed } = require(path.join(PERS, 'personalizationRuntimeV6.js'))

let pass = 0, fail = 0
const results = []
function ok (name, cond, extra) {
  if (cond) { pass++; results.push('  PASS ' + name) }
  else { fail++; results.push('  FAIL ' + name + (extra ? ' :: ' + extra : '')) }
}

const OWNER = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationDetail: '',
  monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE',
  skillValidation: 'PROOF_PAID_ONCE', monetizableSkill: 'ASSET_CONTENT', weeklyTime: 'TIME_20_PLUS',
  executionStability: 'EXEC_VOLATILE', pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION',
  decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_BALANCE', primaryProblem: 'PROBLEM_MONETIZE',
  primaryGoal: 'GOAL_SKILL_MONETIZE', maxTrialCost: 'COST_5K_20K', failureResponse: 'FAIL_GIVE_UP'
}
const PROGRAMMER = Object.assign({}, OWNER, {
  occupationDetail: '后端程序员', monetizableSkill: 'ASSET_TECHNICAL'
})
const CONTENT = Object.assign({}, OWNER, {
  occupationDetail: '', incomeStructure: 'INC_UNSTABLE', skillValidation: 'PROOF_FREE_THANKED',
  primaryProblem: 'PROBLEM_SIDE_UNSTARTED', primaryGoal: 'GOAL_SIDE_INCOME'
})

// A synthetic "good" model output exercising the R84-A micro-heading contract.
const GOOD = {
  strategicThesis: {
    identityInterpretation: '你是一个手握一项已被市场付费验证过的内容能力、却用"再准备一下"拖住商业检验的人。',
    coreContradiction: '你不是没能力，而是一直没把能力变成一件别人能直接购买的东西。',
    systemTrap: '工资提供稳定现金流，也给了他"还有时间"的错觉；能力被付过一次钱，证明市场有入口，但一次交易不等于生意。结果是：能力始终停在作品层，没有变成报价—成交—交付—复购的闭环。',
    worldRule: '市场不为潜力付费，只为被明确包装、被反复交付的解决方案付费。',
    strategicMigration: { from: '靠手艺接活的人', to: '拥有一个能重复卖的产品的人', steps: ['封装交付', '找到买家', '固化复购'] },
    commercialThesis: { objective: '拿到第一笔针对明确交付的付费' }
  },
  cards: {
    card01: '你不是没行动，你是在用"再准备一下"回避被市场拒绝。',
    card02: '你现在是"有作品、但没有产品"的内容创作者。一次付费证明市场有入口，但入口不等于生意。',
    card03: ['工资给你安全感，于是真实商业动作一直被推迟。', '能力停在作品层，没有变成可重复的报价和交付。', '每次从零开始，没有固定买家。'],
    card04: { from: '靠手艺接活的人', to: '拥有一个能重复卖的产品的人', steps: ['定交付', '找买家', '跑复购'] },
    card05: {
      objective: '90天做出第一个可重复卖的内容产品',
      actions: [
        { title: '定产品', text: '把你被付过费的内容服务打包成一个明确交付，给出一个真实价格。' },
        { title: '找买家', text: '每周在公开平台发3条过程，并私信5个可能的买家。' },
        { title: '跑复购', text: '每次交付后追问对方还需不需要、愿不愿再买。' }
      ],
      target: '10个目标买家', timebox: '90天', successSignal: '有一个人为明确交付第二次付钱。'
    }
  }
}

function callOnce (obj) {
  let n = 0
  const fn = async () => { n++; return { success: true, content: JSON.stringify(obj), tokens: 900, finishReason: 'stop' } }
  fn.calls = () => n
  return fn
}

async function main () {
  // ── §3/§4 CARD01 collision + personality injection in the prompt ──
  ok('R84A §4 prompt carries 珠澳小事哥 tone', /珠澳小事哥/.test(P.TONE_BLOCK) && /锋利，不羞辱/.test(P.TONE_BLOCK))
  ok('R84A §4 prompt forbids humiliation/fake certainty', /禁止：羞辱/.test(P.TONE_BLOCK) && /假确定性/.test(P.TONE_BLOCK))
  ok('R84A §2 ONE report = ONE thesis block present', /一个报告 = 一个中心论点/.test(P.ONE_THESIS_BLOCK))
  ok('R84A §3 card01 preferred inversion in prompt', /你不是 X，你是在 Y/.test(P.CARD01_BLOCK))
  ok('R84A §5 card02 identity role in prompt', /你现在到底是哪一种人/.test(P.CARD02_BLOCK))
  ok('R84A §7 card03 loop role in prompt', /A → B → C → 回到 A/.test(P.CARD03_BLOCK))
  ok('R84A §8 card03 no-duplicate-conclusion rule in prompt', /禁止重复结论/.test(P.CARD03_BLOCK))
  ok('R84A §10 card04 FROM→TO rule in prompt', /FROM（现在的身份）→ TO（要变成的身份）/.test(P.CARD04_BLOCK))
  ok('R84A §14 card05 micro-heading rule in prompt', /中文微标题/.test(P.CARD05_BLOCK))
  ok('R84A §13 card05 90-day rule in prompt', /禁止出现"12个月内"/.test(P.CARD05_BLOCK))
  ok('R84A §16 price safety rule in prompt', /不要凭空发明精确价格/.test(P.CARD05_BLOCK))
  ok('R84A §21 DETERMINISTIC_TARGETS all zero', Object.keys(P.DETERMINISTIC_TARGETS).every((k) => P.DETERMINISTIC_TARGETS[k] === 0))

  const o = runHybridDiagnosisV6(OWNER)
  const payload = buildV4RestoredPayload(o.hybridProfile, o.diagnosis, o.hybridContext)
  const prompt = buildV4RestoredPrompt(payload)
  ok('R84A §18 prompt version bumped to r84a', PROMPT_VERSION === 'turnaround_strategy_v6_v4_restored_prompt_v2_r84a', PROMPT_VERSION)
  ok('R84A §18 personality block composed into the ONE system prompt', /珠澳小事哥/.test(prompt.systemPrompt) && /一个报告 = 一个中心论点/.test(prompt.systemPrompt))
  ok('R84A §14 output contract carries micro-heading action shape', /"title":"中文微标题"/.test(prompt.systemPrompt))
  ok('R84A §13 output contract pins timebox to 90天', /"timebox":"90天"/.test(prompt.systemPrompt))

  // ── §22 ONE AI call, and the full A path via the real runtime ──
  const fb = buildReportV6(o.diagnosis, o.hybridContext)
  const c1 = callOnce(GOOD)
  const r1 = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: fb, callAI: c1 })
  ok('R84A §22 MODEL_CALL_COUNT_MAX = 1', c1.calls() === 1 && r1.meta.modelCalls === 1)
  ok('R84A §22 path renders v4_restored', r1.renderSource === RENDER_SOURCE.AI, r1.renderSource)

  const v = r1.report.visibleCards
  const cards = r1.report.cards

  // ── §3 CARD01 collision ──
  ok('R84A §3 CARD01 <= 40', charLen(v.card01) <= BUDGET.CARD01 && charLen(v.card01) > 0, charLen(v.card01))
  ok('R84A §3 CARD01 is a collision (不是/而是/在)', /不是|而是|并非/.test(v.card01), v.card01)
  ok('R84A §3 CARD01 no raw-fact dump', !/岁|结余|存款|试错|每周\d/.test(v.card01), v.card01)

  // ── §5 CARD02 identity naming ──
  ok('R84A §5 CARD02 <= 140', charLen(v.card02) <= BUDGET.CARD02, charLen(v.card02))
  ok('R84A §5 CARD02 names an identity', /身份|创作者|经营者|产品|作品|有.*没有/.test(v.card02), v.card02)

  // ── §7/§8 CARD03 loop + no duplicate conclusion ──
  const c3len = v.card03.steps.reduce((a, s) => a + charLen(s), 0) + charLen(v.card03.rule)
  ok('R84A §7 CARD03 <= 220', c3len <= BUDGET.CARD03, c3len)
  ok('R84A §7 CARD03 <= 3 mechanism steps', v.card03.steps.length <= 3 && v.card03.steps.length >= 1, v.card03.steps.length)
  ok('R84A §7 CARD03 has one elevated conclusion', !!v.card03.rule)
  const dup = GUARD.isDuplicateConclusion(v.card03.rule, v.card03.steps)
  ok('R84A §8 CARD03_DUPLICATE_CONCLUSION_COUNT = 0', dup === false && r1.report.visibleStats.r84aGuard.CARD03_DUPLICATE_CONCLUSION_COUNT === 0)

  // ── §10/§11 CARD04 FROM→TO ──
  const c4len = charLen(v.card04.from) + charLen(v.card04.to) + charLen(v.card04.rule)
  ok('R84A §10 CARD04 <= 160', c4len <= BUDGET.CARD04, c4len)
  ok('R84A §10 CARD04 real FROM→TO', !!v.card04.from && !!v.card04.to && v.card04.from !== v.card04.to)
  ok('R84A §11 CARD04 avoids engineering nouns', !/技能持有者|可重复交付者/.test(v.card04.from + v.card04.to))
  ok('R84A §10 CARD04_FROM_TO_MISSING_COUNT = 0', r1.report.visibleStats.r84aGuard.CARD04_FROM_TO_MISSING_COUNT === 0)

  // ── §12/§13/§14 CARD05 experiment ──
  const c5len = charLen(v.card05.goal) + v.card05.actions.reduce((a, s) => a + charLen(s), 0) + charLen(v.card05.acceptance)
  ok('R84A §12 CARD05 <= 240', c5len <= BUDGET.CARD05, c5len)
  ok('R84A §12 CARD05 <= 3 actions', v.card05.actions.length <= 3 && v.card05.actions.length >= 1, v.card05.actions.length)
  ok('R84A §12 CARD05 has a validation standard', !!v.card05.acceptance)
  ok('R84A §13 90-day goal not contradictory', !GUARD.HORIZON_CONFLICT_TEST.test(v.card05.goal), v.card05.goal)
  ok('R84A §13 CARD05_90DAY_HORIZON_CONFLICT_COUNT = 0', r1.report.visibleStats.r84aGuard.CARD05_90DAY_HORIZON_CONFLICT_COUNT === 0)
  ok('R84A §16 UNSUPPORTED_EXACT_PRICE_COUNT = 0', r1.report.visibleStats.r84aGuard.UNSUPPORTED_EXACT_PRICE_COUNT === 0)
  ok('R84A §12 CARD05_VALIDATION_STANDARD_MISSING_COUNT = 0', r1.report.visibleStats.r84aGuard.CARD05_VALIDATION_STANDARD_MISSING_COUNT === 0)
  // micro-headings exist end to end (map -> view model)
  ok('R84A §14 CARD05 actionItems carry Chinese micro-headings', v.card05.actionItems.length === 3 && v.card05.actionItems.every((a) => !!a.title), JSON.stringify(v.card05.actionItems))
  ok('R84A §14 actionItems titles are not ACTION n', v.card05.actionItems.every((a) => !/^ACTION\s*\d/i.test(a.title)))
  ok('R84A §14 no generic standalone action', v.card05.actions.every((a) => !GUARD.GENERIC_ACTION_EXACT.test(a)))

  // ── §2 ONE THESIS coherence: all five cards trace to the same thesis ──
  ok('R84A §2 strategicThesis preserved at full depth', !!r1.report.strategicThesis && charLen(r1.report.strategicThesis.coreContradiction) > 5)
  const thesisKeywords = ['产品', '能力', '市场', '买家', '交付'].filter((k) => (v.card01 + v.card02 + v.card03.steps.join('') + v.card03.rule + v.card04.from + v.card04.to + v.card05.goal + v.card05.actions.join('')).indexOf(k) !== -1)
  ok('R84A §2 ONE_THESIS_COHERENCE (shared vocabulary >= 3)', thesisKeywords.length >= 3, thesisKeywords.join(','))

  // ── §24/§25 fact safety: fabricated history/customer blocked ──
  const fabric = {
    strategicThesis: { identityInterpretation: '你已经有一批稳定客户，月收入30000元。', coreContradiction: 'x', systemTrap: 'y', worldRule: 'z', commercialThesis: {} },
    cards: { card01: '保证你能月入10万', card02: 'x', card03: ['a'], card04: { from: 'a', to: 'b' }, card05: { objective: 'a', actions: ['b'], target: 'c', timebox: 'd', successSignal: 'e' } }
  }
  const vf = validateV4Restored(fabric, payload)
  ok('R84A §25 FACT_SAFETY fabricated income blocked', vf.blocking.indexOf('FABRICATED_INCOME') !== -1)
  ok('R84A §25 FACT_SAFETY guaranteed outcome blocked', vf.blocking.indexOf('GUARANTEED_OUTCOME') !== -1)

  // CONTENT control must NOT be able to claim already-sold/repeat-purchase (unpaid proof)
  const cOut = runHybridDiagnosisV6(CONTENT)
  const cPayload = buildV4RestoredPayload(cOut.hybridProfile, cOut.diagnosis, cOut.hybridContext)
  const claimedPaid = validateV4Restored({ strategicThesis: { identityInterpretation: '你已经有稳定客户并复购。', coreContradiction: 'x', systemTrap: 'y', worldRule: 'z', commercialThesis: {} }, cards: { card01: 'x', card02: 'x', card03: ['a'], card04: { from: 'a', to: 'b' }, card05: { objective: 'a', actions: ['b'], target: 'c', timebox: 'd', successSignal: 'e' } } }, cPayload)
  ok('R84A §25 §29 content unresolved paid-proof claim blocked', claimedPaid.blocking.indexOf('FABRICATED_CUSTOMER') !== -1)

  // ── §26 NO_PRIMARY still yields a strong thesis ──
  ok('R84A §26 owner diagnosis is NO_PRIMARY', o.diagnosis.diagnosisState === 'NO_PRIMARY', o.diagnosis.diagnosisState)
  ok('R84A §26 NO_PRIMARY still renders v4_restored (strong thesis)', r1.renderSource === RENDER_SOURCE.AI)
  const noPrimary = normalizeV4RestoredOutput(GOOD)
  const npReport = mapV4RestoredToReport(fb, noPrimary)
  ok('R84A §26 NO_PRIMARY report not "信息不足"', !/信息不足|暂时无法判断/.test(JSON.stringify(npReport.visibleCards)))

  // ── §20 length gates (no budget increase) ──
  ok('R84A §20 budgets unchanged (40/140/220/160/240)', BUDGET.CARD01 === 40 && BUDGET.CARD02 === 140 && BUDGET.CARD03 === 220 && BUDGET.CARD04 === 160 && BUDGET.CARD05 === 240)

  // ── §21 deterministic-only: no second AI validator ──
  ok('R84A §21 guard is pure/deterministic', typeof GUARD.guardVisibleCards === 'function' && GUARD.guardVisibleCards.toString().indexOf('callAI') === -1)

  // ── §30 profile compatibility: writeback schema unchanged ──
  const patch = BRIDGE.buildCognitiveProfilePatch({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, report: r1.report, reportId: 'ARV6_test', ts: 1 })
  ok('R84A §30 writeback schema version unchanged', patch.profileSchemaVersion === 'cognitive_profile_v1')
  ok('R84A §30 writeback sections unchanged', !!(patch.diagnosticState && patch.cognitiveState && patch.currentFocus && patch.learningHistory))
  ok('R84A §30 currentFocus extraction intact (worldRuleLensIds/priorityTopicIds)', Array.isArray(patch.currentFocus.worldRuleLensIds) && Array.isArray(patch.currentFocus.priorityTopicIds))
  ok('R84A §30 currentFocus carries PROBLEM_MONETIZE', patch.currentFocus.priorityTopicIds.indexOf('PROBLEM_MONETIZE') !== -1, JSON.stringify(patch.currentFocus.priorityTopicIds))

  // ── §31 personalization compatibility: R78/R79 consumers unchanged ──
  const canonProfile = {
    present: true, isLegacy: false, dimensions: {},
    diagnosticState: { primaryBottleneck: { value: o.diagnosis.primaryBottleneck } },
    cognitiveState: { primaryBlindSpot: { expression: patch.cognitiveState.primaryBlindSpot.expression } },
    currentFocus: { worldRuleLensIds: patch.currentFocus.worldRuleLensIds, priorityTopicIds: patch.currentFocus.priorityTopicIds },
    learningHistory: { seenRuleIds: [], seenInsightIds: [], seenStrikeIds: [] }
  }
  const feed = buildPersonalizationFeed({ profile: canonProfile, worldRules: [{ ruleId: 'WR016', tags: [] }], insights: [{ insightId: 'DI001', tags: ['付费'], difficulty: 1 }], strikes: [{ id: 'STRIKE_000', dimensions: [] }], dayIndex: 20712 })
  ok('R84A §31 personalization feed shape unchanged', feed && feed.worldRule && feed.dailyInsight && feed.strike && ('personalized' in feed))

  console.log(results.join('\n'))
  console.log('\nR84-A TESTS: ' + pass + ' passed, ' + fail + ' failed')
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('R84-A TEST ERROR', e); process.exit(2) })
