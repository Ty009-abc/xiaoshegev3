'use strict'
/**
 * tests/v6/shadow/rc8.4-v6-shadow-wiring.test.js
 *
 * B2.5 (R1) production-wiring-prep tests. NO network, NO model, NO key.
 *
 * Proves the minimal generateAiReport wiring is DISABLED BY DEFAULT and that the
 * caller-visible response is IDENTICAL across OFF / SHADOW / ON (the V6 runtime
 * NEVER changes the production response). SHADOW internals are observed via a
 * runtime spy; the model is an injected mock (no credentials).
 *
 * §8 test matrix:
 *   OFF_ZERO_CALL · OFF_RESPONSE_COMPAT
 *   SHADOW_PRIMARY_RESPONSE_IDENTICAL · SHADOW_FIRST_PASS · SHADOW_RETRY_PASS
 *   SHADOW_DOUBLE_FAIL_PRIMARY_RESPONSE_IDENTICAL · SHADOW_TIMEOUT_PRIMARY_RESPONSE_IDENTICAL
 *   SHADOW_INVALID_JSON_PRIMARY_RESPONSE_IDENTICAL · SHADOW_VALIDATOR_FAIL_PRIMARY_RESPONSE_IDENTICAL
 *   INVALID_INPUT_ZERO_MODEL_CALL · NO_PRIMARY_ZERO_MODEL_CALL
 *   TOTAL_BUDGET_FALLBACK · SECOND_ATTEMPT_SKIPPED_WHEN_BUDGET_INSUFFICIENT
 *   PAYMENT_NON_INTERFERENCE · PRIMARY_NON_INTERFERENCE · GATE_B_NON_INTERFERENCE · V21_NON_INTERFERENCE
 */

const h = require('../_harness.js')
const Module = require('module')
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '../../..')
const V6 = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const INDEX_PATH = path.join(ROOT, 'cloudfunctions/generateAiReport/index.js')
const MODE_PATH = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/config/worldviewV6Mode.js')

const { diagnoseTurnaroundV6 } = require(path.join(V6, 'index.js'))
const { buildReportV6 } = require(path.join(V6, 'report/index.js'))
const F = require('../fixtures.js')

const G06 = F.GOLDEN.find(x => x.id === 'G06') // PRIMARY
const ADV_A = F.ADVERSARIAL.find(x => x.id === 'A') // NO_PRIMARY

// ── mock / spy state ────────────────────────────────────────────
let __aiCalls = []
let __aiQueue = []
let __aiMode = 'queue' // 'queue' | 'hang' | 'fail'
let __writes = []
let __openid = 'u1'
let __lastRuntimeOut = null
let __testAttemptTimeoutMs = null
let __testTotalBudgetMs = null

const mockDb = {
  command: {},
  collection: function (name) {
    return {
      where: function () { return this }, orderBy: function () { return this }, limit: function () { return this },
      get: async function () {
        if (name === 'users') return { data: [{ openid: __openid }] }
        if (name === 'user_profiles') return { data: [{ openid: __openid }] }
        return { data: [] }
      },
      add: async function (o) { __writes.push({ collection: name, data: o && o.data }); return { _id: 'mock' } },
      doc: function () { return { get: async function () { return { data: null } }, set: async function () {}, update: async function () {} } },
    }
  },
}
const mockSdk = {
  DYNAMIC_CURRENT_ENV: 'mock-env', init: function () {},
  getWXContext: function () { return { OPENID: __openid } },
  database: function () { return mockDb },
}
const aiMock = {
  // behavior driven by mutable state (adapter captures the reference at load)
  callAI: async function (opts) {
    __aiCalls.push(opts)
    if (__aiMode === 'hang') return new Promise(function (resolve) { setTimeout(resolve, 50) })
    if (__aiMode === 'fail') return { success: false, error: 'HTTP 503' }
    return __aiQueue.shift() || { success: false, error: 'EMPTY_QUEUE' }
  },
  buildReportPrompt: function () { return { systemPrompt: '', userMessage: '' } },
  buildCoachingPrompt: function () { return { systemPrompt: '', userMessage: '', personality: null } },
  buildDiagnosticPrompt: function () { return { systemPrompt: '', userMessage: '', personality: null, engineResult: { normalizedProfile: {}, constraintAnalysis: {}, allowedPaths: [], forbiddenPaths: [] } } },
}

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return mockSdk
  if (/(^|\/)ai\.js$/.test(request)) return aiMock
  if (/worldviewReportRuntimeV6(\.js)?$/.test(request)) {
    const real = originalLoad.apply(this, arguments)
    // Wrap to (a) capture the runtime output for internal assertions and
    //     (b) inject test-only budget overrides. Production callers never see this.
    return Object.assign({}, real, {
      runWorldviewReportRuntimeV6: async (a, o) => {
        const opts = Object.assign({}, o || {})
        if (__testAttemptTimeoutMs != null) opts.attemptTimeoutMs = __testAttemptTimeoutMs
        if (__testTotalBudgetMs != null) opts.totalBudgetMs = __testTotalBudgetMs
        const out = await real.runWorldviewReportRuntimeV6(a, opts)
        __lastRuntimeOut = out
        return out
      },
    })
  }
  return originalLoad.apply(this, arguments)
}
const index = require(INDEX_PATH)

