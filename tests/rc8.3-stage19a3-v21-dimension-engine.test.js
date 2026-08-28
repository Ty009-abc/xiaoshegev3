/**
 * RC8.3 Stage19A3 — V2.1 Dimension State Engine Acceptance Tests
 *
 * Validates: normalized atomic evidence + provenance → support-unit counts →
 * orientation + state for all 9 V2.1 constructs.
 *
 * Authority: docs/adr/ADR-RC8.3-STAGE18-R3D-DIMENSION-STATE-CONTRACT-ADDENDUM.md
 *   §15 (R3D R2 Two-Question State Model Repair) + §16 (Acceptance Patch).
 *
 * Covers:
 *   A. truth-table (unit-level support fixtures)
 *   B. real questionnaire reachability (MODERATE only in IDENTITY/OPPORTUNITY)
 *   C. dedup support fixture (SC_DEC_01:A + SC_DEC_02:B → support 2, not 1)
 *   D. missingness (zero / partial → UNKNOWN, no deficit)
 *   E. contradiction preservation (H+D → MIXED+WEAK)
 *   F. distortionType preservation
 *   G. order / display invariance
 *   H. cross-dimension isolation (SYSTEMS leak = 0)
 *   I. cross-construct comparability forbidden + forbidden dependencies
 *
 * @version world_model_v2_1
 */

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const {
  normalizeEvidenceV21,
  computeDimensionsV21,
  resolveDimensionStateV21,
  CONSTRUCTS_V21,
  QUESTIONS_V21,
} = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/index.js')

const V21_DIR = path.join(__dirname, '../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1')

function dimsOf(answers) {
  const norm = normalizeEvidenceV21(answers)
  return computeDimensionsV21(norm)
}

function dimFor(answers, construct) {
  return dimsOf(answers).dimensions.find((d) => d.construct === construct)
}

// ── A. TRUTH TABLE (unit-level support fixtures) ─────────────────────────
const TRUTH_TABLE = [
  { h: 0, d: 0, n: 0, orientation: 'UNKNOWN', state: 'UNKNOWN' },
  { h: 1, d: 0, n: 0, orientation: 'HEALTHY', state: 'WEAK' },
  { h: 0, d: 1, n: 0, orientation: 'DISTORTED', state: 'WEAK' },
  { h: 0, d: 0, n: 1, orientation: 'NEUTRAL', state: 'UNKNOWN' },
  { h: 2, d: 0, n: 0, orientation: 'HEALTHY', state: 'STRONG' },
  { h: 0, d: 2, n: 0, orientation: 'DISTORTED', state: 'STRONG' },
  { h: 0, d: 0, n: 2, orientation: 'NEUTRAL', state: 'UNKNOWN' },
  { h: 1, d: 1, n: 0, orientation: 'MIXED', state: 'WEAK' },
  { h: 1, d: 0, n: 1, orientation: 'HEALTHY', state: 'MODERATE' },
  { h: 0, d: 1, n: 1, orientation: 'DISTORTED', state: 'MODERATE' },
]

test('A. truth table: resolveDimensionStateV21 deterministic for all 10 reachable combos', () => {
  for (const row of TRUTH_TABLE) {
    const r = resolveDimensionStateV21(row.h, row.d, row.n)
    assert.strictEqual(r.orientation, row.orientation, `orientation ${JSON.stringify(row)}`)
    assert.strictEqual(r.state, row.state, `state ${JSON.stringify(row)}`)
  }
})

test('A2. unexpected combination (h+d+n > 2) → INVALID, never guessed', () => {
  assert.deepStrictEqual(resolveDimensionStateV21(3, 0, 0), { orientation: 'INVALID', state: 'INVALID' })
  assert.deepStrictEqual(resolveDimensionStateV21(1, 1, 1), { orientation: 'INVALID', state: 'INVALID' })
  assert.deepStrictEqual(resolveDimensionStateV21(0, 0, 3), { orientation: 'INVALID', state: 'INVALID' })
})

