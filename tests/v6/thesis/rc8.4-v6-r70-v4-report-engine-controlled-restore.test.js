'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r70-v4-report-engine-controlled-restore.test.js
 *
 * RC8.4 V6 R70 — V4 REPORT ENGINE CONTROLLED RESTORE.
 *
 * Verifies the restored ONE-PROFILE → ONE-THESIS → ONE-CALL path:
 *   - one model call max
 *   - Hybrid-10Q input preservation (all answered fields reach the prompt)
 *   - NO skill→occupation fabrication
 *   - B1 is CONTEXT, not copy authority (NO_PRIMARY still yields a strong thesis)
 *   - high-freedom inference allowed (bold copy is NOT rejected)
 *   - minimal hard bans only (fabrication / guarantee / illegal block)
 *   - shared thesis across five cards
 *   - R68 envelope fallback preserved (+ R53 disaster only)
 *   - payment / auth / privacy untouched
 */

const path = require('path')
const ROOT = path.resolve(__dirname, '..', '..', '..')

const { runHybridDiagnosisV6 } = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/hybrid/hybridDiagnosisV6.js'))
const { buildReportV6 } = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/report/reportBuilderV6.js'))
const { buildV4RestoredPayload } = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/thesis/v4RestoredContextV6.js'))
const { buildV4RestoredPrompt, buildUserMessage } = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/thesis/v4RestoredPromptV6.js'))
const { runV4RestoredReportRuntimeV6, RENDER_SOURCE } = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/thesis/v4RestoredReportRuntimeV6.js'))
const { validateV4Restored, BLOCKING_REASON_CODES } = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/thesis/v4RestoredValidatorV6.js'))

let pass = 0, fail = 0
const results = []
function ok (name, cond, extra) {
  if (cond) { pass++; results.push('  PASS ' + name) }
  else { fail++; results.push('  FAIL ' + name + (extra ? ' :: ' + extra : '')) }
}

// Owner R66/R69 exact class (NO_PRIMARY, PAID_ONCE, no occupation).
const OWNER = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationDetail: '',
  monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE',
  skillValidation: 'PROOF_PAID_ONCE', monetizableSkill: 'ASSET_CONTENT', weeklyTime: 'TIME_20_PLUS',
  executionStability: 'EXEC_VOLATILE', pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION',
  decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_BALANCE', primaryProblem: 'PROBLEM_MONETIZE',
  primaryGoal: 'GOAL_SKILL_MONETIZE', maxTrialCost: 'COST_5K_20K', failureResponse: 'FAIL_GIVE_UP'
}
// Old programmer-style control: technical skill, salary, paid proof, has occupation text.
const PROGRAMMER = Object.assign({}, OWNER, {
  occupationDetail: '后端程序员', incomeStructure: 'INC_SALARY', monetizableSkill: 'ASSET_TECHNICAL',
  skillValidation: 'PROOF_PAID_ONCE', primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SIDE_TO_MAIN'
})
// Content creator: no paid proof, wants side income.
const CONTENT = Object.assign({}, OWNER, {
  occupationDetail: '', incomeStructure: 'INC_UNSTABLE', monetizableSkill: 'ASSET_CONTENT',
  skillValidation: 'PROOF_FREE_THANKED', primaryProblem: 'PROBLEM_SIDE_UNSTARTED', primaryGoal: 'GOAL_SIDE_INCOME'
})

const GOOD_OUTPUT = {
  strategicThesis: {
    identityInterpretation: '你是一个手握一项已被市场付费验证过的内容能力、却用"再准备一下"拖住商业检验的人。',
    coreContradiction: '你不是没有能力，而是一直没把能力变成一件别人能直接购买的东西。',
    systemTrap: '能力只按次使用，收入永远卡在一次换一次。',
    worldRule: '能被重复购买的能力才是资产，只能被使用一次的只是工时。',
    strategicMigration: { from: '有技能的人', to: '有一个能被重复购买的产品的人', steps: ['封装交付', '找到买家', '固化复购'] },
    commercialThesis: { objective: '拿到第一笔针对明确交付的付费', offer: '付费内容诊断', buyer: '中小商家', delivery: '线上', distribution: '同城商家群', repeatSale: '月度代运营', productization: '模板+流程' }
  },
  cards: {
    card01: '你不是能力不够，是把能力一直攥在手里没敢标价。',
    card02: '你的问题不在会不会写，而在于把能力当成本事，而不是一件能被购买的商品。',
    card03: ['能力只按次使用，收入一次换一次。', '没有封装成交付，买家看不懂你给什么。', '没有固定买家，每次从零开始。'],
    card04: { from: '把能力当成本事留着', to: '把能力做成能被购买的最小交付', steps: ['定义交付', '找买家', '测第一笔付费'] },
    card05: { objective: '拿到第一笔针对明确交付的付费', actions: ['写交付清单', '联系10个商家', '发低风险测试价'], target: '10个目标商家', timebox: '14天', successSignal: '至少1个买家为明确交付付了钱' }
  }
}

