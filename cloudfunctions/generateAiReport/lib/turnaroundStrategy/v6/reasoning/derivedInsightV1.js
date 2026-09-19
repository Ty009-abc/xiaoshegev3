'use strict'
/**
 * turnaroundStrategy/v6/reasoning/derivedInsightV1.js
 *
 * R87B1 §4/§5 — DERIVED INSIGHT V1 (P0) + COUNTERFACTUAL TEST.
 *
 * FACT A + FACT B (+ FACT C) → NEW CONCLUSION D
 *
 * D must NOT be:
 *   - a questionnaire option restatement
 *   - a WorldModel label
 *   - generic advice
 *   - the contradiction simply renamed
 *
 * Insight schema:
 *   insightId · supportingFactIds[] · worldModelEvidenceIds[] · derivationRule ·
 *   conclusion · confidence · counterfactualDependency[] · noveltyReason ·
 *   allowedClaims[] · forbiddenClaims[]
 *
 * The WorldModel may be attached as EXPLANATION only; it can neither create an
 * insight nor supply its conclusion.
 *
 * Deterministic. Pure. No AI. No I/O. No network. NOT wired to production cards.
 */

const path = require('path')
const RE = require(path.join(__dirname, 'realityEvidenceV1.js'))
const CE = require(path.join(__dirname, 'contradictionEngineV1.js'))

const DERIVED_INSIGHT_VERSION = 'r87b1_derived_insight_v1'

// ── generic-advice lexicon (§4 forbidden: "generic advice") ────────────────
const GENERIC_ADVICE_TOKENS = [
  '辞职', '裸辞', '创业', '开公司', '做副业', '搞副业', '找客户', '拉客户',
  '提升自己', '多学习', '多看书', '报个课', '坚持就是胜利', '相信自己',
  '拿定价权', '掌握定价权', '找到你的价值', '打造个人品牌', '实现财务自由'
]

