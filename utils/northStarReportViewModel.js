/**
 * utils/northStarReportViewModel.js
 *
 * RC8.3 Stage1C-D1 — North Star report UI view-model builder.
 *
 * PURE PRESENTATION LAYER. Converts a `north_star_report_v1` report object
 * (produced by Stage1C-C) into a flat, WXML-bindable view model.
 *
 * AUTHORITY BOUNDARY (frozen by Stage1C-D1):
 *   - Consumes ONLY the report content model from Stage1C-C.
 *   - Answers "HOW TO PRESENT", never "WHAT IS TRUE".
 *   - NO blindSpotId → custom copy, NO blindSpotId → principle/strategy/
 *     archetype/scenario re-derivation, NO frontend semantic inference.
 *   - NO duplicate copy tables. All diagnosis copy comes from the report.
 *
 * RAW TOKEN SAFETY:
 *   - Provenance fields (blindSpotId / strategyId / reasonCode / signalId /
 *     questionId / optionId / raw dimension enums) are DROPPED here, so they
 *     can never reach WXML binding.
 *
 * UI INFORMATION ARCHITECTURE (frozen by Stage1C-D1 §4):
 *   PRIMARY FLOW = 8 sections, SECONDARY (collapsed) = 1 section.
 *
 * @version north_star_report_v1 (UI view model)
 */

'use strict'

// Section ids are internal keys, not user-facing copy, and not raw engine tokens.
const SECTION = {
  VERDICT: '01_COGNITIVE_VERDICT',
  CURRENT_MODEL: '02_CURRENT_WORLD_MODEL',
  WORLD_RULE: '03_WORLD_RULE_ALIGNMENT',
  EVIDENCE: '04_WHY_WE_JUDGE_THIS',
  CONSEQUENCE: '05_DECISION_CONSEQUENCE',
  UPGRADE: '06_COGNITIVE_UPGRADE',
  PROTOCOL: '07_DECISION_PROTOCOL',
  SCENARIO: '08_SCENARIO_CONTRAST',
  SECONDARY: '09_SECONDARY_MODEL_CONTEXT',
}

// UI section headings — presentation-neutral labels, not diagnosis copy.
const TITLE = {
  VERDICT: '核心认知诊断',
  CURRENT_MODEL: '你的默认世界模型',
  WORLD_RULE: '你与现实规则的错位',
  EVIDENCE: '为什么这样判断你',
  CONSEQUENCE: '这个模型如何影响决策',
  UPGRADE: '你的认知升级',
  PROTOCOL: '下一次怎么做',
  SCENARIO: '旧模型 vs 新模型',
  SECONDARY: '完整认知地图',
}

// Layer-1 impact summary section headings (F2-M2 IA). Presentation-neutral
// chrome — same class as TITLE above (not diagnosis copy, not a taxonomy dump).
const IMPACT_TITLE = {
  FATAL_INSIGHT: '致命一句话',
  CORE_PROBLEM: '核心问题',
  SYSTEM_TRAP: '系统困局',
  UPGRADE_PATH: '模型升级',
  ACTION_PLAN: '行动建议',
  EVIDENCE: '支持这个判断的回答',
  LAYER2: '为什么系统这样判断我',
  LAYER2_HINT: '展开查看完整证据与推理链条',
}

function byId(sections, id) {
  if (!Array.isArray(sections)) return null
  for (const s of sections) {
    if (s && s.sectionId === id) return s
  }
  return null
}

// ── Neutral state layout selection (Stage1C-D2 §4) ────────────────────────
// The report content model already carries `diagnosisState` (status /
// reasonCode / primaryBlindSpotId). The view-model selects a NEUTRAL layout
// per state — it never re-derives diagnosis semantics, never maps reasonCode
// to blind-spot/strategy/world-rule/archetype/scenario copy.
const UI_STATE = {
  UNIQUE: 'UNIQUE',
  MULTIPLE: 'MULTIPLE',
  NO_PRIMARY: 'NO_PRIMARY',
  INSUFFICIENT: 'INSUFFICIENT',
  CONTRADICTORY: 'CONTRADICTORY',
  BLOCKED: 'BLOCKED',
}

// Neutral state copy (presentation-neutral, NOT diagnosis copy).
const STATE_MESSAGE = {
  MULTIPLE: '本次测评中，多个认知方向都获得了足够的证据支持，彼此难以简单分出主次。',
  NO_PRIMARY: '本次测评未发现显著的主导性认知偏差，你的回答整体较为均衡。',
  INSUFFICIENT: '本次回答提供的信息不足以形成确定性的认知判断。',
  CONTRADICTORY: '本次回答中存在相互冲突的线索，认知方向尚未收敛。',
  BLOCKED: '本次测评数据不完整，无法生成认知报告。',
}

