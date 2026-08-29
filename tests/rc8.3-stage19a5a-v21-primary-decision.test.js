/**
 * RC8.3 Stage19A5A — V2.1 Primary Decision Engine Acceptance Tests
 *
 * Validates the PRE-FOLLOW-UP terminal decision under the frozen uncertainty
 * contract (docs/adr/ADR-RC8.3-STAGE19-A5-UNCERTAINTY-PRIMARY-SELECTION-CONTRACT.md
 * + A5.1 / A5.1-R1 normative addenda).
 *
 * Covers (semantic fixtures → deterministic terminal state):
 *   1.  one SUPPORTED+STRONG                → PRIMARY_ALLOWED
 *   2.  SUPPORTED+WEAK only                 → INSUFFICIENT_EVIDENCE
 *   3.  SUPPORTED+MODERATE only             → INSUFFICIENT_EVIDENCE
 *   4.  MIXED                               → INSUFFICIENT_EVIDENCE
 *   5.  all COUNTERSUPPORTED                → NO_PRIMARY_DEFICIT
 *   6.  all INSUFFICIENT                    → INSUFFICIENT_EVIDENCE
 *   7.  COUNTERSUPPORTED + INSUFFICIENT     → NO_PRIMARY_DEFICIT (ADR §12)
 *   8–12. two eligible + relevant pair      → FOLLOW_UP_REQUIRED (5 edges)
 *   13–16. two eligible + structural pair   → INSUFFICIENT_EVIDENCE (4 edges)
 *   17. three eligible                      → INSUFFICIENT_EVIDENCE
 *   18. candidate order reversed            → same result
 *   19. fake STRONG (1 supporting Q)        → CONTRACT_PROVENANCE_ERROR
 *   20. D+D same evidenceId, 2 questions    → eligible
 *   21. 2 evidenceIds, 1 question           → NOT eligible
 *   22. counterevidence + SUPPORTED label   → contract error / not eligible
 *   23–25. no numeric-score / ID_OFFSET / ontology-priority paths (source)
 *   Full-chain traceability (answers → evidence → signals → dims → candidates
 *   → primary decision) with real V2.1 semantic answers.
 *
 * Uses `node --test`.
 *
 * @version world_model_v2_1
 */

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const {
  normalizeEvidenceV21,
  extractSignalsV21,
  computeDimensionsV21,
  buildBlindSpotCandidatesV21,
  decidePrimaryV21,
  PRIMARY_STATUS_SET_V21,
  CONSTRUCTS_V21,
  QUESTIONS_V21,
} = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/index.js')

const engine = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/primaryDecisionEngineV21.js')

const V21_DIR = path.join(__dirname, '../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1')

// ── helpers ────────────────────────────────────────────────────────────────
function decideOf(answers) {
  const norm = normalizeEvidenceV21(answers)
  const dims = computeDimensionsV21(norm)
  const { candidates, contractViolations } = buildBlindSpotCandidatesV21(dims)
  const decision = decidePrimaryV21({ candidates, contractViolations })
  return decision
}

function fullChain(answers) {
  const norm = normalizeEvidenceV21(answers)
  const signals = extractSignalsV21(norm)
  const dims = computeDimensionsV21(norm)
  const cands = buildBlindSpotCandidatesV21(dims)
  const decision = decidePrimaryV21(cands)
  return { norm, signals, dims, cands, decision }
}

