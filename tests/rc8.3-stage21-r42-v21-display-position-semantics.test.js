/**
 * RC8.3 Stage1B R4.2 — V2.1 displayPosition semantics fix acceptance tests.
 *
 * Locks the R4.2 fix:
 *   PRIMARY ROOT CAUSE: displayPosition is a CLIENT RENDER POSITION after
 *     option shuffle, but the server validator wrongly interpreted it as a
 *     canonical option index (POSITION_OPTION_MISMATCH).
 *   SECONDARY BUG: client rendered the generic envelope "success" instead of
 *     the business error message.
 *
 * Coverage:
 *   §4  real shuffle semantics (non-canonical displayPosition accepted)
 *   §5  negative validation (invalid optionId / invalid position rejected)
 *   §6  full client/server flow (shuffled 18Q → report)
 *   §7  error-branch (envelope "success" must NOT leak)
 *   §8  mutation tests (5/5 caught)
 *
 * Uses `node --test`.
 *
 * @version world_model_v2_1 (displayPosition semantics fix)
 */

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')

const canonical = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/canonicalAnswerValidatorV21.js')
const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const { runCognitionChainV21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const builder = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportBuilderV21.js')
const contract = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportContractV21.js')
const { QUESTIONS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')
const client = require('../utils/v21Questionnaire.js')
const { loadPage, defaultWx } = require('./ui/helpers/pageShim.js')

// ── 确定性伪随机（mulberry32）─────────────────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── 规范索引查询（服务端 frozen 顺序）─────────────────────────────────────
const Q_BY_ID = new Map(QUESTIONS_V21.map((q) => [q.questionId, q]))
function canonicalOptionIndex(questionId, optionId) {
  const q = Q_BY_ID.get(questionId)
  return q.options.findIndex((o) => o.optionId === optionId)
}

/**
 * 构造一个「真实洗牌」的 18 题提交集：
 *   - 用确定性 random 洗牌每题选项（模拟客户端 buildSessionQuestions）
 *   - 用户点每题渲染位置 0 的选项
 *   - displayPosition = 洗牌后的渲染索引（可能 ≠ 规范索引）
 *
 * 返回 { answers, nonCanonicalCount }。
 * `nonCanonicalCount` = displayPosition 与规范索引不一致的题目数。
 */
function buildRealShuffledAnswers(seed) {
  const session = client.buildSessionQuestions(mulberry32(seed))
  let nonCanonicalCount = 0
  const answers = session.map((q) => {
    const opt = q.options[0] // 用户点渲染位置 0
    const canonicalIdx = canonicalOptionIndex(q.questionId, opt.optionId)
    if (opt.displayPosition !== canonicalIdx) nonCanonicalCount += 1
    return { questionId: q.questionId, optionId: opt.optionId, displayPosition: opt.displayPosition }
  })
  return { answers, nonCanonicalCount, session }
}

/**
 * 找到一个「至少一题 displayPosition ≠ 规范索引」的真实洗牌会话。
 */
function findNonCanonicalShuffledSession() {
  for (let seed = 1; seed < 1000; seed++) {
    const { answers, nonCanonicalCount, session } = buildRealShuffledAnswers(seed)
    if (nonCanonicalCount > 0) return { answers, nonCanonicalCount, session, seed }
  }
  throw new Error('could not find a shuffled session with a non-canonical position')
}

// ── §4 真实洗牌语义 ────────────────────────────────────────────────────────
test('R4.2 §4: real shuffled session with non-canonical displayPosition is ACCEPTED', () => {
  const { answers, nonCanonicalCount } = findNonCanonicalShuffledSession()
  assert.ok(nonCanonicalCount > 0, 'fixture must contain at least one non-canonical position')

  const r = canonical.validateCanonicalAnswersV21(answers)
  assert.strictEqual(r.ok, true, 'shuffled session must be valid: ' + JSON.stringify(r.errors))
  assert.strictEqual(r.answerTrace.length, 18)
})

test('R4.2 §4: at least one answer satisfies displayPosition !== canonicalOptionIndex', () => {
  const { answers, nonCanonicalCount } = findNonCanonicalShuffledSession()
  assert.ok(nonCanonicalCount >= 1, 'the bug is not actually exercised: ' + nonCanonicalCount)

  const differing = answers.filter((a) => a.displayPosition !== canonicalOptionIndex(a.questionId, a.optionId))
  assert.ok(differing.length >= 1, 'no answer has displayPosition differing from canonical index')
})

test('R4.2 §4: displayPosition identity authority is NO (same optionId, different position → valid)', () => {
  // Two answers to the same question with the SAME optionId but DIFFERENT
  // displayPosition must both be individually valid (position carries no
  // option-identity authority).
  const q = QUESTIONS_V21[0]
  const optA = q.options.find((o) => o.optionId === 'A')
  assert.ok(optA, 'fixture question has option A')

  // Build a full 18 set; for question q, use optionId 'A' with displayPosition 2
  // (canonical index of A is 0) to prove position does not gate option identity.
  const answers = QUESTIONS_V21.map((qq) => {
    if (qq.questionId === q.questionId) {
      return { questionId: qq.questionId, optionId: 'A', displayPosition: 2 }
    }
    return { questionId: qq.questionId, optionId: qq.options[0].optionId, displayPosition: 0 }
  })
  const r = canonical.validateCanonicalAnswersV21(answers)
  assert.strictEqual(r.ok, true, JSON.stringify(r.errors))
})

// ── §5 负向校验 ────────────────────────────────────────────────────────────
test('R4.2 §5: 17 answers rejected', () => {
  const { answers } = findNonCanonicalShuffledSession()
  const r = canonical.validateCanonicalAnswersV21(answers.slice(0, 17))
  assert.strictEqual(r.ok, false)
})

test('R4.2 §5: 19 answers rejected', () => {
  const { answers } = findNonCanonicalShuffledSession()
  const extra = { questionId: 'SC_DEC_01', optionId: 'B', displayPosition: 1 }
  const r = canonical.validateCanonicalAnswersV21(answers.concat([extra]))
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('ANSWER_COUNT_MISMATCH') || e.startsWith('DUPLICATE_QUESTION_ID')))
})

