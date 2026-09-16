'use strict'
/**
 * tests/v6/on/rc8.4-v6-r21-on.test.js
 *
 * R21 §17 — LIMITED ON mode tests. NO network / NO key (AI mocked).
 *
 * ON is a SEPARATE fail-closed rollout gate (RC84_V6_ON_ALLOWLIST), independent
 * from the SHADOW allowlist. Tests:
 *   ON_EMPTY_ALLOWLIST_DENY_ALL
 *   ON_ALLOWLIST_MATCH_RETURNS_EDITED_REPORT
 *   ON_ALLOWLIST_MISS_RETURNS_BASELINE
 *   SHADOW_ALLOWLIST_DOES_NOT_AUTHORIZE_ON
 *   ON_MODEL_FAILURE_RETURNS_B2
 *   ON_TIMEOUT_RETURNS_B2
 *   ON_FINAL_VALIDATION_FAILURE_RETURNS_B2
 *   INVALID_INPUT_ZERO_MODEL
 *   NO_PRIMARY_ZERO_MODEL
 *   ON_PRIMARY_RESPONSE_IS_USER_REPORT
 *   ON_INTERNAL_METADATA_NOT_EXPOSED
 *   NON_V6_PRODUCTION_UNCHANGED
 */

const h = require('../_harness.js')
const Module = require('module')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const V6 = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const INDEX_PATH = path.join(ROOT, 'cloudfunctions/generateAiReport/index.js')

let __aiCalls = []
let __aiQueue = []
let __aiMode = 'queue'
let __openid = 'u1'
let __lastRuntimeOut = null
let __testAttemptTimeoutMs = null
let __loggedLines = []

const F = require('../fixtures.js')
const G06 = F.GOLDEN.find((x) => x.id === 'G06')

const mockDb = {
  command: {},
  collection: function () {
    return {
      where () { return this }, orderBy () { return this }, limit () { return this },
      get: async function () { return { data: [{ openid: __openid, _id: 'm' }] } },
      add: async function () { return { _id: 'm' } },
      doc: function () { return { get: async () => ({ data: null }), set: async () => {}, update: async () => {} } },
    }
  },
}
const mockSdk = { DYNAMIC_CURRENT_ENV: 'mock', init () {}, getWXContext: () => ({ OPENID: __openid }), database: () => mockDb }
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

const origLogImpl = console.log
console.log = function () { try { __loggedLines.push(Array.prototype.join.call(arguments, ' ')) } catch (_) {} }

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
function leakResponse () {
  return {
    success: true, tokens: 10, finishReason: 'stop',
    content: JSON.stringify({
      draftVersion: 'turnaround_strategy_v6_worldview_draft_v1',
      insightCandidates: ['你在LEARNING阶段，瓶颈是ACTION_GAP，所以要先动起来。'],
      mechanismExplanation: 'ACTION_GAP 让你停在准备里，DIAGNOSIS 显示你从没开始。',
      transitionExplanation: '从 LEARNING 阶段进入下一个阶段，规则会变。',
      actionExplanation: 'CASHFLOW_SAFE_EXPERIMENT 是这里的动作类型。',
    }),
  }
}
function invalidJsonResponse () { return { success: true, tokens: 3, finishReason: 'stop', content: 'not json {{{' } }

