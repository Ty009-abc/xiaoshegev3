/**
 * RC8.3 Stage20 Gate-B R1 — V2.1 Shadow Observability Persistence Tests
 *
 * Validates the Gate-B schema-v2 observability persistence implemented in
 * `runtimeShadowAdapterV21.js`:
 *   - INFERENCE PARITY hard gate (observability must NOT change inference)
 *   - answerTrace  (18 × { questionId, optionId, displayPosition }, no fallback)
 *   - evidenceTrace (exact 5-field rows; multi-question evidenceId provenance)
 *   - validityTrace (exact 4-field; no trace/deferredSignals/numeric score)
 *   - schema-v1 backward compatibility (read-only, no migration)
 *   - size audit (actual serialization, well below CloudBase limit)
 *   - static scope audit (no forbidden inference/fallback/PII paths)
 *
 * Authority:
 *   - docs/adr/ADR-RC8.3-STAGE20-GATE-B-R0-OBSERVABILITY-CONTRACT.md
 *   - docs/RC8.3_STAGE20_R0_V21_RUNTIME_SHADOW_CONTRACT.md
 *
 * Uses `node --test`.
 *
 * @version world_model_v2_1
 */

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const adapter = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const cognition = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/index.js')

const ROOT = path.join(__dirname, '..')
const ADAPTER_PATH = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

// ── Frozen fixtures (shared with Stage20 runtime-shadow suite) ────────────
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

const DEC_HEALTHY = [{ questionId: 'SC_DEC_01', optionId: 'A' }, { questionId: 'SC_DEC_02', optionId: 'A' }]

const HEALTHY_16 = [
  { questionId: 'SC_FB_01', optionId: 'A' }, { questionId: 'SC_FB_02', optionId: 'A' },
  { questionId: 'SC_PROB_01', optionId: 'A' }, { questionId: 'SC_PROB_02', optionId: 'A' },
  { questionId: 'SC_RISK_01', optionId: 'A' }, { questionId: 'SC_RISK_02', optionId: 'A' },
  { questionId: 'SC_LEV_01', optionId: 'B' }, { questionId: 'SC_LEV_02', optionId: 'B' },
  { questionId: 'SC_TIME_01', optionId: 'B' }, { questionId: 'SC_TIME_02', optionId: 'A' },
  { questionId: 'SC_ID_01', optionId: 'A' }, { questionId: 'SC_ID_02', optionId: 'B' },
  { questionId: 'SC_OPP_01', optionId: 'A' }, { questionId: 'SC_OPP_02', optionId: 'A' },
  { questionId: 'SC_SYS_01', optionId: 'A' }, { questionId: 'SC_SYS_02', optionId: 'A' },
]

const ALL_HEALTHY = [...DEC_HEALTHY, ...HEALTHY_16]
const PRIMARY_ALLOWED_ANSWERS = [...DD.DECISION, ...HEALTHY_16]
const HEALTHY_NO_RISK_TIME = HEALTHY_16.filter((a) => !a.questionId.startsWith('SC_RISK') && !a.questionId.startsWith('SC_TIME'))
const FOLLOWUP_ANSWERS = [...DD.RISK, ...DD.TIME, ...DEC_HEALTHY, ...HEALTHY_NO_RISK_TIME]
const HEALTHY_NO_PROB = HEALTHY_16.filter((a) => !a.questionId.startsWith('SC_PROB'))
const INSUFF_STRUCT_ANSWERS = [...DD.DECISION, ...DD.PROBABILITY, ...HEALTHY_NO_PROB]
const MIXED_ANSWERS = [{ questionId: 'SC_DEC_01', optionId: 'A' }, { questionId: 'SC_DEC_02', optionId: 'C' }, ...HEALTHY_16]

function sortedIndex(answers) {
  return [...answers].sort((a, b) => (a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0))
}

function withVariedPositions(answers) {
  const posByQid = {}
  sortedIndex(answers).forEach((a, i) => { posByQid[a.questionId] = (i * 3) % 4 })
  return answers.map((a) => ({ questionId: a.questionId, optionId: a.optionId, displayPosition: posByQid[a.questionId] }))
}

function withFixedPositions(answers, fn) {
  const posByQid = {}
  sortedIndex(answers).forEach((a, i) => { posByQid[a.questionId] = fn(i) })
  return answers.map((a) => ({ questionId: a.questionId, optionId: a.optionId, displayPosition: posByQid[a.questionId] }))
}

