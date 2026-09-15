'use strict'
/**
 * tests/v6/shadow/rc8.4-v6-shadow-wiring.test.js
 *
 * B2.5 (R1) production-wiring-prep tests, updated for R12 (draft→editor).
 * NO network, NO model, NO key.
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
 *   SHADOW_INVALID_JSON_PRIMARY_RESPONSE_IDENTICAL · SHADOW_FIELD_FALLBACK_CONTAINED
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
let __allowlist = null // RC84_V6_SHADOW_ALLOWLIST (null = unset)
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
  if (/draftReportRuntimeV6(\.js)?$/.test(request)) {
    const real = originalLoad.apply(this, arguments)
    // Wrap to (a) capture the runtime output for internal assertions and
    //     (b) inject test-only budget overrides. Production callers never see this.
    return Object.assign({}, real, {
      runDraftReportRuntimeV6: async (a, o) => {
        const opts = Object.assign({}, o || {})
        if (__testAttemptTimeoutMs != null) opts.attemptTimeoutMs = __testAttemptTimeoutMs
        if (__testTotalBudgetMs != null) opts.totalBudgetMs = __testTotalBudgetMs
        const out = await real.runDraftReportRuntimeV6(a, opts)
        __lastRuntimeOut = out
        return out
      },
    })
  }
  return originalLoad.apply(this, arguments)
}
const index = require(INDEX_PATH)

// ── helpers ─────────────────────────────────────────────────────
/** A valid AI DRAFT (material only) — passes draft + final validators for G06. */
function validResponse (answers) {
  return {
    success: true, tokens: 10, finishReason: 'stop',
    content: JSON.stringify({
      draftVersion: 'turnaround_strategy_v6_worldview_draft_v1',
      insightCandidates: [
        '你以为缺的是资源，其实你缺的是一次真正开始；学过的东西一直没变成第一个真实结果。',
        '你以为问题是没钱，其实是你把准备当成了安全感，从没让市场给过你一次反馈。'
      ],
      mechanismExplanation: '你把学习当成前进，但它不产生外部反馈；越不确定就越想先想清楚，结果真实结果永远是零，压力却在累积。',
      transitionExplanation: '下一阶段的规则不是想清楚再动，而是先做一个零成本、失败也不伤现金流的最小验证。',
      actionExplanation: '所以今天该做的，是不花钱、能立刻拿到外部反馈的那一个最小动作。'
    }),
  }
}
/** A draft whose fields ALL leak internal ontology → every AI field falls back. */
function leakResponse (answers) {
  return {
    success: true, tokens: 10, finishReason: 'stop',
    content: JSON.stringify({
      draftVersion: 'turnaround_strategy_v6_worldview_draft_v1',
      insightCandidates: ['你在LEARNING阶段，瓶颈是ACTION_GAP，所以要先动起来。'],
      mechanismExplanation: 'ACTION_GAP 让你停在准备里，DIAGNOSIS 显示你从没开始。',
      transitionExplanation: '从 LEARNING 阶段进入下一个阶段，规则会变。',
      actionExplanation: 'CASHFLOW_SAFE_EXPERIMENT 是这里的动作类型。'
    }),
  }
}
function invalidJsonResponse () { return { success: true, tokens: 3, finishReason: 'stop', content: 'not json {{{' } }

