/**
 * engine/worldModel/v2_1/followUpBankV21.js
 *
 * World Model v2.1 — Follow-up Discriminator Bank (Stage19A5B-1).
 *
 * SHADOW ONLY. Contract data + selector ONLY. This module owns the frozen
 * 5 follow-up discriminator questions, the 10 dedicated atomic follow-up
 * evidence items, the order-invariant pair → follow-up selector, and the
 * structural (followupId + optionId + pair) tuple validation.
 *
 * Authority: docs/adr/ADR-RC8.3-STAGE19-A5-UNCERTAINTY-PRIMARY-SELECTION-CONTRACT.md
 *   — A5.1 (§A5.1-4/§A5.1-6) + A5.1-R1 (§A5.1-R1-3/§A5.1-R1-4/§A5.1-R1-8).
 * Authority priority: A5/A5.1/A5.1-R1 > R3D > R3C > R3B > R3A > R3 > R2 > R1.
 *
 * A5B-1 delivers contract data + selector only. It MUST NOT resolve a primary
 * (A5B-2 owns A5A decision gating + winner resolution). This module exposes
 * helper APIs for A5B-2 but never selects a winner.
 *
 * FROZEN RULES:
 *   - Exactly 5 follow-up relevant construct pairs (order-invariant):
 *       DECISION↔FEEDBACK, PROBABILITY↔RISK, RISK↔TIME,
 *       IDENTITY↔OPPORTUNITY, TIME↔SYSTEMS.
 *     Structural-only pairs NEVER trigger follow-up (not represented here):
 *       DECISION↔PROBABILITY, FEEDBACK↔SYSTEMS, LEVERAGE↔TIME, LEVERAGE↔OPPORTUNITY.
 *   - Exactly 5 discriminator questions (1 per pair) + 10 options (2 per question).
 *   - Exactly 10 dedicated atomic follow-up evidence items (1 per option).
 *   - All 10 evidence items are direction D (positive discriminators). No H, no N.
 *   - NOT_A_DOES_NOT_IMPLY_B = YES: no complement inference. Every option is a
 *     positive D discriminator of exactly one construct; absence of A never means B.
 *   - Dedicated namespace: 'DEDICATED_V2_1_FOLLOWUP_EVIDENCE'. Follow-up evidenceId
 *     never collides with base evidenceCatalogV21 IDs.
 *   - Follow-up evidence MUST NOT enter normalizeEvidenceV21 / extractSignalsV21 /
 *     buildDimensionsV21 / buildBlindSpotCandidatesV21 / decidePrimaryV21
 *     provenance eligibility. It is a discriminator between already-eligible
 *     candidates, never a sufficiency inflator.
 *
 * No numeric score, no candidate ranking, no state→number, no separation
 * threshold, no ID_OFFSET, no ontology priority, no D−H arithmetic, no
 * pseudo-probability.
 *
 * @version world_model_v2_1
 */

const FOLLOWUP_NAMESPACE_V21 = 'DEDICATED_V2_1_FOLLOWUP_EVIDENCE'

// Frozen positive-discrimination semantics: absence of A never means B.
// All 10 options are positive D discriminators of exactly one construct.
const NOT_A_DOES_NOT_IMPLY_B = true

// ── Frozen follow-up questions (verbatim A5.1 / A5.1-R1 wording) ───────────
// constructA / constructB encode the ADR's first/second construct for
// bidirectional discrimination accounting (NOT alphabetical order).
const FOLLOWUP_QUESTIONS_V21 = [
  {
    followupId: 'FU_DEC_FB',
    constructA: 'DECISION',
    constructB: 'FEEDBACK',
    prompt: '回看你最近想做但一直没推进的一件事，更接近哪种情况？',
    options: [
      { optionId: 'A', text: '还没开始，因为总觉得没想清楚、没把握', evidenceId: 'FU_DEC_FB_CERTAINTY_GATE' },
      { optionId: 'B', text: '开始了，但做一段就放下，没再复盘调整', evidenceId: 'FU_DEC_FB_NO_REVIEW' },
    ],
  },
  {
    followupId: 'FU_PROB_RISK',
    constructA: 'PROBABILITY',
    constructB: 'RISK',
    prompt: '同样一个不确定机会，你更纠结的是『有多大概率成』还是『最坏会怎样』？',
    options: [
      { optionId: 'A', text: '有多大概率成', evidenceId: 'FU_PROB_RISK_PROB_FOCUS' },
      { optionId: 'B', text: '最坏会怎样', evidenceId: 'FU_PROB_RISK_RISK_FOCUS' },
    ],
  },
  {
    followupId: 'FU_RISK_TIME',
    constructA: 'RISK',
    constructB: 'TIME',
    prompt: '一个长期方向，短期可能亏。你更可能？',
    options: [
      { optionId: 'A', text: '怕短期亏，先观望再说', evidenceId: 'FU_RISK_TIME_LOSS_AVOID' },
      { optionId: 'B', text: '会开始，但短期没效果就容易换', evidenceId: 'FU_RISK_TIME_IMPATIENT' },
    ],
  },
  {
    followupId: 'FU_ID_OPP',
    constructA: 'IDENTITY',
    constructB: 'OPPORTUNITY',
    prompt: '有个跨领域机会，你是『没遇到过』还是『遇到了但觉得不是我能做的』？',
    options: [
      { optionId: 'A', text: '没遇到过', evidenceId: 'FU_ID_OPP_NO_ENCOUNTER' },
      { optionId: 'B', text: '遇到了但觉得不是我能做的', evidenceId: 'FU_ID_OPP_NOT_ME' },
    ],
  },
  {
    followupId: 'FU_TIME_SYS',
    constructA: 'TIME',
    constructB: 'SYSTEMS',
    prompt: '你反复做的事没起色，你更可能？',
    options: [
      { optionId: 'A', text: '换个方向试试', evidenceId: 'FU_TIME_SYS_SWITCH' },
      { optionId: 'B', text: '觉得主要是执行的人的问题', evidenceId: 'FU_TIME_SYS_PERSON' },
    ],
  },
]

