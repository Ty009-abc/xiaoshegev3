'use strict'
/**
 * tests/v6/runtime/rc8.4-v6-runtime.test.js
 *
 * B2.4 ISOLATED runtime-chain tests. No network, no model, no key.
 * Injects a fake callAI into the adapter so every failure mode is deterministic.
 *
 * Coverage (§9):
 *   FIRST_TRY_PASS · RETRY_PASS · DOUBLE_FAIL_FALLBACK · TIMEOUT_FALLBACK
 *   INVALID_JSON_FALLBACK · ONTOLOGY_FAIL_FALLBACK · UNSUPPORTED_CLAIM_FALLBACK
 *   + PROVIDER_ERROR_FALLBACK · VALIDATOR_BYPASS_NEVER · NON_PRIMARY_NO_MODEL
 */

const h = require('../_harness.js')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const V6 = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const { diagnoseTurnaroundV6 } = require(path.join(V6, 'index.js'))
const { buildReportV6 } = require(path.join(V6, 'report/index.js'))
const {
  runWorldviewReportRuntimeV6, MAX_MODEL_ATTEMPTS, RENDER_SOURCE
} = require(path.join(V6, 'experimental/runtime/worldviewReportRuntimeV6.js'))
const F = require('../fixtures.js')

const G06 = F.GOLDEN.find(x => x.id === 'G06') // ACTION_GAP · LEARNING · PRIMARY
const ADV_A = F.ADVERSARIAL.find(x => x.id === 'A') // NO_PRIMARY

// ── helpers ────────────────────────────────────────────────────
/** Build a VALID worldview card object by reseeding the deterministic report. */
function validWorldview (answers) {
  const d = diagnoseTurnaroundV6(answers)
  const det = buildReportV6(d)
  const c = det.cards
  return {
    reportVersion: 'turnaround_strategy_v6_worldview_v1',
    cards: {
      fatalInsight: { title: '致命一句话', text: c.fatalInsight.text },
      coreProblem: { title: '核心问题', text: c.coreProblem.text },
      systemLoop: { title: '系统困局', steps: c.systemLoop.steps.map(s => s.replace(/^[^：]*：/, '').trim()).concat(['补足五步']).slice(0, 5) },
      turnaroundPath: { title: '翻身路径', from: c.turnaroundPath.from, to: c.turnaroundPath.to, logic: '把准备换成一次真实反馈。' },
      firstAction: { title: '现在就做', action: c.firstAction.action, checks: c.firstAction.checks.length ? c.firstAction.checks : ['是否完成？'] }
    }
  }
}
function reportResponse (ans) { return { success: true, content: JSON.stringify(validWorldview(ans)), tokens: 10, finishReason: 'stop' } }
function leakResponse (ans) {
  const w = validWorldview(ans)
  w.cards.turnaroundPath.logic = '你现在在LEARNING阶段，瓶颈是ACTION_GAP。'
  return { success: true, content: JSON.stringify(w), tokens: 10, finishReason: 'stop' }
}
function unsupportedResponse (ans) {
  const w = validWorldview(ans)
  w.cards.coreProblem.text = '你已经做了3年，收入一直上不去。'
  return { success: true, content: JSON.stringify(w), tokens: 10, finishReason: 'stop' }
}
function invalidJsonResponse () { return { success: true, content: 'not json at all {{{', tokens: 5, finishReason: 'stop' } }
function providerError () { return { success: false, error: 'HTTP 503' } }
/** A callAI that returns a scripted queue of responses (one per call). */
function scripted (queue) { let i = 0; return async () => queue[Math.min(i++, queue.length - 1)] }

