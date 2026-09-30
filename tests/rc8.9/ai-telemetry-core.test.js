#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/ai-telemetry-core.test.js
 *
 * RC8.9C_R1A — canonical v2 AI telemetry core.
 *
 * Coverage (mission §11):
 *  provider success → SUCCESS · provider HTTP error → PROVIDER_ERROR ·
 *  timeout → TIMEOUT · invalid payload → INVALID_RESPONSE ·
 *  validation failure → VALIDATION_ERROR · pure rule fallback → NO row ·
 *  missing usage → tokens null / cost null · unknown model → cost null ·
 *  tiny valid cost → not rounded to 0 · telemetry write failure →
 *  user flow continues + observable server log.
 *
 * Node built-ins only. Runnable from repo root.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const CF = path.join(ROOT, 'cloudfunctions')
const GEN = path.join(CF, 'generateAiReport')
const read = (p) => fs.readFileSync(p, 'utf8')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const pricing = require(path.join(GEN, 'lib', 'aiPricing.js'))
const telemetry = require(path.join(GEN, 'lib', 'aiTelemetry.js'))

// ── in-memory DB ──────────────────────────────────────────────────────────
function makeDB(seed, beh) {
  beh = beh || {}
  const store = Object.assign({ users: [], user_profiles: [], ai_logs: [], ai_reports: [] }, seed || {})
  const match = (doc, w) => Object.keys(w || {}).every(k => doc[k] === w[k])
  function q(name) {
    let _w = {}, _limit = null
    const b = {
      where: (w) => { _w = w || {}; return b },
      limit: (n) => { _limit = n; return b },
      field: () => b, orderBy: () => b, skip: () => b,
      count: () => Promise.resolve({ total: (store[name] || []).filter(d => match(d, _w)).length }),
      get: () => { let l = (store[name] || []).filter(d => match(d, _w)); if (_limit) l = l.slice(0, _limit); return Promise.resolve({ data: l }) },
      add: ({ data }) => {
        if (beh[name] && beh[name].reject) return Promise.reject(new Error('simulated ' + name + ' add fail'))
        store[name] = store[name] || []; store[name].push(data); return Promise.resolve({ _id: 'id' + store[name].length })
      },
      update: () => Promise.resolve({ stats: { updated: 1 } }),
    }
    return b
  }
  return { command: { gte: (v) => ({ $gte: v }), neq: (v) => ({ $ne: v }) }, collection: (n) => q(n), _store: store }
}

// ── fake console (capture errors) ─────────────────────────────────────────
function makeConsole() {
  const logs = []
  return { logs, log: (...a) => logs.push(['log', ...a]), warn: (...a) => logs.push(['warn', ...a]), error: (...a) => logs.push(['error', ...a]) }
}

// ── load lib/ai.js with a fake axios ──────────────────────────────────────
function loadAi(axiosImpl, env, cons) {
  const src = read(path.join(GEN, 'lib', 'ai.js'))
  const mod = { exports: {} }
  const ctx = {
    module: mod, exports: mod.exports,
    require: (id) => { if (id === 'axios') return axiosImpl; return require(id) },
    console: cons || console, process: { env: Object.assign({ AI_API_KEY: 'sk-test', AI_API_BASE_URL: 'https://api.deepseek.com/v1' }, env || {}) },
    setTimeout, clearTimeout, Promise, Object, Date, Math, JSON, Array, String, Number, RegExp, parseInt, parseFloat, isFinite, isNaN,
  }
  vm.runInNewContext(src, ctx, { filename: path.join(GEN, 'lib', 'ai.js') })
  return mod.exports
}

const okAxios = (body) => async () => ({ status: 200, data: body })
const successBody = { choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } }

