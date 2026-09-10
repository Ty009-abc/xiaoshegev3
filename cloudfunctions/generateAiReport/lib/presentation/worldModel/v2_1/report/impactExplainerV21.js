/**
 * presentation/worldModel/v2_1/report/impactExplainerV21.js
 *
 * RC8.3 Stage1C-F2-M2 — Layer-2 explainability block (report product structure).
 *
 * Layer 2 is the "WHY" surface, reached from the Layer-1 conclusion:
 *   - supported model details (labels + statements)
 *   - full source-backed evidence (ALL rows preserved — no truncation)
 *   - user model vs world rule (UNIQUE only; authority exists)
 *   - scenario contrast + full cognitive map (UNIQUE only; authority exists)
 *
 * AUTHORITY (frozen): derived ONLY from the accepted presentation truth and the
 * already-built report sections. For MULTIPLE it MUST NOT fabricate the missing
 * unique-primary world rule / strategy / scenario. No model is hidden from
 * Layer 2. Provenance raw tokens stay in the report and are dropped by the VM.
 *
 * @version impact_explainer_v1
 */

'use strict'

const { getBlindSpotLabel, getBlindSpotCurrentModel, getMultipleObservation } = require('./northStarReportCopyV21')

const EXPLAINER_VERSION = 'impact_explainer_v1'

function sectionById(sections, id) {
  if (!Array.isArray(sections)) return null
  for (const s of sections) if (s && s.sectionId === id) return s
  return null
}

function mapEvidenceRows(items) {
  return (Array.isArray(items) ? items : []).map((it) => ({
    order: it.order || 0,
    questionMeaning: it.questionMeaning || '',
    selectedAnswerMeaning: it.selectedAnswerMeaning || '',
    whatSignalItShows: it.whatSignalItShows || '',
    howItSupportsDiagnosis: it.howItSupportsDiagnosis || '',
  }))
}

/**
 * Build the Layer-2 explainability block.
 *
 * @param {object} pm         north_star_presentation_v1
 * @param {Array}  sections   the 9 canonical report sections
 * @returns {object|null}     explainer (null for states without diagnosis IA)
 */
function buildImpactExplainerV21(pm, sections) {
  if (!pm || !pm.diagnosisState) return null
  const ds = pm.diagnosisState
  const primary = pm.primaryDiagnosis

  // ── UNIQUE — full authority-backed explainability ──────────────────────
  if (primary && primary.blindSpotId) {
    const worldRule = sectionById(sections, '03_WORLD_RULE_ALIGNMENT')
    const evidence = sectionById(sections, '04_WHY_WE_JUDGE_THIS')
    const scenario = sectionById(sections, '08_SCENARIO_CONTRAST')
    const secondary = sectionById(sections, '09_SECONDARY_MODEL_CONTEXT')

    return {
      version: EXPLAINER_VERSION,
      state: 'UNIQUE',
      count: null,
      supportedModels: [],
      evidence: mapEvidenceRows(evidence && evidence.body ? evidence.body.items : []),
      worldModel: (worldRule && worldRule.body) ? {
        userModel: worldRule.body.userModel || '',
        worldRule: worldRule.body.worldRule || '',
        misalignment: worldRule.body.misalignment || '',
        whyItMatters: worldRule.body.whyItMatters || null,
      } : null,
      scenario: (scenario && scenario.body) ? {
        currentModel: scenario.body.currentModel || null,
        upgradedModel: scenario.body.upgradedModel || null,
        uncertainty: Array.isArray(scenario.body.uncertainty) ? scenario.body.uncertainty : [],
        simulationNote: scenario.body.simulationNote || '',
      } : null,
      fullModelMap: (secondary && secondary.body && Array.isArray(secondary.body.fullModelMap))
        ? secondary.body.fullModelMap.map((d) => ({
            label: d.label || '',
            orientationLabel: d.orientationLabel || '',
            stateLabel: d.stateLabel || '',
          }))
        : [],
      sourceRefs: [
        'report.sections.03_WORLD_RULE_ALIGNMENT',
        'report.sections.04_WHY_WE_JUDGE_THIS',
        'report.sections.08_SCENARIO_CONTRAST',
        'report.sections.09_SECONDARY_MODEL_CONTEXT',
      ],
      deterministic: true,
    }
  }

  // ── MULTIPLE — no fabricated unique-primary world rule / strategy / scenario
  if (ds.reasonCode === 'MULTIPLE_SUPPORTED_MODELS') {
    const eligible = Array.isArray(ds.eligibleCandidateIds) ? ds.eligibleCandidateIds.slice() : []
    if (eligible.length < 2) return null

    // ALL eligible models preserved (no truncation, no hiding).
    const evidenceByCandidate = {}
    for (const m of (Array.isArray(pm.multiModelEvidence) ? pm.multiModelEvidence : [])) {
      if (m && m.blindSpotId) evidenceByCandidate[m.blindSpotId] = Array.isArray(m.rows) ? m.rows : []
    }
    const supportedModels = eligible.map((id) => ({
      label: getBlindSpotLabel(id) || '',
      statement: getBlindSpotCurrentModel(id) || '',
      observation: getMultipleObservation(id) || '',
      evidence: mapEvidenceRows(evidenceByCandidate[id]),
    }))

    return {
      version: EXPLAINER_VERSION,
      state: 'MULTIPLE',
      count: supportedModels.length,
      supportedModels,
      evidence: [],            // flattened summary lives in Layer 1 preview
      worldModel: null,        // no fabricated unique-primary world rule
      scenario: null,          // no fabricated unique-primary scenario
      fullModelMap: [],        // no unique-primary dimension map for MULTIPLE
      sourceRefs: [
        'presentation.multiModelEvidence',
        'presentation.diagnosisState.eligibleCandidateIds',
      ],
      deterministic: true,
    }
  }

  return null
}

module.exports = {
  EXPLAINER_VERSION,
  buildImpactExplainerV21,
}
