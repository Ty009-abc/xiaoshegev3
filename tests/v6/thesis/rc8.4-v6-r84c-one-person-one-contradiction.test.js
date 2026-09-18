'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r84c-one-person-one-contradiction.test.js
 *
 * RC8.4 V6 R84-C — ONE PERSON + ONE CENTRAL CONTRADICTION + FIVE ANGLES.
 *
 * Covers §1–§22:
 *   centralContradiction spec · card01 profile-specific hook · card02 human
 *   identity · card03 self-story/escape mechanism · card04 human migration ·
 *   card05 resolves card01 (loop closed) · human language · personal-detail
 *   density · NO fake personality (§11) · NO paid-proof hallucination (§14,
 *   with future/hypothesis modality boundary) · anti-generic (§15) · programmer
 *   distinctiveness (§13) · UI diff = 0 (§17) · model calls = 1 (§18) ·
 *   budgets unchanged (§19) · profile writeback schema diff = 0 ·
 *   personalization runtime diff = 0.
 *
 * Deterministic. No network (stub provider). Reads the REAL runtime + prompt +
 * personality spec + guard.
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
const { runV4RestoredReportRuntimeV6, RENDER_SOURCE, buildPersonalityCtx } = require(path.join(TH, 'v4RestoredReportRuntimeV6.js'))
const { charLen, BUDGET } = require(path.join(TH, 'v4RestoredCompressV6.js'))
const GUARD = require(path.join(TH, 'v4RestoredCopyGuardV6.js'))
const P = require(path.join(TH, 'v4RestoredPersonalityV6.js'))
const { buildV4RestoredPrompt, PROMPT_VERSION } = require(path.join(TH, 'v4RestoredPromptV6.js'))
const { buildV4RestoredPayload } = require(path.join(TH, 'v4RestoredContextV6.js'))
const BRIDGE = require(path.join(CP, 'cognitiveProfileBridgeV6.js'))
const { buildPersonalizationFeed } = require(path.join(PERS, 'personalizationRuntimeV6.js'))

let pass = 0, fail = 0
const results = []
function ok (name, cond, extra) {
  if (cond) { pass++; results.push('  PASS ' + name) } else { fail++; results.push('  FAIL ' + name + (extra ? ' :: ' + extra : '')) }
}

const OWNER = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationDetail: '',
  monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE',
  skillValidation: 'PROOF_PAID_ONCE', monetizableSkill: 'ASSET_CONTENT', weeklyTime: 'TIME_20_PLUS',
  executionStability: 'EXEC_VOLATILE', pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION',
  decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_BALANCE', primaryProblem: 'PROBLEM_MONETIZE',
  primaryGoal: 'GOAL_SKILL_MONETIZE', maxTrialCost: 'COST_5K_20K', failureResponse: 'FAIL_GIVE_UP'
}
const PROGRAMMER = Object.assign({}, OWNER, { occupationDetail: '后端程序员', monetizableSkill: 'ASSET_TECHNICAL', primaryGoal: 'GOAL_SIDE_TO_MAIN' })
const CONTENT = Object.assign({}, OWNER, {
  occupationDetail: '', incomeStructure: 'INC_UNSTABLE', skillValidation: 'PROOF_FREE_THANKED',
  primaryProblem: 'PROBLEM_SIDE_UNSTARTED', primaryGoal: 'GOAL_SIDE_INCOME'
})