function resolveUiState(diagnosisState) {
  if (!diagnosisState) return UI_STATE.BLOCKED
  if (diagnosisState.primaryBlindSpotId) return UI_STATE.UNIQUE
  switch (diagnosisState.reasonCode) {
    case 'MULTIPLE_SUPPORTED_MODELS': return UI_STATE.MULTIPLE
    case 'NO_SUPPORTED_DEFICIT': return UI_STATE.NO_PRIMARY
    case 'CONTRADICTORY_EVIDENCE': return UI_STATE.CONTRADICTORY
    case 'INSUFFICIENT_DIRECTIONAL_EVIDENCE': return UI_STATE.INSUFFICIENT
    case 'FOLLOWUP_RELEVANT_PAIR': return UI_STATE.INSUFFICIENT // direction not converged
    case 'BLOCKED_BY_RESPONSE_VALIDITY': return UI_STATE.BLOCKED
    case 'NOT_EXECUTED': return UI_STATE.BLOCKED
    default: return UI_STATE.INSUFFICIENT
  }
}

// Drop provenance raw tokens; keep only user-facing fields.
function mapEvidenceItems(items) {
  if (!Array.isArray(items)) return []
  return items.map((it) => ({
    order: it.order || 0,
    questionMeaning: it.questionMeaning || '',
    selectedAnswerMeaning: it.selectedAnswerMeaning || '',
    whatSignalItShows: it.whatSignalItShows || '',
    howItSupportsDiagnosis: it.howItSupportsDiagnosis || '',
  }))
}

function mapProtocolSteps(steps) {
  if (!Array.isArray(steps)) return []
  return steps.map((s) => ({
    order: s.order || 0,
    name: s.name || '',
    description: s.description || '',
  }))
}

// MULTIPLE (multi-direction) block — pure pass-through, provenance dropped.
// Never branches on blindSpotId; never re-derives diagnosis semantics.
function mapMultiple(multiModel) {
  if (!multiModel || !Array.isArray(multiModel.supportedModels)) return null
  return {
    eyebrow: multiModel.eyebrow || '',
    headline: multiModel.headline || '',
    summary: multiModel.summary || '',
    evidenceHeading: multiModel.evidenceHeading || '',
    supportedModels: multiModel.supportedModels.map((m) => ({
      label: m.label || '',
      statement: m.statement || '',
      evidence: Array.isArray(m.evidence)
        ? m.evidence.map((e) => ({
            order: e.order || 0,
            questionMeaning: e.questionMeaning || '',
            selectedAnswerMeaning: e.selectedAnswerMeaning || '',
            whatSignalItShows: e.whatSignalItShows || '',
            howItSupportsDiagnosis: e.howItSupportsDiagnosis || '',
          }))
        : [],
      observation: m.observation || '',
    })),
    synthesisTitle: multiModel.synthesisTitle || '',
    synthesis: multiModel.synthesis || '',
    nextObservationTitle: multiModel.nextObservationTitle || '',
  }
}

function mapFullModelMap(fullModelMap) {
  if (!Array.isArray(fullModelMap)) return []
  // Keep only localized labels; drop source.{construct,orientation,state} raw enums.
  return fullModelMap.map((d) => ({
    label: d.label || '',
    orientationLabel: d.orientationLabel || '',
    stateLabel: d.stateLabel || '',
  }))
}

