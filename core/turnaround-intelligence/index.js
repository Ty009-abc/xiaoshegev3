/**
 * core/turnaround-intelligence/index.js
 *
 * Turnaround Intelligence Engine V6 — CP6-C.1 统一入口
 *
 * Pipeline (完整):
 *   answers → Evidence → Pattern → Risk → Profile → Cognitive → Leverage
 *   → Conflict → Opportunity → CoreContradiction → Verdict (CP6-E)
 *
 * 核心原则:
 *   "Every conclusion must converge to one contradiction."
 *   任何最终结论，都必须收敛到唯一核心矛盾。
 *
 * @version 6.1.0
 * @checkpoint CP6-C.1
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

// Builders
const { normalize, extractAnswerSummary, validateNormalized } = require('./builders/normalizer')
const { buildEvidence } = require('./builders/evidenceBuilder')

// Selectors
const profileSelectors = require('./selectors/profileInput')
const cognitiveSelectors = require('./selectors/cognitiveInput')
const patternSelectors = require('./selectors/patternInput')
const riskSelectors = require('./selectors/riskInput')
const leverageSelectors = require('./selectors/leverageInput')
const conflictSelectors = require('./selectors/conflictInput')
const opportunitySelectors = require('./selectors/opportunityInput')
const coreSelectors = require('./selectors/coreContradictionInput')

// Engines
const patternEngine = require('./engines/patternEngine')
const riskEngine = require('./engines/riskEngine')
const profileEngine = require('./engines/profileEngine')
const cognitiveEngine = require('./engines/cognitiveEngine')
const leverageEngine = require('./engines/leverageEngine')
const conflictEngine = require('./engines/conflictResolver')
const opportunityEngine = require('./engines/opportunityEngine')
const coreEngine = require('./engines/coreContradictionEngine')

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
    { patterns: patternEngine.run(patternSelectors.createPatternInput(ctx)) },
    'pattern_detected')
}

function runRiskStep(ctx) {
  if (!ctx.patterns) ctx = runPatternStep(ctx)
  return context.updateContext(ctx, 'RiskEngine',
    { risk: riskEngine.run(riskSelectors.createRiskInput(ctx)) },
    'risk_analyzed')
}

function runProfileStep(ctx) {
  if (!ctx.patterns) ctx = runPatternStep(ctx)
  return context.updateContext(ctx, 'ProfileEngine',
    { profile: profileEngine.run(profileSelectors.createProfileInput(ctx)) },
    'profiled')
}

function runCognitiveStep(ctx) {
  return context.updateContext(ctx, 'CognitiveEngine',
    { cognitive: cognitiveEngine.run(cognitiveSelectors.createCognitiveInput(ctx)) },
    'cognitive')
}

function runLeverageStep(ctx) {
  return context.updateContext(ctx, 'LeverageEngine',
    { leverage: leverageEngine.run(leverageSelectors.createLeverageInput(ctx)) },
    'leverage_analyzed')
}

function runConflictStep(ctx) {
  if (!ctx.risk) ctx = runRiskStep(ctx)
  if (!ctx.leverage) ctx = runLeverageStep(ctx)
  return context.updateContext(ctx, 'ConflictResolver',
    { conflicts: conflictEngine.run(conflictSelectors.createConflictInput(ctx)) },
    'conflicts_resolved')
}

function runOpportunityStep(ctx) {
  if (!ctx.conflicts) ctx = runConflictStep(ctx)
  return context.updateContext(ctx, 'OpportunityEngine',
    { opportunity: opportunityEngine.run(opportunitySelectors.createOpportunityInput(ctx)) },
    'opportunity_analyzed')
}

function runCoreContradictionStep(ctx) {
  if (!ctx.opportunity) ctx = runOpportunityStep(ctx)
  return context.updateContext(ctx, 'CoreContradictionEngine',
    { coreContradiction: coreEngine.run(coreSelectors.createCoreContradictionInput(ctx)) },
    'core_contradiction_selected')
}

// ═══════════════════════════════════════
// Exports
// ═══════════════════════════════════════

module.exports = {
  tags, evidence, context, verdict, profile, cognitive,
  pattern, risk, leverage, conflict, opportunity, coreContradiction,

  normalizer: { normalize, extractAnswerSummary, validateNormalized },
  evidenceBuilder: { buildEvidence },

  selectors: {
    ...profileSelectors, ...cognitiveSelectors, ...patternSelectors,
    ...riskSelectors, ...leverageSelectors, ...conflictSelectors,
    ...opportunitySelectors, ...coreSelectors,
  },

  engines: {
    pattern: patternEngine.run, risk: riskEngine.run,
    profile: profileEngine.run, cognitive: cognitiveEngine.run,
    leverage: leverageEngine.run, conflict: conflictEngine.run,
    opportunity: opportunityEngine.run, coreContradiction: coreEngine.run,
  },

  initializePipeline,
  runPatternStep, runRiskStep, runProfileStep, runCognitiveStep,
  runLeverageStep, runConflictStep, runOpportunityStep, runCoreContradictionStep,
}
