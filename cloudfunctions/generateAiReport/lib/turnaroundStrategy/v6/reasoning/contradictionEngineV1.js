'use strict'
/**
 * turnaroundStrategy/v6/reasoning/contradictionEngineV1.js
 *
 * R87B1 §3 — CONTRADICTION ENGINE V1 (deterministic).
 *
 * A contradiction is a STRUCTURAL tension between ≥2 INDEPENDENT reality facts
 * (preferred ≥3, across ≥2 semantic dimensions). It is the bridge from the
 * user's reality to the case thesis.
 *
 * Authority rule (§3):
 *   - WorldModel may EXPLAIN / RE-RANK a contradiction.
 *   - WorldModel may NEVER MANUFACTURE a contradiction.
 *   Every contradiction below fires from REALITY EVIDENCE ONLY. WorldModel is
 *   optional and can only break ties among already-fired candidates.
 *
 * Ranking criteria (in order): evidence strength → independent dimensions →
 * primaryProblem relevance → explanatory power → actionability → WorldModel fit.
 *
 * Deterministic. Pure. No AI. No I/O. No network. NOT wired to production cards.
 */

const path = require('path')
const RE = require(path.join(__dirname, 'realityEvidenceV1.js'))

const CONTRADICTION_ENGINE_VERSION = 'r87b1_contradiction_engine_v1'

// semantic dimension of each field (independent-dimension counting)
const DIMENSION_OF = Object.freeze({
  lifeStage: 'TIME_HORIZON',
  incomeStructure: 'ECONOMY',
  occupationDetail: 'OCCUPATION',
  occupationCategory: 'OCCUPATION',
  pricingAuthority: 'PRICING',
  monthlySurplus: 'LIQUIDITY',
  safetyMonths: 'BUFFER',
  debtPressure: 'DEBT',
  skillValidation: 'MARKET_PROOF',
  monetizableSkill: 'CAPABILITY',
  weeklyTime: 'TIME_ALLOCATION',
  pastAttemptStage: 'ATTEMPT',
  primaryProblem: 'INTENT',
  maxTrialCost: 'CAPITAL'
})

// primaryProblem relevance: contradiction ids that map onto each PROBLEM_*
const PROBLEM_RELEVANCE = Object.freeze({
  CAPABILITY_UNEXPOSED: ['PROBLEM_MONETIZE', 'PROBLEM_SIDE_UNSTARTED'],
  CAPABILITY_VS_MARKET_PROOF: ['PROBLEM_MONETIZE', 'PROBLEM_INCOME_STUCK'],
  STABILITY_BINDING: ['PROBLEM_INCOME_STUCK', 'PROBLEM_NO_FUTURE'],
  STABILITY_VS_OPTIONALITY: ['PROBLEM_INCOME_STUCK', 'PROBLEM_CAREER_SWITCH'],
  EFFORT_ALLOCATION: ['PROBLEM_MONETIZE', 'PROBLEM_INCOME_STUCK', 'PROBLEM_FOCUS'],
  LIQUIDITY_VS_AMBITION: ['PROBLEM_DEBT', 'PROBLEM_INCOME_STUCK'],
  DEBT_PRESSURE_DOMINANT: ['PROBLEM_DEBT'],
  TIME_SHORTAGE: ['PROBLEM_FOCUS', 'PROBLEM_SIDE_UNSTARTED'],
  SCATTERED_FOCUS: ['PROBLEM_FOCUS'],
  ALIGNED_NO_CONTRADICTION: ['PROBLEM_OTHER'],
  VALIDATED_NOT_REPEATABLE: ['PROBLEM_INCOME_STUCK', 'PROBLEM_MONETIZE']
})

/**
 * Each candidate is a PURE function over the evidence store. It returns either
 * null (does not fire) or { supportingFactIds, dimensions, note }.
 */