function setMode (v) { if (v === undefined) delete process.env.RC84_V6_WORLDVIEW_MODE; else process.env.RC84_V6_WORLDVIEW_MODE = v }
function setShadow (v) { if (v === undefined || v === null) delete process.env.RC84_V6_SHADOW_ALLOWLIST; else process.env.RC84_V6_SHADOW_ALLOWLIST = v }
function setOn (v) { if (v === undefined || v === null) delete process.env.RC84_V6_ON_ALLOWLIST; else process.env.RC84_V6_ON_ALLOWLIST = v }
async function call (event, mode, openid, onList, shadowList) {
  setMode(mode); setOn(onList); setShadow(shadowList)
  __openid = openid || 'u1'
  __aiCalls = []; __loggedLines = []
  return index.main(event, {})
}
function v6event (answers, extra) { return Object.assign({ type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_v6', answers }, extra || {}) }
const baseline = (r) => r && r.data && r.data.v6PrimaryActive === false && r.data.reportType === 'turnaround_strategy_v6'
const isUserReport = (r) => r && r.data && r.data.v6PrimaryActive === true && r.data.cards && r.data.cards.fatalInsight

async function run () {
  const M = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/config/worldviewV6Mode.js'))
  const OFF_RESP = await call(v6event(G06.answers), 'OFF')

  h.section('ON parser (fail-closed, independent)')
  {
    h.eq(M.V6_ON_ALLOWLIST_ENV, 'RC84_V6_ON_ALLOWLIST', 'ON allowlist env name')
    h.eq(M.parseV6OnAllowlist(undefined).size, 0, 'undefined → empty')
    h.eq(M.parseV6OnAllowlist('  ').size, 0, 'whitespace → empty')
    h.eq(M.parseV6OnAllowlist('a, b ,c').size, 3, 'comma split + trim')
    h.eq(M.isV6OnAuthorized('u1', ''), false, 'empty → deny')
    h.eq(M.isV6OnAuthorized('u1', undefined), false, 'missing → deny')
    h.eq(M.isV6OnAuthorized('u2', 'u1,u2'), true, 'match → authorize')
    h.eq(M.isV6OnAuthorized('u9', 'u1,u2'), false, 'miss → deny')
  }

  h.section('ON_EMPTY_ALLOWLIST_DENY_ALL')
  {
    let r = await call(v6event(G06.answers), 'ON', 'u1', undefined)
    h.eq(__aiCalls.length, 0, 'unset ON allowlist → ZERO model calls')
    h.ok(baseline(r), 'unset ON allowlist → baseline response')
    r = await call(v6event(G06.answers), 'ON', 'u1', '   ')
    h.eq(__aiCalls.length, 0, 'whitespace ON allowlist → ZERO model calls')
    h.ok(baseline(r), 'whitespace ON allowlist → baseline')
    r = await call(v6event(G06.answers), 'ON', 'u1', ', ,')
    h.eq(__aiCalls.length, 0, 'empty entries → ZERO model calls')
  }

  h.section('ON_ALLOWLIST_MATCH_RETURNS_EDITED_REPORT')
  {
    __aiQueue = [validResponse()]
    const r = await call(v6event(G06.answers), 'ON', 'u1', 'u1,u2')
    h.eq(__aiCalls.length, 1, 'ON-listed → V6 chain runs')
    h.ok(isUserReport(r), 'returns an edited V6 user report')
    h.ok(r.data.cards.fatalInsight && r.data.cards.fatalInsight.text && r.data.cards.fatalInsight.text.length > 0, 'CARD01 has text')
    h.eq(__lastRuntimeOut.meta.renderSource, 'ai_draft_edited', 'renderSource=ai_draft_edited')
  }

  h.section('ON_ALLOWLIST_MISS_RETURNS_BASELINE')
  {
    __aiQueue = [validResponse()]
    const r = await call(v6event(G06.answers), 'ON', 'intruder', 'u1,u2')
    h.eq(__aiCalls.length, 0, 'non-listed server openid → ZERO model calls')
    h.ok(baseline(r), 'non-listed → baseline response')
  }

  h.section('SHADOW_ALLOWLIST_DOES_NOT_AUTHORIZE_ON')
  {
    // openid appears in SHADOW allowlist only; ON allowlist empty.
    __aiQueue = [validResponse()]
    const r = await call(v6event(G06.answers), 'ON', 'shadowonly', undefined, 'shadowonly')
    h.eq(__aiCalls.length, 0, 'SHADOW-only openid gets NO ON V6 call')
    h.ok(baseline(r), 'SHADOW-only → baseline (SHADOW list never authorizes ON)')
    // and the inverse: ON list does not authorize SHADOW
    __aiQueue = [validResponse()]
    const r2 = await call(v6event(G06.answers), 'SHADOW', 'ononly', 'ononly', undefined)
    h.eq(__aiCalls.length, 0, 'ON-only openid gets NO SHADOW V6 call')
    h.ok(JSON.stringify(r2) === JSON.stringify(OFF_RESP), 'ON-only in SHADOW → identical to OFF')
  }

  h.section('ON_MODEL_FAILURE_RETURNS_B2')
  {
    __aiQueue = [invalidJsonResponse(), invalidJsonResponse()]
    const r = await call(v6event(G06.answers), 'ON', 'u1', 'u1')
    h.eq(__aiCalls.length, 2, 'two attempts (MAX_MODEL_ATTEMPTS=2, fast failures)')
    h.ok(isUserReport(r), 'still returns a user report (deterministic B2), never an error')
    h.eq(r.code, 0, 'no error code')
    h.eq(__lastRuntimeOut.meta.renderSource, 'deterministic_fallback', 'runtime whole-report fallback')
  }

  h.section('ON_TIMEOUT_RETURNS_B2')
  {
    __testAttemptTimeoutMs = 5
    __aiMode = 'hang'
    const r = await call(v6event(G06.answers), 'ON', 'u1', 'u1')
    __testAttemptTimeoutMs = null; __aiMode = 'queue'
    h.ok(isUserReport(r), 'timeout → deterministic B2 user report (no error)')
    h.eq(__lastRuntimeOut.meta.fallbackReason, 'MODEL_TIMEOUT', 'fallbackReason=MODEL_TIMEOUT')
  }

  h.section('ON_FINAL_VALIDATION_FAILURE_RETURNS_B2')
  {
    // leakResponse: every AI field unsafe → all fields fall back; final valid B2 cards.
    __aiQueue = [leakResponse()]
    const r = await call(v6event(G06.answers), 'ON', 'u1', 'u1')
    h.ok(isUserReport(r), 'unsafe AI fields never reach user; B2 report returned')
    const txt = JSON.stringify(r.data.cards)
    h.ok(txt.indexOf('ACTION_GAP') === -1 && txt.indexOf('LEARNING') === -1, 'no ontology leak in user report')
  }

  h.section('INVALID_INPUT_ZERO_MODEL')
  {
    __aiQueue = [validResponse()]
    const r = await call(v6event({ Q1: 'garbage', Q2: 'garbage' }), 'ON', 'u1', 'u1')
    h.eq(__aiCalls.length, 0, 'INVALID_INPUT → ZERO model calls')
    h.ok(isUserReport(r) || baseline(r), 'returns a safe response (no error)')
  }

  h.section('NO_PRIMARY_ZERO_MODEL')
  {
    const adv = F.ADVERSARIAL.find((x) => x.id === 'A')
    __aiQueue = [validResponse()]
    const r = await call(v6event(adv.answers), 'ON', 'u1', 'u1')
    h.eq(__aiCalls.length, 0, 'NO_PRIMARY → ZERO model calls')
    h.ok(isUserReport(r), 'NO_PRIMARY → deterministic B2 user report (no AI overclaim)')
    const txt = JSON.stringify(r.data.cards)
    h.ok(txt.indexOf('DIRECTION_GAP') === -1 && txt.indexOf('ACTION_GAP') === -1, 'no ontology leak on NO_PRIMARY')
  }

  h.section('ON_PRIMARY_RESPONSE_IS_USER_REPORT')
  {
    __aiQueue = [validResponse()]
    const r = await call(v6event(G06.answers), 'ON', 'u1', 'u1')
    h.eq(r.data.reportType, 'turnaround_strategy_v6', 'reportType present')
    h.eq(r.data.v6PrimaryActive, true, 'v6PrimaryActive=true')
    h.ok(!!r.data.cards, 'cards present for the user')
    h.eq(r.data.reportState, 'PRIMARY', 'reportState=PRIMARY')
  }

  h.section('ON_INTERNAL_METADATA_NOT_EXPOSED')
  {
    __aiQueue = [validResponse()]
    const r = await call(v6event(G06.answers), 'ON', 'u1', 'u1')
    const dumped = JSON.stringify(r)
    for (const banned of ['renderSource', 'shadowTotalLatencyMs', 'attemptLatencyMetrics', 'provenance', 'makeIt'] ) {
      h.ok(dumped.indexOf(banned) === -1, 'response excludes internal field: ' + banned)
    }
    const onLog = __loggedLines.filter((x) => x.indexOf('[V6On] meta ') === 0).pop()
    h.ok(!!onLog, 'safe [V6On] meta logged internally')
    if (onLog) {
      const meta = JSON.parse(onLog.replace('[V6On] meta ', ''))
      h.ok(!('openid' in meta) && !('answers' in meta) && !('prompt' in meta), 'safe meta has no raw fields')
      h.ok(typeof meta.renderSource === 'string', 'safe meta has renderSource')
      h.ok('shadowTotalLatencyMs' in meta, 'safe meta carries latency telemetry')
    }
  }

  h.section('NON_V6_PRODUCTION_UNCHANGED')
  {
    // A non-V6 request must not consult V6 modules and must not expose any V6
    // marker. (The legacy V3 branch has a pre-existing unrelated TDZ on
    // AI-failure; we only assert a structured, V6-free response here.)
    __aiQueue = []
    const r = await call({ type: 'diagnostic', answers: {} }, 'ON', 'u1', 'u1')
    h.ok(r && typeof r.code === 'number', 'non-V6 request returns a structured response')
    h.ok(!('v6PrimaryActive' in (r.data || {})), 'non-V6 response has no V6 marker')
    h.ok(__loggedLines.filter((x) => x.indexOf('[V6On] meta ') === 0).length === 0, 'non-V6 request never runs the ON path')
  }
}

run().then(() => {
  console.log = origLogImpl
  const s = h.summary('R21 ON mode')
  if (s.failed) process.exitCode = 1
}).catch((e) => { console.log = origLogImpl; origLogImpl('R21 ON TEST ERROR', e && e.stack || e); process.exitCode = 2 })
