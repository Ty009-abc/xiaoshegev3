'use strict'
/**
 * lib/cognitiveProfile/profileSchemaV1.js
 *
 * RC8.4 V6 R77 — COGNITIVE PROFILE V1 schema + PROVENANCE MODEL.
 *
 * The COGNITIVE PROFILE is a SECTION-STACKED snapshot carried inside the
 * EXISTING `user_profiles` document (NO competing collection). The existing nine
 * cognitive dimensions stay at the root and are NEVER touched by this schema.
 *
 * Sections:
 *   diagnosticState   — deterministic / high-confidence structured outputs
 *   cognitiveState    — INFERRED R70/R75 thesis interpretation (id + expression)
 *   currentFocus      — downstream personalization inputs (no consumer yet)
 *   learningHistory   — append-only seen[] sets (merge, never reset)
 *
 * PROVENANCE (§8/§9): every assertion distinguishes
 *   OBSERVED    — a literal user/report fact
 *   DERIVED     — mechanically computed from OBSERVED facts (no inference)
 *   INFERRED    — a model/kernel interpretation of the evidence
 *   HYPOTHESIS  — a forward-looking, unproven possibility
 * AI inference must NEVER silently become OBSERVED fact. Confidence uses
 * HIGH / MEDIUM / LOW (deliberately coarse — no fake numeric precision).
 *
 * Pure data + pure helpers. No I/O. No AI. No time of its own (ts injected).
 */

const COGNITIVE_PROFILE_SCHEMA_VERSION = 'cognitive_profile_v1'

const PROVENANCE = Object.freeze({
  OBSERVED: 'OBSERVED',
  DERIVED: 'DERIVED',
  INFERRED: 'INFERRED',
  HYPOTHESIS: 'HYPOTHESIS'
})

const CONFIDENCE = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
})

const SECTION_KEYS = Object.freeze([
  'diagnosticState',
  'cognitiveState',
  'currentFocus',
  'learningHistory'
])

// The nine EXISTING cognitive dimensions. Listed here ONLY so this module can
// assert it never emits them in an update patch (they are owned elsewhere).
const EXISTING_COGNITIVE_DIMENSIONS = Object.freeze([
  'laborMindset', 'probabilityMindset', 'systemThinking',
  'leverageThinking', 'capitalThinking', 'riskAwareness',
  'informationSensitivity', 'longTermism', 'decisionStability',
  'wealthPotentialScore', 'turnaroundProbability', 'mainType', 'subType'
])

/**
 * Build ONE provenance-bearing assertion.
 * @param {*} value
 * @param {string} provenance OBSERVED | DERIVED | INFERRED | HYPOTHESIS
 * @param {string} confidence HIGH | MEDIUM | LOW
 * @param {string} source     machine-readable origin (never a raw answer dump)
 * @param {number} ts         injected timestamp (ms)
 */
function assertion (value, provenance, confidence, source, ts) {
  return {
    value: (value === undefined) ? null : value,
    provenance: provenance,
    confidence: confidence,
    source: source,
    updatedAt: ts
  }
}

/** A tagged interpretation: stable id (may be null) + human-readable expression. */
function taggedExpression (id, expression, provenance, confidence, source, ts) {
  return {
    id: (id === undefined || id === '') ? null : id,
    expression: (expression === undefined || expression === '') ? null : expression,
    provenance: provenance,
    confidence: confidence,
    source: source,
    updatedAt: ts
  }
}

/** Empty append-only learning history (§7: initialize without destroying data). */
function emptyLearningHistory (ts) {
  return {
    seenRuleIds: [],
    seenInsightIds: [],
    seenStrikeIds: [],
    provenance: PROVENANCE.OBSERVED,
    confidence: CONFIDENCE.HIGH,
    source: 'profile_init',
    updatedAt: ts
  }
}

module.exports = {
  COGNITIVE_PROFILE_SCHEMA_VERSION,
  PROVENANCE,
  CONFIDENCE,
  SECTION_KEYS,
  EXISTING_COGNITIVE_DIMENSIONS,
  assertion,
  taggedExpression,
  emptyLearningHistory
}
