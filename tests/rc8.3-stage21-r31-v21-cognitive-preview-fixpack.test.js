/**
 * RC8.3 Stage1B R3.1 — V2.1 Cognitive Preview Fixpack Acceptance Tests
 *
 * Locks the R3.1 fixes:
 *   M6  trusted server-side preview authority (client string NOT sufficient)
 *   M9  Home main CTA routes to 18Q (not old 10Q)
 *   M1  strict canonical 18/18 server validation (17/18 rejected)
 *   M2  duplicate questionId rejected
 *   M3  invalid optionId rejected
 *   M4  no fabricated evidence (forbidden economic/protected fields absent)
 *   M5  builder never replaces engine blind spot
 *   M7  client ownership injection ignored (openid server-derived only)
 *   M8  no protected full-report content in free preview (accessTier)
 *   M10 V4 REQUIRED_V4_KEYS unchanged
 *   M11 V21 Primary never activated
 *   M12 no economic field in cognitive report
 *
 * Uses `node --test`.
 *
 * @version world_model_v2_1 (cognitive preview R3.1)
 */

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')

const previewMode = require('../cloudfunctions/generateAiReport/lib/config/v21CognitivePreviewMode.js')
const v21Mode = require('../cloudfunctions/generateAiReport/lib/config/worldModelV21Mode.js')
const canonical = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/canonicalAnswerValidatorV21.js')
const contract = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportContractV21.js')
const builder = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportBuilderV21.js')
const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const { runCognitionChainV21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const { QUESTIONS_V21, CONSTRUCTS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')
const { REQUIRED_V4_KEYS } = require('../cloudfunctions/generateAiReport/lib/v4/diagnosticPipelineV4.js')

// ── 夹具 ──────────────────────────────────────────────────────────────────
const PRIMARY_ALLOWED_ANSWERS = [
  { questionId: 'SC_DEC_01', optionId: 'B' },
  { questionId: 'SC_DEC_02', optionId: 'C' },
  { questionId: 'SC_FB_01', optionId: 'A' },
  { questionId: 'SC_FB_02', optionId: 'A' },
  { questionId: 'SC_PROB_01', optionId: 'A' },
  { questionId: 'SC_PROB_02', optionId: 'A' },
  { questionId: 'SC_RISK_01', optionId: 'A' },
  { questionId: 'SC_RISK_02', optionId: 'A' },
  { questionId: 'SC_LEV_01', optionId: 'B' },
  { questionId: 'SC_LEV_02', optionId: 'B' },
  { questionId: 'SC_TIME_01', optionId: 'B' },
  { questionId: 'SC_TIME_02', optionId: 'A' },
  { questionId: 'SC_ID_01', optionId: 'A' },
  { questionId: 'SC_ID_02', optionId: 'B' },
  { questionId: 'SC_OPP_01', optionId: 'A' },
  { questionId: 'SC_OPP_02', optionId: 'A' },
  { questionId: 'SC_SYS_01', optionId: 'A' },
  { questionId: 'SC_SYS_02', optionId: 'A' },
]

// Build a canonical answer set with displayPosition mapping to the optionId's
// index in the frozen question.options (so position↔option consistent).
function canonicalAnswers() {
  return QUESTIONS_V21.map((q) => {
    const idx = 0 // optionId 'A' is always index 0; use first option
    return { questionId: q.questionId, optionId: q.options[idx].optionId, displayPosition: idx }
  })
}

// A valid set that triggers PRIMARY_ALLOWED, with valid displayPositions.
function validPreviewAnswers() {
  // Use PRIMARY_ALLOWED_ANSWERS (optionIds) but position = optionId index.
  return PRIMARY_ALLOWED_ANSWERS.map((a) => {
    const q = QUESTIONS_V21.find((qq) => qq.questionId === a.questionId)
    const idx = q.options.findIndex((o) => o.optionId === a.optionId)
    return { questionId: a.questionId, optionId: a.optionId, displayPosition: idx }
  })
}

// ── M6: trusted server-side preview authority ─────────────────────────────
test('M6: client string alone cannot enable preview (default disabled)', () => {
  // No env injected → fail closed regardless of openid.
  const r = previewMode.resolveV21CognitivePreviewAuthority('owner-openid')
  assert.strictEqual(r.enabled, false)
  assert.strictEqual(r.authorized, false)
  assert.strictEqual(r.reason, 'PREVIEW_DISABLED')
})

test('M6: malformed/unknown flag value fails closed', () => {
  // Whitespace is trimmed (project convention), so ' enabled ' === ENABLED.
  for (const v of ['true', '1', 'on', 'yes', '', 'ENABLEDX', 'enable', 'false']) {
    const r = previewMode.resolveV21CognitivePreviewAuthority('u1', { enabledEnv: () => v, allowlistEnv: () => 'u1' })
    assert.strictEqual(r.enabled, false, `value "${v}" must be disabled`)
  }
  // But exact (trimmed) 'ENABLED' is the ONLY positive value.
  const ok = previewMode.resolveV21CognitivePreviewAuthority('u1', { enabledEnv: () => '  ENABLED  ', allowlistEnv: () => 'u1' })
  assert.strictEqual(ok.enabled, true)
})

test('M6: enabled flag requires openid eligibility (allowlist)', () => {
  const ok = previewMode.resolveV21CognitivePreviewAuthority('u1', { enabledEnv: () => 'ENABLED', allowlistEnv: () => 'u1,u2' })
  assert.strictEqual(ok.authorized, true)

  const notOk = previewMode.resolveV21CognitivePreviewAuthority('u9', { enabledEnv: () => 'ENABLED', allowlistEnv: () => 'u1,u2' })
  assert.strictEqual(notOk.authorized, false)

  const empty = previewMode.resolveV21CognitivePreviewAuthority('u1', { enabledEnv: () => 'ENABLED', allowlistEnv: () => '' })
  assert.strictEqual(empty.authorized, false, 'empty allowlist → authorize nobody')
})

test('M6: missing/empty openid never authorized', () => {
  const r = previewMode.resolveV21CognitivePreviewAuthority(null, { enabledEnv: () => 'ENABLED', allowlistEnv: () => 'u1' })
  assert.strictEqual(r.authorized, false)
})

// ── M1/M2/M3: strict canonical 18/18 validation ────────────────────────────
test('M1: exactly 18 valid answers accepted', () => {
  const r = canonical.validateCanonicalAnswersV21(canonicalAnswers())
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.answerTrace.length, 18)
})

test('M1: 17/18 rejected (fail closed, no UNKNOWN continuation)', () => {
  const r = canonical.validateCanonicalAnswersV21(canonicalAnswers().slice(0, 17))
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('ANSWER_COUNT_MISMATCH') || e.startsWith('MISSING_QUESTION_ID')))
})

