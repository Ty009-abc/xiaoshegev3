/**
 * presentation/worldModel/v2_1/report/impactSummaryV21.js
 *
 * RC8.3 Stage1C-F2-M2 → F2-M5 — Layer-1 Impact Summary (5-card renderer).
 *
 * Renders the IMPACT THESIS (impactThesisV21) into the five-card Layer-1
 * structure the UI shows first:
 *   Card 01 FATAL_INSIGHT   致命一句话   (hero, ≤60)
 *   Card 02 CORE_PROBLEM    核心问题     (≤120)
 *   Card 03 SYSTEM_TRAP     系统困局     (≤160, ≥4-step loop)
 *   Card 04 UPGRADE_PATH    模型升级     (≤140, FROM → TO)
 *   Card 05 ACTION_PLAN     行动建议     (≤5 bullets, 1 concrete first action)
 *   + evidencePreview       2-4 compressed, source-backed evidence bullets
 *
 * AUTHORITY (frozen): this module is REPORT EXPRESSION ONLY. The synthesis
 * authority is impactThesisV21 (presentation-truth → impact thesis); this module
 * performs NO new semantic derivation — it only bounds/clamps and re-shapes the
 * thesis for the UI. It NEVER re-derives diagnosis, NEVER invents a world
 * rule/strategy/scenario/outcome, NEVER ranks or selects a winner. All Layer-1
 * copy is count-neutral (N >= 2) — no hardcoded numeral.
 *
 * @version impact_summary_v1
 */

'use strict'

const { buildImpactThesisV21, BUDGET, THESIS_VERSION } = require('./impactThesisV21')

const IMPACT_VERSION = 'impact_summary_v1'

/**
 * Render the Layer-1 impact summary from the impact thesis. Returns null unless
 * the state carries semantics that support the 5-card impact IA
 * (UNIQUE / MULTIPLE). Other states keep the truthful compact neutral layout.
 *
 * @param {object} pm  north_star_presentation_v1
 * @returns {object|null}
 */
function buildImpactSummaryV21(pm) {
  const thesis = buildImpactThesisV21(pm)
  if (!thesis) return null

  return {
    version: IMPACT_VERSION,
    thesisVersion: THESIS_VERSION,
    state: thesis.state,
    count: thesis.count == null ? null : thesis.count,

    // Five primary cards.
    fatalInsight: thesis.card.fatalInsight.text,
    coreProblem: thesis.card.coreProblem.text,
    systemTrap: thesis.card.systemTrap.text,
    upgradePath: thesis.card.upgradePath.text,
    actionPlan: Array.isArray(thesis.card.actionPlan.items) ? thesis.card.actionPlan.items.slice() : [],
    firstAction: thesis.firstActionPrinciple || '',

    // Structured extras the UI may use (system-loop chain, FROM → TO).
    systemLoop: thesis.systemLoop || '',
    systemLoopSteps: (thesis.systemLoop || '').split(' → ').filter(Boolean),
    upgradeFrom: thesis.upgradeFrom || '',
    upgradeTo: thesis.upgradeTo || '',

    evidencePreview: Array.isArray(thesis.evidencePreview) ? thesis.evidencePreview.slice() : [],

    // Per-card provenance (mission §9): every clause carries its source ids.
    card: {
      fatalInsight: { sourceCandidateIds: thesis.card.fatalInsight.sourceCandidateIds.slice() },
      coreProblem: { sourceCandidateIds: thesis.card.coreProblem.sourceCandidateIds.slice() },
      systemTrap: { sourceCandidateIds: thesis.card.systemTrap.sourceCandidateIds.slice() },
      upgradePath: { sourceCandidateIds: thesis.card.upgradePath.sourceCandidateIds.slice() },
      actionPlan: { sourceCandidateIds: thesis.card.actionPlan.sourceCandidateIds.slice() },
    },
    sourceCandidateIds: thesis.sourceCandidateIds.slice(),

    sourceRefs: thesis.sourceRefs.slice(),
    provenance: {
      clauses: {
        fatalInsight: thesis.provenance.clauses.fatalInsight.slice(),
        coreProblem: thesis.provenance.clauses.coreProblem.slice(),
        systemTrap: thesis.provenance.clauses.systemTrap.slice(),
        upgradePath: thesis.provenance.clauses.upgradePath.slice(),
        actionPlan: thesis.provenance.clauses.actionPlan.slice(),
      },
      deterministic: true,
    },
  }
}

// Layer-1 section titles (UI chrome; presentation-neutral, not diagnosis copy).
const IMPACT_SECTION_TITLES = Object.freeze({
  FATAL_INSIGHT: '致命一句话',
  CORE_PROBLEM: '核心问题',
  SYSTEM_TRAP: '系统困局',
  UPGRADE_PATH: '模型升级',
  ACTION_PLAN: '行动建议',
})

const LAYER2_TITLE = '为什么系统这样判断我'

module.exports = {
  IMPACT_VERSION,
  BUDGET,
  IMPACT_SECTION_TITLES,
  LAYER2_TITLE,
  buildImpactSummaryV21,
}