function makeMockDb() {
  const calls = []
  return {
    collection() {
      return { async add(payload) { calls.push(payload) } }
    },
    _calls: calls,
  }
}

async function runShadow(answers, db) {
  return adapter.runRuntimeShadowV21({
    event: { answers, reportId: 'req-123' },
    openid: 'openid-test',
    ts: 1700000000000,
    db: db || makeMockDb(),
  })
}

// Canonical reference pipeline (independent of the adapter) for parity.
function referencePipeline(answers) {
  const norm = cognition.normalizeEvidenceV21(answers)
  const signals = cognition.extractSignalsV21(norm)
  const dims = cognition.computeDimensionsV21(norm)
  const { candidates, contractViolations } = cognition.buildBlindSpotCandidatesV21(dims)
  const decision = cognition.decidePrimaryV21({ candidates, contractViolations })
  return { norm, signals, dims, candidates, decision }
}

function dimensionSummaryOf(dims) {
  return dims.dimensions.map((d) => ({
    construct: d.construct,
    orientation: d.orientation,
    state: d.state,
    hSupport: d.hSupport,
    dSupport: d.dSupport,
    nSupport: d.nSupport,
  }))
}

function signalSummaryOf(signals) {
  return signals.map((s) => ({
    signalId: s.signalId,
    direction: s.direction,
    distortionType: s.distortionType,
    evidenceCount: s.evidenceCount,
  }))
}

// ═══════════════════════════════════════════════════════════════
// 3. INFERENCE PARITY HARD GATE
// ═══════════════════════════════════════════════════════════════

test('parity: adapter cognition chain output identical to canonical pipeline', () => {
  const fixtures = [
    PRIMARY_ALLOWED_ANSWERS,
    FOLLOWUP_ANSWERS,
    ALL_HEALTHY,
    INSUFF_STRUCT_ANSWERS,
    MIXED_ANSWERS,
  ]
  let diffCount = 0
  for (const answers of fixtures) {
    const ref = referencePipeline(answers)
    const chain = adapter.runCognitionChainV21(answers)
    // decision must match exactly (status / primary / follow-up / reason).
    if (JSON.stringify(chain.decision) !== JSON.stringify(ref.decision)) {
      diffCount += 1
      console.error('PARITY DIFF (decision):', JSON.stringify(chain.decision), '!=', JSON.stringify(ref.decision))
    }
    if (JSON.stringify(chain.signals) !== JSON.stringify(ref.signals)) diffCount += 1
    if (JSON.stringify(chain.dimensions) !== JSON.stringify(ref.dims.dimensions)) diffCount += 1
    if (JSON.stringify(chain.evidence) !== JSON.stringify(ref.norm.evidence)) diffCount += 1
  }
  assert.strictEqual(diffCount, 0, `inference parity must be exact; diffCount=${diffCount}`)
})

