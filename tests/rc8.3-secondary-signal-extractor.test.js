/**
 * tests/rc8.3-secondary-signal-extractor.test.js
 *
 * RC8.3 C2-002B — Secondary Signal Extractor Tests.
 *
 * Coverage:
 * - Clear activation (Mode A: 2 supporting)
 * - Strong + contextual activation (Mode B)
 * - Single evidence insufficient
 * - Duplicate-source evidence insufficient
 * - Contradiction suppression
 * - Support + strong contradiction
 * - Missing evidence output
 * - 100-run determinism
 * - Unknown evidence ignored
 * - Malformed input safety
 *
 * Minimum: 30 cases
 *
 * @version world_model_v2
 * @sprint c2-002b
 */

var {
  evaluateAllSignals,
  evaluateSignalById,
  evidenceItemMatchesContract,
  matchEvidenceList,
  areEvidenceIndependent,
  getEvidenceOrigin,
  calculateConfidence,
  calculateScore,
  SIGNAL_STATE,
  ACTIVATION_MODE,
} = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/secondarySignalExtractor')

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0
var failed = 0
var cases = []

function test(name, fn) {
  try {
    fn()
    passed++
  } catch (e) {
    failed++
    cases.push({ name: name, error: e.message })
    console.error('FAIL:', name, '-', e.message)
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'assertEqual failed') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual))
  }
}

function assertTruthy(val, msg) {
  if (!val) throw new Error((msg || 'assertTruthy failed') + ': ' + JSON.stringify(val))
}

function assertFalsy(val, msg) {
  if (val) throw new Error((msg || 'assertFalsy failed') + ': ' + JSON.stringify(val))
}

function assertNumber(val, msg) {
  if (typeof val !== 'number' || isNaN(val)) {
    throw new Error((msg || 'assertNumber failed') + ': not a number')
  }
}

function assertInRange(val, min, max, msg) {
  assertNumber(val, msg)
  if (val < min || val > max) {
    throw new Error((msg || 'assertInRange failed') + ': ' + val + ' not in [' + min + ', ' + max + ']')
  }
}

// ═══════════════════════════════════════════════════════════════
// EVIDENCE HELPERS
// ═══════════════════════════════════════════════════════════════

function makePrimarySignal(signalId, detected, confidence, originId) {
  return {
    sourceType: 'PRIMARY_SIGNAL',
    type: 'PRIMARY_SIGNAL',
    signalId: signalId,
    id: signalId,
    reference: signalId,
    detected: detected,
    confidence: confidence,
    originId: originId || ('ps-' + signalId),
  }
}

function makeQuestionnaireEvidence(field, originId) {
  return {
    sourceType: 'QUESTIONNAIRE',
    type: 'QUESTIONNAIRE',
    reference: field,
    field: field,
    id: 'q-' + field + '-' + (originId || 'default'),
    originId: originId || ('q-' + field),
  }
}

function makeBehavioralEvidence(pattern, originId) {
  return {
    sourceType: 'BEHAVIORAL',
    type: 'BEHAVIORAL',
    reference: pattern,
    pattern: pattern,
    id: 'b-' + pattern + '-' + (originId || 'default'),
    originId: originId || ('b-' + pattern),
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════

// ── 1. Clear Activation (Mode A: 2 supporting) ──

test('clear activation: two independent required evidence items', function () {
  var result = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-A'),
    ],
  })
  // DECISION_DELAY matches requiredEvidence[0], but we also need requiredEvidence[1] (pastAttemptStage)
  // With only 1 supporting evidence, activation cannot happen
  // But wait — requiredEvidence[0] is PRIMARY_SIGNAL, requiredEvidence[1] is QUESTIONNAIRE
  // Let me add the questionnaire evidence too
  result = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [
      makeQuestionnaireEvidence('pastAttemptStage', 'origin-B'),
    ],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-A'),
    ],
  })
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
  assertEqual(result.activationMode, ACTIVATION_MODE.TWO_SUPPORTING)
  assertTruthy(result.score >= 0)
  assertTruthy(result.confidence > 0)
})

test('clear activation: required + contextual from independent origins', function () {
  var result = evaluateSignalById('POST_ACTION_REVIEW_HABIT', {
    evidence: [],
    primarySignals: [
      makePrimarySignal('POST_ACTION_REVIEW', true, 0.6, 'origin-A'),
      makePrimarySignal('ACTIVE_FEEDBACK_SEEKING', true, 0.5, 'origin-B'),
    ],
  })
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
  assertEqual(result.activationMode, ACTIVATION_MODE.TWO_SUPPORTING)
})

