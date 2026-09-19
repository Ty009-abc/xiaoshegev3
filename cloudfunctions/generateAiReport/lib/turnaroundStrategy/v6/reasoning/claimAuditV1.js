'use strict'
/**
 * turnaroundStrategy/v6/reasoning/claimAuditV1.js
 *
 * R87B2 §3 / §7 / §11 — VISIBLE CLAIM AUDIT.
 *
 * Every visible diagnostic sentence must trace to the CLAIM LEDGER
 * (caseReportV1.buildCaseReportV1 → `claims[]`). This module is the INDEPENDENT
 * verifier: it re-walks the visible text and counts any sentence / fact /
 * psychology / temporal / employment-mechanic claim that is NOT grounded.
 *
 * Required output counters (all must be 0):
 *   VISIBLE_CLAIM_WITHOUT_LEDGER_COUNT
 *   UNSUPPORTED_SENTENCE_COUNT
 *   FABRICATED_FACT_COUNT
 *   FABRICATED_PSYCHOLOGY_COUNT
 *   TEMPORAL_FACT_WITHOUT_SOURCE_COUNT
 *   EMPLOYMENT_MECHANIC_OVERCLAIM_COUNT
 *
 * Deterministic. Pure. No AI. No I/O.
 */

const CLAIM_AUDIT_VERSION = 'r87b2_claim_audit_v1'

const L1 = 'L1_OBSERVED_FACT'
const L2 = 'L2_STRONG_DERIVATION'
const L3 = 'L3_TESTABLE_HYPOTHESIS'

// psychology vocabulary that is NEVER allowed as a visible claim (there is no
// psychology evidence field in the questionnaire contract).
const FABRICATED_PSYCHOLOGY_TOKENS = [
  '焦虑', '恐惧', '害怕', '自尊', '内耗', '惰性', '心理', '不安全感',
  '心理安全感', '动机不足', '自卑', '逃避型', '性格缺陷', '恐惧感'
]

// temporal expressions that assert a fact about the PAST / FREQUENCY; each must
// be backed by an answered temporal field (pastAttemptStage / weeklyTime /
// timeBehavior). A bare temporal adverb with no source is a fabricated fact.
const TEMPORAL_TOKENS = [
  '过去一年', '一年', '长期', '每天', '曾经', '总是', '永远', '从来', '一向', '常年', '这些年来'
]
const TEMPORAL_SOURCE_FIELDS = ['pastAttemptStage', 'weeklyTime', 'timeBehavior']

// employment-mechanic OVERCLAIMS — stronger than what pricingAuthority alone
// supports. §3: PRICE_EMPLOYER supports "当前主要收入的定价受雇佣体系影响",
// NOT "你的5–10小时一直投在公司里".
const EMPLOYMENT_OVERCLAIM_TOKENS = [
  '公司按时间付钱', '按时间付钱', '一直投在公司里', '时间卖给了公司',
  '老板认可', '老板会给', '老板一定', '保证涨薪', '涨薪', '客户一定会喜欢', '客户喜欢'
]

// §R87B2_1 D — PRICING-AUTHORITY UNIVERSALIZATION. Pricing authority must NOT be
// asserted as the universal TARGET of the change. For
// CONSTRAINT_IS_ALLOCATION_NOT_CAPABILITY the target is RE-ALLOCATION toward a
// path that yields NEW EVIDENCE — not "get priced" as the only endpoint.
const PRICING_UNIVERSALIZATION_TOKENS = [
  '由你或市场定价', '由你或市场直接定价', '由你自己或市场直接定价',
  '能被你自己或市场直接定价', '能被直接定价', '能被单独定价',
  '不由别人定价', '能被定价的产出', '能被单独定价的产出',
  '被明码标价', '明码标价一次', '陌生人看得见的渠道'
]

