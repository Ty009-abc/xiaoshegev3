/**
 * core/turnaround-intelligence/index.js
 *
 * Turnaround Intelligence Engine V6 — CP6-D 统一入口
 *
 * Pipeline (完整):
 *   answers → Evidence → Pattern → Risk → Profile → Cognitive
 *   → Leverage → Conflict → Opportunity → CoreContradiction
 *   → Decision → Roadmap → Feasibility → Bottleneck → Milestone
 *   → Verdict (CP6-E)
 *
 * 核心原则:
 *   "Every conclusion must converge to one contradiction."
 *
 * @version 6.2.0
 * @checkpoint CP6-D
 */

// Contracts
const tags = require('./contracts/tags')
const evidence = require('./contracts/evidence')
const context = require('./contracts/context')
const verdict = require('./contracts/verdict')
const profile = require('./contracts/profile')
const cognitive = require('./contracts/cognitive')
const pattern = require('./contracts/pattern')
const risk = require('./contracts/risk')
const leverage = require('./contracts/leverage')
const conflict = require('./contracts/conflict')
const opportunity = require('./contracts/opportunity')
const coreContradiction = require('./contracts/coreContradiction')
const decision = require('./contracts/decision')
const roadmap = require('./contracts/roadmap')
const feasibility = require('./contracts/feasibility')
const bottleneck = require('./contracts/bottleneck')
const milestone = require('./contracts/milestone')

// Builders
const { normalize, extractAnswerSummary, validateNormalized } = require('./builders/normalizer')
const { buildEvidence } = require('./builders/evidenceBuilder')

// Selectors
const profileSel = require('./selectors/profileInput')
const cognitiveSel = require('./selectors/cognitiveInput')
const patternSel = require('./selectors/patternInput')
const riskSel = require('./selectors/riskInput')
const leverageSel = require('./selectors/leverageInput')
const conflictSel = require('./selectors/conflictInput')
const opportunitySel = require('./selectors/opportunityInput')
const coreSel = require('./selectors/coreContradictionInput')
const decisionSel = require('./selectors/decisionInput')
const roadmapSel = require('./selectors/roadmapInput')
const feasibilitySel = require('./selectors/feasibilityInput')
const bottleneckSel = require('./selectors/bottleneckInput')
const milestoneSel = require('./selectors/milestoneInput')

// Engines
const patternEng = require('./engines/patternEngine')
const riskEng = require('./engines/riskEngine')
const profileEng = require('./engines/profileEngine')
const cognitiveEng = require('./engines/cognitiveEngine')
const leverageEng = require('./engines/leverageEngine')
const conflictEng = require('./engines/conflictResolver')
const opportunityEng = require('./engines/opportunityEngine')
const coreEng = require('./engines/coreContradictionEngine')
const decisionEng = require('./engines/decisionEngine')
const roadmapEng = require('./engines/roadmapEngine')
const feasibilityEng = require('./engines/feasibilityEngine')
const bottleneckEng = require('./engines/bottleneckEngine')
const milestoneEng = require('./engines/milestoneEngine')

// ═══════════════════════════════════════
// Pipeline Steps
// ═══════════════════════════════════════

function initializePipeline(rawAnswers) {
  const normalized = normalize(rawAnswers)
  const evidenceSet = buildEvidence(normalized)
  let ctx = context.createContext()
  ctx = context.updateContext(ctx, 'Normalizer', { answers: normalized.answers }, 'normalized')
  ctx = context.updateContext(ctx, 'EvidenceBuilder', { evidence: evidenceSet }, 'evidence_built')
  return ctx
}