const CANDIDATES = Object.freeze([
  {
    id: 'DEBT_PRESSURE_DOMINANT',
    // debt is a hard reality constraint that dominates growth intent
    fire: (ev) => {
      const f = ev.derivedFlags
      if (!f.debtHigh) return null
      const ids = ['debtPressure']
      if (f.safetyThin) ids.push('safetyMonths')
      if (f.surplusLow) ids.push('monthlySurplus')
      if (!ids.some((x) => x !== 'debtPressure')) return null // need >=2 facts
      return { supportingFactIds: ids, note: '债务或高杠杆压力，先于任何扩张' }
    }
  },
  {
    id: 'LIQUIDITY_VS_AMBITION',
    fire: (ev) => {
      const f = ev.derivedFlags
      if (!f.surplusLow) return null
      const ids = ['monthlySurplus']
      if (f.debtHigh) ids.push('debtPressure')
      else if (f.safetyThin) ids.push('safetyMonths')
      else return null
      return { supportingFactIds: ids, note: '现金流第一问题不是多赚，而是不能断' }
    }
  },
  {
    id: 'CAPABILITY_UNEXPOSED',
    fire: (ev) => {
      const f = ev.derivedFlags
      if (!f.proofWeak) return null
      if (!f.attemptNone) return null
      const ids = ['skillValidation', 'pastAttemptStage']
      if (ev.byField.monetizableSkill) ids.push('monetizableSkill')
      return { supportingFactIds: ids, note: '有能力信号，却从未放进市场检验' }
    }
  },
  {
    id: 'CAPABILITY_VS_MARKET_PROOF',
    fire: (ev) => {
      const f = ev.derivedFlags
      if (!f.attemptExists) return null
      if (!f.proofWeak) return null
      const ids = ['pastAttemptStage', 'skillValidation']
      if (ev.byField.monetizableSkill) ids.push('monetizableSkill')
      return { supportingFactIds: ids, note: '试过，但没走到"有人直接付费"' }
    }
  },
  {
    id: 'VALIDATED_NOT_REPEATABLE',
    // already market-validated (paid) but income is one-off/transactional → the
    // tension is repeatability, NOT capability. (keeps the chef-type case distinct
    // from the never-exposed salary case)
    fire: (ev) => {
      const f = ev.derivedFlags
      const inc = RE.valueOf(ev.byField, 'incomeStructure')
      if (!f.proofPaid) return null
      if (!(inc === 'INC_SKILL_SERVICE' || inc === 'INC_COMMISSION')) return null
      if (!f.attemptExists) return null
      return { supportingFactIds: ['skillValidation', 'incomeStructure', 'pastAttemptStage'], note: '已被市场付费验证，但收入一直停在“接一单算一单”' }
    }
  },
  {
    id: 'STABILITY_BINDING',
    fire: (ev) => {
      const f = ev.derivedFlags
      if (!(f.incomeStable && f.pricingExternal)) return null
      if (!f.safetyThin) return null
      const ids = ['incomeStructure', 'pricingAuthority', 'safetyMonths']
      if (f.debtHigh) ids.push('debtPressure')
      return { supportingFactIds: ids, note: '收入稳但不是你定价，安全垫薄到换不起' }
    }
  },
  {
    id: 'STABILITY_VS_OPTIONALITY',
    fire: (ev) => {
      const f = ev.derivedFlags
      if (!(f.incomeStable && f.pricingExternal)) return null
      if (!f.safetyStrong) return null
      const ids = ['incomeStructure', 'pricingAuthority', 'safetyMonths']
      if (f.proofWeak) ids.push('skillValidation')
      return { supportingFactIds: ids, note: '有缓冲去做一件不由别人定价的事，却一直没动' }
    }
  },
  {
    id: 'EFFORT_ALLOCATION',
    fire: (ev) => {
      const f = ev.derivedFlags
      const cog = ev.cognitiveByField
      const effortDefault = (cog.ruleModel && (cog.ruleModel.normalizedValue === 'RULE_EFFORT' || cog.ruleModel.normalizedValue === 'RULE_NONE')) ||
        (cog.laborModel && cog.laborModel.normalizedValue === 'LABOR_MORE_WORK')
      if (!f.timeHigh) return null
      if (!f.proofWeak) return null
      if (!effortDefault) return null
      const ids = ['weeklyTime', 'skillValidation']
      if (cog.laborModel || cog.ruleModel) ids.push('laborModel')
      return { supportingFactIds: ids, note: '时间一直加在"已经稳的那条路"上' }
    }
  },
  {
    id: 'TIME_SHORTAGE',
    fire: (ev) => {
      const f = ev.derivedFlags
      if (!f.timeLow) return null
      if (!(f.attemptNone && f.proofWeak)) return null
      return { supportingFactIds: ['weeklyTime', 'pastAttemptStage', 'skillValidation'], note: '缺的不是努力，是可支配的时间块' }
    }
  },
  {
    id: 'SCATTERED_FOCUS',
    fire: (ev) => {
      const v = RE.valueOf(ev.byField, 'primaryProblem')
      const b = RE.valueOf(ev.byField, 'selfBelief')
      if (v !== 'PROBLEM_FOCUS') return null
      if (b !== 'BELIEF_SWITCHING') return null
      return { supportingFactIds: ['primaryProblem', 'selfBelief'], note: '缺的不是方向，是砍到只剩一个方向' }
    }
  },
  {
    id: 'ALIGNED_NO_CONTRADICTION',
    // fallback — fires only when nothing else does and ≥1 reportable reality fact
    fire: (ev, ctx) => {
      if (ctx.fired && ctx.fired.length) return null
      if (!ev.facts.length) return null
      return { supportingFactIds: ev.facts.slice(0, 2).map((f) => f.field), note: '当前信息下没有结构性矛盾，看最小动作' }
    }
  }
])