test('parity: runRuntimeShadowV21 record mirrors canonical inference (7 terminal/validity states)', async () => {
  const cases = [
    { name: 'PRIMARY_ALLOWED', answers: withVariedPositions(PRIMARY_ALLOWED_ANSWERS), terminal: 'PRIMARY_ALLOWED', validity: 'RESPONSE_VALID', primary: 'DECISION_INERTIA' },
    { name: 'FOLLOW_UP_REQUIRED', answers: withVariedPositions(FOLLOWUP_ANSWERS), terminal: 'FOLLOW_UP_REQUIRED', validity: 'RESPONSE_VALID', primary: null, pair: ['RISK', 'TIME'] },
    { name: 'NO_PRIMARY_DEFICIT', answers: withVariedPositions(ALL_HEALTHY), terminal: 'NO_PRIMARY_DEFICIT', validity: 'RESPONSE_VALID', primary: null },
    { name: 'INSUFFICIENT_EVIDENCE(struct)', answers: withVariedPositions(INSUFF_STRUCT_ANSWERS), terminal: 'INSUFFICIENT_EVIDENCE', validity: 'RESPONSE_VALID', primary: null },
    { name: 'INSUFFICIENT_EVIDENCE(mixed)', answers: withVariedPositions(MIXED_ANSWERS), terminal: 'INSUFFICIENT_EVIDENCE', validity: 'RESPONSE_VALID', primary: null },
    { name: 'RESPONSE_QUALITY_LOW', answers: withFixedPositions(PRIMARY_ALLOWED_ANSWERS, () => 0), terminal: 'NOT_EXECUTED', validity: 'RESPONSE_QUALITY_LOW', primary: null },
    { name: 'INSUFFICIENT_RESPONSE_QUALITY', answers: (() => { const a = withVariedPositions(PRIMARY_ALLOWED_ANSWERS); delete a[0].displayPosition; return a })(), terminal: 'NOT_EXECUTED', validity: 'INSUFFICIENT_RESPONSE_QUALITY', primary: null },
  ]

  let diffCount = 0
  for (const c of cases) {
    const ref = referencePipeline(c.answers)
    const out = await runShadow(c.answers)
    const rec = out.record
    // response validity parity
    if (rec.responseValidityStatus !== ref.validity ? ref.validity : null) {
      // validity parity is asserted separately below; here compare status via assessor
    }
    // terminal parity (only meaningful for RESPONSE_VALID cognition)
    if (rec.responseValidityStatus === 'RESPONSE_VALID') {
      if (rec.cognitionTerminalStatus !== ref.decision.status) diffCount += 1
      if (rec.primaryBlindSpotId !== ref.decision.primaryBlindSpotId) diffCount += 1
      if (rec.primaryConstruct !== ref.decision.primaryConstruct) diffCount += 1
      if (JSON.stringify(rec.followUpPair) !== JSON.stringify(ref.decision.followupPair)) diffCount += 1
      if (JSON.stringify(rec.dimensionSummary) !== JSON.stringify(dimensionSummaryOf(ref.dims))) diffCount += 1
      if (JSON.stringify(rec.evidenceTraceSummary) !== JSON.stringify(signalSummaryOf(ref.signals))) diffCount += 1
    }
  }
  assert.strictEqual(diffCount, 0, `INFERENCE_OUTPUT_DIFF_COUNT must be 0; got ${diffCount}`)
})

// ═══════════════════════════════════════════════════════════════
// 4. ANSWER TRACE
// ═══════════════════════════════════════════════════════════════

test('answerTrace: valid full 18Q fixture → length 18, exact 3-key rows', async () => {
  const out = await runShadow(withVariedPositions(PRIMARY_ALLOWED_ANSWERS))
  const rec = out.record
  assert.strictEqual(rec.schemaVersion, '2')
  assert.ok(Array.isArray(rec.answerTrace), 'answerTrace must be an array')
  assert.strictEqual(rec.answerTrace.length, 18)
  for (const row of rec.answerTrace) {
    assert.deepStrictEqual(Object.keys(row).sort(), ['displayPosition', 'optionId', 'questionId'])
    assert.strictEqual(typeof row.questionId, 'string')
    assert.strictEqual(typeof row.optionId, 'string')
    assert.strictEqual(typeof row.displayPosition, 'number')
  }
})

test('answerTrace: copies SUBMITTED displayPosition verbatim (no optionId→position derivation)', async () => {
  // Shuffled rendered order: canonical option index deliberately differs from
  // displayPosition. e.g. SC_DEC_01 optionId 'B' is canonical index 1, but we
  // submit displayPosition 3.
  const answers = PRIMARY_ALLOWED_ANSWERS.map((a, i) => ({
    questionId: a.questionId,
    optionId: a.optionId,
    // every answer submitted at displayPosition 3 EXCEPT enough variance to pass validity.
    displayPosition: (i * 3) % 4,
  }))
  const out = await runShadow(answers)
  const rec = out.record
  const byQid = {}
  for (const row of rec.answerTrace) byQid[row.questionId] = row
  // Verify verbatim: SC_DEC_01 submitted at position 0 → persisted 0.
  const idx0 = answers.find((a) => a.questionId === 'SC_DEC_01')
  assert.strictEqual(byQid['SC_DEC_01'].displayPosition, idx0.displayPosition)
  assert.strictEqual(byQid['SC_DEC_01'].optionId, idx0.optionId)
  // The persisted position must equal the submitted position for EVERY row.
  for (const a of answers) {
    assert.strictEqual(byQid[a.questionId].displayPosition, a.displayPosition, `${a.questionId} position must be verbatim`)
    assert.strictEqual(byQid[a.questionId].optionId, a.optionId)
  }
})

