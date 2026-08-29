/**
 * RC8.3 Stage19B-2 — V2.1 Response Validity Gate Acceptance Tests
 *
 * Validates the independent response-validity layer. This layer is a GATE:
 * it determines structural usability (RESPONSE_VALID / RESPONSE_QUALITY_LOW /
 * INSUFFICIENT_RESPONSE_QUALITY) and MUST NOT infer cognition.
 *
 * Authority:
 *   - docs/RC8.3_STAGE18_R3_WORLD_OS_CONTRACT_REPAIR.md §B
 *   - docs/RC8.3_STAGE18_R3B_RESPONSE_VALIDITY_ADDENDUM.md
 *   - docs/RC8.3_STAGE18_R3C_DISPLAY_POSITION_SOURCE_ADDENDUM.md
 *   - docs/RC8.3_STAGE18_R3C_R1_RESPONSE_VALIDITY_VERDICT_CLOSURE.md
 *
 * Uses `node --test`.
 *
 * @version world_model_v2_1
 */

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const rv = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')

const V21_DIR = path.join(__dirname, '../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1')

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function R(qid, pos, opt) {
  return { questionId: qid, optionId: opt || 'A', displayPosition: pos }
}

// ── 1–2. valid / all-same ─────────────────────────────────────────────────
test('1. valid varied-position full response → RESPONSE_VALID', () => {
  const r = rv.assessResponseValidityV21([
    R('SC_DEC_01', 0), R('SC_DEC_02', 1), R('SC_FB_01', 2), R('SC_FB_02', 3),
    R('SC_PROB_01', 1), R('SC_PROB_02', 0),
  ])
  assert.strictEqual(r.status, 'RESPONSE_VALID')
})

test('2. all-same-position response → RESPONSE_QUALITY_LOW', () => {
  const r = rv.assessResponseValidityV21([
    R('SC_DEC_01', 0), R('SC_DEC_02', 0), R('SC_FB_01', 0), R('SC_FB_02', 0),
  ])
  assert.strictEqual(r.status, 'RESPONSE_QUALITY_LOW')
  assert.ok(r.reasons.includes('MECHANICAL_PATTERN_ALL_SAME'))
  const spr = r.observedSignals.find((s) => s.signal === 'SAME_POSITION_RATE')
  const ent = r.observedSignals.find((s) => s.signal === 'ANSWER_ENTROPY')
  assert.strictEqual(spr.value, 1.0)
  assert.strictEqual(ent.value, 0)
})

test('3. alternating pattern (ABAB → 0,1,0,1) → RESPONSE_QUALITY_LOW', () => {
  const r = rv.assessResponseValidityV21([
    R('SC_DEC_01', 0), R('SC_DEC_02', 1), R('SC_FB_01', 0), R('SC_FB_02', 1),
  ])
  assert.strictEqual(r.status, 'RESPONSE_QUALITY_LOW')
  assert.ok(r.reasons.includes('MECHANICAL_PATTERN_ALTERNATING'))
})

test('4. sequential pattern (0,1,2,3) → RESPONSE_QUALITY_LOW', () => {
  const r = rv.assessResponseValidityV21([
    R('SC_DEC_01', 0), R('SC_DEC_02', 1), R('SC_FB_01', 2), R('SC_FB_02', 3),
  ])
  assert.strictEqual(r.status, 'RESPONSE_QUALITY_LOW')
  assert.ok(r.reasons.includes('MECHANICAL_PATTERN_SEQUENTIAL'))
})

// ── 5–9. sparse / duplicate / invalid / missing position ─────────────────
test('5. n=0 → INSUFFICIENT_RESPONSE_QUALITY', () => {
  const r = rv.assessResponseValidityV21([])
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
  assert.ok(r.reasons.includes('EMPTY_RESPONSE'))
})

test('6. sparse n<4 → INSUFFICIENT_RESPONSE_QUALITY', () => {
  const r = rv.assessResponseValidityV21([
    R('SC_DEC_01', 0), R('SC_DEC_02', 1), R('SC_FB_01', 2),
  ])
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
  assert.ok(r.reasons.includes('SPARSE_RESPONSE'))
})

