/**
 * presentation/worldModel/v2_1/report/northStarReportBuilderV21.js
 *
 * RC8.3 Stage1C-C — North Star Report Builder (CORE).
 *
 * Converts north_star_presentation_v1 (structured presentation truth) into a
 * user-facing Chinese report CONTENT MODEL. Produces STRUCTURED sections
 * (sectionId / title / summary / body / sourceRefs / provenance) — NOT WXML,
 * NOT WXSS, NOT final rendered UI (that is Stage1C-D).
 *
 * Dependency direction (one-way, frozen):
 *   report builder → northStarPresentationModel  (allowed)
 *   presentation model → report builder          (FORBIDDEN)
 *   engine → report builder                      (FORBIDDEN)
 *
 * The builder does NOT call inference engines directly. It consumes ONLY the
 * frozen presentation model + deterministic Chinese copy table. It does not
 * rediscover diagnosis, re-read raw answers, or reinterpret engine outputs.
 *
 * Product objective (§4): the report helps the user understand —
 *   1. 我现在是怎么理解这类问题的？
 *   2. 我的模型哪里和现实规则发生错位？
 *   3. 为什么系统这样判断我？
 *   4. 这种模型会怎样影响我的决策？
 *   5. 应该换成什么新的模型？
 *   6. 下一次遇到类似问题具体怎么思考？
 *   7. 旧模型和新模型会产生什么不同的决策路径？
 *
 * @version north_star_report_v1
 */

'use strict'

const {
  getBlindSpotVerdict,
  getBlindSpotCurrentModel,
  getBlindSpotLabel,
  getMultipleStateCopy,
  getMultipleObservation,
  getWorldRuleStatement,
  getWorldRuleConsequence,
  getWorldRuleMechanism,
  getMisalignment,
  getStrategyMechanism,
  getStrategyExperiments,
  getStrategySuccessSignal,
  getStrategyStopCondition,
  getStrategyReviewWindow,
  getScenarioPatternLocalization,
  getArchetypeDescription,
  getConstructLabel,
  getOrientationLabel,
  getStateLabel,
} = require('./northStarReportCopyV21')

const { buildImpactSummaryV21 } = require('./impactSummaryV21')
const { buildImpactExplainerV21 } = require('./impactExplainerV21')

const REPORT_VERSION = 'north_star_report_v1'

// ── Section factory ────────────────────────────────────────────────────────
function section(id, title, summary, body, sourceRefs) {
  return {
    sectionId: id,
    title,
    summary: summary || '',
    body: body || null,
    sourceRefs: Array.isArray(sourceRefs) ? sourceRefs : [],
    provenance: { deterministic: true, reportVersion: REPORT_VERSION },
  }
}

// ── 01 COGNITIVE_VERDICT ──────────────────────────────────────────────────
function buildVerdictSection(pm) {
  const primary = pm.primaryDiagnosis
  if (!primary) {
    const reasonCode = pm.diagnosisState && pm.diagnosisState.reasonCode
    if (reasonCode === 'MULTIPLE_SUPPORTED_MODELS') {
      // MULTIPLE is NOT "no conclusion" and NOT insufficient evidence: the
      // neutral verdict states that two directions are both strongly supported.
      const mcopy = getMultipleStateCopy()
      return section('01_COGNITIVE_VERDICT', '核心发现', mcopy.summary, null, ['presentation.diagnosisState'])
    }
    return section('01_COGNITIVE_VERDICT', '核心发现', '本次未得出唯一的核心认知发现。', null, ['presentation.diagnosisState'])
  }
  const blindSpotId = primary.blindSpotId
  const verdict = getBlindSpotVerdict(blindSpotId)
  return section(
    '01_COGNITIVE_VERDICT',
    '核心发现',
    verdict || '',
    {
      blindSpotLabel: primary.blindSpotLabel, // secondary taxonomy label
      source: { blindSpotId },
    },
    ['blindSpotDefinitions', 'presentation.primaryDiagnosis'],
  )
}

// ── 02 CURRENT_WORLD_MODEL ────────────────────────────────────────────────
function buildCurrentModelSection(pm) {
  const primary = pm.primaryDiagnosis
  if (!primary || !pm.userCurrentModel) {
    return section('02_CURRENT_WORLD_MODEL', '你现在的理解方式', '本次未得出可解释的当前认知模型。', null, ['presentation.diagnosisState'])
  }
  const currentModel = getBlindSpotCurrentModel(primary.blindSpotId)
  const evidenceCount = pm.evidenceExplanation ? pm.evidenceExplanation.rowCount : 0
  return section(
    '02_CURRENT_WORLD_MODEL',
    '你现在的理解方式',
    currentModel || '',
    {
      canonicalModelPattern: currentModel || '',
      caseSpecificEvidenceCount: evidenceCount,
    },
    ['presentation.userCurrentModel', 'presentation.evidenceExplanation'],
  )
}

