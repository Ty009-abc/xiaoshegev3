'use strict'
/**
 * turnaroundStrategy/v6/reasoning/realityEvidenceV1.js
 *
 * R87B1 §1/§2/§4 — REALITY EVIDENCE V1.
 *
 * Core principle: USER REALITY = SUBJECT · WORLD MODEL = EXPLANATORY ENGINE.
 *
 * Compiles the user's SUPPORTED reality facts into a provenance-preserving
 * evidence store. Every fact keeps:
 *   factId · field · normalizedValue · semanticMeaning · evidenceClass ·
 *   confidence · allowedClaims[] · forbiddenClaims[] · sourceQuestion
 *
 * Cognitive answers are kept SEPARATELY traceable (`cognitiveEvidence`) and may
 * NEVER be promoted into a reality fact (and vice versa).
 *
 * HARD BOUNDARIES (§2) — the module NEVER invents:
 *   过去一年 / 长期 / 每天 · 公司按时间付钱 · 老板认可 · 市场需求 ·
 *   客户愿意付费 · 未来收入 · 心理状态
 * `auditFactBoundaries()` reports the four required gate counters.
 *
 * Deterministic. Pure data + pure functions. No AI. No I/O. No network.
 * This module is NOT wired into production five-card rendering (R87B1).
 */

const path = require('path')
const C = require(path.join(__dirname, '..', 'hybrid', 'hybridContractV6.js'))

const REALITY_EVIDENCE_VERSION = 'r87b1_reality_evidence_v1'

