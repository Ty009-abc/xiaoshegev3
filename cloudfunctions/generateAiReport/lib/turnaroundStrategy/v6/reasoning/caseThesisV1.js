'use strict'
/**
 * turnaroundStrategy/v6/reasoning/caseThesisV1.js
 *
 * R87B1 §6/§7/§8 — CASE THESIS V1 + CLAIM LEDGER + ANTI-BIAS SWITCH.
 *
 * caseThesis = {
 *   realityFacts, primaryContradiction, secondaryContradiction?,
 *   primaryDerivedInsight, hiddenMechanism, reinforcementLoop, strategicSwitch,
 *   realityExperiment, worldModelExplanation, claimLedger
 * }
 *
 * This module CONSTRUCTS the semantics only. It does NOT replace production
 * five-card rendering (R87B1 is core-only).
 *
 * Anti-bias (§8): the engine must NOT assume
 *   副业>主业 · 自己定价>公司定价 · 客户付费>工资 · 创业>就业 · 辞职>留任.
 * It supports 6 switch outcomes and never forces a switch.
 *
 * Deterministic. Pure. No AI. No I/O. No network.
 */

const path = require('path')
const RE = require(path.join(__dirname, 'realityEvidenceV1.js'))

const CASE_THESIS_VERSION = 'r87b1_case_thesis_v1'

const SWITCH_OUTCOMES = Object.freeze([
  'STAY_AND_UPGRADE', 'ADD_OPTIONALITY', 'CHANGE_ALLOCATION',
  'CHANGE_GAME', 'RUN_TEST_FIRST', 'NO_SWITCH_YET'
])

const CLAIM_LEVEL = Object.freeze({
  L1: 'L1_OBSERVED_FACT',
  L2: 'L2_STRONG_DERIVATION',
  L3: 'L3_TESTABLE_HYPOTHESIS'
})

// ── §8 ANTI-BIAS SWITCH RESOLVER ───────────────────────────────────────────
// Preconditions are checked in order; each returns a switch outcome.
// The resolver NEVER treats "employee" as inferior or "business" as superior.
function resolveSwitch (evidence, contradiction, insight) {
  const f = evidence.derivedFlags
  const priceSelf = f.pricingSelf
  const proofPaid = f.proofPaid
  const econHealthy = !f.surplusLow && !f.debtHigh

  // 1. HIGH PRICING AUTHORITY + already validated → keep the game, upgrade inside it.
  if (priceSelf && proofPaid && econHealthy) {
    return mk('STAY_AND_UPGRADE', '你已经自己定价且被市场付费验证，缓冲也健康——正确动作是留在当前局里把已有优势放大，而不是换赛道。')
  }
  // 2. DEBT / CASHFLOW FIRST → do not switch anything until buffer repaired.
  if (f.debtHigh || f.surplusLow) {
    return mk('NO_SWITCH_YET', '债务/现金流是硬约束：在任何切换或扩张之前，先把缓冲修好，否则一次波动就打回原点。')
  }
  // 3. ALREADY MARKET-VALIDATED (paid proof) but not self-priced → add optionality
  //    (anti-bias: never tell an already-validated person to "get validated first").
  if (proofPaid && !priceSelf) {
    return mk('ADD_OPTIONALITY', '你已经被市场付费验证过，但定价权不在你手里——正确动作是在保住现收入的同时，增加一条由你或市场直接定价的第二线。')
  }
  // 4. STABLE + STRONG BUFFER + external pricing, hasn't acted → run a bounded test.
  if (f.incomeStable && f.pricingExternal && f.safetyStrong) {
    return mk('RUN_TEST_FIRST', '你有别人没有的缓冲，却一直没动——正确动作是用缓冲跑一次最小现实检验，而不是继续等。')
  }
  // 5. CAPABILITY_UNEXPOSED / EFFORT_ALLOCATION → change how time is allocated.
  if (contradiction && (contradiction.contradictionId === 'CAPABILITY_UNEXPOSED' || contradiction.contradictionId === 'EFFORT_ALLOCATION' || contradiction.contradictionId === 'CAPABILITY_VS_MARKET_PROOF')) {
    return mk('CHANGE_ALLOCATION', '你的能力/时间一直投在旧路上——正确动作是改变分配：切一部分时间给能被直接定价的产出，而不是换整个局。')
  }
  // 6. TIME_SHORTAGE → can't add; stay and reclaim time block.
  if (contradiction && contradiction.contradictionId === 'TIME_SHORTAGE') {
    return mk('STAY_AND_UPGRADE', '你缺的是可支配时间——先在不换局的前提下把时间块腾出来，再谈其他。')
  }
  // 7. SCATTERED_FOCUS → no switch yet; focus first.
  if (contradiction && contradiction.contradictionId === 'SCATTERED_FOCUS') {
    return mk('NO_SWITCH_YET', '你缺的是把方向砍到只剩一个——先做减法，暂不切换任何赛道。')
  }
  // 8. STABILITY_BINDING → add optionality (keep the stable base).
  if (contradiction && contradiction.contradictionId === 'STABILITY_BINDING') {
    return mk('ADD_OPTIONALITY', '收入稳但不是你定价、缓冲又薄——不辞职，先增加一条不由别人定价的小线。')
  }
  // 9. ALIGNED → stay and take the smallest real step.
  return mk('STAY_AND_UPGRADE', '当前没有结构性矛盾——留在当前局里做一个最小的现实动作即可。')

  function mk (outcome, rule) {
    if (SWITCH_OUTCOMES.indexOf(outcome) === -1) throw new Error('BAD_SWITCH_OUTCOME:' + outcome)
    return { outcome: outcome, rule: rule }
  }
}