// Frozen D+D answer pairs per construct (two independent supporting base Qs).
const DD = {
  DECISION: [{ questionId: 'SC_DEC_01', optionId: 'B' }, { questionId: 'SC_DEC_02', optionId: 'C' }],
  FEEDBACK: [{ questionId: 'SC_FB_01', optionId: 'B' }, { questionId: 'SC_FB_02', optionId: 'B' }],
  PROBABILITY: [{ questionId: 'SC_PROB_01', optionId: 'B' }, { questionId: 'SC_PROB_02', optionId: 'B' }],
  RISK: [{ questionId: 'SC_RISK_01', optionId: 'B' }, { questionId: 'SC_RISK_02', optionId: 'B' }],
  LEVERAGE: [{ questionId: 'SC_LEV_01', optionId: 'A' }, { questionId: 'SC_LEV_02', optionId: 'A' }],
  TIME: [{ questionId: 'SC_TIME_01', optionId: 'A' }, { questionId: 'SC_TIME_02', optionId: 'B' }],
  IDENTITY: [{ questionId: 'SC_ID_01', optionId: 'B' }, { questionId: 'SC_ID_02', optionId: 'A' }],
  OPPORTUNITY: [{ questionId: 'SC_OPP_01', optionId: 'B' }, { questionId: 'SC_OPP_02', optionId: 'C' }],
  SYSTEMS: [{ questionId: 'SC_SYS_01', optionId: 'B' }, { questionId: 'SC_SYS_02', optionId: 'B' }],
}

// Frozen all-healthy answer set (H+H per construct → COUNTERSUPPORTED × 9).
const ALL_HEALTHY = [
  { questionId: 'SC_DEC_01', optionId: 'A' }, { questionId: 'SC_DEC_02', optionId: 'A' },
  { questionId: 'SC_FB_01', optionId: 'A' }, { questionId: 'SC_FB_02', optionId: 'A' },
  { questionId: 'SC_PROB_01', optionId: 'A' }, { questionId: 'SC_PROB_02', optionId: 'A' },
  { questionId: 'SC_RISK_01', optionId: 'A' }, { questionId: 'SC_RISK_02', optionId: 'A' },
  { questionId: 'SC_LEV_01', optionId: 'B' }, { questionId: 'SC_LEV_02', optionId: 'B' },
  { questionId: 'SC_TIME_01', optionId: 'B' }, { questionId: 'SC_TIME_02', optionId: 'A' },
  { questionId: 'SC_ID_01', optionId: 'A' }, { questionId: 'SC_ID_02', optionId: 'B' },
  { questionId: 'SC_OPP_01', optionId: 'A' }, { questionId: 'SC_OPP_02', optionId: 'A' },
  { questionId: 'SC_SYS_01', optionId: 'A' }, { questionId: 'SC_SYS_02', optionId: 'A' },
]

// ── 0. FROZEN CONTRACT CONSTANTS ──────────────────────────────────────────
test('0. frozen edge counts + closed status set', () => {
  assert.strictEqual(engine.FOLLOWUP_RELEVANT_EDGE_COUNT, 5)
  assert.strictEqual(engine.FOLLOWUP_RELEVANT_EDGE_SET.length, 5)
  assert.strictEqual(engine.STRUCTURAL_NEIGHBOR_EDGE_COUNT, 4)
  assert.deepStrictEqual(PRIMARY_STATUS_SET_V21, [
    'PRIMARY_ALLOWED',
    'FOLLOW_UP_REQUIRED',
    'NO_PRIMARY_DEFICIT',
    'INSUFFICIENT_EVIDENCE',
  ])
})

test('0b. follow-up relevant edges are order invariant (A+B == B+A)', () => {
  for (const [a, b] of engine.FOLLOWUP_RELEVANT_EDGE_SET) {
    assert.strictEqual(engine.isFollowupRelevantPairV21(a, b), true)
    assert.strictEqual(engine.isFollowupRelevantPairV21(b, a), true, `${b}+${a} must equal ${a}+${b}`)
  }
  // structural neighbors NEVER follow-up relevant
  for (const [a, b] of engine.STRUCTURAL_NEIGHBOR_EDGE_SET) {
    assert.strictEqual(engine.isFollowupRelevantPairV21(a, b), false)
    assert.strictEqual(engine.isFollowupRelevantPairV21(b, a), false)
  }
})

