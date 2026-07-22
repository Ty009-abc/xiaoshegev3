/**
 * core/turnaround-intelligence/index.js
 *
 * Turnaround Intelligence Engine V6 — CP6-C 统一入口
 *
 * Pipeline:
 *   answers → Evidence → Pattern → Risk → Profile → Cognitive → Leverage → Conflict
 *
 * @version 6.1.0
 * @checkpoint CP6-C
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

// Builders
const { normalize, extractAnswerSummary, validateNormalized } = require('./builders/normalizer')
const { buildEvidence } = require('./builders/evidenceBuilder')

// Selectors
const { createProfileInput, validateProfileInput } = require('./selectors/profileInput')
const { createCognitiveInput, validateCognitiveInput } = require('./selectors/cognitiveInput')
const { createPatternInput, validatePatternInput } = require('./selectors/patternInput')
const { createRiskInput, validateRiskInput } = require('./selectors/riskInput')
const { createLeverageInput, validateLeverageInput } = require('./selectors/leverageInput')
const { createConflictInput, validateConflictInput } = require('./selectors/conflictInput')

// Engines
const { run: runPatternEngine } = require('./engines/patternEngine')
const { run: runRiskEngine } = require('./engines/riskEngine')
const { run: runProfileEngine } = require('./engines/profileEngine')
const { run: runCognitiveEngine } = require('./engines/cognitiveEngine')
const { run: runLeverageEngine } = require('./engines/leverageEngine')
const { run: runConflictResolver } = require('./engines/conflictResolver')

// ═══════════════════════════════════════
// Pipeline
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
  const input = createPatternInput(ctx)
  const patternOutput = runPatternEngine(input)
  return context.updateContext(ctx, 'PatternEngine', { patterns: patternOutput }, 'pattern_detected')
}

function runRiskStep(ctx) {
  if (ctx._meta.pipelineStage !== 'pattern_detected') ctx = runPatternStep(ctx)
  const input = createRiskInput(ctx)
  const riskOutput = runRiskEngine(input)
  return context.updateContext(ctx, 'RiskEngine', { risk: riskOutput }, 'risk_analyzed')
}

function runProfileStep(ctx) {
  if (!ctx.patterns) ctx = runPatternStep(ctx)
  const input = createProfileInput(ctx)
  const profileOutput = runProfileEngine(input)
  return context.updateContext(ctx, 'ProfileEngine', { profile: profileOutput }, 'profiled')
}

function runCognitiveStep(ctx) {
  const input = createCognitiveInput(ctx)
  const cognitiveOutput = runCognitiveEngine(input)
  return context.updateContext(ctx, 'CognitiveEngine', { cognitive: cognitiveOutput }, 'cognitive')
}

function runLeverageStep(ctx) {
  const input = createLeverageInput(ctx)
  const leverageOutput = runLeverageEngine(input)
  return context.updateContext(ctx, 'LeverageEngine', { leverage: leverageOutput }, 'leverage_analyzed')
}

function runConflictStep(ctx) {
  if (!ctx.risk) ctx = runRiskStep(ctx)
  if (!ctx.leverage) ctx = runLeverageStep(ctx)
  const input = createConflictInput(ctx)
  const conflictOutput = runConflictResolver(input)
  return context.updateContext(ctx, 'ConflictResolver', { conflicts: conflictOutput }, 'conflicts_resolved')
}

module.exports = {
  tags, evidence, context, verdict, profile, cognitive, pattern, risk, leverage, conflict,

  normalizer: { normalize, extractAnswerSummary, validateNormalized },
  evidenceBuilder: { buildEvidence },

  selectors: {
    createProfileInput, validateProfileInput,
    createCognitiveInput, validateCognitiveInput,
    createPatternInput, validatePatternInput,
    createRiskInput, validateRiskInput,
    createLeverageInput, validateLeverageInput,
    createConflictInput, validateConflictInput,
  },

  engines: {
    pattern: runPatternEngine,
    risk: runRiskEngine,
    profile: runProfileEngine,
    cognitive: runCognitiveEngine,
    leverage: runLeverageEngine,
    conflict: runConflictResolver,
  },

  initializePipeline,
  runPatternStep,
  runRiskStep,
  runProfileStep,
  runCognitiveStep,
  runLeverageStep,
  runConflictStep,
}
