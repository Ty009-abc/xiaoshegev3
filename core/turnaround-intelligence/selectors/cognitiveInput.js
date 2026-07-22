/**
 * core/turnaround-intelligence/selectors/cognitiveInput.js
 *
 * CP6-B Cognitive Engine 输入选择器
 *
 * 禁止 Cognitive Engine 接收完整 TurnaroundContext 或访问 answers。
 * Engine 只接收此选择器裁剪后的输入。
 *
 * @version 6.0.0
 * @checkpoint CP6-B
 */

/**
 * createCognitiveInput — 从 TurnaroundContext 提取 Cognitive Engine 所需数据
 *
 * 规则:
 *   - 只能传递 evidence 和 profile
 *   - 不能传递 answers
 *   - 不能传递其他 Engine 的输出（cognitive/risks/leverages/...）
 *   - 返回深冻结对象
 *
 * @param {Object} ctx — TurnaroundContext (stage ≥ profiled)
 * @returns {Object} CognitiveInput（冻结）
 */
function createCognitiveInput(ctx) {
  if (!ctx) {
    throw new Error('createCognitiveInput: context required')
  }

  if (!ctx.evidence || !ctx.evidence.evidences || ctx.evidence.evidences.length === 0) {
    throw new Error('createCognitiveInput: context must have evidence chain')
  }

  if (!ctx.profile) {
    throw new Error('createCognitiveInput: context must have profile (stage ≥ profiled)')
  }

  return deepFreeze({
    evidence: ctx.evidence,
    profile: ctx.profile,
    _meta: {
      engineVersion: ctx._meta ? ctx._meta.version : '6.0.0',
      pipelineStage: ctx._meta ? ctx._meta.pipelineStage : 'unknown',
    },
  })
}

// ═══════════════════════════════════════
// validateCognitiveInput — 验证输入完整性
// ═══════════════════════════════════════

function validateCognitiveInput(input) {
  const errors = []

  if (!input || !input.evidence) {
    errors.push('CognitiveInput: evidence required')
  } else if (!input.evidence.evidences || input.evidence.evidences.length === 0) {
    errors.push('CognitiveInput: evidence chain must not be empty')
  }

  if (!input.profile) {
    errors.push('CognitiveInput: profile required')
  }

  // 安全检查
  if (input.answers !== undefined) {
    errors.push('CognitiveInput: answers leaked')
  }
  if (input.cognitive !== undefined) {
    errors.push('CognitiveInput: cognitive leaked — Engine should not see its own output')
  }
  if (input.risks !== undefined) {
    errors.push('CognitiveInput: risks leaked — Cognitive Engine runs before Risk')
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  })
}

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
  createCognitiveInput,
  validateCognitiveInput,
}