// ── load generateAiReport (full) with mocked runtime ──────────────────────
function loadGenAiReport(db, canned, cons) {
  const src = read(path.join(GEN, 'index.js'))
  const mod = { exports: {} }
  const cloud = { DYNAMIC_CURRENT_ENV: 'dyn', init() {}, database: () => db, getWXContext: () => ({ OPENID: 'oZa463Yb2VY0k9Es_pGzdHFtigNo' }) }
  const fakeRequire = (id) => {
    if (id === 'wx-server-sdk') return cloud
    if (id === './lib/response.js') return require(path.join(GEN, 'lib', 'response.js'))
    if (id === './lib/permission.js') return { checkVip: async () => true }
    if (id === './lib/ai.js') return { callAI: async () => ({ success: true, content: '{}' }), buildReportPrompt: () => ({}), buildCoachingPrompt: () => ({}) }
    if (id === './lib/order.js') return { generateReportId: () => 'AR_TEST', now: () => Date.now() }
    if (id === './lib/aiTelemetry.js') return require(path.join(GEN, 'lib', 'aiTelemetry.js'))
    if (id === './lib/aiPricing.js') return require(path.join(GEN, 'lib', 'aiPricing.js'))
    if (id === './lib/reportStore6q.js') return require(path.join(GEN, 'lib', 'reportStore6q.js'))
    if (id === './lib/legacy6q/legacy6qRuntime.js') return { runLegacy6QReport: async () => JSON.parse(JSON.stringify(canned)) }
    if (id === './lib/memoryEngine.js') return { isMemoryEnabled: async () => false, getRelevantMemories: async () => [], formatMemoryForPrompt: () => '', updateUserMemory: async () => ({ code: 0 }) }
    if (id === './lib/memoryExtractor.js') return { extractFromMessage: () => null }
    if (id === './lib/raw6qStore.js') return { persistRaw6Q: async () => ({ ok: true, rawId: 'raw_test' }), loadLatestRaw6Q: async () => null }
    if (id === './lib/context/coachingContextRuntime.js') return { runCoachingTurn: async () => ({ ok: true, aiResult: { success: true, content: '{}' }, ctx: {}, attempts: 1, validation: { ok: true } }) }
    if (id === './lib/context/userContextBuilder.js') return { SCENARIO_NAME_TO_KEY: {} }
    return require(id)
  }
  const ctx = { module: mod, exports: mod.exports, require: fakeRequire, console: cons || console, process, setTimeout, clearTimeout, Promise, Object, Date, Math, JSON, Array, String, Number, RegExp, parseInt, parseFloat, isFinite, isNaN }
  vm.runInNewContext(src, ctx, { filename: path.join(GEN, 'index.js') })
  return mod.exports.main
}

// find a UTC ts whose BEIJING (UTC+8) weekday+hour match (deterministic)
function tsBeijing(weekday, hour) {
  for (let m = 0; m < 12; m++) {
    for (let day = 1; day <= 31; day++) {
      const ts = Date.UTC(2026, m, day, ((hour - 8) + 24) % 24, 0, 0)
      const bj = new Date(ts + 8 * 3600 * 1000)
      if (bj.getUTCDay() === weekday && bj.getUTCHours() === hour && bj.getUTCMonth() === m && bj.getUTCDate() === day) return ts
    }
  }
  throw new Error('no ts')
}