// ── 1. ONE ELIGIBLE → PRIMARY_ALLOWED ─────────────────────────────────────
test('1. one SUPPORTED+STRONG → PRIMARY_ALLOWED', () => {
  const d = decideOf(DD.FEEDBACK)
  assert.strictEqual(d.status, 'PRIMARY_ALLOWED')
  assert.strictEqual(d.reasonCode, 'UNIQUE_ELIGIBLE_CANDIDATE')
  assert.strictEqual(d.primaryBlindSpotId, 'FEEDBACK_LOOP_GAP')
  assert.strictEqual(d.primaryConstruct, 'FEEDBACK')
  assert.deepStrictEqual(d.eligibleCandidateIds, ['FEEDBACK_LOOP_GAP'])
  assert.deepStrictEqual(d.eligibleConstructs, ['FEEDBACK'])
  assert.strictEqual(d.followupPair, null)
  assert.deepStrictEqual(d.contractViolations, [])
})

// ── 2/3. SUPPORTED but WEAK / MODERATE → INSUFFICIENT_EVIDENCE ────────────
test('2. SUPPORTED+WEAK only (D+missing) → INSUFFICIENT_EVIDENCE', () => {
  const d = decideOf([{ questionId: 'SC_DEC_01', optionId: 'B' }]) // DEC_CERTAINTY_GATE D, 1 observation
  assert.strictEqual(d.status, 'INSUFFICIENT_EVIDENCE')
  assert.strictEqual(d.primaryBlindSpotId, null)
  assert.strictEqual(d.primaryConstruct, null)
  assert.deepStrictEqual(d.eligibleCandidateIds, [])
})

test('3. SUPPORTED+MODERATE only (D+N) → INSUFFICIENT_EVIDENCE', () => {
  // OPPORTUNITY: SC_OPP_01:B (OPP_NARROW D) + SC_OPP_02:B (OPP_SOME N)
  const d = decideOf([{ questionId: 'SC_OPP_01', optionId: 'B' }, { questionId: 'SC_OPP_02', optionId: 'B' }])
  assert.strictEqual(d.status, 'INSUFFICIENT_EVIDENCE')
  assert.deepStrictEqual(d.eligibleCandidateIds, [])
  assert.strictEqual(d.primaryBlindSpotId, null)
})

// ── 4. MIXED → INSUFFICIENT_EVIDENCE ─────────────────────────────────────
test('4. MIXED (H+D contradiction) → INSUFFICIENT_EVIDENCE', () => {
  // DECISION: SC_DEC_01:A (H) + SC_DEC_02:C (D) → MIXED
  const d = decideOf([{ questionId: 'SC_DEC_01', optionId: 'A' }, { questionId: 'SC_DEC_02', optionId: 'C' }])
  assert.strictEqual(d.status, 'INSUFFICIENT_EVIDENCE')
  assert.deepStrictEqual(d.eligibleCandidateIds, [])
})

// ── 5. ALL COUNTERSUPPORTED → NO_PRIMARY_DEFICIT ─────────────────────────
test('5. all COUNTERSUPPORTED → NO_PRIMARY_DEFICIT', () => {
  const d = decideOf(ALL_HEALTHY)
  assert.strictEqual(d.status, 'NO_PRIMARY_DEFICIT')
  assert.strictEqual(d.reasonCode, 'NO_SUPPORTED_DEFICIT')
  assert.strictEqual(d.primaryBlindSpotId, null)
  assert.strictEqual(d.primaryConstruct, null)
  assert.deepStrictEqual(d.eligibleCandidateIds, [])
  assert.strictEqual(d.followupPair, null)
})

// ── 6. ALL INSUFFICIENT → INSUFFICIENT_EVIDENCE ──────────────────────────
test('6. all INSUFFICIENT → INSUFFICIENT_EVIDENCE', () => {
  const d = decideOf([])
  assert.strictEqual(d.status, 'INSUFFICIENT_EVIDENCE')
  assert.strictEqual(d.primaryBlindSpotId, null)
  assert.deepStrictEqual(d.eligibleCandidateIds, [])
})