// Layer-1 impact summary (F2-M2). Pure pass-through of the report's structured
// product block — the view-model answers "HOW TO PRESENT", never "WHAT IS TRUE".
// Titles are UI chrome; all diagnosis copy comes from the report. No numeral is
// hardcoded here (the report's count-neutral copy is consumed verbatim).
function mapImpactSummary(report) {
  const is = report && report.impactSummary
  if (!is) return null
  const preview = Array.isArray(is.evidencePreview) ? is.evidencePreview : []
  const loopSteps = Array.isArray(is.systemLoopSteps) ? is.systemLoopSteps : []
  return {
    state: is.state || '',
    eyebrow: '认知诊断',
    // Layer-1 logical cards: 01 FATAL_INSIGHT (hero) + 02/03/04 (sections)
    // + 05 ACTION_PLAN (list) = exactly 5.
    fatalInsight: is.fatalInsight || '',
    sections: [
      { key: 'CORE_PROBLEM', title: IMPACT_TITLE.CORE_PROBLEM, text: is.coreProblem || '' },
      { key: 'SYSTEM_TRAP', title: IMPACT_TITLE.SYSTEM_TRAP, text: is.systemTrap || '', loopSteps },
      { key: 'UPGRADE_PATH', title: IMPACT_TITLE.UPGRADE_PATH, text: is.upgradePath || '', from: is.upgradeFrom || '', to: is.upgradeTo || '' },
    ],
    layer1SectionCount: 5,
    actionTitle: IMPACT_TITLE.ACTION_PLAN,
    actionPlan: Array.isArray(is.actionPlan) ? is.actionPlan.slice() : [],
    // The single dominant first action (already the head of actionPlan).
    firstAction: is.firstAction || (Array.isArray(is.actionPlan) && is.actionPlan.length ? is.actionPlan[0] : ''),
    evidenceTitle: IMPACT_TITLE.EVIDENCE,
    evidencePreview: preview.map((e) => ({
      questionMeaning: e.questionMeaning || '',
      selectedAnswerMeaning: e.selectedAnswerMeaning || '',
      whatSignalItShows: e.whatSignalItShows || '',
    })),
    layer2Title: IMPACT_TITLE.LAYER2,
    layer2Hint: IMPACT_TITLE.LAYER2_HINT,
    // Layer-1 shows at most ONE conceptual model block (never N full-size cards).
    fullModelCardCount: 0,
  }
}

function mapExplainerEvidence(items) {
  if (!Array.isArray(items)) return []
  return items.map((e) => ({
    order: e.order || 0,
    questionMeaning: e.questionMeaning || '',
    selectedAnswerMeaning: e.selectedAnswerMeaning || '',
    whatSignalItShows: e.whatSignalItShows || '',
    howItSupportsDiagnosis: e.howItSupportsDiagnosis || '',
  }))
}

// Layer-2 explainability (F2-M2). For MULTIPLE it carries the FULL per-model
// detail (no model hidden); for UNIQUE the full world-model / scenario / map.
function mapImpactExplainer(report) {
  const ex = report && report.impactExplainer
  if (!ex) return null
  return {
    state: ex.state || '',
    count: typeof ex.count === 'number' ? ex.count : 0,
    supportedModels: Array.isArray(ex.supportedModels)
      ? ex.supportedModels.map((m) => ({
          label: m.label || '',
          statement: m.statement || '',
          observation: m.observation || '',
          evidence: mapExplainerEvidence(m.evidence),
        }))
      : [],
    evidence: mapExplainerEvidence(ex.evidence),
    worldModel: ex.worldModel
      ? {
          userModel: ex.worldModel.userModel || '',
          worldRule: ex.worldModel.worldRule || '',
          misalignment: ex.worldModel.misalignment || '',
          whyItMatters: ex.worldModel.whyItMatters || null,
        }
      : null,
    scenario: ex.scenario
      ? {
          currentModel: ex.scenario.currentModel || null,
          upgradedModel: ex.scenario.upgradedModel || null,
          uncertainty: Array.isArray(ex.scenario.uncertainty) ? ex.scenario.uncertainty : [],
          simulationNote: ex.scenario.simulationNote || '',
        }
      : null,
    fullModelMap: mapFullModelMap(ex.fullModelMap),
  }
}

/**
 * Build a flat view model from a north_star_report_v1 report.
 *
 * @param {object} report  buildNorthStarReportV21 output
 * @returns {{supported:boolean, hasPrimary:boolean, verdict:?object,
 *            currentModel:?object, worldRule:?object, evidence:?object,
 *            consequence:?object, upgrade:?object, protocol:?object,
 *            scenario:?object, secondary:?object}}
 */