function independentDimensions (ids) {
  const set = {}
  for (const id of ids) set[DIMENSION_OF[id] || id] = true
  return Object.keys(set).length
}

function evidenceStrength (ev, ids) {
  // count DISTINCT reality facts that are OBSERVED (all reality facts are OBSERVED
  // here; cognitive-derived supporting ids are weighted 0.5)
  let s = 0
  for (const id of ids) {
    if (ev.byField[id]) s += RE.CLASS_WEIGHT[ev.byField[id].evidenceClass]
    else if (ev.cognitiveByField[id]) s += 0.5
  }
  return s
}

function problemRelevance (ev, id) {
  const p = RE.valueOf(ev.byField, 'primaryProblem')
  const list = PROBLEM_RELEVANCE[id] || []
  return (p && list.indexOf(p) !== -1) ? 1 : 0
}

// explanatory power: how many independent dimensions it links
function explanatoryPower (ids) { return independentDimensions(ids) }

// actionability: a contradiction we can turn into a bounded test outranks a
// purely descriptive one. Derived INSIGHT ids (debt/liquidity/capability) are
// more actionable than the generic fallback.
const ACTIONABILITY = Object.freeze({
  ALIGNED_NO_CONTRADICTION: 0,
  SCATTERED_FOCUS: 1,
  TIME_SHORTAGE: 1,
  STABILITY_VS_OPTIONALITY: 2,
  STABILITY_BINDING: 2,
  CAPABILITY_VS_MARKET_PROOF: 2,
  VALIDATED_NOT_REPEATABLE: 2,
  EFFORT_ALLOCATION: 2,
  CAPABILITY_UNEXPOSED: 3,
  LIQUIDITY_VS_AMBITION: 3,
  DEBT_PRESSURE_DOMINANT: 3
})

/**
 * Rank all fired candidates deterministically.
 * @param {Object} evidence RealityEvidenceV1 store
 * @param {Object} [worldModel] optional — must only RE-RANK, never manufacture
 */