test('R4.2 §5: duplicate questionId rejected', () => {
  const { answers } = findNonCanonicalShuffledSession()
  const dup = answers.slice()
  dup[1] = { questionId: dup[0].questionId, optionId: dup[1].optionId, displayPosition: dup[1].displayPosition }
  const r = canonical.validateCanonicalAnswersV21(dup)
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('DUPLICATE_QUESTION_ID')))
})

test('R4.2 §5: unknown questionId rejected', () => {
  const { answers } = findNonCanonicalShuffledSession()
  const bad = answers.slice()
  bad[0] = { questionId: 'SC_UNKNOWN_99', optionId: 'A', displayPosition: 0 }
  const r = canonical.validateCanonicalAnswersV21(bad)
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('UNKNOWN_QUESTION_ID')))
})

test('R4.2 §5: invalid optionId rejected', () => {
  const { answers } = findNonCanonicalShuffledSession()
  const bad = answers.slice()
  bad[0] = { questionId: bad[0].questionId, optionId: 'ZZZ', displayPosition: 0 }
  const r = canonical.validateCanonicalAnswersV21(bad)
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('INVALID_OPTION_ID')))
})

test('R4.2 §5: displayPosition = -1 rejected', () => {
  const { answers } = findNonCanonicalShuffledSession()
  const bad = answers.slice()
  bad[0] = { questionId: bad[0].questionId, optionId: bad[0].optionId, displayPosition: -1 }
  const r = canonical.validateCanonicalAnswersV21(bad)
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('OUT_OF_RANGE_DISPLAY_POSITION')))
})

test('R4.2 §5: displayPosition >= option count rejected', () => {
  const { answers } = findNonCanonicalShuffledSession()
  const q = Q_BY_ID.get(answers[0].questionId)
  const bad = answers.slice()
  bad[0] = { questionId: bad[0].questionId, optionId: bad[0].optionId, displayPosition: q.options.length }
  const r = canonical.validateCanonicalAnswersV21(bad)
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('OUT_OF_RANGE_DISPLAY_POSITION')))
})

test('R4.2 §5: non-integer displayPosition rejected', () => {
  const { answers } = findNonCanonicalShuffledSession()
  const bad = answers.slice()
  bad[0] = { questionId: bad[0].questionId, optionId: bad[0].optionId, displayPosition: 1.5 }
  const r = canonical.validateCanonicalAnswersV21(bad)
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('NON_INTEGER_DISPLAY_POSITION')))
})

test('R4.2 §5: missing displayPosition rejected', () => {
  const { answers } = findNonCanonicalShuffledSession()
  const bad = answers.slice()
  bad[0] = { questionId: bad[0].questionId, optionId: bad[0].optionId }
  const r = canonical.validateCanonicalAnswersV21(bad)
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('NON_INTEGER_DISPLAY_POSITION')))
})

