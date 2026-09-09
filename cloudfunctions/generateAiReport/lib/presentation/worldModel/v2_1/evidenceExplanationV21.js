/**
 * presentation/worldModel/v2_1/evidenceExplanationV21.js
 *
 * RC8.3 Stage1C-B — Deterministic evidence explanation builder (P1 North Star
 * requirement: USER_SPECIFIC_EVIDENCE_VISIBLE).
 *
 * Derives user-specific evidence rows from FROZEN sources only:
 *   answerTrace       → runtimeShadowAdapterV21 / cognitiveReportBuilderV21
 *   questionnaire     → questionnaireV21 (prompt + option.text)
 *   evidence trace    → evidenceCatalogV21 (semanticProposition / direction)
 *   dimension         → dimensionEngineV21 (dSupportQuestionIds / distortedEvidenceIds)
 *   blind spot        → blindSpotCandidateEngineV21 (supportingQuestionIds)
 *
 * optionId is the SOLE semantic option identity. displayPosition is NEVER used
 * as semantic identity (R3C frozen). No fabricated answers, no AI inference,
 * no economic/demographic V4 fields.
 *
 * @version north_star_presentation_v1
 */

'use strict'

const { QUESTIONS_V21 } = require('../../../engine/worldModel/v2_1/questionnaireV21')
const { EVIDENCE_CATALOG_V21 } = require('../../../engine/worldModel/v2_1/evidenceCatalogV21')

const QUESTION_BY_ID = new Map(QUESTIONS_V21.map((q) => [q.questionId, q]))
const EVIDENCE_BY_ID = new Map(EVIDENCE_CATALOG_V21.map((e) => [e.evidenceId, e]))

/**
 * Answer trace → canonical answer rows keyed by questionId.
 * Normalizes both the report answerTrace shape and the raw responses shape.
 */
function indexAnswersV21(answerTrace) {
  const map = new Map()
  const arr = Array.isArray(answerTrace) ? answerTrace : []
  for (const a of arr) {
    if (!a || typeof a.questionId !== 'string') continue
    map.set(a.questionId, a)
  }
  return map
}

/**
 * Resolve a question's selected option text from optionId (semantic identity).
 * @returns {string|null}
 */
function optionTextV21(questionId, optionId) {
  const q = QUESTION_BY_ID.get(questionId)
  if (!q || !optionId) return null
  const opt = q.options.find((o) => o.optionId === optionId)
  return opt ? opt.text : null
}

/**
 * Build deterministic evidence explanation rows for a supported conclusion.
 *
 * For a given primary blind spot, the supporting base questions come from the
 * candidate's `supportingQuestionIds` (D evidence). Each supporting question
 * contributes: questionId, optionId, prompt, answerText, evidenceId,
 * semanticProposition, behaviorSignalId, dimension, direction, supports.
 *
 * @param {object} params
 * @param {string} params.blindSpotId
 * @param {Array}  params.supportingQuestionIds   candidate supporting question ids
 * @param {Array}  params.answerTrace             raw {questionId, optionId, displayPosition}
 * @param {Array}  params.dimension               the primary dimension object (for distortedEvidenceIds/distortionTypes)
 * @returns {Array<object>} deterministic evidence rows
 */
function buildEvidenceExplanationV21({ blindSpotId, supportingQuestionIds, answerTrace, dimension }) {
  const rows = []
  const answers = indexAnswersV21(answerTrace)
  const qids = Array.isArray(supportingQuestionIds) ? supportingQuestionIds : []
  const dim = dimension || {}

  for (const questionId of qids) {
    const answer = answers.get(questionId)
    const question = QUESTION_BY_ID.get(questionId)
    if (!answer || !question) continue

    const optionId = answer.optionId
    const answerText = optionTextV21(questionId, optionId)
    const construct = question.construct

    // Deterministic evidence row(s) for the selected option: one row per
    // semantic proposition ref that is DISTORTED (direction D) for this
    // construct. Only D evidence counts as support for a blind spot.
    const option = question.options.find((o) => o.optionId === optionId)
    const refs = option && Array.isArray(option.semanticPropositionRefs)
      ? option.semanticPropositionRefs
      : []

    for (const evidenceId of refs) {
      const evidence = EVIDENCE_BY_ID.get(evidenceId)
      if (!evidence) continue
      if (evidence.direction !== 'D') continue

      rows.push({
        questionId,
        optionId,
        prompt: question.prompt || '',
        answerText: answerText || '',
        evidenceId,
        semanticProposition: evidence.semanticProposition || '',
        behaviorSignalId: `${construct}/D/${evidence.distortionType}`,
        dimension: construct,
        direction: evidence.direction,
        distortionType: evidence.distortionType,
        supports: blindSpotId,
      })
    }
  }

  return rows
}

/**
 * Build the multi-model evidence explanation: one evidence row set per eligible
 * model (no fabricated primary, evidence preserved per model).
 *
 * @param {object} params
 * @param {Array}  params.eligibleTrace   decision.trace filtered to eligible===true
 * @param {Array}  params.answerTrace
 * @param {Array}  params.dimensions
 * @returns {Array<{blindSpotId, construct, rows:Array}>}
 */
function buildMultiModelEvidenceV21({ eligibleTrace, answerTrace, dimensions }) {
  const models = []
  const trace = Array.isArray(eligibleTrace) ? eligibleTrace : []
  const dims = Array.isArray(dimensions) ? dimensions : []

  for (const t of trace) {
    if (!t || t.eligible !== true) continue
    const dim = dims.find((d) => d && d.construct === t.construct) || {}
    const rows = buildEvidenceExplanationV21({
      blindSpotId: t.blindSpotId,
      supportingQuestionIds: t.supportingQuestionIds || [],
      answerTrace,
      dimension: dim,
    })
    models.push({
      blindSpotId: t.blindSpotId,
      construct: t.construct,
      rows,
    })
  }

  return models
}

module.exports = {
  indexAnswersV21,
  optionTextV21,
  buildEvidenceExplanationV21,
  buildMultiModelEvidenceV21,
}