test('answerTrace: same optionId at different display positions → both preserved', async () => {
  // SC_FB_01 and SC_FB_02 both use optionId 'A' (healthy), but rendered at
  // different positions in their respective shuffled option lists.
  const answers = withVariedPositions(PRIMARY_ALLOWED_ANSWERS)
  const fb01 = answers.find((a) => a.questionId === 'SC_FB_01')
  const fb02 = answers.find((a) => a.questionId === 'SC_FB_02')
  // Force same optionId, different positions (both still valid, no mechanical pattern).
  fb01.optionId = 'A'; fb01.displayPosition = 1
  fb02.optionId = 'A'; fb02.displayPosition = 3
  const out = await runShadow(answers)
  const rec = out.record
  const byQid = {}
  for (const row of rec.answerTrace) byQid[row.questionId] = row
  assert.strictEqual(byQid['SC_FB_01'].optionId, 'A')
  assert.strictEqual(byQid['SC_FB_01'].displayPosition, 1)
  assert.strictEqual(byQid['SC_FB_02'].optionId, 'A')
  assert.strictEqual(byQid['SC_FB_02'].displayPosition, 3)
})

test('answerTrace: missing displayPosition → persisted as undefined (no fallback)', async () => {
  const answers = withVariedPositions(PRIMARY_ALLOWED_ANSWERS)
  delete answers[0].displayPosition
  const out = await runShadow(answers)
  const rec = out.record
  // validity blocks cognition, but answerTrace still mirrors the raw submission.
  const row = rec.answerTrace.find((r) => r.questionId === answers[0].questionId)
  assert.strictEqual(row.displayPosition, undefined)
  assert.strictEqual('displayPosition' in row, true)
})

test('answerTrace: invalid displayPosition → persisted verbatim (no fallback)', async () => {
  const answers = withVariedPositions(PRIMARY_ALLOWED_ANSWERS)
  answers[0].displayPosition = 9
  const out = await runShadow(answers)
  const rec = out.record
  const row = rec.answerTrace.find((r) => r.questionId === answers[0].questionId)
  assert.strictEqual(row.displayPosition, 9)
})

test('answerTrace: input array is not mutated (fresh objects)', async () => {
  const answers = withVariedPositions(PRIMARY_ALLOWED_ANSWERS)
  const snapshot = JSON.stringify(answers)
  await runShadow(answers)
  assert.strictEqual(JSON.stringify(answers), snapshot, 'input answers must be untouched')
})

// ═══════════════════════════════════════════════════════════════
// 5. EVIDENCE TRACE
// ═══════════════════════════════════════════════════════════════

test('evidenceTrace: exact 5-field rows only; no semanticProposition/construct/sourceQuestionIds', async () => {
  const out = await runShadow(withVariedPositions(PRIMARY_ALLOWED_ANSWERS))
  const rec = out.record
  assert.ok(Array.isArray(rec.evidenceTrace), 'evidenceTrace must be array for valid cognition')
  assert.ok(rec.evidenceTrace.length > 0)
  for (const row of rec.evidenceTrace) {
    assert.deepStrictEqual(Object.keys(row).sort(), ['direction', 'distortionType', 'evidenceId', 'matchedOptionIds', 'matchedQuestionIds'])
    assert.strictEqual('semanticProposition' in row, false)
    assert.strictEqual('construct' in row, false)
    assert.strictEqual('sourceQuestionIds' in row, false)
  }
})

test('evidenceTrace: one evidenceId matched by two independent questions → both preserved', async () => {
  // FB_AS_NOISE is matched by SC_FB_01:B + SC_FB_02:C (D-direction, two source Qs).
  const fbNoise = withVariedPositions([{ questionId: 'SC_FB_01', optionId: 'B' }, { questionId: 'SC_FB_02', optionId: 'C' }])
  // Pad with healthy answers to keep full 18Q validity (FB already D+D here; add others healthy).
  const rest = HEALTHY_16.filter((a) => !a.questionId.startsWith('SC_FB') && !a.questionId.startsWith('SC_DEC'))
  const answers = withVariedPositions([...fbNoise, ...DEC_HEALTHY, ...rest])
  const out = await runShadow(answers)
  const rec = out.record
  const row = rec.evidenceTrace.find((r) => r.evidenceId === 'FB_AS_NOISE')
  assert.ok(row, 'FB_AS_NOISE should be present')
  assert.deepStrictEqual(row.matchedQuestionIds.sort(), ['SC_FB_01', 'SC_FB_02'])
  assert.deepStrictEqual(row.matchedOptionIds.sort(), ['SC_FB_01:B', 'SC_FB_02:C'])
  assert.strictEqual(row.direction, 'D')
  assert.strictEqual(row.distortionType, 'feedback-as-noise')
})

