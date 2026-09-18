'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r84d-causal-grounding.test.js
 *
 * RC8.4 V6 R84-D — CAUSAL GROUNDING + EVIDENCE DISCIPLINE.
 *
 * Covers §1–§28:
 *   evidence classes frozen · mortgage != safety net · debt != buffer ·
 *   stable-income vs mortgage distinction · psychological causality discipline ·
 *   mind-reading detection · paid-once contradiction preserved · Card03 grounded
 *   causal chain (no invention) · Card04 non-absolute world rule · Card05
 *   probabilistic validation · no-paid control · programmer distinctiveness ·
 *   owner mortgage causal bug fixture (§19) · arbitrary-count audit (§17) ·
 *   anti-overrepair (§24) · UI freeze (§25) · one model call (§26) ·
 *   profile compatibility (§19 R84-D).
 *
 * Deterministic. No network (stub provider). Reads the REAL runtime + prompt +
 * personality spec + grounding + guard.
 */

const path = require('path')
const fs = require('fs')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib')
const TH = path.join(CF, 'turnaroundStrategy/v6/thesis')
const CP = path.join(CF, 'cognitiveProfile')
const PERS = path.join(CF, 'cognitiveProfile/personalization')

const { runHybridDiagnosisV6 } = require(path.join(CF, 'turnaroundStrategy/v6/hybrid/hybridDiagnosisV6.js'))
const { buildReportV6 } = require(path.join(CF, 'turnaroundStrategy/v6/report/reportBuilderV6.js'))
const { runV4RestoredReportRuntimeV6, RENDER_SOURCE, buildPersonalityCtx, buildGroundingCtx } = require(path.join(TH, 'v4RestoredReportRuntimeV6.js'))
const { charLen, BUDGET } = require(path.join(TH, 'v4RestoredCompressV6.js'))
const G = require(path.join(TH, 'v4RestoredGroundingV6.js'))
const GUARD = require(path.join(TH, 'v4RestoredCopyGuardV6.js'))
const P = require(path.join(TH, 'v4RestoredPersonalityV6.js'))
const { PROMPT_VERSION } = require(path.join(TH, 'v4RestoredPromptV6.js'))
const BRIDGE = require(path.join(CP, 'cognitiveProfileBridgeV6.js'))
const { buildPersonalizationFeed } = require(path.join(PERS, 'personalizationRuntimeV6.js'))

let pass = 0, fail = 0
const results = []
function ok (name, cond, extra) {
  if (cond) { pass++; results.push('  PASS ' + name) } else { fail++; results.push('  FAIL ' + name + (extra ? ' :: ' + extra : '')) }
}

// OWNER (R84-D real-device fixture): paid once, content skill, mortgage debt.
// NOTE debtPressure = DEBT_MORTGAGE — the exact case that produced 房贷-as-safety-net.
const OWNER = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationDetail: '',
  monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_MORTGAGE',
  skillValidation: 'PROOF_PAID_ONCE', monetizableSkill: 'ASSET_CONTENT', weeklyTime: 'TIME_20_PLUS',
  executionStability: 'EXEC_VOLATILE', pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION',
  decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_BALANCE', primaryProblem: 'PROBLEM_MONETIZE',
  primaryGoal: 'GOAL_SKILL_MONETIZE', maxTrialCost: 'COST_5K_20K', failureResponse: 'FAIL_GIVE_UP'
}
const PROGRAMMER = Object.assign({}, OWNER, { occupationDetail: '后端程序员', monetizableSkill: 'ASSET_TECHNICAL', primaryGoal: 'GOAL_SIDE_TO_MAIN' })
const NO_PAID = Object.assign({}, OWNER, {
  occupationDetail: '', incomeStructure: 'INC_UNSTABLE', skillValidation: 'PROOF_FREE_THANKED',
  primaryProblem: 'PROBLEM_SIDE_UNSTARTED', primaryGoal: 'GOAL_SIDE_INCOME', debtPressure: 'DEBT_NONE'
})