// ── Frozen dedicated atomic follow-up evidence (1 per option, 10 total) ────
const FOLLOWUP_EVIDENCE_V21 = [
  {
    evidenceId: 'FU_DEC_FB_CERTAINTY_GATE',
    sourceFollowupId: 'FU_DEC_FB',
    optionId: 'A',
    construct: 'DECISION',
    direction: 'D',
    distortionType: 'certainty-gate',
    semanticProposition: '决策受确定性门槛阻碍，迟迟未启动',
  },
  {
    evidenceId: 'FU_DEC_FB_NO_REVIEW',
    sourceFollowupId: 'FU_DEC_FB',
    optionId: 'B',
    construct: 'FEEDBACK',
    direction: 'D',
    distortionType: 'feedback-inert',
    semanticProposition: '行动后不回顾不调整（无复盘闭环）',
  },
  {
    evidenceId: 'FU_PROB_RISK_PROB_FOCUS',
    sourceFollowupId: 'FU_PROB_RISK',
    optionId: 'A',
    construct: 'PROBABILITY',
    direction: 'D',
    distortionType: null,
    semanticProposition: '纠结于概率大小（概率维度主导）',
  },
  {
    evidenceId: 'FU_PROB_RISK_RISK_FOCUS',
    sourceFollowupId: 'FU_PROB_RISK',
    optionId: 'B',
    construct: 'RISK',
    direction: 'D',
    distortionType: 'loss-aversion',
    semanticProposition: '纠结于最坏情况（下行维度主导）',
  },
  {
    evidenceId: 'FU_RISK_TIME_LOSS_AVOID',
    sourceFollowupId: 'FU_RISK_TIME',
    optionId: 'A',
    construct: 'RISK',
    direction: 'D',
    distortionType: 'loss-aversion',
    semanticProposition: '怕短期亏损而回避（下行回避）',
  },
  {
    evidenceId: 'FU_RISK_TIME_IMPATIENT',
    sourceFollowupId: 'FU_RISK_TIME',
    optionId: 'B',
    construct: 'TIME',
    direction: 'D',
    distortionType: 'direction-unstable',
    semanticProposition: '短期无果即换方向（没耐心）',
  },
  {
    evidenceId: 'FU_ID_OPP_NO_ENCOUNTER',
    sourceFollowupId: 'FU_ID_OPP',
    optionId: 'A',
    construct: 'OPPORTUNITY',
    direction: 'D',
    distortionType: 'narrow-exposure',
    semanticProposition: '从未遇到跨领域机会（接触面窄）',
  },
  {
    evidenceId: 'FU_ID_OPP_NOT_ME',
    sourceFollowupId: 'FU_ID_OPP',
    optionId: 'B',
    construct: 'IDENTITY',
    direction: 'D',
    distortionType: 'boundary-fixed',
    semanticProposition: '遇到但觉得不像自己能做（边界固定）',
  },
  {
    evidenceId: 'FU_TIME_SYS_SWITCH',
    sourceFollowupId: 'FU_TIME_SYS',
    optionId: 'A',
    construct: 'TIME',
    direction: 'D',
    distortionType: 'direction-unstable',
    semanticProposition: '无果即换方向（方向不稳定）',
  },
  {
    evidenceId: 'FU_TIME_SYS_PERSON',
    sourceFollowupId: 'FU_TIME_SYS',
    optionId: 'B',
    construct: 'SYSTEMS',
    direction: 'D',
    distortionType: 'person-attribution',
    semanticProposition: '归因于执行的人（人事归因）',
  },
]

// ── Derived frozen counts ─────────────────────────────────────────────────
const FOLLOWUP_PAIR_COUNT = FOLLOWUP_QUESTIONS_V21.length // 5
const FOLLOWUP_QUESTION_COUNT = FOLLOWUP_QUESTIONS_V21.length // 5
const FOLLOWUP_OPTION_COUNT = FOLLOWUP_QUESTIONS_V21.reduce((n, q) => n + q.options.length, 0) // 10
const FOLLOWUP_ATOMIC_EVIDENCE_COUNT = FOLLOWUP_EVIDENCE_V21.length // 10