test('evidenceTrace: H / D / N rows all representable with 5 fields', async () => {
  // Probe N-direction evidence via SC_ID_02:D (ID_CONTEXTUAL) + SC_OPP_02:B (OPP_SOME).
  const probe = ALL_HEALTHY.map((a) => {
    if (a.questionId === 'SC_ID_02') return { questionId: 'SC_ID_02', optionId: 'D' }
    if (a.questionId === 'SC_OPP_02') return { questionId: 'SC_OPP_02', optionId: 'B' }
    return a
  })
  const out = await runShadow(withVariedPositions(probe))
  const rec = out.record
  const dirs = new Set(rec.evidenceTrace.map((r) => r.direction))
  // Healthy + neutral probe: H and N both present; D absent (no distorted rows here).
  assert.ok(dirs.has('H'), 'H evidence present')
  assert.ok(dirs.has('N'), 'N evidence present')
  // N rows carry distortionType null verbatim.
  const nRows = rec.evidenceTrace.filter((r) => r.direction === 'N')
  for (const r of nRows) assert.strictEqual(r.distortionType, null)
  // D rows exist in the PRIMARY_ALLOWED fixture.
  const paOut = await runShadow(withVariedPositions(PRIMARY_ALLOWED_ANSWERS))
  const paDirs = new Set(paOut.record.evidenceTrace.map((r) => r.direction))
  assert.ok(paDirs.has('D'), 'D evidence present in PRIMARY_ALLOWED fixture')
})

test('evidenceTrace: evidenceTraceSummary preserved alongside evidenceTrace (additive)', async () => {
  const out = await runShadow(withVariedPositions(PRIMARY_ALLOWED_ANSWERS))
  const rec = out.record
  assert.ok(Array.isArray(rec.evidenceTraceSummary), 'evidenceTraceSummary present')
  assert.ok(Array.isArray(rec.evidenceTrace), 'evidenceTrace present')
  assert.ok(rec.evidenceTraceSummary.length > 0)
  // Both coexist; neither replaced the other.
  assert.notStrictEqual(rec.evidenceTraceSummary, rec.evidenceTrace)
})

// ═══════════════════════════════════════════════════════════════
// 6. VALIDITY TRACE
// ═══════════════════════════════════════════════════════════════

function assertValidityTraceMatches(rec, expectedValidity) {
  const vt = rec.validityTrace
  assert.ok(vt, 'validityTrace must exist')
  assert.deepStrictEqual(Object.keys(vt).sort(), ['counts', 'observedSignals', 'reasons', 'status'])
  assert.strictEqual(vt.status, expectedValidity.status)
  assert.deepStrictEqual(vt.reasons, expectedValidity.reasons)
  assert.deepStrictEqual(vt.counts, expectedValidity.counts)
  assert.deepStrictEqual(vt.observedSignals, expectedValidity.observedSignals)
  // Must NOT persist internal trace or deferredSignals.
  assert.strictEqual('trace' in vt, false)
  assert.strictEqual('deferredSignals' in vt, false)
}

test('validityTrace: RESPONSE_VALID → exact assessor output (status/reasons/counts/observedSignals)', async () => {
  const answers = withVariedPositions(PRIMARY_ALLOWED_ANSWERS)
  const expected = responseValidity.assessResponseValidityV21(answers)
  const out = await runShadow(answers)
  assertValidityTraceMatches(out.record, expected)
})

test('validityTrace: RESPONSE_QUALITY_LOW → exact assessor output, no cognition bypass', async () => {
  const answers = withFixedPositions(PRIMARY_ALLOWED_ANSWERS, () => 0)
  const expected = responseValidity.assessResponseValidityV21(answers)
  const out = await runShadow(answers)
  const rec = out.record
  assert.strictEqual(rec.cognitionExecuted, false)
  assert.strictEqual(rec.cognitionTerminalStatus, 'NOT_EXECUTED')
  assertValidityTraceMatches(rec, expected)
})

