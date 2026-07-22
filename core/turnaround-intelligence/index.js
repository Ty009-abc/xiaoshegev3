/**
 * core/turnaround-intelligence/index.js
 *
 * Turnaround Intelligence Engine V6 — CP6 统一入口
 *
 * @version 6.0.0
 * @checkpoint CP6-B — Profile Engine & Cognitive Engine
 */

// Contracts
const tags = require('./contracts/tags')
const evidence = require('./contracts/evidence')
const context = require('./contracts/context')
const verdict = require('./contracts/verdict')

// Builders
const { normalize, extractAnswerSummary, validateNormalized } = require('./builders/normalizer')
const { buildEvidence } = require('./builders/evidenceBuilder')

// Contracts (CP6-B)
const profile = require('./contracts/profile')
const cognitive = require('./contracts/cognitive')

// Selectors (CP6-B)
const { createProfileInput, validateProfileInput } = require('./selectors/profileInput')
const { createCognitiveInput, validateCognitiveInput } = require('./selectors/cognitiveInput')

// Engines (CP6-B)
const { run: runProfileEngine } = require('./engines/profileEngine')
const { run: runCognitiveEngine } = require('./engines/cognitiveEngine')

// ═══════════════════════════════════════
// Pipeline: answers → Context
// ═══════════════════════════════════════

/**
 * initializePipeline — CP6-A 入口：raw answers → initial TurnaroundContext
 *
 * 这是 pipeline 的前两步（Normalizer + EvidenceBuilder），
 * 返回一个包含标准化 answers 和 evidence 的 Context，
 * 供后续 Engine 使用。
 *
 * @param {Object} rawAnswers — { Q1: "...", Q2: "...", ... }
 * @returns {Object} TurnaroundContext (stage: evidence_built)
 */
function initializePipeline(rawAnswers) {
  // Step 1: Normalize
  const normalized = normalize(rawAnswers)

  // Step 2: Build Evidence
  const evidenceSet = buildEvidence(normalized)

  // Step 3: Create Context
  let ctx = context.createContext()
  ctx = context.updateContext(ctx, 'Normalizer', { answers: normalized.answers }, 'normalized')
  ctx = context.updateContext(ctx, 'EvidenceBuilder', { evidence: evidenceSet }, 'evidence_built')

  return ctx
}

/**
 * runProfileStep — 运行 Profile Engine
 *
 * @param {Object} ctx — TurnaroundContext (stage ≥ evidence_built)
 * @returns {Object} 更新后的 Context (stage: profiled)
 */
function runProfileStep(ctx) {
  const input = createProfileInput(ctx)
  const profileOutput = runProfileEngine(input)
  return context.updateContext(ctx, 'ProfileEngine', { profile: profileOutput }, 'profiled')
}

/**
 * runCognitiveStep — 运行 Cognitive Engine
 *
 * @param {Object} ctx — TurnaroundContext (stage ≥ profiled)
 * @returns {Object} 更新后的 Context (stage: cognitive)
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

  // Builders
  normalizer: { normalize, extractAnswerSummary, validateNormalized },
  evidenceBuilder: { buildEvidence },

  // Contracts (CP6-B)
  profile,
  cognitive,

  // Selectors (CP6-B)
  selectors: {
    createProfileInput,
    validateProfileInput,
    createCognitiveInput,
    validateCognitiveInput,
  },

  // Engines (CP6-B)
  engines: {
    profile: runProfileEngine,
    cognitive: runCognitiveEngine,
  },

  // Pipeline
  initializePipeline,
  runProfileStep,
  runCognitiveStep,
}
