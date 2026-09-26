'use strict'
/**
 * tests/turnaround6q/rc8.8-6q-runtime-stabilization.test.js
 *
 * RC8.8_STAGE1_R1 — model-runtime stabilization lock (§3/§4/§5/§6/§7).
 * Deterministic: injected callAI, no provider.
 *
 *   T1 valid first response            -> 1 call PASS
 *   T2 empty then valid                -> 2 calls PASS
 *   T3 reasoning-only then valid       -> 2 calls PASS
 *   T4 invalid JSON then valid         -> 2 calls PASS
 *   T5 empty then empty                -> deterministic fallback
 *   T6 timeout + insufficient budget   -> no retry -> fallback
 *   T7 auth / nonrecoverable error     -> no retry
 */

const h = require('./_harness.js')
const { FIXTURES } = require('./fixtures.js')
const { GOLDEN_EXAMPLES } = require('./goldenExamples.js')
const RT = require('../../cloudfunctions/generateAiReport/lib/turnaround6q/reportRuntime6Q.js')
const { runTurnaround6QReport, classifyAttempt, MAX_MODEL_ATTEMPTS } = RT

const ANSWERS = FIXTURES[0].answers
const VALID = '```json\n' + JSON.stringify(GOLDEN_EXAMPLES.F01) + '\n```'

const seq = (list) => { let i = 0; return async () => list[Math.min(i++, list.length - 1)] }
const okContent = (c) => ({ success: true, content: c, finishReason: 'stop' })
const EMPTY = { success: true, content: '', finishReason: 'stop' }
const REASONING_ONLY = { success: true, content: '', finishReason: 'length', hadReasoning: true }
const INVALID_JSON = { success: true, content: '好的，这是你的报告：没问题', finishReason: 'stop' }
const AUTH_ERR = { success: false, providerErrorCode: 'AI_PROVIDER_AUTH_ERROR', httpStatus: 401 }
const RATE_ERR = { success: false, providerErrorCode: 'AI_PROVIDER_RATE_LIMIT', httpStatus: 429 }

const run = (callAI, extra) => runTurnaround6QReport(Object.assign({ event: { answers: ANSWERS }, openid: 'o', ts: 1, callAI, model: 'deepseek-v4-pro' }, extra || {}))

h.section('RC8.8 R1 — model runtime stabilization')