test('7. duplicate questionId → INSUFFICIENT_RESPONSE_QUALITY (R3C-R1 §8)', () => {
  const r = rv.assessResponseValidityV21([
    R('SC_DEC_01', 0), R('SC_DEC_01', 2), R('SC_FB_01', 1), R('SC_FB_02', 3),
  ])
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
  assert.ok(r.observedSignals.some((s) => s.signal === 'DUPLICATE_QUESTION_SUBMISSION'))
  assert.ok(r.reasons.includes('DUPLICATE_QUESTION_SUBMISSION'))
})

test('8. invalid displayPosition → position signals UNKNOWN, no fabricated LOW', () => {
  const r = rv.assessResponseValidityV21([
    R('SC_DEC_01', 0), R('SC_DEC_02', 1), R('SC_FB_01', 9), R('SC_FB_02', 3),
  ])
  assert.ok(r.observedSignals.some((s) => s.signal === 'INVALID_DISPLAY_POSITION'))
  const spr = r.observedSignals.find((s) => s.signal === 'SAME_POSITION_RATE')
  assert.strictEqual(spr.status, 'UNKNOWN')
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
  assert.ok(r.reasons.includes('INVALID_DISPLAY_POSITION'))
})

test('9. missing displayPosition → position signals UNKNOWN, non-gating', () => {
  const r = rv.assessResponseValidityV21([
    { questionId: 'SC_DEC_01', optionId: 'A' },
    { questionId: 'SC_DEC_02', optionId: 'B' },
    { questionId: 'SC_FB_01', optionId: 'A', displayPosition: 0 },
    { questionId: 'SC_FB_02', optionId: 'B', displayPosition: 1 },
  ])
  assert.ok(r.observedSignals.some((s) => s.signal === 'MISSING_DISPLAY_POSITION'))
  const spr = r.observedSignals.find((s) => s.signal === 'SAME_POSITION_RATE')
  assert.strictEqual(spr.status, 'UNKNOWN')
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
  assert.ok(r.reasons.includes('MISSING_DISPLAY_POSITION'))
})

// ── 10. answer order shuffled ─────────────────────────────────────────────
test('10. answer order shuffled → identical validity output', () => {
  const base = [
    R('SC_DEC_01', 0), R('SC_DEC_02', 1), R('SC_FB_01', 2), R('SC_FB_02', 3),
  ]
  const shuffled = [base[3], base[0], base[2], base[1]]
  const a = rv.assessResponseValidityV21(base)
  const b = rv.assessResponseValidityV21(shuffled)
  assert.strictEqual(a.status, b.status)
  assert.deepStrictEqual(a.counts, b.counts)
  const sprA = a.observedSignals.find((s) => s.signal === 'SAME_POSITION_RATE')
  const sprB = b.observedSignals.find((s) => s.signal === 'SAME_POSITION_RATE')
  assert.strictEqual(sprA.value, sprB.value)
})

// ── 11–12. display-position sensitivity & isolation ──────────────────────
test('11. same optionIds + changed displayPositions → validity MAY change', () => {
  const varied = [
    R('SC_DEC_01', 0), R('SC_DEC_02', 1), R('SC_FB_01', 3), R('SC_FB_02', 2),
  ]
  const allSame = [
    R('SC_DEC_01', 0), R('SC_DEC_02', 0), R('SC_FB_01', 0), R('SC_FB_02', 0),
  ]
  assert.strictEqual(rv.assessResponseValidityV21(varied).status, 'RESPONSE_VALID')
  assert.strictEqual(rv.assessResponseValidityV21(allSame).status, 'RESPONSE_QUALITY_LOW')
})

