'use strict'
/**
 * turnaroundStrategy/v6/hybrid/realEconomyModelV6.js
 *
 * RC8.4 V6 R85-B — DETERMINISTIC REAL ECONOMY MODEL.
 *
 * Turns reality signals (occupation category + specific occupation · income
 * structure · monetizable skill · market proof) into a SMALL, EXPLAINABLE
 * economic model the thesis layer can use as grounded CAUSAL input:
 *
 *   dimensions: TIME_FOR_MONEY · CLIENT_PROXIMITY · PORTABILITY ·
 *               INDEPENDENT_PRICING · REPEATABILITY
 *   modifiers:  EMPLOYER_DEPENDENCE · PLATFORM_DEPENDENCE · PHYSICAL_DEPENDENCE
 *
 * Every dimension carries value (HIGH/MEDIUM/LOW/UNKNOWN) + sourceEvidence[] +
 * confidence. Each evidence contribution is classified OBSERVED / DERIVED /
 * INFERRED (never a fake number, never a single-signal stereotype).
 *
 * AUTHORITY (frozen):
 *   - ZERO bottleneck authority. This module is NEVER read by any B1 file.
 *     It only produces report/context material (realEconomyModel).
 *   - NO external market data. NO salary range / industry outlook / job-loss
 *     probability / AI-displacement percentage is ever emitted.
 *   - Occupation alone NEVER produces salary amount / job security / outlook /
 *     AI risk. It only contributes an INFERRED prior that must be combined with
 *     income structure + proof before any dimension is asserted.
 *
 * CONSUMER LAYER ONLY. Deterministic. No AI. No I/O. No network.
 */

const ECONOMY_VERSION = 'r85b_real_economy_v1'

const EVIDENCE = Object.freeze({
  OBSERVED: 'OBSERVED',
  DERIVED: 'DERIVED',
  INFERRED: 'INFERRED',
  UNKNOWN: 'UNKNOWN'
})

const DIMENSIONS = Object.freeze([
  'TIME_FOR_MONEY', 'CLIENT_PROXIMITY', 'PORTABILITY', 'INDEPENDENT_PRICING', 'REPEATABILITY'
])
const MODIFIERS = Object.freeze([
  'EMPLOYER_DEPENDENCE', 'PLATFORM_DEPENDENCE', 'PHYSICAL_DEPENDENCE'
])
const ALL_DIMENSIONS = Object.freeze(DIMENSIONS.concat(MODIFIERS))

// The production occupation categories (client quick-select). Kept minimal and
// non-hierarchical: a category is a CONTEXT prior, never a destiny.
const OCCUPATION_CATEGORIES = Object.freeze([
  'OCC_TECH', 'OCC_SALES', 'OCC_SERVICE', 'OCC_PLATFORM_LABOR',
  'OCC_SELF_EMPLOYED', 'OCC_CONTENT_CREATIVE', 'OCC_OPERATIONS_ADMIN', 'OCC_OTHER'
])

// ── §10 INCOME MODEL (normalizes EVERY production incomeStructure) ──
// The hybrid contract's B1-facing `canonicalFor('incomeStructure', …)` keeps its
// frozen (possibly null) value — B1 must not change. THIS layer is the normalized
// economic income model, so R85-A's null-mapping gaps are closed here without
// touching B1 authority.
const INCOME_MODEL = Object.freeze({
  INC_SALARY: { model: 'SALARIED_LABOR', note: '收入来自雇主支付的固定薪资' },
  INC_SKILL_SERVICE: { model: 'SERVICE_FEE', note: '收入来自按次/按项目的服务收费' },
  INC_COMMISSION: { model: 'COMMISSION', note: '收入与成交/提成直接挂钩' },
  INC_BUSINESS: { model: 'OWNED_BUSINESS', note: '收入来自自己在经营的生意' },
  INC_CONTENT: { model: 'CONTENT_MONETIZATION', note: '收入来自内容/流量的变现' },
  INC_ASSET: { model: 'ASSET_INCOME', note: '收入来自资产/投资/租金' },
  INC_UNSTABLE: { model: 'IRREGULAR', note: '收入来源不稳定、结构不清晰' }
})