function runPatternStep(ctx) {
  return context.updateContext(ctx, 'PatternEngine',
    { patterns: patternEng.run(patternSel.createPatternInput(ctx)) }, 'pattern_detected')
}
function runRiskStep(ctx) {
  if (!ctx.patterns) ctx = runPatternStep(ctx)
  return context.updateContext(ctx, 'RiskEngine',
    { risk: riskEng.run(riskSel.createRiskInput(ctx)) }, 'risk_analyzed')
}
function runProfileStep(ctx) {
  if (!ctx.patterns) ctx = runPatternStep(ctx)
  return context.updateContext(ctx, 'ProfileEngine',
    { profile: profileEng.run(profileSel.createProfileInput(ctx)) }, 'profiled')
}
function runCognitiveStep(ctx) {
  return context.updateContext(ctx, 'CognitiveEngine',
    { cognitive: cognitiveEng.run(cognitiveSel.createCognitiveInput(ctx)) }, 'cognitive')
}
function runLeverageStep(ctx) {
  if (!ctx.profile) ctx = runProfileStep(ctx)
  return context.updateContext(ctx, 'LeverageEngine',
    { leverage: leverageEng.run(leverageSel.createLeverageInput(ctx)) }, 'leverage_analyzed')
}
function runConflictStep(ctx) {
  if (!ctx.risk) ctx = runRiskStep(ctx)
  if (!ctx.leverage) ctx = runLeverageStep(ctx)
  return context.updateContext(ctx, 'ConflictResolver',
    { conflicts: conflictEng.run(conflictSel.createConflictInput(ctx)) }, 'conflicts_resolved')
}
function runOpportunityStep(ctx) {
  if (!ctx.conflicts) ctx = runConflictStep(ctx)
  return context.updateContext(ctx, 'OpportunityEngine',
    { opportunity: opportunityEng.run(opportunitySel.createOpportunityInput(ctx)) }, 'opportunity_analyzed')
}
function runCoreContradictionStep(ctx) {
  if (!ctx.opportunity) ctx = runOpportunityStep(ctx)
  return context.updateContext(ctx, 'CoreContradictionEngine',
    { coreContradiction: coreEng.run(coreSel.createCoreContradictionInput(ctx)) }, 'core_contradiction_selected')
}

// CP6-D: Decision Operating System
function runDecisionStep(ctx) {
  if (!ctx.coreContradiction) ctx = runCoreContradictionStep(ctx)
  return context.updateContext(ctx, 'DecisionEngine',
    { decision: decisionEng.run(decisionSel.createDecisionInput(ctx)) }, 'decision_made')
}
function runRoadmapStep(ctx) {
  if (!ctx.decision) ctx = runDecisionStep(ctx)
  return context.updateContext(ctx, 'RoadmapEngine',
    { roadmap: roadmapEng.run(roadmapSel.createRoadmapInput(ctx)) }, 'roadmap_generated')
}
function runFeasibilityStep(ctx) {
  return context.updateContext(ctx, 'FeasibilityEngine',
    { feasibility: feasibilityEng.run(feasibilitySel.createFeasibilityInput(ctx)) }, 'feasibility_analyzed')
}
function runBottleneckStep(ctx) {
  return context.updateContext(ctx, 'BottleneckEngine',
    { bottleneck: bottleneckEng.run(bottleneckSel.createBottleneckInput(ctx)) }, 'bottleneck_detected')
}
function runMilestoneStep(ctx) {
  if (!ctx.roadmap) ctx = runRoadmapStep(ctx)
  return context.updateContext(ctx, 'MilestoneEngine',
    { milestone: milestoneEng.run(milestoneSel.createMilestoneInput(ctx)) }, 'milestone_planned')
}

// ═══════════════════════════════════════
// Exports
// ═══════════════════════════════════════

module.exports = {
  // Contracts
  tags, evidence, context, verdict, profile, cognitive,
  pattern, risk, leverage, conflict, opportunity, coreContradiction,
  decision, roadmap, feasibility, bottleneck, milestone,

  // Builders
  normalizer: { normalize, extractAnswerSummary, validateNormalized },
  evidenceBuilder: { buildEvidence },

  // Selectors
  selectors: {
    ...profileSel, ...cognitiveSel, ...patternSel, ...riskSel, ...leverageSel, ...conflictSel,
    ...opportunitySel, ...coreSel, ...decisionSel, ...roadmapSel, ...feasibilitySel,
    ...bottleneckSel, ...milestoneSel,
  },

  // Engines
  engines: {
    pattern: patternEng.run, risk: riskEng.run, profile: profileEng.run, cognitive: cognitiveEng.run,
    leverage: leverageEng.run, conflict: conflictEng.run, opportunity: opportunityEng.run,
    coreContradiction: coreEng.run, decision: decisionEng.run, roadmap: roadmapEng.run,
    feasibility: feasibilityEng.run, bottleneck: bottleneckEng.run, milestone: milestoneEng.run,
  },

  // Step functions
  initializePipeline,
  runPatternStep, runRiskStep, runProfileStep, runCognitiveStep,
  runLeverageStep, runConflictStep, runOpportunityStep, runCoreContradictionStep,
  runDecisionStep, runRoadmapStep, runFeasibilityStep, runBottleneckStep, runMilestoneStep,
}