// ── B. REAL QUESTIONNAIRE REACHABILITY ────────────────────────────────────
test('B. full 18Q → 9 dimensions, all non-INVALID, all states among {UNKNOWN,WEAK,MODERATE,STRONG}', () => {
  const answers = QUESTIONS_V21.map((q) => ({ questionId: q.questionId, optionId: 'A' }))
  const { dimensions, contractViolations } = dimsOf(answers)
  assert.strictEqual(dimensions.length, 9)
  assert.deepStrictEqual(contractViolations, [])
  const states = new Set(dimensions.map((d) => d.state))
  for (const s of states) {
    assert.ok(['UNKNOWN', 'WEAK', 'MODERATE', 'STRONG'].includes(s))
  }
})

test('B2. MODERATE reachable only in IDENTITY and OPPORTUNITY', () => {
  // IDENTITY: H + N  →  SC_ID_01:A (ID_UPDATEABLE H) + SC_ID_02:D (ID_CONTEXTUAL N)
  const id = dimFor([{ questionId: 'SC_ID_01', optionId: 'A' }, { questionId: 'SC_ID_02', optionId: 'D' }], 'IDENTITY')
  assert.strictEqual(id.state, 'MODERATE')
  assert.strictEqual(id.orientation, 'HEALTHY')

  // OPPORTUNITY: D + N → SC_OPP_01:B (OPP_NARROW D) + SC_OPP_02:B (OPP_SOME N)
  const opp = dimFor([{ questionId: 'SC_OPP_01', optionId: 'B' }, { questionId: 'SC_OPP_02', optionId: 'B' }], 'OPPORTUNITY')
  assert.strictEqual(opp.state, 'MODERATE')
  assert.strictEqual(opp.orientation, 'DISTORTED')

  // Prove the 7 other constructs cannot reach MODERATE with any valid option pair.
  const nonModerates = ['DECISION', 'FEEDBACK', 'PROBABILITY', 'RISK', 'LEVERAGE', 'TIME', 'SYSTEMS']
  for (const construct of nonModerates) {
    const qs = QUESTIONS_V21.filter((q) => q.construct === construct)
    const [q1, q2] = qs
    for (const o1 of q1.options) {
      for (const o2 of q2.options) {
        const d = dimFor([{ questionId: q1.questionId, optionId: o1.optionId }, { questionId: q2.questionId, optionId: o2.optionId }], construct)
        assert.notStrictEqual(d.state, 'MODERATE', `${construct} must not reach MODERATE via ${o1.optionId}/${o2.optionId}`)
      }
    }
  }
})

// ── C. DEDUP SUPPORT FIXTURE (hard gate) ──────────────────────────────────
test('C. dedup support: SC_DEC_01:A + SC_DEC_02:B → support=2 (not evidenceId count=1)', () => {
  // Both map to DEC_ACTION_LEARNS (H). matchedQuestionIds = 2 distinct questions.
  const norm = normalizeEvidenceV21([
    { questionId: 'SC_DEC_01', optionId: 'A' },
    { questionId: 'SC_DEC_02', optionId: 'B' },
  ])
  assert.strictEqual(norm.evidence.length, 1, 'deduped to 1 evidence row')
  assert.strictEqual(norm.evidence[0].evidenceId, 'DEC_ACTION_LEARNS')
  assert.deepStrictEqual(norm.evidence[0].matchedQuestionIds.sort(), ['SC_DEC_01', 'SC_DEC_02'])

  const dec = computeDimensionsV21(norm).dimensions.find((d) => d.construct === 'DECISION')
  assert.strictEqual(dec.hSupport, 2, 'support = 2 (unique matchedQuestionIds), NOT 1')
  assert.strictEqual(dec.dSupport, 0)
  assert.strictEqual(dec.nSupport, 0)
  assert.strictEqual(dec.orientation, 'HEALTHY')
  assert.strictEqual(dec.state, 'STRONG')
  assert.deepStrictEqual(dec.supportingEvidenceIds, ['DEC_ACTION_LEARNS'])
  assert.deepStrictEqual(dec.hSupportQuestionIds.sort(), ['SC_DEC_01', 'SC_DEC_02'])
})

