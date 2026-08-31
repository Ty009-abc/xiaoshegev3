/**
 * tools/rc83-stage21-batch2/lib/qualificationRunner.js
 *
 * W10 — RC Qualification Runner (LOCAL_DIRECT, synthetic only).
 *
 * Covers: ENGINE CONTRACT → AI boundary simulation → authority validation →
 * fallback → final report contract. Uses SYNTHETIC AI outputs; NEVER calls a
 * real (paid) AI API; NEVER accesses production.
 *
 * Required cases Q01–Q15 (frozen §13) + mutation tests M1–M10 (frozen §14).
 */

'use strict'

var authorityGuard = require('./authorityGuardV21')
var fallback = require('./fallbackAdapterV21')
var renderPipeline = require('./renderPipelineV21')
var util = require('./util')

// ── Build a synthetic V2.1 engine conclusion (deterministic fixture) ──
function makeEngineResult(overrides) {
  var base = {
    responseValidityStatus: 'RESPONSE_VALID',
    cognitionExecuted: true,
    cognitionTerminalStatus: 'PRIMARY_ALLOWED',
    primaryBlindSpotId: 'DECISION_INERTIA',
    primaryConstruct: 'DECISION',
    followupPair: null,
    eligibleCandidateIds: ['DECISION_INERTIA'],
    eligibleConstructs: ['DECISION'],
    dimensionSummary: [
      { construct: 'DECISION', orientation: 'DISTORTED', state: 'STRONG', hSupport: 0, dSupport: 2, nSupport: 0 },
    ],
  }
  if (overrides) {
    var keys = Object.keys(overrides)
    for (var i = 0; i < keys.length; i++) base[keys[i]] = overrides[keys[i]]
  }
  return base
}

// ── Build a VALID AI expression (echoes engine conclusion verbatim) ──
// ── Build a VALID AI expression (echoes engine conclusion verbatim) ──
// NOTE: uses a MUTABLE deep copy so tests can mutate it; the guard's own
// snapshot remains deep-frozen.
function makeValidAiOutput(engineResult) {
  return {
    headline: '你的决策惯性可能正在拖慢你的行动。',
    summary: '本次诊断发现一个主盲点，请查看详细分析。',
    explanation: '以上表达仅陈述诊断引擎已确定的事实。',
    narrative: '展开叙述……',
    actionWording: '建议你开始小步试错。',
    humanReadableCopy: '更通俗的说明……',
    authoritativeDiagnosis: util.deepCopy(authorityGuard.buildAuthoritySnapshot(engineResult)),
  }
}

// ── Run one case; return a compact machine-readable result ──
function runCase(caseId, engineResult, aiOutput, opts) {
  var r = renderPipeline.renderV21(engineResult, aiOutput, opts)
  return {
    caseId: caseId,
    renderSource: r.renderSource,
    authorityGuardStatus: r.authorityGuardStatus,
    fallbackReason: r.fallbackReason,
    protectedFieldCount: r.protectedFieldCount,
    violationPaths: r.violationPaths,
  }
}

/**
 * Execute the full Q01–Q15 qualification matrix.
 * @returns {Array} of case results.
 */
