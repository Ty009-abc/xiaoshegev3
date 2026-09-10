/**
 * presentation/worldModel/v2_1/multipleSynthesisV21.js
 *
 * RC8.3 Stage1C-F2-M2 — MULTIPLE synthesis (Stage1C-B presentation layer).
 *
 * Deterministic STRUCTURED synthesis for the MULTIPLE_SUPPORTED_MODELS state.
 * It answers, in structured form (ids + provenance, NOT final prose):
 *   - which cognitive patterns are simultaneously supported
 *   - how they group (family span) → the common decision tension class
 *   - what type of model change is worth observing
 *
 * AUTHORITY (frozen): this module is PRESENTATION ONLY. It NEVER selects a
 * winner, NEVER ranks candidates, NEVER creates a primaryBlindSpot /
 * primaryStrategy / archetype, NEVER invents a world principle / scenario /
 * life outcome. Every clause is source-backed by accepted eligible candidates
 * (diagnosisState.eligibleCandidateIds) + their accepted evidence
 * (multiModelEvidence). No candidate is inferred here.
 *
 * N-CANDIDATE SAFE: the synthesis is count-derived (grouping + count), never
 * dependent on a fixed N (N >= 2). No hardcoded numeral.
 *
 * @version multiple_synthesis_v1
 */

'use strict'

const { getFamilyForCandidate, BLIND_SPOT_FAMILIES } = require('../../../engine/worldModel/blindSpotFamilyDefinitions')

const MULTIPLE_SYNTHESIS_VERSION = 'multiple_synthesis_v1'

/**
 * Build the deterministic MULTIPLE synthesis.
 *
 * @param {object} params
 * @param {Array}  params.eligibleCandidateIds  decision.eligibleCandidateIds (accepted engine truth)
 * @param {Array}  params.multiModelEvidence     presentation multiModelEvidence (per-candidate rows)
 * @returns {object|null} synthesis (null unless N >= 2)
 */
function buildMultipleSynthesisV21({ eligibleCandidateIds, multiModelEvidence }) {
  const ids = Array.isArray(eligibleCandidateIds) ? eligibleCandidateIds.slice() : []
  if (ids.length < 2) return null

  const evidenceCountBy = {}
  for (const m of (Array.isArray(multiModelEvidence) ? multiModelEvidence : [])) {
    if (!m || !m.blindSpotId) continue
    evidenceCountBy[m.blindSpotId] = Array.isArray(m.rows) ? m.rows.length : 0
  }

  // One supported pattern per eligible candidate — deterministic engine order.
  // Structured (ids only); localization happens in the report copy layer.
  const supportedPatterns = ids.map((candidateId) => ({
    candidateId,
    familyId: getFamilyForCandidate(candidateId) || null,
    evidenceCount: evidenceCountBy[candidateId] || 0,
    source: { candidateIds: [candidateId] },
  }))

  // Family grouping (deterministic first-appearance order).
  const familyOrder = []
  const familyMembers = {}
  for (const p of supportedPatterns) {
    const fid = p.familyId || 'UNGROUPED'
    if (!familyMembers[fid]) { familyMembers[fid] = []; familyOrder.push(fid) }
    familyMembers[fid].push(p.candidateId)
  }
  const familyGroups = familyOrder.map((fid) => ({
    familyId: fid === 'UNGROUPED' ? null : fid,
    familyLabel: (fid !== 'UNGROUPED' && BLIND_SPOT_FAMILIES[fid]) ? BLIND_SPOT_FAMILIES[fid].label : null,
    candidateIds: familyMembers[fid].slice(),
    source: { candidateIds: familyMembers[fid].slice() },
  }))

  const allCandidateIds = supportedPatterns.map((p) => p.candidateId)

  return {
    version: MULTIPLE_SYNTHESIS_VERSION,
    state: 'MULTIPLE',

    // 1) what patterns are simultaneously supported
    supportedPatterns,
    patternCount: supportedPatterns.length,

    // 2) how they group → common decision tension class (single vs multi domain)
    familyGroups,
    familyCount: familyGroups.length,
    allSameFamily: familyGroups.length === 1,
    // Structured tension descriptor (report localizes; no freehand prose here).
    tension: {
      type: familyGroups.length === 1 ? 'FOCUSED_MULTI_MODEL' : 'BROAD_MULTI_MODEL',
      source: { candidateIds: allCandidateIds.slice() },
    },
    // Structured model-change direction descriptor (no invented strategy).
    modelDirection: {
      key: 'BUILD_SHARED_DECISION_HABIT',
      coveredCandidateIds: allCandidateIds.slice(),
      source: { candidateIds: allCandidateIds.slice() },
    },

    // 3) authority invariants (must hold; validated downstream)
    isPrimary: false,
    noWinner: true,
    noRanking: true,
    noFabricatedPrimary: true,
    noInventedWorldRule: true,
    noInventedScenario: true,
    noInventedOutcome: true,
    deterministic: true,
    provenance: {
      sources: [
        'presentation.diagnosisState.eligibleCandidateIds',
        'presentation.multiModelEvidence',
        'engine/worldModel/blindSpotFamilyDefinitions',
      ],
      engineAuthority: 'WORLD_MODEL_V2_1_ENGINE',
      presentationOnly: true,
    },
  }
}

module.exports = {
  MULTIPLE_SYNTHESIS_VERSION,
  buildMultipleSynthesisV21,
}