test('M2: duplicate questionId rejected', () => {
  const ans = canonicalAnswers()
  ans[1] = { questionId: ans[0].questionId, optionId: ans[1].optionId, displayPosition: ans[1].displayPosition }
  const r = canonical.validateCanonicalAnswersV21(ans)
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('DUPLICATE_QUESTION_ID')))
})

test('M3: invalid optionId rejected', () => {
  const ans = canonicalAnswers()
  ans[0] = { questionId: ans[0].questionId, optionId: 'ZZZ', displayPosition: 0 }
  const r = canonical.validateCanonicalAnswersV21(ans)
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('INVALID_OPTION_ID')))
})

test('M3: invalid displayPosition rejected', () => {
  const ans = canonicalAnswers()
  ans[0] = { questionId: ans[0].questionId, optionId: ans[0].optionId, displayPosition: 99 }
  const r = canonical.validateCanonicalAnswersV21(ans)
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('OUT_OF_RANGE_DISPLAY_POSITION')))
})

test('M3: unknown questionId rejected', () => {
  const ans = canonicalAnswers()
  ans[0] = { questionId: 'SC_UNKNOWN_99', optionId: 'A', displayPosition: 0 }
  const r = canonical.validateCanonicalAnswersV21(ans)
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('UNKNOWN_QUESTION_ID')))
})

// ── M5/M12/M4: builder integrity + no fabricated evidence ─────────────────
test('M5: builder never replaces engine blind spot', () => {
  const responses = validPreviewAnswers()
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)
  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })

  assert.strictEqual(report.cognitiveBlindSpot.id, cognition.decision.primaryBlindSpotId)
  assert.strictEqual(report.finalVerdict.primaryBlindSpotId, cognition.decision.primaryBlindSpotId)
  assert.strictEqual(report.finalVerdict.authority, 'WORLD_MODEL_V2_1_ENGINE')
})

