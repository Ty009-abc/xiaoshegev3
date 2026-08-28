/**
 * engine/worldModel/v2_1/signalExtractorV21.js
 *
 * World Model v2.1 — Typed Signal Extractor (Stage19A2).
 *
 * SHADOW ONLY. Semantic aggregation ONLY — no scoring, no confidence, no weights,
 * no ranking. Does not touch dimension, blindspot, primary, follow-up, response
 * validity, strategy, report, runtime, or UI.
 *
 * Authority priority: R3C > R3B > R3A > R3 > R2 > R1.
 *
 * Input  = normalized atomic evidence (from evidenceNormalizerV21).
 * Output = typed semantic signals that preserve the inference mechanism.
 *
 * signalId is a DETERMINISTIC function of (construct, direction, distortionType):
 *   H evidence → `${construct}/H`
 *   N evidence → `${construct}/N`
 *   D evidence → `${construct}/D/${distortionType}`
 *
 * Therefore:
 *   DECISION/D/certainty-gate   ≠   DECISION/D/analysis-paralysis
 *   FEEDBACK/D/feedback-as-threat ≠ FEEDBACK/D/feedback-as-noise
 * Multiple distortion types within one construct COEXIST as separate signals.
 * No collapse into a generic construct deficit.
 *
 * H / N signals carry distortionType = null (never a fabricated healthy/neutral type).
 * D signals preserve the catalog distortionType verbatim.
 *
 * This module reads only: evidenceId, construct, direction, distortionType.
 *
 * @version world_model_v2_1
 */

function buildSignalId(construct, direction, distortionType) {
  if (direction === 'D') return `${construct}/D/${distortionType}`
  return `${construct}/${direction}`
}

/**
 * Extract typed semantic signals from normalized atomic evidence.
 *
 * @param {Array|{evidence:Array}} normalizedEvidence — evidence array (or normalizer result).
 * @returns {Array<{signalId:string, construct:string, direction:string, distortionType:string|null, supportingEvidenceIds:Array<string>, evidenceCount:number}>}
 */
function extractSignalsV21(normalizedEvidence) {
  const input = Array.isArray(normalizedEvidence)
    ? normalizedEvidence
    : normalizedEvidence && Array.isArray(normalizedEvidence.evidence)
      ? normalizedEvidence.evidence
      : []

  const groups = new Map() // key -> group

  for (const e of input) {
    if (!e || typeof e.evidenceId !== 'string') continue
    const construct = e.construct
    const direction = e.direction
    // H / N → distortionType forced null; D → preserve catalog distortionType.
    const distortionType = direction === 'D' ? e.distortionType : null
    const key = `${construct}\u0000${direction}\u0000${distortionType == null ? '' : distortionType}`
    let g = groups.get(key)
    if (!g) {
      g = { construct, direction, distortionType, evidenceIds: new Set() }
      groups.set(key, g)
    }
    g.evidenceIds.add(e.evidenceId)
  }

  return [...groups.values()]
    .map((g) => ({
      signalId: buildSignalId(g.construct, g.direction, g.distortionType),
      construct: g.construct,
      direction: g.direction,
      distortionType: g.distortionType,
      supportingEvidenceIds: [...g.evidenceIds].sort(),
      evidenceCount: g.evidenceIds.size,
    }))
    .sort((a, b) => (a.signalId < b.signalId ? -1 : a.signalId > b.signalId ? 1 : 0))
}

module.exports = {
  extractSignalsV21,
}
