/**
 * RC8.3 Stage19A2 — V2.1 Evidence & Typed Signal Layer Acceptance Tests
 *
 * Validates answers → atomic evidence → typed signals for world_model_v2_1:
 *   A.  semantic fixtures (>= 9, one per construct, full chain)
 *   B.  multi-distortion fixtures (DECISION / FEEDBACK / RISK — no collapse)
 *   C.  edge cases (full/partial/zero/invalid/duplicate/neutral/multi-source)
 *   D.  displayPosition isolation + shuffle invariance + answer-order invariance
 *   E.  missingness contract (missing ≠ deficit)
 *   F.  invalid input contract (deterministic, no evidence invented)
 *   G.  forbidden dependencies (unresolved A1 metadata / ID_OFFSET / wealth / priority)
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
  QUESTIONS_V21,
  CONSTRUCTS_V21,
  EVIDENCE_CATALOG_V21,
} = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/index.js')

const V21_DIR = path.join(__dirname, '../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1')

// ── helpers ────────────────────────────────────────────────────────────────
function norm(answers) { return normalizeEvidenceV21(answers) }
function sigsOf(normalized) { return extractSignalsV21(normalized) }
function sigIds(signals) { return signals.map((s) => s.signalId).sort() }
function evidenceIds(evidence) { return evidence.map((e) => e.evidenceId).sort() }

// build a full 18-question answer set using option A for every question
function full18OptionA() {
  return QUESTIONS_V21.map((q) => ({ questionId: q.questionId, optionId: 'A' }))
}

// ── A. SEMANTIC FIXTURES (>= 9, one per construct) ────────────────────────
const SEMANTIC_FIXTURES = [
  { q: 'SC_DEC_01', o: 'B', ev: 'DEC_CERTAINTY_GATE', dir: 'D', dt: 'certainty-gate', sig: 'DECISION/D/certainty-gate' },
  { q: 'SC_FB_02', o: 'B', ev: 'FB_AS_THREAT', dir: 'D', dt: 'feedback-as-threat', sig: 'FEEDBACK/D/feedback-as-threat' },
  { q: 'SC_PROB_01', o: 'B', ev: 'PROB_SURVIVOR_BIAS', dir: 'D', dt: 'survivor-bias', sig: 'PROBABILITY/D/survivor-bias' },
  { q: 'SC_RISK_01', o: 'B', ev: 'RISK_LOSS_AVERSION', dir: 'D', dt: 'loss-aversion', sig: 'RISK/D/loss-aversion' },
  { q: 'SC_LEV_01', o: 'A', ev: 'LEV_LINEAR_EFFORT', dir: 'D', dt: 'linear-effort', sig: 'LEVERAGE/D/linear-effort' },
  { q: 'SC_TIME_01', o: 'A', ev: 'TIME_COMPOUNDING_UNPROTECTED', dir: 'D', dt: 'compounding-unprotected', sig: 'TIME/D/compounding-unprotected' },
  { q: 'SC_ID_01', o: 'B', ev: 'ID_BOUNDARY_FIXED', dir: 'D', dt: 'boundary-fixed', sig: 'IDENTITY/D/boundary-fixed' },
  { q: 'SC_OPP_01', o: 'B', ev: 'OPP_NARROW', dir: 'D', dt: 'narrow-exposure', sig: 'OPPORTUNITY/D/narrow-exposure' },
  { q: 'SC_SYS_01', o: 'B', ev: 'SYS_PERSON', dir: 'D', dt: 'person-attribution', sig: 'SYSTEMS/D/person-attribution' },
]

test('A. semantic fixtures: full chain per construct', () => {
  assert.ok(SEMANTIC_FIXTURES.length >= 9)
  const constructSet = new Set(SEMANTIC_FIXTURES.map((f) => {
    const q = QUESTIONS_V21.find((qq) => qq.questionId === f.q)
    return q.construct
  }))
  assert.deepStrictEqual([...constructSet].sort(), [...CONSTRUCTS_V21].sort(), 'one fixture per construct')

  for (const f of SEMANTIC_FIXTURES) {
    const q = QUESTIONS_V21.find((qq) => qq.questionId === f.q)
    const opt = q.options.find((o) => o.optionId === f.o)
    // chain: questionId → optionId → semanticPropositionRef → evidenceId
    assert.ok(opt.semanticPropositionRefs.includes(f.ev), `${f.q}:${f.o} should ref ${f.ev}`)

    const cat = EVIDENCE_CATALOG_V21.find((e) => e.evidenceId === f.ev)
    assert.strictEqual(cat.construct, q.construct, 'construct chain intact')
    assert.strictEqual(cat.direction, f.dir)
    assert.strictEqual(cat.distortionType, f.dt)

    const res = norm([{ questionId: f.q, optionId: f.o }])
    assert.strictEqual(res.ok, true)
    assert.deepStrictEqual(evidenceIds(res.evidence), [f.ev], 'single answer → single atomic evidence')

    const sigs = sigsOf(res)
    assert.strictEqual(sigs.length, 1, 'single evidence → single typed signal')
    assert.strictEqual(sigs[0].signalId, f.sig)
    assert.strictEqual(sigs[0].construct, q.construct)
    assert.strictEqual(sigs[0].direction, f.dir)
    assert.strictEqual(sigs[0].distortionType, f.dt)
    assert.deepStrictEqual(sigs[0].supportingEvidenceIds, [f.ev])
    assert.strictEqual(sigs[0].evidenceCount, 1)
  }
})

// ── B. MULTI-DISTORTION FIXTURES (no semantic collapse) ───────────────────
test('B. multi-distortion fixtures: distinct typed signals coexist (no collapse)', () => {
  // DECISION: certainty-gate + info-blind
  let res = norm([{ questionId: 'SC_DEC_01', optionId: 'B' }, { questionId: 'SC_DEC_02', optionId: 'C' }])
  let ids = sigIds(sigsOf(res))
  assert.ok(ids.includes('DECISION/D/certainty-gate'))
  assert.ok(ids.includes('DECISION/D/info-blind'))
  assert.strictEqual(ids.filter((x) => x.startsWith('DECISION/D/')).length, 2)

  // FEEDBACK: feedback-as-noise + feedback-as-threat
  res = norm([{ questionId: 'SC_FB_01', optionId: 'B' }, { questionId: 'SC_FB_02', optionId: 'B' }])
  ids = sigIds(sigsOf(res))
  assert.ok(ids.includes('FEEDBACK/D/feedback-as-noise'))
  assert.ok(ids.includes('FEEDBACK/D/feedback-as-threat'))
  assert.strictEqual(ids.filter((x) => x.startsWith('FEEDBACK/D/')).length, 2)

  // RISK: loss-aversion + reversibility-blind
  res = norm([{ questionId: 'SC_RISK_01', optionId: 'B' }, { questionId: 'SC_RISK_02', optionId: 'B' }])
  ids = sigIds(sigsOf(res))
  assert.ok(ids.includes('RISK/D/loss-aversion'))
  assert.ok(ids.includes('RISK/D/reversibility-blind'))
  assert.strictEqual(ids.filter((x) => x.startsWith('RISK/D/')).length, 2)

  // No generic "construct deficit" signal may ever exist
  assert.ok(!ids.some((x) => /\/D\/(deficit|distorted|bad)$/.test(x)))
})

// ── C. EDGE CASES ──────────────────────────────────────────────────────────
test('C1. full valid 18Q', () => {
  const answers = full18OptionA()
  const res = norm(answers)
  assert.strictEqual(res.ok, true)
  assert.deepStrictEqual(res.validationErrors, [])
  assert.deepStrictEqual(res.missingQuestionIds, [])
  assert.ok(res.evidence.length >= 9, 'full 18Q should cover >=9 constructs')
  const covers = new Set(res.evidence.map((e) => e.construct))
  assert.deepStrictEqual([...covers].sort(), [...CONSTRUCTS_V21].sort())
})

test('C2. partial answers', () => {
  const res = norm([
    { questionId: 'SC_DEC_01', optionId: 'A' },
    { questionId: 'SC_RISK_01', optionId: 'B' },
  ])
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.missingQuestionIds.length, 16)
  assert.deepStrictEqual(evidenceIds(res.evidence).sort(), ['DEC_ACTION_LEARNS', 'RISK_LOSS_AVERSION'])
})

test('C3. zero answers', () => {
  const res = norm([])
  assert.strictEqual(res.ok, true)
  assert.deepStrictEqual(res.evidence, [])
  assert.strictEqual(sigsOf(res).length, 0)
  assert.strictEqual(res.missingQuestionIds.length, 18)
})

test('C4. invalid questionId', () => {
  const res = norm([{ questionId: 'SC_NOPE_01', optionId: 'A' }])
  assert.strictEqual(res.ok, false)
  assert.ok(res.validationErrors.some((e) => e.type === 'INVALID_QUESTION'))
  assert.deepStrictEqual(res.evidence, [])
  assert.strictEqual(sigsOf(res).length, 0)
})

test('C5. invalid optionId', () => {
  const res = norm([{ questionId: 'SC_DEC_01', optionId: 'Z' }])
  assert.strictEqual(res.ok, false)
  assert.ok(res.validationErrors.some((e) => e.type === 'INVALID_OPTION'))
  assert.deepStrictEqual(res.evidence, [])
  assert.strictEqual(sigsOf(res).length, 0)
})

test('C6. duplicate questionId → REJECT_DUPLICATE_QUESTION', () => {
  const res = norm([
    { questionId: 'SC_DEC_01', optionId: 'A' },
    { questionId: 'SC_DEC_01', optionId: 'B' },
  ])
  assert.strictEqual(res.ok, false)
  assert.ok(res.validationErrors.some((e) => e.type === 'DUPLICATE_QUESTION'))
  // deterministic: neither answer silently wins; no double evidence
  assert.deepStrictEqual(res.evidence, [])
})

test('C7. single healthy answer', () => {
  const res = norm([{ questionId: 'SC_DEC_01', optionId: 'A' }])
  assert.strictEqual(res.ok, true)
  const e = res.evidence[0]
  assert.strictEqual(e.direction, 'H')
  assert.strictEqual(e.distortionType, null)
  const s = sigsOf(res)[0]
  assert.strictEqual(s.signalId, 'DECISION/H')
  assert.strictEqual(s.distortionType, null)
})

test('C8. single distorted answer', () => {
  const res = norm([{ questionId: 'SC_DEC_01', optionId: 'B' }])
  const e = res.evidence[0]
  assert.strictEqual(e.direction, 'D')
  assert.strictEqual(e.distortionType, 'certainty-gate')
  const s = sigsOf(res)[0]
  assert.strictEqual(s.distortionType, 'certainty-gate')
})

test('C9. neutral answer', () => {
  // ID_CONTEXTUAL (N) from SC_ID_02:D; OPP_SOME (N) from SC_OPP_02:B
  const res = norm([{ questionId: 'SC_ID_02', optionId: 'D' }])
  assert.strictEqual(res.ok, true)
  const e = res.evidence[0]
  assert.strictEqual(e.direction, 'N')
  assert.strictEqual(e.distortionType, null)
  const s = sigsOf(res)[0]
  assert.strictEqual(s.signalId, 'IDENTITY/N')
  assert.strictEqual(s.distortionType, null)
})

test('C10. same evidence hit from >1 source (dedup + provenance preserved)', () => {
  // ID_UPDATEABLE hit by SC_ID_01:A and SC_ID_02:C
  const res = norm([
    { questionId: 'SC_ID_01', optionId: 'A' },
    { questionId: 'SC_ID_02', optionId: 'C' },
  ])
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.evidence.length, 1, 'deduped to one atomic evidence')
  const e = res.evidence[0]
  assert.strictEqual(e.evidenceId, 'ID_UPDATEABLE')
  assert.deepStrictEqual(e.matchedQuestionIds.sort(), ['SC_ID_01', 'SC_ID_02'])
  assert.deepStrictEqual(e.matchedOptionIds.sort(), ['SC_ID_01:A', 'SC_ID_02:C'])
})

test('C11. multiple evidence within same construct', () => {
  // DECISION: SC_DEC_01:A → DEC_ACTION_LEARNS[H]; SC_DEC_02:A → DEC_INFO_VALUED[H]
  const res = norm([
    { questionId: 'SC_DEC_01', optionId: 'A' },
    { questionId: 'SC_DEC_02', optionId: 'A' },
  ])
  assert.strictEqual(res.ok, true)
  const ids = evidenceIds(res.evidence)
  assert.deepStrictEqual(ids, ['DEC_ACTION_LEARNS', 'DEC_INFO_VALUED'])
  // both fold into a single healthy DECISION/H signal
  const s = sigsOf(res)
  assert.strictEqual(s.length, 1)
  assert.strictEqual(s[0].signalId, 'DECISION/H')
  assert.deepStrictEqual(s[0].supportingEvidenceIds, ['DEC_ACTION_LEARNS', 'DEC_INFO_VALUED'])
  assert.strictEqual(s[0].evidenceCount, 2)
})

// ── D. DISPLAY POSITION ISOLATION + INVARIANCE ─────────────────────────────
test('D1. shuffle invariance: displayPosition has zero cognitive effect', () => {
  const base = full18OptionA()
  const original = base.map((a, i) => ({ ...a, displayPosition: i % 4 }))
  const shuffled = base.map((a, i) => ({ ...a, displayPosition: (3 - i) % 4 }))
  const omitted = base.map((a) => ({ ...a })) // no displayPosition at all

  const evA = norm(original)
  const evB = norm(shuffled)
  const evC = norm(omitted)

  assert.deepStrictEqual(evA.evidence, evB.evidence, 'EVIDENCE_DIFF = 0')
  assert.deepStrictEqual(evA.evidence, evC.evidence, 'displayPosition omitted → same evidence')
  assert.deepStrictEqual(sigIds(sigsOf(evA)), sigIds(sigsOf(evB)), 'SIGNAL_DIFF = 0')
  assert.deepStrictEqual(sigIds(sigsOf(evA)), sigIds(sigsOf(evC)))

  // normalized output must never carry displayPosition
  for (const e of evA.evidence) {
    assert.ok(!('displayPosition' in e), 'displayPosition must not enter normalized cognitive output')
  }
})

test('D2. answer order invariance', () => {
  const answers = full18OptionA()
  const reversed = [...answers].reverse()
  const evA = norm(answers)
  const evB = norm(reversed)
  assert.deepStrictEqual(evA.evidence, evB.evidence, 'ANSWER_ORDER_INVARIANCE')
  assert.deepStrictEqual(sigIds(sigsOf(evA)), sigIds(sigsOf(evB)))
})

// ── E. MISSINGNESS CONTRACT ────────────────────────────────────────────────
test('E. missingness ≠ deficit', () => {
  // zero answers → no evidence, no signals, no deficit
  let res = norm([])
  assert.strictEqual(res.evidence.length, 0)
  assert.strictEqual(sigsOf(res).length, 0)

  // partial: only answered semantic evidence; no synthetic evidence for missing constructs
  res = norm([{ questionId: 'SC_DEC_01', optionId: 'A' }])
  const constructs = new Set(res.evidence.map((e) => e.construct))
  assert.deepStrictEqual([...constructs], ['DECISION'], 'no synthetic evidence for missing constructs')
})

// ── F. INVALID INPUT CONTRACT ──────────────────────────────────────────────
test('F. invalid input: deterministic validation shape, no throw', () => {
  // non-array → treated as empty (no throw)
  assert.doesNotThrow(() => norm(undefined))
  assert.doesNotThrow(() => norm(null))
  assert.doesNotThrow(() => norm('not-array'))
  assert.doesNotThrow(() => norm([null, 42, { questionId: 'SC_DEC_01' }]))

  const res = norm([{ questionId: 'SC_DEC_01' }]) // missing optionId
  assert.strictEqual(res.ok, false)
  assert.ok(res.validationErrors.some((e) => e.type === 'INVALID_OPTION'))
  assert.deepStrictEqual(res.evidence, [])
})

// ── G. FORBIDDEN DEPENDENCIES ──────────────────────────────────────────────
// Strip comments so documentation mentions (e.g. "no wealth fields") are not
// mistaken for code dependencies. Only actual code references are checked.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

test('G. forbidden dependencies: unresolved A1 metadata / ID_OFFSET / wealth / priority', () => {
  const src = ['evidenceNormalizerV21.js', 'signalExtractorV21.js'].map((f) =>
    stripComments(fs.readFileSync(path.join(V21_DIR, f), 'utf8'))
  ).join('\n')

  // Unresolved A1 optional/derived metadata must not be a code dependency.
  assert.strictEqual(src.includes('counterOptionIds'), false, 'counterOptionIds must not be referenced')
  assert.strictEqual(src.includes('strengthClass'), false, 'strengthClass must not be referenced')
  assert.strictEqual(src.includes('nearNeighborRelations'), false, 'nearNeighborRelations must not be referenced')
  assert.strictEqual(src.includes('nearNeighbor'), false)

  // Forbidden cognition inputs.
  assert.strictEqual(src.includes('ID_OFFSET'), false)
  assert.strictEqual(src.includes('idOffset'), false)
  assert.strictEqual(src.includes('wealth'), false)
  assert.strictEqual(src.includes('occupation'), false)
  assert.strictEqual(src.includes('income'), false)
  assert.strictEqual(src.includes('ontology priority'), false)
  assert.strictEqual(src.includes('archetype'), false)
  assert.strictEqual(src.includes('Math.random'), false)

  // displayPosition must not be read by cognition (only documented as ignored).
  // The camelCase token must not appear in either source file's CODE.
  for (const f of ['evidenceNormalizerV21.js', 'signalExtractorV21.js']) {
    const body = stripComments(fs.readFileSync(path.join(V21_DIR, f), 'utf8'))
    assert.strictEqual(body.includes('displayPosition'), false, `${f} must not reference displayPosition`)
  }
})

// ── H. HEALTHY / NEUTRAL / DISTORTED distortionType discipline ────────────
test('H. H/N distortionType null; D preserves catalog distortionType', () => {
  const all = full18OptionA()
  const res = norm(all)
  for (const e of res.evidence) {
    const cat = EVIDENCE_CATALOG_V21.find((c) => c.evidenceId === e.evidenceId)
    assert.strictEqual(e.distortionType, cat.distortionType, `${e.evidenceId} distortionType must match frozen catalog`)
  }
  for (const s of sigsOf(res)) {
    if (s.direction === 'H' || s.direction === 'N') {
      assert.strictEqual(s.distortionType, null)
    } else {
      assert.ok(typeof s.distortionType === 'string' && s.distortionType.length > 0)
    }
  }
})
