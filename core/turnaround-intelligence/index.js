/**
 * core/turnaround-intelligence/index.js
 *
 * Turnaround Intelligence Engine V6 — CP6 统一入口
 *
 * Pipeline: answers → Evidence → Pattern → Engine → Verdict
 *
 * @version 6.1.0
 * @checkpoint CP6-B.1 — Pattern Graph + Evidence enhancements
 */

// Contracts
const tags = require('./contracts/tags')
const evidence = require('./contracts/evidence')
const context = require('./contracts/context')
const verdict = require('./contracts/verdict')
const profile = require('./contracts/profile')
const cognitive = require('./contracts/cognitive')

// Builders
const { normalize, extractAnswerSummary, validateNormalized } = require('./builders/normalizer')
const { buildEvidence } = require('./builders/evidenceBuilder')

// Patterns (CP6-B.1)
const patterns = require('./patterns')

// Selectors
const { createProfileInput, validateProfileInput } = require('./selectors/profileInput')
const { createCognitiveInput, validateCognitiveInput } = require('./selectors/cognitiveInput')

// Engines
const { run: runProfileEngine } = require('./engines/profileEngine')
const { run: runCognitiveEngine } = require('./engines/cognitiveEngine')

// ═══════════════════════════════════════
// Pipeline: answers → Context
// ═══════════════════════════════════════

/**
 * initializePipeline — raw answers → initial TurnaroundContext
 */
function initializePipeline(rawAnswers) {
  const normalized = normalize(rawAnswers)
  const evidenceSet = buildEvidence(normalized)

  let ctx = context.createContext()
  ctx = context.updateContext(ctx, 'Normalizer', { answers: normalized.answers }, 'normalized')
  ctx = context.updateContext(ctx, 'EvidenceBuilder', { evidence: evidenceSet }, 'evidence_built')

  return ctx
}

/**
 * runPatternStep — CP6-B.1: Pattern 层
 */
function runPatternStep(ctx) {
  const allPatterns = patterns.detectAllPatterns(ctx.evidence.evidences)
  return context.updateContext(ctx, 'PatternDetector', { patterns: allPatterns }, 'pattern_detected')
}

/**
 * runProfileStep — Profile Engine
 */
function runProfileStep(ctx) {
  // 如果还没跑 Pattern，先跑
  if (ctx._meta.pipelineStage !== 'pattern_detected') {
    ctx = runPatternStep(ctx)
  }
  const input = createProfileInput(ctx)
  const profileOutput = runProfileEngine(input)
  return context.updateContext(ctx, 'ProfileEngine', { profile: profileOutput }, 'profiled')
}

/**
 * runCognitiveStep — Cognitive Engine
 */
function runCognitiveStep(ctx) {
  const input = createCognitiveInput(ctx)
  const cognitiveOutput = runCognitiveEngine(input)
  return context.updateContext(ctx, 'CognitiveEngine', { cognitive: cognitiveOutput }, 'cognitive')
}

module.exports = {
  // Contracts
  tags,
  evidence,
  context,
  verdict,
  profile,
  cognitive,

  // Builders
  normalizer: { normalize, extractAnswerSummary, validateNormalized },
  evidenceBuilder: { buildEvidence },

  // Patterns (CP6-B.1)
  patterns,

  // Selectors
  selectors: {
    createProfileInput,
    validateProfileInput,
    createCognitiveInput,
    validateCognitiveInput,
  },

  // Engines
  engines: {
    profile: runProfileEngine,
    cognitive: runCognitiveEngine,
  },

  // Pipeline
  initializePipeline,
  runPatternStep,
  runProfileStep,
  runCognitiveStep,
}