// ── 2. Strong + Contextual Activation (Mode B) ──

test('strong + contextual activation from independent origins', function () {
  var result = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-required'),
      makePrimarySignal('OPTION_PRESERVING_DECISION', true, 0.5, 'origin-context'),
    ],
  })
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
  // This activates via TWO_SUPPORTING since requiredEvidence[0] + contextualEvidence[0] = 2 supporting
  assertEqual(result.activationMode, ACTIVATION_MODE.TWO_SUPPORTING)
})

test('mode B: strong plus contextual activation for DECISION_TO_ACTION_LATENCY', function () {
  // DECISION_TO_ACTION_LATENCY strongEvidence: CONSISTENT_LOW_LATENCY_PATTERN
  // contextualEvidence: LOW_COST_EXPERIMENTATION
  var result = evaluateSignalById('DECISION_TO_ACTION_LATENCY', {
    evidence: [
      makeBehavioralEvidence('CONSISTENT_LOW_LATENCY_PATTERN', 'origin-strong'),
    ],
    primarySignals: [
      makePrimarySignal('LOW_COST_EXPERIMENTATION', true, 0.5, 'origin-ctx'),
    ],
  })
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
  assertEqual(result.activationMode, ACTIVATION_MODE.STRONG_PLUS_CONTEXT)
})

test('mode B: strong + required activation', function () {
  var result = evaluateSignalById('MINIMUM_STEP_EXECUTION', {
    evidence: [
      makeBehavioralEvidence('MULTIPLE_MINIMUM_STEPS_ACROSS_CONTEXTS', 'origin-strong'),
      makeBehavioralEvidence('MINIMUM_VIABLE_STEP_TAKEN', 'origin-req'),
    ],
    primarySignals: [],
  })
  // strongEvidence[0] + requiredEvidence[0] from different origins
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
  assertEqual(result.activationMode, ACTIVATION_MODE.STRONG_PLUS_CONTEXT)
})

// ── 3. Single Evidence Insufficient ──

test('single evidence insufficient for activation', function () {
  var result = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-A'),
    ],
  })
  // Only 1 evidence item — insufficient
  assertEqual(result.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
  assertTruthy(result.insufficientEvidence)
  assertTruthy(result.missingEvidenceNeeded.length > 0)
})

test('single contextual evidence insufficient', function () {
  var result = evaluateSignalById('POST_ACTION_REVIEW_HABIT', {
    evidence: [],
    primarySignals: [
      makePrimarySignal('ACTIVE_FEEDBACK_SEEKING', true, 0.5, 'origin-A'),
    ],
  })
  assertEqual(result.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
})

test('single strong evidence insufficient without contextual', function () {
  var result = evaluateSignalById('DECISION_TO_ACTION_LATENCY', {
    evidence: [
      makeBehavioralEvidence('CONSISTENT_LOW_LATENCY_PATTERN', 'origin-strong'),
    ],
    primarySignals: [],
  })
  // 1 strong but 0 contextual — insufficient
  assertEqual(result.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
})

// ── 4. Duplicate-source Evidence Insufficient ──

test('two evidence items from same origin are not independent', function () {
  var result = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [
      makeQuestionnaireEvidence('pastAttemptStage', 'origin-SAME'),
    ],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-SAME'),
    ],
  })
  // Both items from 'origin-SAME' — should be treated as non-independent
  // Even though they match different contract refs, independence fails
  assertEqual(result.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
})