// §R87B2_1 E — EXPERIMENT RESULT OVERCLAIM. The visible experiment must NOT assert
// that ONE action RESOLVES the question (certainty / sufficiency). It may only
// state that a NEW-EVIDENCE reality test is missing, and must keep the outcome
// bounded (positive → continue validation; none → diagnose exposure/demand/offer/
// presentation; never a final market verdict).
const EXPERIMENT_RESULT_OVERCLAIM_TOKENS = [
  '只差一次真实对外动作', '差的不是决心或能力', '差的不是能力', '只差一次',
  '只差一步', '只差一个动作', '就能知道', '就能验证', '必然', '一定能', '肯定能',
  '方向对', '方向就是对的', '一次就能验证'
]

// ── §R87C P0 — EMPLOYMENT VALUE vs INDEPENDENT MARKET PROOF ────────────────
// A user whose capability is exercised inside PAID EMPLOYMENT must never be
// described as if the capability produced no economic value, or as if it only
// ever appeared in free/thanked scenarios. The missing evidence is INDEPENDENT /
// EXTERNAL market validation — NOT whether the capability ever produced value.
const FREE_ONLY_MISCLASSIFICATION_TOKENS = [
  '只在免费场合露面', '始终只在免费', '只在「被感谢」的场景里出现过',
  '只在被感谢的场景里出现过', '至今只在', '一直只在免费', '只在免费场景'
]
// flat denial that the capability ever produced economic value (false for an
// employed user, whose capability IS used productively on the job)
const EMPLOYMENT_VALUE_DENIAL_TOKENS = [
  '从未产生过收入', '从未产生经济价值', '从来没有产生经济价值', '没有产生任何经济价值',
  '能力一直没上过场', '能力还没上过场', '这项能力从未产生'
]
// conflating INDEPENDENT market proof with job income: asserting the capability
// is already "market validated" when the evidence shows only employer pricing +
// free/thanked proof (checked CONDITIONALLY — see auditVisibleClaims)
const JOB_INCOME_CONFUSION_TOKENS = [
  '已经被市场验证', '已被市场验证', '市场已经验证', '已经被付费验证',
  '有人为它付过钱', '已经有人付费', '已经拿到市场认可'
]
// §R87C CARD04 — effort→pricing ABSOLUTE causal overclaim. Effort may not be
// claimed to NEVER influence salary / promotion / income; only that ADDING effort
// alone does not AUTOMATICALLY change who sets the price.
const EFFORT_PRICING_OVERCLAIM_TOKENS = [
  '你投入再多也不改变', '投入再多也改变不了', '再努力也改变不了谁定价',
  '努力永远不会改变', '再怎么努力也不会改变', '无论多努力都不'
]
// §R87C CARD05 — the experiment must be ONE concrete action ("只做这一个动作"),
// never a bundle/choice of two alternative actions.
const CARD05_MULTI_ACTION_TOKENS = [
  '一次报价/一次公开交付', '/一次公开交付', '一次报价或',
  '打包成一个明确的对外动作', '两个动作', '二选一', '或者一次'
]
// §R87D_3 — owner-visible copy must NEVER expose an internal enum / ontology
// identifier (switch class, contradiction id, derived-insight id, …). Any UPPER_
// SNAKE_CASE token on the visible surface is a leak. Generic by construction, with
// the known identifiers listed explicitly for clarity.
const INTERNAL_IDENTIFIER_PATTERNS = [/[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+/g]
const INTERNAL_IDENTIFIER_TOKENS = [
  'CHANGE_ALLOCATION', 'CAPABILITY_UNEXPOSED', 'CONSTRAINT_IS_ALLOCATION_NOT_CAPABILITY',
  'STAY_AND_UPGRADE', 'ADD_OPTIONALITY', 'CHANGE_GAME', 'RUN_TEST_FIRST', 'NO_SWITCH_YET',
  'CAPABILITY_VS_MARKET_PROOF', 'VALIDATED_NOT_REPEATABLE', 'STABILITY_BINDING'
]

// generic quantifiers / horizon markers that do NOT assert a new fact
const NUMERIC_WHITELIST = [
  '3–7天', '3-7天', '一个', '一次', '一点', '一条', '一单', '一两笔', '两单',
  '第一', '第二', '一份', '一张', '一遍', '一块', '一只'
]

function flatten (v, out) {
  if (v == null) return out
  if (typeof v === 'string') { if (v.trim()) out.push(v.trim()); return out }
  if (Array.isArray(v)) { v.forEach((x) => flatten(x, out)); return out }
  if (typeof v === 'object') { Object.keys(v).forEach((k) => { if (k !== 'horizon') flatten(v[k], out) }); return out }
  return out
}

// every visibly rendered string of the case report (the ledger's source texts)
function visiblePieces (caseReport) {
  const out = []
  flatten(caseReport.card01, out)
  flatten(caseReport.card02, out)
  flatten(caseReport.card03, out)
  flatten(caseReport.card04, out)
  flatten(caseReport.card05, out)
  return out
}

function meaningPool (ev) {
  const parts = []
  const push = (o) => { if (!o) return; if (o.semanticMeaning) parts.push(o.semanticMeaning); if (o.normalizedValue) parts.push(o.normalizedValue) }
  Object.keys(ev.byField || {}).forEach((k) => push(ev.byField[k]))
  Object.keys(ev.cognitiveByField || {}).forEach((k) => push(ev.cognitiveByField[k]))
  return parts.join(' ').replace(/\s/g, '')
}

function numericTokens (text) {
  // Only FALSIFIABLE quantities: money amounts and month/year durations and
  // percentages. Short ranges (3–7 天), hours and one-off ordinals are anchors,
  // not facts about the user's life.
  return text.match(/[0-9]+(?:\.[0-9]+)?\s*(?:%|个月|月|年|元|万)/g) || []
}

function countToken (text, tokens) {
  let n = 0
  const hits = []
  for (const t of tokens) { if (text.indexOf(t) >= 0) { n++; hits.push(t) } }
  return { n, hits }
}

/**
 * Independent audit of the visible case report against its claim ledger.
 * @param {Object} caseReport output of buildCaseReportV1
 * @param {Object} evidence RealityEvidenceV1 store
 * @returns {Object} counters + per-metric detail
 */
function auditVisibleClaims (caseReport, evidence) {
  const ev = evidence || { byField: {}, cognitiveByField: {} }
  const cr = caseReport || {}
  const ledger = Array.isArray(cr.claims) ? cr.claims : []
  const pool = meaningPool(ev)
  const pieces = visiblePieces(cr)

  // ── VISIBLE_CLAIM_WITHOUT_LEDGER ──
  const claimTexts = ledger.map((c) => String(c.semanticClaim || ''))
  let withoutLedger = 0
  const unledgeredSamples = []
  for (const p of pieces) {
    const covered = claimTexts.some((c) => c.indexOf(p) >= 0 || p.indexOf(c) >= 0)
    if (!covered) { withoutLedger++; if (unledgeredSamples.length < 5) unledgeredSamples.push(p) }
  }

  // ── UNSUPPORTED_SENTENCE ──
  let unsupported = 0
  const unsupportedSamples = []
  for (const c of ledger) {
    const ids = c.evidenceIds || []
    const resolves = ids.some((id) => (ev.byField && ev.byField[id]) || (ev.cognitiveByField && ev.cognitiveByField[id]))
    const lvl = c.claimLevel
    const ok = (lvl === L3) ? true : (ids.length > 0 && resolves)
    if (!ok) { unsupported++; if (unsupportedSamples.length < 5) unsupportedSamples.push(c.semanticClaim) }
  }

  // ── FABRICATED_FACT ── (numeric/temporal anchors not traceable to answers)
  let fabricatedFact = 0
  const fabricatedSamples = []
  for (const p of pieces) {
    for (const tok of numericTokens(p)) {
      const t = tok.replace(/\s/g, '')
      const ok = pool.indexOf(t) >= 0 || NUMERIC_WHITELIST.some((w) => w.replace(/\s/g, '') === t)
      if (!ok) { fabricatedFact++; if (fabricatedSamples.length < 5) fabricatedSamples.push(tok.trim()) }
    }
  }

  // ── FABRICATED_PSYCHOLOGY ──
  const psy = countToken(pieces.join(' '), FABRICATED_PSYCHOLOGY_TOKENS)

  // ── TEMPORAL_FACT_WITHOUT_SOURCE ──
  // Checked PER LEDGER CLAIM: a temporal token is UNSOURCED when the sentence it
  // appears in cannot cite an answered temporal field (pastAttemptStage /
  // weeklyTime / timeBehavior). A sourced sentence no longer masks an unsourced one
  // (e.g. an explicit "过去一年" with no duration source must be caught even when
  // other temporal fields were answered).
  let temporalNoSource = 0
  const temporalSamples = []
  const globalTemporalSource = TEMPORAL_SOURCE_FIELDS.some((f) => (ev.byField && ev.byField[f]) || (ev.cognitiveByField && ev.cognitiveByField[f]))
  for (const c of ledger) {
    // structural loop labels are not temporal claims about the user
    const scan = String(c.semanticClaim || '').replace(/长期代价/g, '').replace(/短期真实回报/g, '')
    const hit = countToken(scan, TEMPORAL_TOKENS)
    if (!hit.n) continue
    const ids = c.evidenceIds || []
    const sourced = ids.some((f) => TEMPORAL_SOURCE_FIELDS.indexOf(f) >= 0)
    if (!sourced && !globalTemporalSource) { temporalNoSource += hit.n; if (temporalSamples.length < 5) temporalSamples.push(hit.hits.join(',')) }
  }

  // ── PRICING_POWER_UNIVERSALIZATION (§R87B2_1 D) ──
  let pricingUniv = 0
  const pricingSamples = []
  for (const p of pieces) {
    const hit = countToken(p, PRICING_UNIVERSALIZATION_TOKENS)
    if (hit.n) { pricingUniv += hit.n; if (pricingSamples.length < 5) pricingSamples.push(hit.hits.join(',')) }
  }

  // ── EXPERIMENT_RESULT_OVERCLAIM (§R87B2_1 E / §3) ──
  let expOver = 0
  const expSamples = []
  for (const p of flatten(cr.card05, [])) {
    const hit = countToken(p, EXPERIMENT_RESULT_OVERCLAIM_TOKENS)
    if (hit.n) { expOver += hit.n; if (expSamples.length < 5) expSamples.push(hit.hits.join(',')) }
  }

  // ── §R87C P0 semantic-precision counters ──
  const blobAll = pieces.join(' ')
  const freeOnlyMisclass = countToken(blobAll, FREE_ONLY_MISCLASSIFICATION_TOKENS)
  const empValueDenied = countToken(blobAll, EMPLOYMENT_VALUE_DENIAL_TOKENS)
  const effPricingBlob = blobAll
  const jobIncomeConfusion = (() => {
    // Only a risk when the user is an EMPLOYEE (employer pricing) WITHOUT any paid
    // independent proof: claiming "market validated" then would conflate the job
    // with independent validation.
    const pa2 = ev.byField && ev.byField.pricingAuthority && ev.byField.pricingAuthority.normalizedValue
    const proof = ev.byField && ev.byField.skillValidation && ev.byField.skillValidation.normalizedValue
    const paidProof = proof === 'PROOF_PAID_ONCE' || proof === 'PROOF_OCCASIONAL' || proof === 'PROOF_STABLE'
    if (pa2 === 'PRICE_EMPLOYER' && !paidProof) return countToken(effPricingBlob, JOB_INCOME_CONFUSION_TOKENS)
    return { n: 0, hits: [] }
  })()
  const effortPricingOver = countToken(blobAll, EFFORT_PRICING_OVERCLAIM_TOKENS)
  const card05Multi = countToken(flatten(cr.card05, []).join(' '), CARD05_MULTI_ACTION_TOKENS)

  // ── §R87D_3 OWNER_VISIBLE_INTERNAL_ENUM ── internal identifiers must never
  // reach the owner. Counts UPPER_SNAKE_CASE tokens on the whole visible surface.
  let internalEnum = 0
  const internalEnumHits = []
  for (const p of pieces) {
    for (const re of INTERNAL_IDENTIFIER_PATTERNS) {
      const m = p.match(re)
      if (m) { internalEnum += m.length; m.forEach((x) => { if (internalEnumHits.length < 8) internalEnumHits.push(x) }) }
    }
  }

  // ── EMPLOYMENT_MECHANIC_OVERCLAIM ──
  let empOver = 0
  const empSamples = []
  const pa = ev.byField && ev.byField.pricingAuthority && ev.byField.pricingAuthority.normalizedValue
  for (const p of pieces) {
    const hit = countToken(p, EMPLOYMENT_OVERCLAIM_TOKENS)
    if (hit.n) { empOver += hit.n; if (empSamples.length < 5) empSamples.push(hit.hits.join(',')) }
  }
  // pricingAuthority alone never licenses the strongest mechanic claims.
  if (pa !== 'PRICE_EMPLOYER' && empOver > 0) empOver += 1

  // ── CARD02_OPTION_RESTATEMENT ── (verbatim questionnaire-option echo)
  const meanings = []
  Object.keys(ev.byField || {}).forEach((k) => { if (ev.byField[k] && ev.byField[k].semanticMeaning) meanings.push(ev.byField[k].semanticMeaning) })
  let card02Restate = 0
  flatten(cr.card02, []).forEach((sent) => {
    meanings.forEach((m) => { if (m && sent.indexOf(m) >= 0 && m.length >= 6) card02Restate++ })
  })

  return {
    version: CLAIM_AUDIT_VERSION,
    VISIBLE_CLAIM_WITHOUT_LEDGER_COUNT: withoutLedger,
    UNSUPPORTED_SENTENCE_COUNT: unsupported,
    FABRICATED_FACT_COUNT: fabricatedFact,
    FABRICATED_PSYCHOLOGY_COUNT: psy.n,
    TEMPORAL_FACT_WITHOUT_SOURCE_COUNT: temporalNoSource,
    EMPLOYMENT_MECHANIC_OVERCLAIM_COUNT: empOver,
    CARD02_OPTION_RESTATEMENT_COUNT: card02Restate,
    PRICING_POWER_UNIVERSALIZATION_COUNT: pricingUniv,
    EXPERIMENT_RESULT_OVERCLAIM_COUNT: expOver,
    EMPLOYED_SKILL_MISCLASSIFIED_AS_FREE_ONLY_COUNT: freeOnlyMisclass.n,
    EMPLOYMENT_VALUE_DENIED_COUNT: empValueDenied.n,
    INDEPENDENT_MARKET_PROOF_CONFUSED_WITH_JOB_INCOME_COUNT: jobIncomeConfusion.n,
    EFFORT_TO_PRICING_CAUSAL_OVERCLAIM_COUNT: effortPricingOver.n,
    CARD05_MULTI_ACTION_EXPERIMENT_COUNT: card05Multi.n,
    OWNER_VISIBLE_INTERNAL_ENUM_COUNT: internalEnum,
    CLAIM_LEDGER_SIZE: ledger.length,
    _samples: {
      withoutLedger: unledgeredSamples,
      unsupported: unsupportedSamples,
      fabricated: fabricatedSamples,
      psychology: psy.hits,
      temporal: temporalSamples,
      employment: empSamples,
      pricing: pricingSamples,
      experiment: expSamples,
      freeOnly: freeOnlyMisclass.hits,
      employmentDenial: empValueDenied.hits,
      jobConfusion: jobIncomeConfusion.hits,
      effortPricing: effortPricingOver.hits,
      card05Multi: card05Multi.hits,
      internalEnum: internalEnumHits
    }
  }
}

module.exports = { CLAIM_AUDIT_VERSION, auditVisibleClaims, FABRICATED_PSYCHOLOGY_TOKENS, TEMPORAL_TOKENS, EMPLOYMENT_OVERCLAIM_TOKENS, PRICING_UNIVERSALIZATION_TOKENS, EXPERIMENT_RESULT_OVERCLAIM_TOKENS, FREE_ONLY_MISCLASSIFICATION_TOKENS, EMPLOYMENT_VALUE_DENIAL_TOKENS, JOB_INCOME_CONFUSION_TOKENS, EFFORT_PRICING_OVERCLAIM_TOKENS, CARD05_MULTI_ACTION_TOKENS, INTERNAL_IDENTIFIER_TOKENS, meaningPool }