// ── helpers ─────────────────────────────────────────────────────
function validResponse (answers) {
  const d = diagnoseTurnaroundV6(answers)
  const det = buildReportV6(d)
  const c = det.cards
  return {
    success: true, tokens: 10, finishReason: 'stop',
    content: JSON.stringify({
      reportVersion: 'turnaround_strategy_v6_worldview_v1',
      cards: {
        fatalInsight: { title: '致命一句话', text: c.fatalInsight.text },
        coreProblem: { title: '核心问题', text: c.coreProblem.text },
        systemLoop: { title: '系统困局', steps: c.systemLoop.steps.map(s => s.replace(/^[^：]*：/, '').trim()).concat(['补足五步']).slice(0, 5) },
        turnaroundPath: { title: '翻身路径', from: c.turnaroundPath.from, to: c.turnaroundPath.to, logic: '把准备换成一次真实反馈。' },
        firstAction: { title: '现在就做', action: c.firstAction.action, checks: c.firstAction.checks.length ? c.firstAction.checks : ['是否完成？'] },
      },
    }),
  }
}
function leakResponse (answers) {
  const w = JSON.parse(validResponse(answers).content)
  w.cards.turnaroundPath.logic = '你现在在LEARNING阶段，瓶颈是ACTION_GAP。'
  return { success: true, tokens: 10, finishReason: 'stop', content: JSON.stringify(w) }
}
function unsupportedResponse (answers) {
  const w = JSON.parse(validResponse(answers).content)
  w.cards.coreProblem.text = '你已经做了3年，收入一直上不去。'
  return { success: true, tokens: 10, finishReason: 'stop', content: JSON.stringify(w) }
}
function invalidJsonResponse () { return { success: true, tokens: 3, finishReason: 'stop', content: 'not json {{{' } }