// ── hidden mechanism (explains co-occurrence of ≥2 facts, not option echo) ──
// MODEL-AWARE by design: the world model is the EXPLANATORY ENGINE here, so the
// mechanism legitimately changes with the cognitive signals — while the
// contradiction and the switch stay reality-anchored.
function cognitivePhrases (evidence) {
  const cog = evidence.cognitiveByField || {}
  const p = []
  const v = (f) => (cog[f] ? cog[f].normalizedValue : null)
  if (v('laborModel') === 'LABOR_MORE_WORK') p.push('你默认"多做一点就更稳"')
  if (v('laborModel') === 'LABOR_REUSABLE') p.push('你倾向把事做成能重复用的样子')
  if (v('laborModel') === 'LABOR_LEVERAGE') p.push('你倾向让别人替你分担一部分')
  if (v('laborModel') === 'LABOR_PRICING') p.push('你倾向去找愿意出更高价的人')
  if (v('ruleModel') === 'RULE_EFFORT' || v('ruleModel') === 'RULE_NONE') p.push('你把"努力/做好"当成解法')
  if (v('ruleModel') === 'RULE_AWARE') p.push('你已经开始看"是谁在定价"')
  if (v('ruleModel') === 'RULE_DEMAND') p.push('你先看"市场还缺不缺人"')
  if (v('decisionStyle') === 'DECISION_WAIT_OTHERS') p.push('遇到不确定你倾向"等别人做稳再动"')
  if (v('decisionStyle') === 'DECISION_SMALL_TEST') p.push('遇到不确定你倾向先做个很小版本试')
  if (v('decisionStyle') === 'DECISION_LEARN_FIRST') p.push('遇到不确定你先想打听成功率')
  if (v('decisionStyle') === 'DECISION_ALL_IN') p.push('遇到机会你倾向直接干起来')
  if (v('decisionStyle') === 'DECISION_AVOID') p.push('遇到机会你先算占用与代价')
  if (v('systemModel') === 'SYS_PERSON') p.push('出问题你第一反应是"谁不行"')
  if (v('systemModel') === 'SYS_STRUCTURE') p.push('出问题你先看流程和结构')
  if (v('systemModel') === 'SYS_PER_EVENT') p.push('你把每次当独立事件看')
  if (v('failureResponse') === 'EVID_PRAISE') p.push('你判断对错更多靠别人的认可')
  if (v('failureResponse') === 'EVID_LUCK') p.push('你把结果更多归给运气')
  if (v('failureResponse') === 'EVID_REPEATABLE') p.push('你靠"能不能重复"来判断')
  return p
}

function buildHiddenMechanism (evidence, contradiction, worldModel) {
  const f = evidence.derivedFlags
  const p = cognitivePhrases(evidence)
  const base = p.length ? p.slice(0, 3).join('，') : '你目前的默认判断，在你现在的局里恰好是被奖励的'
  const reward = f.incomeStable
    ? '而这条默认在你现在的现实里**确实有回报**（收入按时、位置稳）'
    : '而这条默认在你现在的现实里确实换来了看得见的短期结果'
  return base + '。' + reward + '，所以它一直被强化——你并不需要谁提醒，现实本身就在替它发奖金。' +
    '这就是为什么这些事实会同时出现在你身上：它们不是各自独立的缺点，而是同一个默认在不同侧面上的表现。'
}