// ── occupation category PRIORS (INFERRED, MEDIUM confidence) ──
// Deliberately coarse. Combined with income + proof before assert. NO salary,
// NO outlook, NO displacement, NO "poor / low-education / no-skill" semantics.
const OCC_PRIOR = Object.freeze({
  OCC_TECH: { TIME_FOR_MONEY: 'MEDIUM', PORTABILITY: 'HIGH', INDEPENDENT_PRICING: 'MEDIUM', CLIENT_PROXIMITY: 'LOW', REPEATABILITY: 'MEDIUM', EMPLOYER_DEPENDENCE: 'MEDIUM', PLATFORM_DEPENDENCE: 'LOW', PHYSICAL_DEPENDENCE: 'LOW' },
  OCC_SALES: { TIME_FOR_MONEY: 'HIGH', PORTABILITY: 'MEDIUM', INDEPENDENT_PRICING: 'MEDIUM', CLIENT_PROXIMITY: 'HIGH', REPEATABILITY: 'MEDIUM', EMPLOYER_DEPENDENCE: 'MEDIUM', PLATFORM_DEPENDENCE: 'LOW', PHYSICAL_DEPENDENCE: 'LOW' },
  OCC_SERVICE: { TIME_FOR_MONEY: 'HIGH', PORTABILITY: 'LOW', INDEPENDENT_PRICING: 'MEDIUM', CLIENT_PROXIMITY: 'MEDIUM', REPEATABILITY: 'MEDIUM', EMPLOYER_DEPENDENCE: 'MEDIUM', PLATFORM_DEPENDENCE: 'LOW', PHYSICAL_DEPENDENCE: 'MEDIUM' },
  OCC_PLATFORM_LABOR: { TIME_FOR_MONEY: 'HIGH', PORTABILITY: 'LOW', INDEPENDENT_PRICING: 'LOW', CLIENT_PROXIMITY: 'LOW', REPEATABILITY: 'LOW', EMPLOYER_DEPENDENCE: 'LOW', PLATFORM_DEPENDENCE: 'HIGH', PHYSICAL_DEPENDENCE: 'HIGH' },
  OCC_SELF_EMPLOYED: { TIME_FOR_MONEY: 'MEDIUM', PORTABILITY: 'MEDIUM', INDEPENDENT_PRICING: 'HIGH', CLIENT_PROXIMITY: 'HIGH', REPEATABILITY: 'MEDIUM', EMPLOYER_DEPENDENCE: 'LOW', PLATFORM_DEPENDENCE: 'LOW', PHYSICAL_DEPENDENCE: 'MEDIUM' },
  OCC_CONTENT_CREATIVE: { TIME_FOR_MONEY: 'MEDIUM', PORTABILITY: 'HIGH', INDEPENDENT_PRICING: 'MEDIUM', CLIENT_PROXIMITY: 'MEDIUM', REPEATABILITY: 'MEDIUM', EMPLOYER_DEPENDENCE: 'LOW', PLATFORM_DEPENDENCE: 'MEDIUM', PHYSICAL_DEPENDENCE: 'LOW' },
  OCC_OPERATIONS_ADMIN: { TIME_FOR_MONEY: 'HIGH', PORTABILITY: 'MEDIUM', INDEPENDENT_PRICING: 'LOW', CLIENT_PROXIMITY: 'LOW', REPEATABILITY: 'MEDIUM', EMPLOYER_DEPENDENCE: 'HIGH', PLATFORM_DEPENDENCE: 'LOW', PHYSICAL_DEPENDENCE: 'LOW' }
})

