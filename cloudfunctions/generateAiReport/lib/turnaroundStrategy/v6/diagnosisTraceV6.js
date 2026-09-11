'use strict'
/**
 * turnaroundStrategy/v6/diagnosisTraceV6.js
 *
 * Assembles an explicit, complete trace. No hidden semantic authority.
 */

/** Collect questionIds referenced by an evidence array. */
function questionIdsOf (evidenceArrays) {
  const ids = new Set()
  for (const arr of evidenceArrays) {
    for (const e of (arr || [])) {
      if (e && e.questionId) {
        // composite refs like 'Q5/Q6' expand to both
        for (const q of String(e.questionId).split('/')) ids.add(q)
      }
    }
  }
  return Array.from(ids)
}

/**
 * @returns full trace object per contract §22.
 */
function buildTrace ({
  profile,
  candidates,
  selection,
  beliefRelation,
  realityConstraint,
  action
}) {
  const selected = candidates.find(c => c.bottleneck === selection.primaryBottleneck) || null
  const requiredEvidence = selected ? selected.requiredEvidence : []
  const supportingEvidence = selected ? selected.supportingEvidence : []
  const contradictingEvidence = selected ? selected.contradictingEvidence : []

  const ids = questionIdsOf([requiredEvidence, supportingEvidence, contradictingEvidence])
  const optionIds = ids.map(q => ({ questionId: q, value: profile._optionIds[q] || null }))

  return {
    sourceQuestionIds: ids,
    sourceOptionIds: optionIds,
    selectedRuleId: selection.selectedRuleId,
    requiredEvidence,
    supportingEvidence,
    contradictingEvidence,
    selectionPriority: selection.selectionPriority,
    tieBreakReason: selection.tieBreakReason,

    beliefSource: beliefRelation.beliefSource,
    behaviorSources: beliefRelation.behaviorSources,
    beliefRuleId: beliefRelation.explanationRuleId,

    stageSource: action.stageSource,
    bottleneckSource: action.bottleneckSource,
    constraintSources: action.constraintSources,

    realityConstraintTypes: realityConstraint.types
  }
}

module.exports = { buildTrace, questionIdsOf }