// ── 03 WORLD_RULE_ALIGNMENT ───────────────────────────────────────────────
function buildWorldRuleSection(pm) {
  const primary = pm.primaryDiagnosis
  const rule = pm.worldOperatingRule
  const misalign = pm.modelMisalignment
  if (!primary || !rule) {
    return section('03_WORLD_RULE_ALIGNMENT', '世界运行规则', '本次未得出可解释的世界规则对齐。', null, ['presentation.diagnosisState'])
  }
  const statement = getWorldRuleStatement(rule.principleId)
  const mechanism = getWorldRuleMechanism(rule.principleId)
  const consequence = getWorldRuleConsequence(rule.principleId)
  const misalignment = getMisalignment(rule.principleId)
  const userModel = getBlindSpotCurrentModel(primary.blindSpotId)
  return section(
    '03_WORLD_RULE_ALIGNMENT',
    '世界运行规则',
    statement || '',
    {
      userModel: userModel || '',
      worldRule: statement || '',
      misalignment: misalignment || '',
      whyItMatters: {
        mechanism: mechanism || '',
        consequence: consequence || '',
      },
      source: { principleId: rule.principleId, blindSpotId: primary.blindSpotId },
    },
    ['worldPrinciples', 'presentation.worldOperatingRule', 'presentation.modelMisalignment'],
  )
}

// ── 04 WHY_WE_JUDGE_THIS ─────────────────────────────────────────────────
function buildEvidenceSection(pm) {
  const primary = pm.primaryDiagnosis
  const ev = pm.evidenceExplanation
  if (!primary || !ev || ev.rowCount === 0) {
    return section('04_WHY_WE_JUDGE_THIS', '为什么这样判断你', '本次没有足够的用户专属证据可展示。', null, ['presentation.evidenceExplanation'])
  }
  const items = ev.rows.map((row, i) => {
    const answerText = row.answerText || ''
    return {
      order: i + 1,
      questionMeaning: row.prompt || '',
      selectedAnswerMeaning: answerText,
      whatSignalItShows: row.semanticProposition || '',
      howItSupportsDiagnosis: row.supports === primary.blindSpotId ? '与核心发现的模式一致' : '关联证据',
      // provenance-only (not user copy)
      source: {
        questionId: row.questionId,
        optionId: row.optionId,
        evidenceId: row.evidenceId,
        signalId: row.behaviorSignalId,
      },
    }
  })
  return section(
    '04_WHY_WE_JUDGE_THIS',
    '为什么这样判断你',
    '',
    { items },
    ['questionnaireV21', 'evidenceCatalogV21', 'presentation.evidenceExplanation'],
  )
}

// ── 05 DECISION_CONSEQUENCE ───────────────────────────────────────────────
function buildConsequenceSection(pm) {
  const primary = pm.primaryDiagnosis
  if (!primary || !pm.worldOperatingRule) {
    return section('05_DECISION_CONSEQUENCE', '这种模式会怎样影响决策', '本次未得出可解释的决策后果。', null, ['presentation.diagnosisState'])
  }
  const consequence = getWorldRuleConsequence(pm.worldOperatingRule.principleId)
  const scenarioConsequences = pm.scenarioContrast && pm.scenarioContrast.currentModel
    ? pm.scenarioContrast.currentModel.possibleConsequences
    : []
  return section(
    '05_DECISION_CONSEQUENCE',
    '这种模式会怎样影响决策',
    consequence || '',
    {
      consequence: consequence || '',
      scenarioPossibleConsequences: scenarioConsequences,
      conditional: true, // consequences are conditional, not deterministic
    },
    ['worldPrinciples.consequence', 'scenarioSimulation.currentModelScenario'],
  )
}

// ── 06 COGNITIVE_UPGRADE ──────────────────────────────────────────────────
function buildUpgradeSection(pm) {
  const primary = pm.primaryDiagnosis
  const upgrade = pm.upgradedModel
  if (!primary || !upgrade) {
    return section('06_COGNITIVE_UPGRADE', '换一个怎样的新模型', '本次未得出可解释的认知升级方向。', null, ['presentation.diagnosisState'])
  }
  const mechanism = getStrategyMechanism(upgrade.strategyId)
  return section(
    '06_COGNITIVE_UPGRADE',
    '换一个怎样的新模型',
    upgrade.cognitiveUpgrade || '',
    {
      upgradedModel: upgrade.cognitiveUpgrade || '',
      strategyMechanism: mechanism || '',
      strategyLabel: upgrade.strategyLabel || '', // metadata, not primary
      source: { blindSpotId: primary.blindSpotId, strategyId: upgrade.strategyId },
    },
    ['strategyDefinitions.cognitiveUpgrade', 'presentation.upgradedModel'],
  )
}

