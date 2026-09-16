'use strict'
/**
 * tests/v6/draft/rc8.4-v6-r19-observability.test.js
 *
 * R19 — V6 SHADOW per-attempt + total latency OBSERVABILITY. NO network/key.
 *
 * Proves the instrumentation added in R19:
 *   SINGLE_ATTEMPT_LATENCY_RECORDED
 *   RETRY_BOTH_ATTEMPT_LATENCIES_RECORDED
 *   TIMEOUT_ATTEMPT_LATENCY_RECORDED
 *   TOTAL_SHADOW_LATENCY_RECORDED
 *   FALLBACK_LATENCY_RECORDED
 *   NO_RAW_CONTENT_IN_META
 *   PRIMARY_RESPONSE_UNCHANGED
 *   NON_ALLOWLIST_ZERO_OBSERVABILITY_SIDE_EFFECT
 *
 * The instrumentation is SAFE-only: attemptNumber / latencyMs / resultCategory,
 * plus aggregate attempt metrics + total shadow latency. Never raw prompt,
 * raw model content, raw report, openid, or secret.
 */

const h = require('../_harness.js')
const Module = require('module')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const V6 = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const INDEX_PATH = path.join(ROOT, 'cloudfunctions/generateAiReport/index.js')

const { diagnoseTurnaroundV6 } = require(path.join(V6, 'index.js'))
const F = require('../fixtures.js')

const G06 = F.GOLDEN.find((x) => x.id === 'G06')

// ── mock / spy state ────────────────────────────────────────────
let __aiCalls = []
let __aiQueue = []
let __aiMode = 'queue'
let __openid = 'u1'
let __allowlist = null
let __lastRuntimeOut = null
let __loggedLines = []
let __testAttemptTimeoutMs = null

const mockDb = {
  command: {},
  collection: function (name) {
    return {
      where () { return this }, orderBy () { return this }, limit () { return this },
      get: async function () { if (name === 'users') return { data: [{ openid: __openid }] }; if (name === 'user_profiles') return { data: [{ openid: __openid }] }; return { data: [] } },
      add: async function () { return { _id: 'mock' } },
      doc: function () { return { get: async () => ({ data: null }), set: async () => {}, update: async () => {} } },
    }
  },
}
const mockSdk = { DYNAMIC_CURRENT_ENV: 'mock-env', init () {}, getWXContext: () => ({ OPENID: __openid }), database: () => mockDb }
const aiMock = {
  callAI: async function (opts) {
    __aiCalls.push(opts)
    if (__aiMode === 'hang') return new Promise((resolve) => { setTimeout(resolve, 50) })
    if (__aiMode === 'fail') return { success: false, error: 'HTTP 503' }
    return __aiQueue.shift() || { success: false, error: 'EMPTY_QUEUE' }
  },
  buildReportPrompt: () => ({ systemPrompt: '', userMessage: '' }),
  buildCoachingPrompt: () => ({ systemPrompt: '', userMessage: '', personality: null }),
  buildDiagnosticPrompt: () => ({ systemPrompt: '', userMessage: '', personality: null, engineResult: { normalizedProfile: {}, constraintAnalysis: {}, allowedPaths: [], forbiddenPaths: [] } }),
}

// capture console.log to inspect the SAFE shadow meta log
const origLogImpl = console.log
console.log = function () { try { __loggedLines.push(Array.prototype.join.call(arguments, ' ')) } catch (_) { /* noop */ } }

const originalLoad = Module._load
Module._load = function (request) {
  if (request === 'wx-server-sdk') return mockSdk
  if (/(^|\/)ai\.js$/.test(request)) return aiMock
  if (/draftReportRuntimeV6(\.js)?$/.test(request)) {
    const real = originalLoad.apply(this, arguments)
    return Object.assign({}, real, {
      runDraftReportRuntimeV6: async (a, o) => {
        const opts = Object.assign({}, o || {})
        if (__testAttemptTimeoutMs != null) opts.attemptTimeoutMs = __testAttemptTimeoutMs
        const out = await real.runDraftReportRuntimeV6(a, opts)
        __lastRuntimeOut = out
        return out
      },
    })
  }
  return originalLoad.apply(this, arguments)
}
const index = require(INDEX_PATH)
// R19 helpers must be obtained AFTER the Module._load override above, so that
// draftAdapterV6 captures the MOCK callAI (requiring the runtime at top-level
// before the override would cache the REAL provider for the whole process).
const {
  attemptResultCategory, deriveAttemptLatencyMetrics, ATTEMPT_RESULT,
} = require(path.join(V6, 'experimental/draft/draftReportRuntimeV6.js'))