// ── reinforcement loop (5 steps, evidence-grounded) ────────────────────────
function buildReinforcementLoop (evidence, contradiction) {
  const f = evidence.derivedFlags
  const proof = RE.valueOf(evidence.byField, 'skillValidation')
  const price = RE.valueOf(evidence.byField, 'pricingAuthority')
  const buf = RE.valueOf(evidence.byField, 'safetyMonths')
  let reward = '短期里这确实换来了看得见的回报'
  if (f.incomeStable) reward = '工资按时到账、位置稳定（这是真实的，不否认）'
  return {
    currentModel: '把投入/努力当成解法',
    realBehavior: f.timeHigh ? '把可支配时间优先加回已经稳的那条路' : '在有限时间里优先处理眼前的事',
    shortTermReward: reward,
    reinforcement: '于是"照着原来这套做就没错"被再一次确认',
    longTermCost: '市场验证一直停在（' + (proof || '—') + '）；定价权仍不在你手里（' + (price || '—') + '）；缓冲只有（' + (buf || '—') + '）'
  }
}

// ── reality experiment (HYPOTHESIS→TEST→OBSERVE→SIGNAL→UPDATE) ─────────────
// TEST/OBSERVE are MODEL-AWARE (they test the specific cognitive hypothesis the
// mechanism named); the HORIZON is always bounded 3–7 days with NO default 90天.
const MODEL_PROBE = Object.freeze({
  CERTAINTY_SEEKING: { test: '在结果出来之前，先写下你的预测和把握程度，再对照结果。', observe: '你的预测命中比例，以及把握程度和实际结果差多少。' },
  EFFORT_DEFAULT: { test: '先分清：这份结果的规则是谁定的、收益归谁、风险谁担。', observe: '改变努力量之后，结果归谁、变了多少。' },
  EVENT_ATTRIBUTION: { test: '先画清这件事的激励结构与反馈回路（谁因此得到什么）。', observe: '同一结果是否在你什么都没换的情况下又出现了。' },
  PRAISE_EVIDENCE: { test: '先说清楚：什么情况出现，就说明我现在的看法是错的。', observe: '有没有出现你自己预设的"被推翻"信号。' },
  REPEATABLE_EVIDENCE: { test: '把这次结果能不能再来一次写清楚（什么条件下能重复）。', observe: '同一条件再来一次，结果是否重现。' },
  TIME_BOUND: { test: '把手停几天：如果不再往里投入时间，看还剩什么在自动运转。', observe: '剩下的自动运转量有多少。' }
})

function modelProbeKey (evidence, contradiction) {
  const cog = evidence.cognitiveByField || {}
  const v = (f) => (cog[f] ? cog[f].normalizedValue : null)
  const f = evidence.derivedFlags
  // priority: rule/effort → certainty → event → evidence-type
  if (v('ruleModel') === 'RULE_EFFORT' || v('ruleModel') === 'RULE_NONE' || v('laborModel') === 'LABOR_MORE_WORK') return 'EFFORT_DEFAULT'
  if (v('decisionStyle') === 'DECISION_WAIT_OTHERS' || v('decisionStyle') === 'DECISION_LEARN_FIRST') return 'CERTAINTY_SEEKING'
  if (v('systemModel') === 'SYS_PERSON') return 'EVENT_ATTRIBUTION'
  if (v('failureResponse') === 'EVID_PRAISE' || v('failureResponse') === 'EVID_LUCK') return 'PRAISE_EVIDENCE'
  if (v('failureResponse') === 'EVID_REPEATABLE') return 'REPEATABLE_EVIDENCE'
  if (f.timeHigh) return 'TIME_BOUND'
  return 'CERTAINTY_SEEKING'
}

function buildRealityExperiment (evidence, contradiction, insight, switchRes) {
  const skill = evidence.byField.monetizableSkill ? evidence.byField.monetizableSkill.semanticMeaning : '你的能力'
  const moneyNeeded = switchRes.outcome === 'RUN_TEST_FIRST' || switchRes.outcome === 'CHANGE_ALLOCATION' || switchRes.outcome === 'ADD_OPTIONALITY'
  const probeKey = modelProbeKey(evidence, contradiction)
  const probe = MODEL_PROBE[probeKey]
  return {
    hypothesis: '你离"这件事能不能成立"只差一次真实对外动作，差的不是决心或能力。',
    test: moneyNeeded
      ? '3–7 天内，把' + skill + '打包成一个明确的对外动作（一次报价/一次公开交付），只做这一个动作。' + probe.test
      : '3–7 天内，只做一个可观察的最小动作，用来检验上面那条判断。' + probe.test,
    observe: (moneyNeeded ? '有没有陌生人问价或付费；被拒的话对方给的理由是什么。' : '这个动作有没有改变任何一项现实指标。') + probe.observe,
    passFailSignal: moneyNeeded ? '出现 ≥1 次真实付费意向 → 方向对；完全没有 → 再判断是"没被看见"还是"不对口"。' : '指标朝预期方向动 → 判断成立；没动 → 判断需要修正。',
    updateRule: '按这次结果决定下一次把时间/资源切给哪一边。',
    horizon: '3–7 天（单动作；无默认 90 天）',
    probeKey: probeKey
  }
}