// ── novelty + rule table (keyed by primary contradiction id) ───────────────
// Each rule derives a NEW conclusion by COMBINING ≥2 facts (never echoing one).
const INSIGHT_RULES = Object.freeze({
  CAPABILITY_UNEXPOSED: {
    id: 'CONSTRAINT_IS_ALLOCATION_NOT_CAPABILITY',
    requiredFacts: ['weeklyTime', 'skillValidation', 'pastAttemptStage', 'pricingAuthority'],
    derivationRule: 'TIME_SLACK(weeklyTime) + CAPABILITY_SIGNAL(skillValidation) + ZERO_ATTEMPT(pastAttemptStage) + EXTERNAL_PRICING(pricingAuthority) → CONSTRAINT_IS_ALLOCATION_NOT_CAPABILITY',
    conclusion: (ev) => {
      const t = RE.valueOf(ev.byField, 'weeklyTime')
      const proof = RE.valueOf(ev.byField, 'skillValidation')
      const price = RE.valueOf(ev.byField, 'pricingAuthority')
      const skill = ev.byField.monetizableSkill ? ev.byField.monetizableSkill.semanticMeaning : '你的能力'
      return '你真正的约束不是"能力不够"或"没时间"——你有可支配时间（' + (t || '—') + '），也有被人需要的能力信号（' + (proof || '—') + '）。' +
        '问题出在**配置**：你把这段时间一直投在一条"别人给你定价（' + (price || '—') + '）"的路上，' +
        '所以' + skill + '至今没有一次真正直接接触市场。约束是配置，不是资源。'
    },
    noveltyReason: '用户选的是"有能力但不知怎么变现"（想要方法），但从未意识到真正的约束是"时间一直补贴旧路"这套配置——是配置问题，不是知识问题。'
  },

  CAPABILITY_VS_MARKET_PROOF: {
    id: 'ATTEMPT_WITHOUT_PRICED_PROOF',
    requiredFacts: ['pastAttemptStage', 'skillValidation'],
    derivationRule: 'ATTEMPT_EXISTS(pastAttemptStage) + WEAK_PROOF(skillValidation) → ATTEMPT_NEVER_REACHED_PAID_STEP',
    conclusion: (ev) => {
      const att = RE.valueOf(ev.byField, 'pastAttemptStage')
      const proof = RE.valueOf(ev.byField, 'skillValidation')
      const skill = ev.byField.monetizableSkill ? ev.byField.monetizableSkill.semanticMeaning : '你的能力'
      return '你已经动手试过（' + (att || '—') + '），但市场验证一直停在「' + (proof || '—') + '」。' +
        '这说明卡点不在"敢不敢开始"，而在**你每次都没走到"有人直接为它付钱"那一步就收手了**。'
    },
    noveltyReason: '用户以为自己"做过但没结果"，实际是每一轮都在同一个位置停下（进入收费环节前），不是随机失败。'
  },

  STABILITY_BINDING: {
    id: 'STABILITY_IS_THE_LOCK',
    requiredFacts: ['incomeStructure', 'pricingAuthority', 'safetyMonths'],
    derivationRule: 'STABLE_INCOME(incomeStructure) + EXTERNAL_PRICING(pricingAuthority) + THIN_BUFFER(safetyMonths) → STABILITY_ITSELF_BLOCKS_SWITCHING',
    conclusion: (ev) => {
      const inc = RE.valueOf(ev.byField, 'incomeStructure')
      const price = RE.valueOf(ev.byField, 'pricingAuthority')
      const buf = RE.valueOf(ev.byField, 'safetyMonths')
      return '你的收入是稳的（' + (inc || '—') + '），但这份稳不是你定价（' + (price || '—') + '），而缓冲又薄（' + (buf || '—') + '）。' +
        '结果是：**"稳"本身成了最贵的东西**——它让你换不起，也让加码的努力换不来抗风险。'
    },
    noveltyReason: '用户把"收入稳"当成资产，但把定价方与缓冲一起看，稳其实变成了锁住选择的成本。'
  },

  STABILITY_VS_OPTIONALITY: {
    id: 'BUFFER_UNUSED_FOR_OPTION',
    requiredFacts: ['incomeStructure', 'pricingAuthority', 'safetyMonths'],
    derivationRule: 'STABLE_INCOME + EXTERNAL_PRICING + STRONG_BUFFER(safetyMonths) → BUFFER_EXISTS_BUT_UNUSED_FOR_OPTIONALITY',
    conclusion: (ev) => {
      const buf = RE.valueOf(ev.byField, 'safetyMonths')
      const price = RE.valueOf(ev.byField, 'pricingAuthority')
      return '你手里其实有一张别人没有的牌：缓冲（' + (buf || '—') + '）。' +
        '但你的收入仍由外部定价（' + (price || '—') + '），说明这张牌一直**没被用来做一件不由别人定价的事**——缓冲被当成了安全垫，而不是期权。'
    },
    noveltyReason: '用户把安全垫理解成"更保险"，但结合定价权看，它其实是一张从没行使过的期权。'
  },

  EFFORT_ALLOCATION: {
    id: 'EFFORT_IS_REINVESTED_IN_THE_STABLE_PATH',
    requiredFacts: ['weeklyTime', 'skillValidation'],
    derivationRule: 'TIME_SLACK(weeklyTime) + WEAK_PROOF(skillValidation) + EFFORT_DEFAULT(cognitive) → EFFORT_REINVESTS_IN_STABLE_PATH',
    conclusion: (ev) => {
      const t = RE.valueOf(ev.byField, 'weeklyTime')
      const proof = RE.valueOf(ev.byField, 'skillValidation')
      return '你并不缺拼劲，也不缺时间（' + (t || '—') + '）。缺的是**方向上的分配**：' +
        '你把这部分时间默认加回到"已经稳的那条路"上，于是市场验证一直停在（' + (proof || '—') + '），' +
        '你的努力其实在持续加固那个你最想离开的位置。'
    },
    noveltyReason: '用户以为"再努力点"是解法，实际上努力正在被配置成加固旧路的燃料。'
  },

  VALIDATED_NOT_REPEATABLE: {
    id: 'VALIDATED_BUT_NOT_REPEATABLE',
    requiredFacts: ['skillValidation', 'incomeStructure', 'pastAttemptStage'],
    derivationRule: 'PAID_PROOF(skillValidation) + TRANSACTIONAL_INCOME(incomeStructure) + ATTEMPT_EXISTS(pastAttemptStage) → VALUE_IS_REAL_BUT_NOT_REPEATABLE',
    conclusion: (ev) => {
      const proof = RE.valueOf(ev.byField, 'skillValidation')
      const inc = RE.valueOf(ev.byField, 'incomeStructure')
      return '你的能力**已经被市场验证过**（' + (proof || '—') + '），这说明"没人要"是假的。' +
        '但你的收入一直是"' + (inc || '—') + '"这种一单一结的形状——真正卡你的不是能力，是**能不能被重复交付和重复购买**。'
    },
    noveltyReason: '用户以为问题是"没本事"或"单量不够"，但把"已被付费验证"和"一单一结的收入形状"放一起，卡点在可重复性，不在能力。'
  },

  LIQUIDITY_VS_AMBITION: {
    id: 'CASHFLOW_IS_THE_FIRST_CONSTRAINT',
    requiredFacts: ['monthlySurplus'],
    derivationRule: 'LOW_SURPLUS(monthlySurplus) + (DEBT(debtPressure) OR THIN_BUFFER(safetyMonths)) → FIRST_PROBLEM_IS_CASHFLOW_NOT_GROWTH',
    conclusion: (ev) => {
      const s = RE.valueOf(ev.byField, 'monthlySurplus')
      return '你现在最真实的第一问题不是"多赚"，而是**现金流不能断**（月结余：' + (s || '—') + '）。' +
        '在这一步没解决之前，任何"再投钱/再扩张"都只是在拿必需的钱去赌概率。'
    },
    noveltyReason: '用户盯着"增长"，但把结余与债务/缓冲放在一起，约束其实在现金流而非收益。'
  },

  DEBT_PRESSURE_DOMINANT: {
    id: 'BUFFER_BEFORE_GROWTH',
    requiredFacts: ['debtPressure'],
    derivationRule: 'HIGH_DEBT(debtPressure) + (THIN_BUFFER(safetyMonths) OR LOW_SURPLUS(monthlySurplus)) → REPAIR_BUFFER_BEFORE_ANY_GROWTH',
    conclusion: (ev) => {
      const d = RE.valueOf(ev.byField, 'debtPressure')
      return '你背着债务（' + (d || '—') + '）。这不是道德问题，是**先后顺序**问题：' +
        '在任何扩张之前，缓冲必须先修好，否则一次波动就会把你推回原点，越努力越危险。'
    },
    noveltyReason: '用户可能想先扩张，但把债务与缓冲放在一起，正确顺序是先修缓冲。'
  },

  TIME_SHORTAGE: {
    id: 'BINDING_CONSTRAINT_IS_TIME_BLOCK',
    requiredFacts: ['weeklyTime', 'pastAttemptStage'],
    derivationRule: 'LOW_TIME(weeklyTime) + ZERO_ATTEMPT(pastAttemptStage) → BINDING_CONSTRAINT_IS_TIME_NOT_DESIRE',
    conclusion: (ev) => {
      const t = RE.valueOf(ev.byField, 'weeklyTime')
      return '你的约束很具体：**可支配时间块太少**（' + (t || '—') + '）。' +
        '在时间块建立起来之前，"更努力"不会转化为任何新结果——你缺的是可支配的时间，不是意愿。'
    },
    noveltyReason: '用户可能归因于"懒/没坚持"，但事实是可支配时间本身极低，约束在资源不在态度。'
  },

  SCATTERED_FOCUS: {
    id: 'FOCUS_IS_THE_SCARCE_RESOURCE',
    requiredFacts: ['primaryProblem', 'selfBelief'],
    derivationRule: 'PROBLEM_FOCUS(primaryProblem) + BELIEF_SWITCHING(selfBelief) → FOCUS_NOT_DIRECTION_IS_THE_CONSTRAINT',
    conclusion: () => '你缺的不是"方向"，而是**把方向砍到只剩一个**。你自述一直在换方向，而问题本身也是"无法聚焦"——这两条同时成立，说明筛选动作比选择动作更关键。',
    noveltyReason: '用户以为需要"找到对的方向"，但把"总在换方向"和"无法聚焦"放一起，缺的是减法不是加法。'
  },

  ALIGNED_NO_CONTRADICTION: {
    id: 'NO_STRUCTURAL_CONFLICT_NEXT_MICRO_STEP',
    requiredFacts: [],
    derivationRule: 'NO_STRUCTURAL_TENSION + ≥1 reportable reality fact → SMALLEST_NEXT_STEP_DOMINATES',
    conclusion: () => '当前信息下没有结构性矛盾——这说明"再想清楚一点"的边际价值很低。此时最优动作是把一个**最小的现实动作**先做出来，用结果代替猜测。',
    noveltyReason: '在缺少矛盾时，结论从"找问题"翻转为"先动"，这是从证据结构推出的，而非模板建议。'
  }
})