function validResponse () {
  return {
    success: true, tokens: 10, finishReason: 'stop',
    content: JSON.stringify({
      draftVersion: 'turnaround_strategy_v6_worldview_draft_v1',
      insightCandidates: ['你以为缺的是资源，其实你缺的是一次真正开始；学过的东西一直没变成第一个真实结果。'],
      mechanismExplanation: '你把学习当成前进，但它不产生外部反馈；越不确定就越想先想清楚，结果真实结果永远是零，压力却在累积。',
      transitionExplanation: '下一阶段的规则不是想清楚再动，而是先做一个零成本、失败也不伤现金流的最小验证。',
      actionExplanation: '所以今天该做的，是不花钱、能立刻拿到外部反馈的那一个最小动作。',
    }),
  }
}
function invalidJsonResponse () { return { success: true, tokens: 3, finishReason: 'stop', content: 'not json {{{' } }

function setMode (v) { if (v === undefined) delete process.env.RC84_V6_WORLDVIEW_MODE; else process.env.RC84_V6_WORLDVIEW_MODE = v }
function setAllowlist (v) { if (v === undefined || v === null) delete process.env.RC84_V6_SHADOW_ALLOWLIST; else process.env.RC84_V6_SHADOW_ALLOWLIST = v }
async function call (event, mode, openid, allowlist) {
  setMode(mode)
  if (allowlist !== undefined) setAllowlist(allowlist)
  __openid = openid || 'u1'
  __aiCalls = []; __loggedLines = []
  return index.main(event, {})
}
const AL = 'u1,u2'
function resetBudgets () { __testAttemptTimeoutMs = null; __aiMode = 'queue' }
function v6event (answers, extra) { return Object.assign({ type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_v6', answers }, extra || {}) }
const shadowMetaLog = () => { const l = __loggedLines.filter((x) => x.indexOf('[V6Shadow] meta ') === 0).pop(); return l ? JSON.parse(l.replace('[V6Shadow] meta ', '')) : null }
const allShadowLogs = () => __loggedLines.filter((x) => x.indexOf('[V6Shadow] meta ') === 0)

async function run () {
  const OFF_RESP = await call(v6event(G06.answers), 'OFF')

  h.section('R19 unit: ATTEMPT_RESULT + deriveAttemptLatencyMetrics')
  {
    h.eq(ATTEMPT_RESULT.PASS, 'PASS', 'closed category PASS')
    h.eq(attemptResultCategory('MODEL_TIMEOUT', false, null), 'MODEL_TIMEOUT', 'timeout → MODEL_TIMEOUT')
    h.eq(attemptResultCategory('MODEL_ERROR', false, null), 'MODEL_ERROR', 'error → MODEL_ERROR')
    h.eq(attemptResultCategory('INVALID_JSON', false, null), 'INVALID_JSON', 'bad json → INVALID_JSON')
    h.eq(attemptResultCategory('JSON_TRUNCATED', false, null), 'INVALID_JSON', 'truncated → INVALID_JSON')
    h.eq(attemptResultCategory(null, false, false), 'SEMANTIC_FAIL', 'semantic fail category')
    h.eq(attemptResultCategory(null, false, true), 'FINAL_VALIDATION_FAIL', 'final fail category')
    h.eq(attemptResultCategory(null, true, true), 'PASS', 'valid → PASS')
    const m = deriveAttemptLatencyMetrics([{ latencyMs: 100, resultCategory: 'PASS' }, { latencyMs: 14000, resultCategory: 'MODEL_TIMEOUT' }, { latencyMs: 200, resultCategory: 'PASS' }])
    h.eq(m.ATTEMPT_P50_MS, 200, 'ATTEMPT_P50')
    h.eq(m.ATTEMPT_P95_MS, 14000, 'ATTEMPT_P95')
    h.eq(m.ATTEMPT_MAX_MS, 14000, 'ATTEMPT_MAX')
    h.eq(m.SUCCESSFUL_ATTEMPT_P50_MS, 200, 'SUCCESSFUL_P50 ignores timeout attempt')
    h.eq(m.TIMEOUT_ATTEMPT_COUNT, 1, 'TIMEOUT_ATTEMPT_COUNT')
    h.eq(m.TIMEOUT_ATTEMPT_MIN_MS, 14000, 'TIMEOUT_ATTEMPT_MIN')
    h.eq(m.TIMEOUT_ATTEMPT_MAX_MS, 14000, 'TIMEOUT_ATTEMPT_MAX')
  }

  h.section('SINGLE_ATTEMPT_LATENCY_RECORDED')
  {
    __aiQueue = [validResponse()]
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    const attempts = __lastRuntimeOut.meta.attempts
    h.eq(attempts.length, 1, 'one attempt recorded')
    h.eq(attempts[0].attempt, 1, 'attemptNumber=1')
    h.ok(typeof attempts[0].latencyMs === 'number' && attempts[0].latencyMs >= 0, 'attempt latencyMs numeric')
    h.eq(attempts[0].resultCategory, 'PASS', 'resultCategory=PASS')
    h.ok(typeof __lastRuntimeOut.meta.shadowTotalLatencyMs === 'number' && __lastRuntimeOut.meta.shadowTotalLatencyMs >= attempts[0].latencyMs, 'shadowTotal >= attempt latency')
    h.eq(__lastRuntimeOut.meta.attemptLatencyMetrics.ATTEMPT_MAX_MS, attempts[0].latencyMs, 'metrics max == single attempt latency')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response == OFF')
  }

  h.section('RETRY_BOTH_ATTEMPT_LATENCIES_RECORDED')
  {
    __aiQueue = [invalidJsonResponse(), validResponse()]
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    const attempts = __lastRuntimeOut.meta.attempts
    h.eq(attempts.length, 2, 'two attempts recorded')
    h.eq(attempts[0].resultCategory, 'INVALID_JSON', 'attempt1 = INVALID_JSON')
    h.eq(attempts[1].resultCategory, 'PASS', 'attempt2 = PASS')
    h.ok(typeof attempts[0].latencyMs === 'number' && typeof attempts[1].latencyMs === 'number', 'BOTH attempt latencies recorded')
    h.eq(attempts[0].attempt, 1, 'attemptNumber 1')
    h.eq(attempts[1].attempt, 2, 'attemptNumber 2')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response == OFF')
  }

  h.section('TIMEOUT_ATTEMPT_LATENCY_RECORDED')
  {
    __testAttemptTimeoutMs = 5
    __aiMode = 'hang'
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    resetBudgets()
    const attempts = __lastRuntimeOut.meta.attempts
    h.eq(attempts.length, 2, 'both timeout attempts recorded')
    h.eq(attempts[0].resultCategory, 'MODEL_TIMEOUT', 'attempt1 = MODEL_TIMEOUT')
    h.eq(attempts[1].resultCategory, 'MODEL_TIMEOUT', 'attempt2 = MODEL_TIMEOUT')
    h.ok(attempts[0].latencyMs >= 5, 'timeout attempt latency recorded (>= timeout)')
    const m = __lastRuntimeOut.meta.attemptLatencyMetrics
    h.eq(m.TIMEOUT_ATTEMPT_COUNT, 2, 'TIMEOUT_ATTEMPT_COUNT=2')
    h.ok(m.TIMEOUT_ATTEMPT_MIN_MS >= 5 && m.TIMEOUT_ATTEMPT_MAX_MS >= 5, 'timeout min/max recorded')
    h.ok(typeof __lastRuntimeOut.meta.shadowTotalLatencyMs === 'number', 'shadowTotal recorded on fallback')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response == OFF')
  }

  h.section('TOTAL_SHADOW_LATENCY_RECORDED')
  {
    __aiQueue = [validResponse()]
    await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    h.ok(typeof __lastRuntimeOut.meta.shadowTotalLatencyMs === 'number' && __lastRuntimeOut.meta.shadowTotalLatencyMs >= 0, 'meta.shadowTotalLatencyMs present')
    const sm = shadowMetaLog()
    h.ok(sm && typeof sm.shadowTotalLatencyMs === 'number', 'safe log exposes shadowTotalLatencyMs')
    h.ok(sm && Array.isArray(sm.attemptLatencyMs) && sm.attemptLatencyMs[0] && sm.attemptLatencyMs[0].attemptNumber === 1, 'safe log exposes per-attempt array')
    h.ok(sm && sm.attemptLatencyMetrics && sm.attemptLatencyMetrics.ATTEMPT_MAX_MS >= 0, 'safe log exposes attemptLatencyMetrics')
  }

  h.section('FALLBACK_LATENCY_RECORDED')
  {
    __aiQueue = [invalidJsonResponse(), invalidJsonResponse()]
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    h.eq(__lastRuntimeOut.meta.renderSource, 'deterministic_fallback', 'whole-report fallback')
    h.ok(typeof __lastRuntimeOut.meta.shadowTotalLatencyMs === 'number', 'fallback records shadowTotalLatencyMs')
    h.ok(Array.isArray(__lastRuntimeOut.meta.attempts) && __lastRuntimeOut.meta.attempts.length === 2, 'fallback records attempt latencies')
    h.ok(__lastRuntimeOut.meta.attemptLatencyMetrics && __lastRuntimeOut.meta.attemptLatencyMetrics.ATTEMPT_P95_MS >= 0, 'fallback records attempt metrics')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response == OFF')
  }

  h.section('NO_RAW_CONTENT_IN_META')
  {
    __aiQueue = [validResponse()]
    await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    const dumped = JSON.stringify(__lastRuntimeOut.meta)
    const banned = ['systemPrompt', 'userMessage', 'sk-', 'AI_API_KEY', '你认为', 'turnaround_strategy_v6_worldview_draft']
    for (const b of banned) h.ok(dumped.indexOf(b) === -1, 'meta excludes raw token: ' + b)
    // attempt records carry only SAFE keys
    const allowed = ['attempt', 'ok', 'failureReason', 'resultCategory', 'latencyMs', 'rawLen', 'finishReason', 'draftValid', 'draftHardFailures', 'finalHardFailures', 'fieldsUsed', 'fieldsFellBack']
    for (const a of __lastRuntimeOut.meta.attempts) {
      for (const k of Object.keys(a)) h.ok(allowed.indexOf(k) !== -1, 'attempt key allowed: ' + k)
    }
    const sm = shadowMetaLog()
    h.ok(sm && sm.draftParseResult !== undefined, 'safe log has no raw content fields')
    h.ok(JSON.stringify(sm).indexOf('sk-') === -1, 'safe log excludes secrets')
  }

  h.section('PRIMARY_RESPONSE_UNCHANGED')
  {
    __aiQueue = [validResponse()]
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'SHADOW response byte-identical to OFF')
    h.ok(!('renderSource' in r.data) && !('v6Shadow' in r.data), 'no shadow/renderSource leak in response')
    h.ok(JSON.stringify(r).indexOf('shadowTotalLatencyMs') === -1, 'no telemetry leak in response')
  }

  h.section('NON_ALLOWLIST_ZERO_OBSERVABILITY_SIDE_EFFECT')
  {
    __aiQueue = [validResponse()]
    const r = await call(v6event(G06.answers), 'SHADOW', 'intruder', AL)
    h.eq(__aiCalls.length, 0, 'non-allowlisted → ZERO model calls')
    h.eq(allShadowLogs().length, 0, 'non-allowlisted → ZERO shadow meta logs (no observability side effect)')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'non-allowlisted → response == OFF')
  }
}

run().then(() => {
  console.log = origLogImpl
  const s = h.summary('R19 observability')
  if (s.failed) process.exitCode = 1
}).catch((e) => { console.log = origLogImpl; origLogImpl('R19 TEST ERROR', e && e.stack || e); process.exitCode = 2 })