test('12. same displayPosition pattern + changed semantic optionIds → validity unchanged', () => {
  const a = [
    R('SC_DEC_01', 0, 'A'), R('SC_DEC_02', 1, 'A'), R('SC_FB_01', 2, 'A'), R('SC_FB_02', 3, 'A'),
  ]
  const b = [
    R('SC_DEC_01', 0, 'C'), R('SC_DEC_02', 1, 'B'), R('SC_FB_01', 2, 'D'), R('SC_FB_02', 3, 'A'),
  ]
  assert.strictEqual(rv.assessResponseValidityV21(a).status, rv.assessResponseValidityV21(b).status)
})

// ── 13. duplicate is structural insufficiency, not a quality signal ──────
test('13. duplicate questionId is structural insufficiency (R3C-R1 §8)', () => {
  const r = rv.assessResponseValidityV21([
    R('SC_DEC_01', 0), R('SC_DEC_01', 2), R('SC_FB_01', 1), R('SC_FB_02', 3),
  ])
  // duplicate → IRQ regardless of otherwise-varied positions
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
  assert.ok(r.reasons.includes('DUPLICATE_QUESTION_SUBMISSION'))
})

// ── 14. multiple suspicious signals combine per R3B (mechanical pattern) ──
test('14. multiple suspicious signals combine via mechanical pattern only', () => {
  const r = rv.assessResponseValidityV21([
    R('SC_DEC_01', 0), R('SC_DEC_02', 0), R('SC_FB_01', 0), R('SC_FB_02', 0),
  ])
  assert.strictEqual(r.status, 'RESPONSE_QUALITY_LOW')
  // all_same ⟺ SAME_POSITION_RATE==1.0 AND ENTROPY==0 (joint)
  const spr = r.observedSignals.find((s) => s.signal === 'SAME_POSITION_RATE')
  const ent = r.observedSignals.find((s) => s.signal === 'ANSWER_ENTROPY')
  assert.strictEqual(spr.value, 1.0)
  assert.strictEqual(ent.value, 0)
})

// ── 15. deferred timing signal not fabricated ─────────────────────────────
test('15. deferred signals are DEFERRED_NOT_OBSERVABLE, never fabricated', () => {
  const r = rv.assessResponseValidityV21([
    R('SC_DEC_01', 0), R('SC_DEC_02', 1), R('SC_FB_01', 2), R('SC_FB_02', 3),
  ])
  for (const d of r.deferredSignals) {
    assert.strictEqual(d.status, 'DEFERRED_NOT_OBSERVABLE')
  }
  const names = r.deferredSignals.map((d) => d.signal)
  assert.ok(names.includes('COMPLETION_TIME_ANOMALY'))
  assert.ok(names.includes('DUPLICATE_SCENARIO_INCONSISTENCY'))
  assert.ok(names.includes('SEMANTIC_CONTRADICTION_RATE'))
  // no fabricated numeric value
  for (const d of r.deferredSignals) {
    assert.ok(!('value' in d) || d.value === undefined || d.value === null)
  }
})

// ── 16–20. no cognition output ────────────────────────────────────────────
test('16–20. output contains no cognition / probability / wealth fields', () => {
  const r = rv.assessResponseValidityV21([
    R('SC_DEC_01', 0), R('SC_DEC_02', 1), R('SC_FB_01', 2), R('SC_FB_02', 3),
  ])
  const out = JSON.stringify(r)
  for (const banned of ['blindSpotId', 'primaryConstruct', 'dimensionState', 'candidateScore', 'probability', 'confidence', 'wealth', 'primaryBlindSpot', 'primaryConstruct']) {
    assert.ok(!out.includes(banned), `output must not include "${banned}"`)
  }
  // no numeric probability field
  assert.ok(!('probability' in r))
})

// ── source-level prohibitions ─────────────────────────────────────────────
test('source: no optionId→position fallback, no position→cognition, no cognition deps', () => {
  const src = stripComments(fs.readFileSync(path.join(V21_DIR, 'responseValidityV21.js'), 'utf8'))
  // never derive position from optionId
  assert.strictEqual(src.includes('optionId.charCodeAt'), false)
  assert.strictEqual(src.includes('optionId.toUpperCase'), false)
  // position source frozen as DISPLAY_POSITION
  assert.strictEqual(rv.RESPONSE_VALIDITY_POSITION_SOURCE, 'DISPLAY_POSITION')
  // never require cognition modules
  for (const mod of ['dimensionEngineV21', 'blindSpotCandidateEngineV21', 'primaryDecisionEngineV21', 'followUpBankV21', 'followUpDiscriminatorV21', 'evidenceNormalizerV21', 'signalExtractorV21', 'evidenceCatalogV21']) {
    assert.strictEqual(src.includes(`require('./${mod}')`), false, `must not require ${mod}`)
  }
})

