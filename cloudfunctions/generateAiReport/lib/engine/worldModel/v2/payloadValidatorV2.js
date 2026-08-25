/**
 * engine/worldModel/v2/payloadValidatorV2.js
 *
 * World Model v2 — runtime payload validation for the SHADOW-only hook.
 *
 * Validates a world_model_v2 request payload against the frozen contract:
 *   - 18 required inference questions
 *   - known questionId + known optionId
 *   - no duplicate questionId
 *   - cardinality = 1 (single-choice per question)
 *
 * Accepts BOTH frozen stable structures:
 *   (a) array  : [ { questionId, optionId }, ... ]
 *   (b) object : { Q_DEC_01: 'A', Q_DEC_02: 'B', ... }
 *
 * NEVER maps answer -> blindSpot / strategy / archetype. Validation only
 * produces a verdict + a normalized { questionId: optionId } object.
 *
 * @version world_model_v2
 */

const { QUESTIONS_V2, OPTIONS_V2 } = require('./questionnaireV2')

var QUESTION_IDS_V2 = {}
var OPTION_IDS_BY_QUESTION_V2 = {}
QUESTIONS_V2.forEach(function (q) { QUESTION_IDS_V2[q.id] = true })
OPTIONS_V2.forEach(function (o) {
  if (!OPTION_IDS_BY_QUESTION_V2[o.questionId]) OPTION_IDS_BY_QUESTION_V2[o.questionId] = {}
  OPTION_IDS_BY_QUESTION_V2[o.questionId][o.optionId] = true
})

var REQUIRED_COUNT_V2 = QUESTIONS_V2.length // 18

/**
 * Normalize a single option reference to its bare optionId, tolerating the
 * composite 'questionId:optionId' form produced by some clients.
 */
function bareOptionId(qid, oid) {
  if (oid === undefined || oid === null) return oid
  var s = String(oid)
  var prefix = qid + ':'
  if (s.indexOf(prefix) === 0) return s.slice(prefix.length)
  return s
}

/**
 * Validate a world_model_v2 answers payload.
 *
 * @param {Array|Object} answers — array of {questionId,optionId} OR
 *   object { [questionId]: optionId }
 * @returns {{
 *   valid: boolean,
 *   insufficient: boolean,
 *   validationError: string|null,
 *   errors: string[],
 *   answersObj: Object,
 *   answeredCount: number,
 *   requiredCount: number,
 * }}
 */
function validateV2Answers(answers) {
  var obj = {}
  var errors = []

  if (answers === undefined || answers === null) {
    return {
      valid: false, insufficient: true, validationError: 'NO_ANSWERS', errors: ['NO_ANSWERS'],
      answersObj: {}, answeredCount: 0, requiredCount: REQUIRED_COUNT_V2,
    }
  }

  if (Array.isArray(answers)) {
    var seen = {}
    answers.forEach(function (item) {
      if (!item || typeof item !== 'object') { errors.push('INVALID_ITEM'); return }
      var qid = item.questionId
      var oid = item.optionId
      if (!qid || oid === undefined || oid === null || oid === '') { errors.push('MISSING_FIELD'); return }
      if (seen[qid]) { errors.push('DUPLICATE_QUESTION:' + qid); return }
      seen[qid] = true
      obj[qid] = oid
    })
  } else if (typeof answers === 'object') {
    Object.keys(answers).forEach(function (qid) {
      // Only treat known / Q_*-prefixed keys as inference questions. Non-Q_*
      // keys (context fields like lifeStage / incomeStructure / occupationDetail)
      // are IGNORED — context has zero inference weight by construction.
      if (QUESTION_IDS_V2[qid] || qid.indexOf('Q_') === 0) {
        obj[qid] = answers[qid]
      }
    })
  } else {
    return {
      valid: false, insufficient: true, validationError: 'INVALID_PAYLOAD_TYPE', errors: ['INVALID_PAYLOAD_TYPE'],
      answersObj: {}, answeredCount: 0, requiredCount: REQUIRED_COUNT_V2,
    }
  }

  // Validate every provided answer against the frozen contract.
  var validAnsweredCount = 0
  Object.keys(obj).forEach(function (qid) {
    if (!QUESTION_IDS_V2[qid]) {
      errors.push('UNKNOWN_QUESTION:' + qid)
      return
    }
    var bare = bareOptionId(qid, obj[qid])
    if (bare === undefined || bare === null || bare === '') {
      errors.push('MISSING_OPTION:' + qid)
      return
    }
    if (!OPTION_IDS_BY_QUESTION_V2[qid] || !OPTION_IDS_BY_QUESTION_V2[qid][bare]) {
      errors.push('UNKNOWN_OPTION:' + qid + ':' + bare)
      return
    }
    validAnsweredCount++
  })

  var hasErrors = errors.length > 0
  // INSUFFICIENT = well-formed but fewer than 18 required answers (no
  // structural errors). VALIDATION_FAILED = structural error present
  // (unknown question/option, duplicate, missing field) regardless of count.
  var insufficient = !hasErrors && validAnsweredCount < REQUIRED_COUNT_V2

  return {
    // A payload is "valid" only when every answer is a known question+option
    // AND all 18 required questions are answered.
    valid: !hasErrors && !insufficient,
    insufficient: insufficient,
    validationError: hasErrors ? 'VALIDATION_FAILED' : null,
    errors: errors,
    answersObj: obj,
    answeredCount: validAnsweredCount,
    requiredCount: REQUIRED_COUNT_V2,
  }
}

module.exports = {
  validateV2Answers,
  REQUIRED_COUNT_V2,
}