// ── 07 DECISION_PROTOCOL ──────────────────────────────────────────────────
function buildProtocolSection(pm) {
  const primary = pm.primaryDiagnosis
  const proto = pm.decisionProtocol
  if (!primary || !proto) {
    return section('07_DECISION_PROTOCOL', '下次遇到类似问题怎么做', '本次未得出可执行的决策协议。', null, ['presentation.diagnosisState'])
  }
  const experiments = getStrategyExperiments(proto.strategyId)
  const successSignal = getStrategySuccessSignal(proto.strategyId)
  const stopCondition = getStrategyStopCondition(proto.strategyId)
  const reviewWindow = getStrategyReviewWindow(proto.strategyId)

  const steps = experiments.map((e, i) => ({
    order: i + 1,
    name: e.name,
    description: e.description,
  }))

  return section(
    '07_DECISION_PROTOCOL',
    '下次遇到类似问题怎么做',
    '',
    {
      trigger: proto.trigger || '',
      steps,
      successSignal: successSignal || '',
      reviewWindow: reviewWindow || '',
      stopCondition: stopCondition || '',
      source: { blindSpotId: primary.blindSpotId, strategyId: proto.strategyId, targetBlindSpot: proto.targetBlindSpot || primary.blindSpotId },
    },
    ['strategyDefinitions.experimentTemplates', 'presentation.decisionProtocol'],
  )
}

// ── 08 SCENARIO_CONTRAST ─────────────────────────────────────────────────
function buildScenarioSection(pm) {
  const primary = pm.primaryDiagnosis
  const contrast = pm.scenarioContrast
  if (!primary || !contrast) {
    return section('08_SCENARIO_CONTRAST', '旧模型与新模型的差别', '本次未得出可解释的情景对比。', null, ['presentation.diagnosisState'])
  }
  const cur = contrast.currentModel
  const up = contrast.upgradedModel

  // Localize the authoritative frozen English decision-pattern strings from
  // the presentation model. Unknown strings fall through untouched (never
  // re-derived), preserving the single scenario authority.
  const localize = (arr) => (Array.isArray(arr) ? arr.map((s) => getScenarioPatternLocalization(s) || s) : [])

  return section(
    '08_SCENARIO_CONTRAST',
    '旧模型与新模型的差别',
    '',
    {
      currentModel: {
        likelyDecisionPattern: localize(cur ? cur.likelyDecisionPattern : []),
        possibleConsequences: cur ? cur.possibleConsequences : [],
        assumptions: cur ? cur.assumptions : [],
      },
      upgradedModel: {
        likelyDecisionPattern: localize(up ? up.likelyDecisionPattern : []),
        possibleConsequences: up ? up.possibleConsequences : [],
        observableSignals: up ? up.observableSignals : [],
        changedVariable: up ? up.changedVariable : '',
      },
      uncertainty: up ? up.uncertainty : [],
      isDecisionChangeNotOutcomeClaim: contrast.isDecisionChangeNotOutcomeClaim,
      noFortuneTelling: contrast.noFortuneTelling,
      noPercentagePromise: contrast.noPercentagePromise,
      noCertainWealthOutcome: contrast.noCertainWealthOutcome,
      uncertaintyPreserved: contrast.uncertaintyPreserved,
      simulationNote: '情景推演，不是预测',
    },
    ['scenarioDefinitions', 'presentation.scenarioContrast'],
  )
}

// ── 09 SECONDARY_MODEL_CONTEXT ────────────────────────────────────────────
function buildSecondaryContextSection(pm) {
  const ctx = pm.secondaryContext
  const dims = ctx && Array.isArray(ctx.modelMap) ? ctx.modelMap : []

  const strengths = []
  const primaryDistortion = pm.primaryDiagnosis ? pm.primaryDiagnosis.sourceDimension : null
  const relatedDimensions = []
  const fullModelMap = dims.map((d) => ({
    label: getConstructLabel(d.construct) || d.construct,
    orientationLabel: getOrientationLabel(d.orientation) || d.orientation,
    stateLabel: getStateLabel(d.state) || d.state,
    source: { construct: d.construct, orientation: d.orientation, state: d.state },
  }))

  for (const d of dims) {
    if (d.orientation === 'HEALTHY' && d.state === 'STRONG') strengths.push(getConstructLabel(d.construct) || d.construct)
    if (d.orientation === 'DISTORTED') relatedDimensions.push(getConstructLabel(d.construct) || d.construct)
  }

  const archetype = ctx && ctx.archetype
  return section(
    '09_SECONDARY_MODEL_CONTEXT',
    '其他认知维度',
    '',
    {
      archetype: archetype
        ? {
            label: archetype.label,
            description: getArchetypeDescription(archetype.id) || '',
            source: { id: archetype.id, mode: archetype.mode || 'DESCRIPTIVE_ONLY' },
          }
        : null,
      strengths,
      primaryDistortion: primaryDistortion ? getConstructLabel(primaryDistortion) || primaryDistortion : null,
      relatedDimensions,
      fullModelMap,
    },
    ['archetypeDefinitions', 'dimensionEngineV21', 'presentation.secondaryContext'],
  )
}