function buildNorthStarReportViewModel(report) {
  if (!report || report.version !== 'north_star_report_v1' || !Array.isArray(report.sections)) {
    return { supported: false }
  }

  const sections = report.sections
  const uiState = resolveUiState(report.diagnosisState)
  const hasPrimary = uiState === UI_STATE.UNIQUE

  // Non-primary states: neutral layout only, no diagnosis sections rendered.
  // (Body-less "未得出" placeholder sections would mislead — e.g. MULTIPLE is
  // NOT insufficient evidence, BLOCKED must show no diagnosis content at all.)
  if (!hasPrimary) {
    const result = {
      supported: true,
      uiState,
      hasPrimary,
      stateMessage: STATE_MESSAGE[uiState] || '',
      retakeAvailable: uiState === UI_STATE.INSUFFICIENT,
      verdict: null,
      currentModel: null,
      worldRule: null,
      evidence: null,
      consequence: null,
      upgrade: null,
      protocol: null,
      scenario: null,
      secondary: null,
    }
    // Layer-1/Layer-2 product blocks: present ONLY when the report carries them
    // (UNIQUE / MULTIPLE). Other states keep the exact neutral shape.
    const impactSummary = mapImpactSummary(report)
    const impactExplainer = mapImpactExplainer(report)
    if (impactSummary) { result.impactSummary = impactSummary; result.impactExplainer = impactExplainer }
    // Preserve exact shape for non-MULTIPLE states (byte-identical outputs).
    if (uiState === UI_STATE.MULTIPLE) result.multiple = mapMultiple(report.multiModel)
    return result
  }

  const verdict = byId(sections, SECTION.VERDICT)
  const currentModel = byId(sections, SECTION.CURRENT_MODEL)
  const worldRule = byId(sections, SECTION.WORLD_RULE)
  const evidence = byId(sections, SECTION.EVIDENCE)
  const consequence = byId(sections, SECTION.CONSEQUENCE)
  const upgrade = byId(sections, SECTION.UPGRADE)
  const protocol = byId(sections, SECTION.PROTOCOL)
  const scenario = byId(sections, SECTION.SCENARIO)
  const secondary = byId(sections, SECTION.SECONDARY)

  const result = {
    supported: true,
    uiState,
    hasPrimary,
    stateMessage: '',
    retakeAvailable: false,

    verdict: verdict ? {
      title: TITLE.VERDICT,
      summary: verdict.summary || '',
      blindSpotLabel: (verdict.body && verdict.body.blindSpotLabel) || '',
    } : null,

    currentModel: currentModel ? {
      title: TITLE.CURRENT_MODEL,
      statement: currentModel.summary || '',
    } : null,

    worldRule: (worldRule && worldRule.body) ? {
      title: TITLE.WORLD_RULE,
      userModel: worldRule.body.userModel || '',
      worldRule: worldRule.body.worldRule || '',
      misalignment: worldRule.body.misalignment || '',
      whyItMatters: worldRule.body.whyItMatters || null,
    } : null,

    evidence: (evidence && evidence.body) ? {
      title: TITLE.EVIDENCE,
      items: mapEvidenceItems(evidence.body.items),
    } : null,

    consequence: consequence ? {
      title: TITLE.CONSEQUENCE,
      consequence: consequence.summary || '',
    } : null,

    upgrade: (upgrade && upgrade.body) ? {
      title: TITLE.UPGRADE,
      upgradedModel: upgrade.body.upgradedModel || '',
      strategyLabel: upgrade.body.strategyLabel || '',
    } : null,

    protocol: (protocol && protocol.body) ? {
      title: TITLE.PROTOCOL,
      trigger: protocol.body.trigger || '',
      steps: mapProtocolSteps(protocol.body.steps),
      successSignal: protocol.body.successSignal || '',
      reviewWindow: protocol.body.reviewWindow || '',
      stopCondition: protocol.body.stopCondition || '',
    } : null,

    scenario: (scenario && scenario.body) ? {
      title: TITLE.SCENARIO,
      currentModel: scenario.body.currentModel || null,
      upgradedModel: scenario.body.upgradedModel || null,
      uncertainty: Array.isArray(scenario.body.uncertainty) ? scenario.body.uncertainty : [],
      simulationNote: scenario.body.simulationNote || '',
    } : null,

    secondary: (secondary && secondary.body) ? {
      title: TITLE.SECONDARY,
      archetype: secondary.body.archetype
        ? {
            label: secondary.body.archetype.label || '',
            description: secondary.body.archetype.description || '',
          }
        : null,
      strengths: Array.isArray(secondary.body.strengths) ? secondary.body.strengths : [],
      primaryDistortion: secondary.body.primaryDistortion || '',
      relatedDimensions: Array.isArray(secondary.body.relatedDimensions) ? secondary.body.relatedDimensions : [],
      fullModelMap: mapFullModelMap(secondary.body.fullModelMap),
    } : null,
  }

  // Layer-1/Layer-2 product blocks (UNIQUE carries both).
  const impactSummary = mapImpactSummary(report)
  const impactExplainer = mapImpactExplainer(report)
  if (impactSummary) { result.impactSummary = impactSummary; result.impactExplainer = impactExplainer }
  return result
}

module.exports = {
  SECTION,
  TITLE,
  IMPACT_TITLE,
  UI_STATE,
  STATE_MESSAGE,
  resolveUiState,
  buildNorthStarReportViewModel,
}