function setMode (v) {
  if (v === undefined) delete process.env.RC84_V6_WORLDVIEW_MODE
  else process.env.RC84_V6_WORLDVIEW_MODE = v
}
function setAllowlist (v) {
  if (v === undefined || v === null) delete process.env.RC84_V6_SHADOW_ALLOWLIST
  else process.env.RC84_V6_SHADOW_ALLOWLIST = v
}
async function call (event, mode, openid, allowlist) {
  setMode(mode)
  if (allowlist !== undefined) setAllowlist(allowlist)
  __openid = openid || 'u1'
  __aiCalls = []; __writes = []
  return index.main(event, {})
}
const AL = 'u1,u2'
function resetBudgets () { __testAttemptTimeoutMs = null; __testTotalBudgetMs = null; __aiMode = 'queue' }
function v6event (answers, extra) { return Object.assign({ type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_v6', answers }, extra || {}) }

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
    h.eq(M.V6_SHADOW_ALLOWLIST_ENV, 'RC84_V6_SHADOW_ALLOWLIST', 'allowlist env name')
  }

  h.section('SHADOW ALLOWLIST parser (fail-closed)')
  {
    h.eq(M.parseV6ShadowAllowlist(undefined).size, 0, 'undefined → empty set')
    h.eq(M.parseV6ShadowAllowlist('').size, 0, 'empty → empty set')
    h.eq(M.parseV6ShadowAllowlist('   ').size, 0, 'whitespace → empty set')
    h.eq(M.parseV6ShadowAllowlist('u1, u2 ,u3').size, 3, 'comma split + trim')
    h.eq(M.isV6ShadowAuthorized('u1', ''), false, 'empty allowlist → deny')
    h.eq(M.isV6ShadowAuthorized('u1', undefined), false, 'missing allowlist → deny')
    h.eq(M.isV6ShadowAuthorized('u2', 'u1,u2'), true, 'match → authorize')
    h.eq(M.isV6ShadowAuthorized('u9', 'u1,u2'), false, 'miss → deny')
    h.eq(M.isV6ShadowAuthorized('', 'u1'), false, 'empty openid → deny')
  }

  const OFF_RESP = await call(v6event(G06.answers), 'OFF')

  h.section('OFF_ZERO_CALL')
  {
    delete process.env.RC84_V6_WORLDVIEW_MODE
    let r = await call(v6event(G06.answers), undefined, 'u1', AL)
    h.eq(__aiCalls.length, 0, 'ZERO model calls (unset)')
    r = await call(v6event(G06.answers), 'OFF', 'u1', AL)
    h.eq(__aiCalls.length, 0, 'ZERO model calls (OFF)')
    r = await call(v6event(G06.answers), 'garbage', 'u1', AL)
    h.eq(__aiCalls.length, 0, 'ZERO model calls (garbage → OFF)')
    r = await call(v6event(G06.answers), 'ON', 'u1', AL)
    h.eq(__aiCalls.length, 0, 'ZERO model calls (ON not enabled)')
  }

  h.section('SHADOW_ALLOWLIST_EMPTY_DENY_ALL')
  {
    setAllowlist(undefined)
    __aiQueue = [validResponse(G06.answers)]
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', undefined)
    h.eq(__aiCalls.length, 0, 'empty allowlist → ZERO V6 calls')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'empty allowlist → response == OFF')
    __aiQueue = [validResponse(G06.answers)]
    const r2 = await call(v6event(G06.answers), 'SHADOW', 'u1', '   ')
    h.eq(__aiCalls.length, 0, 'whitespace allowlist → ZERO V6 calls')
  }

  h.section('SHADOW_ALLOWLIST_MATCH_CALLS_V6 + SERVER_OPENID_CAN_AUTHORIZE')
  {
    __aiQueue = [validResponse(G06.answers)]
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    h.eq(__aiCalls.length, 1, 'allowlisted SERVER openid → V6 chain runs')
    h.eq(__lastRuntimeOut.meta.renderSource, 'ai_draft_edited', 'renderSource=ai_draft_edited')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response still == OFF')
  }

  h.section('SHADOW_ALLOWLIST_MISS_ZERO_V6_CALL + MISS_RESPONSE_EQUALS_OFF')
  {
    __aiQueue = [validResponse(G06.answers)]
    const r = await call(v6event(G06.answers), 'SHADOW', 'intruder', AL)
    h.eq(__aiCalls.length, 0, 'non-allowlisted server openid → ZERO V6 calls')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'non-allowlisted → response == OFF')
  }

  h.section('CLIENT_OPENID_CANNOT_AUTHORIZE')
  {
    __aiQueue = [validResponse(G06.answers)]
    const r = await call(v6event(G06.answers, { openid: 'u2', _openid: 'u2' }), 'SHADOW', 'u1', 'u2')
    h.eq(__aiCalls.length, 0, 'client-supplied openid grants NO access (server u1 not listed)')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response == OFF')
  }

  h.section('OFF_RESPONSE_COMPAT')
  {
    const a = await call(v6event(G06.answers), undefined)
    const b = await call(v6event(G06.answers), 'OFF')
    const c = await call(v6event(G06.answers), 'garbage')
    h.ok(JSON.stringify(a) === JSON.stringify(b), 'unset ≡ OFF (byte-identical)')
    h.ok(JSON.stringify(a) === JSON.stringify(c), 'garbage ≡ OFF (byte-identical)')
    h.ok(!('renderSource' in a.data) && !('v6Mode' in a.data) && !('v6Shadow' in a.data), 'OFF exposes no v6 internals')
  }

  h.section('SHADOW_PRIMARY_RESPONSE_IDENTICAL')
  {
    __aiQueue = [validResponse(G06.answers)]
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'SHADOW response byte-identical to OFF')
    h.ok(JSON.stringify(r).indexOf('致命一句话') === -1, 'no V6 card copy in response')
    h.ok(!('v6Shadow' in r.data) && !('renderSource' in r.data), 'no shadow ack / renderSource leak')
    h.eq(__aiCalls.length, 1, 'model DID run on the side path')
  }

  h.section('SHADOW_FIRST_PASS')
  {
    __aiQueue = [validResponse(G06.answers)]
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    h.eq(__lastRuntimeOut.meta.renderSource, 'ai_draft_edited', 'runtime renderSource=ai_draft_edited')
    h.eq(__lastRuntimeOut.meta.attemptCount, 1, 'attemptCount=1')
    h.eq(__lastRuntimeOut.meta.draftHardFailures.length, 0, 'no draft hard failures')
    h.eq(__lastRuntimeOut.meta.finalHardFailures.length, 0, 'no final hard failures')
    h.eq(__lastRuntimeOut.meta.editor.fieldsFellBack.length, 0, 'no field fallback')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  h.section('SHADOW_RETRY_PASS')
  {
    __aiQueue = [invalidJsonResponse(), validResponse(G06.answers)]
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    h.eq(__lastRuntimeOut.meta.renderSource, 'ai_draft_edited', 'renderSource=ai_draft_edited')
    h.eq(__lastRuntimeOut.meta.attemptCount, 2, 'attemptCount=2 (retry)')
    h.eq(__aiCalls.length, 2, 'exactly 2 model calls')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  h.section('SHADOW_DOUBLE_FAIL_PRIMARY_RESPONSE_IDENTICAL')
  {
    __aiQueue = [invalidJsonResponse(), invalidJsonResponse()]
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    h.eq(__lastRuntimeOut.meta.renderSource, 'deterministic_fallback', 'runtime whole-report fallback')
    h.eq(__lastRuntimeOut.meta.fallbackReason, 'INVALID_JSON', 'fallbackReason=INVALID_JSON')
    h.eq(__aiCalls.length, 2, 'MAX_MODEL_ATTEMPTS=2 respected')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  h.section('SHADOW_TIMEOUT_PRIMARY_RESPONSE_IDENTICAL')
  {
    __testAttemptTimeoutMs = 5
    __aiMode = 'hang'
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    resetBudgets()
    h.eq(__lastRuntimeOut.meta.renderSource, 'deterministic_fallback', 'timeout → fallback')
    h.eq(__lastRuntimeOut.meta.fallbackReason, 'MODEL_TIMEOUT', 'fallbackReason=MODEL_TIMEOUT')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  h.section('SHADOW_INVALID_JSON_PRIMARY_RESPONSE_IDENTICAL')
  {
    __aiQueue = [invalidJsonResponse(), invalidJsonResponse()]
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    h.eq(__lastRuntimeOut.meta.renderSource, 'deterministic_fallback', 'fallback')
    h.eq(__lastRuntimeOut.meta.fallbackReason, 'INVALID_JSON', 'fallbackReason=INVALID_JSON')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  h.section('SHADOW_FIELD_FALLBACK_CONTAINED (unsafe AI fields never reach final cards)')
  {
    __aiQueue = [leakResponse(G06.answers)]
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    h.eq(__lastRuntimeOut.meta.renderSource, 'ai_draft_edited', 'still ai_draft_edited (field-level fallback)')
    h.eq(__lastRuntimeOut.meta.editor.fieldsFellBack.length, 4, 'all 4 unsafe fields fell back to B2')
    h.eq(__lastRuntimeOut.meta.editor.fieldsUsed.length, 0, 'no unsafe field used')
    h.eq(__lastRuntimeOut.meta.finalHardFailures.length, 0, 'final report still valid (no bypass)')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  h.section('PROVIDER_ERROR_PRIMARY_RESPONSE_IDENTICAL')
  {
    __aiMode = 'fail'
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    resetBudgets()
    h.eq(__lastRuntimeOut.meta.renderSource, 'deterministic_fallback', 'provider error → fallback')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
    h.eq(r.code, 0, 'request still succeeds (code 0)')
  }

  h.section('INVALID_INPUT_ZERO_MODEL_CALL + NO_PRIMARY_ZERO_MODEL_CALL')
  {
    __aiQueue = [validResponse(G06.answers)]
    const ri = await call(v6event({}), 'SHADOW', 'u1', AL)
    h.eq(__aiCalls.length, 0, 'INVALID_INPUT → ZERO model calls')
    h.eq(__lastRuntimeOut.meta.fallbackReason, 'INVALID_INPUT', 'reason=INVALID_INPUT')
    h.ok(JSON.stringify(ri) === JSON.stringify(OFF_RESP), 'response identical to OFF')

    __aiQueue = [validResponse(ADV_A.answers)]
    const rn = await call(v6event(ADV_A.answers), 'SHADOW', 'u1', AL)
    h.eq(__aiCalls.length, 0, 'NO_PRIMARY → ZERO model calls')
    h.eq(__lastRuntimeOut.meta.fallbackReason, 'NO_PRIMARY', 'reason=NO_PRIMARY')
    h.ok(JSON.stringify(rn) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  h.section('TOTAL_BUDGET_FALLBACK + SECOND_ATTEMPT_SKIPPED_WHEN_BUDGET_INSUFFICIENT')
  {
    __testTotalBudgetMs = 5
    __testAttemptTimeoutMs = 14000
    __aiQueue = [invalidJsonResponse(), validResponse(G06.answers)]
    const r = await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    resetBudgets()
    h.eq(__aiCalls.length, 1, '2nd attempt SKIPPED (budget insufficient)')
    h.eq(__lastRuntimeOut.meta.attemptCount, 1, 'attemptCount=1')
    h.eq(__lastRuntimeOut.meta.fallbackReason, 'TOTAL_BUDGET_EXHAUSTED', 'fallbackReason=TOTAL_BUDGET_EXHAUSTED')
    h.eq(__lastRuntimeOut.meta.renderSource, 'deterministic_fallback', 'deterministic fallback')
    h.ok(JSON.stringify(r) === JSON.stringify(OFF_RESP), 'response identical to OFF')
  }

  h.section('BUDGET_CONSTANTS')
  {
    const rt = require(path.join(V6, 'experimental/draft/draftReportRuntimeV6.js'))
    h.eq(rt.MODEL_ATTEMPT_TIMEOUT_MS, 14000, 'MODEL_ATTEMPT_TIMEOUT_MS=14000')
    h.eq(rt.MAX_MODEL_ATTEMPTS, 2, 'MAX_MODEL_ATTEMPTS=2')
    h.eq(rt.TOTAL_WORLDVIEW_BUDGET_MS, 30000, 'TOTAL_WORLDVIEW_BUDGET_MS=30000')
    h.eq(rt.DRAFT_MAX_TOKENS, 2400, 'DRAFT_MAX_TOKENS=2400')
    h.ok(rt.MODEL_ATTEMPT_TIMEOUT_MS * rt.MAX_MODEL_ATTEMPTS < 60000, '2×timeout < function timeout')
  }

  h.section('V21_NON_INTERFERENCE')
  {
    const ev = { type: 'diagnostic', diagnosticVersion: 'world_model_v2_1', answers: {} }
    const a = await call(ev, 'OFF', 'u1', AL)
    const b = await call(ev, 'SHADOW', 'u1', AL)
    const c = await call(ev, 'ON', 'u1', AL)
    h.ok(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) === JSON.stringify(c),
      'v2.1 response identical across RC84_V6_WORLDVIEW_MODE values (diff=0)')
    h.eq(a.data.diagnosticVersion, 'world_model_v2_1', 'v2.1 path not hijacked by V6 flag')
    h.eq(__aiCalls.length, 0, 'no model call on non-v6 path')
  }

  h.section('PLACEHOLDER_DEPLOY_GUARD_PASS')
  {
    const cbrc = JSON.parse(fs.readFileSync(path.join(ROOT, 'cloudbaserc.json'), 'utf8'))
    const f = (cbrc.functions || []).find(x => x.name === 'generateAiReport')
    const key = f && f.envVariables ? String(f.envVariables.AI_API_KEY || '') : ''
    h.ok(/^<.*>$/.test(key), 'tracked AI_API_KEY is an <...> placeholder (not a live secret)')
    h.ok(!/^sk-/.test(key), 'tracked AI_API_KEY is not a real key')
    const plan = fs.readFileSync(path.join(ROOT, 'docs/design/RC8.4_V6_INTERNAL_SHADOW_DEPLOY_PLAN.md'), 'utf8')
    h.ok(/tcb fn code update generateAiReport/.test(plan), 'deploy plan uses code-only update')
    const unsafeAsStep = (function () {
      const fences = plan.split('```')
      const out = []
      for (let i = 1; i < fences.length; i += 2) {
        for (const raw of fences[i].split('\n')) {
          const line = raw.trim()
          if (line.startsWith('#')) continue
          if (/^tcb fn deploy generateAiReport/.test(line)) out.push(line)
        }
      }
      return out
    })()
    h.eq(unsafeAsStep.length, 0, 'deploy plan never runs env-applying tcb fn deploy as an executable step')
  }

  h.section('R2_CASHFLOW_SAFE_VALIDATOR_CONTRACT')
  {
    const { validateWorldviewV6, ACTION_SIGS } = require(path.join(V6, 'experimental/runtime/worldviewValidatorV6.js'))
    const copy = require(path.join(V6, 'report/reportCopyV6.js'))
    const canonical = copy.ACTION_EXPRESSION.CASHFLOW_SAFE_EXPERIMENT
    const sig = ACTION_SIGS.CASHFLOW_SAFE_EXPERIMENT

    h.eq(canonical, '今天做一个不需要追加资金、失败也不会伤到现金流的最小验证。',
      'canonical deterministic CASHFLOW_SAFE_EXPERIMENT copy read from clean SHA')
    h.ok(sig(canonical), 'CANONICAL_CASHFLOW_SAFE_COPY_VALIDATES=YES (signature accepts)')

    const diag = diagnoseTurnaroundV6(G06.answers)
    h.eq(diag.firstActionType, 'CASHFLOW_SAFE_EXPERIMENT', 'G06 firstActionType=CASHFLOW_SAFE_EXPERIMENT')
    const w = JSON.parse(validResponse(G06.answers).content)
    const verdict = validateWorldviewV6(w, diag)
    h.eq(verdict.hardFailures.length >= 0, true, 'validator runs on draft payload without throwing')

    const negatives = [
      '今天再学习一个新技能。',
      '今天投入一笔钱做推广。',
      '今天什么都别做，先想清楚。',
      '今天直接辞职创业。'
    ]
    let falsePos = 0
    for (const a of negatives) if (sig(a)) falsePos++
    h.eq(falsePos, 0, 'ACTION_TYPE_FALSE_POSITIVE_COUNT=0 for negative set')

    const positives = [
      '今天不花钱做一个真实测试。',
      '用零成本的方式拿到一次真实反馈。',
      '尽量低成本先做一个小验证。'
    ]
    let falseNeg = 0
    for (const a of positives) if (!sig(a)) falseNeg++
    h.eq(falseNeg, 0, 'ACTION_TYPE_FALSE_NEGATIVE_COUNT=0 for targeted regression set')
  }

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
    await call(v6event(G06.answers), 'SHADOW', 'u1', AL)
    const payWrite = __writes.find(w => /order|pay|entitle|member/i.test(w.collection))
    h.ok(!payWrite, 'shadow run performs no payment/entitlement writes')

    const v21 = await call({ type: 'diagnostic', diagnosticVersion: 'world_model_v2_1', answers: {} }, 'SHADOW', 'u1', AL)
    h.eq(v21.data.diagnosticVersion, 'world_model_v2_1', 'v2.1 path preserved')
  }

  return h.summary('B2.5 SHADOW WIRING SUITE')
}

module.exports = { run }
if (require.main === module) run()