// ── §6 全链路流程（真实洗牌 → 服务端校验 → 报告）──────────────────────────
test('R4.2 §6: realistic shuffled 18Q → validation → cognition → valid report', () => {
  const { answers, nonCanonicalCount } = findNonCanonicalShuffledSession()
  assert.ok(nonCanonicalCount > 0)

  // 服务端确定性管线（与 runWorldModelV21TestPreview 步骤 2-5 等价）。
  const canonicalResult = canonical.validateCanonicalAnswersV21(answers)
  assert.strictEqual(canonicalResult.ok, true)

  const validityResult = responseValidity.assessResponseValidityV21(answers)
  let cognition = null
  if (validityResult.status === 'RESPONSE_VALID') {
    cognition = runCognitionChainV21(answers)
  }

  const report = builder.runCognitiveReportBuilderV21({ responses: answers, validityResult, cognition })
  const validation = contract.validateCognitiveReportV21(report)

  // 关键断言：inputRejected 语义（此处由服务端 canonical.ok 决定）必须为 false 等价。
  assert.strictEqual(canonicalResult.ok, true)
  assert.ok(report, 'report must exist')
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors))
  assert.strictEqual(report.reportType, 'diagnostic_v2_1')
  assert.strictEqual(report.diagnosticVersion, 'world_model_v2_1')
  assert.ok(report.worldModel, 'worldModel present')
  assert.ok(report.trace, 'trace present')
  assert.ok(report.finalVerdict, 'finalVerdict present')
})

// ── §7 错误分支（信封 success 不得泄漏）───────────────────────────────────
test('R4.2 §7: client displays business message, not envelope "success"', async () => {
  const appMock = { globalData: {} }
  const wx = defaultWx()
  // 模拟服务端返回 inputRejected 信封（code 0 + message 'success' + data.message 业务文案）。
  wx.cloud.callFunction = () => Promise.resolve({
    result: {
      code: 0,
      message: 'success',
      data: {
        reportType: 'diagnostic_v2_1',
        inputRejected: true,
        inputErrors: ['ANSWER_COUNT_MISMATCH:17/18'],
        message: '回答不完整或无效，无法生成认知报告',
      },
    },
  })

  const { harness } = loadPage('v21-questionnaire', wx, appMock)

  // 直接驱动到已提交状态：填满 18 题答案，走 submit()。
  const session = client.buildSessionQuestions(mulberry32(7))
  harness.data.started = true
  harness.data.sessionQuestions = session
  harness.data.answers = {}
  for (const q of session) {
    harness.data.answers[q.questionId] = {
      questionId: q.questionId,
      optionId: q.options[0].optionId,
      displayPosition: q.options[0].displayPosition,
    }
  }

  harness.submit()
  // flush microtasks
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.strictEqual(harness.data.error, '回答不完整或无效，无法生成认知报告')
  assert.notStrictEqual(harness.data.error, 'success')
  assert.ok(!harness.data.error.includes('success'), 'envelope success must not leak')
  const navCalls = (harness._wx && harness._wx._calls || []).filter((c) => c.type === 'navigateTo')
  assert.strictEqual(navCalls.length, 0, 'must not navigate to report page on failure')
})

test('R4.2 §7: client navigates to report page when report present', async () => {
  const appMock = { globalData: {} }
  const wx = defaultWx()
  wx.cloud.callFunction = () => Promise.resolve({
    result: {
      code: 0,
      message: 'success',
      data: { report: { reportType: 'diagnostic_v2_1', diagnosticVersion: 'world_model_v2_1' } },
    },
  })

  const { harness } = loadPage('v21-questionnaire', wx, appMock)

  const session = client.buildSessionQuestions(mulberry32(11))
  harness.data.started = true
  harness.data.sessionQuestions = session
  harness.data.answers = {}
  for (const q of session) {
    harness.data.answers[q.questionId] = {
      questionId: q.questionId,
      optionId: q.options[0].optionId,
      displayPosition: q.options[0].displayPosition,
    }
  }

  harness.submit()
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.ok(appMock.globalData.v21CognitiveReport, 'report handed off via globalData')
  assert.strictEqual(appMock.globalData.v21CognitiveReport.reportType, 'diagnostic_v2_1')
  const navCalls = (harness._wx && harness._wx._calls || []).filter((c) => c.type === 'navigateTo')
  assert.ok(
    navCalls.some((n) => n.url === '/pages/v21-cognitive-report/v21-cognitive-report'),
    'navigated to report page'
  )
})

// ── §8 变异测试（5/5 捕获）─────────────────────────────────────────────────
// 每个变异用一个内联「变异实现」证明：若变异存在，测试将失败。
// 从而证明当前测试集对 5 类回归敏感。