// ── 7. COUNTERSUPPORTED + INSUFFICIENT, no SUPPORTED/MIXED → NO_PRIMARY_DEFICIT ──
test('7. COUNTERSUPPORTED + INSUFFICIENT → NO_PRIMARY_DEFICIT (ADR §12)', () => {
  // DECISION healthy only; everything else missing.
  const d = decideOf([{ questionId: 'SC_DEC_01', optionId: 'A' }, { questionId: 'SC_DEC_02', optionId: 'A' }])
  assert.strictEqual(d.status, 'NO_PRIMARY_DEFICIT')
  assert.strictEqual(d.primaryBlindSpotId, null)
})

// ── 8–12. TWO ELIGIBLE + RELEVANT PAIR → FOLLOW_UP_REQUIRED ───────────────
test('8. DECISION+FEEDBACK → FOLLOW_UP_REQUIRED', () => {
  const d = decideOf([...DD.DECISION, ...DD.FEEDBACK])
  assert.strictEqual(d.status, 'FOLLOW_UP_REQUIRED')
  assert.strictEqual(d.reasonCode, 'FOLLOWUP_RELEVANT_PAIR')
  assert.deepStrictEqual(d.followupPair, ['DECISION', 'FEEDBACK'])
  assert.deepStrictEqual(d.eligibleConstructs, ['DECISION', 'FEEDBACK'])
  assert.strictEqual(d.primaryBlindSpotId, null)
})

test('9. PROBABILITY+RISK → FOLLOW_UP_REQUIRED', () => {
  const d = decideOf([...DD.PROBABILITY, ...DD.RISK])
  assert.strictEqual(d.status, 'FOLLOW_UP_REQUIRED')
  assert.deepStrictEqual(d.followupPair, ['PROBABILITY', 'RISK'])
})

test('10. RISK+TIME → FOLLOW_UP_REQUIRED', () => {
  const d = decideOf([...DD.RISK, ...DD.TIME])
  assert.strictEqual(d.status, 'FOLLOW_UP_REQUIRED')
  assert.deepStrictEqual(d.followupPair, ['RISK', 'TIME'])
})

test('11. IDENTITY+OPPORTUNITY → FOLLOW_UP_REQUIRED', () => {
  const d = decideOf([...DD.IDENTITY, ...DD.OPPORTUNITY])
  assert.strictEqual(d.status, 'FOLLOW_UP_REQUIRED')
  assert.deepStrictEqual(d.followupPair, ['IDENTITY', 'OPPORTUNITY'])
})

test('12. TIME+SYSTEMS → FOLLOW_UP_REQUIRED', () => {
  const d = decideOf([...DD.TIME, ...DD.SYSTEMS])
  assert.strictEqual(d.status, 'FOLLOW_UP_REQUIRED')
  assert.deepStrictEqual(d.followupPair, ['SYSTEMS', 'TIME'])
})

// ── 13–16. TWO ELIGIBLE + STRUCTURAL PAIR → INSUFFICIENT_EVIDENCE ────────
test('13. DECISION+PROBABILITY (structural) → INSUFFICIENT_EVIDENCE', () => {
  const d = decideOf([...DD.DECISION, ...DD.PROBABILITY])
  assert.strictEqual(d.status, 'INSUFFICIENT_EVIDENCE')
  assert.strictEqual(d.reasonCode, 'MULTIPLE_SUPPORTED_MODELS')
  assert.strictEqual(d.followupPair, null)
})

test('14. FEEDBACK+SYSTEMS (structural) → INSUFFICIENT_EVIDENCE', () => {
  const d = decideOf([...DD.FEEDBACK, ...DD.SYSTEMS])
  assert.strictEqual(d.status, 'INSUFFICIENT_EVIDENCE')
  assert.strictEqual(d.followupPair, null)
})

test('15. LEVERAGE+TIME (structural) → INSUFFICIENT_EVIDENCE', () => {
  const d = decideOf([...DD.LEVERAGE, ...DD.TIME])
  assert.strictEqual(d.status, 'INSUFFICIENT_EVIDENCE')
  assert.strictEqual(d.followupPair, null)
})