// ── validators ─────────────────────────────────────────────────────────────
function optionEcho (conclusion, ev) {
  // questionnaire restatement if the conclusion contains a raw option text verbatim
  // (excluding free text) as a standalone sentence — proxy: primary raw answer text
  const primary = RE.valueOf(ev.byField, 'primaryProblem')
  const txt = primary ? require(path.join(__dirname, '..', 'hybrid', 'hybridContractV6.js')).optionTextFor('primaryProblem', primary) : null
  if (!txt) return false
  return conclusion.indexOf(txt) !== -1 && conclusion.replace(txt, '').trim().length < 12
}

function genericAdviceCount (conclusion) {
  let n = 0
  for (const g of GENERIC_ADVICE_TOKENS) if (conclusion.indexOf(g) !== -1) n++
  return n
}

// confidence from supporting-fact evidence strength
function confidenceFrom (ev, factIds) {
  let s = 0
  let n = 0
  for (const id of factIds) {
    const f = ev.byField[id]
    if (f) { s += RE.CLASS_WEIGHT[f.evidenceClass]; n++ }
  }
  if (n === 0) return RE.CONFIDENCE.LOW
  const avg = s / n
  if (avg >= 2 && n >= 3) return RE.CONFIDENCE.HIGH
  if (avg >= 1 && n >= 2) return RE.CONFIDENCE.MEDIUM
  return RE.CONFIDENCE.LOW
}