// Pair definitions (followupId + ADR first/second construct).
const FOLLOWUP_PAIRS_V21 = FOLLOWUP_QUESTIONS_V21.map((q) => ({
  followupId: q.followupId,
  constructA: q.constructA,
  constructB: q.constructB,
}))

// ── Lookup tables ──────────────────────────────────────────────────────────
const FOLLOWUP_QUESTION_BY_ID = new Map(FOLLOWUP_QUESTIONS_V21.map((q) => [q.followupId, q]))
const FOLLOWUP_EVIDENCE_BY_ID = new Map(FOLLOWUP_EVIDENCE_V21.map((e) => [e.evidenceId, e]))

// Order-invariant pair key: sorted (constructA, constructB).
const FOLLOWUP_PAIR_BY_KEY = new Map(
  FOLLOWUP_PAIRS_V21.map((p) => {
    const [a, b] = canonicalizePair(p.constructA, p.constructB)
    return [`${a}\u0000${b}`, p]
  })
)

// (followupId, optionId) → evidence item. Tuple coherence: an optionId is only
// meaningful within its followupId; no cross-pair acceptance is possible.
const FOLLOWUP_TUPLE_BY_KEY = new Map(
  FOLLOWUP_EVIDENCE_V21.map((e) => [`${e.sourceFollowupId}\u0000${e.optionId}`, e])
)

// ── Pair canonicalization (order invariant: A+B == B+A) ────────────────────
function canonicalizePair(constructA, constructB) {
  return constructA < constructB ? [constructA, constructB] : [constructB, constructA]
}

function canonicalizeFollowUpPairV21(constructA, constructB) {
  return canonicalizePair(constructA, constructB)
}

// Extract a construct pair from flexible input; returns sorted [a,b] or null.
function extractPair(pair) {
  if (Array.isArray(pair)) {
    if (pair.length !== 2) return null
    const [a, b] = pair
    if (typeof a !== 'string' || typeof b !== 'string') return null
    return canonicalizePair(a, b)
  }
  if (pair && typeof pair === 'object') {
    const a = pair.constructA !== undefined ? pair.constructA : pair.a
    const b = pair.constructB !== undefined ? pair.constructB : pair.b
    if (typeof a !== 'string' || typeof b !== 'string') return null
    return canonicalizePair(a, b)
  }
  return null
}

/**
 * Is this construct pair a frozen follow-up relevant pair? (order invariant)
 * @returns {boolean}
 */
function isFollowUpPairV21(pair) {
  const canon = extractPair(pair)
  if (!canon) return false
  return FOLLOWUP_PAIR_BY_KEY.has(`${canon[0]}\u0000${canon[1]}`)
}

/**
 * Select the exact frozen follow-up definition for a relevant construct pair.
 *
 * @param {Array<string>|{constructA:string, constructB:string}} pair
 * @returns {object|null} the frozen question object, or null on rejection
 *   (structural-only pair, unknown pair, malformed/missing pair).
 *
 * Selector is order invariant, returns exactly one question for a valid
 * relevant pair, and does NOT inspect candidates or A5A eligibility.
 */
function selectFollowUpV21(pair) {
  const canon = extractPair(pair)
  if (!canon) return null
  const def = FOLLOWUP_PAIR_BY_KEY.get(`${canon[0]}\u0000${canon[1]}`)
  if (!def) return null
  return FOLLOWUP_QUESTION_BY_ID.get(def.followupId) || null
}

/**
 * Resolve the dedicated atomic evidence item for a (followupId, optionId)
 * tuple. Returns null for unknown followupId / unknown option / wrong option.
 * An option from another pair cannot resolve to this pair's evidence.
 *
 * @returns {object|null}
 */
function resolveFollowUpEvidenceV21(followupId, optionId) {
  if (typeof followupId !== 'string' || typeof optionId !== 'string') return null
  return FOLLOWUP_TUPLE_BY_KEY.get(`${followupId}\u0000${optionId}`) || null
}

/**
 * Structural tuple validation: (followupId, optionId) forms one coherent tuple.
 * @returns {boolean}
 */
function isValidFollowUpTupleV21(followupId, optionId) {
  return resolveFollowUpEvidenceV21(followupId, optionId) !== null
}

module.exports = {
  FOLLOWUP_NAMESPACE_V21,
  NOT_A_DOES_NOT_IMPLY_B,
  FOLLOWUP_PAIR_COUNT,
  FOLLOWUP_QUESTION_COUNT,
  FOLLOWUP_OPTION_COUNT,
  FOLLOWUP_ATOMIC_EVIDENCE_COUNT,
  FOLLOWUP_PAIRS_V21,
  FOLLOWUP_QUESTIONS_V21,
  FOLLOWUP_EVIDENCE_V21,
  FOLLOWUP_QUESTION_BY_ID,
  FOLLOWUP_EVIDENCE_BY_ID,
  canonicalizeFollowUpPairV21,
  isFollowUpPairV21,
  selectFollowUpV21,
  resolveFollowUpEvidenceV21,
  isValidFollowUpTupleV21,
}