test('16. LEVERAGE+OPPORTUNITY (structural) → INSUFFICIENT_EVIDENCE', () => {
  const d = decideOf([...DD.LEVERAGE, ...DD.OPPORTUNITY])
  assert.strictEqual(d.status, 'INSUFFICIENT_EVIDENCE')
  assert.strictEqual(d.followupPair, null)
})

// ── 17. THREE ELIGIBLE → INSUFFICIENT_EVIDENCE ───────────────────────────
test('17. three eligible → INSUFFICIENT_EVIDENCE (no tournament)', () => {
  const d = decideOf([...DD.DECISION, ...DD.FEEDBACK, ...DD.PROBABILITY])
  assert.strictEqual(d.status, 'INSUFFICIENT_EVIDENCE')
  assert.strictEqual(d.reasonCode, 'MULTIPLE_SUPPORTED_MODELS')
  assert.strictEqual(d.primaryBlindSpotId, null)
  assert.deepStrictEqual(d.eligibleCandidateIds, ['DECISION_INERTIA', 'FEEDBACK_LOOP_GAP', 'PROBABILITY_MISJUDGMENT'])
})

// ── 18. ORDER INVARIANCE ─────────────────────────────────────────────────
test('18. candidate order reversed → same decision', () => {
  const answers = [...DD.RISK, ...DD.TIME]
  const norm = normalizeEvidenceV21(answers)
  const dims = computeDimensionsV21(norm)
  const { candidates } = buildBlindSpotCandidatesV21(dims)
  const fwd = decidePrimaryV21({ candidates })
  const rev = decidePrimaryV21({ candidates: [...candidates].reverse() })

  assert.strictEqual(fwd.status, rev.status)
  assert.strictEqual(fwd.primaryBlindSpotId, rev.primaryBlindSpotId)
  assert.deepStrictEqual(fwd.followupPair, rev.followupPair)
  assert.deepStrictEqual(fwd.eligibleCandidateIds, rev.eligibleCandidateIds)
  assert.deepStrictEqual(fwd.eligibleConstructs, rev.eligibleConstructs)
  assert.strictEqual(fwd.reasonCode, rev.reasonCode)
  assert.deepStrictEqual(fwd.trace, rev.trace)
})

// ── 19. FAKE STRONG (1 supporting Q) → CONTRACT_PROVENANCE_ERROR ─────────
test('19. fake STRONG with one supportingQuestionId → deterministic rejection', () => {
  const fake = {
    blindSpotId: 'DECISION_INERTIA',
    construct: 'DECISION',
    status: 'SUPPORTED',
    dimensionState: 'STRONG',
    supportingQuestionIds: ['SC_DEC_01'],
    counterQuestionIds: [],
    neutralQuestionIds: [],
    supportingEvidenceIds: ['DEC_CERTAINTY_GATE'],
    counterEvidenceIds: [],
    neutralEvidenceIds: [],
    hasContradiction: false,
  }
  const d = decidePrimaryV21({ candidates: [fake] })
  assert.deepStrictEqual(d.eligibleCandidateIds, [])
  assert.strictEqual(d.primaryBlindSpotId, null)
  assert.ok(d.contractViolations.some((v) => v.type === 'CONTRACT_PROVENANCE_ERROR'), 'must flag provenance error')
})

// ── 20. D+D SAME EVIDENCEID, 2 QUESTIONS → ELIGIBLE ──────────────────────
test('20. D+D same evidenceId from two independent questions → eligible', () => {
  // FEEDBACK: SC_FB_01:B + SC_FB_02:C both → FB_AS_NOISE (D), 2 distinct questions.
  const { cands, decision } = fullChain([
    { questionId: 'SC_FB_01', optionId: 'B' },
    { questionId: 'SC_FB_02', optionId: 'C' },
  ])
  const fb = cands.candidates.find((c) => c.construct === 'FEEDBACK')
  assert.strictEqual(fb.status, 'SUPPORTED')
  assert.strictEqual(fb.dimensionState, 'STRONG')
  assert.deepStrictEqual(fb.supportingQuestionIds, ['SC_FB_01', 'SC_FB_02'])
  assert.deepStrictEqual(fb.supportingEvidenceIds, ['FB_AS_NOISE']) // 1 evidenceId, 2 observations
  assert.strictEqual(decision.status, 'PRIMARY_ALLOWED')
  assert.strictEqual(decision.primaryBlindSpotId, 'FEEDBACK_LOOP_GAP')
})