// The R84-D BAD owner output = the exact real-device defect (mortgage psychology).
const BAD = {
  strategicThesis: {
    identityInterpretation: '你是一个被付过一次钱、却还没把一次成交变成重复验证的内容创作者。',
    coreContradiction: '现实已经证明有人为他的内容创作能力付过一次钱；他仍用"还没准备好"解释停滞。',
    systemTrap: '工资兜底 → 不做也不会立刻疼 → 继续准备而不报价 → 没有第二次市场证据。房贷是安全网，也是麻醉剂。',
    worldRule: '市场只认第二次、第三次付费，第一次不算数。',
    strategicMigration: { from: '等别人偶尔发现你价值、被付过一次就满足的人', to: '主动把价值摆上市场、让陌生人用钱投票的人', steps: ['拆付费', '找买家', '跑复购'] },
    commercialThesis: { objective: '证明第一次不是运气。' }
  },
  cards: {
    card01: '你其实觉得第一次只是运气，所以你不敢再报价。',
    card02: '你是一个靠工资兜底、被付过一次钱的内容创作者，房贷给了你安全感，所以你不着急。',
    card03: ['工资兜底，所以失败也不疼。', '因为有房贷，内容收入断了也不影响生活，所以你敢一直拖着。', '房贷是安全网，也是麻醉剂，让你可以继续告诉自己"还没准备好"。'],
    card04: { from: '等别人偶尔发现你价值、被付过一次就满足的人', to: '主动把价值摆上市场的人', steps: ['拆付费', '找买家'] },
    card05: {
      objective: '90天内证明第一次付费不是运气。',
      actions: [
        { title: '找买家', text: '对至少10个真实潜在买家报价，证明不是运气。' },
        { title: '跑复购', text: '交付后问清他为什么付，必然能得到答案。' }
      ],
      target: '10个潜在买家', timebox: '90天', successSignal: '证明第一次不是运气，市场只认第二次付费。'
    }
  }
}

// The R84-D GOOD owner output: same ONE contradiction, grounded causality.
const GOOD = {
  strategicThesis: {
    identityInterpretation: '你是一个被市场付过一次钱、却还没把一次成交变成重复验证的内容创作者。',
    coreContradiction: '市场已经给过一次答案，你还没把第二次验证做出来。',
    systemTrap: '稳定工资降低短期变现压力 → 一次成交没有继续被验证 → 缺少第二次真实价格/买家反馈 → 仍无法判断这项能力是否可重复变现。缺的不是再准备，而是第二次真实市场反馈。',
    worldRule: '一次付费说明有人愿意买；重复付费才开始说明这件事可复制。',
    strategicMigration: { from: '等别人偶尔发现你价值、被付过一次就满足的人', to: '主动把价值摆上市场、让陌生人用钱投票的人', steps: ['拆付费', '找买家', '跑复购'] },
    commercialThesis: { objective: '验证第一次付费是否具备可重复性。' }
  },
  cards: {
    card01: '市场已经给过你一次答案，你还没把第二次验证做出来。',
    card02: '你是一个被市场付过一次钱、却还没把一次成交变成重复验证的内容创作者。',
    card03: ['稳定工资降低了短期变现压力。', '一次成交没有继续被验证。', '缺少第二次真实报价和买家反馈，你仍无法判断这项能力是否可重复变现。'],
    card04: { from: '等别人偶尔发现你价值、被付过一次就满足的人', to: '主动把价值摆上市场、让陌生人用钱投票的人', steps: ['拆付费', '找买家'] },
    card05: {
      objective: '90天内验证第一次付费是否可重复。',
      actions: [
        { title: '拆付费', text: '找出那次为你付钱的人，问清他当时为什么掏钱、买的是什么。' },
        { title: '找买家', text: '从接触过你内容的人里挑3–5个真实潜在买家，给出一个明确报价。' }
      ],
      target: '3–5个真实潜在买家', timebox: '90天', successSignal: '出现第二个与你没有人情关系的人真实付费。'
    }
  }
}

function stubOnce (obj) {
  let n = 0
  const fn = async () => { n++; return { success: true, content: JSON.stringify(obj), tokens: 900, finishReason: 'stop' } }
  fn.calls = () => n
  return fn
}