// ── D. MISSINGNESS ────────────────────────────────────────────────────────
test('D. zero answers → 9/9 UNKNOWN + UNKNOWN, no deficit', () => {
  const { dimensions, contractViolations } = dimsOf([])
  assert.strictEqual(dimensions.length, 9)
  assert.deepStrictEqual(contractViolations, [])
  for (const d of dimensions) {
    assert.strictEqual(d.orientation, 'UNKNOWN')
    assert.strictEqual(d.state, 'UNKNOWN')
    assert.strictEqual(d.hSupport + d.dSupport + d.nSupport, 0)
  }
})

test('D2. one construct only → other 8 remain UNKNOWN + UNKNOWN', () => {
  const { dimensions } = dimsOf([{ questionId: 'SC_DEC_01', optionId: 'A' }])
  for (const d of dimensions) {
    if (d.construct === 'DECISION') {
      assert.strictEqual(d.state, 'WEAK')
      assert.strictEqual(d.orientation, 'HEALTHY')
    } else {
      assert.strictEqual(d.orientation, 'UNKNOWN', `${d.construct} must stay UNKNOWN`)
      assert.strictEqual(d.state, 'UNKNOWN', `${d.construct} must stay UNKNOWN`)
    }
  }
})

// ── E. CONTRADICTION PRESERVATION ────────────────────────────────────────
test('E. H+D contradiction → MIXED + WEAK + hasContradiction', () => {
  // DECISION: SC_DEC_01:A (DEC_ACTION_LEARNS H) + SC_DEC_02:C (DEC_INFO_BLIND D)
  const dec = dimFor([{ questionId: 'SC_DEC_01', optionId: 'A' }, { questionId: 'SC_DEC_02', optionId: 'C' }], 'DECISION')
  assert.strictEqual(dec.hSupport, 1)
  assert.strictEqual(dec.dSupport, 1)
  assert.strictEqual(dec.orientation, 'MIXED')
  assert.strictEqual(dec.state, 'WEAK')
  assert.strictEqual(dec.hasContradiction, true)
  assert.strictEqual(dec.distortionTypes.includes('info-blind'), true)
})

// ── F. DISTORTION TYPE PRESERVATION ───────────────────────────────────────
test('F. distortionTypes preserved: multi-D same construct keeps both mechanisms', () => {
  // FEEDBACK: SC_FB_01:B (FB_AS_NOISE D) + SC_FB_02:B (FB_AS_THREAT D)
  const fb = dimFor([{ questionId: 'SC_FB_01', optionId: 'B' }, { questionId: 'SC_FB_02', optionId: 'B' }], 'FEEDBACK')
  assert.strictEqual(fb.state, 'STRONG')
  assert.strictEqual(fb.orientation, 'DISTORTED')
  assert.deepStrictEqual(fb.distortionTypes, ['feedback-as-noise', 'feedback-as-threat'])
})

// ── G. ORDER / DISPLAY INVARIANCE ─────────────────────────────────────────
test('G. answer-order + displayPosition invariance', () => {
  const base = QUESTIONS_V21.map((q, i) => ({ questionId: q.questionId, optionId: 'A', displayPosition: i % 4 }))
  const shuffled = QUESTIONS_V21.map((q, i) => ({ questionId: q.questionId, optionId: 'A', displayPosition: (3 - i) % 4 }))
  const reordered = [...base].reverse()

  const d1 = computeDimensionsV21(normalizeEvidenceV21(base))
  const d2 = computeDimensionsV21(normalizeEvidenceV21(shuffled))
  const d3 = computeDimensionsV21(normalizeEvidenceV21(reordered))

  assert.deepStrictEqual(d1.dimensions, d2.dimensions, 'displayPosition shuffled → identical')
  assert.deepStrictEqual(d1.dimensions, d3.dimensions, 'answer order reversed → identical')
  assert.deepStrictEqual(d1.contractViolations, [])
})