function runQualificationCases() {
  var results = []

  // Q01 — valid AI expression → accepted (AI_RENDERED).
  var engine = makeEngineResult()
  results.push(runCase('Q01', engine, makeValidAiOutput(engine)))

  // Q02 — AI changes archetype id (primaryConstruct) → reject/fallback.
  var q2engine = makeEngineResult()
  var q2ai = makeValidAiOutput(q2engine)
  q2ai.authoritativeDiagnosis.primaryConstruct = 'RISK'
  results.push(runCase('Q02', q2engine, q2ai))

  // Q03 — AI changes blindSpot id (primaryBlindSpotId) → reject/fallback.
  var q3engine = makeEngineResult()
  var q3ai = makeValidAiOutput(q3engine)
  q3ai.authoritativeDiagnosis.primaryBlindSpotId = 'TIME_HORIZON_TRAP'
  results.push(runCase('Q03', q3engine, q3ai))

  // Q04 — AI changes strategy id (cognitionTerminalStatus) → reject/fallback.
  var q4engine = makeEngineResult()
  var q4ai = makeValidAiOutput(q4engine)
  q4ai.authoritativeDiagnosis.cognitionTerminalStatus = 'INSUFFICIENT_EVIDENCE'
  results.push(runCase('Q04', q4engine, q4ai))

  // Q05 — AI changes scenario semantic identity (followupPair / dimensionSummary).
  var q5engine = makeEngineResult()
  var q5ai = makeValidAiOutput(q5engine)
  q5ai.authoritativeDiagnosis.dimensionSummary = [
    { construct: 'RISK', orientation: 'DISTORTED', state: 'STRONG', hSupport: 0, dSupport: 2, nSupport: 0 },
  ]
  results.push(runCase('Q05', q5engine, q5ai))

  // Q06 — AI removes a protected field → reject/fallback.
  var q6engine = makeEngineResult()
  var q6ai = makeValidAiOutput(q6engine)
  delete q6ai.authoritativeDiagnosis.primaryBlindSpotId
  results.push(runCase('Q06', q6engine, q6ai))

  // Q07 — AI nullifies a protected field → reject/fallback.
  var q7engine = makeEngineResult()
  var q7ai = makeValidAiOutput(q7engine)
  q7ai.authoritativeDiagnosis.primaryConstruct = null
  results.push(runCase('Q07', q7engine, q7ai))

  // Q08 — malformed AI JSON (string) → reject/fallback.
  results.push(runCase('Q08', makeEngineResult(), 'not-an-object'))

  // Q09 — AI timeout simulation (aiThrew) → fallback.
  results.push(runCase('Q09', makeEngineResult(), null, { aiThrew: true }))

  // Q10 — AI exception simulation (aiThrew) → fallback.
  results.push(runCase('Q10', makeEngineResult(), null, { aiThrew: true }))

  // Q11 — empty AI response (null) → fallback.
  results.push(runCase('Q11', makeEngineResult(), null))

  // Q12 — wrong field types (prose as object) → reject/fallback.
  var q12engine = makeEngineResult()
  var q12ai = makeValidAiOutput(q12engine)
  q12ai.summary = { text: 'sneaky structured diagnosis' }
  results.push(runCase('Q12', q12engine, q12ai))

  // Q13 — extra non-authoritative prose (allowed if structurally non-authoritative).
  var q13engine = makeEngineResult()
  var q13ai = makeValidAiOutput(q13engine)
  q13ai.humanReadableCopy = '额外的通俗说明，不涉及诊断语义字段。'
  results.push(runCase('Q13', q13engine, q13ai))

  // Q14 — extra conflicting diagnostic field (semantic smuggling) → reject/fallback.
  var q14engine = makeEngineResult()
  var q14ai = makeValidAiOutput(q14engine)
  q14ai.trueBlindspot = 'SYSTEM_THINKING_GAP'
  results.push(runCase('Q14', q14engine, q14ai))

  // Q15 — fallback repeated determinism (semantic mismatch must be 0).
  var q15engine = makeEngineResult()
  var q15 = runCase('Q15', q15engine, q15engine) // passing engine object as invalid AI → triggers fallback
  q15.determinism = fallbackDeterminism(q15engine, 100)
  results.push(q15)

  return results
}

/**
 * Run the fallback repeatedly (N=100) and count semantic mismatches.
 * @returns {{match:number, total:number, mismatch:number}}
 */
function fallbackDeterminism(engineResult, n) {
  n = n || 100
  var first = fallback.buildFallbackV21(engineResult).record
  var firstJson = require('./util').canonicalJson(first)
  var mismatch = 0
  for (var i = 0; i < n; i++) {
    var r = fallback.buildFallbackV21(engineResult).record
    if (require('./util').canonicalJson(r) !== firstJson) mismatch++
  }
  return { match: n - mismatch, total: n, mismatch: mismatch }
}

/**
 * Mutation tests M1–M10. Each must be CAUGHT by the guard/validator
 * (i.e. the mutation must result in REJECTED/fallback, not ACCEPTED).
 * @returns {Array} of { mutationId, caught, detail }
 */