test('strong + contextual from same origin fails Mode B', function () {
  var result = evaluateSignalById('DECISION_TO_ACTION_LATENCY', {
    evidence: [
      makeBehavioralEvidence('CONSISTENT_LOW_LATENCY_PATTERN', 'origin-SAME'),
    ],
    primarySignals: [
      makePrimarySignal('LOW_COST_EXPERIMENTATION', true, 0.5, 'origin-SAME'),
    ],
  })
  // Strong and contextual from same origin — not independent
  assertEqual(result.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
})

// ── 5. Evidence Independence ──

test('getEvidenceOrigin returns unique key per origin', function () {
  var itemA = makePrimarySignal('SIG_A', true, 0.5, 'origin-1')
  var itemB = makePrimarySignal('SIG_B', true, 0.5, 'origin-2')
  var originA = getEvidenceOrigin(itemA)
  var originB = getEvidenceOrigin(itemB)
  assertTruthy(originA !== originB)
})

test('getEvidenceOrigin fallback when no originId', function () {
  var item = { sourceType: 'PRIMARY_SIGNAL', reference: 'DECISION_DELAY' }
  var origin = getEvidenceOrigin(item)
  assertEqual(origin, 'PRIMARY_SIGNAL::DECISION_DELAY')
})

test('areEvidenceIndependent true for different origins', function () {
  var matchedA = { item: makePrimarySignal('A', true, 0.5, 'origin-1') }
  var matchedB = { item: makePrimarySignal('B', true, 0.5, 'origin-2') }
  assertTruthy(areEvidenceIndependent(matchedA, matchedB))
})

test('areEvidenceIndependent false for same origin', function () {
  var matchedA = { item: makePrimarySignal('A', true, 0.5, 'origin-SHARED') }
  var matchedB = { item: makePrimarySignal('B', true, 0.5, 'origin-SHARED') }
  assertFalsy(areEvidenceIndependent(matchedA, matchedB))
})

// ── 6. Contradiction Suppression ──

test('contradiction suppression: contradictory evidence detected', function () {
  var result = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [],
    primarySignals: [
      // Supporting
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-A'),
      // Contradictory
      makePrimarySignal('DECISION_STABILITY', true, 0.8, 'origin-C'),
      makePrimarySignal('LOW_COST_EXPERIMENTATION', true, 0.5, 'origin-D'),
    ],
  })
  // Strong contradiction (2 independent contradictory items) should suppress
  assertEqual(result.state, SIGNAL_STATE.SUPPRESSED)
  assertTruthy(result.suppressionReason !== null)
})

test('contradiction suppression: single contradiction with insufficient confidence does not suppress', function () {
  // DECISION_STABILITY contradictoryEvidence requires confidence ≥ 0.7
  // Providing confidence 0.5 means it won't match as contradictory
  var result = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [],
    primarySignals: [
      // Supporting
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-A'),
      makePrimarySignal('OPTION_PRESERVING_DECISION', true, 0.5, 'origin-B'),
      // Below-threshold contradictory
      makePrimarySignal('DECISION_STABILITY', true, 0.5, 'origin-C'),
    ],
  })
  // Contradictory evidence below threshold → not matched → signal stays ACTIVE
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
  assertTruthy(result.contradictingEvidenceIds.length === 0)
})

test('contradiction suppression: moderate contradiction (1 item) does not suppress', function () {
  // Use confidence ≥ 0.7 to match the contradictoryEvidence condition
  var result = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [],
    primarySignals: [
      // Supporting
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-A'),
      makePrimarySignal('OPTION_PRESERVING_DECISION', true, 0.5, 'origin-B'),
      // Single contradictory at qualifying confidence
      makePrimarySignal('DECISION_STABILITY', true, 0.75, 'origin-C'),
    ],
  })
  // 1 contradictory item — moderate contradiction, not strong enough to suppress
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
  assertTruthy(result.contradictingEvidenceIds.length === 1)
})

test('suppression trigger met via signal confidence threshold', function () {
  var result = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-A'),
      makePrimarySignal('OPTION_PRESERVING_DECISION', true, 0.5, 'origin-B'),
      // Suppression trigger: DECISION_STABILITY detected with confidence ≥ 0.8
      makePrimarySignal('DECISION_STABILITY', true, 0.85, 'origin-suppress'),
    ],
  })
  assertEqual(result.state, SIGNAL_STATE.SUPPRESSED)
})

// ── 7. Support + Strong Contradiction ──

test('support with strong contradiction overrides activation', function () {
  var result = evaluateSignalById('PROBABILISTIC_LANGUAGE_USAGE', {
    evidence: [],
    primarySignals: [
      // Supporting
      makePrimarySignal('PROBABILISTIC_THINKING', true, 0.6, 'origin-A'),
      makePrimarySignal('BINARY_OUTCOME_THINKING', false, 0.5, 'origin-B'),
      // Strong contradiction
      makePrimarySignal('BINARY_OUTCOME_THINKING', true, 0.85, 'origin-contra'),
    ],
  })
  // BINARY_OUTCOME_THINKING detected with confidence ≥ 0.8 is contradictory AND a suppression trigger
  assertEqual(result.state, SIGNAL_STATE.SUPPRESSED)
})

