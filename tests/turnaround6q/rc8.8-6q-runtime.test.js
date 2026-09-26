'use strict'
/**
 * tests/turnaround6q/rc8.8-6q-runtime.test.js
 *
 * Proves the backend 6Q runtime (§6):
 *   - facts validated; INVALID_INPUT on missing field
 *   - ONE AI call → validators → PRIMARY five-card response
 *   - no V6 authority consulted (no bottleneck / no PRIMARY enum gate)
 *   - invalid AI output → ONE bounded regen → deterministic fallback if still bad
 *   - response exposes exactly the five-card schema, no internal enums
 */

const h = require('./_harness.js')
const { FIXTURES } = require('./fixtures.js')
const { GOLDEN_EXAMPLES } = require('./goldenExamples.js')
const { runTurnaround6QReport, cleanJSON6Q } = require('../../cloudfunctions/generateAiReport/lib/turnaround6q/reportRuntime6Q.js')

h.section('RC8.8 6Q — backend runtime')

async function main () {
  // 1. happy path — AI returns a valid golden report
  const fx = FIXTURES[0]
  const goodAI = async () => ({ success: true, content: '```json\n' + JSON.stringify(GOLDEN_EXAMPLES.F01) + '\n```', tokens: 10 })
  const rep = await runTurnaround6QReport({ event: { answers: fx.answers }, openid: 'o_x', ts: 1, callAI: goodAI, model: 'v4-pro' })
  h.eq(rep.reportState, 'PRIMARY', 'reportState PRIMARY')
  h.eq(rep.primaryActive, true, 'primaryActive true')
  h.eq(rep.diagnosticVersion, 'turnaround_strategy_6q_v1', 'version')
  h.ok(rep.renderSource === 'ai_draft' || rep.renderSource === 'ai_regenerated', 'renderSource from AI')
  h.eq(rep.usedFallback, false, 'no fallback on valid AI')
  h.ok(rep._meta.structuralOk && rep._meta.semanticOk, 'validators ok')
  h.ok(rep._meta.factGroundingCount >= 3, 'grounding>=3')
  const keys = Object.keys(rep.cards).sort()
  h.eq(keys, ['coreProblem', 'fatalInsight', 'firstAction', 'systemLoop', 'turnaroundPath'], 'five-card schema')

  // no V6 authority artefacts
  h.ok(!('primaryBottleneck' in rep) && !('bottleneck' in rep) && !('diagnosisState' in rep), 'no V6 diagnosis fields')
  h.ok(!('v6PrimaryActive' in rep), 'no v6PrimaryActive flag')

  // 2. INVALID_INPUT
  const bad = await runTurnaround6QReport({ event: { answers: { age: '34' } }, openid: 'o_x', ts: 1, callAI: goodAI })
  h.eq(bad.reportState, 'INVALID_INPUT', 'missing fields -> INVALID_INPUT')

  // 3. invalid AI output twice -> deterministic fallback (still PRIMARY, shippable)
  const junkAI = async () => ({ success: true, content: '不好意思我今天不想写 JSON', tokens: 3 })
  const rep2 = await runTurnaround6QReport({ event: { answers: fx.answers }, openid: 'o_x', ts: 1, callAI: junkAI, model: 'v4-pro' })
  h.eq(rep2.reportState, 'PRIMARY', 'fallback still PRIMARY')
  h.eq(rep2.usedFallback, true, 'usedFallback true on junk AI')
  h.eq(rep2.renderSource, 'deterministic_fallback', 'renderSource fallback')
  h.eq(rep2._meta.aiCallCount, 2, 'R1: unparseable output retried once -> fallback (2 attempts)')

  // 4. cleanJSON6Q hardening
  h.eq(cleanJSON6Q('前缀 {"a":1,} 后缀'), { a: 1 }, 'strips prose + trailing comma')
  h.eq(cleanJSON6Q('```json\n{"a":2}\n```'), { a: 2 }, 'strips code fence')
  h.eq(cleanJSON6Q('not json'), null, 'non-json -> null')

  // 5. R1.1 — partial JSON is NOT a coarse MISSING_FIELDS bucket; it is a
  //    STRUCTURAL_FAIL carrying the exact code, and missing fields ARE retryable.
  const { classifyAttempt } = require('../../cloudfunctions/generateAiReport/lib/turnaround6q/reportRuntime6Q.js')
  const partial = classifyAttempt({ success: true, content: '{"system_trap":"x"}', finishReason: 'stop' })
  h.eq(partial.category, 'STRUCTURAL_FAIL', 'partial JSON -> STRUCTURAL_FAIL')
  h.ok(partial.structuralCodes.includes('MISSING_REQUIRED_FIELD'), 'partial JSON surfaces MISSING_REQUIRED_FIELD')

  h.summary('6Q runtime')
}

main()