async function run () {
  h.section('B2.4 runtime — flags')
  h.eq(MAX_MODEL_ATTEMPTS, 2, 'MAX_MODEL_ATTEMPTS=2')

  // ── A. FIRST_TRY_PASS ────────────────────────────────────────
  h.section('A. FIRST_TRY_PASS')
  {
    const r = await runWorldviewReportRuntimeV6(G06.answers, { callAI: scripted([reportResponse(G06.answers)]) })
    h.eq(r.meta.renderSource, RENDER_SOURCE.AI, 'renderSource=worldview_ai')
    h.eq(r.meta.attemptCount, 1, 'attemptCount=1')
    h.eq(r.reportVersion, 'turnaround_strategy_v6_worldview_v1', 'worldview version')
    h.eq(r.meta.validatorFailures.length, 0, 'no validator failures')
    h.ok(!!r.cards, 'cards present')
  }

  // ── B. RETRY_PASS ────────────────────────────────────────────
  h.section('B. RETRY_PASS (first fail / second pass)')
  {
    const r = await runWorldviewReportRuntimeV6(G06.answers, { callAI: scripted([leakResponse(G06.answers), reportResponse(G06.answers)]) })
    h.eq(r.meta.renderSource, RENDER_SOURCE.AI, 'renderSource=worldview_ai')
    h.eq(r.meta.attemptCount, 2, 'attemptCount=2')
    h.eq(r.meta.attempts[0].ok, false, 'attempt1 failed')
    h.eq(r.meta.attempts[1].ok, true, 'attempt2 passed')
  }

  // ── C. DOUBLE_FAIL_FALLBACK ──────────────────────────────────
  h.section('C. DOUBLE_FAIL_FALLBACK')
  {
    const r = await runWorldviewReportRuntimeV6(G06.answers, { callAI: scripted([leakResponse(G06.answers), leakResponse(G06.answers)]) })
    h.eq(r.meta.renderSource, RENDER_SOURCE.FALLBACK, 'renderSource=deterministic_fallback')
    h.eq(r.reportVersion, 'turnaround_strategy_v6_report_v1', 'fallback uses report_v1')
    h.eq(r.meta.attemptCount, 2, 'attemptCount=2')
    h.ok(r.meta.validatorFailures.includes('ONTOLOGY_LEAK'), 'reports ONTOLOGY_LEAK')
    h.ok(!!r.cards, 'fallback still returns valid cards')
  }

  // ── D. TIMEOUT_FALLBACK ──────────────────────────────────────
  h.section('D. TIMEOUT_FALLBACK')
  {
    const never = async () => { await new Promise(res => setTimeout(res, 50)); return reportResponse(G06.answers) }
    const r = await runWorldviewReportRuntimeV6(G06.answers, { callAI: never, attemptTimeoutMs: 5 })
    h.eq(r.meta.renderSource, RENDER_SOURCE.FALLBACK, 'renderSource=deterministic_fallback')
    h.eq(r.meta.attemptCount, 2, 'attemptCount=2 (2 timeouts)')
    h.eq(r.meta.fallbackReason, 'MODEL_TIMEOUT', 'fallbackReason=MODEL_TIMEOUT')
    h.ok(!!r.cards, 'fallback cards present')
  }

  // ── E. INVALID_JSON_FALLBACK ─────────────────────────────────
  h.section('E. INVALID_JSON_FALLBACK')
  {
    const r = await runWorldviewReportRuntimeV6(G06.answers, { callAI: scripted([invalidJsonResponse(), invalidJsonResponse()]) })
    h.eq(r.meta.renderSource, RENDER_SOURCE.FALLBACK, 'renderSource=deterministic_fallback')
    h.eq(r.meta.attemptCount, 2, 'attemptCount=2')
    h.eq(r.meta.fallbackReason, 'INVALID_JSON', 'fallbackReason=INVALID_JSON')
  }

  // ── F. ONTOLOGY_FAIL_FALLBACK ────────────────────────────────
  h.section('F. ONTOLOGY_FAIL_FALLBACK')
  {
    const r = await runWorldviewReportRuntimeV6(G06.answers, { callAI: scripted([leakResponse(G06.answers), leakResponse(G06.answers)]) })
    h.eq(r.meta.renderSource, RENDER_SOURCE.FALLBACK, 'renderSource=deterministic_fallback')
    h.ok(r.meta.validatorFailures.includes('ONTOLOGY_LEAK'), 'ontology leak caught')
  }

  // ── G. UNSUPPORTED_CLAIM_FALLBACK ────────────────────────────
  h.section('G. UNSUPPORTED_CLAIM_FALLBACK')
  {
    const r = await runWorldviewReportRuntimeV6(G06.answers, { callAI: scripted([unsupportedResponse(G06.answers), unsupportedResponse(G06.answers)]) })
    h.eq(r.meta.renderSource, RENDER_SOURCE.FALLBACK, 'renderSource=deterministic_fallback')
    h.ok(r.meta.validatorFailures.includes('UNSUPPORTED_USER_CLAIM'), 'unsupported claim caught')
  }

  // ── H. PROVIDER_ERROR_FALLBACK ───────────────────────────────
  h.section('H. PROVIDER_ERROR_FALLBACK')
  {
    const r = await runWorldviewReportRuntimeV6(G06.answers, { callAI: async () => providerError() })
    h.eq(r.meta.renderSource, RENDER_SOURCE.FALLBACK, 'renderSource=deterministic_fallback')
    h.eq(r.meta.fallbackReason, 'MODEL_ERROR', 'fallbackReason=MODEL_ERROR')
    h.ok(!!r.cards, 'fallback cards present')
  }

  // ── VALIDATOR_BYPASS_NEVER ───────────────────────────────────
  h.section('VALIDATOR_BYPASS_NEVER')
  {
    // A model that returns valid-looking JSON but leaks a DIFFERENT bottleneck must NOT pass.
    const wrongBottleneck = async () => {
      const w = validWorldview(G06.answers)
      w.cards.turnaroundPath.logic = '你的问题是 VALIDATION_GAP，不是别的。'
      return { success: true, content: JSON.stringify(w), tokens: 8, finishReason: 'stop' }
    }
    const r = await runWorldviewReportRuntimeV6(G06.answers, { callAI: wrongBottleneck })
    h.eq(r.meta.renderSource, RENDER_SOURCE.FALLBACK, 'drifted output falls back (no bypass)')
    h.ok(r.meta.validatorFailures.includes('DIAGNOSIS_DRIFT'), 'DIAGNOSIS_DRIFT caught')
  }

  // ── NON_PRIMARY_NO_MODEL ─────────────────────────────────────
  h.section('NON_PRIMARY_NO_MODEL')
  {
    let called = 0
    const spy = async () => { called++; return reportResponse(ADV_A.answers) }
    const r = await runWorldviewReportRuntimeV6(ADV_A.answers, { callAI: spy })
    h.eq(called, 0, 'model NOT called for NO_PRIMARY')
    h.eq(r.meta.renderSource, RENDER_SOURCE.FALLBACK, 'renderSource=deterministic_fallback')
    h.ok(!!r.reportState, 'reportState present')
  }

  return h.summary('B2.4 ISOLATED RUNTIME SUITE')
}

module.exports = { run }

if (require.main === module) run()