function runMutationTests() {
  var results = []

  function expectCaught(id, aiOutput, engineResult) {
    var r = renderPipeline.renderV21(engineResult || makeEngineResult(), aiOutput)
    var caught = r.renderSource === authorityGuard.RENDER_SOURCE.DETERMINISTIC_FALLBACK
    results.push({ mutationId: id, caught: caught, detail: r.fallbackReason || r.authorityGuardStatus })
  }

  var e

  // M1 archetype swap
  e = makeEngineResult(); var m1 = makeValidAiOutput(e); m1.authoritativeDiagnosis.primaryConstruct = 'RISK'
  expectCaught('M1', m1, e)

  // M2 blindSpot swap
  e = makeEngineResult(); var m2 = makeValidAiOutput(e); m2.authoritativeDiagnosis.primaryBlindSpotId = 'RISK_MODEL_DISTORTION'
  expectCaught('M2', m2, e)

  // M3 strategy swap
  e = makeEngineResult(); var m3 = makeValidAiOutput(e); m3.authoritativeDiagnosis.cognitionTerminalStatus = 'FOLLOW_UP_REQUIRED'
  expectCaught('M3', m3, e)

  // M4 scenario swap
  e = makeEngineResult(); var m4 = makeValidAiOutput(e); m4.authoritativeDiagnosis.followupPair = ['DECISION', 'FEEDBACK']
  expectCaught('M4', m4, e)

  // M5 delete protected field
  e = makeEngineResult(); var m5 = makeValidAiOutput(e); delete m5.authoritativeDiagnosis.primaryBlindSpotId
  expectCaught('M5', m5, e)

  // M6 null protected field
  e = makeEngineResult(); var m6 = makeValidAiOutput(e); m6.authoritativeDiagnosis.primaryConstruct = null
  expectCaught('M6', m6, e)

  // M7 type mutation
  e = makeEngineResult(); var m7 = makeValidAiOutput(e); m7.authoritativeDiagnosis.cognitionExecuted = 'true'
  expectCaught('M7', m7, e)

  // M8 nested authority mutation (dimensionSummary construct changed)
  e = makeEngineResult(); var m8 = makeValidAiOutput(e)
  m8.authoritativeDiagnosis.dimensionSummary = [
    { construct: 'SYSTEMS', orientation: 'DISTORTED', state: 'STRONG', hSupport: 0, dSupport: 2, nSupport: 0 },
  ]
  expectCaught('M8', m8, e)

  // M9 fake AI renderSource (AI claims fallback but authority block mutated)
  e = makeEngineResult(); var m9 = makeValidAiOutput(e)
  m9.renderSource = 'DETERMINISTIC_FALLBACK'
  m9.authoritativeDiagnosis.primaryBlindSpotId = 'OPPORTUNITY_BLINDNESS'
  expectCaught('M9', m9, e)

  // M10 fallback tries to alter diagnosis (fallback must preserve engine)
  e = makeEngineResult()
  var fb = fallback.buildFallbackV21(e)
  var m10 = {
    renderSource: 'DETERMINISTIC_FALLBACK',
    authoritativeDiagnosis: fb.authoritativeDiagnosis,
    headline: 'fallback', summary: 'x', explanation: 'x', narrative: null, actionWording: null, humanReadableCopy: null,
  }
  // mutate authoritative block of a "fallback" output
  m10.authoritativeDiagnosis = Object.assign({}, fb.authoritativeDiagnosis)
  m10.authoritativeDiagnosis.primaryBlindSpotId = 'FEEDBACK_LOOP_GAP'
  var r10 = renderPipeline.renderV21(e, m10)
  results.push({
    mutationId: 'M10',
    caught: r10.renderSource === authorityGuard.RENDER_SOURCE.DETERMINISTIC_FALLBACK &&
      r10.expression.authoritativeDiagnosis.primaryBlindSpotId === 'DECISION_INERTIA',
    detail: 'fallback preserve engine diagnosis',
  })

  return results
}

module.exports = {
  makeEngineResult: makeEngineResult,
  makeValidAiOutput: makeValidAiOutput,
  runQualificationCases: runQualificationCases,
  runMutationTests: runMutationTests,
  fallbackDeterminism: fallbackDeterminism,
}