// ── H. CROSS-DIMENSION ISOLATION ──────────────────────────────────────────
test('H. SYSTEMS isolation: SYSTEMS evidence affects only SYSTEMS', () => {
  const { dimensions } = dimsOf([
    { questionId: 'SC_SYS_01', optionId: 'B' }, // SYS_PERSON D
    { questionId: 'SC_SYS_02', optionId: 'B' }, // SYS_METHOD D
  ])
  for (const d of dimensions) {
    if (d.construct === 'SYSTEMS') {
      assert.strictEqual(d.state, 'STRONG')
      assert.strictEqual(d.orientation, 'DISTORTED')
      assert.strictEqual(d.dSupport, 2)
    } else {
      assert.strictEqual(d.orientation, 'UNKNOWN', `${d.construct} leaked`)
      assert.strictEqual(d.state, 'UNKNOWN', `${d.construct} leaked`)
      assert.strictEqual(d.hSupport + d.dSupport + d.nSupport, 0, `${d.construct} leaked support`)
    }
  }
})

test('H2. generic cross-dimension isolation: each construct only affected by its own questions', () => {
  // Answer one question per construct (option A). Verify each dimension's support
  // comes only from its own construct's questions.
  const answers = CONSTRUCTS_V21.map((construct) => {
    const q = QUESTIONS_V21.find((qq) => qq.construct === construct)
    return { questionId: q.questionId, optionId: 'A' }
  })
  const { dimensions, contractViolations } = dimsOf(answers)
  assert.deepStrictEqual(contractViolations, [])
  for (const d of dimensions) {
    assert.strictEqual(d.hSupport + d.dSupport + d.nSupport, 1, `${d.construct} should have exactly 1 support`)
    // the support question belongs to this construct
    const allIds = [...d.hSupportQuestionIds, ...d.dSupportQuestionIds, ...d.nSupportQuestionIds]
    for (const qid of allIds) {
      assert.ok(QUESTIONS_V21.find((q) => q.questionId === qid).construct === d.construct)
    }
  }
})

// ── I. CROSS-CONSTRUCT COMPARABILITY + FORBIDDEN DEPENDENCIES ─────────────
test('I. no numeric score / rank / severity / confidence in dimension output', () => {
  const { dimensions } = dimsOf(QUESTIONS_V21.map((q) => ({ questionId: q.questionId, optionId: 'A' })))
  for (const d of dimensions) {
    const keys = Object.keys(d)
    for (const banned of ['score', 'rank', 'severity', 'confidence', 'probability', 'weight', 'stateScore']) {
      assert.ok(!keys.some((k) => k.toLowerCase().includes(banned)), `dimension has forbidden key ${banned}`)
    }
  }
})

test('I2. forbidden dependencies: dimensionEngineV21.js must not reference forbidden fields', () => {
  const src = fs.readFileSync(path.join(V21_DIR, 'dimensionEngineV21.js'), 'utf8')
  // strip comments (so documentation words don't false-positive)
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
    'blindspot',
    'argmax',
    'Math.random',
    'context',
    'occupation',
    'income',
    'wealth',
    'PRIMARY_SEPARATION',
    'PRIMARY_SUFFICIENCY',
  ]
  for (const tok of forbidden) {
    assert.strictEqual(code.includes(tok), false, `dimensionEngineV21.js must not reference "${tok}"`)
  }
  // no numeric scoring operators invented
  assert.strictEqual(code.includes('probability'), false)
  assert.strictEqual(code.includes('confidence'), false)
})

// ── J. semantic/state fixture count + full-chain spot check ──────────────
test('J. >= 9 semantic state fixtures across all 9 constructs (full chain)', () => {
  // one fixture per construct (option A single-answer → WEAK, direction from catalog)
  const { dimensions } = dimsOf(CONSTRUCTS_V21.map((construct) => {
    const q = QUESTIONS_V21.find((qq) => qq.construct === construct)
    return { questionId: q.questionId, optionId: 'A' }
  }))
  assert.strictEqual(dimensions.length, 9)
  for (const d of dimensions) {
    assert.ok(['WEAK', 'STRONG', 'MODERATE', 'UNKNOWN'].includes(d.state))
    assert.ok(d.construct)
  }
})