// ── 21. 2 EVIDENCEIDS, 1 QUESTION → NOT 2 OBSERVATIONS ───────────────────
test('21. two evidenceIds from same question → NOT eligible (support unit = question)', () => {
  const fake = {
    blindSpotId: 'FEEDBACK_LOOP_GAP',
    construct: 'FEEDBACK',
    status: 'SUPPORTED',
    dimensionState: 'STRONG',
    supportingQuestionIds: ['SC_FB_01'], // only ONE distinct question
    counterQuestionIds: [],
    neutralQuestionIds: [],
    supportingEvidenceIds: ['FB_AS_NOISE', 'FB_AS_THREAT'], // two evidenceIds ≠ two observations
    counterEvidenceIds: [],
    neutralEvidenceIds: [],
    hasContradiction: false,
  }
  const d = decidePrimaryV21({ candidates: [fake] })
  assert.deepStrictEqual(d.eligibleCandidateIds, [])
  assert.ok(d.contractViolations.some((v) => v.type === 'CONTRACT_PROVENANCE_ERROR'))
})

// ── 22. COUNTEREVIDENCE PRESENT DESPITE SUPPORTED LABEL ──────────────────
test('22. counterevidence present despite SUPPORTED label → contract error / not eligible', () => {
  const fake = {
    blindSpotId: 'RISK_MODEL_DISTORTION',
    construct: 'RISK',
    status: 'SUPPORTED',
    dimensionState: 'STRONG',
    supportingQuestionIds: ['SC_RISK_01', 'SC_RISK_02'],
    counterQuestionIds: ['SC_RISK_01'], // contradictory: H evidence present
    neutralQuestionIds: [],
    supportingEvidenceIds: ['RISK_LOSS_AVERSION'],
    counterEvidenceIds: ['RISK_ASYMMETRY_AWARE'],
    neutralEvidenceIds: [],
    hasContradiction: true,
  }
  const d = decidePrimaryV21({ candidates: [fake] })
  assert.deepStrictEqual(d.eligibleCandidateIds, [])
  assert.strictEqual(d.primaryBlindSpotId, null)
  assert.ok(d.contractViolations.some((v) => v.type === 'CONTRACT_PROVENANCE_ERROR'))
})

// ── 23–25. NUMERIC / ID_OFFSET / ONTOLOGY PRIORITY PROHIBITION (source) ──
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

test('23. no numeric score path in primaryDecisionEngineV21.js', () => {
  const code = stripComments(fs.readFileSync(path.join(V21_DIR, 'primaryDecisionEngineV21.js'), 'utf8'))
  for (const tok of ['score', 'confidence', 'probability', 'severity', 'separation', 'margin', 'gap', 'weighted', 'weight', 'Math.random']) {
    assert.strictEqual(code.includes(tok), false, `must not reference "${tok}"`)
  }
  // no state→number mapping (STRONG=3 / MODERATE=2 / WEAK=1)
  assert.strictEqual(code.includes('STATE_TO_NUMBER'), false)
})

test('24. no ID_OFFSET path in primaryDecisionEngineV21.js', () => {
  const code = stripComments(fs.readFileSync(path.join(V21_DIR, 'primaryDecisionEngineV21.js'), 'utf8'))
  assert.strictEqual(code.includes('ID_OFFSET'), false)
  assert.strictEqual(code.includes('idOffset'), false)
  assert.strictEqual(code.includes('argmax'), false)
  assert.strictEqual(code.includes('topK'), false)
})