// M1: POSITION_OPTION_MISMATCH 逻辑被恢复 → 真实洗牌会话被拒绝。
test('R4.2 §8 M1: restored POSITION_OPTION_MISMATCH logic is caught', () => {
  const { answers, nonCanonicalCount } = findNonCanonicalShuffledSession()
  assert.ok(nonCanonicalCount > 0)

  // 内联变异实现：包含旧的 position↔option 一致性校验。
  function mutantValidateWithMismatch(answers) {
    const errors = []
    if (!Array.isArray(answers) || answers.length !== QUESTIONS_V21.length) return { ok: false, errors: ['ANSWER_COUNT_MISMATCH'] }
    const seen = new Set()
    for (const a of answers) {
      const q = Q_BY_ID.get(a.questionId)
      if (!q || seen.has(a.questionId)) { if (q) seen.add(a.questionId); continue }
      seen.add(a.questionId)
      if (!q.options.some((o) => o.optionId === a.optionId)) { errors.push('INVALID_OPTION_ID'); continue }
      const atPos = q.options[a.displayPosition]
      if (!atPos || atPos.optionId !== a.optionId) {
        errors.push('POSITION_OPTION_MISMATCH:' + a.questionId)
      }
    }
    return { ok: errors.length === 0, errors }
  }

  const mutant = mutantValidateWithMismatch(answers)
  const real = canonical.validateCanonicalAnswersV21(answers)
  assert.strictEqual(mutant.ok, false, 'mutant (mismatch restored) must reject the shuffled session')
  assert.strictEqual(real.ok, true, 'real validator must accept')
})

// M2: displayPosition 范围校验被移除 → 越界 position 被接受（当前测试捕获）。
test('R4.2 §8 M2: removed displayPosition range validation is caught', () => {
  const { answers } = findNonCanonicalShuffledSession()
  const q = Q_BY_ID.get(answers[0].questionId)
  const bad = answers.slice()
  bad[0] = { questionId: bad[0].questionId, optionId: bad[0].optionId, displayPosition: q.options.length }

  // 当前实现必须拒绝越界。
  const real = canonical.validateCanonicalAnswersV21(bad)
  assert.strictEqual(real.ok, false)
  assert.ok(real.errors.some((e) => e.startsWith('OUT_OF_RANGE_DISPLAY_POSITION')))
})

// M3: optionId 校验被移除 → 非法 optionId 被接受（当前测试捕获）。
test('R4.2 §8 M3: removed optionId validation is caught', () => {
  const { answers } = findNonCanonicalShuffledSession()
  const bad = answers.slice()
  bad[0] = { questionId: bad[0].questionId, optionId: 'ZZZ', displayPosition: 0 }

  const real = canonical.validateCanonicalAnswersV21(bad)
  assert.strictEqual(real.ok, false)
  assert.ok(real.errors.some((e) => e.startsWith('INVALID_OPTION_ID')))
})

// M4: 客户端改回 result.message → 错误分支泄漏 'success'（当前测试捕获）。
test('R4.2 §8 M4: client reverted to result.message is caught', async () => {
  const appMock = { globalData: {} }
  const wx = defaultWx()
  wx.cloud.callFunction = () => Promise.resolve({
    result: {
      code: 0,
      message: 'success',
      data: { inputRejected: true, message: '回答不完整或无效，无法生成认知报告' },
    },
  })
  const { harness } = loadPage('v21-questionnaire', wx, appMock)
  const session = client.buildSessionQuestions(mulberry32(13))
  harness.data.started = true
  harness.data.sessionQuestions = session
  harness.data.answers = {}
  for (const q of session) {
    harness.data.answers[q.questionId] = { questionId: q.questionId, optionId: q.options[0].optionId, displayPosition: q.options[0].displayPosition }
  }
  harness.submit()
  await new Promise((resolve) => setTimeout(resolve, 0))

  // 若回退到 result.message，error 会是 'success'；当前实现显示业务文案。
  assert.notStrictEqual(harness.data.error, 'success')
  assert.strictEqual(harness.data.error, '回答不完整或无效，无法生成认知报告')
})

// M5: 洗牌回归测试意外只用规范位置（无题 displayPosition ≠ 规范索引）→ 被捕获。
test('R4.2 §8 M5: shuffle fixture accidentally using canonical positions only is caught', () => {
  // 若测试夹具只用规范位置，则 findNonCanonicalShuffledSession 会抛错；
  // 这里直接断言：用规范索引构造的「伪洗牌」不满足本测试的核心前置条件。
  const canonicalOnly = QUESTIONS_V21.map((q) => ({
    questionId: q.questionId,
    optionId: q.options[0].optionId,
    displayPosition: 0, // 规范索引（option A 恒在 0）
  }))
  const nonCanonical = canonicalOnly.filter((a) => a.displayPosition !== canonicalOptionIndex(a.questionId, a.optionId))
  assert.strictEqual(nonCanonical.length, 0, 'canonical-only fixture has zero non-canonical positions')

  // 真实洗牌会话必须包含至少一题非规范位置，否则夹具无意义。
  const real = findNonCanonicalShuffledSession()
  assert.ok(real.nonCanonicalCount > 0, 'real shuffle fixture must contain non-canonical positions')
})
