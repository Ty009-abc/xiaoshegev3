/**
 * engine/worldModel/v2_1/evidenceNormalizerV21.js
 *
 * World Model v2.1 — Answer → Atomic Evidence Normalizer (Stage19A2).
 *
 * SHADOW ONLY. Cognition ONLY. Does not touch response-validity, dimension,
 * blindspot, follow-up, strategy, report, runtime, or UI.
 *
 * Authority priority: R3C > R3B > R3A > R3 > R2 > R1.
 *
 * Cognition input is STRICTLY limited to:
 *   questionId + optionId (+ questionnaireV21 semanticPropositionRefs + evidenceCatalogV21).
 *
 * This module is pure and deterministic. It reads no randomness, no clock, no
 * context, no wealth/occupation fields, no ontology priority, no ID offset.
 * It never reads an answer's display position — position is a response-validity
 * concern (R3C), and is simply absent from normalized cognitive output.
 *
 * Answer validation categories (deterministic):
 *   VALID_ANSWER       → maps to semanticPropositionRefs (atomic evidence).
 *   INVALID_QUESTION   → explicit validation error; no evidence; ok=false.
 *   INVALID_OPTION     → explicit validation error; no evidence; ok=false.
 *   DUPLICATE_QUESTION → REJECT_DUPLICATE_QUESTION (deterministic); ok=false.
 *   MISSING_ANSWER     → informational (missingQuestionIds); NOT an error;
 *                        produces no evidence and no deficit.
 *
 * Atomic evidence is deduped by evidenceId (catalog order) but full runtime
 * provenance (matchedQuestionIds / matchedOptionIds) is preserved per hit.
 *
 * @version world_model_v2_1
 */

const { QUESTIONS_V21 } = require('./questionnaireV21')
const { EVIDENCE_CATALOG_V21 } = require('./evidenceCatalogV21')

const QUESTION_BY_ID = new Map(QUESTIONS_V21.map((q) => [q.questionId, q]))
const EVIDENCE_BY_ID = new Map(EVIDENCE_CATALOG_V21.map((e) => [e.evidenceId, e]))

function isAnswerEntry(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Normalize raw answers into atomic cognitive evidence.
 *
 * @param {Array<{questionId:string, optionId:string}>} answers
 * @returns {{ ok:boolean, validationErrors:Array, missingQuestionIds:Array<string>, evidence:Array }}
 */
function normalizeEvidenceV21(answers) {
  const input = Array.isArray(answers) ? answers : []
  const validationErrors = []
  const seenQuestionIds = new Set()
  const matchedByEvidence = new Map() // evidenceId -> { matchedQuestionIds:Set, matchedOptionIds:Set }

  for (const answer of input) {
    if (!isAnswerEntry(answer)) {
      validationErrors.push({ type: 'INVALID_QUESTION', questionId: null, reason: 'not-an-object' })
      continue
    }

    const { questionId, optionId } = answer

    if (typeof questionId !== 'string' || questionId.length === 0) {
      validationErrors.push({ type: 'INVALID_QUESTION', questionId: questionId == null ? null : questionId })
      continue
    }

    // Deterministic duplicate policy: REJECT_DUPLICATE_QUESTION.
    if (seenQuestionIds.has(questionId)) {
      validationErrors.push({ type: 'DUPLICATE_QUESTION', questionId })
      continue
    }
    seenQuestionIds.add(questionId)

    const question = QUESTION_BY_ID.get(questionId)
    if (!question) {
      validationErrors.push({ type: 'INVALID_QUESTION', questionId })
      continue
    }

    if (typeof optionId !== 'string' || !question.options.some((o) => o.optionId === optionId)) {
      validationErrors.push({ type: 'INVALID_OPTION', questionId, optionId: optionId == null ? null : optionId })
      continue
    }

    // VALID_ANSWER → map to its semantic proposition refs (atomic evidence).
    const option = question.options.find((o) => o.optionId === optionId)
    for (const evidenceId of option.semanticPropositionRefs) {
      if (!EVIDENCE_BY_ID.has(evidenceId)) {
        // Static-contract invariant: every ref is a real evidenceId (guarded by A1 test).
        continue
      }
      let m = matchedByEvidence.get(evidenceId)
      if (!m) {
        m = { matchedQuestionIds: new Set(), matchedOptionIds: new Set() }
        matchedByEvidence.set(evidenceId, m)
      }
      m.matchedQuestionIds.add(questionId)
      m.matchedOptionIds.add(`${questionId}:${optionId}`)
    }
  }

  const missingQuestionIds = QUESTIONS_V21
    .map((q) => q.questionId)
    .filter((qid) => !seenQuestionIds.has(qid))

  const ok = validationErrors.length === 0

  const evidence = ok
    ? EVIDENCE_CATALOG_V21
        .filter((e) => matchedByEvidence.has(e.evidenceId))
        .map((e) => {
          const m = matchedByEvidence.get(e.evidenceId)
          return {
            evidenceId: e.evidenceId,
            construct: e.construct,
            direction: e.direction,
            distortionType: e.distortionType,
            semanticProposition: e.semanticProposition,
            sourceQuestionIds: [...e.sourceQuestionIds].sort(),
            matchedQuestionIds: [...m.matchedQuestionIds].sort(),
            matchedOptionIds: [...m.matchedOptionIds].sort(),
          }
        })
    : []

  return {
    ok,
    validationErrors,
    missingQuestionIds,
    evidence,
  }
}

module.exports = {
  normalizeEvidenceV21,
}
