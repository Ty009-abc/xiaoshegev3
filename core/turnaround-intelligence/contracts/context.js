/**
 * core/turnaround-intelligence/contracts/context.js
 *
 * CP6-A 统一数据契约 — TurnaroundContext
 *
 * TurnaroundContext 是所有 Engine 的唯一数据交换格式。
 *
 *   - 所有 Engine 接收 TurnaroundContext（或其子集），返回更新后的 TurnaroundContext
 *   - 禁止任何 Engine 直接读取原始用户答案
 *   - 禁止任何 Engine 直接修改其他 Engine 的数据
 *
 * @version 6.0.0
 * @checkpoint CP6-A
 */

const { validateEvidenceChain } = require('./evidence')

// ═══════════════════════════════════════
// Context 版本 & 流水号
// ═══════════════════════════════════════

const CONTEXT_VERSION = '6.0.0'

// ═══════════════════════════════════════
// createContext — 创建空的 TurnaroundContext
// ═══════════════════════════════════════

/**
 * @returns {Object} 空的 TurnaroundContext
 */
function createContext() {
  return {
    // --- 元数据 ---
    _meta: {
      version: CONTEXT_VERSION,
      createdAt: null,        // ISO string, set on first update
      updatedAt: null,        // ISO string, set each update
      pipelineStage: 'init',  // init → normalized → profiled → ... → done
      engineHistory: [],      // [{ engine, timestamp }]
    },

    // --- 原始数据 ---
    answers: null,            // { Q1: "...", Q2: "...", ... } — 规范化后的答案（非原始字符串）

    // --- 证据层 ---
    evidence: null,           // EvidenceSet { evidences, meta }

    // --- Engine 输出 ---
    profile: null,            // profileEngine 输出
    cognitive: null,          // cognitiveEngine 输出
    risks: null,              // riskEngine 输出
    leverages: null,          // leverageEngine 输出
    strategy: null,           // strategyEngine 输出
    actions: null,            // actionEngine 输出
    verdict: null,            // verdictEngine 输出 { verdict, potential }

    // --- 额外标记 ---
    flags: {},                // { flagName: true }
  }
}

// ═══════════════════════════════════════
// validateContext — 验证 Context 完整性
// ═══════════════════════════════════════

/**
 * validateContext — 验证 Context 在某个 pipeline 阶段是否完整
 *
 * @param {Object} ctx  — TurnaroundContext
 * @param {string} stage — 当前阶段: init | normalized | evidence_built
 *                         | profiled | cognitive | risk_assessed |
 *                         leveraged | strategy_ready | actions_ready | done
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateContext(ctx, stage) {
  const errors = []

  if (!ctx || typeof ctx !== 'object') {
    return Object.freeze({ valid: false, errors: ['Context is null or not an object'] })
  }

  if (!ctx._meta || ctx._meta.version !== CONTEXT_VERSION) {
    errors.push(`Context version mismatch: expected ${CONTEXT_VERSION}`)
  }

  switch (stage) {
    case 'init':
      break // no requirements

    case 'normalized':
      if (!ctx.answers || Object.keys(ctx.answers).length === 0) {
        errors.push('Stage normalized: answers required')
      }
      break

    case 'evidence_built':
      if (!ctx.answers || Object.keys(ctx.answers).length === 0) {
        errors.push('Stage evidence_built: answers required')
      }
      if (!ctx.evidence || !ctx.evidence.evidences || ctx.evidence.evidences.length < 2) {
        errors.push('Stage evidence_built: evidence chain required (min 2 evidences)')
      }
      break

    case 'profiled':
      if (!ctx.evidence || !ctx.evidence.evidences) {
        errors.push('Stage profiled: evidence chain required')
      }
      if (!ctx.profile) {
        errors.push('Stage profiled: profile required')
      }
      break

    case 'cognitive':
      if (!ctx.profile) errors.push('Stage cognitive: profile required')
      if (!ctx.cognitive) errors.push('Stage cognitive: cognitive scores required')
      break

    case 'risk_assessed':
      if (!ctx.profile) errors.push('Stage risk_assessed: profile required')
      if (!ctx.cognitive) errors.push('Stage risk_assessed: cognitive required')
      if (!ctx.risks) errors.push('Stage risk_assessed: risks required')
      break

    case 'leveraged':
      if (!ctx.risks) errors.push('Stage leveraged: risks required')
      if (!ctx.leverages) errors.push('Stage leveraged: leverages required')
      break

    case 'strategy_ready':
      if (!ctx.leverages) errors.push('Stage strategy_ready: leverages required')
      if (!ctx.strategy) errors.push('Stage strategy_ready: strategy required')
      break

    case 'actions_ready':
      if (!ctx.strategy) errors.push('Stage actions_ready: strategy required')
      if (!ctx.actions) errors.push('Stage actions_ready: actions required')
      break

    case 'done':
      if (!ctx.verdict) errors.push('Stage done: verdict required')
      if (!ctx.actions) errors.push('Stage done: actions required')
      break

    default:
      errors.push(`Unknown stage: ${stage}`)
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  })
}

// ═══════════════════════════════════════
// updateContext — 更新 Context（不可变风格）
// ═══════════════════════════════════════

/**
 * updateContext — 在 pipeline 某阶段更新 Context
 *
 * 注意：返回新对象，不修改原 ctx（不可变更新）
 *
 * @param {Object} ctx           — 当前 TurnaroundContext
 * @param {string} engineName    — 引擎名称
 * @param {Object} updates       — { field: value } 要更新的字段
 * @param {string} [newStage]    — pipeline 新阶段
 * @param {string} [timestamp]   — ISO timestamp
 * @returns {Object} 更新后的 TurnaroundContext（深冻结）
 */
function updateContext(ctx, engineName, updates, newStage, timestamp) {
  const now = timestamp || new Date().toISOString()

  const updated = {
    ...ctx,
    _meta: {
      ...ctx._meta,
      updatedAt: now,
      createdAt: ctx._meta.createdAt || now,
      pipelineStage: newStage || ctx._meta.pipelineStage,
      engineHistory: [
        ...(ctx._meta.engineHistory || []),
        Object.freeze({ engine: engineName, timestamp: now }),
      ],
    },
    ...updates,
  }

  return deepFreeze(updated)
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  Object.freeze(obj)
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val)
    }
  }
  return obj
}

module.exports = {
  createContext,
  validateContext,
  updateContext,
  CONTEXT_VERSION,
}
