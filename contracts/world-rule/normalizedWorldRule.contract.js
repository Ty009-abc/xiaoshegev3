/**
 * contracts/world-rule/normalizedWorldRule.contract.js
 *
 * 世界规则契约 — 校验规范化世界规则数据结构。
 */

function createValidationResult() {
  return { ok: true, errors: [], warnings: [], metadata: {} }
}

const REQUIRED_FIELDS = [
  'id',
  'title',
  'category',
  'worldRule',
  'underlyingLogic',
  'reverseLogic',
  'realCase',
  'actionAdvice',
  'contentStatus',
]

const VALID_CATEGORIES = ['income', 'cashflow', 'skill', 'time', 'execution', 'risk', 'cognition', 'decision', 'information', 'mechanism']

const VALID_CONTENT_STATUS = ['FINAL', 'DRAFT', 'EXPERIMENTAL']

function validateNormalizedWorldRule(rule) {
  const r = createValidationResult()

  if (!rule || typeof rule !== 'object') {
    r.ok = false
    r.errors.push('WORLD_RULE: rule is null or not an object')
    return r
  }

  for (const f of REQUIRED_FIELDS) {
    if (!(f in rule)) {
      r.errors.push(`WORLD_RULE: missing required field "${f}"`)
    }
  }

  if (rule.id !== undefined && typeof rule.id !== 'string') {
    r.errors.push('WORLD_RULE: id must be a string')
  }
  if (rule.title !== undefined && (typeof rule.title !== 'string' || rule.title.trim() === '')) {
    r.errors.push('WORLD_RULE: title must be a non-empty string')
  }
  if (rule.category !== undefined && !VALID_CATEGORIES.includes(rule.category)) {
    r.warnings.push(`WORLD_RULE: unknown category "${rule.category}"`)
  }
  if (rule.worldRule !== undefined && (typeof rule.worldRule !== 'string' || rule.worldRule.trim() === '')) {
    r.errors.push('WORLD_RULE: worldRule must be a non-empty string')
  }

  // 防止 worldRule 被复制为 underlyingLogic
  if (rule.worldRule && rule.underlyingLogic && rule.worldRule === rule.underlyingLogic) {
    r.errors.push('WORLD_RULE: worldRule must not equal underlyingLogic — they serve different purposes')
  }

  if (rule.underlyingLogic !== undefined && (typeof rule.underlyingLogic !== 'string' || rule.underlyingLogic.trim() === '')) {
    r.warnings.push('WORLD_RULE: underlyingLogic is empty')
  }

  if (rule.reverseLogic !== undefined && (typeof rule.reverseLogic !== 'string' || rule.reverseLogic.trim() === '')) {
    r.warnings.push('WORLD_RULE: reverseLogic is empty')
  }

  if (rule.realCase !== undefined && (typeof rule.realCase !== 'string' || rule.realCase.trim() === '')) {
    r.warnings.push('WORLD_RULE: realCase is empty')
  }

  if (rule.actionAdvice !== undefined && (typeof rule.actionAdvice !== 'string' || rule.actionAdvice.trim() === '')) {
    r.warnings.push('WORLD_RULE: actionAdvice is empty')
  }

  if (rule.contentStatus !== undefined && !VALID_CONTENT_STATUS.includes(rule.contentStatus)) {
    r.warnings.push(`WORLD_RULE: unknown contentStatus "${rule.contentStatus}"`)
  }

  r.ok = r.errors.length === 0
  r.metadata.errorCount = r.errors.length
  r.metadata.warningCount = r.warnings.length
  r.metadata.ruleId = rule.id || 'unknown'
  return r
}

module.exports = {
  validateNormalizedWorldRule,
  REQUIRED_FIELDS,
  VALID_CATEGORIES,
  VALID_CONTENT_STATUS,
}