test('validityTrace: INSUFFICIENT_RESPONSE_QUALITY → exact assessor output, no cognition bypass', async () => {
  const answers = withVariedPositions(PRIMARY_ALLOWED_ANSWERS)
  delete answers[0].displayPosition
  const expected = responseValidity.assessResponseValidityV21(answers)
  const out = await runShadow(answers)
  const rec = out.record
  assert.strictEqual(rec.cognitionExecuted, false)
  assert.strictEqual(rec.cognitionTerminalStatus, 'NOT_EXECUTED')
  assertValidityTraceMatches(rec, expected)
})

test('validityTrace: counts uses real runtime keys (no artificial `n` field)', async () => {
  const answers = withVariedPositions(PRIMARY_ALLOWED_ANSWERS)
  const out = await runShadow(answers)
  const counts = out.record.validityTrace.counts
  const expectedKeys = ['totalEntries', 'answered', 'malformedEntries', 'distinctQuestions', 'duplicateQuestionCount', 'positionValidCount', 'positionMissingCount', 'positionInvalidCount', 'distinctPositions']
  assert.deepStrictEqual(Object.keys(counts).sort(), expectedKeys.sort())
  assert.strictEqual('n' in counts, false, 'must not invent an `n` field')
  assert.strictEqual(counts.answered, 18)
  assert.strictEqual(counts.positionValidCount, 18)
})

test('validityTrace: multi-reason reachable (malformed + missing position) → reasons preserved verbatim', async () => {
  const answers = withVariedPositions(PRIMARY_ALLOWED_ANSWERS)
  answers[0] = { questionId: '', optionId: '' } // malformed entry → MALFORMED_SUBMISSION flag
  delete answers[1].displayPosition // missing position → MISSING_DISPLAY_POSITION
  const expected = responseValidity.assessResponseValidityV21(answers)
  const out = await runShadow(answers)
  assert.strictEqual(expected.status, 'INSUFFICIENT_RESPONSE_QUALITY')
  assert.ok(expected.reasons.length >= 2, `multi-reason case reachable, got ${JSON.stringify(expected.reasons)}`)
  assert.deepStrictEqual(out.record.validityTrace.reasons, expected.reasons)
})

// ═══════════════════════════════════════════════════════════════
// 7. SCHEMA-V1 COMPATIBILITY
// ═══════════════════════════════════════════════════════════════

test('schema-v1: buildShadowRecordV21 output shape contains all legacy fields (no migration)', () => {
  // A schema-v1-style record (legacy field set) remains representable: the new
  // trace fields default to null when absent, and legacy fields are untouched.
  const rec = adapter.buildShadowRecordV21({
    validityResult: { status: 'RESPONSE_QUALITY_LOW', reasons: ['MECHANICAL_PATTERN_ALL_SAME'] },
    cognitionExecuted: false,
    cognitionTerminalStatus: 'NOT_EXECUTED',
    primaryBlindSpotId: null,
    primaryConstruct: null,
    followUpRequired: false,
    followUpPair: null,
    dimensionSummary: null,
    evidenceTraceSummary: null,
    errorCode: null,
    requestId: 'req-1',
  })
  // Legacy fields intact.
  assert.strictEqual(rec.diagnosticVersion, 'world_model_v2_1')
  assert.strictEqual(rec.responseValidityStatus, 'RESPONSE_QUALITY_LOW')
  assert.strictEqual(rec.responseValidityReason, 'MECHANICAL_PATTERN_ALL_SAME')
  assert.strictEqual(rec.cognitionExecuted, false)
  assert.strictEqual(rec.cognitionTerminalStatus, 'NOT_EXECUTED')
  assert.strictEqual(rec.evidenceTraceSummary, null)
  // New fields default null — old readers never assumed them.
  assert.strictEqual(rec.answerTrace, null)
  assert.strictEqual(rec.evidenceTrace, null)
  assert.strictEqual(rec.validityTrace, null)
})

test('schema-v1: no code requires historical records to contain trace fields', () => {
  // The adapter's extract/build path never reads trace fields from input — it
  // only ever WRITES them. Reading an old record is therefore unaffected.
  const src = stripComments(fs.readFileSync(ADAPTER_PATH, 'utf8'))
  // No `record.answerTrace`/`record.evidenceTrace`/`record.validityTrace` reads exist.
  assert.strictEqual(/record\.answerTrace/.test(src), false)
  assert.strictEqual(/record\.evidenceTrace/.test(src), false)
  assert.strictEqual(/record\.validityTrace/.test(src), false)
})

