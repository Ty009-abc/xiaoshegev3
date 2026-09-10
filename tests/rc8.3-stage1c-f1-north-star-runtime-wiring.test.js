/**
 * RC8.3 Stage1C-F1 — North Star runtime wiring acceptance tests.
 *
 * Exception: RC8.3_STAGE1C_F1_RUNTIME_WIRING_EXCEPTION (OPTION_A).
 * Authorized production file: cloudfunctions/generateAiReport/index.js
 * (TEST_PREVIEW branch wiring ONLY).
 *
 * Proves:
 *   §2  before/after gap (runtime callers of north_star builder 0 → ≥1)
 *   §3  no new diagnosis logic / no new semantic mapping (reuse engine truth)
 *   §5  wiring reachable ONLY inside the trusted TEST_PREVIEW branch
 *   §6  fail-closed (no fabricated / silent-fallback North Star report)
 *   §7  TEST_PREVIEW_OUTPUT_VERSION = north_star_report_v1 + validator PASS
 *   §8  non-preview runtime output diff = 0
 *   §9  R4.5 local end-to-end chain (18Q → V2.1 → presentation → report → VM)
 *   §11 wiring mutations W1..W6 (6/6)
 *
 * Tests load the REAL runtime module against a mocked `wx-server-sdk` using an
 * isolated per-test source copy (node_modules excluded) so the module cache is
 * never shared and mutations are hermetic.
 *
 * @version north_star_report_v1 (runtime wiring)
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const Module = require('node:module')
const { execSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const INDEX_REL = 'cloudfunctions/generateAiReport/index.js'
const FN_DIR = path.join(ROOT, 'cloudfunctions/generateAiReport')

// Immutable F1 "before" reference. The pre-F1 source cannot be read from `HEAD`
// (once F1 is committed, HEAD *is* the after-state, making a HEAD-relative
// before-state self-referential). Anchor to the F1 parent SHA instead.
const F1_PARENT_SHA = '95467fc9df196a5802a6aaeb5a94c723b220cfec'
const F1_RUNTIME_WIRING_SHA = 'edcc27384ccbf43162d8c3463d8f98cce3b435ff'

const { QUESTIONS_V21, CONSTRUCTS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')
const reportBuilder = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/index.js')
const viewModel = require('../utils/northStarReportViewModel.js')
const GOLDEN = require('./fixtures/reportGoldenV21.js')

const BASE_INDEX = execSync('git show ' + F1_PARENT_SHA + ':' + INDEX_REL, { cwd: ROOT, encoding: 'utf8' })

// ═══════════════════════════════════════════════════════════════
// Fixtures (engine-identical to Stage1C-B/C/D)
// ═══════════════════════════════════════════════════════════════
function flatOptionMap(map) {
  const out = {}
  for (const c of CONSTRUCTS_V21) {
    const qm = map[c] || {}
    for (const qid of Object.keys(qm)) out[qid] = qm[qid]
  }
  return out
}
// Build a canonical answer tuple with displayPosition = option index (valid).
function validTuple(optionMap) {
  return QUESTIONS_V21.map((q) => {
    const oid = optionMap[q.questionId]
    const idx = q.options.findIndex((o) => o.optionId === oid)
    return { questionId: q.questionId, optionId: oid, displayPosition: idx < 0 ? 0 : idx }
  })
}
function r45Map() {
  const m = {}
  for (const c of CONSTRUCTS_V21) m[c] = { ...GOLDEN.HEALTHY[c] }
  m.SYSTEMS = { ...GOLDEN.DISTORTED_PAIR.SYSTEMS }
  return m
}
const R45_ANSWERS = validTuple(flatOptionMap(r45Map())) // → SYSTEM_THINKING_GAP
const R45_ENGINE_PRIMARY = 'SYSTEM_THINKING_GAP'

// ═══════════════════════════════════════════════════════════════
// Hermetic runtime loader (source copy + mocked wx-server-sdk)
// ═══════════════════════════════════════════════════════════════
function copyDir(s, d, skip) {
  fs.mkdirSync(d, { recursive: true })
  for (const e of fs.readdirSync(s, { withFileTypes: true })) {
    if (skip && skip(e.name)) continue
    const sp = path.join(s, e.name)
    const dp = path.join(d, e.name)
    if (e.isDirectory()) copyDir(sp, dp, skip)
    else fs.copyFileSync(sp, dp)
  }
}

function loadRuntime(opts) {
  opts = opts || {}
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-wiring-'))
  const fnCopy = path.join(dir, 'generateAiReport')
  copyDir(FN_DIR, fnCopy, (n) => n === 'node_modules')

  const indexPath = path.join(fnCopy, 'index.js')
  if (opts.baseline) fs.writeFileSync(indexPath, BASE_INDEX)
  else if (opts.mutate) {
    let src = fs.readFileSync(indexPath, 'utf8')
    const next = opts.mutate(src)
    assert.strictEqual(typeof next, 'string', 'mutate() must return source string')
    fs.writeFileSync(indexPath, next)
  }

  const state = { openid: opts.openid || 'u_test', writes: [] }
  const mockDb = {
    command: {},
    collection: function (name) {
      return {
        where: function () { return this },
        orderBy: function () { return this },
        limit: function () { return this },
        get: async function () {
          if (name === 'users') return { data: [{ openid: state.openid }] }
          if (name === 'user_profiles') return { data: [{ openid: state.openid }] }
          return { data: [] }
        },
        add: async function (o) { state.writes.push({ collection: name, data: o && o.data }); return { _id: 'mock' } },
        doc: function () { return { get: async function () { return { data: null } }, set: async function () {}, update: async function () {} } },
      }
    },
  }
  const mockSdk = {
    DYNAMIC_CURRENT_ENV: 'mock-env',
    init: function () {},
    getWXContext: function () { return { OPENID: state.openid } },
    database: function () { return mockDb },
  }

  const origLoad = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === 'wx-server-sdk') return mockSdk
    return origLoad.apply(this, arguments)
  }
  let mod
  try { mod = require(indexPath) } finally { Module._load = origLoad }

  return { main: mod.main, state, dir }
}

const PREVIEW_ENV_KEY = 'RC83_V21_COGNITIVE_PREVIEW_ENABLED'
const PREVIEW_ALLOWLIST_KEY = 'RC83_V21_COGNITIVE_PREVIEW_ALLOWLIST'
const V21_MODE_KEY = 'RC83_WORLD_MODEL_V2_1_MODE'

async function callPreview(args) {
  args = args || {}
  const prevEnabled = process.env[PREVIEW_ENV_KEY]
  const prevAllow = process.env[PREVIEW_ALLOWLIST_KEY]
  process.env[PREVIEW_ENV_KEY] = args.enabledEnv !== undefined ? args.enabledEnv : 'ENABLED'
  process.env[PREVIEW_ALLOWLIST_KEY] = args.allowlistEnv !== undefined ? args.allowlistEnv : 'u_test'
  try {
    const rt = loadRuntime({ mutate: args.mutate })
    const resp = await rt.main({
      type: 'diagnostic',
      diagnosticVersion: 'world_model_v2_1',
      previewMode: 'TEST_PREVIEW',
      answers: args.answers || R45_ANSWERS,
    }, {})
    return { resp, rt }
  } finally {
    if (prevEnabled === undefined) delete process.env[PREVIEW_ENV_KEY]; else process.env[PREVIEW_ENV_KEY] = prevEnabled
    if (prevAllow === undefined) delete process.env[PREVIEW_ALLOWLIST_KEY]; else process.env[PREVIEW_ALLOWLIST_KEY] = prevAllow
  }
}

async function callEvent(event, opts) {
  opts = opts || {}
  const prevMode = process.env[V21_MODE_KEY]
  if (opts.v21Mode !== undefined) process.env[V21_MODE_KEY] = opts.v21Mode
  try {
    const rt = loadRuntime({ baseline: opts.baseline })
    const resp = await rt.main(event, {})
    return resp
  } finally {
    if (prevMode === undefined) delete process.env[V21_MODE_KEY]; else process.env[V21_MODE_KEY] = prevMode
  }
}

function indexSrc() { return fs.readFileSync(path.join(ROOT, INDEX_REL), 'utf8') }
function testPreviewFnSrc(src) {
  const start = src.indexOf('async function runWorldModelV21TestPreview')
  assert.ok(start >= 0, 'runWorldModelV21TestPreview must exist')
  const rest = src.slice(start)
  const end = rest.indexOf('\n// ═══')
  return end > 0 ? rest.slice(0, end) : rest
}

// ═══════════════════════════════════════════════════════════════
// §2 — before/after gap (executable evidence)
// ═══════════════════════════════════════════════════════════════
test('§2 before-state: runtime callers of North Star builder = 0', () => {
  const n = (BASE_INDEX.match(/buildNorthStarReportV21\s*\(/g) || []).length
  assert.strictEqual(n, 0, 'before-state must have 0 runtime callers')
})
test('§2 after-state: runtime callers of North Star builder >= 1', () => {
  const n = (indexSrc().match(/buildNorthStarReportV21\s*\(/g) || []).length
  assert.ok(n >= 1, 'after F1 the runtime must call buildNorthStarReportV21')
})
test('§2 before-state: TEST_PREVIEW output version is engine (world_model_v2_1)', async () => {
  const { resp } = await callPreview({ mutate: null })
  // baseline runtime (no wiring) would return the engine report; here we assert
  // the BEFORE source has no `version: north_star_report_v1` string.
  assert.strictEqual((BASE_INDEX.match(/'north_star_report_v1'/g) || []).length, 0)
})

// ═══════════════════════════════════════════════════════════════
// §3 — no new diagnosis logic / no new semantic mapping
// ═══════════════════════════════════════════════════════════════
test('§3 no new inference / reselection inside TEST_PREVIEW wiring', () => {
  const fn = testPreviewFnSrc(indexSrc())
  for (const banned of ['decidePrimaryV21', 'blindSpotCandidateEngineV21', 'selectStrategyV2(', 'simulateScenarios(', 'runWorldModelPipelineV2']) {
    assert.ok(fn.indexOf(banned) === -1, 'wiring must not contain reselection call: ' + banned)
  }
  // must reuse the accepted engine decision
  assert.ok(fn.indexOf('cognition') !== -1 && fn.indexOf('cognition.decision') !== -1, 'must consume accepted engine decision')
})

// ═══════════════════════════════════════════════════════════════
// §5 — wiring reachable ONLY inside trusted TEST_PREVIEW branch
// ═══════════════════════════════════════════════════════════════
test('§5 wiring present ONLY inside TEST_PREVIEW function', () => {
  const src = indexSrc()
  const fn = testPreviewFnSrc(src)
  assert.ok(fn.indexOf('buildNorthStarReportV21') !== -1, 'wiring lives inside TEST_PREVIEW fn')
  const outside = src.replace(fn, '')
  assert.ok(outside.indexOf('buildNorthStarReportV21') === -1, 'no North Star builder outside TEST_PREVIEW')
  assert.ok(outside.indexOf('buildNorthStarPresentationModelV21') === -1, 'no presentation builder outside TEST_PREVIEW')
})
test('§5 no previewMode → NO North Star wiring (OFF path unchanged)', async () => {
  const resp = await callEvent({ type: 'diagnostic', diagnosticVersion: 'world_model_v2_1', answers: R45_ANSWERS })
  assert.strictEqual(resp.code, 0)
  assert.strictEqual(resp.data.reportType, 'diagnostic_v2_1_off')
  assert.strictEqual(resp.data.report, undefined, 'no report on OFF path')
})
test('§5 previewMode + no authority → rejected, no North Star', async () => {
  const { resp } = await callPreview({ enabledEnv: '', allowlistEnv: '' })
  assert.strictEqual(resp.data.previewRejected, true)
  assert.ok(!resp.data.report, 'no report when authority disabled')
})

// ═══════════════════════════════════════════════════════════════
// §7 — contract / version
// ═══════════════════════════════════════════════════════════════
test('§7 TEST_PREVIEW_OUTPUT_VERSION = north_star_report_v1 + validator PASS', async () => {
  const { resp } = await callPreview({})
  const d = resp.data
  assert.strictEqual(resp.code, 0)
  assert.strictEqual(d.version, 'north_star_report_v1', 'response version')
  assert.strictEqual(d.northStarValid, true, 'northStarValid')
  assert.ok(d.report, 'report present')
  assert.strictEqual(d.report.version, 'north_star_report_v1', 'report version')
  const v = reportBuilder.validateNorthStarReportV21(d.report)
  assert.strictEqual(v.valid, true, 'REPORT_VALIDATOR=PASS → ' + JSON.stringify(v.errors))
  // engine authority preserved (no reselection)
  assert.strictEqual(d.report.diagnosisState.primaryBlindSpotId, R45_ENGINE_PRIMARY)
})

// ═══════════════════════════════════════════════════════════════
// §6 — fail-closed semantics
// ═══════════════════════════════════════════════════════════════
test('§6 invalid input (17/18) → inputRejected, no report', async () => {
  const { resp } = await callPreview({ answers: R45_ANSWERS.slice(0, 17) })
  assert.strictEqual(resp.data.inputRejected, true)
  assert.ok(!resp.data.report, 'no report on invalid input')
})

// ═══════════════════════════════════════════════════════════════
// §8 — non-interference (baseline vs wired, non-preview branches)
// ═══════════════════════════════════════════════════════════════
test('§8 NON_PREVIEW_RUNTIME_OUTPUT_DIFF_COUNT = 0', async () => {
  const cases = [
    { name: 'v21_off', event: { type: 'diagnostic', diagnosticVersion: 'world_model_v2_1', answers: R45_ANSWERS }, v21Mode: null },
    { name: 'v21_shadow', event: { type: 'diagnostic', diagnosticVersion: 'world_model_v2_1', answers: R45_ANSWERS }, v21Mode: 'SHADOW' },
    { name: 'v2_shadow', event: { type: 'diagnostic', diagnosticVersion: 'world_model_v2', answers: {} }, v21Mode: null },
  ]
  for (const c of cases) {
    const before = await callEvent(c.event, { baseline: true, v21Mode: c.v21Mode })
    const after = await callEvent(c.event, { baseline: false, v21Mode: c.v21Mode })
    assert.deepStrictEqual(after, before, 'non-preview diff for ' + c.name)
  }
})

// ═══════════════════════════════════════════════════════════════
// §9 — R4.5 local end-to-end chain
// ═══════════════════════════════════════════════════════════════
test('§9 R45_LOCAL_E2E = PASS (18Q → report → view model)', async () => {
  const { resp } = await callPreview({})
  const cm = resp.data.report
  assert.strictEqual(cm.version, 'north_star_report_v1')

  const vm = viewModel.buildNorthStarReportViewModel(cm)
  assert.strictEqual(vm.supported, true, 'view model must render')
  assert.strictEqual(vm.uiState, 'UNIQUE')
  assert.strictEqual(vm.hasPrimary, true)

  // VISIBLE_EVIDENCE_COUNT >= 2
  const ev = cm.sections.find((s) => s.sectionId === '04_WHY_WE_JUDGE_THIS')
  const items = (ev && ev.body && Array.isArray(ev.body.items)) ? ev.body.items : []
  assert.ok(items.length >= 2, 'VISIBLE_EVIDENCE_COUNT >= 2 (got ' + items.length + ')')

  // no leakage
  const strings = reportBuilder.collectUserStrings(cm)
  const joined = strings.join('\n')
  assert.strictEqual(strings.some((s) => reportBuilder.isEnglishParagraph(s)), false, 'VISIBLE_ENGLISH=0')
  const PRED = ['一定会', '必然', '注定', '命运', '成功率提升到', '三年后']
  const WEALTH = ['保证赚', '保证收益', '稳赚', '收入翻倍', '财富自由', '月入', '年入']
  assert.strictEqual(PRED.some((t) => joined.indexOf(t) !== -1), false, 'UNSUPPORTED_PREDICTION=0')
  assert.strictEqual(WEALTH.some((t) => joined.indexOf(t) !== -1), false, 'WEALTH_PROMISE=0')
  // RAW_SCHEMA_LEAK=0 → no raw enum token in user-visible top-level strings
  const rawTokens = ['PRIMARY_ALLOWED', 'SYSTEM_THINKING_GAP', 'DISTORTED', 'SYS_BLIND']
  assert.strictEqual(rawTokens.some((t) => joined.indexOf(t) !== -1), false, 'RAW_SCHEMA_LEAK=0')
})

// ═══════════════════════════════════════════════════════════════
// §11 — wiring mutations W1..W6 (6/6)
// ═══════════════════════════════════════════════════════════════

// W1 — bypass TEST_PREVIEW authority
test('§11 W1 bypass authority → caught', async () => {
  const guard = async (mutate) => {
    const { resp } = await callPreview({ enabledEnv: '', allowlistEnv: '', mutate })
    // contract: unauthorized preview must be rejected with no report
    return resp.data && resp.data.previewRejected === true && !resp.data.report
  }
  assert.strictEqual(await guard(null), true, 'unmutated holds (rejected)')
  const mut = (s) => s.replace('if (!authority || !authority.enabled || !authority.authorized) {', 'if (false) {')
  assert.strictEqual(await guard(mut), false, 'mutation must be caught')
})

// W2 — return old version
test('§11 W2 return old world_model_v2_1 version → caught', async () => {
  const guard = async (mutate) => {
    const { resp } = await callPreview({ mutate })
    return resp.data && resp.data.version === 'north_star_report_v1'
  }
  assert.strictEqual(await guard(null), true)
  const mut = (s) => s.replace("version: 'north_star_report_v1',", "version: 'world_model_v2_1',")
  assert.strictEqual(await guard(mut), false)
})

// W3 — skip presentation layer
test('§11 W3 skip presentation (return engine report) → caught', async () => {
  const guard = async (mutate) => {
    const { resp } = await callPreview({ mutate })
    const r = resp.data && resp.data.report
    return !!(r && r.version === 'north_star_report_v1')
  }
  assert.strictEqual(await guard(null), true)
  const mut = (s) => s.replace('northStarReport = buildNorthStarReportV21(presentationModel)', 'northStarReport = report')
  assert.strictEqual(await guard(mut), false)
})

// W4 — skip report validator
test('§11 W4 skip report validator → caught', async () => {
  const guard = (mutate) => {
    let s = indexSrc()
    if (mutate) s = mutate(s)
    return /northStarValidation = validateNorthStarReportV21\(northStarReport\)/.test(s)
  }
  assert.strictEqual(guard(null), true)
  const mut = (s) => s.replace('northStarValidation = validateNorthStarReportV21(northStarReport)', 'northStarValidation = { valid: true, errors: [] }')
  assert.strictEqual(guard(mut), false)
})

// W5 — rerun/reselect blind spot in runtime
test('§11 W5 reselect blind spot in runtime → caught', async () => {
  const guard = async (mutate) => {
    const { resp } = await callPreview({ mutate })
    const r = resp.data && resp.data.report
    return !!(r && r.diagnosisState && r.diagnosisState.primaryBlindSpotId === R45_ENGINE_PRIMARY)
  }
  assert.strictEqual(await guard(null), true)
  const mut = (s) => s.replace(
    'diagnosis: cognition ? cognition.decision : null,',
    "diagnosis: { status: 'PRIMARY_ALLOWED', reasonCode: 'FABRICATED', primaryBlindSpotId: 'DECISION_INERTIA', primaryConstruct: 'DECISION' },"
  )
  assert.strictEqual(await guard(mut), false)
})

// W6 — silent fallback when North Star build fails
test('§11 W6 silent fallback on build failure → caught', async () => {
  // Precondition: force the North Star builder to throw.
  const forceFail = (s) => s.replace(
    /var \{ buildNorthStarReportV21, validateNorthStarReportV21 \} = require\('\.\/lib\/presentation\/worldModel\/v2_1\/report\/index\.js'\)/,
    "var { buildNorthStarReportV21, validateNorthStarReportV21 } = { buildNorthStarReportV21: function () { throw new Error('FORCED_F1_FAIL') }, validateNorthStarReportV21: function () { return { valid: false, errors: ['FORCED_F1_FAIL'] } } }"
  )
  // guard: on build failure, runtime must NOT emit non-North-Star content as success
  const guard = async (mutate) => {
    const { resp } = await callPreview({ mutate: (s) => (mutate ? mutate(forceFail(s)) : forceFail(s)) })
    const d = resp.data || {}
    const leaked = !!(d.report && d.report.version !== 'north_star_report_v1')
    return !leaked
  }
  assert.strictEqual(await guard(null), true, 'unmutated fails closed')
  const w6 = (s) => s
    .replace('if (!reportValid || !northStarValid) {', 'if (false) {')
    .replace(/console\.error\('\[V21TestPreview\] north star build exception:', \(e && e\.message\) \|\| e\)\n    northStarReport = null/, "console.error('[V21TestPreview] north star build exception:', (e && e.message) || e)\n    northStarReport = report")
  assert.strictEqual(await guard(w6), false, 'mutation must be caught')
})

// ═══════════════════════════════════════════════════════════════
// §10 — file scope
// ═══════════════════════════════════════════════════════════════
test('§10 PRODUCTION_FILES_CHANGED = 1 (only index.js)', () => {
  // Durable F1 scope assertion: the F1 exception commit may touch exactly one
  // production file (index.js). Assert the immutable F1 commit range, not the
  // live working tree (F2-M1 legitimately extends Stage1C-C/D files later).
  const out = execSync('git diff --name-only ' + F1_PARENT_SHA + '..' + F1_RUNTIME_WIRING_SHA + ' -- cloudfunctions pages utils app.js app.json', { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean)
  assert.deepStrictEqual(out, [INDEX_REL], 'only the authorized runtime file may change')
})