/**
 * Derive the primary insight for a contradiction.
 * @param {Object} evidence store
 * @param {Object} contradiction { contradictionId, supportingFactIds }
 * @param {Object} [worldModel] explanation only
 */
function deriveInsight (evidence, contradiction, worldModel) {
  const ev = evidence || { byField: {}, cognitiveByField: {} }
  const rule = INSIGHT_RULES[contradiction && contradiction.contradictionId]
  if (!rule) return null

  // required facts that are actually present
  const present = rule.requiredFacts.filter((id) => !!ev.byField[id])
  // the contradiction's own supporting facts are always eligible
  const supporting = (contradiction.supportingFactIds || []).filter((id) => !!ev.byField[id])
  const factIds = Array.from(new Set(present.concat(supporting)))

  const conclusion = rule.conclusion(ev)

  const worldModelEvidenceIds = []
  if (worldModel && worldModel.axes) {
    for (const k of Object.keys(worldModel.axes)) {
      const a = worldModel.axes[k]
      if (a && a.reportable === true) worldModelEvidenceIds.push(k)
    }
  }

  return {
    insightId: rule.id,
    contradictionId: contradiction.contradictionId,
    supportingFactIds: factIds,
    supportingFactCount: factIds.length,
    worldModelEvidenceIds: worldModelEvidenceIds,
    derivationRule: rule.derivationRule,
    conclusion: conclusion,
    confidence: confidenceFrom(ev, factIds),
    counterfactualDependency: factIds.slice(), // filled by counterfactual test
    noveltyReason: rule.noveltyReason,
    allowedClaims: ['把以上事实连起来可推出：' + conclusion],
    forbiddenClaims: ['据此保证收入', '据此断言人格/心理'],
    // validators
    isQuestionnaireRestatement: optionEcho(conclusion, ev),
    genericAdviceCount: genericAdviceCount(conclusion)
  }
}

/**
 * §5 COUNTERFACTUAL TEST — remove each critical supporting fact separately and
 * re-derive. D must disappear, change, or materially lose confidence.
 * @returns {{perFact:Array, PRIMARY_INSIGHT_COUNTERFACTUAL_DEPENDENCY:string}}
 */
