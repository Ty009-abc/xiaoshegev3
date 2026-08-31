'use strict'
// Canonical source-of-truth loader (read-only). Reuses the REAL questionnaire,
// evidence catalog, and response-validity pattern detector. NO second schema
// copy, NO reimplementation of inference.
const path = require('path')
const MANIFEST = require('../core/manifest')

const { QUESTIONS_V21, QUESTION_COUNT_V21 } = require(MANIFEST.questionSourcePath)
const { detectPatterns } = require(MANIFEST.validityEnginePath)
const EVIDENCE_CATALOG_V21 = require(
  path.join(path.dirname(MANIFEST.questionSourcePath), 'evidenceCatalogV21.js')
).EVIDENCE_CATALOG_V21

const QUESTION_BY_ID = new Map(QUESTIONS_V21.map((q) => [q.questionId, q]))
const QUESTION_ORDER = QUESTIONS_V21.map((q) => q.questionId)
const EVIDENCE_BY_ID = new Map(EVIDENCE_CATALOG_V21.map((e) => [e.evidenceId, e]))

// Resolve an option's semantic metadata from its single canonical evidence ref.
function optionMeta(q, optionId) {
  const opt = q.options.find((o) => o.optionId === optionId)
  if (!opt) return null
  const refs = opt.semanticPropositionRefs || []
  const first = EVIDENCE_BY_ID.get(refs[0])
  return {
    evidenceId: refs[0] || null,
    direction: first ? first.direction : null,
    distortionType: first ? first.distortionType : null,
    construct: q.construct,
  }
}

module.exports = {
  QUESTION_BY_ID,
  QUESTION_ORDER,
  EVIDENCE_BY_ID,
  QUESTION_COUNT_V21,
  detectPatterns,
  optionMeta,
}