async function main () {
  h.eq(MAX_MODEL_ATTEMPTS, 2, 'MAX_MODEL_ATTEMPTS = 2')

  // classifier contract (§3)
  h.eq(classifyAttempt(okContent(VALID)).category, 'PASS', 'classify valid -> PASS')
  h.eq(classifyAttempt(EMPTY).category, 'EMPTY_VISIBLE_CONTENT', 'classify empty -> EMPTY_VISIBLE_CONTENT')
  h.eq(classifyAttempt(REASONING_ONLY).category, 'REASONING_ONLY', 'classify reasoning-only -> REASONING_ONLY')
  h.eq(classifyAttempt(INVALID_JSON).category, 'INVALID_JSON', 'classify non-json -> INVALID_JSON')
  const partial = classifyAttempt({ success: true, content: '{"system_trap":"x"}', finishReason: 'stop' })
  h.eq(partial.category, 'STRUCTURAL_FAIL', 'classify partial -> STRUCTURAL_FAIL (not a coarse bucket)')
  h.ok(partial.structuralCodes.includes('MISSING_REQUIRED_FIELD'), 'partial surfaces MISSING_REQUIRED_FIELD')
  h.eq(partial.retryable, true, 'missing required field IS retryable')
  h.eq(classifyAttempt(AUTH_ERR).category, 'PROVIDER_ERROR', 'classify auth err -> PROVIDER_ERROR')
  h.eq(classifyAttempt(AUTH_ERR).retryable, false, 'auth err NOT retryable')
  h.eq(classifyAttempt(EMPTY).retryable, true, 'empty IS retryable')

  // T1 valid first response -> 1 call
  let r = await run(seq([okContent(VALID)]))
  h.eq(r._meta.attemptCount, 1, 'T1 attemptCount=1')
  h.eq(r.renderSource, 'ai_draft', 'T1 renderSource ai_draft')
  h.eq(r.usedFallback, false, 'T1 no fallback')
  h.eq(r._meta.attemptResults[0].resultCategory, 'PASS', 'T1 attempt1 PASS')

  // T2 empty then valid -> 2 calls
  r = await run(seq([EMPTY, okContent(VALID)]))
  h.eq(r._meta.attemptCount, 2, 'T2 attemptCount=2')
  h.eq(r.renderSource, 'ai_regenerated', 'T2 renderSource ai_regenerated')
  h.eq(r.usedFallback, false, 'T2 no fallback')
  h.eq(r._meta.retryReason, 'EMPTY_VISIBLE_CONTENT', 'T2 retryReason EMPTY_VISIBLE_CONTENT')
  h.eq(r._meta.attemptResults[1].resultCategory, 'PASS', 'T2 attempt2 PASS')

  // T3 reasoning-only then valid -> 2 calls
  r = await run(seq([REASONING_ONLY, okContent(VALID)]))
  h.eq(r._meta.attemptCount, 2, 'T3 attemptCount=2')
  h.eq(r.renderSource, 'ai_regenerated', 'T3 ai_regenerated')
  h.eq(r._meta.reasoningOnlyDetected, true, 'T3 reasoningOnlyDetected')
  h.eq(r._meta.retryReason, 'REASONING_ONLY', 'T3 retryReason REASONING_ONLY')

  // T4 invalid JSON then valid -> 2 calls
  r = await run(seq([INVALID_JSON, okContent(VALID)]))
  h.eq(r._meta.attemptCount, 2, 'T4 attemptCount=2')
  h.eq(r.renderSource, 'ai_regenerated', 'T4 ai_regenerated')
  h.eq(r._meta.retryReason, 'INVALID_JSON', 'T4 retryReason INVALID_JSON')

  // T5 empty then empty -> deterministic fallback
  r = await run(seq([EMPTY, EMPTY]))
  h.eq(r._meta.attemptCount, 2, 'T5 attemptCount=2')
  h.eq(r.usedFallback, true, 'T5 usedFallback')
  h.eq(r.renderSource, 'deterministic_fallback', 'T5 renderSource fallback')
  h.eq(r._meta.wholeReportFallback, true, 'T5 wholeReportFallback')
  h.ok(/RETRY_EXHAUSTED/.test(r._meta.fallbackReason), 'T5 fallbackReason RETRY_EXHAUSTED (' + r._meta.fallbackReason + ')')

  // T6 timeout + insufficient remaining budget -> no retry -> fallback
  const hangThen = async () => { await new Promise((res) => setTimeout(res, 200)); return EMPTY }
  r = await run(hangThen, { attemptTimeoutMs: 400, totalBudgetMs: 500 })
  h.eq(r._meta.attemptCount, 1, 'T6 no retry (attemptCount=1)')
  h.eq(r.usedFallback, true, 'T6 fallback')
  h.ok(/INSUFFICIENT_BUDGET/.test(r._meta.fallbackReason), 'T6 fallbackReason INSUFFICIENT_BUDGET (' + r._meta.fallbackReason + ')')

  // T6b genuine timeout -> TIMEOUT category, retryable
  const never = () => new Promise(() => {})
  r = await run(never, { attemptTimeoutMs: 60, totalBudgetMs: 1000, })
  h.eq(r._meta.attemptResults[0].resultCategory, 'TIMEOUT', 'T6b attempt1 TIMEOUT')
  h.eq(r._meta.attemptCount, 2, 'T6b retries on TIMEOUT when budget allows')

  // T7 auth error -> no retry
  r = await run(seq([AUTH_ERR, okContent(VALID)]))
  h.eq(r._meta.attemptCount, 1, 'T7 auth: no retry (attemptCount=1)')
  h.eq(r._meta.attemptResults[0].resultCategory, 'PROVIDER_ERROR', 'T7 attempt1 PROVIDER_ERROR')
  h.eq(r.usedFallback, true, 'T7 fallback (no retry on auth)')
  h.eq(r._meta.fallbackReason, 'PROVIDER_ERROR', 'T7 fallbackReason PROVIDER_ERROR')

  // T7b rate limit -> not retryable
  r = await run(seq([RATE_ERR, okContent(VALID)]))
  h.eq(r._meta.attemptCount, 1, 'T7b rate limit: no retry')

  // telemetry redaction safety (§6) — no raw prompt/answers/reasoning fields
  r = await run(seq([okContent(VALID)]))
  const m = r._meta
  h.ok(!('prompt' in m) && !('answers' in m) && !('reasoningContent' in m) && !('apiKey' in m) && !('rawResponse' in m), 'telemetry carries no raw prompt/answers/reasoning/key/body')
  h.ok(Array.isArray(m.attemptResults) && m.attemptResults.every((x) => typeof x.latencyMs === 'number' && !('content' in x)), 'per-attempt telemetry = numbers/categories only')
  h.ok(typeof m.totalModelLatencyMs === 'number' && typeof m.modelLatencyMs === 'number', 'latency telemetry present')

  // validator policy UNCHANGED in R1 (§9): overrejection is recorded, not silently fixed
  h.ok('validatorOverrejectionCandidate' in r._meta, 'validatorOverrejectionCandidate surfaced')

  // ── §10 R1 SUCCESS = MODEL-RUNTIME success (visible content + parseable JSON +
  //    five fields + valid types) — INDEPENDENT of the semantic validator. ──
  // structurally-VALID but semantically-rejected report (generic-ish copy + weak
  // grounding; lengths kept inside policy so this isolates the OVER-rejection case).
  const GENERIC_REPORT = {
    system_trap: '要相信自己，保持努力，坚持下去。',
    system_loop: ['要相信自己', '保持努力', '坚持下去', '加油不要放弃'],
    core_problem: '要相信自己，保持努力，坚持下去，提升认知，多学习，加油，不要放弃，每天进步一点点，走出舒适区，时间会给你答案，培养自律。',
    fatal_sentence: '要相信自己，保持努力，坚持下去，提升认知，多学习，加油，不要放弃，每天进步一点点。',
    strategy_path: '保持努力，坚持下去，提升认知。',
    path_from: '持续的现在',
    path_to: '改变的未来',
    advice: ['要相信自己', '保持努力', '坚持下去'],
    experiment: { goal: '要相信自己加油坚持', actions: ['多学习'], target: '相信自己', output: '保持努力坚持', success_signal: '一定会好起来', time_horizon: '7天' },
  }
  const rj = await run(seq([okContent(JSON.stringify(GENERIC_REPORT))]))
  h.eq(rj._meta.attemptResults[0].resultCategory, 'PASS', '§10 model runtime PASS (structurally valid)')
  h.eq(rj._meta.structuralOk, true, '§10 shipped structuralOk true')
  h.eq(rj._meta.draftSemanticOk, false, '§10 DRAFT semanticOk false (validator rejected the draft)')
  h.eq(rj._meta.draftStructuralOk, true, '§10 DRAFT structuralOk true (model runtime succeeded)')
  h.eq(rj._meta.modelRuntimePass, true, '§10 MODEL_RUNTIME_PASS = YES (not a runtime failure)')
  h.eq(rj._meta.validatorOverrejectionCandidate, true, '§10 VALIDATOR_OVERREJECTION_CANDIDATE = YES')
  h.eq(rj.usedFallback, true, '§10 whole-report fallback used')
  h.eq(rj._meta.fallbackReason, 'VALIDATOR_REJECT', '§10 fallbackReason VALIDATOR_REJECT')
  h.eq(rj._meta.attemptCount, 1, '§10 no retry for validator reject (content was fine)')

  // ── §11 EMPTY vs REASONING_ONLY — separate, never double-counted ──
  const emptyNoEvidence = { success: true, content: '', finishReason: 'stop' }
  const emptyReasoning = { success: true, content: '', finishReason: 'length', hasReasoning: true }
  const contentWithReasoning = { success: true, content: VALID, finishReason: 'stop', hasReasoning: true }

  h.eq(classifyAttempt(emptyNoEvidence).category, 'EMPTY_VISIBLE_CONTENT', '§11 empty, no evidence -> EMPTY_VISIBLE_CONTENT')
  h.eq(classifyAttempt(emptyReasoning).category, 'REASONING_ONLY', '§11 empty + reasoning evidence -> REASONING_ONLY')
  h.eq(classifyAttempt(contentWithReasoning).category, 'PASS', '§11 visible content present -> PASS (never reasoning-only)')

  h.eq(RT.isReasoningOnly(emptyReasoning), true, '§11 isReasoningOnly(emptyReasoning) true')
  h.eq(RT.isReasoningOnly(emptyNoEvidence), false, '§11 isReasoningOnly(no evidence) false')
  h.eq(RT.isEmptyVisibleContent(emptyNoEvidence), true, '§11 isEmptyVisibleContent(no evidence) true')
  h.eq(RT.isEmptyVisibleContent(emptyReasoning), false, '§11 isEmptyVisibleContent(reasoning) false')
  // exactly one applies; the two are mutually exclusive for ANY input
  h.ok(!(RT.isReasoningOnly(emptyReasoning) && RT.isEmptyVisibleContent(emptyReasoning)), '§11 reasoning attempt not double-counted')
  h.ok(!(RT.isReasoningOnly(emptyNoEvidence) && RT.isEmptyVisibleContent(emptyNoEvidence)), '§11 empty attempt not double-counted')

  // reasoning-only run: reasoningOnlyDetected set, empty bucket NOT incremented
  const rr = await run(seq([emptyReasoning, contentWithReasoning]))
  const catsR = rr._meta.attemptResults.map((x) => x.resultCategory)
  h.eq(catsR.filter((c) => c === 'REASONING_ONLY').length, 1, '§11 exactly one REASONING_ONLY')
  h.eq(catsR.filter((c) => c === 'EMPTY_VISIBLE_CONTENT').length, 0, '§11 zero EMPTY_VISIBLE_CONTENT in same run')
  h.eq(rr._meta.reasoningOnlyDetected, true, '§11 reasoningOnlyDetected true')

  // ══════════════════════════════════════════════════════════════════════
  // R1.1 — STRUCTURAL CONTRACT TRUTH (§1/§2/§6)
  // ══════════════════════════════════════════════════════════════════════
  h.section('RC8.8 R1.1 — structural contract truth')

  const V = require('../../cloudfunctions/generateAiReport/lib/turnaround6q/reportValidator6Q.js')
  const RT2 = require('../../cloudfunctions/generateAiReport/lib/turnaround6q/reportRuntime6Q.js')
  const good = JSON.parse(JSON.stringify(GOLDEN_EXAMPLES.F01))
  const clone = () => JSON.parse(JSON.stringify(good))

  // §1 — every structural code is INDEPENDENT, never collapsed into MISSING_FIELDS
  const chk = (label, rep, code) => h.ok(V.validateStructure6Q(rep).codes.includes(code), label + ' -> ' + code)

  const missing = clone(); delete missing.core_problem
  chk('absent field', missing, 'MISSING_REQUIRED_FIELD')
  const missingAdvice = clone(); missingAdvice.experiment.actions = []
  chk('empty experiment.actions', missingAdvice, 'MISSING_REQUIRED_FIELD')
  const missingTarget = clone(); delete missingTarget.experiment.target
  chk('missing experiment.target', missingTarget, 'MISSING_REQUIRED_FIELD')
  const blank = clone(); blank.strategy_path = '   '
  chk('whitespace-only field', blank, 'EMPTY_REQUIRED_FIELD')
  const badType = clone(); badType.core_problem = 12345
  chk('numeric where string expected', badType, 'FIELD_TYPE_INVALID')
  const badAdviceType = clone(); badAdviceType.advice = '不是数组'
  chk('string where array expected', badAdviceType, 'FIELD_TYPE_INVALID')
  const tooLong = clone(); tooLong.core_problem = '啊'.repeat(300)
  chk('core_problem over max', tooLong, 'FIELD_LENGTH_OUT_OF_RANGE')
  const tooShort = clone(); tooShort.fatal_sentence = '太短了'
  chk('fatal_sentence under min', tooShort, 'FIELD_LENGTH_OUT_OF_RANGE')
  const badAdvice = clone(); badAdvice.advice = ['一', '二', '三', '四', '五', '六', '七']
  chk('advice count 7', badAdvice, 'ADVICE_COUNT_INVALID')
  const act3 = clone(); act3.experiment.actions = ['一', '二', '三']
  chk('experiment actions 3 (Card05 = 1 experiment)', act3, 'EXPERIMENT_ACTIONS_INVALID')
  const longPlan = clone(); longPlan.experiment.goal = '制定3个月的转型计划'
  chk('long-horizon plan', longPlan, 'LONG_HORIZON_PLAN')
  const badLoop = clone(); badLoop.system_loop = ['一', '二']
  chk('loop count 2', badLoop, 'LOOP_COUNT_INVALID')
  const leaked = clone(); leaked.strategy_path = '按 VALIDATION_GAP 处理，状态 PRIMARY。'
  chk('enum leak', leaked, 'ENUM_LEAK')

  // §1 — multiple independent codes on ONE draft
  const multi = clone(); delete multi.system_trap; multi.experiment.actions = ['一', '二', '三']
  const multiCodes = V.validateStructure6Q(multi).codes
  h.ok(multiCodes.includes('MISSING_REQUIRED_FIELD') && multiCodes.includes('EXPERIMENT_ACTIONS_INVALID'), 'one draft carries MULTIPLE independent codes (' + multiCodes.join(',') + ')')

  // §2 — the 5-field contract and the separated signals
  h.eq(V.REQUIRED_FIELDS.join(','), 'system_trap,core_problem,fatal_sentence,strategy_path,experiment', 'five required fields (system_loop/advice NOT required)')
  h.eq(V.requiredFieldsPresent(good), true, 'golden: five fields present')
  h.eq(V.requiredFieldsPresent(missing), false, 'missing core_problem -> NOT five present')
  const badType2 = clone(); badType2.core_problem = 999
  h.eq(V.requiredFieldsPresent(badType2), true, 'wrong-typed field still "present"')
  h.eq(V.validateFieldTypes6Q(badType2).ok, false, 'wrong-typed field -> types invalid')
  const polFail = clone(); polFail.core_problem = '啊'.repeat(300)
  h.eq(V.requiredFieldsPresent(polFail), true, 'policy-only violation: five fields still present')
  h.eq(V.validateFieldTypes6Q(polFail).ok, true, 'policy-only violation: types still valid')
  h.eq(V.validateStructuralPolicy6Q(polFail).ok, false, 'policy-only violation: policy fails')

  // §2/§8 — assessDraft6Q separates EVERY signal
  const facts1 = { age: '34', job: '外卖骑手', education: '高中', income: '6000', anxiety: '每天跑十几个小时，钱还是不够用，一停下来收入就没了', rootCause: '我没学历也没关系，只能靠体力挣钱，再拼也没用' }
  const ad = RT2.assessDraft6Q(polFail, facts1)
  h.eq(ad.fiveFieldsPresent, true, 'assess: fiveFieldsPresent')
  h.eq(ad.requiredFieldTypesValid, true, 'assess: requiredFieldTypesValid')
  h.eq(ad.structuralPolicyPass, false, 'assess: structuralPolicyPass false')
  h.eq(ad.structuralOk, false, 'assess: structuralOk false')

  // §6 — safe mechanical normalization (meaning-preserving)
  const advice8 = clone(); advice8.advice = ['一', '二', '三', '四', '五', '六', '七', '八']
  const norm8 = V.normalizeStructural6Q(advice8)
  h.eq(norm8.changed, true, 'normalize: advice>max changed')
  h.eq(norm8.report.advice.length, 6, 'normalize: advice truncated to 6')
  h.eq(norm8.report.advice[0], '一', 'normalize: keeps the FIRST items (order preserved)')
  h.ok(norm8.ops[0].startsWith('TRUNCATE_ADVICE'), 'normalize: records the op')
  const act3norm = clone(); act3norm.experiment.actions = ['一', '二', '三']
  const normA = V.normalizeStructural6Q(act3norm)
  h.eq(normA.changed, true, 'normalize: experiment.actions>max changed')
  h.eq(normA.report.experiment.actions.length, 2, 'normalize: experiment.actions truncated to 2')
  h.ok(normA.ops.some((o) => o.startsWith('TRUNCATE_EXPERIMENT_ACTIONS')), 'normalize: records the experiment op')
  const loop7 = clone(); loop7.system_loop = ['一', '二', '三', '四', '五', '六', '七']
  const normL = V.normalizeStructural6Q(loop7)
  h.eq(normL.report.system_loop.length, 5, 'normalize: loop truncated to 5')
  const clean = V.normalizeStructural6Q(clone())
  h.eq(clean.changed, false, 'normalize: clean draft untouched')

  // §6 — experiment.actions>max is NORMALIZED, never retried; missing field IS retried
  const act3n = clone(); act3n.experiment.actions = ['一', '二', '三']
  const clsAct = classifyAttempt(okContent(JSON.stringify(act3n)))
  h.eq(clsAct.category, 'STRUCTURAL_FAIL', 'experiment actions 3 -> STRUCTURAL_FAIL')
  h.eq(clsAct.retryable, false, 'experiment actions NOT retryable (§6)')
  h.eq(classifyAttempt(okContent('{"system_trap":"x"}')).retryable, true, 'missing required field IS retryable (§6)')
  // full run: actions>max ships via ai_normalized (no whole-report fallback)
  const rn = await run(seq([okContent(JSON.stringify(act3n))]))
  h.eq(rn.renderSource, 'ai_normalized', 'actions>max -> ai_normalized (not fallback)')
  h.eq(rn.usedFallback, false, 'actions>max -> no whole-report fallback')
  h.eq(rn._meta.attemptCount, 1, 'actions>max -> NO retry (1 attempt)')
  h.ok(rn._meta.normalizationApplied.length > 0, 'normalizationApplied recorded')

  // §8 — a policy failure that normalization CANNOT fix (over-long prose) does not
  // silently pass, and does not get an extra retry for a deterministic violation
  const longProse = clone(); longProse.core_problem = '啊'.repeat(400)
  const rp = await run(seq([okContent(JSON.stringify(longProse))]))
  h.eq(rp._meta.attemptCount, 1, 'over-long prose -> NO retry')
  h.eq(rp.usedFallback, true, 'over-long prose -> fallback')
  h.ok(/STRUCTURAL_REJECT/.test(rp._meta.fallbackReason), 'over-long prose fallbackReason STRUCTURAL_REJECT (' + rp._meta.fallbackReason + ')')
  h.ok(rp._meta.structuralErrorCounts['FIELD_LENGTH_OUT_OF_RANGE'] >= 1, 'structuralErrorCounts tallies FIELD_LENGTH_OUT_OF_RANGE')

  // §8 — separated success signals are reported independently
  h.ok(typeof rj._meta.providerVisibleSuccess === 'boolean' && rj._meta.providerVisibleSuccess === true, 'providerVisibleSuccess surfaced')
  h.eq(rj._meta.jsonParseSuccess, true, 'jsonParseSuccess surfaced')
  h.eq(rj._meta.fiveFieldsPresent, true, 'fiveFieldsPresent surfaced')
  h.eq(rj._meta.requiredFieldTypesValid, true, 'requiredFieldTypesValid surfaced')
  h.eq(rj._meta.structuralPolicyPass, true, 'structuralPolicyPass surfaced')
  h.eq(rj._meta.semanticValidatorPass, false, 'semanticValidatorPass surfaced (false here)')

  h.summary('6Q runtime stabilization')
}

main()