function setMode (v) {
  if (v === undefined) delete process.env.RC84_V6_WORLDVIEW_MODE
  else process.env.RC84_V6_WORLDVIEW_MODE = v
}
async function call (event, mode, openid) {
  setMode(mode)
  __openid = openid || 'u1'
  __aiCalls = []; __writes = []
  return index.main(event, {})
}
function resetBudgets () { __testAttemptTimeoutMs = null; __testTotalBudgetMs = null; __aiMode = 'queue' }
function v6event (answers) { return { type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_v6', answers } }

async function run () {
  const M = require(MODE_PATH)

  h.section('mode parser (fail-closed)')
  {
    h.eq(M.parseV6WorldviewMode(undefined), 'OFF', 'undefined → OFF')
    h.eq(M.parseV6WorldviewMode(''), 'OFF', 'empty → OFF')
    h.eq(M.parseV6WorldviewMode('garbage'), 'OFF', 'garbage → OFF')
    h.eq(M.parseV6WorldviewMode('shadow'), 'SHADOW', 'lower shadow → SHADOW')
    h.eq(M.parseV6WorldviewMode('ON'), 'ON', 'ON parsed for forward-compat')
    h.eq(M.V6_DEFAULT_MODE, 'OFF', 'DEFAULT_MODE=OFF')
    h.eq(M.V6_WORLDVIEW_MODE_ENV, 'RC84_V6_WORLDVIEW_MODE', 'env name')
  }

  const OFF_RESP = await call(v6event(G06.answers), 'OFF')

  // ── OFF_ZERO_CALL ─────────────────────────────────────────────
  h.section('OFF_ZERO_CALL')
  {
    delete process.env.RC84_V6_WORLDVIEW_MODE
    let r = await call(v6event(G06.answers), undefined)
    h.eq(__aiCalls.length, 0, 'ZERO model calls (unset)')
    r = await call(v6event(G06.answers), 'OFF')
    h.eq(__aiCalls.length, 0, 'ZERO model calls (OFF)')
    r = await call(v6event(G06.answers), 'garbage')
    h.eq(__aiCalls.length, 0, 'ZERO model calls (garbage → OFF)')
    r = await call(v6event(G06.answers), 'ON')
    h.eq(__aiCalls.length, 0, 'ZERO model calls (ON not enabled)')
  }

  // ── OFF_RESPONSE_COMPAT ───────────────────────────────────────
  h.section('OFF_RESPONSE_COMPAT')
  {
    const a = await call(v6event(G06.answers), undefined)
    const b = await call(v6event(G06.answers), 'OFF')
    const c = await call(v6event(G06.answers), 'garbage')
    h.ok(JSON.stringify(a) === JSON.stringify(b), 'unset ≡ OFF (byte-identical)')
    h.ok(JSON.stringify(a) === JSON.stringify(c), 'garbage ≡ OFF (byte-identical)')
    h.ok(!('renderSource' in a.data) && !('v6Mode' in a.data) && !('v6Shadow' in a.data), 'OFF exposes no v6 internals')
  }

  // ── SHADOW_PRIMARY_RESPONSE_IDENTICAL ─────────────────────────
  h.section('SHADOW_PRIMARY_RESPONSE_IDENTICAL')
  {
    __aiQueue = [validResponse(G06.answers)]
    const r = await call(v6event(G06.answers), 'SHADOW')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'SHADOW response byte-identical to OFF')
    h.ok(JSON.stringify(r).indexOf('致命一句话') === -1, 'no V6 card copy in response')
    h.ok(!('v6Shadow' in r.data) && !('renderSource' in r.data), 'no shadow ack / renderSource leak')
    h.eq(__aiCalls.length, 1, 'model DID run on the side path')
  }

  // ── SHADOW_FIRST_PASS (internals via spy) ─────────────────────
  h.section('SHADOW_FIRST_PASS')
  {
    __aiQueue = [validResponse(G06.answers)]
    const r = await call(v6event(G06.answers), 'SHADOW')
    h.eq(__lastRuntimeOut.meta.renderSource, 'worldview_ai', 'runtime renderSource=worldview_ai')
    h.eq(__lastRuntimeOut.meta.attemptCount, 1, 'attemptCount=1')
    h.eq(__lastRuntimeOut.meta.validatorFailures.length, 0, 'no validator failures')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  // ── SHADOW_RETRY_PASS ─────────────────────────────────────────
  h.section('SHADOW_RETRY_PASS')
  {
    __aiQueue = [leakResponse(G06.answers), validResponse(G06.answers)]
    const r = await call(v6event(G06.answers), 'SHADOW')
    h.eq(__lastRuntimeOut.meta.renderSource, 'worldview_ai', 'renderSource=worldview_ai')
    h.eq(__lastRuntimeOut.meta.attemptCount, 2, 'attemptCount=2 (retry)')
    h.eq(__aiCalls.length, 2, 'exactly 2 model calls')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  // ── SHADOW_DOUBLE_FAIL_PRIMARY_RESPONSE_IDENTICAL ─────────────
  h.section('SHADOW_DOUBLE_FAIL_PRIMARY_RESPONSE_IDENTICAL')
  {
    __aiQueue = [leakResponse(G06.answers), leakResponse(G06.answers)]
    const r = await call(v6event(G06.answers), 'SHADOW')
    h.eq(__lastRuntimeOut.meta.renderSource, 'deterministic_fallback', 'runtime fallback')
    h.ok(__lastRuntimeOut.meta.validatorFailures.includes('ONTOLOGY_LEAK'), 'ONTOLOGY_LEAK recorded')
    h.eq(__aiCalls.length, 2, 'MAX_MODEL_ATTEMPTS=2 respected')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  // ── SHADOW_TIMEOUT_PRIMARY_RESPONSE_IDENTICAL ─────────────────
  h.section('SHADOW_TIMEOUT_PRIMARY_RESPONSE_IDENTICAL')
  {
    __testAttemptTimeoutMs = 5
    __aiMode = 'hang'
    const r = await call(v6event(G06.answers), 'SHADOW')
    resetBudgets()
    h.eq(__lastRuntimeOut.meta.renderSource, 'deterministic_fallback', 'timeout → fallback')
    h.eq(__lastRuntimeOut.meta.fallbackReason, 'MODEL_TIMEOUT', 'fallbackReason=MODEL_TIMEOUT')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  // ── SHADOW_INVALID_JSON_PRIMARY_RESPONSE_IDENTICAL ────────────
  h.section('SHADOW_INVALID_JSON_PRIMARY_RESPONSE_IDENTICAL')
  {
    __aiQueue = [invalidJsonResponse(), invalidJsonResponse()]
    const r = await call(v6event(G06.answers), 'SHADOW')
    h.eq(__lastRuntimeOut.meta.renderSource, 'deterministic_fallback', 'fallback')
    h.eq(__lastRuntimeOut.meta.fallbackReason, 'INVALID_JSON', 'fallbackReason=INVALID_JSON')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  // ── SHADOW_VALIDATOR_FAIL_PRIMARY_RESPONSE_IDENTICAL ──────────
  h.section('SHADOW_VALIDATOR_FAIL_PRIMARY_RESPONSE_IDENTICAL')
  {
    __aiQueue = [unsupportedResponse(G06.answers), unsupportedResponse(G06.answers)]
    const r = await call(v6event(G06.answers), 'SHADOW')
    h.eq(__lastRuntimeOut.meta.renderSource, 'deterministic_fallback', 'fallback')
    h.ok(__lastRuntimeOut.meta.validatorFailures.includes('UNSUPPORTED_USER_CLAIM'), 'UNSUPPORTED_USER_CLAIM recorded')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  // ── PROVIDER_ERROR_PRIMARY_RESPONSE_IDENTICAL ─────────────────
  h.section('PROVIDER_ERROR_PRIMARY_RESPONSE_IDENTICAL')
  {
    __aiMode = 'fail'
    const r = await call(v6event(G06.answers), 'SHADOW')
    resetBudgets()
    h.eq(__lastRuntimeOut.meta.renderSource, 'deterministic_fallback', 'provider error → fallback')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
    h.eq(r.code, 0, 'request still succeeds (code 0)')
  }

  // ── INVALID_INPUT / NO_PRIMARY ZERO MODEL CALL ────────────────
  h.section('INVALID_INPUT_ZERO_MODEL_CALL + NO_PRIMARY_ZERO_MODEL_CALL')
  {
    __aiQueue = [validResponse(G06.answers)]
    const ri = await call(v6event({}), 'SHADOW')
    h.eq(__aiCalls.length, 0, 'INVALID_INPUT → ZERO model calls')
    h.eq(__lastRuntimeOut.meta.fallbackReason, 'INVALID_INPUT', 'reason=INVALID_INPUT')
    h.ok(JSON.stringify(ri) === JSON.stringify(OFF_RESP), 'response identical to OFF')

    __aiQueue = [validResponse(ADV_A.answers)]
    const rn = await call(v6event(ADV_A.answers), 'SHADOW')
    h.eq(__aiCalls.length, 0, 'NO_PRIMARY → ZERO model calls')
    h.eq(__lastRuntimeOut.meta.fallbackReason, 'NO_PRIMARY', 'reason=NO_PRIMARY')
    h.ok(JSON.stringify(rn) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  // ── TOTAL_BUDGET_FALLBACK + SECOND_ATTEMPT_SKIPPED ────────────
  h.section('TOTAL_BUDGET_FALLBACK + SECOND_ATTEMPT_SKIPPED_WHEN_BUDGET_INSUFFICIENT')
  {
    // attempt 1 fails validation fast; remaining budget (5ms) < attempt timeout
    // → attempt 2 must NOT start; fall back to deterministic B2.1 immediately.
    __testTotalBudgetMs = 5
    __testAttemptTimeoutMs = 14000
    __aiQueue = [leakResponse(G06.answers), validResponse(G06.answers)]
    const r = await call(v6event(G06.answers), 'SHADOW')
    resetBudgets()
    h.eq(__aiCalls.length, 1, '2nd attempt SKIPPED (budget insufficient)')
    h.eq(__lastRuntimeOut.meta.attemptCount, 1, 'attemptCount=1')
    h.eq(__lastRuntimeOut.meta.fallbackReason, 'TOTAL_BUDGET_EXHAUSTED', 'fallbackReason=TOTAL_BUDGET_EXHAUSTED')
    h.eq(__lastRuntimeOut.meta.renderSource, 'deterministic_fallback', 'deterministic fallback')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  // ── budget constants (R1) ─────────────────────────────────────
  h.section('BUDGET_CONSTANTS')
  {
    const rt = require(path.join(V6, 'experimental/runtime/worldviewReportRuntimeV6.js'))
    h.eq(rt.MODEL_ATTEMPT_TIMEOUT_MS, 14000, 'MODEL_ATTEMPT_TIMEOUT_MS=14000')
    h.eq(rt.MAX_MODEL_ATTEMPTS, 2, 'MAX_MODEL_ATTEMPTS=2')
    h.ok(rt.TOTAL_WORLDVIEW_BUDGET_MS <= 30000, 'TOTAL_WORLDVIEW_BUDGET_MS<=30000')
    h.ok(rt.MODEL_ATTEMPT_TIMEOUT_MS * rt.MAX_MODEL_ATTEMPTS < 60000, '2×timeout < function timeout')
  }

  // ── NON-V6 REQUEST UNAFFECTED (V21_NON_INTERFERENCE) ─────────
  h.section('V21_NON_INTERFERENCE')
  {
    const ev = { type: 'diagnostic', diagnosticVersion: 'world_model_v2_1', answers: {} }
    const a = await call(ev, 'OFF')
    const b = await call(ev, 'SHADOW')
    const c = await call(ev, 'ON')
    h.ok(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) === JSON.stringify(c),
      'v2.1 response identical across RC84_V6_WORLDVIEW_MODE values (diff=0)')
    h.eq(a.data.diagnosticVersion, 'world_model_v2_1', 'v2.1 path not hijacked by V6 flag')
    h.eq(__aiCalls.length, 0, 'no model call on non-v6 path')
  }

  // ── PAYMENT / PRIMARY / GATE_B NON-INTERFERENCE ───────────────
  h.section('PAYMENT / PRIMARY / GATE_B NON-INTERFERENCE')
  {
    const src = fs.readFileSync(INDEX_PATH, 'utf8')
    const start = src.indexOf("diagnosticVersion === 'turnaround_strategy_v6'")
    const end = src.indexOf('// ═══ V3 原有链路', start)
    const v6Block = src.slice(start, end < 0 ? src.length : end)
    h.ok(!/createOrder|payCallback|verifyPayment|refundOrder|entitlement|consumeFreeQuota|checkVip|membership|payAmount|amount/i.test(v6Block),
      'V6 dispatch block references NO payment/entitlement symbol')
    h.ok(!/GATE_B|gate_b|GateB/.test(v6Block), 'V6 block references NO Gate-B symbol')
    h.ok(!/worldModelV2|worldModelV21|world_model_v2/i.test(v6Block), 'V6 block references NO V2/V2.1 module')

    __aiQueue = [validResponse(G06.answers)]
    await call(v6event(G06.answers), 'SHADOW')
    const payWrite = __writes.find(w => /order|pay|entitle|member/i.test(w.collection))
    h.ok(!payWrite, 'shadow run performs no payment/entitlement writes')

    const v21 = await call({ type: 'diagnostic', diagnosticVersion: 'world_model_v2_1', answers: {} }, 'SHADOW')
    h.eq(v21.data.diagnosticVersion, 'world_model_v2_1', 'v2.1 path preserved')
  }

  return h.summary('B2.5 SHADOW WIRING SUITE')
}

module.exports = { run }
if (require.main === module) run()
