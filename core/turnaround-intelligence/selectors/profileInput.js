/**
 * core/turnaround-intelligence/selectors/profileInput.js
 *
 * CP6-B Profile Engine 输入选择器
 *
 * 禁止 Profile Engine 接收完整 TurnaroundContext 或访问 answers。
 * Engine 只接收此选择器裁剪后的输入。
 *
 * @version 6.0.0
 * @checkpoint CP6-B
 */

/**
 * createProfileInput — 从 TurnaroundContext 提取 Profile Engine 所需数据
 *
 * 规则:
 *   - 只能传递 evidence 和 metadata
 *   - 不能传递 answers
 *   - 不能传递其他 Engine 的输出（profile/cognitive/risks/leverages/...）
 *   - 返回深冻结对象
 *
 * @param {Object} ctx — TurnaroundContext (stage ≥ evidence_built)
 * @returns {Object} ProfileInput（冻结）
 */
function createProfileInput(ctx) {
  if (!ctx) {
    throw new Error('createProfileInput: context required')
  }

  if (!ctx.evidence || !ctx.evidence.evidences || ctx.evidence.evidences.length === 0) {
    throw new Error('createProfileInput: context must have evidence chain (stage ≥ evidence_built)')
  }

  return deepFreeze({
    evidence: ctx.evidence,
    _meta: {
      engineVersion: ctx._meta ? ctx._meta.version : '6.0.0',
      pipelineStage: ctx._meta ? ctx._meta.pipelineStage : 'unknown',
    },
  })
}

// ═══════════════════════════════════════
// validateProfileInput — 验证输入完整性
// ═══════════════════════════════════════

function validateProfileInput(input) {
  const errors = []

  if (!input || !input.evidence) {
    errors.push('ProfileInput: evidence required')
  } else if (!input.evidence.evidences || input.evidence.evidences.length === 0) {
    errors.push('ProfileInput: evidence chain must not be empty')
  }

  // 安全检查：确认没有泄露完整 context
  if (input.answers !== undefined) {
    errors.push('ProfileInput: answers leaked — must not include raw answers')
  }
  if (input.profile !== undefined) {
    errors.push('ProfileInput: profile leaked — Engine should not see its own output')
  }
  if (input.cognitive !== undefined) {
    errors.push('ProfileInput: cognitive leaked — Profile Engine runs before Cognitive')
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
  createProfileInput,
  validateProfileInput,
}