test('25. no ontology-priority / ranking path in primaryDecisionEngineV21.js', () => {
  const code = stripComments(fs.readFileSync(path.join(V21_DIR, 'primaryDecisionEngineV21.js'), 'utf8'))
  assert.strictEqual(code.includes('ontology priority'), false)
  assert.strictEqual(code.includes('ontologyPriority'), false)
  assert.strictEqual(code.includes('rank'), false)
  assert.strictEqual(code.includes('tournament'), false)
  assert.strictEqual(code.includes('tieBreak'), false)
  assert.strictEqual(code.includes('tiebreak'), false)
})

// ── FULL CHAIN TRACEABILITY ──────────────────────────────────────────────
test('full chain: answers → evidence → signals → dims → candidates → decision', () => {
  const answers = [
    { questionId: 'SC_DEC_01', optionId: 'B' }, // DEC_CERTAINTY_GATE (D)
    { questionId: 'SC_DEC_02', optionId: 'C' }, // DEC_INFO_BLIND (D)
  ]
  const { norm, signals, dims, cands, decision } = fullChain(answers)

  // evidence
  assert.strictEqual(norm.ok, true)
  assert.deepStrictEqual(norm.evidence.map((e) => e.evidenceId).sort(), ['DEC_CERTAINTY_GATE', 'DEC_INFO_BLIND'])

  // signals
  assert.ok(signals.some((s) => s.signalId === 'DECISION/D/certainty-gate'))
  assert.ok(signals.some((s) => s.signalId === 'DECISION/D/info-blind'))

  // dimensions
  const dec = dims.dimensions.find((d) => d.construct === 'DECISION')
  assert.strictEqual(dec.orientation, 'DISTORTED')
  assert.strictEqual(dec.state, 'STRONG')

  // candidates
  assert.strictEqual(cands.candidates.length, 9)

  // decision
  assert.strictEqual(decision.status, 'PRIMARY_ALLOWED')
  assert.strictEqual(decision.primaryBlindSpotId, 'DECISION_INERTIA')
  assert.strictEqual(decision.primaryConstruct, 'DECISION')
  assert.strictEqual(decision.reasonCode, 'UNIQUE_ELIGIBLE_CANDIDATE')

  // traceability audit: candidate → status → dimensionState → supporting/counter Qs → eligibility
  const t = decision.trace.find((x) => x.construct === 'DECISION')
  assert.strictEqual(t.status, 'SUPPORTED')
  assert.strictEqual(t.dimensionState, 'STRONG')
  assert.deepStrictEqual(t.supportingQuestionIds, ['SC_DEC_01', 'SC_DEC_02'])
  assert.deepStrictEqual(t.counterQuestionIds, [])
  assert.strictEqual(t.eligible, true)
  assert.deepStrictEqual(t.provenanceViolations, [])
  // every construct present in trace
  assert.deepStrictEqual(decision.trace.map((x) => x.construct).sort(), [...CONSTRUCTS_V21].sort())
})

test('full chain: two relevant eligible → FOLLOW_UP_REQUIRED with full trace', () => {
  const { cands, decision } = fullChain([...DD.RISK, ...DD.TIME])
  assert.strictEqual(cands.candidates.length, 9)
  assert.strictEqual(decision.status, 'FOLLOW_UP_REQUIRED')
  assert.deepStrictEqual(decision.followupPair, ['RISK', 'TIME'])
  const elig = decision.trace.filter((t) => t.eligible)
  assert.strictEqual(elig.length, 2)
  assert.deepStrictEqual(elig.map((t) => t.construct).sort(), ['RISK', 'TIME'])
})

test('full chain: all healthy → NO_PRIMARY_DEFICIT with zero eligible', () => {
  const { decision } = fullChain(ALL_HEALTHY)
  assert.strictEqual(decision.status, 'NO_PRIMARY_DEFICIT')
  assert.strictEqual(decision.trace.filter((t) => t.eligible).length, 0)
})