const EVIDENCE_CLASS = Object.freeze({
  OBSERVED: 'OBSERVED',
  DERIVED: 'DERIVED',
  INFERRED: 'INFERRED',
  UNKNOWN: 'UNKNOWN'
})
const CONFIDENCE = Object.freeze({ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW', UNKNOWN: 'UNKNOWN' })
const CLASS_WEIGHT = Object.freeze({ OBSERVED: 2, DERIVED: 1, INFERRED: 0, UNKNOWN: 0 })

// ── §1 reality fields (14) + cognitive fields (7) ──────────────────────────
const REALITY_FIELDS = Object.freeze([
  'lifeStage', 'incomeStructure', 'occupationDetail', 'occupationCategory',
  'pricingAuthority', 'monthlySurplus', 'safetyMonths', 'debtPressure',
  'skillValidation', 'monetizableSkill', 'weeklyTime', 'pastAttemptStage',
  'primaryProblem', 'maxTrialCost'
])
const COGNITIVE_FIELDS = Object.freeze([
  'laborModel', 'decisionStyle', 'systemModel', 'ruleModel',
  'failureResponse', 'timeBehavior', 'selfBelief'
])

// ── source question per field (10-screen client questionnaire) ─────────────
const SOURCE_QUESTION = Object.freeze({
  lifeStage: 'S1·你目前处于什么人生阶段？',
  incomeStructure: 'S2·你的主要收入结构是？',
  occupationCategory: 'S2·你的工作更接近哪一类？',
  occupationDetail: 'S2·写具体一点（职业）',
  pricingAuthority: 'S2·你现在这份主要收入，谁决定你最后能拿多少钱？',
  monthlySurplus: 'S3·你每个月扣除所有支出后，还剩多少？',
  safetyMonths: 'S4·如果明天开始你没有任何收入，存款能撑多久？',
  debtPressure: 'S4·你目前的负债情况是？',
  skillValidation: 'S5·你的能力被市场验证到什么程度了？',
  monetizableSkill: 'S5·你最可能变现的能力是哪一类？',
  weeklyTime: 'S6·你每周能挤出多少可自由支配的时间？',
  laborModel: 'S6·多出10小时你更愿意先花在哪？',
  pastAttemptStage: 'S7·过去一年，你最接近赚钱的一次尝试是？',
  selfBelief: 'S7·你觉得自己一直没真正做起来，最主要卡在哪？',
  decisionStyle: 'S8·朋友靠做某件事赚到钱劝你也做，你最先做什么？',
  timeBehavior: 'S8·一件今天见效、一件几个月见效，你通常怎么选？',
  primaryProblem: 'S9·未来12个月若只能先解决一个问题，你最想先解决什么？',
  systemModel: 'S9·一个店反复出同一个问题，你更可能怎么想？',
  maxTrialCost: 'S10·你能承受的最大试错成本是多少？',
  failureResponse: 'S10·你做成了一件事，别人夸你厉害，你更可能怎么处理？',
  ruleModel: 'S10·同一份活你干得更多更快、收入却没变，你先想的是？'
})

// ── ALLOWED / FORBIDDEN claim templates (§2 boundaries baked in) ───────────
// `allowed` receives the canonical option text. `forbidden` is static per field.
const CLAIM_TEMPLATES = Object.freeze({
  lifeStage: {
    allowed: (t) => ['你目前处于' + t + '这一人生阶段'],
    forbidden: ['你到了必须转型的年纪', '中年危机', '你已经老了']
  },
  incomeStructure: {
    allowed: (t) => ['你的主要收入结构是：' + t],
    forbidden: ['公司按时间付你钱', '你的收入很稳定安全', '老板认可你']
  },
  occupationDetail: {
    allowed: (t) => ['你目前从事的具体职业是：' + t],
    forbidden: ['你这种职业没前途', '你的行业会被取代']
  },
  occupationCategory: {
    allowed: (t) => ['你的工作更接近：' + t + '这一类'],
    forbidden: ['你这种职业没前途']
  },
  pricingAuthority: {
    allowed: (t) => ['你现在这份收入的定价方是：' + t],
    forbidden: ['你没有能力', '你被公司控制', '公司按时间付你钱']
  },
  monthlySurplus: {
    allowed: (t) => ['你每月扣除支出后剩余：' + t],
    forbidden: ['你财务健康', '你一定入不敷出', '你未来收入会更高']
  },
  safetyMonths: {
    allowed: (t) => ['如果没有任何收入，你的存款能撑：' + t],
    forbidden: ['你马上会破产', '你完全没有退路']
  },
  debtPressure: {
    allowed: (t) => ['你目前的负债情况是：' + t],
    forbidden: ['你的债务会拖垮你', '你被债务压垮']
  },
  skillValidation: {
    allowed: (t) => ['你的能力被市场验证的程度是：' + t],
    forbidden: ['你从未变现（除非 PROOF_NEVER）', '你没有能力', '客户愿意为你付费']
  },
  monetizableSkill: {
    allowed: (t) => ['你最可能变现的能力类别是：' + t],
    forbidden: ['你一定靠它赚钱', '这个能力没有市场']
  },
  weeklyTime: {
    allowed: (t) => ['你每周可自由支配的时间约：' + t],
    forbidden: ['你没有时间', '你很忙']
  },
  pastAttemptStage: {
    // NOTE: this fact is the ONLY one whose source question carries a temporal
    // frame ("过去一年") → temporal tokens are permitted on this fact only.
    allowed: (t) => ['过去一年，你最接近赚钱的一次尝试是：' + t],
    forbidden: ['你试过很多次', '你一直在努力', '你每天都很拼']
  },
  primaryProblem: {
    allowed: (t) => ['你未来12个月最想先解决的是：' + t],
    forbidden: ['这就是你真正的瓶颈', '你其实知道答案']
  },
  maxTrialCost: {
    allowed: (t) => ['你能承受的最大试错成本是：' + t],
    forbidden: ['你应该投入更多钱', '你该借钱试错']
  }
})

// cognitive claim templates (kept SEPARATE — never a reality fact)
const COGNITIVE_CLAIM_TEMPLATES = Object.freeze({
  laborModel: { allowed: (t) => ['在' + '「多出10小时」' + '的场景下，你倾向：' + t] },
  decisionStyle: { allowed: (t) => ['在' + '「别人做成了劝你也做」' + '的场景下，你最可能先做：' + t] },
  systemModel: { allowed: (t) => ['在' + '「问题反复出现」' + '的场景下，你更可能想：' + t] },
  ruleModel: { allowed: (t) => ['在' + '「干得更多收入却没变」' + '的场景下，你先想的是：' + t] },
  failureResponse: { allowed: (t) => ['在' + '「做成事被夸」' + '的场景下，你更可能：' + t] },
  timeBehavior: { allowed: (t) => ['在' + '「今天见效 vs 几个月见效」' + '的场景下，你通常：' + t] },
  selfBelief: { allowed: (t) => ['你自述一直没做起来主要卡在：' + t] }
})

// ── §2 forbidden-token lexicons (used by auditFactBoundaries) ──────────────
const PSYCHOLOGY_TOKENS = ['不敢', '不敢动', '害怕', '怕失败', '怕被拒', '舍不得', '放不下', '自卑', '逃避', '回避', '焦虑', '虚荣', '拖延']
const EMPLOYMENT_MECHANIC_TOKENS = ['按时间付钱', '按工时', '老板认可', '公司按时间付钱', '市场需求', '客户愿意付费', '未来收入']
const TEMPORAL_TOKENS = ['过去一年', '长期', '每天', '一直', '经常', '总是', '常年']
// fields whose SOURCE QUESTION legitimately carries a temporal frame
const TEMPORAL_SOURCE_FIELDS = ['pastAttemptStage']

function isPresent (v) { return v !== undefined && v !== null && String(v).trim() !== '' }

function humanMeaning (field, value) {
  const txt = C.optionTextFor(field, value)
  if (txt) return txt
  // free-text field (occupationDetail)
  if (typeof value === 'string') return value.trim()
  return null
}

/**
 * Build ONE reality fact. Returns null when the raw value is absent (no invented
 * facts) or unrecognised (fail-closed).
 */
function buildFact (field, raw) {
  const v = raw ? raw[field] : null
  if (!isPresent(v)) return null
  const isFree = C.isFreeText && C.isFreeText(field)
  const known = isFree ? String(v).trim() : C.resolveOptionId(field, v)
  if (!known) return null // unknown option → no fact (never invented)
  const tmpl = CLAIM_TEMPLATES[field]
  const meaning = isFree ? String(v).trim() : humanMeaning(field, known)
  return {
    factId: field,
    field: field,
    rawValue: v,
    normalizedValue: known,
    semanticMeaning: meaning,
    evidenceClass: EVIDENCE_CLASS.OBSERVED,
    confidence: CONFIDENCE.HIGH,
    allowedClaims: tmpl ? tmpl.allowed(meaning || known) : ['（' + field + '=' + known + '）'],
    forbiddenClaims: tmpl ? tmpl.forbidden.slice() : [],
    sourceQuestion: SOURCE_QUESTION[field] || field
  }
}

function buildCognitiveFact (field, raw) {
  const v = raw ? raw[field] : null
  if (!isPresent(v)) return null
  const known = C.resolveOptionId(field, v)
  if (!known) return null
  const tmpl = COGNITIVE_CLAIM_TEMPLATES[field]
  const meaning = humanMeaning(field, known)
  return {
    cognitiveId: field,
    field: field,
    rawValue: v,
    normalizedValue: known,
    semanticMeaning: meaning,
    evidenceClass: EVIDENCE_CLASS.OBSERVED,
    confidence: CONFIDENCE.HIGH,
    allowedClaims: tmpl ? tmpl.allowed(meaning || known) : [],
    // cognitive signal is NEVER a reality fact and never carries a reality claim
    forbiddenClaims: ['把这个信号当成现实事实', '据此断言现实结果'],
    sourceQuestion: SOURCE_QUESTION[field] || field
  }
}

// ── value helpers (semantic bands — pure, no judgement) ────────────────────
const PRICING_EXTERNAL = ['PRICE_EMPLOYER', 'PRICE_PLATFORM', 'PRICE_CLIENT']
const PRICING_SELF = ['PRICE_SELF']
const PRICING_SHARED = ['PRICE_MIXED', 'PRICE_UNKNOWN']
const PROOF_NONE = ['PROOF_NEVER', 'PROOF_FREE_HELPED', 'PROOF_FREE_THANKED']
const PROOF_PAID = ['PROOF_PAID_ONCE', 'PROOF_OCCASIONAL', 'PROOF_STABLE']
const ATTEMPT_NONE = ['ATTEMPT_NONE', 'ATTEMPT_COURSE_ONLY']
const ATTEMPT_EXISTS = ['ATTEMPT_UNDER_30D', 'ATTEMPT_NO_SALE', 'ATTEMPT_FEW_SALES', 'ATTEMPT_STABLE_SIDE']
const SAFETY_THIN = ['SAFETY_UNDER_1', 'SAFETY_1_3']
const SAFETY_STRONG = ['SAFETY_6_12', 'SAFETY_12_24', 'SAFETY_24_PLUS']
const TIME_HIGH = ['TIME_5_10', 'TIME_10_20', 'TIME_20_PLUS']
const TIME_LOW = ['TIME_UNDER_2', 'TIME_2_5']
const SURPLUS_LOW = ['SURPLUS_NEGATIVE', 'SURPLUS_ZERO', 'SURPLUS_UNDER_1K']
const DEBT_HIGH = ['DEBT_CONSUMER', 'DEBT_HIGH']
const DEBT_NONE_V = ['DEBT_NONE']
const INCOME_STABLE = ['INC_SALARY', 'INC_COMMISSION']

function valueOf (byField, field) {
  const f = byField[field]
  return f ? f.normalizedValue : null
}
function inList (byField, field, list) {
  const v = valueOf(byField, field)
  return v != null && list.indexOf(v) !== -1
}

/**
 * Compile the RealityEvidenceV1 store.
 * @param {Object} raw validated hybrid answers
 * @returns {Object} evidence store
 */
function buildRealityEvidenceV1 (raw) {
  const r = raw || {}
  const facts = []
  const byField = {}
  for (const field of REALITY_FIELDS) {
    const f = buildFact(field, r)
    if (f) { facts.push(f); byField[field] = f }
  }
  const cognitive = []
  const cognitiveByField = {}
  for (const field of COGNITIVE_FIELDS) {
    const f = buildCognitiveFact(field, r)
    if (f) { cognitive.push(f); cognitiveByField[field] = f }
  }

  // derived flags — DERIVED, never OBSERVED; not "facts" (no provenance claim)
  const derivedFlags = deriveFlags(byField)

  return {
    version: REALITY_EVIDENCE_VERSION,
    facts: facts,
    byField: byField,
    factCount: facts.length,
    cognitive: cognitive,
    cognitiveByField: cognitiveByField,
    cognitiveCount: cognitive.length,
    derivedFlags: derivedFlags
  }
}

/** Recompute derived flags from a byField map (used by counterfactual reduction). */
function deriveFlags (byField) {
  return {
    pricingExternal: inList(byField, 'pricingAuthority', PRICING_EXTERNAL),
    pricingSelf: inList(byField, 'pricingAuthority', PRICING_SELF),
    proofWeak: inList(byField, 'skillValidation', PROOF_NONE),
    proofPaid: inList(byField, 'skillValidation', PROOF_PAID),
    attemptNone: inList(byField, 'pastAttemptStage', ATTEMPT_NONE),
    attemptExists: inList(byField, 'pastAttemptStage', ATTEMPT_EXISTS),
    safetyThin: inList(byField, 'safetyMonths', SAFETY_THIN),
    safetyStrong: inList(byField, 'safetyMonths', SAFETY_STRONG),
    timeHigh: inList(byField, 'weeklyTime', TIME_HIGH),
    timeLow: inList(byField, 'weeklyTime', TIME_LOW),
    surplusLow: inList(byField, 'monthlySurplus', SURPLUS_LOW),
    debtHigh: inList(byField, 'debtPressure', DEBT_HIGH),
    debtNone: inList(byField, 'debtPressure', DEBT_NONE_V),
    incomeStable: inList(byField, 'incomeStructure', INCOME_STABLE)
  }
}

/**
 * Return a COPY of the evidence store with the named fact fields REMOVED,
 * flags recomputed. Used by the §5 counterfactual test. Never mutates input.
 */
function reduceEvidence (evidence, removeIds) {
  const rm = removeIds || []
  const facts = ((evidence && evidence.facts) || []).filter((f) => rm.indexOf(f.field) === -1)
  const byField = {}
  for (const f of facts) byField[f.field] = f
  return Object.assign({}, evidence, {
    facts: facts,
    byField: byField,
    factCount: facts.length,
    derivedFlags: deriveFlags(byField)
  })
}

function claimTexts (evidence) {
  const out = []
  for (const f of evidence.facts) for (const c of f.allowedClaims) out.push({ field: f.field, claim: c })
  return out
}

/**
 * §2 hard-gate audit. All four counters MUST be 0.
 * @returns {{FABRICATED_FACT_COUNT, FABRICATED_PSYCHOLOGY_COUNT, TEMPORAL_FACT_WITHOUT_SOURCE_COUNT, EMPLOYMENT_MECHANIC_OVERCLAIM_COUNT}}
 */
function auditFactBoundaries (evidence) {
  const facts = (evidence && evidence.facts) || []
  let fabricatedFact = 0
  let fabricatedPsychology = 0
  let temporalWithoutSource = 0
  let employmentOverclaim = 0

  for (const f of facts) {
    // a fact is "fabricated" when its value is absent from raw or unresolvable
    const isFree = C.isFreeText && C.isFreeText(f.field)
    if (!isPresent(f.rawValue) || (!isFree && !C.resolveOptionId(f.field, f.rawValue))) fabricatedFact++
    const temporalOk = TEMPORAL_SOURCE_FIELDS.indexOf(f.field) !== -1
    for (const c of f.allowedClaims) {
      for (const p of PSYCHOLOGY_TOKENS) if (c.indexOf(p) !== -1) fabricatedPsychology++
      for (const t of TEMPORAL_TOKENS) if (c.indexOf(t) !== -1 && !temporalOk) temporalWithoutSource++
      for (const m of EMPLOYMENT_MECHANIC_TOKENS) if (c.indexOf(m) !== -1) employmentOverclaim++
    }
    for (const c of f.forbiddenClaims) {
      // forbidden claims are declarations of what may NOT be said — never counted
      void c
    }
  }
  return {
    FABRICATED_FACT_COUNT: fabricatedFact,
    FABRICATED_PSYCHOLOGY_COUNT: fabricatedPsychology,
    TEMPORAL_FACT_WITHOUT_SOURCE_COUNT: temporalWithoutSource,
    EMPLOYMENT_MECHANIC_OVERCLAIM_COUNT: employmentOverclaim
  }
}

module.exports = {
  REALITY_EVIDENCE_VERSION,
  EVIDENCE_CLASS,
  CONFIDENCE,
  CLASS_WEIGHT,
  REALITY_FIELDS,
  COGNITIVE_FIELDS,
  SOURCE_QUESTION,
  CLAIM_TEMPLATES,
  PSYCHOLOGY_TOKENS,
  EMPLOYMENT_MECHANIC_TOKENS,
  TEMPORAL_TOKENS,
  buildRealityEvidenceV1,
  buildFact,
  buildCognitiveFact,
  deriveFlags,
  reduceEvidence,
  humanMeaning,
  valueOf,
  inList,
  claimTexts,
  auditFactBoundaries,
  // value bands (shared with the contradiction engine)
  BANDS: {
    PRICING_EXTERNAL, PRICING_SELF, PRICING_SHARED, PROOF_NONE, PROOF_PAID,
    ATTEMPT_NONE, ATTEMPT_EXISTS, SAFETY_THIN, SAFETY_STRONG, TIME_HIGH, TIME_LOW,
    SURPLUS_LOW, DEBT_HIGH, DEBT_NONE_V, INCOME_STABLE
  }
}