// ── MULTIPLE (multi-direction) report block ─────────────────────────────
// When two or more cognitive directions are equally well supported
// (reasonCode MULTIPLE_SUPPORTED_MODELS), the report exposes EACH supported
// direction with its own evidence. It NEVER fabricates a primary verdict /
// strategy / world-rule / upgraded-model / scenario. It consumes ONLY
// pm.multiModelEvidence + pm.diagnosisState (no candidate is inferred).
function buildMultiModelSection(pm) {
  const ds = pm.diagnosisState || {}
  const isMultiple = ds.reasonCode === 'MULTIPLE_SUPPORTED_MODELS'
  const raw = Array.isArray(pm.multiModelEvidence) ? pm.multiModelEvidence : []
  const models = raw.map((m) => ({
    label: getBlindSpotLabel(m.blindSpotId) || '',
    statement: getBlindSpotCurrentModel(m.blindSpotId) || '',
    evidence: (Array.isArray(m.rows) ? m.rows : []).map((row, i) => ({
      order: i + 1,
      questionMeaning: row.prompt || '',
      selectedAnswerMeaning: row.answerText || '',
      whatSignalItShows: row.semanticProposition || '',
      howItSupportsDiagnosis: '与该方向的模式一致',
      // provenance-only (never user copy; dropped by the view-model)
      source: {
        questionId: row.questionId,
        optionId: row.optionId,
        evidenceId: row.evidenceId,
        signalId: row.behaviorSignalId,
      },
    })),
    observation: getMultipleObservation(m.blindSpotId) || '',
    source: { blindSpotId: m.blindSpotId, construct: m.construct },
  }))
  if (!isMultiple || models.length < 2) return null
  const mcopy = getMultipleStateCopy()
  return {
    uiState: 'MULTIPLE',
    eyebrow: mcopy.eyebrow,
    headline: mcopy.headline,
    summary: mcopy.summary,
    evidenceHeading: mcopy.evidenceHeading,
    supportedModels: models,
    synthesisTitle: mcopy.synthesisTitle,
    synthesis: mcopy.synthesis,
    nextObservationTitle: mcopy.nextObservationTitle,
    source: { reasonCode: ds.reasonCode || null },
  }
}

// ── Main entry ────────────────────────────────────────────────────────────
/**
 * Build the North Star report content model from a presentation model.
 *
 * @param {object} pm  northStarPresentationModelV21.buildNorthStarPresentationModelV21 output
 * @returns {{version:string, sections:Array<object>}}
 */
function buildNorthStarReportV21(pm) {
  if (!pm || typeof pm !== 'object') {
    return { version: REPORT_VERSION, sections: [] }
  }

  const sections = [
    buildVerdictSection(pm),
    buildCurrentModelSection(pm),
    buildWorldRuleSection(pm),
    buildEvidenceSection(pm),
    buildConsequenceSection(pm),
    buildUpgradeSection(pm),
    buildProtocolSection(pm),
    buildScenarioSection(pm),
    buildSecondaryContextSection(pm),
  ]

  const multiModel = buildMultiModelSection(pm)
  const impactSummary = buildImpactSummaryV21(pm)
  const report = {
    version: REPORT_VERSION,
    diagnosisState: pm.diagnosisState,
    sections,
  }
  // Layer-1 impact summary: present ONLY when the state carries semantics that
  // support the 5-section IA (UNIQUE / MULTIPLE). Other states keep the
  // truthful compact neutral layout and preserve the exact shape (byte-identical).
  if (impactSummary) {
    report.impactSummary = impactSummary
    // Layer-2 explainability pairs with Layer 1 (same states only).
    report.impactExplainer = buildImpactExplainerV21(pm, sections)
  }
  // Preserve the exact shape for non-MULTIPLE states (byte-identical outputs).
  if (multiModel) report.multiModel = multiModel
  return report
}

module.exports = {
  REPORT_VERSION,
  buildVerdictSection,
  buildCurrentModelSection,
  buildWorldRuleSection,
  buildEvidenceSection,
  buildConsequenceSection,
  buildUpgradeSection,
  buildProtocolSection,
  buildScenarioSection,
  buildSecondaryContextSection,
  buildMultiModelSection,
  buildNorthStarReportV21,
}