// A synthetic R84-C-quality OWNER output (PAID_ONCE): the same ONE contradiction
// is carried through all five angles; card05 resolves card01.
const GOOD = {
  strategicThesis: {
    identityInterpretation: '你是一个被市场付过一次钱、却仍把自己当没开始的内容创作者，用工资的安全感换掉了把这件事当生意的危险。',
    coreContradiction: '市场已经给过你一次答案，你却还在等自己准备好：现实（有人付过钱）与自我叙事（我还没开始）之间的裂缝。',
    systemTrap: '工资兜底 → 不做也不会立刻疼 → 继续告诉自己"还没准备好" → 没有第二次真实报价 → 没有新证据 → 更相信自己还没准备好。循环里工资是安全网，也是麻醉剂。',
    worldRule: '市场不为你的能力打分，只为一次具体的、有人掏钱的交付打分。一次付费是信号，不是结论。',
    strategicMigration: { from: '等别人偶尔发现你价值、被付过一次就满足的人', to: '主动把价值摆上市场、让陌生人反复用钱投票的人', steps: ['拆付费', '找买家', '跑复购'] },
    commercialThesis: { objective: '制造第二次和第三次独立付费，证明第一次不是运气。' }
  },
  cards: {
    card01: '市场已经给过你一次答案，你却还在等自己准备好。',
    card02: '你是一个「被付过一次钱、却还把自己当没开始的人」的内容创作者。工资在兜底，能力被验证过一次，但你把那次付费当成偶然。',
    card03: ['工资兜底，不做也不会立刻疼。', '于是你用"还没真正尝试""再准备一下"解释没结果，避免面对被拒绝。', '没有第二次真实报价，就没有新证据，你更相信自己还没准备好。'],
    card04: { from: '等别人偶尔发现你价值、被付过一次就满足的人', to: '主动把价值摆上市场、让陌生人反复用钱投票的人', steps: ['拆付费', '找买家', '跑复购'] },
    card05: {
      objective: '90天内，用内容创作能力制造第二次和第三次独立付费，证明第一次不是运气。',
      actions: [
        { title: '拆付费', text: '找出那次为你付钱的人，问清他当时为什么掏钱、买的是什么、拿到什么。' },
        { title: '找买家', text: '从过去一年接触过你内容的人里，挑3–5个真实潜在买家，直接给出一个明确报价。' },
        { title: '跑复购', text: '交付后问清他为什么付、会不会介绍别人、下次还买不买，把答案记下来。' }
      ],
      target: '3–5个真实潜在买家', timebox: '90天', successSignal: '有至少两个不是你原有人情关系的人，为你一个明确交付真实付了钱。'
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
  // ── §1/§2 ONE PERSON + ONE CENTRAL CONTRADICTION + FIVE ANGLES ──
  ok('R84C §1 personality block carries the one-contradiction contract', /一个人 = 一个核心矛盾 = 五个角度/.test(P.ONE_CONTRADICTION_BLOCK))
  ok('R84C §2 centralContradiction spec = REALITY × SELF-STORY', /核心矛盾 = 【现实已经证明的事实/.test(P.ONE_CONTRADICTION_BLOCK) && /自我叙事/.test(P.ONE_CONTRADICTION_BLOCK))
  ok('R84C §2 five angles mapped to five cards', /card01 = 矛盾的锋刃/.test(P.ONE_CONTRADICTION_BLOCK) && /card05 = 用现实行动去检验这个矛盾/.test(P.ONE_CONTRADICTION_BLOCK))
  ok('R84C §1/§18 personality block composed into the ONE system prompt (no second call)', /一个人 = 一个核心矛盾/.test(P.buildPersonalityBlock()))

  // ── §3 card01 profile-specific hook ──
  ok('R84C §3 card01 prefers a profile-specific signal over a generic frame', /优先使用画像里的具体信号/.test(P.CARD01_BLOCK))
  // ── §4 card02 human identity (not taxonomy) ──
  ok('R84C §4 card02 forbids taxonomy labels', /技能持有者 \/ 产品经营者 \/ 验证阶段用户/.test(P.CARD02_BLOCK))
  ok('R84C §4 card02 requires a person-ish identity tension', /人味的身份张力/.test(P.CARD02_BLOCK))
  // ── §5 card03 self-story → R84-D grounded behaviour/decision-pattern mechanism ──
  ok('R84C §5 card03 requires a grounded behaviour/decision-pattern mechanism', /行为\/决策模式/.test(P.CARD03_BLOCK) && /不是纯商业流程，也不是心理虚构/.test(P.CARD03_BLOCK))
  ok('R84D §12 card03 must explain behaviour, not mind-read (我凭什么这么判断)', /我凭什么这么判断/.test(P.CARD03_BLOCK))
  // ── §6 card04 human migration ──
  ok('R84C §6 card04 migration is a human identity change', /人的身份转变/.test(P.CARD04_BLOCK))
  // ── §7/§8 card05 resolves card01 ──
  ok('R84C §7 card05 attacks the SAME contradiction', /直接打【同一个核心矛盾】/.test(P.CARD05_BLOCK) && /回答 card01 提出的问题/.test(P.CARD05_BLOCK))
  ok('R84C §8 card05 owner-class validates repeatability of the first payment (R84-D downshift)', /验证第一次付费是否可重复/.test(P.CARD05_BLOCK))
  // ── §9 human language ──
  ok('R84C §9 human-language block reduces consulting nouns', /人话优先/.test(P.HUMAN_LANGUAGE_BLOCK) && /陌生人愿不愿意买/.test(P.HUMAN_LANGUAGE_BLOCK))
  // ── §10 density + §15 anti-generic ──
  ok('R84C §10/§15 anti-generic test present', /不可替换性测试/.test(P.ANTI_GENERIC_BLOCK) && /每一张卡/.test(P.ANTI_GENERIC_BLOCK))
  // ── §11 no fake personality ──
  ok('R84C §11 no-fake-personality block present', /禁止伪造人格/.test(P.NO_FAKE_PERSONALITY_BLOCK) && /你从小/.test(P.NO_FAKE_PERSONALITY_BLOCK))
  // ── §21 deterministic targets ──
  ok('R84C §21 DETERMINISTIC_TARGETS all zero (incl. PAID_PROOF/FAKE_PERSONALITY/GENERIC)',
    Object.keys(P.DETERMINISTIC_TARGETS).every((k) => P.DETERMINISTIC_TARGETS[k] === 0) &&
    P.DETERMINISTIC_TARGETS.PAID_PROOF_HALLUCINATION_COUNT === 0 &&
    P.DETERMINISTIC_TARGETS.FAKE_PERSONALITY_COUNT === 0 &&
    P.DETERMINISTIC_TARGETS.GENERIC_CARD_COUNT === 0)

  // ── §18 prompt version unchanged (R84-C does NOT touch the output contract) ──
  ok('R84C §18 PROMPT_VERSION unchanged from R84-A', PROMPT_VERSION === 'turnaround_strategy_v6_v4_restored_prompt_v2_r84a', PROMPT_VERSION)
  ok('R84C personality version superseded by R84-D (r84d_personality_v1)', P.PERSONALITY_VERSION === 'r84d_personality_v1' && P.R84C_VERSION === 'r84c_personality_v1' && P.R84D_VERSION === 'r84d_personality_v1')

  // ── §18 ONE model call through the REAL runtime ──
  const o = runHybridDiagnosisV6(OWNER)
  const fb = buildReportV6(o.diagnosis, o.hybridContext)
  const c1 = stubOnce(GOOD)
  const r1 = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: fb, callAI: c1 })
  ok('R84C §18 MODEL_CALL_COUNT_MAX = 1', c1.calls() === 1 && r1.meta.modelCalls === 1)
  ok('R84C §18 renders v4_restored', r1.renderSource === RENDER_SOURCE.AI, r1.renderSource)

  const v = r1.report.visibleCards
  const g = r1.report.visibleStats.r84cGuard
  ok('R84C runtime exposes the r84cGuard counts', !!g && typeof g.GENERIC_CARD_COUNT === 'number')

  // ── §14/§15/§11 owner control: all three targets = 0 ──
  ok('R84C §14 PAID_PROOF_HALLUCINATION_COUNT = 0 (owner)', g.PAID_PROOF_HALLUCINATION_COUNT === 0, JSON.stringify(g))
  ok('R84C §11 FAKE_PERSONALITY_COUNT = 0 (owner)', g.FAKE_PERSONALITY_COUNT === 0, JSON.stringify(g))
  ok('R84C §15 GENERIC_CARD_COUNT = 0 (owner)', g.GENERIC_CARD_COUNT === 0, JSON.stringify(g))

  // ── §3 card01 profile-specific (owner): carries a PAID_ONCE-class signal ──
  const ctx = buildPersonalityCtx(o.hybridProfile, o.hybridContext)
  const sig = GUARD.activeProfileSignals(ctx)
  ok('R84C §3 card01 uses a profile-specific signal', sig.some((s) => s.re.test(v.card01)), v.card01)
  ok('R84C §3 card01 sharpest-form collision (不是/却/而)', /不是|却|而/.test(v.card01))

  // ── §4 card02 human identity ──
  ok('R84C §4 card02 names a human identity, no taxonomy label', !/技能持有者|产品经营者|验证阶段用户/.test(v.card02), v.card02)
  ok('R84C §4 card02 carries profile signal', sig.some((s) => s.re.test(v.card02)), v.card02)

  // ── §5 card03 explains the self-story / escape mechanism ──
  const c3 = v.card03.steps.join('') + v.card03.rule
  ok('R84C §5 card03 contains a self-story/escape mechanism', /还没准备好|还没真正尝试|再准备一下|告诉自己|解释|麻醉剂/.test(c3), c3)

  // ── §7/§8 CARD01 ↔ CARD05 LOOP CLOSURE ──
  // by card05 (creating that second verification).
  const c5 = v.card05.goal + v.card05.actions.join('') + v.card05.acceptance
  ok('R84C §8 card05 resolves card01 (second verification created)', /第二次|第三次|独立付费|不是运气/.test(c5), c5)
  // §8/§20 hardening — a bare arrow-chain card03 rule must never ship, even when
  // systemTrap is itself an arrow chain (no elevated principle) AND card04.rule
  // has already claimed worldRule. It falls back to the thesis coreContradiction.
  const arrowThesis = {
    systemTrap: '工资兜底 → 不做也不会真疼 → 可以继续告诉自己"还没准备好" → 没有第二次证据。',
    worldRule: '市场只奖励敢标价的人。',
    coreContradiction: '现实已经给过一次答案，他却还在用"还没准备好"解释自己的停滞。'
  }
  const arrowCmp = {
    card01: v.card01, card02: v.card02,
    card03: { steps: ['a '.repeat(2).trim(), 'b'.repeat(5), 'c'.repeat(5)], rule: '工资兜底 → 继续告诉自己"还没准备好" → 不报价。' },
    card04: { from: v.card04.from, to: v.card04.to, rule: arrowThesis.worldRule },
    card05: { goal: v.card05.goal, actions: v.card05.actions, acceptance: v.card05.acceptance }
  }
  const arrowOut = GUARD.guardVisibleCards(arrowCmp, arrowThesis)
  ok('R84C §8 arrow-chain card03 rule never ships (falls back to coreContradiction)',
    (String(arrowOut.cmp.card03.rule).match(/[→>]/g) || []).length === 0 && arrowOut.counts.CARD03_DUPLICATE_CONCLUSION_COUNT === 0,
    JSON.stringify(arrowOut.cmp.card03.rule))
  const LOOP_CLOSED = /第二次|第三次|独立付费|不是运气/.test(c5) && /第一次|一次答案|准备好|第二次/.test(v.card01)
  ok('R84C §8 CARD01_CARD05_LOOP_CLOSED = YES', LOOP_CLOSED === true)

  // ── §19 budgets unchanged ──
  ok('R84C §19 budgets unchanged (40/140/220/160/240)', BUDGET.CARD01 === 40 && BUDGET.CARD02 === 140 && BUDGET.CARD03 === 220 && BUDGET.CARD04 === 160 && BUDGET.CARD05 === 240)
  ok('R84C §19 card01 within budget', charLen(v.card01) <= BUDGET.CARD01)
  ok('R84C §19 card02 within budget', charLen(v.card02) <= BUDGET.CARD02)

  // ── §14 paid-proof hallucination: NO-paid profile must not claim paid history ──
  const cOut = runHybridDiagnosisV6(CONTENT)
  const cCtx = buildPersonalityCtx(cOut.hybridProfile, cOut.hybridContext)
  ok('R84C §14 no-paid context detected (marketValidated=false)', cCtx.hasPaidProof === false)
  const hallucinated = Object.assign({}, GOOD.cards, { card02: '你已经有一批回头客，并且持续复购。' })
  const screened = GUARD.screenPersonality(hallucinated, null, cCtx)
  ok('R84C §14 paid-proof hallucination detected when unsupported', screened.counts.PAID_PROOF_HALLUCINATION_COUNT >= 1)
  // future/hypothesis is NOT a hallucination (goal: "拿到第二次付费")
  const plan = Object.assign({}, GOOD.cards, { card05: { objective: '90天拿到第二次付费并建立复购', actions: ['去对真实买家报价', '交付后问为什么付'], successSignal: '出现第二次独立付费' } })
  const planScreen = GUARD.screenPersonality(plan, null, cCtx)
  ok('R84C §14 future/hypothesis goal is NOT flagged as paid-proof claim', planScreen.counts.PAID_PROOF_HALLUCINATION_COUNT === 0)
  // owner WITH paid proof must not be flagged for the same words
  const ownerScreen = GUARD.screenPersonality(GOOD.cards, null, ctx)
  ok('R84C §14 owner paid-proof legit claim not flagged', ownerScreen.counts.PAID_PROOF_HALLUCINATION_COUNT === 0)

  // ── §11 fake personality: unsupported emotional history is detected, supported is not ──
  ok('R84C §11 unsupported "你从小就害怕失败" detected', !!GUARD.detectFakePersonality('你从小就害怕失败，所以你不敢报价。', ctx))
  ok('R84C §11 unsupported "你内心自卑/家庭影响" detected when unsupported',
    !!GUARD.detectFakePersonality('你内心自卑，所以才不敢报价。', ctx) &&
    !!GUARD.detectFakePersonality('你一直被家庭影响，所以不敢冒险。', ctx))
  const fp = GUARD.screenPersonality(Object.assign({}, GOOD.cards, { card01: '你从小就害怕失败，所以你不敢报价。' }), null, ctx)
  ok('R84C §11 unsupported fake personality is safely repaired out (no second model call)', /你从小/.test(GOOD.cards.card01) === false && !/你从小/.test(fp.cards.card01) && fp.counts.FAKE_PERSONALITY_COUNT === 0, fp.cards.card01)
  const fpOk = GUARD.screenPersonality(Object.assign({}, GOOD.cards, { card01: '你害怕被拒绝，所以不敢真的报价。' }), null, { hasPaidProof: true, selfBelief: 'BELIEF_FEAR' })
  ok('R84C §11 fear WITH profile support is NOT flagged', fpOk.counts.FAKE_PERSONALITY_COUNT === 0 && !GUARD.detectFakePersonality('你害怕被拒绝，所以不敢真的报价。', { selfBelief: 'BELIEF_FEAR' }))

  // ── §13 programmer distinctiveness ──
  const pOut = runHybridDiagnosisV6(PROGRAMMER)
  const pFb = buildReportV6(pOut.diagnosis, pOut.hybridContext)
  const cp = stubOnce(GOOD)
  const pr = await runV4RestoredReportRuntimeV6({ diagnosis: pOut.diagnosis, hybridProfile: pOut.hybridProfile, hybridContext: pOut.hybridContext, fallbackReport: pFb, callAI: cp })
  const pctx = buildPersonalityCtx(pOut.hybridProfile, pOut.hybridContext)
  const psig = GUARD.activeProfileSignals(pctx)
  ok('R84C §13 programmer carries a TECH/occupation signal', psig.some((s) => s.id === 'TECH_SKILL' || s.id === 'OCCUPATION'))
  ok('R84C §13 owner carries content signal, programmer carries tech signal (distinct)', sig.some((s) => s.id === 'CONTENT_SKILL') && psig.some((s) => s.id === 'TECH_SKILL'))
  ok('R84C §13 programmer report renders (matching input)', pr.renderSource === RENDER_SOURCE.AI)

  // ── §17 UI DIFF = 0: R84-C must not couple to any UI file ──
  const uiFiles = [
    'pages/turnaround-v6-report/turnaround-v6-report.wxml',
    'pages/turnaround-v6-report/turnaround-v6-report.wxss',
    'pages/turnaround-v6-report/turnaround-v6-report.js',
    'utils/v6/turnaroundReportViewModelV6.js'
  ]
  let uiTokenCount = 0
  for (const f of uiFiles) {
    const abs = path.join(ROOT, f)
    if (fs.existsSync(abs)) {
      const src = fs.readFileSync(abs, 'utf8')
      if (/r84c|centralContradiction|R84C/i.test(src)) uiTokenCount++
    }
  }
  ok('R84C §17 R84B_UI_DIFF_COUNT = 0 (no R84-C token coupled into UI/viewmodel)', uiTokenCount === 0, 'coupling=' + uiTokenCount)
  // R84-B structural tokens must remain intact
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/turnaround-v6-report/turnaround-v6-report.wxml'), 'utf8')
  ok('R84C §17 R84-B visual structure preserved (card-hero/card-identity/action-step-head)', /card-hero/.test(wxml) && /card-identity/.test(wxml) && /action-step-head/.test(wxml))

  // ── §17 profile writeback schema diff = 0 ──
  const patch = BRIDGE.buildCognitiveProfilePatch({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, report: r1.report, reportId: 'ARV6_r84c', ts: 1 })
  ok('R84C PROFILE_WRITEBACK_SCHEMA_DIFF_COUNT = 0 (schema version unchanged)', patch.profileSchemaVersion === 'cognitive_profile_v1')
  ok('R84C writeback sections unchanged', !!(patch.diagnosticState && patch.cognitiveState && patch.currentFocus && patch.learningHistory))

  // ── §17 personalization runtime diff = 0 ──
  const canonProfile = {
    present: true, isLegacy: false, dimensions: {},
    diagnosticState: { primaryBottleneck: { value: o.diagnosis.primaryBottleneck } },
    cognitiveState: { primaryBlindSpot: { expression: patch.cognitiveState.primaryBlindSpot.expression } },
    currentFocus: { worldRuleLensIds: patch.currentFocus.worldRuleLensIds, priorityTopicIds: patch.currentFocus.priorityTopicIds },
    learningHistory: { seenRuleIds: [], seenInsightIds: [], seenStrikeIds: [] }
  }
  const feed = buildPersonalizationFeed({ profile: canonProfile, worldRules: [{ ruleId: 'WR016', tags: [] }], insights: [{ insightId: 'DI001', tags: ['付费'], difficulty: 1 }], strikes: [{ id: 'STRIKE_000', dimensions: [] }], dayIndex: 20712 })
  ok('R84C PERSONALIZATION_RUNTIME_DIFF_COUNT = 0 (feed shape unchanged)', feed && feed.worldRule && feed.dailyInsight && feed.strike && ('personalized' in feed))

  // ── §2 ONE thesis: all five cards trace to the same contradiction ──
  const allCards = [v.card01, v.card02, v.card03.steps.join(''), v.card03.rule, v.card04.from, v.card04.to, v.card04.rule, v.card05.goal, v.card05.actions.join('')].join('')
  const thesisKeys = ['付费', '市场', '报价', '准备', '工资'].filter((k) => allCards.indexOf(k) !== -1)
  ok('R84C §2 ONE_CONTRADICTION_COHERENCE (shared vocabulary >= 3)', thesisKeys.length >= 3, thesisKeys.join(','))

  // ── §9 human language (no raw consulting-noun pile-up in the owner visible set) ──
  const consultingNouns = (allCards.match(/市场验证|价值结构|商业闭环|可重复交付|经营系统/g) || []).length
  ok('R84C §9 consulting-noun density stays low', consultingNouns <= 2, 'count=' + consultingNouns)

  console.log(results.join('\n'))
  console.log('\nR84-C TESTS: ' + pass + ' passed, ' + fail + ' failed')
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('R84-C TEST ERROR', e); process.exit(2) })