// ── income structure EFFECT (DERIVED from an OBSERVED answer) ──
const INCOME_EFFECT = Object.freeze({
  INC_SALARY: { EMPLOYER_DEPENDENCE: 'HIGH', CLIENT_PROXIMITY: 'LOW', INDEPENDENT_PRICING: 'LOW' },
  INC_SKILL_SERVICE: { CLIENT_PROXIMITY: 'HIGH', INDEPENDENT_PRICING: 'HIGH', REPEATABILITY: 'MEDIUM' },
  INC_COMMISSION: { CLIENT_PROXIMITY: 'HIGH', TIME_FOR_MONEY: 'HIGH' },
  INC_BUSINESS: { CLIENT_PROXIMITY: 'HIGH', INDEPENDENT_PRICING: 'HIGH', EMPLOYER_DEPENDENCE: 'LOW' },
  INC_CONTENT: { PORTABILITY: 'HIGH', PLATFORM_DEPENDENCE: 'MEDIUM' },
  INC_ASSET: { TIME_FOR_MONEY: 'LOW', INDEPENDENT_PRICING: 'HIGH' },
  INC_UNSTABLE: { REPEATABILITY: 'LOW', INDEPENDENT_PRICING: 'MEDIUM' }
})

// ── market-proof EFFECT (DERIVED from the OBSERVED proof ladder) ──
const PROOF_EFFECT = Object.freeze({
  PROOF_NEVER: { INDEPENDENT_PRICING: 'LOW', REPEATABILITY: 'LOW' },
  PROOF_FREE_HELPED: { INDEPENDENT_PRICING: 'LOW' },
  PROOF_FREE_THANKED: { INDEPENDENT_PRICING: 'LOW', CLIENT_PROXIMITY: 'MEDIUM' },
  PROOF_PAID_ONCE: { INDEPENDENT_PRICING: 'MEDIUM', REPEATABILITY: 'LOW', CLIENT_PROXIMITY: 'MEDIUM' },
  PROOF_OCCASIONAL: { INDEPENDENT_PRICING: 'MEDIUM', REPEATABILITY: 'MEDIUM' },
  PROOF_STABLE: { INDEPENDENT_PRICING: 'HIGH', REPEATABILITY: 'HIGH' }
})

const LEVEL_SCORE = { LOW: 0, MEDIUM: 1, HIGH: 2 }

function isCategory (c) { return OCCUPATION_CATEGORIES.indexOf(c) !== -1 }

/** Resolve ONE dimension from its evidence contributions (explainable bucket). */
function resolveDimension (dim, contrib) {
  if (!contrib.length) return { value: 'UNKNOWN', confidence: 'UNKNOWN', sourceEvidence: [] }
  let sum = 0
  let hasDerived = false
  for (const c of contrib) {
    sum += LEVEL_SCORE[c.level]
    if (c.class === EVIDENCE.DERIVED || c.class === EVIDENCE.OBSERVED) hasDerived = true
  }
  const avg = sum / contrib.length
  let value
  if (avg >= 1.5) value = 'HIGH'
  else if (avg >= 0.75) value = 'MEDIUM'
  else value = 'LOW'
  return {
    value: value,
    confidence: hasDerived ? 'HIGH' : 'MEDIUM',
    sourceEvidence: contrib.map((c) => ({ source: c.source, class: c.class, level: c.level, note: c.note }))
  }
}

/**
 * Compute the deterministic real economy model.
 * @param {Object} hybrid HybridProfile (reality / asset / capacity / desiredChange / stage)
 * @returns {Object} model (version / occupation / category / incomeModel / dimensions / flags)
 */