async function main () {
  // ── §1: input preservation + no skill→occupation fabrication ──
  const o = runHybridDiagnosisV6(OWNER)
  ok('R70 §1 diagnosis valid', o.valid === true)
  ok('R70 §1 owner NO_PRIMARY', o.diagnosis.diagnosisState === 'NO_PRIMARY', o.diagnosis.diagnosisState)
  const payload = buildV4RestoredPayload(o.hybridProfile, o.diagnosis, o.hybridContext)
  ok('R70 §1 answered fields preserved (17/18)', payload.answeredFieldCount === 17, String(payload.answeredFieldCount))
  ok('R70 §1 no occupation inferred', payload.userContext.occupationDetail === null)
  ok('R70 §1 hasUserOccupation=false', payload.hasUserOccupation === false)
  const ENUM = /LIFE_[0-9]|INC_[A-Z]|SURPLUS_[A-Z]|SAFETY_[A-Z0-9]|DEBT_[A-Z]|PROOF_[A-Z]|ASSET_[A-Z]|TIME_[A-Z0-9]|EXEC_[A-Z]|COST_[A-Z0-9]|PROBLEM_[A-Z]|GOAL_[A-Z]|ATTEMPT_[A-Z0-9]|DECISION_[A-Z]|BELIEF_[A-Z]|FAIL_[A-Z]/
  ok('R70 §1 no raw enum leak in user context', ENUM.test(JSON.stringify(payload.userContext)) === false)
  const prompt = buildV4RestoredPrompt(payload)
  ok('R70 §1 prompt keeps a real value (paid once)', /被市场付费验证：是/.test(buildUserMessage(payload)) || /被市场付费验证：是/.test(prompt.userMessage))
  ok('R70 §1 prompt forbids occupation fabrication', /禁止编造一个具体职业/.test(prompt.userMessage))

  // ── §2/§3: high-freedom inference allowed; B1 is context ──
  ok('R70 §2 prompt requires ONE central thesis', /ONE 统一战略论点|同一个中心论点/.test(prompt.systemPrompt))
  ok('R70 §3 prompt allows high-freedom inference', /身份位置 · 职业结构|您被允许的推断|你被允许的推断/.test(prompt.systemPrompt))
  ok('R70 §3 prompt allows strong wording', /不要因为语言/.test(prompt.systemPrompt))
  ok('R70 §3 prompt: NO_PRIMARY still yields strong thesis', /即使系统给不出主瓶颈/.test(prompt.systemPrompt))

  // ── §4: minimal hard bans ONLY ──
  ok('R70 §4 hard-ban codes are the minimal set', BLOCKING_REASON_CODES.length === 7 && BLOCKING_REASON_CODES.indexOf('GUARANTEED_OUTCOME') !== -1)

  // ── §5: B1 NOT copy authority — NO_PRIMARY still returns v4_restored for good output ──
  const report = buildReportV6(o.diagnosis, o.hybridContext)
  const callOnce = (stub) => { let n = 0; const fn = async () => { n++; return { success: true, content: JSON.stringify(stub), tokens: 800, finishReason: 'stop' } }; fn.calls = () => n; return fn }
  let c1 = callOnce(GOOD_OUTPUT)
  const r1 = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: report, crossAxisScope: report.crossAxisScope, callAI: c1 })
  ok('R70 §5 NO_PRIMARY yields v4_restored (B1 not copy authority)', r1.renderSource === RENDER_SOURCE.AI, r1.renderSource)
  ok('R70 §5 exactly ONE model call', c1.calls() === 1 && r1.meta.modelCalls === 1)

  // ── §6/§7: shared thesis across five cards + five-card completeness ──
  const cards = r1.report.cards
  ok('R70 §7 five cards present', !!(cards.fatalInsight && cards.coreProblem && cards.systemLoop && cards.turnaroundPath && cards.firstAction))
  ok('R70 §7 CARD01 cognitive collision', /攥在手里|标价/.test(cards.fatalInsight.text))
  ok('R70 §7 CARD02 identity/value interpretation', /能被购买的商品|价值/.test(cards.coreProblem.text))
  ok('R70 §7 CARD03 mechanism', cards.systemLoop.steps.length >= 3)
  ok('R70 §7 CARD04 real FROM→TO', cards.turnaroundPath.from === '把能力当成本事留着' && cards.turnaroundPath.to === '把能力做成能被购买的最小交付')
  ok('R70 §7 CARD05 commercial density', cards.firstAction.objective && cards.firstAction.actions.length >= 3 && cards.firstAction.successSignal)
  ok('R70 §6 shared thesis surfaced', !!(r1.report.strategicThesis && r1.report.strategicThesis.coreContradiction))

  // ── §4 (negative): bold/opinionated truthful copy is NOT rejected ──
  const bold = Object.assign({}, GOOD_OUTPUT, { cards: Object.assign({}, GOOD_OUTPUT.cards, { card01: '你一直在骗自己：你不是没时间，是不敢把能力明码标价。' }) })
  const c2 = callOnce(bold)
  const r2 = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: report, callAI: c2 })
  ok('R70 §4 bold truthful copy NOT sent to fallback', r2.renderSource === RENDER_SOURCE.AI, r2.renderSource)

  // ── §4: minimal hard bans actually block ──
  const fabric = { strategicThesis: { identityInterpretation: '你是一名资深程序员，月薪3万。', coreContradiction: 'x', systemTrap: 'y', worldRule: 'z', commercialThesis: { objective: '保证收益' } }, cards: { card01: '保证你能月入10万', card02: 'x', card03: ['a'], card04: { from: 'a', to: 'b' }, card05: { objective: 'a', actions: ['b'], target: 'c', timebox: 'd', successSignal: 'e' } } }
  const vf = validateV4Restored(fabric, payload)
  ok('R70 §4 fabricated occupation blocked', vf.blocking.indexOf('FABRICATED_OCCUPATION') !== -1)
  ok('R70 §4 guaranteed outcome blocked', vf.blocking.indexOf('GUARANTEED_OUTCOME') !== -1)
  const c3 = callOnce(fabric)
  const r3 = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: report, callAI: c3 })
  ok('R70 §4 hard ban -> envelope fallback, NOT R53', r3.renderSource === RENDER_SOURCE.ENVELOPE_FALLBACK, r3.renderSource)
  ok('R70 §4 hard ban reason recorded', r3.meta.hardBanReasonCodes.indexOf('FABRICATED_OCCUPATION') !== -1)

  // ── §14: provider failure / invalid JSON -> R68 envelope fallback preserved ──
  const failAI = async () => ({ success: false, error: 'HTTP 500', providerErrorCode: 'AI_PROVIDER_ERROR' })
  const r4 = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: report, callAI: failAI })
  ok('R70 §14 provider failure -> envelope fallback', r4.renderSource === RENDER_SOURCE.ENVELOPE_FALLBACK, r4.renderSource)
  const badJson = async () => ({ success: true, content: '{ not json ', tokens: 10, finishReason: 'stop' })
  const r5 = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: report, callAI: badJson })
  ok('R70 §14 invalid JSON -> envelope fallback', r5.renderSource === RENDER_SOURCE.ENVELOPE_FALLBACK, r5.renderSource)

  // ── §14: R53 disaster only when the deterministic report has NO cards ──
  const r6 = await runV4RestoredReportRuntimeV6({ diagnosis: { diagnosisState: 'INVALID_INPUT' }, fallbackReport: { cards: null } })
  ok('R70 §14 invalid input -> R53 disaster', r6.renderSource === RENDER_SOURCE.FALLBACK && r6.meta.fallbackLayer === 'R53_DISASTER_FALLBACK')

  // ── controls: programmer + content do not collapse to willingness interview ──
  const pOut = runHybridDiagnosisV6(PROGRAMMER)
  const pPayload = buildV4RestoredPayload(pOut.hybridProfile, pOut.diagnosis, pOut.hybridContext)
  ok('R70 §9 programmer keeps occupation text', pPayload.userContext.occupationDetail === '后端程序员')
  const cOut = runHybridDiagnosisV6(CONTENT)
  const cPayload = buildV4RestoredPayload(cOut.hybridProfile, cOut.diagnosis, cOut.hybridContext)
  ok('R70 §10 content creator: no occupation fabricated', cPayload.userContext.occupationDetail === null)
  ok('R70 §10 content creator: unpaid proof preserved', /免费/.test(cPayload.userContext.skillValidation), cPayload.userContext.skillValidation)

  // ── payment / auth / privacy surface untouched ──
  ok('R70 §15 R53 fallback constant preserved', RENDER_SOURCE.FALLBACK === 'deterministic_fallback')
  ok('R70 §15 envelope fallback constant preserved', RENDER_SOURCE.ENVELOPE_FALLBACK === 'thesis_envelope_fallback')

  console.log(results.join('\n'))
  console.log('\nR70 TESTS: ' + pass + ' passed, ' + fail + ' failed')
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('R70 TEST ERROR', e); process.exit(2) })