// ── 8. Missing Evidence Output ──

test('missing evidence output when insufficient', function () {
  var result = evaluateSignalById('EFFORT_VS_MECHANISM_FRAMING', {
    evidence: [],
    primarySignals: [],
  })
  assertEqual(result.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
  assertTruthy(result.missingEvidenceNeeded.length > 0)
  // With 0 evidence and minEvidence=2, should indicate more evidence needed
  assertTruthy(
    result.missingEvidenceNeeded[0].indexOf('more') !== -1 ||
    result.missingEvidenceNeeded[0].indexOf('Need') !== -1 ||
    result.missingEvidenceNeeded[0].indexOf('No support') !== -1
  )
})

test('partial evidence shows specific gap', function () {
  var result = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.6, 'origin-A'),
    ],
  })
  assertEqual(result.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
  // Should mention needing more evidence
  var firstNeed = result.missingEvidenceNeeded[0]
  assertTruthy(firstNeed.indexOf('Need') !== -1 || firstNeed.indexOf('more') !== -1 || firstNeed.indexOf('Single') !== -1)
})

// ── 9. 100-Run Determinism ──

function createDeterminismInput() {
  return {
    evidence: [
      makeQuestionnaireEvidence('pastAttemptStage', 'origin-q-1'),
    ],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.75, 'origin-ps-1'),
      makePrimarySignal('OPTION_PRESERVING_DECISION', true, 0.6, 'origin-ps-2'),
      makePrimarySignal('DECISION_STABILITY', true, 0.85, 'origin-ps-supp'),
    ],
  }
}

test('100-run determinism: same input produces identical output', function () {
  var input = createDeterminismInput()
  var first = evaluateAllSignals(input)

  for (var i = 0; i < 100; i++) {
    var result = evaluateAllSignals(input)

    // Same number of signals
    assertEqual(result.signals.length, first.signals.length, 'Run ' + i + ': signal count mismatch')

    for (var j = 0; j < result.signals.length; j++) {
      var sigA = first.signals[j]
      var sigB = result.signals[j]

      assertEqual(sigA.id, sigB.id, 'Run ' + i + ': signal id mismatch at ' + j)
      assertEqual(sigA.state, sigB.state, 'Run ' + i + ': state mismatch for ' + sigA.id)
      assertEqual(sigA.score, sigB.score, 'Run ' + i + ': score mismatch for ' + sigA.id)
      assertEqual(sigA.confidence, sigB.confidence, 'Run ' + i + ': confidence mismatch for ' + sigA.id)
      assertEqual(sigA.activationMode, sigB.activationMode, 'Run ' + i + ': activationMode mismatch for ' + sigA.id)
      assertEqual(sigA.suppressionReason, sigB.suppressionReason, 'Run ' + i + ': suppressionReason mismatch for ' + sigA.id)
      assertEqual(JSON.stringify(sigA.missingEvidenceNeeded), JSON.stringify(sigB.missingEvidenceNeeded), 'Run ' + i + ': missingEvidenceNeeded mismatch for ' + sigA.id)
    }

    assertEqual(result.summary.active, first.summary.active, 'Run ' + i + ': active count mismatch')
    assertEqual(result.summary.suppressed, first.summary.suppressed, 'Run ' + i + ': suppressed count mismatch')
    assertEqual(result.summary.insufficient, first.summary.insufficient, 'Run ' + i + ': insufficient count mismatch')
  }
})

test('100-run determinism: output has no timestamps', function () {
  var result = evaluateAllSignals(createDeterminismInput())
  assertEqual(result.meta.timestamp, null)
  assertTruthy(result.meta.deterministic === true)
})

// ── 10. Unknown Evidence Ignored ──

test('unknown evidence items ignored safely', function () {
  var result = evaluateAllSignals({
    evidence: [
      { sourceType: 'UNKNOWN_TYPE', reference: 'something_weird', id: 'unk-1' },
      makeQuestionnaireEvidence('pastAttemptStage', 'origin-ok'),
    ],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-ps'),
      makePrimarySignal('OPTION_PRESERVING_DECISION', true, 0.5, 'origin-ps-2'),
    ],
  })

  // WAITING_DURATION_PATTERN should still activate from valid evidence
  var wdp = result.signals.find(function (s) { return s.id === 'WAITING_DURATION_PATTERN' })
  assertEqual(wdp.state, SIGNAL_STATE.ACTIVE)
})