function computeRealEconomyModelV6 (hybrid) {
  const h = hybrid || {}
  const r = h.reality || {}
  const a = h.asset || {}
  const d = h.desiredChange || {}

  const category = isCategory(r.occupationCategory) ? r.occupationCategory : null
  const incomeStructure = r.incomeStructure || null
  const income = INCOME_MODEL[incomeStructure] || null
  const proof = a.marketProof || null

  const dimensions = {}
  for (const dim of ALL_DIMENSIONS) {
    const contrib = []
    if (category && OCC_PRIOR[category] && OCC_PRIOR[category][dim]) {
      contrib.push({ source: 'occupationCategory=' + category, class: EVIDENCE.INFERRED, level: OCC_PRIOR[category][dim], note: '职业类别先验' })
    }
    if (incomeStructure && INCOME_EFFECT[incomeStructure] && INCOME_EFFECT[incomeStructure][dim]) {
      contrib.push({ source: 'incomeStructure=' + incomeStructure, class: EVIDENCE.DERIVED, level: INCOME_EFFECT[incomeStructure][dim], note: '收入结构' })
    }
    if (proof && PROOF_EFFECT[proof] && PROOF_EFFECT[proof][dim]) {
      contrib.push({ source: 'skillValidation=' + proof, class: EVIDENCE.DERIVED, level: PROOF_EFFECT[proof][dim], note: '市场验证等级' })
    }
    dimensions[dim] = resolveDimension(dim, contrib)
  }

  return {
    version: ECONOMY_VERSION,
    occupation: r.occupation || null,
    occupationCategory: category,
    incomeStructure: incomeStructure,
    incomeModel: income ? income.model : null,
    incomeNote: income ? income.note : null,
    marketProof: proof,
    primaryGoal: d.primaryGoal || null,
    dimensions: dimensions,
    flags: {
      hasOccupation: !!r.occupation,
      occupationCategoryKnown: !!category,
      incomeMapped: !!income,
      proofKnown: !!proof
    }
  }
}

/** Every production incomeStructure closed over by the normalized income model. */
function productionIncomeStructures () {
  return Object.keys(INCOME_MODEL)
}

/** Count production income options the normalized model FAILS to map (expected 0). */
function countUnmappedIncomeStructures (productionOptions) {
  const opts = Array.isArray(productionOptions) ? productionOptions : productionIncomeStructures()
  return opts.filter((o) => !INCOME_MODEL[o]).length
}

/** A compact structural signature (for distinctness checks — no copy involved). */
function economySignature (model) {
  if (!model) return ''
  const parts = ALL_DIMENSIONS.map((d) => d + '=' + ((model.dimensions[d] || {}).value || 'UNKNOWN'))
  return (model.occupationCategory || 'NONE') + '|' + (model.incomeModel || 'NONE') + '|' + parts.join(',')
}

/** Human+model readable lines for the prompt (structured causal input). */
function renderEconomyLines (model) {
  if (!model) return []
  const dim = (d) => {
    const x = model.dimensions[d] || { value: 'UNKNOWN', confidence: 'UNKNOWN', sourceEvidence: [] }
    const ev = (x.sourceEvidence || []).map((s) => s.class).filter((v, i, arr) => arr.indexOf(v) === i).join('/') || 'UNKNOWN'
    return '- ' + d + '：' + x.value + '（证据：' + ev + '，置信度：' + x.confidence + '）'
  }
  const lines = []
  lines.push('- 职业：' + (model.occupation || '（未提供）') + (model.occupationCategory ? '（类别：' + model.occupationCategory + '）' : ''))
  lines.push('- 收入机制：' + (model.incomeModel || 'UNKNOWN') + (model.incomeNote ? '（' + model.incomeNote + '）' : ''))
  lines.push('- 市场验证等级：' + (model.marketProof || 'UNKNOWN'))
  for (const d of DIMENSIONS) lines.push(dim(d))
  lines.push('-- 依赖修饰 --')
  for (const d of MODIFIERS) lines.push(dim(d))
  return lines
}

module.exports = {
  ECONOMY_VERSION,
  EVIDENCE,
  DIMENSIONS,
  MODIFIERS,
  ALL_DIMENSIONS,
  OCCUPATION_CATEGORIES,
  INCOME_MODEL,
  OCC_PRIOR,
  INCOME_EFFECT,
  PROOF_EFFECT,
  computeRealEconomyModelV6,
  resolveDimension,
  productionIncomeStructures,
  countUnmappedIncomeStructures,
  economySignature,
  renderEconomyLines
}