test('M12: no economic field in cognitive report', () => {
  const responses = validPreviewAnswers()
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)
  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })
  const v = contract.validateCognitiveReportV21(report)

  assert.strictEqual(v.valid, true, JSON.stringify(v.errors))
  assert.deepStrictEqual(v.forbiddenHits, [])
})

// ── M8: free preview access tier + no protected full-report content ───────
test('M8: accessTier is FREE_COGNITIVE_PREVIEW', () => {
  assert.strictEqual(contract.V21_REPORT_ACCESS_TIER, 'FREE_COGNITIVE_PREVIEW')

  const responses = validPreviewAnswers()
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)
  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })

  assert.strictEqual(report.accessTier, 'FREE_COGNITIVE_PREVIEW')
})

test('M8: free preview cannot emit protected full-report content', () => {
  // Inject a protected field and prove the validator rejects it.
  const responses = validPreviewAnswers()
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)
  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })

  const mutated = Object.assign({}, report, { turnaroundProbability: 0.5, scores: { a: 1 } })
  const v = contract.validateCognitiveReportV21(mutated)
  assert.strictEqual(v.valid, false)
  assert.ok(v.errors.some((e) => e.startsWith('PROTECTED_FULL_REPORT_CONTENT')))
})

// ── M7: ownership invariant (server-derived openid only) ──────────────────
test('M7: no client-controlled owner/document key in preview route', () => {
  const idxSrc = fs.readFileSync(path.join(ROOT, 'cloudfunctions/generateAiReport/index.js'), 'utf8')

  // The preview route must persist openid from the injected (server-derived)
  // value, and must never read a client-supplied openid/owner.
  assert.ok(idxSrc.includes('openid: openid || null'))
  // No client-controlled document update key: must use .add (create), not
  // .doc(clientKey).set/update.
  const previewBlock = idxSrc.slice(idxSrc.indexOf('runWorldModelV21TestPreview'), idxSrc.indexOf('// V4 诊断分支'))
  assert.ok(!/\.doc\(event|\.doc\([^)]*reportId|\.doc\([^)]*openid/.test(previewBlock), 'no client-controlled doc() key')
})

// ── M9: Home main CTA routes to 18Q ───────────────────────────────────────
test('M9: Home main CTA (goStrategy) routes to 18Q, not 10Q', () => {
  const homeSrc = fs.readFileSync(path.join(ROOT, 'pages/home/home.js'), 'utf8')

  // goStrategy must navigate to v21-questionnaire, not challenge-play.
  const goStrategy = homeSrc.slice(homeSrc.indexOf('goStrategy()'), homeSrc.indexOf('goChallenge()'))
  assert.ok(goStrategy.includes('/pages/v21-questionnaire/v21-questionnaire'))
  assert.ok(!goStrategy.includes('challenge-play'), 'main CTA must not route to old 10Q challenge-play')
})

test('M9: no duplicate secondary V2.1 home entry', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/home/home.wxml'), 'utf8')
  const js = fs.readFileSync(path.join(ROOT, 'pages/home/home.js'), 'utf8')
  // The secondary goV21Cognitive card must be removed (single production entry).
  assert.ok(!js.includes('goV21Cognitive'), 'goV21Cognitive must be removed')
  assert.ok(!wxml.includes('goV21Cognitive'), 'secondary card must be removed')
})

// ── M10: V4 REQUIRED_V4_KEYS unchanged ─────────────────────────────────────
test('M10: V4 REQUIRED_V4_KEYS unchanged (still 15 economic keys)', () => {
  assert.strictEqual(REQUIRED_V4_KEYS.length, 15)
  // V2.1 required components must not reuse any V4 key.
  for (const key of REQUIRED_V4_KEYS) {
    assert.ok(!contract.V21_REPORT_CONTRACT.required.includes(key), `V2.1 required must not include V4 key: ${key}`)
  }
})

// ── M11: V21 Primary never activated ──────────────────────────────────────
test('M11: V21 allowed modes still OFF|SHADOW (no PRIMARY)', () => {
  assert.deepStrictEqual(v21Mode.V21_ALLOWED_MODES, ['OFF', 'SHADOW'])
  assert.strictEqual(v21Mode.parseV21Mode('PRIMARY'), 'OFF')
  assert.strictEqual(v21Mode.parseV21Mode('SELECTIVE_PRIMARY'), 'OFF')
})