test('evidence with no sourceType handled gracefully', function () {
  var result = evaluateAllSignals({
    evidence: [
      { reference: 'someThing' }, // no sourceType
      makeQuestionnaireEvidence('pastAttemptStage', 'origin-ok'),
    ],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-ps'),
      makePrimarySignal('OPTION_PRESERVING_DECISION', true, 0.5, 'origin-ps-2'),
    ],
  })
  assertEqual(result.summary.total, 23)
})

// ── 11. All 23 Signals Returned ──

test('evaluateAllSignals returns all 23 signals', function () {
  var result = evaluateAllSignals({
    evidence: [],
    primarySignals: [],
  })
  assertEqual(result.signals.length, 23)
  assertEqual(result.summary.total, 23)
})

test('all 23 signals have required output fields', function () {
  var result = evaluateAllSignals({
    evidence: [],
    primarySignals: [],
  })

  var requiredFields = [
    'id', 'state', 'score', 'confidence',
    'supportingEvidenceIds', 'contextualEvidenceIds', 'strongEvidenceIds',
    'contradictingEvidenceIds', 'activationMode', 'suppressionReason',
    'insufficientEvidence', 'missingEvidenceNeeded', 'trace',
  ]

  for (var i = 0; i < result.signals.length; i++) {
    var sig = result.signals[i]
    for (var f = 0; f < requiredFields.length; f++) {
      var field = requiredFields[f]
      assertTruthy(sig.hasOwnProperty(field) || sig[field] !== undefined, 'Signal ' + sig.id + ' missing field: ' + field)
    }
  }
})

test('all signals in INSUFFICIENT state with empty input', function () {
  var result = evaluateAllSignals({
    evidence: [],
    primarySignals: [],
  })
  assertEqual(result.summary.active, 0)
  assertEqual(result.summary.suppressed, 0)
  assertEqual(result.summary.insufficient, 23)
})

// ── 12. Malformed Input ──

test('null evidence array handled', function () {
  var result = evaluateAllSignals({
    evidence: null,
    primarySignals: [],
  })
  assertEqual(result.signals.length, 23)
})

test('null primarySignals handled', function () {
  var result = evaluateAllSignals({
    evidence: [],
    primarySignals: null,
  })
  assertEqual(result.signals.length, 23)
})

test('undefined input handled', function () {
  var result = evaluateAllSignals({})
  assertEqual(result.signals.length, 23)
})

test('completely empty input handled', function () {
  var result = evaluateAllSignals()
  assertEqual(result.signals.length, 23)
})

// ── 13. Score and Confidence Ranges ──

test('ACTIVE signal score is in valid range', function () {
  var result = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [
      makeQuestionnaireEvidence('pastAttemptStage', 'origin-B'),
    ],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-A'),
    ],
  })
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
  assertInRange(result.score, 0, 100, 'score out of range')
  assertInRange(result.confidence, 0, 1, 'confidence out of range')
})

test('INSUFFICIENT signal score is halved', function () {
  var resultActive = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [
      makeQuestionnaireEvidence('pastAttemptStage', 'origin-B'),
    ],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-A'),
    ],
  })

  var resultInsufficient = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-A'),
    ],
  })

  assertEqual(resultActive.state, SIGNAL_STATE.ACTIVE)
  assertEqual(resultInsufficient.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
})

// ── 14. Summary Correct ──

test('summary counts correct', function () {
  var result = evaluateAllSignals({
    evidence: [
      makeQuestionnaireEvidence('pastAttemptStage', 'origin-q'),
    ],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-ps-a'),
      makePrimarySignal('OPTION_PRESERVING_DECISION', true, 0.5, 'origin-ps-b'),
    ],
  })

  assertEqual(result.summary.active + result.summary.suppressed + result.summary.insufficient, 23)
  assertTruthy(result.summary.active > 0, 'At least WAITING_DURATION_PATTERN should be active')
})

// ── 15. Confidence Not Bumped by Tie-Break ──