test('source: no single-signal invalid heuristic (entropy < X, ALL_A = invalid)', () => {
  const src = stripComments(fs.readFileSync(path.join(V21_DIR, 'responseValidityV21.js'), 'utf8'))
  assert.strictEqual(/entropy\s*</.test(src), false)
  assert.strictEqual(src.includes('ALL_A'), false)
  assert.strictEqual(src.includes('ALL_B'), false)
})

test('validity status set is exact (3 statuses)', () => {
  assert.deepStrictEqual(rv.VALIDITY_STATUS_SET_V21, [
    'RESPONSE_VALID',
    'RESPONSE_QUALITY_LOW',
    'INSUFFICIENT_RESPONSE_QUALITY',
  ])
})

// ── isolation proof: cognition unchanged under displayPosition change ─────
test('isolation: displayPosition change does not alter cognition (optionId-only inputs)', () => {
  // The response-validity module only reads questionId/optionId/displayPosition.
  // Its output has no cognition field. The contract's isolation property is
  // structural: optionId is passed through untouched; displayPosition is never
  // fed to any cognition path (asserted at source level above). Here we assert
  // the module does not mutate or reinterpret optionId.
  const r1 = rv.assessResponseValidityV21([R('SC_DEC_01', 0, 'A'), R('SC_DEC_02', 1, 'B'), R('SC_FB_01', 3, 'C'), R('SC_FB_02', 2, 'D')])
  const r2 = rv.assessResponseValidityV21([R('SC_DEC_01', 3, 'A'), R('SC_DEC_02', 2, 'B'), R('SC_FB_01', 1, 'C'), R('SC_FB_02', 0, 'D')])
  // Both are non-mechanical position patterns → both VALID; optionId does not leak into signals.
  assert.strictEqual(r1.status, 'RESPONSE_VALID')
  assert.strictEqual(r2.status, 'RESPONSE_VALID')
  // No signal references option semantics.
  for (const s of [...r1.observedSignals, ...r2.observedSignals]) {
    assert.ok(!('optionId' in s))
  }
})

// ── R3C-R1 §14 adversarial truth table ────────────────────────────────────
// NOTE: kept in questionId-sorted (canonical) order so that index-based
// mechanical patterns (sequential/alternating) align with the implementation's
// order-invariant canonicalization (sort by questionId).
const QIDS_18 = [
  'SC_DEC_01', 'SC_DEC_02', 'SC_FB_01', 'SC_FB_02',
  'SC_ID_01', 'SC_ID_02', 'SC_LEV_01', 'SC_LEV_02',
  'SC_OPP_01', 'SC_OPP_02', 'SC_PROB_01', 'SC_PROB_02',
  'SC_RISK_01', 'SC_RISK_02', 'SC_SYS_01', 'SC_SYS_02',
  'SC_TIME_01', 'SC_TIME_02',
]
function ans18(posFn) {
  return QIDS_18.map((q, i) => ({ questionId: q, optionId: 'A', displayPosition: posFn(i) }))
}

test('R3C-R1 A: 18 valid all-same → RESPONSE_QUALITY_LOW', () => {
  const r = rv.assessResponseValidityV21(ans18(() => 0))
  assert.strictEqual(r.status, 'RESPONSE_QUALITY_LOW')
})

test('R3C-R1 B: same answers, all positions removed → INSUFFICIENT_RESPONSE_QUALITY', () => {
  const answers = QIDS_18.map((q) => ({ questionId: q, optionId: 'A' }))
  const r = rv.assessResponseValidityV21(answers)
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
})

