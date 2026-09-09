/**
 * lib/engine/worldModel/v2_1/canonicalAnswerValidatorV21.js
 *
 * RC8.3 Stage1B R3.1 — STRICT server-side canonical answer validation for the
 * V2.1 cognitive PREVIEW report path (TEST_PREVIEW_ONLY) ONLY.
 *
 * This is deliberately SEPARATE from:
 *   - responseValidityV21.js (frozen shadow response-validity gate — unchanged)
 *   - evidenceNormalizerV21.js (frozen shadow cognition normalizer — unchanged)
 *
 * The preview report path MUST reject anything other than a COMPLETE, VALID,
 * CANONICAL 18-answer set. Missing / duplicate / unknown / invalid → FAIL CLOSED.
 *
 * Required (all must hold, otherwise ok=false):
 *   - answers is an array of exactly 18 entries
 *   - every expected questionId appears EXACTLY ONCE (no missing, no duplicate)
 *   - no unknown questionId
 *   - optionId is a valid optionId for that question
 *   - displayPosition is an integer in [0, options.length-1]
 *
 * optionId is the SOLE option-identity authority. displayPosition is the
 * CLIENT RENDER POSITION after option shuffle (identity authority = NO); the
 * server does NOT possess the shuffle permutation and MUST NOT assert
 * canonicalOptionAt(displayPosition) === optionId.
 *
 * Does NOT perform cognition, does NOT mutate shadow semantics, does NOT
 * produce UNKNOWN dimensions. Pure and deterministic.
 *
 * @version world_model_v2_1 (cognitive preview)
 */

const { QUESTIONS_V21 } = require('./questionnaireV21')

const QUESTION_BY_ID = new Map(QUESTIONS_V21.map((q) => [q.questionId, q]))
const EXPECTED_COUNT = QUESTIONS_V21.length // 18

/**
 * Strictly validate a raw answers array for the cognitive preview path.
 *
 * @param {*} answers  raw { questionId, optionId, displayPosition } entries
 * @returns {{ok:boolean, errors:string[], answerTrace:Array|null}}
 */
function validateCanonicalAnswersV21(answers) {
  const errors = []

  if (!Array.isArray(answers)) {
    return { ok: false, errors: ['ANSWERS_NOT_ARRAY'], answerTrace: null }
  }

  if (answers.length !== EXPECTED_COUNT) {
    errors.push('ANSWER_COUNT_MISMATCH:' + answers.length + '/' + EXPECTED_COUNT)
    return { ok: false, errors, answerTrace: null }
  }

  const seenQuestionIds = new Set()

  for (const a of answers) {
    if (!a || typeof a !== 'object') {
      errors.push('MALFORMED_ENTRY')
      continue
    }
    const questionId = a.questionId
    const optionId = a.optionId
    const displayPosition = a.displayPosition

    if (typeof questionId !== 'string' || questionId.length === 0) {
      errors.push('INVALID_QUESTION_ID:' + (questionId == null ? '' : questionId))
      continue
    }

    const q = QUESTION_BY_ID.get(questionId)
    if (!q) {
      errors.push('UNKNOWN_QUESTION_ID:' + questionId)
      continue
    }

    if (seenQuestionIds.has(questionId)) {
      errors.push('DUPLICATE_QUESTION_ID:' + questionId)
      continue
    }
    seenQuestionIds.add(questionId)

    if (typeof optionId !== 'string' || !q.options.some((o) => o.optionId === optionId)) {
      errors.push('INVALID_OPTION_ID:' + questionId + ':' + (optionId == null ? '' : optionId))
      continue
    }

    if (typeof displayPosition !== 'number' || !Number.isInteger(displayPosition)) {
      errors.push('NON_INTEGER_DISPLAY_POSITION:' + questionId)
      continue
    }
    if (displayPosition < 0 || displayPosition >= q.options.length) {
      errors.push('OUT_OF_RANGE_DISPLAY_POSITION:' + questionId)
      continue
    }
    // NOTE (R4.2): displayPosition is the CLIENT RENDER POSITION after option
    // shuffle. The server does NOT possess the client shuffle permutation, so
    // it MUST NOT assert canonicalOptionAt(displayPosition) === optionId.
    // optionId remains the sole option-identity authority.
  }

  // No missing questionId (after the loop).
  if (errors.length === 0) {
    for (const q of QUESTIONS_V21) {
      if (!seenQuestionIds.has(q.questionId)) {
        errors.push('MISSING_QUESTION_ID:' + q.questionId)
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, answerTrace: null }
  }

  // Verbatim trace (schema-v2): copy exact submitted values, never derive.
  const answerTrace = answers.map((a) => ({
    questionId: a.questionId,
    optionId: a.optionId,
    displayPosition: a.displayPosition,
  }))

  return { ok: true, errors: [], answerTrace }
}

module.exports = {
  EXPECTED_COUNT,
  validateCanonicalAnswersV21,
}