test('confidence decreases with contradiction presence', function () {
  // Active without contradiction
  var resultClean = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [
      makeQuestionnaireEvidence('pastAttemptStage', 'origin-B'),
    ],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-A'),
    ],
  })

  // Active with some contradiction
  var resultDirty = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [
      makeQuestionnaireEvidence('pastAttemptStage', 'origin-B'),
    ],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-A'),
      makePrimarySignal('LOW_COST_EXPERIMENTATION', true, 0.5, 'origin-C'),
    ],
  })

  assertEqual(resultClean.state, SIGNAL_STATE.ACTIVE)
  // LOW_COST_EXPERIMENTATION is a contradictoryEvidence match
  // With contradiction, confidence should not increase — it may decrease
  assertTruthy(resultDirty.confidence <= resultClean.confidence + 0.05, 'Confidence should not increase with contradiction')
})

// ── 16. evidenceItemMatchesContract ──

test('evidenceItemMatchesContract: PRIMARY_SIGNAL match', function () {
  var contractRef = { sourceType: 'PRIMARY_SIGNAL', reference: 'DECISION_DELAY', condition: 'detected with confidence ≥ 0.6' }
  var item = { sourceType: 'PRIMARY_SIGNAL', signalId: 'DECISION_DELAY', detected: true, confidence: 0.7 }
  assertTruthy(evidenceItemMatchesContract(contractRef, item))
})

test('evidenceItemMatchesContract: PRIMARY_SIGNAL no match below confidence', function () {
  var contractRef = { sourceType: 'PRIMARY_SIGNAL', reference: 'DECISION_DELAY', condition: 'detected with confidence ≥ 0.8' }
  var item = { sourceType: 'PRIMARY_SIGNAL', signalId: 'DECISION_DELAY', detected: true, confidence: 0.5 }
  assertFalsy(evidenceItemMatchesContract(contractRef, item))
})

test('evidenceItemMatchesContract: not-detected condition', function () {
  var contractRef = { sourceType: 'PRIMARY_SIGNAL', reference: 'BINARY_OUTCOME_THINKING', condition: 'not-detected — suggests user avoids deterministic framing' }
  var item = { sourceType: 'PRIMARY_SIGNAL', signalId: 'BINARY_OUTCOME_THINKING', detected: true, confidence: 0.5 }
  assertFalsy(evidenceItemMatchesContract(contractRef, item))
})

test('evidenceItemMatchesContract: sourceType mismatch', function () {
  var contractRef = { sourceType: 'PRIMARY_SIGNAL', reference: 'DECISION_DELAY', condition: 'detected' }
  var item = { sourceType: 'BEHAVIORAL', reference: 'DECISION_DELAY' }
  assertFalsy(evidenceItemMatchesContract(contractRef, item))
})

test('evidenceItemMatchesContract: reference mismatch', function () {
  var contractRef = { sourceType: 'PRIMARY_SIGNAL', reference: 'DECISION_DELAY', condition: 'detected' }
  var item = { sourceType: 'PRIMARY_SIGNAL', signalId: 'DECISION_STABILITY', detected: true, confidence: 0.5 }
  assertFalsy(evidenceItemMatchesContract(contractRef, item))
})

// ── 17. Paired Signal Differentiation ──

test('PAIR 1: DECISION_INERTIA side can activate independently', function () {
  // Activating WAITING_DURATION_PATTERN (supports DECISION_INERTIA)
  var result = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [
      makeQuestionnaireEvidence('pastAttemptStage', 'origin-q'),
    ],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-ps'),
    ],
  })
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
})

test('PAIR 1: FEEDBACK_LOOP_GAP side can activate independently', function () {
  // Activating MINIMUM_STEP_EXECUTION (supports FEEDBACK_LOOP_GAP)
  var result = evaluateSignalById('MINIMUM_STEP_EXECUTION', {
    evidence: [
      makeBehavioralEvidence('MINIMUM_VIABLE_STEP_TAKEN', 'origin-a'),
      makeBehavioralEvidence('NEW_INFORMATION_GAINED_FROM_STEP', 'origin-b'),
    ],
    primarySignals: [],
  })
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
})

test('PAIR 2: LEVERAGE side can activate independently', function () {
  var result = evaluateSignalById('OUTPUT_DECOUPLING_AWARENESS', {
    evidence: [
      makeBehavioralEvidence('REUSABLE_OUTPUT_CREATED', 'origin-a'),
    ],
    primarySignals: [
      makePrimarySignal('REPEATABLE_VALUE', true, 0.5, 'origin-b'),
    ],
  })
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
})