;(async () => {
  console.log('RC8.9C_R1A AI telemetry core')
  const OWNER = 'oZa463Yb2VY0k9Es_pGzdHFtigNo'
  const OFFPEAK = tsBeijing(1, 20)   // Monday 20:00 Beijing → off-peak
  const PEAK = tsBeijing(1, 10)      // Monday 10:00 Beijing → peak
  const SUNDAY = tsBeijing(0, 10)    // Sunday 10:00 → off-peak

  // ── T1: provider success → SUCCESS + full capture ──────────────────────
  {
    const ai = loadAi(okAxios(successBody), { AI_MODEL_FLASH: 'deepseek-chat' })
    const r = await ai.callAI({ systemPrompt: 'S', userMessage: 'U', maxTokens: 10 })
    ok(r.success === true && r.providerErrorCode === null, 'T1: callAI success')
    const row = telemetry.buildV2Row(r, { requestAttempted: true, ts: OFFPEAK, latencyMs: r.latencyMs, requestId: 'req-1', reportId: 'rpt_6q_1', productLine: 'turnaround_6q', diagnosticVersion: 'turnaround_strategy_6q_v1', openid: OWNER })
    ok(row.telemetryVersion === 2, 'T1: telemetryVersion=2')
    ok(row.operation === 'model_call', 'T1: operation=model_call')
    ok(row.status === 'SUCCESS', 'T1: status SUCCESS')
    ok(row.provider === 'DeepSeek', `T1: provider captured (${row.provider})`)
    ok(row.model === 'deepseek-chat', `T1: model captured (${row.model})`)
    ok(row.inputTokens === 100 && row.outputTokens === 50 && row.totalTokens === 150, 'T1: token usage captured')
    ok(typeof row.latencyMs === 'number' && row.latencyMs >= 0, 'T1: latencyMs captured')
    ok(typeof row.estimatedCostCny === 'number' && row.estimatedCostCny > 0, `T1: cost numeric > 0 (${row.estimatedCostCny})`)
    ok(row.requestId === 'req-1' && row.reportId === 'rpt_6q_1', 'T1: requestId + reportId correlated')
    ok(row.createdAt === OFFPEAK && row.currency === 'CNY', 'T1: createdAt + currency')
    const forbidden = ['prompt', 'apiKey', 'authorization', 'rawResponse', 'content', 'completion', 'reasoning']
    ok(forbidden.every((k) => !(k in row)), 'T1/privacy: no prompt/key/auth/raw-response/CoT fields')
  }

  // ── T2: provider HTTP error → PROVIDER_ERROR ───────────────────────────
  {
    const err = async () => { const e = new Error('Request failed with status code 401'); e.response = { status: 401 }; throw e }
    const ai = loadAi(err, { AI_MODEL_FLASH: 'deepseek-chat' }, makeConsole())
    const r = await ai.callAI({ systemPrompt: 'S', userMessage: 'U' })
    ok(r.success === false && r.providerErrorCode === 'AI_PROVIDER_UNAUTHORIZED', `T2: 401 classified (${r.providerErrorCode})`)
    const row = telemetry.buildV2Row(r, { requestAttempted: true, ts: OFFPEAK, latencyMs: r.latencyMs, requestId: 'req-2' })
    ok(row.status === 'PROVIDER_ERROR', 'T2: status PROVIDER_ERROR')
    ok(row.errorType === 'AI_PROVIDER_UNAUTHORIZED' && row.errorCode === 401, 'T2: errorType/errorCode captured')
    ok(row.inputTokens === null && row.estimatedCostCny === null && row.costReason === 'USAGE_MISSING', 'T2: missing usage → tokens/cost null')
  }

  // ── T3: timeout → TIMEOUT ──────────────────────────────────────────────
  {
    const to = async () => { const e = new Error('timeout of 60000ms exceeded'); e.code = 'ECONNABORTED'; throw e }
    const ai = loadAi(to, { AI_MODEL_FLASH: 'deepseek-chat' }, makeConsole())
    const r = await ai.callAI({ systemPrompt: 'S', userMessage: 'U' })
    ok(r.providerErrorCode === 'AI_PROVIDER_TIMEOUT', `T3: timeout classified (${r.providerErrorCode})`)
    const row = telemetry.buildV2Row(r, { requestAttempted: true, ts: OFFPEAK, latencyMs: r.latencyMs })
    ok(row.status === 'TIMEOUT', 'T3: status TIMEOUT')
    // runtime injects status TIMEOUT when withTimeout fires
    ok(telemetry.mapStatus({}, 'TIMEOUT') === 'TIMEOUT', 'T3b: explicit TIMEOUT honored')
  }

  // ── T4: invalid payload (empty choices) → INVALID_RESPONSE ─────────────
  {
    const ai = loadAi(okAxios({ choices: [] }), { AI_MODEL_FLASH: 'deepseek-chat' })
    const r = await ai.callAI({ systemPrompt: 'S', userMessage: 'U' })
    ok(r.providerErrorCode === 'AI_PROVIDER_EMPTY_RESPONSE', `T4: empty choices classified (${r.providerErrorCode})`)
    const row = telemetry.buildV2Row(r, { requestAttempted: true, ts: OFFPEAK, latencyMs: r.latencyMs })
    ok(row.status === 'INVALID_RESPONSE', 'T4: status INVALID_RESPONSE')
    ok(row.provider === 'DeepSeek' && row.model === 'deepseek-chat', 'T4: provider/model still captured')
  }

  // ── T5: validation failure → VALIDATION_ERROR ──────────────────────────
  {
    const r = { success: true, providerTrace: { provider: 'DeepSeek', model: 'deepseek-chat' }, usage: successBody.usage }
    const row = telemetry.buildV2Row(r, { requestAttempted: true, ts: OFFPEAK, status: 'VALIDATION_ERROR', latencyMs: 5 })
    ok(row.status === 'VALIDATION_ERROR', 'T5: explicit VALIDATION_ERROR honored')
    ok(telemetry.STATUS.VALIDATION_ERROR === 'VALIDATION_ERROR', 'T5: enum has VALIDATION_ERROR')
  }

  // ── T6: pure rule fallback (no provider call) → NO v2 row ──────────────
  {
    const ai = loadAi(okAxios(successBody), {})
    const r = await ai.callAI({ systemPrompt: 'S', userMessage: 'U' })
    // simulate no-key path result shape (requestAttempted false)
    const noCall = Object.assign({}, r, { providerTrace: { provider: 'DeepSeek', model: 'deepseek-chat', requestAttempted: false } })
    ok(telemetry.buildV2Row(noCall, {}) === null, 'T6: no provider attempt → NO row (null)')
    const db = makeDB({})
    const res = await telemetry.emitModelCall(db, noCall, {})
    ok(res.written === false && res.error === 'NO_PROVIDER_ATTEMPT', 'T6b: emit skips, no write')
    ok((db._store.ai_logs || []).length === 0, 'T6c: ai_logs untouched for pure fallback')
    // runtime attempt list: fallback attempt has requestAttempted=false
    const db2 = makeDB({})
    await telemetry.emitAttempts(db2, [{ attempt: 1, success: false, requestAttempted: false }], { ts: OFFPEAK })
    ok((db2._store.ai_logs || []).length === 0, 'T6d: emitAttempts writes 0 rows for no-call attempts')
  }

  // ── T6e: mixed attempts → one row per REAL call only ───────────────────
  {
    const db = makeDB({})
    await telemetry.emitAttempts(db, [
      { attempt: 1, success: false, requestAttempted: true, providerErrorCode: 'AI_PROVIDER_UNAVAILABLE', httpStatus: 503, provider: 'DeepSeek', model: 'deepseek-chat', latencyMs: 9 },
      { attempt: 2, success: true, requestAttempted: true, provider: 'DeepSeek', model: 'deepseek-chat', usage: successBody.usage, latencyMs: 12 },
      { attempt: 3, success: false, requestAttempted: false },
    ], { requestId: 'rq', reportId: 'rp', ts: OFFPEAK, productLine: 'turnaround_6q' })
    const rows = db._store.ai_logs
    ok(rows.length === 2, `T6e: 2 real calls → 2 rows (${rows.length})`)
    ok(rows.every((r) => r.telemetryVersion === 2 && r.operation === 'model_call'), 'T6e: all rows are v2 model_call')
  }

  // ── T7: missing usage → tokens null + cost null ────────────────────────
  {
    const r = { success: true, providerTrace: { provider: 'DeepSeek', model: 'deepseek-chat' }, usage: null }
    const row = telemetry.buildV2Row(r, { requestAttempted: true, ts: OFFPEAK, latencyMs: 3 })
    ok(row.inputTokens === null && row.outputTokens === null && row.totalTokens === null, 'T7: tokens null (not 0)')
    ok(row.estimatedCostCny === null && row.costReason === 'USAGE_MISSING', 'T7: cost null (not 0)')
  }

  // ── T8: unknown model → cost null (tokens still captured) ──────────────
  {
    const r = { success: true, providerTrace: { provider: 'DeepSeek', model: 'gpt-4o' }, usage: successBody.usage }
    const row = telemetry.buildV2Row(r, { requestAttempted: true, ts: OFFPEAK, latencyMs: 4 })
    ok(row.totalTokens === 150, 'T8: tokens captured for unknown model')
    ok(row.estimatedCostCny === null && row.costReason === 'MODEL_NOT_PRICED', 'T8: unknown model → cost null + reason')
  }

  // ── T9: tiny valid cost → NOT rounded to 0 ─────────────────────────────
  {
    const r = { success: true, providerTrace: { provider: 'DeepSeek', model: 'deepseek-flash' }, usage: { prompt_tokens: 1, completion_tokens: 0, total_tokens: 1 } }
    const row = telemetry.buildV2Row(r, { requestAttempted: true, ts: OFFPEAK, latencyMs: 2 })
    ok(row.estimatedCostCny > 0 && row.estimatedCostCny === 0.000001, `T9: tiny cost preserved (${row.estimatedCostCny})`)
    ok(row.priceBasis === 'OFF_PEAK', 'T9: off-peak basis')
  }

  // ── T9b/T9c: exact costs + peak/off-peak ───────────────────────────────
  {
    const flashFull = pricing.estimateCostCny({ provider: 'DeepSeek', model: 'deepseek-flash', inputTokens: 1e6, outputTokens: 1e6, tsMs: OFFPEAK })
    ok(flashFull.estimatedCostCny === 5, `T9b: flash off-peak 1M/1M = ¥5 (${flashFull.estimatedCostCny})`)
    const flashPeak = pricing.estimateCostCny({ provider: 'DeepSeek', model: 'deepseek-flash', inputTokens: 1e6, outputTokens: 1e6, tsMs: PEAK })
    ok(flashPeak.estimatedCostCny === 10, `T9b: flash peak = ¥10 (${flashPeak.estimatedCostCny})`)
    const proOff = pricing.estimateCostCny({ provider: 'DeepSeek', model: 'deepseek-v4-pro', inputTokens: 1e6, outputTokens: 1e6, tsMs: OFFPEAK })
    ok(proOff.estimatedCostCny === 18, `T9b: pro off-peak = ¥18 (${proOff.estimatedCostCny})`)
    const sun = pricing.estimateCostCny({ provider: 'DeepSeek', model: 'deepseek-flash', inputTokens: 1e6, outputTokens: 0, tsMs: SUNDAY })
    ok(sun.estimatedCostCny === 1 && sun.priceBasis === 'OFF_PEAK', `T9c: Sunday 10:00 is off-peak (${sun.priceBasis})`)
    ok(pricing.isPeak(PEAK) === true && pricing.isPeak(OFFPEAK) === false, 'T9c: peak classifier (Beijing business tz)')
  }

  // ── T10: telemetry write failure → non-blocking + observable ───────────
  {
    const captured = []
    const orig = console.error
    console.error = (...a) => { captured.push(a.map(String).join(' ')) }
    try {
      const db = makeDB({}, { ai_logs: { reject: true } })
      const r = { success: true, providerTrace: { provider: 'DeepSeek', model: 'deepseek-flash', requestAttempted: true }, usage: successBody.usage }
      const res = await telemetry.emitModelCall(db, r, { ts: OFFPEAK, latencyMs: 5 })
      ok(res.written === false && res.attempts === 3, `T10: write failed after retries (attempts=${res.attempts})`)
    } finally { console.error = orig }
    ok(captured.some((l) => l.indexOf('TELEMETRY_WRITE_FAILED') >= 0), 'T10: TELEMETRY_WRITE_FAILED observable in server log')
  }

  // ── T10b: full 6Q run survives telemetry-write failure ─────────────────
  {
    const captured = []
    const orig = console.error
    console.error = (...a) => { captured.push(a.map(String).join(' ')) }
    let r
    try {
      const canned = {
        reportState: 'PRIMARY', reportType: 'turnaround_6q', diagnosticVersion: 'turnaround_strategy_6q_v1',
        system_trap: 'T', core_problem: 'C', fatal_sentence: 'F', strategy_path: 'P', advice: ['a'],
        _meta: { renderSource: 'ai', parsePath: 'JSON', fallbackFields: [], latencyMs: 20, modelCalls: 1, attempts: [{ attempt: 1, success: true, requestAttempted: true, provider: 'DeepSeek', model: 'deepseek-flash', usage: successBody.usage, latencyMs: 20, parsePath: 'JSON', fallbackFields: [] }] },
      }
      const db = makeDB({ users: [{ openid: OWNER }] }, { ai_logs: { reject: true } })
      const main = loadGenAiReport(db, canned, makeConsole())
      r = await main({ type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_6q_v1', answers: {}, requestId: 'req-wf' }, {})
      await new Promise((res) => setTimeout(res, 1500))
      ok(r.code === 0 && r.data.reportPersistence === 'PERSISTED', `T10b: report delivered despite telemetry failure (${r.code})`)
      ok((db._store.ai_reports || []).length === 1, 'T10b: report persisted')
    } finally { console.error = orig }
    ok(captured.some((l) => l.indexOf('TELEMETRY_WRITE_FAILED') >= 0), 'T10b: failure observable')
  }

  // ── T11: END-TO-END v2 row written on a healthy 6Q run ─────────────────
  {
    const canned = {
      reportState: 'PRIMARY', reportType: 'turnaround_6q', diagnosticVersion: 'turnaround_strategy_6q_v1',
      system_trap: 'T', core_problem: 'C', fatal_sentence: 'F', strategy_path: 'P', advice: ['a'],
      _meta: { renderSource: 'ai', parsePath: 'JSON', fallbackFields: [], latencyMs: 42, modelCalls: 1, attempts: [{ attempt: 1, success: true, requestAttempted: true, provider: 'DeepSeek', model: 'deepseek-flash', usage: { prompt_tokens: 1234, completion_tokens: 567, total_tokens: 1801 }, latencyMs: 42, parsePath: 'JSON', fallbackFields: [] }] },
    }
    const db = makeDB({ users: [{ openid: OWNER }] })
    const main = loadGenAiReport(db, canned)
    const r = await main({ type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_6q_v1', answers: {}, requestId: 'req-e2e' }, {})
    await new Promise((res) => setTimeout(res, 80))
    const v2 = (db._store.ai_logs || []).filter((l) => l.telemetryVersion === 2 && l.operation === 'model_call')
    ok(v2.length === 1, `T11: exactly one v2 model_call row (§8 no dup) (${v2.length})`)
    const row = v2[0] || {}
    ok(row.status === 'SUCCESS' && row.provider === 'DeepSeek' && row.model === 'deepseek-flash', 'T11: status/provider/model')
    ok(row.inputTokens === 1234 && row.outputTokens === 567 && row.totalTokens === 1801, 'T11: token usage')
    ok(row.latencyMs === 42, 'T11: provider-call latency (not report duration)')
    ok(typeof row.estimatedCostCny === 'number' && row.estimatedCostCny > 0, 'T11: cost numeric')
    ok(row.requestId === 'req-e2e', 'T11: requestId present')
    ok(row.reportId && row.reportId === r.data.reportId, 'T11: reportId correlates to delivered report')
    ok(row.productLine === 'turnaround_6q' && row.diagnosticVersion === 'turnaround_strategy_6q_v1', 'T11: productLine/diagnosticVersion')
  }

  // ── T12: reuse ai_logs (no new collection), enum, price table meta ──────
  {
    const telSrc = read(path.join(GEN, 'lib', 'aiTelemetry.js'))
    const cols = Array.from(telSrc.matchAll(/collection\(['"]([^'"]+)['"]\)/g)).map((m) => m[1])
    ok(cols.length > 0 && cols.every((c) => c === 'ai_logs'), `T12: writes ONLY ai_logs (${[...new Set(cols)].join(',')})`)
    ok(!/createCollection/.test(telSrc), 'T12: no createCollection')
    const enumVals = Object.values(telemetry.STATUS)
    ok(enumVals.length === 5 && enumVals.includes('SUCCESS') && enumVals.includes('PROVIDER_ERROR') && enumVals.includes('TIMEOUT') && enumVals.includes('INVALID_RESPONSE') && enumVals.includes('VALIDATION_ERROR'), 'T12: 5-value status enum')
    ok(pricing.PRICE_SOURCE_URL.indexOf('deepseek.com') >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(pricing.PRICE_TABLE_VERSION.replace('deepseek-cny-', '')), 'T12: price table versioned + sourced')
    ok(pricing.estimateCostCny({ provider: 'DeepSeek', model: 'deepseek-flash', inputTokens: 0, outputTokens: 0, tsMs: OFFPEAK }).estimatedCostCny === 0, 'T12: genuine 0-usage → ¥0 (allowed when usage present)')
  }

  console.log(`  _TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
