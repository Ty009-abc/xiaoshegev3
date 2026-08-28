/**
 * RC8.3 Stage19A4 — V2.1 Blindspot Candidate Engine Acceptance Tests
 *
 * Validates: 9 dimension outputs + typed evidence/signals → 9 blindspot
 * candidate containers. A candidate is an EVIDENCE CONTAINER — never a winner.
 *
 * Covers:
 *   A. exact 1:1 construct → blindSpotId mapping (9, no ontology priority)
 *   B. status rules (SUPPORTED/COUNTERSUPPORTED/MIXED/INSUFFICIENT)
 *   C. D→support / H→counter / N→neutral mapping
 *   D. missingness (no evidence → INSUFFICIENT, never SUPPORTED)
 *   E. contradiction preservation (MIXED → hasContradiction)
 *   F. distortionType preservation
 *   G. no numeric score / no primary selection / no ranking / no follow-up
 *   H. SYSTEMS independence (SYSTEMS → SYSTEM_THINKING_GAP only)
 *   I. full chain traceability + real semantic fixtures (>=9)
 *   J. forbidden dependencies (source-level)
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
  resolveBlindSpotStatusV21,
  CONSTRUCTS_V21,
  QUESTIONS_V21,
} = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/index.js')

const V21_DIR = path.join(__dirname, '../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1')

function candidatesOf(answers) {
  const norm = normalizeEvidenceV21(answers)
  const dims = computeDimensionsV21(norm)
  return buildBlindSpotCandidatesV21(dims)
}

function candidateFor(answers, construct) {
  return candidatesOf(answers).candidates.find((c) => c.construct === construct)
}

// ── A. EXACT 1:1 MAPPING ──────────────────────────────────────────────────
const EXPECTED_MAPPING = {
  DECISION: 'DECISION_INERTIA',
  FEEDBACK: 'FEEDBACK_LOOP_GAP',
  PROBABILITY: 'PROBABILITY_MISJUDGMENT',
  RISK: 'RISK_MODEL_DISTORTION',
  LEVERAGE: 'LEVERAGE_MODEL_GAP',
  TIME: 'TIME_HORIZON_TRAP',
  IDENTITY: 'IDENTITY_CONSTRAINT',
  OPPORTUNITY: 'OPPORTUNITY_BLINDNESS',
  SYSTEMS: 'SYSTEM_THINKING_GAP',
}

test('A. exactly 9 blindspot candidates with 1:1 construct mapping', () => {
  const { candidates, contractViolations } = candidatesOf([])
  assert.strictEqual(candidates.length, 9)
  assert.deepStrictEqual(contractViolations, [])
  const ids = new Set(candidates.map((c) => c.blindSpotId))
  assert.strictEqual(ids.size, 9, 'no duplicate blindSpotId')
  for (const c of candidates) {
    assert.strictEqual(c.blindSpotId, EXPECTED_MAPPING[c.construct], `${c.construct} mapping`)
  }
  // blindSpotId set matches expected exactly
  assert.deepStrictEqual(
    [...ids].sort(),
    Object.values(EXPECTED_MAPPING).sort(),
  )
})

// ── B. STATUS RULES ───────────────────────────────────────────────────────
test('B1. resolveBlindSpotStatusV21 categorical mapping', () => {
  assert.strictEqual(resolveBlindSpotStatusV21('DISTORTED'), 'SUPPORTED')
  assert.strictEqual(resolveBlindSpotStatusV21('HEALTHY'), 'COUNTERSUPPORTED')
  assert.strictEqual(resolveBlindSpotStatusV21('MIXED'), 'MIXED')
  assert.strictEqual(resolveBlindSpotStatusV21('UNKNOWN'), 'INSUFFICIENT')
  assert.strictEqual(resolveBlindSpotStatusV21('NEUTRAL'), 'INSUFFICIENT')
  assert.strictEqual(resolveBlindSpotStatusV21('BOGUS'), 'INVALID')
})

test('B2. status derived from orientation, NOT state', () => {
  // DISTORTED + STRONG → SUPPORTED (state does not flip direction)
  let c = candidateFor(
    [{ questionId: 'SC_FB_01', optionId: 'B' }, { questionId: 'SC_FB_02', optionId: 'B' }],
    'FEEDBACK'
  )
  assert.strictEqual(c.dimensionOrientation, 'DISTORTED')
  assert.strictEqual(c.dimensionState, 'STRONG')
  assert.strictEqual(c.status, 'SUPPORTED')

  // DISTORTED + WEAK → SUPPORTED
  c = candidateFor([{ questionId: 'SC_DEC_01', optionId: 'B' }], 'DECISION')
  assert.strictEqual(c.dimensionState, 'WEAK')
  assert.strictEqual(c.status, 'SUPPORTED')

  // HEALTHY + STRONG → COUNTERSUPPORTED
  c = candidateFor(
    [{ questionId: 'SC_DEC_01', optionId: 'A' }, { questionId: 'SC_DEC_02', optionId: 'B' }],
    'DECISION'
  )
  assert.strictEqual(c.dimensionOrientation, 'HEALTHY')
  assert.strictEqual(c.dimensionState, 'STRONG')
  assert.strictEqual(c.status, 'COUNTERSUPPORTED')

  // MIXED + WEAK → MIXED
  c = candidateFor(
    [{ questionId: 'SC_DEC_01', optionId: 'A' }, { questionId: 'SC_DEC_02', optionId: 'C' }],
    'DECISION'
  )
  assert.strictEqual(c.dimensionOrientation, 'MIXED')
  assert.strictEqual(c.status, 'MIXED')

  // UNKNOWN + UNKNOWN → INSUFFICIENT
  c = candidateFor([], 'DECISION')
  assert.strictEqual(c.dimensionOrientation, 'UNKNOWN')
  assert.strictEqual(c.dimensionState, 'UNKNOWN')
  assert.strictEqual(c.status, 'INSUFFICIENT')

  // NEUTRAL + UNKNOWN → INSUFFICIENT
  c = candidateFor([{ questionId: 'SC_ID_02', optionId: 'D' }], 'IDENTITY')
  assert.strictEqual(c.dimensionOrientation, 'NEUTRAL')
  assert.strictEqual(c.dimensionState, 'UNKNOWN')
  assert.strictEqual(c.status, 'INSUFFICIENT')
})

// ── C. D→SUPPORT / H→COUNTER / N→NEUTRAL ──────────────────────────────────
test('C. support/counter/neutral evidence mapping', () => {
  // DECISION: H+D (MIXED): SC_DEC_01:A → DEC_ACTION_LEARNS(H); SC_DEC_02:C → DEC_INFO_BLIND(D)
  const c = candidateFor(
    [{ questionId: 'SC_DEC_01', optionId: 'A' }, { questionId: 'SC_DEC_02', optionId: 'C' }],
    'DECISION'
  )
  assert.deepStrictEqual(c.supportingEvidenceIds, ['DEC_INFO_BLIND'])
  assert.deepStrictEqual(c.counterEvidenceIds, ['DEC_ACTION_LEARNS'])
  assert.deepStrictEqual(c.neutralEvidenceIds, [])
  assert.deepStrictEqual(c.supportingQuestionIds, ['SC_DEC_02'])
  assert.deepStrictEqual(c.counterQuestionIds, ['SC_DEC_01'])
  assert.deepStrictEqual(c.neutralQuestionIds, [])
  assert.strictEqual(c.hasContradiction, true)
})

// ── D. MISSINGNESS ────────────────────────────────────────────────────────
test('D. missingness: no evidence → INSUFFICIENT, never SUPPORTED/COUNTERSUPPORTED', () => {
  const { candidates } = candidatesOf([])
  for (const c of candidates) {
    assert.strictEqual(c.status, 'INSUFFICIENT')
    assert.deepStrictEqual(c.supportingEvidenceIds, [])
    assert.deepStrictEqual(c.counterEvidenceIds, [])
    assert.strictEqual(c.hasContradiction, false)
  }
  // partial: only DECISION answered → other 8 INSUFFICIENT, never falsely supported
  const { candidates: partial } = candidatesOf([{ questionId: 'SC_DEC_01', optionId: 'B' }])
  for (const c of partial) {
    if (c.construct === 'DECISION') {
      assert.strictEqual(c.status, 'SUPPORTED')
    } else {
      assert.strictEqual(c.status, 'INSUFFICIENT', `${c.construct} must be INSUFFICIENT`)
    }
  }
})

// ── E. CONTRADICTION PRESERVATION ─────────────────────────────────────────
test('E. MIXED → hasContradiction=true; contradiction not resolved', () => {
  const c = candidateFor(
    [{ questionId: 'SC_RISK_01', optionId: 'A' }, { questionId: 'SC_RISK_02', optionId: 'B' }],
    'RISK'
  )
  // SC_RISK_01:A → RISK_ASYMMETRY_AWARE(H); SC_RISK_02:B → RISK_REVERSIBILITY_BLIND(D)
  assert.strictEqual(c.dimensionOrientation, 'MIXED')
  assert.strictEqual(c.status, 'MIXED')
  assert.strictEqual(c.hasContradiction, true)
  assert.strictEqual(c.supportingQuestionIds.length, 1)
  assert.strictEqual(c.counterQuestionIds.length, 1)
})

// ── F. DISTORTION TYPE PRESERVATION ───────────────────────────────────────
test('F. distortionTypes preserved from D evidence (no generic collapse)', () => {
  const c = candidateFor(
    [{ questionId: 'SC_FB_01', optionId: 'B' }, { questionId: 'SC_FB_02', optionId: 'B' }],
    'FEEDBACK'
  )
  assert.strictEqual(c.status, 'SUPPORTED')
  assert.deepStrictEqual(c.distortionTypes, ['feedback-as-noise', 'feedback-as-threat'])
})

// ── G. NO NUMERIC SCORE / PRIMARY / RANKING / FOLLOW-UP ────────────────────
test('G. no numeric score, no primary/secondary, no rank, no follow-up fields', () => {
  const { candidates } = candidatesOf(QUESTIONS_V21.map((q) => ({ questionId: q.questionId, optionId: 'A' })))
  for (const c of candidates) {
    const keys = Object.keys(c)
    for (const banned of ['score', 'rank', 'severity', 'confidence', 'probability', 'weight', 'primary', 'secondary', 'priority', 'winner', 'top', 'argmax', 'followup', 'followUp', 'follow_up']) {
      assert.ok(!keys.some((k) => k.toLowerCase().includes(banned)), `candidate has forbidden key ${banned}`)
    }
  }
})

// ── H. SYSTEMS INDEPENDENCE ───────────────────────────────────────────────
test('H. SYSTEMS → SYSTEM_THINKING_GAP only; no cross-blindspot leak', () => {
  const { candidates } = candidatesOf([
    { questionId: 'SC_SYS_01', optionId: 'B' }, // SYS_PERSON D
    { questionId: 'SC_SYS_02', optionId: 'B' }, // SYS_METHOD D
  ])
  for (const c of candidates) {
    if (c.construct === 'SYSTEMS') {
      assert.strictEqual(c.blindSpotId, 'SYSTEM_THINKING_GAP')
      assert.strictEqual(c.status, 'SUPPORTED')
      assert.strictEqual(c.supportingQuestionIds.length, 2)
    } else {
      assert.strictEqual(c.status, 'INSUFFICIENT', `${c.construct} leaked SYSTEMS evidence`)
      assert.strictEqual(c.supportingQuestionIds.length + c.counterQuestionIds.length + c.neutralQuestionIds.length, 0, `${c.construct} leaked`)
    }
  }
})

// ── I. FULL CHAIN TRACEABILITY + REAL SEMANTIC FIXTURES ───────────────────
test('I. full chain: answers → evidence → signals → dimensions → candidates', () => {
  const answers = [
    { questionId: 'SC_DEC_01', optionId: 'B' }, // DEC_CERTAINTY_GATE (D, certainty-gate)
    { questionId: 'SC_DEC_02', optionId: 'C' }, // DEC_INFO_BLIND (D, info-blind)
  ]
  const norm = normalizeEvidenceV21(answers)
  assert.strictEqual(norm.ok, true)
  const signals = extractSignalsV21(norm)
  assert.ok(signals.some((s) => s.signalId === 'DECISION/D/certainty-gate'))
  assert.ok(signals.some((s) => s.signalId === 'DECISION/D/info-blind'))

  const dims = computeDimensionsV21(norm)
  const dec = dims.dimensions.find((d) => d.construct === 'DECISION')
  assert.strictEqual(dec.orientation, 'DISTORTED')
  assert.strictEqual(dec.state, 'STRONG')

  const cands = buildBlindSpotCandidatesV21(dims)
  const cand = cands.candidates.find((c) => c.construct === 'DECISION')
  assert.strictEqual(cand.blindSpotId, 'DECISION_INERTIA')
  assert.strictEqual(cand.status, 'SUPPORTED')
  assert.deepStrictEqual(cand.distortionTypes, ['certainty-gate', 'info-blind'])

  // traceability: questionId → optionId → evidenceId → distortionType → dimension → blindspot
  const evidenceIds = norm.evidence.map((e) => e.evidenceId).sort()
  assert.deepStrictEqual(evidenceIds, ['DEC_CERTAINTY_GATE', 'DEC_INFO_BLIND'])
  assert.deepStrictEqual(cand.supportingEvidenceIds, ['DEC_CERTAINTY_GATE', 'DEC_INFO_BLIND'])
  assert.deepStrictEqual(cand.supportingQuestionIds, ['SC_DEC_01', 'SC_DEC_02'])
})

test('I2. >=9 real semantic fixtures across all constructs + all 4 statuses', () => {
  // Build one fixture per construct; collect statuses.
  const fixtures = CONSTRUCTS_V21.map((construct) => {
    const qs = QUESTIONS_V21.filter((q) => q.construct === construct)
    const [q1, q2] = qs
    // pick first options (option A on both → direction per catalog)
    const answers = qs.map((q) => ({ questionId: q.questionId, optionId: 'A' }))
    const c = candidateFor(answers, construct)
    return { construct, status: c.status, blindSpotId: c.blindSpotId }
  })
  assert.strictEqual(fixtures.length, 9, 'SEMANTIC_CANDIDATE_FIXTURE_COUNT >= 9')
  const statuses = new Set(fixtures.map((f) => f.status))

  // Assemble explicit fixtures to guarantee all 4 statuses reachable:
  // SUPPORTED: FEEDBACK B+B (D+D)
  // COUNTERSUPPORTED: DECISION A+B (H+H via DEC_ACTION_LEARNS)
  // MIXED: RISK A+B (H+D)
  // INSUFFICIENT: zero answers
  const supported = candidateFor([{ questionId: 'SC_FB_01', optionId: 'B' }, { questionId: 'SC_FB_02', optionId: 'B' }], 'FEEDBACK')
  const countersupported = candidateFor([{ questionId: 'SC_DEC_01', optionId: 'A' }, { questionId: 'SC_DEC_02', optionId: 'B' }], 'DECISION')
  const mixed = candidateFor([{ questionId: 'SC_RISK_01', optionId: 'A' }, { questionId: 'SC_RISK_02', optionId: 'B' }], 'RISK')
  const insufficient = candidateFor([], 'TIME')

  assert.strictEqual(supported.status, 'SUPPORTED')
  assert.strictEqual(countersupported.status, 'COUNTERSUPPORTED')
  assert.strictEqual(mixed.status, 'MIXED')
  assert.strictEqual(insufficient.status, 'INSUFFICIENT')

  assert.deepStrictEqual(
    [...new Set([supported.status, countersupported.status, mixed.status, insufficient.status])].sort(),
    ['COUNTERSUPPORTED', 'INSUFFICIENT', 'MIXED', 'SUPPORTED'].sort(),
  )
})

// ── J. FORBIDDEN DEPENDENCIES (source-level) ──────────────────────────────
test('J. blindSpotCandidateEngineV21.js has zero forbidden dependencies', () => {
  const src = fs.readFileSync(path.join(V21_DIR, 'blindSpotCandidateEngineV21.js'), 'utf8')
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  const forbidden = [
    'displayPosition',
    'strengthClass',
    'counterOptionIds',
    'nearNeighborRelations',
    'ID_OFFSET',
    'idOffset',
    'ontology priority',
    'argmax',
    'Math.random',
    'context',
    'occupation',
    'income',
    'wealth',
    'PRIMARY_SEPARATION',
    'PRIMARY_SUFFICIENCY',
    'FOLLOW_UP',
    'topK',
    'argmax',
  ]
  for (const tok of forbidden) {
    assert.strictEqual(code.includes(tok), false, `must not reference "${tok}"`)
  }
  assert.strictEqual(code.includes('probability'), false)
  assert.strictEqual(code.includes('confidence'), false)
  assert.strictEqual(code.includes('severity'), false)
})