// ── §7 CLAIM LEDGER ────────────────────────────────────────────────────────
function buildClaimLedger (evidence, contradiction, insight, worldModel) {
  const claims = []
  let id = 0
  const add = (semanticClaim, claimLevel, evidenceIds, derivationRule, confidence, allowed) => {
    claims.push({
      claimId: 'C' + String(++id).padStart(3, '0'),
      semanticClaim: semanticClaim,
      claimLevel: claimLevel,
      evidenceIds: evidenceIds.slice(),
      derivationRule: derivationRule,
      confidence: confidence,
      allowed: allowed !== false
    })
  }
  // L1 observed facts (one per present fact — always allowed)
  for (const fac of evidence.facts) {
    add(fac.allowedClaims[0], CLAIM_LEVEL.L1, [fac.field], 'OBSERVED_FACT', fac.confidence, true)
  }
  // L2 strong derivation (the contradiction + insight)
  if (contradiction && contradiction.primary) {
    add('主要矛盾：' + contradiction.primary.contradictionId + '（' + contradiction.primary.note + '）',
      CLAIM_LEVEL.L2, contradiction.primary.supportingFactIds, 'CONTRADICTION_ENGINE_V1', 'MEDIUM', true)
  }
  if (insight && insight.primary) {
    add(insight.primary.conclusion, CLAIM_LEVEL.L2, insight.primary.supportingFactIds, insight.primary.derivationRule, insight.primary.confidence, true)
  }
  // L3 testable hypothesis (the reality experiment)
  // (added by the thesis builder where the experiment exists)
  return claims
}

/**
 * Build the Case Thesis V1.
 * @param {Object} evidence store
 * @param {Object} contradictionEngine output
 * @param {Object} derivedInsight output
 * @param {Object} [worldModel] explanation only
 */
function buildCaseThesisV1 (evidence, contradictionEngine, derivedInsight, worldModel) {
  const ce = contradictionEngine || {}
  const di = derivedInsight || {}
  const primaryContradiction = ce.primary || null
  const secondaryContradiction = ce.secondary || null
  const primaryInsight = di.primary || null

  const switchRes = resolveSwitch(evidence, primaryContradiction, primaryInsight)
  const hiddenMechanism = buildHiddenMechanism(evidence, primaryContradiction, worldModel)
  const loop = buildReinforcementLoop(evidence, primaryContradiction)
  const experiment = buildRealityExperiment(evidence, primaryContradiction, primaryInsight, switchRes)
  const claimLedger = buildClaimLedger(evidence, ce, di, worldModel)

  // L3 hypothesis claim for the experiment
  claimLedger.push({
    claimId: 'C' + String(claimLedger.length + 1).padStart(3, '0'),
    semanticClaim: '可检验假设：' + experiment.hypothesis,
    claimLevel: CLAIM_LEVEL.L3,
    evidenceIds: primaryInsight ? primaryInsight.supportingFactIds.slice() : [],
    derivationRule: 'REALITY_EXPERIMENT_HYPOTHESIS',
    confidence: 'LOW',
    allowed: true
  })

  const worldModelExplanation = (worldModel && worldModel.axes)
    ? {
        axes: Object.keys(worldModel.axes).map((k) => ({ axis: k, state: worldModel.axes[k].state, reportable: !!worldModel.axes[k].reportable })),
        note: '世界模型仅用于解释/复述矛盾，不制造矛盾，也不成为报告主语。'
      }
    : null

  // §7 unsupported-core-claim gate: every L1/L2 claim must have evidenceIds.
  const unsupportedCoreClaimCount = claimLedger.filter((c) => (c.claimLevel === CLAIM_LEVEL.L1 || c.claimLevel === CLAIM_LEVEL.L2) && (!c.evidenceIds || !c.evidenceIds.length)).length

  return {
    version: CASE_THESIS_VERSION,
    realityFacts: evidence.facts,
    realityFactCount: evidence.factCount,
    primaryContradiction: primaryContradiction,
    secondaryContradiction: secondaryContradiction,
    primaryDerivedInsight: primaryInsight,
    hiddenMechanism: hiddenMechanism,
    reinforcementLoop: loop,
    strategicSwitch: switchRes,
    realityExperiment: experiment,
    worldModelExplanation: worldModelExplanation,
    claimLedger: claimLedger,
    UNSUPPORTED_CORE_CLAIM_COUNT: unsupportedCoreClaimCount,
    SWITCH_OUTCOME: switchRes.outcome
  }
}

module.exports = {
  CASE_THESIS_VERSION,
  SWITCH_OUTCOMES,
  CLAIM_LEVEL,
  resolveSwitch,
  buildHiddenMechanism,
  buildReinforcementLoop,
  buildRealityExperiment,
  buildClaimLedger,
  buildCaseThesisV1
}