function counterfactualTest (evidence, contradiction, insight) {
  if (!insight) return { perFact: [], dependentCount: 0, criticalCount: 0, ratio: 0, loadBearingFactIds: [], survivesFactIds: [], PRIMARY_INSIGHT_COUNTERFACTUAL_DEPENDENCY: 'UNKNOWN' }
  const perFact = []
  let dependent = 0
  const critical = insight.supportingFactIds
  for (const fact of critical) {
    const reduced = RE.reduceEvidence(evidence, [fact])
    const ce = CE.computeContradictionEngineV1(reduced, null)
    const re = deriveInsight(reduced, ce.primary || { contradictionId: null, supportingFactIds: [] }, null)
    let effect
    if (!re) effect = 'DISAPPEARS'
    else if (re.insightId !== insight.insightId) effect = 'CHANGES'
    else if (re.confidence !== insight.confidence) effect = 'LOSES_CONFIDENCE'
    else effect = 'SURVIVES'
    const changed = effect !== 'SURVIVES'
    if (changed) dependent++
    perFact.push({
      removedFact: fact,
      primaryContradictionAfter: ce.PRIMARY_CASE_CONTRADICTION,
      insightIdAfter: re ? re.insightId : null,
      confidenceAfter: re ? re.confidence : null,
      effect: effect,
      changed: changed
    })
  }
  const ratio = critical.length ? dependent / critical.length : 0
  // §5 HARD GATE: D must have ≥2 load-bearing supporting facts (removing any one
  // of which makes D disappear / change / lose confidence). "Survives" facts are
  // NOT load-bearing and are excluded from the critical set.
  const loadBearingFactIds = perFact.filter((p) => p.changed).map((p) => p.removedFact)
  const survivesFactIds = perFact.filter((p) => !p.changed).map((p) => p.removedFact)
  let level
  if (loadBearingFactIds.length >= 2 && ratio >= 0.4) level = 'HIGH'
  else if (loadBearingFactIds.length >= 1) level = 'MEDIUM'
  else level = 'LOW'
  return {
    perFact: perFact,
    dependentCount: dependent,
    criticalCount: critical.length,
    ratio: ratio,
    loadBearingFactIds: loadBearingFactIds,
    survivesFactIds: survivesFactIds,
    PRIMARY_INSIGHT_COUNTERFACTUAL_DEPENDENCY: level
  }
}

/**
 * Build all derived insights for the fired contradictions. The FIRST is primary.
 */
function computeDerivedInsightV1 (evidence, contradictionEngine, worldModel) {
  const ce = contradictionEngine || { candidates: [], primary: null }
  const insights = []
  const cands = ce.candidates && ce.candidates.length ? ce.candidates : (ce.primary ? [ce.primary] : [])
  for (const c of cands) {
    const ins = deriveInsight(evidence, c, worldModel)
    if (ins) insights.push(ins)
  }
  const primary = insights[0] || null
  const counterfactual = counterfactualTest(evidence, ce.primary || {}, primary)
  if (primary) primary.counterfactualDependency = counterfactual.loadBearingFactIds.slice()
  return {
    version: DERIVED_INSIGHT_VERSION,
    insights: insights,
    primary: primary,
    counterfactual: counterfactual,
    NEW_DERIVED_INSIGHT_COUNT: insights.length,
    PRIMARY_INSIGHT_SUPPORTING_FACT_COUNT: primary ? primary.supportingFactCount : 0,
    PRIMARY_INSIGHT_LOAD_BEARING_FACT_COUNT: counterfactual.loadBearingFactIds.length,
    PRIMARY_INSIGHT_IS_QUESTIONNAIRE_RESTATEMENT: primary ? primary.isQuestionnaireRestatement : null,
    PRIMARY_INSIGHT_IS_GENERIC_ADVICE: primary ? primary.genericAdviceCount > 0 : null,
    PRIMARY_INSIGHT_COUNTERFACTUAL_DEPENDENCY: counterfactual.PRIMARY_INSIGHT_COUNTERFACTUAL_DEPENDENCY
  }
}

module.exports = {
  DERIVED_INSIGHT_VERSION,
  GENERIC_ADVICE_TOKENS,
  INSIGHT_RULES,
  deriveInsight,
  counterfactualTest,
  computeDerivedInsightV1,
  genericAdviceCount,
  optionEcho
}