async function main () {
  // ── §2 EVIDENCE CLASSES frozen ──
  ok('R84D §2 four evidence classes frozen', G.EVIDENCE_CLASSES.join(',') === 'OBSERVED,DERIVED,INFERRED,HYPOTHESIS')
  ok('R84D §2 grounding version marker present', G.GROUNDING_VERSION === 'r84d_grounding_v1')

  // ── §3/§4 MORTGAGE != SAFETY NET ──
  const oCtx = buildGroundingCtx(runHybridDiagnosisV6(OWNER).hybridProfile, runHybridDiagnosisV6(OWNER).hybridContext)
  ok('R84D §3 owner grounding context carries DEBT_MORTGAGE', oCtx.debtPressure === 'DEBT_MORTGAGE')
  ok('R84D §4 mortgage-as-safety-net is classified as a defect', !!G.classifyClause('房贷是安全网，也是麻醉剂。', oCtx))
  ok('R84D §4 "房贷兜底" classified as defect', !!G.classifyClause('房贷兜底，所以失败不疼。', oCtx))
  ok('R84D §4 allowed mortgage framing is NOT a defect', G.classifyClause('房贷是每月固定支出，会抬高试错成本。', oCtx) === null)
  const mFix = G.screenGrounding({ card01: '', card02: '', card03: { steps: [], rule: '房贷是安全网，也是麻醉剂。' }, card04: { from: '', to: '', rule: '' }, card05: { goal: '', actions: [], acceptance: '' } }, null, oCtx, {})
  ok('R84D §4 MORTGAGE_AS_SAFETY_NET_COUNT = 0 after repair', mFix.counts.MORTGAGE_AS_SAFETY_NET_COUNT === 0, JSON.stringify(mFix.counts))
  ok('R84D §4 repaired text is the allowed constraint frame', /固定支出|试错成本/.test(mFix.cards.card03.rule), mFix.cards.card03.rule)

  // ── §3 DEBT != BUFFER ──
  ok('R84D §3 debt-as-buffer classified as defect', !!G.classifyClause('负债是你的缓冲垫，让你可以不着急。', oCtx))
  const dFix = G.screenGrounding({ card01: '', card02: '', card03: { steps: [], rule: '负债是安全网，所以你敢一直拖。' }, card04: { from: '', to: '', rule: '' }, card05: { goal: '', actions: [], acceptance: '' } }, null, oCtx, {})
  ok('R84D §3 DEBT_AS_BUFFER_COUNT = 0 after repair', dFix.counts.DEBT_AS_BUFFER_COUNT === 0)

  // ── §5 STABLE INCOME vs MORTGAGE distinction ──
  ok('R84D §5 stable income lowering cash-flow pressure is ALLOWED', G.classifyClause('稳定工资降低了短期现金流压力。', oCtx) === null)
  ok('R84D §5 but complacency from the same cushion is NOT', !!G.classifyClause('工资兜底，所以你敢一直拖、失败也不疼。', oCtx))
  ok('R84D §5 complacency is detected independent of instrument', !!G.classifyClause('你根本不着急，反正失败对你不疼。', oCtx))

  // ── §6 PSYCHOLOGICAL CAUSALITY ──
  ok('R84D §6 assertion-style mind-read is a defect', !!G.classifyClause('你就是一直认为自己在准备。', oCtx))
  const supported = { debtPressure: 'DEBT_MORTGAGE', selfBelief: 'BELIEF_KNOW_NO_ACTION', hasPaidProof: true }
  ok('R84D §6 user-stated "知道该做什么" is supported (selfBelief)', G.classifyClause('你知道该做什么，但没有行动。', supported) === null)
  const fearSupported = { selfBelief: 'BELIEF_FEAR', hasPaidProof: true }
  ok('R84D §6 fear phrased WITH profile support is NOT a defect', G.classifyClause('你害怕被拒绝，所以不敢真的报价。', fearSupported) === null)

  // ── §14 ABSOLUTE MARKET CLAIMS ──
  ok('R84D §14 "市场只认第二次" classified as absolute', !!G.classifyClause('市场只认第二次、第三次付费。', oCtx))
  ok('R84D §14 comma-span absolutism caught (市场不认X，只认Y)', !!G.classifyClause('市场不认“我有本事”，只认“有人第二次还愿意掏钱”。', oCtx))
  const aFix2 = G.screenGrounding({ card01: '', card02: '', card03: { steps: [], rule: '' }, card04: { from: '', to: '', rule: '市场不认“我有本事”，只认“有人第二次还愿意掏钱”。' }, card05: { goal: '', actions: [], acceptance: '' } }, null, oCtx, {})
  ok('R84D §14 comma-span absolutism downshifted clean', aFix2.counts.ABSOLUTE_MARKET_CLAIM_COUNT === 0 && !/只认/.test(aFix2.cards.card04.rule), aFix2.cards.card04.rule)
  const aFix = G.screenGrounding({ card01: '', card02: '', card03: { steps: [], rule: '' }, card04: { from: '', to: '', rule: '市场只认第二次、第三次付费。' }, card05: { goal: '', actions: [], acceptance: '' } }, null, oCtx, {})
  ok('R84D §14 ABSOLUTE_MARKET_CLAIM_COUNT = 0 after downshift', aFix.counts.ABSOLUTE_MARKET_CLAIM_COUNT === 0)
  ok('R84D §14 absolute claim downshifted (not deleted)', /更看重|开始说明|可复制/.test(aFix.cards.card04.rule), aFix.cards.card04.rule)

  // ── §15/§16 CERTAINTY OVERSTATEMENT ──
  ok('R84D §16 "证明第一次不是运气" classified as certainty', !!G.classifyClause('证明第一次不是运气。', oCtx))
  const cFix = G.screenGrounding({ card01: '', card02: '', card03: { steps: [], rule: '' }, card04: { from: '', to: '', rule: '' }, card05: { goal: '', actions: [], acceptance: '证明第一次不是运气。' } }, null, oCtx, {})
  ok('R84D §16 CERTAINTY_OVERSTATEMENT_COUNT = 0 after downshift', cFix.counts.CERTAINTY_OVERSTATEMENT_COUNT === 0)
  ok('R84D §16 downshifted to probabilistic validation', /是否具备可重复性|验证/.test(cFix.cards.card05.acceptance), cFix.cards.card05.acceptance)

  // ── §17 ARBITRARY COUNTS (measure + rationale) ──
  ok('R84D §17 arbitrary threshold "至少10个客户" counted', G.countArbitraryNumbers('你需要至少10个客户才能验证。') === 1)
  ok('R84D §17 experiment-design counts "3–5个买家" NOT counted as arbitrary threshold', G.countArbitraryNumbers('挑3–5个真实潜在买家报价。') === 0)

  // ── §28 personality spec carries the R84-D grounding blocks ──
  ok('R84D §1 prompt spec = SHARP ≠ SPECULATIVE + 我凭什么这么判断', /锋利 ≠ 臆测/.test(P.buildPersonalityBlock()) && /我凭什么这么判断/.test(P.buildPersonalityBlock()))
  ok('R84D §3/§4 financial-semantics block present', /房贷 \/ 负债 \/ 贷款/.test(P.FINANCIAL_SEMANTICS_BLOCK) && /固定现金流约束/.test(P.FINANCIAL_SEMANTICS_BLOCK))
  ok('R84D §6 psychological-discipline block present', /心理因果纪律/.test(P.PSYCHOLOGICAL_DISCIPLINE_BLOCK) && /更像/.test(P.PSYCHOLOGICAL_DISCIPLINE_BLOCK))
  ok('R84D §15 probability-discipline block present', /概率措辞/.test(P.PROBABILITY_DISCIPLINE_BLOCK) && /市场只认/.test(P.PROBABILITY_DISCIPLINE_BLOCK))
  ok('R84D §14 offending prompt example removed (old 工资是安全网 directing example gone)', !/这个循环里，工资是安全网/.test(P.buildPersonalityBlock()) && /缺的不是再准备/.test(P.buildPersonalityBlock()))
  ok('R84D §11 offending prompt example replaced with grounded loop', /一次成交没有继续被验证/.test(P.CARD03_BLOCK))
  ok('R84D §27 deterministic targets all zero (incl. mortgage/mindread/absolute)', Object.keys(P.DETERMINISTIC_TARGETS).every((k) => P.DETERMINISTIC_TARGETS[k] === 0) &&
    P.DETERMINISTIC_TARGETS.MORTGAGE_AS_SAFETY_NET_COUNT === 0 && P.DETERMINISTIC_TARGETS.CARD01_UNSUPPORTED_MINDREAD_COUNT === 0 &&
    P.DETERMINISTIC_TARGETS.ABSOLUTE_MARKET_CLAIM_COUNT === 0 && P.DETERMINISTIC_TARGETS.OWNER_MORTGAGE_CAUSAL_BUG_COUNT === 0)
  ok('R84D §25 PROMPT_VERSION unchanged (output contract frozen)', PROMPT_VERSION === 'turnaround_strategy_v6_v4_restored_prompt_v2_r84a', PROMPT_VERSION)
  ok('R84D personality version bumped to r84d', P.PERSONALITY_VERSION === 'r84d_personality_v1' && P.R84D_VERSION === 'r84d_personality_v1')

  // ── §19 OWNER REAL-DEVICE BUG FIXTURE: the exact defect must be repaired ──
  const o = runHybridDiagnosisV6(OWNER)
  const fb = buildReportV6(o.diagnosis, o.hybridContext)
  const cBad = stubOnce(BAD)
  const rBad = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: fb, callAI: cBad })
  const gBad = rBad.report.visibleStats.r84dGuard
  ok('R84D §19 owner fixture repaired: MORTGAGE_AS_SAFETY_NET_COUNT = 0', gBad.MORTGAGE_AS_SAFETY_NET_COUNT === 0, JSON.stringify(gBad))
  ok('R84D §19 OWNER_MORTGAGE_CAUSAL_BUG_COUNT = 0', gBad.OWNER_MORTGAGE_CAUSAL_BUG_COUNT === 0)
  ok('R84D §19 UNSUPPORTED_CAUSAL_CLAIM_COUNT = 0', gBad.UNSUPPORTED_CAUSAL_CLAIM_COUNT === 0)
  ok('R84D §14 ABSOLUTE_MARKET_CLAIM_COUNT = 0', gBad.ABSOLUTE_MARKET_CLAIM_COUNT === 0)
  ok('R84D §15 CERTAINTY_OVERSTATEMENT_COUNT = 0', gBad.CERTAINTY_OVERSTATEMENT_COUNT === 0)
  ok('R84D §8 CARD01_UNSUPPORTED_MINDREAD_COUNT = 0', gBad.CARD01_UNSUPPORTED_MINDREAD_COUNT === 0)
  const badVis = rBad.report.visibleCards
  const badAll = [badVis.card01, badVis.card02, badVis.card03.steps.join(''), badVis.card03.rule, badVis.card04.from, badVis.card04.to, badVis.card04.rule, badVis.card05.goal, badVis.card05.actions.join(''), badVis.card05.acceptance].join('\n')
  ok('R84D §19 no 房贷 safety-net / 麻醉剂 text ships', !/安全网|麻醉剂|房贷兜底|房贷给你安全感/.test(badAll), badAll.slice(0, 120))
  ok('R84D §19 no mind-read 你觉得第一次只是运气 ships', !/只是运气/.test(badAll))
  ok('R84D §19 no absolute 市场只认 ships', !/市场只认/.test(badAll))
  ok('R84D §19 no certainty 证明.*不是运气 ships', !/证明[^。]{0,10}不是运气/.test(badAll))
  ok('R84D §26 MODEL_CALL_COUNT_MAX = 1 on the repaired real-device run', cBad.calls() === 1 && rBad.meta.modelCalls === 1)

  // ── §29 GROUNDED owner output: same contradiction, grounded causality ──
  const cGood = stubOnce(GOOD)
  const rGood = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: fb, callAI: cGood })
  ok('R84D §29 renders v4_restored (grounded owner output)', rGood.renderSource === RENDER_SOURCE.AI, rGood.renderSource)
  const v = rGood.report.visibleCards
  const gGood = rGood.report.visibleStats.r84dGuard
  ok('R84D §29 grounded output has zero grounding defects', gGood.MORTGAGE_AS_SAFETY_NET_COUNT === 0 && gGood.COMPLACENCY_CAUSALITY_COUNT === 0 && gGood.UNSUPPORTED_CAUSAL_CLAIM_COUNT === 0 && gGood.ABSOLUTE_MARKET_CLAIM_COUNT === 0 && gGood.CERTAINTY_OVERSTATEMENT_COUNT === 0, JSON.stringify(gGood))
  // §7/§20 the contradiction is preserved (reality vs behaviour, not invented psych)
  const allGood = [v.card01, v.card02, v.card03.steps.join(''), v.card03.rule, v.card04.rule, v.card05.goal, v.card05.acceptance].join('')
  ok('R84D §7 paid-once contradiction preserved (一次答案 / 第二次)', /一次答案|第二次|重复验证|可重复/.test(allGood))
  ok('R84D §20 paid-once owner target: no repeat proof claimed as existing', !/已经有第二次|已经有了复购|已有回头客/.test(allGood))
  // §12 card03 = behavioural, not mind-reading
  ok('R84D §12 card03 grounded causal chain (behaviour not psych)', /没有继续被验证|缺少第二次|可重复变现|降低短期/.test(v.card03.steps.join('')) || /第二次真实市场反馈/.test(v.card03.rule))
  // §11 grounded card03 never ships a bare arrow chain
  ok('R84D §11 card03 rule carries no arrow chain', (String(v.card03.rule).match(/[→>]/g) || []).length === 0, v.card03.rule)
  // §14/§16 card04/05 probabilistic
  ok('R84D §14 card04 world rule is non-absolute', !/只认|只看|必然|一定/.test(v.card04.rule), v.card04.rule)
  ok('R84D §16 card05 validation is probabilistic', !/不是运气/.test(v.card05.acceptance), v.card05.acceptance)
  // §26 ONE call
  ok('R84D §26 MODEL_CALL_COUNT_MAX = 1 (grounded run)', cGood.calls() === 1 && rGood.meta.modelCalls === 1)

  // ── §21 PROGRAMMER distinctiveness (grounding must not flatten to generic) ──
  const pOut = runHybridDiagnosisV6(PROGRAMMER)
  const pFb = buildReportV6(pOut.diagnosis, pOut.hybridContext)
  const pc = stubOnce(GOOD)
  const pr = await runV4RestoredReportRuntimeV6({ diagnosis: pOut.diagnosis, hybridProfile: pOut.hybridProfile, hybridContext: pOut.hybridContext, fallbackReport: pFb, callAI: pc })
  const pctx = buildPersonalityCtx(pOut.hybridProfile, pOut.hybridContext)
  const psig = GUARD.activeProfileSignals(pctx)
  const osig = GUARD.activeProfileSignals(buildPersonalityCtx(o.hybridProfile, o.hybridContext))
  ok('R84D §21 programmer keeps TECH/occupation signal after grounding', psig.some((s) => s.id === 'TECH_SKILL' || s.id === 'OCCUPATION'))
  ok('R84D §21 OWNER_VS_PROGRAMMER_DISTINCTIVENESS = PASS (owner content vs programmer tech)',
    osig.some((s) => s.id === 'CONTENT_SKILL') && psig.some((s) => s.id === 'TECH_SKILL'))
  ok('R84D §21 programmer report renders with zero grounding defects', pr.renderSource === RENDER_SOURCE.AI && pr.report.visibleStats.r84dGuard.UNSUPPORTED_CAUSAL_CLAIM_COUNT === 0)

  // ── §22 NO-PAID control: must not inherit owner logic ──
  const nOut = runHybridDiagnosisV6(NO_PAID)
  const nCtx = buildPersonalityCtx(nOut.hybridProfile, nOut.hybridContext)
  ok('R84D §22 no-paid context has marketValidated = false', nCtx.hasPaidProof === false)
  const nFb = buildReportV6(nOut.diagnosis, nOut.hybridContext)
  const nc = stubOnce(GOOD)
  const nr = await runV4RestoredReportRuntimeV6({ diagnosis: nOut.diagnosis, hybridProfile: nOut.hybridProfile, hybridContext: nOut.hybridContext, fallbackReport: nFb, callAI: nc })
  ok('R84D §22 PAID_PROOF_HALLUCINATION_COUNT = 0 (no-paid control)', nr.report.visibleStats.r84cGuard.PAID_PROOF_HALLUCINATION_COUNT === 0)

  // ── §23 CAUSAL CLAIM AUDIT — every flagged claim maps to a class + support ──
  const audit = G.auditClaims(BAD.cards.card03.join('') + BAD.cards.card04.rule + BAD.cards.card05.successSignal, 'audit', oCtx)
  ok('R84D §23 causal audit returns claims with evidence class + support flag',
    audit.length >= 3 && audit.every((a) => G.EVIDENCE_CLASSES.indexOf(a.evidenceClass) !== -1 && typeof a.supported === 'boolean'))
  ok('R84D §23 every unsupported claim in the BAD fixture is flagged unsupported', audit.some((a) => a.supported === false && a.type === 'MORTGAGE_SAFETY'))
  // after repair, the shipped causal set has NO unsupported claims
  const auditFixed = G.auditClaims(v.card03.steps.join('') + v.card03.rule + v.card04.rule + v.card05.acceptance, 'audit', oCtx)
  ok('R84D §23 repaired owner causal set contains NO unsupported claim', auditFixed.every((a) => a.supported === true))

  // ── §24 ANTI-OVERREPAIR: personality + specificity + memorability survive ──
  const personalitySignals = osig.map((s) => s.id)
  const memorabilityHit = /第二次|一次答案|可重复|验证/.test(v.card01)
  ok('R84D §24 anti-overrepair: owner personality survives (profile signals present)', personalitySignals.length >= 2, personalitySignals.join(','))
  ok('R84D §24 anti-overrepair: owner card01 remains memorable/colliding', memorabilityHit, v.card01)
  ok('R84D §24 anti-overrepair: grounding screen did not blank any required field',
    !!(v.card01 && v.card02 && v.card03.rule && v.card04.from && v.card04.to && v.card05.goal && v.card05.acceptance))

  // ── §25 UI FREEZE = 0 ──
  const uiFiles = [
    'pages/turnaround-v6-report/turnaround-v6-report.wxml',
    'pages/turnaround-v6-report/turnaround-v6-report.wxss',
    'pages/turnaround-v6-report/turnaround-v6-report.js',
    'utils/v6/turnaroundReportViewModelV6.js'
  ]
  let uiCoupling = 0
  for (const f of uiFiles) {
    const abs = path.join(ROOT, f)
    if (fs.existsSync(abs) && /r84d|grounding|R84D/i.test(fs.readFileSync(abs, 'utf8'))) uiCoupling++
  }
  ok('R84D §25 R84B_UI_DIFF_COUNT = 0 (no R84-D token coupled into UI/viewmodel)', uiCoupling === 0, 'coupling=' + uiCoupling)
  ok('R84D §25 frozen budgets unchanged (40/140/220/160/240)', BUDGET.CARD01 === 40 && BUDGET.CARD02 === 140 && BUDGET.CARD03 === 220 && BUDGET.CARD04 === 160 && BUDGET.CARD05 === 240)

  // ── §19 PROFILE COMPATIBILITY: writeback + personalization runtime unchanged ──
  const patch = BRIDGE.buildCognitiveProfilePatch({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, report: rGood.report, reportId: 'ARV6_r84d', ts: 1 })
  ok('R84D §19 PROFILE_WRITEBACK_SCHEMA_DIFF_COUNT = 0', patch.profileSchemaVersion === 'cognitive_profile_v1')
  ok('R84D §19 writeback sections unchanged', !!(patch.diagnosticState && patch.cognitiveState && patch.currentFocus && patch.learningHistory))
  const canonProfile = {
    present: true, isLegacy: false, dimensions: {},
    diagnosticState: { primaryBottleneck: { value: o.diagnosis.primaryBottleneck } },
    cognitiveState: { primaryBlindSpot: { expression: patch.cognitiveState.primaryBlindSpot.expression } },
    currentFocus: { worldRuleLensIds: patch.currentFocus.worldRuleLensIds, priorityTopicIds: patch.currentFocus.priorityTopicIds },
    learningHistory: { seenRuleIds: [], seenInsightIds: [], seenStrikeIds: [] }
  }
  const feed = buildPersonalizationFeed({ profile: canonProfile, worldRules: [{ ruleId: 'WR016', tags: [] }], insights: [{ insightId: 'DI001', tags: ['付费'], difficulty: 1 }], strikes: [{ id: 'STRIKE_000', dimensions: [] }], dayIndex: 20712 })
  ok('R84D §19 PERSONALIZATION_RUNTIME_DIFF_COUNT = 0 (feed shape unchanged)', feed && feed.worldRule && feed.dailyInsight && feed.strike && ('personalized' in feed))

  console.log(results.join('\n'))
  console.log('\nR84-D TESTS: ' + pass + ' passed, ' + fail + ' failed')
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('R84-D TEST ERROR', e); process.exit(2) })