function computeContradictionEngineV1 (evidence, worldModel) {
  const ev = evidence || { facts: [], byField: {}, derivedFlags: {}, cognitiveByField: {} }
  const fired = []
  const ctx = { fired: fired }
  for (const c of CANDIDATES) {
    const r = c.fire(ev, ctx)
    if (r) {
      const dims = independentDimensions(r.supportingFactIds)
      fired.push({
        contradictionId: c.id,
        supportingFactIds: r.supportingFactIds.slice(),
        supportingFactCount: r.supportingFactIds.filter((x) => !!ev.byField[x]).length,
        dimensionCount: dims,
        evidenceStrength: evidenceStrength(ev, r.supportingFactIds),
        problemRelevance: problemRelevance(ev, c.id),
        explanatoryPower: explanatoryPower(r.supportingFactIds),
        actionability: ACTIONABILITY[c.id] != null ? ACTIONABILITY[c.id] : 1,
        worldModelFit: 0, // filled below
        note: r.note
      })
    }
  }

  // §3 — WorldModel may only RE-RANK (fit), never create. Fit = the fired
  // contradiction's supporting reality facts agreeing with a reportable axis.
  const reportableAxes = (worldModel && worldModel.axes)
    ? Object.keys(worldModel.axes).filter((k) => worldModel.axes[k] && worldModel.axes[k].reportable === true)
    : []
  const mismatchCodes = (worldModel && worldModel._mismatchCodes) || []
  for (const c of fired) {
    let fit = 0
    if (reportableAxes.length) {
      // a contradiction that ties to a reportable axis gets a small deterministic
      // tie-break nudge (never manufactured, only among already-fired)
      const modelFit = { EFFORT_ALLOCATION: ['RULE', 'LABOR'], CAPABILITY_UNEXPOSED: ['LABOR', 'PROBABILITY'], CAPABILITY_VS_MARKET_PROOF: ['EVIDENCE', 'LABOR'], STABILITY_BINDING: ['RULE'], STABILITY_VS_OPTIONALITY: ['PROBABILITY'], DEBT_PRESSURE_DOMINANT: ['SYSTEM'] }
      const want = modelFit[c.contradictionId] || []
      fit = want.filter((a) => reportableAxes.indexOf(a) !== -1).length
    }
    if (mismatchCodes.length) fit += 0 // codes never boost; explanation-only
    c.worldModelFit = fit
  }

  fired.sort((a, b) => {
    if (b.evidenceStrength !== a.evidenceStrength) return b.evidenceStrength - a.evidenceStrength
    if (b.dimensionCount !== a.dimensionCount) return b.dimensionCount - a.dimensionCount
    if (b.problemRelevance !== a.problemRelevance) return b.problemRelevance - a.problemRelevance
    if (b.explanatoryPower !== a.explanatoryPower) return b.explanatoryPower - a.explanatoryPower
    if (b.actionability !== a.actionability) return b.actionability - a.actionability
    if (b.worldModelFit !== a.worldModelFit) return b.worldModelFit - a.worldModelFit
    return a.contradictionId < b.contradictionId ? -1 : 1
  })

  const primary = fired[0] || null
  const secondary = fired[1] || null
  return {
    version: CONTRADICTION_ENGINE_VERSION,
    candidates: fired,
    primary: primary,
    secondary: secondary,
    PRIMARY_CASE_CONTRADICTION: primary ? primary.contradictionId : null,
    SECONDARY_CASE_CONTRADICTION: secondary ? secondary.contradictionId : null,
    firedCount: fired.length,
    // guard: every fired contradiction must have ≥2 independent reality facts
    MIN_FACT_VIOLATION_COUNT: fired.filter((c) => c.supportingFactCount < 2).length
  }
}

module.exports = {
  CONTRADICTION_ENGINE_VERSION,
  DIMENSION_OF,
  PROBLEM_RELEVANCE,
  ACTIONABILITY,
  CANDIDATES,
  computeContradictionEngineV1
}