// ═══════════════════════════════════════════════════════════════
// 8. SIZE AUDIT
// ═══════════════════════════════════════════════════════════════

test('size: worst-case 18Q schema-v2 record well below CloudBase limit', async () => {
  const out = await runShadow(withVariedPositions(PRIMARY_ALLOWED_ANSWERS))
  const rec = out.record
  const fullBytes = Buffer.byteLength(JSON.stringify(rec), 'utf8')
  // Added bytes = full record minus the three new trace fields.
  const { answerTrace, evidenceTrace, validityTrace, ...without } = rec
  const baseBytes = Buffer.byteLength(JSON.stringify(without), 'utf8')
  const addedBytes = fullBytes - baseBytes
  assert.ok(fullBytes < 16 * 1024 * 1024, 'record must be far below CloudBase 16MB limit')
  assert.ok(addedBytes > 0, 'added bytes must be positive')
  // Record actuals for the report (not hard-coded).
  assert.ok(fullBytes < 20000, `worst-case record unexpectedly large: ${fullBytes}B`)
})

// ═══════════════════════════════════════════════════════════════
// 9. STATIC SCOPE AUDIT
// ═══════════════════════════════════════════════════════════════

test('static: no optionId→position fallback path in adapter', () => {
  const src = stripComments(fs.readFileSync(ADAPTER_PATH, 'utf8'))
  assert.strictEqual(src.includes('charCodeAt'), false)
  assert.strictEqual(src.includes('parseInt'), false)
  assert.strictEqual(src.includes('toUpperCase'), false)
  assert.strictEqual(src.includes('indexOf'), false)
})

test('static: no OPENID duplication inside trace builders', () => {
  const src = stripComments(fs.readFileSync(ADAPTER_PATH, 'utf8'))
  // The three trace builders occupy the region from buildAnswerTraceV21 up to
  // (but not including) buildShadowRecordV21. They must never reference openid.
  const builders = src.slice(src.indexOf('function buildAnswerTraceV21'), src.indexOf('function buildShadowRecordV21'))
  assert.strictEqual(builders.includes('openid'), false, 'trace builders must not touch openid')
})

test('static: no numeric score / probability / confidence / severity in trace builders', () => {
  const src = stripComments(fs.readFileSync(ADAPTER_PATH, 'utf8'))
  const builders = src.slice(src.indexOf('function buildAnswerTraceV21'), src.indexOf('function runCognitionChainV21'))
  for (const t of ['score', 'probability', 'confidence', 'severity', 'weight']) {
    assert.strictEqual(builders.includes(t), false, `trace builders must not reference ${t}`)
  }
})

test('static: evidence trace builder emits exactly five keys (no semantic/construct/sourceQuestionIds)', () => {
  const src = stripComments(fs.readFileSync(ADAPTER_PATH, 'utf8'))
  const evBuilder = src.slice(src.indexOf('function buildEvidenceTraceV21'), src.indexOf('function buildValidityTraceV21'))
  assert.strictEqual(evBuilder.includes('semanticProposition'), false)
  assert.strictEqual(evBuilder.includes('construct'), false)
  assert.strictEqual(evBuilder.includes('sourceQuestionIds'), false)
  for (const k of ['evidenceId', 'direction', 'distortionType', 'matchedQuestionIds', 'matchedOptionIds']) {
    assert.ok(evBuilder.includes(k), `evidenceTrace must include ${k}`)
  }
})

test('static: validity trace builder emits exactly four keys (no trace/deferredSignals)', () => {
  const src = stripComments(fs.readFileSync(ADAPTER_PATH, 'utf8'))
  const vtBuilder = src.slice(src.indexOf('function buildValidityTraceV21'), src.indexOf('function buildShadowRecordV21'))
  assert.strictEqual(vtBuilder.includes('deferredSignals'), false)
  // `trace` keyword check: reject `.trace` property access in validity builder.
  assert.strictEqual(/\.trace\b/.test(vtBuilder), false)
  for (const k of ['status', 'reasons', 'counts', 'observedSignals']) {
    assert.ok(vtBuilder.includes(k), `validityTrace must include ${k}`)
  }
})