test('R3C-R1 C: same answers, all positions invalid → INSUFFICIENT_RESPONSE_QUALITY', () => {
  const r = rv.assessResponseValidityV21(ans18(() => 9))
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
})

test('R3C-R1 D: 17 valid + 1 missing → INSUFFICIENT_RESPONSE_QUALITY', () => {
  const answers = QIDS_18.map((q, i) => {
    if (i === 0) return { questionId: q, optionId: 'A' }
    return { questionId: q, optionId: 'A', displayPosition: (i % 4) }
  })
  const r = rv.assessResponseValidityV21(answers)
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
})

test('R3C-R1 E: 17 valid + 1 invalid → INSUFFICIENT_RESPONSE_QUALITY', () => {
  const answers = QIDS_18.map((q, i) => {
    const pos = i === 0 ? 7 : (i % 4)
    return { questionId: q, optionId: 'A', displayPosition: pos }
  })
  const r = rv.assessResponseValidityV21(answers)
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
})

test('R3C-R1 F: 18 structurally valid varied positions → RESPONSE_VALID', () => {
  const answers = QIDS_18.map((q, i) => ({ questionId: q, optionId: 'A', displayPosition: ((i * 3) % 4) }))
  const r = rv.assessResponseValidityV21(answers)
  assert.strictEqual(r.status, 'RESPONSE_VALID')
})

test('R3C-R1 G: duplicate questionId → INSUFFICIENT_RESPONSE_QUALITY', () => {
  const answers = QIDS_18.map((q, i) => {
    // duplicate SC_DEC_01 instead of SC_SYS_02 (last entry)
    const qid = i === 17 ? 'SC_DEC_01' : q
    return { questionId: qid, optionId: 'A', displayPosition: (i % 4) }
  })
  const r = rv.assessResponseValidityV21(answers)
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
})

test('R3C-R1 H: n == 0 → INSUFFICIENT_RESPONSE_QUALITY', () => {
  const r = rv.assessResponseValidityV21([])
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
})

test('R3C-R1 I: 1 <= n < 4 → INSUFFICIENT_RESPONSE_QUALITY', () => {
  const r = rv.assessResponseValidityV21([R('SC_DEC_01', 0), R('SC_DEC_02', 1), R('SC_FB_01', 2)])
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
})

test('R3C-R1 J: alternating valid structure → RESPONSE_QUALITY_LOW', () => {
  const r = rv.assessResponseValidityV21(ans18((i) => i % 2))
  assert.strictEqual(r.status, 'RESPONSE_QUALITY_LOW')
})

test('R3C-R1 K: sequential valid structure → RESPONSE_QUALITY_LOW', () => {
  const r = rv.assessResponseValidityV21(ans18((i) => i % 4))
  assert.strictEqual(r.status, 'RESPONSE_QUALITY_LOW')
})

// ── R3C-R1 §10 bypass mutation test ───────────────────────────────────────
test('bypass mutation: removing one position from LOW must become IRQ (not VALID)', () => {
  const low = ans18(() => 0)
  assert.strictEqual(rv.assessResponseValidityV21(low).status, 'RESPONSE_QUALITY_LOW')
  const mutated = low.map((a, i) => i === 5 ? { questionId: a.questionId, optionId: a.optionId } : a)
  const r = rv.assessResponseValidityV21(mutated)
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
  assert.notStrictEqual(r.status, 'RESPONSE_VALID')
})

test('bypass mutation: invalidating one position from LOW must become IRQ (not VALID)', () => {
  const low = ans18(() => 0)
  assert.strictEqual(rv.assessResponseValidityV21(low).status, 'RESPONSE_QUALITY_LOW')
  const mutated = low.map((a, i) => i === 5 ? { questionId: a.questionId, optionId: a.optionId, displayPosition: 11 } : a)
  const r = rv.assessResponseValidityV21(mutated)
  assert.strictEqual(r.status, 'INSUFFICIENT_RESPONSE_QUALITY')
  assert.notStrictEqual(r.status, 'RESPONSE_VALID')
})