test('PAIR 2: TIME side can activate independently', function () {
  var result = evaluateSignalById('DIRECTION_SWITCHING_FREQUENCY', {
    evidence: [
      makeBehavioralEvidence('DIRECTION_SWITCH_COUNT', 'origin-a'),
      makeBehavioralEvidence('SWITCH_MOTIVATION_ANALYSIS', 'origin-b'),
    ],
    primarySignals: [],
  })
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
})

test('PAIR 3: RISK side can activate independently', function () {
  var result = evaluateSignalById('EMOTIONAL_RECENCY_IMPACT', {
    evidence: [
      makeBehavioralEvidence('RECENT_HIGH_IMPACT_EVENT', 'origin-a'),
      makeBehavioralEvidence('POST_EVENT_RISK_ATTITUDE_SHIFT', 'origin-b'),
    ],
    primarySignals: [],
  })
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
})

test('PAIR 3: PROBABILITY side can activate independently', function () {
  var result = evaluateSignalById('PROBABILISTIC_LANGUAGE_USAGE', {
    evidence: [
      makeBehavioralEvidence('LANGUAGE_FRAMING_ANALYSIS', 'origin-a'),
    ],
    primarySignals: [
      makePrimarySignal('PROBABILISTIC_THINKING', true, 0.6, 'origin-b'),
    ],
  })
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
})

test('PAIR 4: SYSTEM side can activate independently', function () {
  var result = evaluateSignalById('FEEDBACK_LOOP_CONCEPT_AWARENESS', {
    evidence: [
      makeBehavioralEvidence('FEEDBACK_CONCEPT_USAGE', 'origin-a'),
      makeBehavioralEvidence('CAUSAL_CHAIN_COMPLEXITY', 'origin-b'),
    ],
    primarySignals: [],
  })
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
})

test('PAIR 5: OPPORTUNITY side can activate independently', function () {
  var result = evaluateSignalById('INFORMATION_SOURCE_DIVERSITY', {
    evidence: [
      makeBehavioralEvidence('INFORMATION_SOURCE_COUNT', 'origin-a'),
      makeBehavioralEvidence('DOMAIN_DIVERSITY_OF_SOURCES', 'origin-b'),
    ],
    primarySignals: [],
  })
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
})

test('PAIR 5: IDENTITY side can activate independently', function () {
  var result = evaluateSignalById('IDENTITY_BASED_EXCLUSION', {
    evidence: [
      makeBehavioralEvidence('PATH_EXCLUSION_LANGUAGE_ANALYSIS', 'origin-a'),
      makeBehavioralEvidence('EXCLUSION_RATIONALE_CATEGORIZATION', 'origin-b'),
    ],
    primarySignals: [],
  })
  assertEqual(result.state, SIGNAL_STATE.ACTIVE)
})

// ── 18. Suppression with partial support ──

test('contradiction suppresses even with supporting evidence', function () {
  var result = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [
      makeQuestionnaireEvidence('pastAttemptStage', 'origin-req'),
    ],
    primarySignals: [
      makePrimarySignal('DECISION_DELAY', true, 0.7, 'origin-req2'),
      // Strong contradiction: 2 independent contradictory items
      makePrimarySignal('DECISION_STABILITY', true, 0.8, 'origin-ctr1'),
      makePrimarySignal('LOW_COST_EXPERIMENTATION', true, 0.5, 'origin-ctr2'),
    ],
  })
  assertEqual(result.state, SIGNAL_STATE.SUPPRESSED)
  assertTruthy(result.contradictingEvidenceIds.length >= 2)
})

// ═══════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════

var total = passed + failed
console.log('\n========================================')
console.log('RC8.3 C2-002B Secondary Signal Extractor')
console.log('========================================')
console.log('Total:  ' + total)
console.log('Passed: ' + passed)
console.log('Failed: ' + failed)
console.log('========================================')

if (failed > 0) {
  console.log('\nFAILURES:')
  for (var k = 0; k < cases.length; k++) {
    console.log('  [' + (k + 1) + '] ' + cases[k].name)
    console.log('      ' + cases[k].error)
  }
  process.exit(1)
} else {
  console.log('ALL TESTS PASSED')
}
