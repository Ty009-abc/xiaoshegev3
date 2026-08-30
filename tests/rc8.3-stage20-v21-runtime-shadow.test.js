/**
 * RC8.3 Stage20 R1 — V2.1 Runtime Shadow Acceptance Tests
 *
 * Validates the Stage20-R0 runtime shadow integration:
 *   - control plane (OFF | SHADOW, fail-closed OFF, no PRIMARY/allowlist)
 *   - response-validity gate (only RESPONSE_VALID executes cognition)
 *   - canonical cognition chain orchestration (no duplicated inference)
 *   - FOLLOW_UP_REQUIRED shadow-only (no UI / synthetic answer / A5B2 resolution)
 *   - failure boundary (validity / cognition / persistence exceptions never
 *     block production response — fail-open)
 *   - record namespace isolation (diagnostic_world_model_v2_1_shadow)
 *   - user-visible / legacy-wealth / old-V2 isolation
 *
 * Authority:
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

const mode = require('../cloudfunctions/generateAiReport/lib/config/worldModelV21Mode.js')
const adapter = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const cognition = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/index.js')

const ROOT = path.join(__dirname, '..')
const MODE_PATH = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/config/worldModelV21Mode.js')
const ADAPTER_PATH = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const INDEX_PATH = path.join(ROOT, 'cloudfunctions/generateAiReport/index.js')

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function readSrc(p) { return fs.readFileSync(p, 'utf8') }

// Isolate the world_model_v2_1 dispatch block in index.js (comment-stripped
// source): from the dispatch guard up to the next `buildDiagnosticPrompt`
// require (which starts the untouched V3 legacy chain). Bounded so unrelated
// later V2/V4 code cannot leak into the audit slice.
function v21DispatchBlock(idx) {
  const start = idx.indexOf("diagnosticVersion === 'world_model_v2_1'")
  const end = idx.indexOf('buildDiagnosticPrompt', start)
  return idx.slice(start, end < 0 ? idx.length : end)
}

// ── Frozen D+D answer pairs per construct (from A5A fixtures) ─────────────
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

// All-healthy set (H+H per construct → COUNTERSUPPORTED × 9) — DECISION healthy.
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

// PRIMARY_ALLOWED payload: DECISION D+D (eligible), everything else healthy.
const PRIMARY_ALLOWED_ANSWERS = [...DD.DECISION, ...HEALTHY_16]

// FOLLOW_UP_REQUIRED payload: RISK D+D + TIME D+D (two eligible, relevant pair).
const FOLLOWUP_ANSWERS = [...DD.RISK, ...DD.TIME]

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
      return {
        async add(payload) { calls.push(payload) },
      }
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

// ═══════════════════════════════════════════════════════════════
// 1. CONTROL PLANE — OFF | SHADOW, fail-closed, no PRIMARY/allowlist
// ═══════════════════════════════════════════════════════════════

test('mode: env + allowed/default constants frozen', () => {
  assert.strictEqual(mode.V21_MODE_ENV, 'RC83_WORLD_MODEL_V2_1_MODE')
  assert.deepStrictEqual(mode.V21_ALLOWED_MODES, ['OFF', 'SHADOW'])
  assert.strictEqual(mode.V21_DEFAULT_MODE, 'OFF')
})

test('mode: SHADOW parses to SHADOW', () => {
  assert.strictEqual(mode.parseV21Mode('SHADOW'), 'SHADOW')
  assert.strictEqual(mode.parseV21Mode(' shadow '), 'SHADOW')
})

test('mode: OFF parses to OFF', () => {
  assert.strictEqual(mode.parseV21Mode('OFF'), 'OFF')
})

test('mode: invalid mode → OFF (fail-closed)', () => {
  assert.strictEqual(mode.parseV21Mode('GARBAGE'), 'OFF')
  assert.strictEqual(mode.parseV21Mode('123'), 'OFF')
})

test('mode: forbidden PRIMARY / SELECTIVE_PRIMARY / allowlist → OFF', () => {
  assert.strictEqual(mode.parseV21Mode('PRIMARY'), 'OFF')
  assert.strictEqual(mode.parseV21Mode('SELECTIVE_PRIMARY'), 'OFF')
  assert.strictEqual(mode.parseV21Mode('selective_primary'), 'OFF')
})

test('mode: missing / non-string → OFF', () => {
  assert.strictEqual(mode.parseV21Mode(undefined), 'OFF')
  assert.strictEqual(mode.parseV21Mode(null), 'OFF')
  assert.strictEqual(mode.parseV21Mode(''), 'OFF')
  assert.strictEqual(mode.parseV21Mode(42), 'OFF')
})

test('mode: getV21ModeFromEnv defaults OFF when env unset', () => {
  const key = 'RC83_WORLD_MODEL_V2_1_MODE'
  const had = Object.prototype.hasOwnProperty.call(process.env, key)
  const saved = process.env[key]
  try {
    delete process.env[key]
    assert.strictEqual(mode.getV21ModeFromEnv(), 'OFF')
  } finally {
    if (had) process.env[key] = saved
    else delete process.env[key]
  }
})

test('mode: static — no PRIMARY / allowlist / old-V2 tokens in V21 mode parser', () => {
  const src = stripComments(readSrc(MODE_PATH))
  assert.strictEqual(src.includes('PRIMARY'), false, 'no PRIMARY routing token')
  assert.strictEqual(src.includes('ALLOWLIST'), false, 'no allowlist token')
  assert.strictEqual(src.includes('allowlist'), false)
  assert.strictEqual(src.includes('RC83_WORLD_MODEL_V2_MODE'), false, 'no old-V2 mode coupling')
  assert.strictEqual(src.includes('RC83_WORLD_MODEL_V2_ALLOWLIST'), false, 'no old-V2 allowlist coupling')
  assert.strictEqual(src.includes('worldModelV2Mode'), false)
})

// ═══════════════════════════════════════════════════════════════
// 2. RESPONSE EXTRACTION
// ═══════════════════════════════════════════════════════════════

test('extractResponsesV21: array payload', () => {
  const arr = [{ questionId: 'SC_DEC_01', optionId: 'A', displayPosition: 0 }]
  assert.deepStrictEqual(adapter.extractResponsesV21(arr), arr)
})

test('extractResponsesV21: object payload { responses } / { answers } / null', () => {
  const r = [{ questionId: 'SC_DEC_01', optionId: 'A' }]
  assert.deepStrictEqual(adapter.extractResponsesV21({ responses: r }), r)
  assert.deepStrictEqual(adapter.extractResponsesV21({ answers: r }), r)
  assert.deepStrictEqual(adapter.extractResponsesV21(undefined), [])
  assert.deepStrictEqual(adapter.extractResponsesV21(null), [])
})

// ═══════════════════════════════════════════════════════════════
// 3. BLOCKED-VALIDITY RECORD SEMANTICS
// ═══════════════════════════════════════════════════════════════

test('buildShadowRecordV21: blocked validity → exact null/omission semantics', () => {
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
  assert.strictEqual(rec.responseValidityStatus, 'RESPONSE_QUALITY_LOW')
  assert.strictEqual(rec.responseValidityReason, 'MECHANICAL_PATTERN_ALL_SAME')
  assert.strictEqual(rec.cognitionExecuted, false)
  assert.strictEqual(rec.cognitionTerminalStatus, 'NOT_EXECUTED')
  assert.strictEqual(rec.primaryBlindSpotId, null)
  assert.strictEqual(rec.primaryConstruct, null)
  assert.strictEqual(rec.dimensionSummary, null)
  assert.strictEqual(rec.followUpRequired, false)
  assert.strictEqual(rec.followUpPair, null)
  assert.strictEqual(rec.schemaVersion, '2')
  assert.strictEqual(rec.diagnosticVersion, 'world_model_v2_1')
})

// ═══════════════════════════════════════════════════════════════
// 4. SHADOW + VALID → cognition executes (PRIMARY_ALLOWED)
// ═══════════════════════════════════════════════════════════════

test('SHADOW + valid → RESPONSE_VALID, cognition executes, PRIMARY_ALLOWED', async () => {
  const db = makeMockDb()
  const out = await runShadow(withVariedPositions(PRIMARY_ALLOWED_ANSWERS), db)
  const rec = out.record
  assert.strictEqual(rec.responseValidityStatus, 'RESPONSE_VALID')
  assert.strictEqual(rec.cognitionExecuted, true)
  assert.strictEqual(rec.cognitionTerminalStatus, 'PRIMARY_ALLOWED')
  assert.strictEqual(rec.primaryBlindSpotId, 'DECISION_INERTIA')
  assert.strictEqual(rec.primaryConstruct, 'DECISION')
  assert.strictEqual(rec.followUpRequired, false)
  assert.strictEqual(out.userVisible, false)
  // persistence wrote to the V2.1 shadow namespace
  assert.strictEqual(db._calls.length, 1)
  assert.strictEqual(db._calls[0].data.type, 'diagnostic_world_model_v2_1_shadow')
  assert.strictEqual(db._calls[0].data.recordType, 'diagnostic_world_model_v2_1_shadow')
  assert.strictEqual(db._calls[0].data.shadowWorldModelV21.cognitionTerminalStatus, 'PRIMARY_ALLOWED')
})

// ═══════════════════════════════════════════════════════════════
// 5. SHADOW + mechanical / structural → cognition blocked
// ═══════════════════════════════════════════════════════════════

function assertBlocked(status) {
  return async function () {
    const db = makeMockDb()
    const out = await runShadow(status.answers, db)
    const rec = out.record
    assert.strictEqual(rec.responseValidityStatus, status.validity)
    assert.strictEqual(rec.cognitionExecuted, false)
    assert.strictEqual(rec.cognitionTerminalStatus, 'NOT_EXECUTED')
    assert.strictEqual(rec.primaryBlindSpotId, null)
    assert.strictEqual(rec.primaryConstruct, null)
    assert.strictEqual(rec.dimensionSummary, null)
    assert.strictEqual(rec.followUpRequired, false)
    assert.strictEqual(rec.followUpPair, null)
    assert.strictEqual(out.userVisible, false)
    // still persists the blocked validity result (observability)
    assert.strictEqual(db._calls.length, 1)
    assert.strictEqual(db._calls[0].data.shadowWorldModelV21.responseValidityStatus, status.validity)
  }
}

test('SHADOW + all-same position → RESPONSE_QUALITY_LOW, no cognition',
  assertBlocked({ validity: 'RESPONSE_QUALITY_LOW', answers: withFixedPositions(PRIMARY_ALLOWED_ANSWERS, () => 0) }))

test('SHADOW + alternating → RESPONSE_QUALITY_LOW, no cognition',
  assertBlocked({ validity: 'RESPONSE_QUALITY_LOW', answers: withFixedPositions(PRIMARY_ALLOWED_ANSWERS, (i) => i % 2) }))

test('SHADOW + sequential → RESPONSE_QUALITY_LOW, no cognition',
  assertBlocked({ validity: 'RESPONSE_QUALITY_LOW', answers: withFixedPositions(PRIMARY_ALLOWED_ANSWERS, (i) => i % 4) }))

test('SHADOW + missing displayPosition → INSUFFICIENT_RESPONSE_QUALITY, no cognition', () => {
  const answers = withVariedPositions(PRIMARY_ALLOWED_ANSWERS)
  delete answers[0].displayPosition
  return assertBlocked({ validity: 'INSUFFICIENT_RESPONSE_QUALITY', answers })()
})

test('SHADOW + invalid displayPosition → INSUFFICIENT_RESPONSE_QUALITY, no cognition', () => {
  const answers = withVariedPositions(PRIMARY_ALLOWED_ANSWERS)
  answers[0].displayPosition = 9
  return assertBlocked({ validity: 'INSUFFICIENT_RESPONSE_QUALITY', answers })()
})

test('SHADOW + duplicate questionId → INSUFFICIENT_RESPONSE_QUALITY, no cognition', () => {
  const answers = withVariedPositions(PRIMARY_ALLOWED_ANSWERS)
  answers[1].questionId = answers[0].questionId // SC_DEC_02 → SC_DEC_01 (duplicate)
  return assertBlocked({ validity: 'INSUFFICIENT_RESPONSE_QUALITY', answers })()
})

test('SHADOW + sparse (n<4) → INSUFFICIENT_RESPONSE_QUALITY, no cognition', () => {
  const answers = withVariedPositions([...DD.DECISION, { questionId: 'SC_DEC_02', optionId: 'C' }])
  return assertBlocked({ validity: 'INSUFFICIENT_RESPONSE_QUALITY', answers })()
})

// ═══════════════════════════════════════════════════════════════
// 6. SHADOW + FOLLOW_UP_REQUIRED → shadow-only (no synthetic answer)
// ═══════════════════════════════════════════════════════════════

test('SHADOW + FOLLOW_UP_REQUIRED → record only, no UI, no synthetic follow-up', async () => {
  const db = makeMockDb()
  const out = await runShadow(withVariedPositions(FOLLOWUP_ANSWERS), db)
  const rec = out.record
  assert.strictEqual(rec.responseValidityStatus, 'RESPONSE_VALID')
  assert.strictEqual(rec.cognitionExecuted, true)
  assert.strictEqual(rec.cognitionTerminalStatus, 'FOLLOW_UP_REQUIRED')
  assert.strictEqual(rec.followUpRequired, true)
  assert.deepStrictEqual(rec.followUpPair, ['RISK', 'TIME'])
  // No primary resolved without a real follow-up answer.
  assert.strictEqual(rec.primaryBlindSpotId, null)
  assert.strictEqual(rec.primaryConstruct, null)
  // No synthetic follow-up answer / no A5B2 resolution fields.
  assert.strictEqual('selectedOptionId' in rec, false)
  assert.strictEqual(out.userVisible, false)
})

// ═══════════════════════════════════════════════════════════════
// 7. FAILURE BOUNDARY — exceptions never block production
// ═══════════════════════════════════════════════════════════════

test('validity exception → isolated, record errorCode, no throw, no cognition', async () => {
  const orig = responseValidity.assessResponseValidityV21
  responseValidity.assessResponseValidityV21 = () => { throw new Error('validity-boom') }
  try {
    const db = makeMockDb()
    const out = await runShadow(withVariedPositions(PRIMARY_ALLOWED_ANSWERS), db)
    const rec = out.record
    assert.strictEqual(rec.errorCode, 'VALIDITY_EXCEPTION')
    assert.strictEqual(rec.responseValidityStatus, null)
    assert.strictEqual(rec.cognitionExecuted, false)
    assert.strictEqual(rec.cognitionTerminalStatus, 'NOT_EXECUTED')
    assert.strictEqual(out.userVisible, false)
  } finally {
    responseValidity.assessResponseValidityV21 = orig
  }
})

test('cognition exception → isolated, record errorCode, no throw', async () => {
  const orig = cognition.normalizeEvidenceV21
  cognition.normalizeEvidenceV21 = () => { throw new Error('cognition-boom') }
  try {
    const db = makeMockDb()
    const out = await runShadow(withVariedPositions(PRIMARY_ALLOWED_ANSWERS), db)
    const rec = out.record
    assert.strictEqual(rec.responseValidityStatus, 'RESPONSE_VALID')
    assert.strictEqual(rec.errorCode, 'COGNITION_EXCEPTION')
    assert.strictEqual(rec.cognitionExecuted, false)
    assert.strictEqual(rec.cognitionTerminalStatus, 'NOT_EXECUTED')
    assert.strictEqual(rec.primaryBlindSpotId, null)
    assert.strictEqual(rec.dimensionSummary, null)
    assert.strictEqual(out.userVisible, false)
  } finally {
    cognition.normalizeEvidenceV21 = orig
  }
})

test('persistence exception → isolated, record still returned, no throw', async () => {
  const db = {
    collection() {
      return { async add() { throw new Error('db-down') } }
    },
  }
  const out = await runShadow(withVariedPositions(PRIMARY_ALLOWED_ANSWERS), db)
  const rec = out.record
  // cognition still completed; only persistence failed (silently logged).
  assert.strictEqual(rec.cognitionExecuted, true)
  assert.strictEqual(rec.cognitionTerminalStatus, 'PRIMARY_ALLOWED')
  assert.strictEqual(out.userVisible, false)
})

// ═══════════════════════════════════════════════════════════════
// 8. USER-VISIBLE / LEGACY-WEALTH ISOLATION
// ═══════════════════════════════════════════════════════════════

test('record output contains no invented score / probability / wealth fields', async () => {
  const out = await runShadow(withVariedPositions(PRIMARY_ALLOWED_ANSWERS))
  const json = JSON.stringify(out.record)
  for (const banned of ['wealthProbability', 'wealthPath', 'scoreCard', 'cashflow', 'destinySimulator', 'probability', 'confidence', 'severity', 'renderSource']) {
    assert.ok(!json.includes(banned), `record must not include "${banned}"`)
  }
})

// ═══════════════════════════════════════════════════════════════
// 9. STATIC AUDITS — forbidden paths all zero
// ═══════════════════════════════════════════════════════════════

test('static: V21_PRIMARY_ROUTING_PATHS = 0', () => {
  const idx = stripComments(readSrc(INDEX_PATH))
  assert.strictEqual(idx.includes('runWorldModelV21Primary'), false, 'no V2.1 primary routing')
  const modeSrc = stripComments(readSrc(MODE_PATH))
  assert.strictEqual(/function parseV21Mode\b/.test(modeSrc), true, 'mode parser exists (fail-closed)')
})

test('static: V21_ALLOWLIST_PATHS = 0', () => {
  const idx = stripComments(readSrc(INDEX_PATH))
  const v21Block = v21DispatchBlock(idx)
  assert.strictEqual(v21Block.includes('worldModelWhitelist'), false)
  assert.strictEqual(v21Block.includes('Allowlist'), false)
  assert.strictEqual(v21Block.includes('allowlist'), false)
})

test('static: V21_RENDER_SOURCE_PATHS = 0 (adapter never sets renderSource)', () => {
  const adapterSrc = stripComments(readSrc(ADAPTER_PATH))
  assert.strictEqual(adapterSrc.includes('renderSource'), false)
})

test('static: V21_LEGACY_WEALTH_PATHS = 0 (adapter never emits wealth)', () => {
  const adapterSrc = stripComments(readSrc(ADAPTER_PATH))
  for (const t of ['wealthProbability', 'wealthPath', 'scoreCard', 'cashflow', 'destinySimulator']) {
    assert.strictEqual(adapterSrc.includes(t), false, `adapter must not reference ${t}`)
  }
})

test('static: V2_MODE_TO_V21_EXECUTION_PATHS = 0 (no old-V2 mode drives V2.1)', () => {
  const idx = stripComments(readSrc(INDEX_PATH))
  const v21Block = v21DispatchBlock(idx)
  assert.strictEqual(v21Block.includes('parseV2Mode'), false)
  assert.strictEqual(v21Block.includes('worldModelV2Mode'), false)
  assert.strictEqual(v21Block.includes('RC83_WORLD_MODEL_V2_MODE'), false)
})

test('static: V21_MODE_TO_V2_PRIMARY_PATHS = 0 (V2.1 never calls V2 primary/shadow)', () => {
  const idx = stripComments(readSrc(INDEX_PATH))
  const v21Block = v21DispatchBlock(idx)
  assert.strictEqual(v21Block.includes('runWorldModelV2Primary'), false)
  assert.strictEqual(v21Block.includes('runWorldModelV2Shadow'), false)
})

test('static: OPTION_ID_TO_POSITION_FALLBACK_PATHS = 0 (adapter never maps optionId→position)', () => {
  const adapterSrc = stripComments(readSrc(ADAPTER_PATH))
  assert.strictEqual(adapterSrc.includes('charCodeAt'), false)
  assert.strictEqual(adapterSrc.includes('toUpperCase'), false)
  assert.strictEqual(adapterSrc.includes('parseInt'), false)
})

test('static: SYNTHETIC_FOLLOWUP_PATHS = 0 (adapter never resolves follow-up)', () => {
  const adapterSrc = stripComments(readSrc(ADAPTER_PATH))
  assert.strictEqual(adapterSrc.includes('followUpDiscriminatorV21'), false)
  assert.strictEqual(adapterSrc.includes('followUpBankV21'), false)
  assert.strictEqual(adapterSrc.includes('resolveFollowUpV21'), false)
})

test('static: index.js V2.1 dispatch is OFF-default / SHADOW-gated, never primary', () => {
  const idx = stripComments(readSrc(INDEX_PATH))
  const v21Block = v21DispatchBlock(idx)
  assert.strictEqual(v21Block.includes("parseV21Mode(getV21ModeFromEnv())"), true)
  assert.strictEqual(v21Block.includes("if (v21Mode === 'SHADOW')"), true)
  assert.strictEqual(v21Block.includes('runWorldModelV21Off()'), true)
  assert.strictEqual(v21Block.includes('runWorldModelV21Shadow'), true)
})

// ═══════════════════════════════════════════════════════════════
// 10. RECORD NAMESPACE — no collision with V1/V2
// ═══════════════════════════════════════════════════════════════

test('record namespace frozen as diagnostic_world_model_v2_1_shadow', () => {
  assert.strictEqual(adapter.V21_SHADOW_RECORD_NAMESPACE, 'diagnostic_world_model_v2_1_shadow')
  assert.strictEqual(adapter.V21_DIAGNOSTIC_VERSION, 'world_model_v2_1')
  const colliding = [
    'world_model_v1',
    'world_model_v2',
    'diagnostic_world_model_v1',
    'diagnostic_world_model_v2',
    'diagnostic_world_model_v2_shadow',
    'diagnostic_v4',
  ]
  assert.strictEqual(colliding.includes(adapter.V21_SHADOW_RECORD_NAMESPACE), false)
})
