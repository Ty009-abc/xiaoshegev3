/**
 * contracts/world-rule/worldRulePoster.contract.js
 *
 * 世界规则海报契约 — 校验世界规则海报数据。
 */

function createValidationResult() {
  return { ok: true, errors: [], warnings: [], metadata: {} }
}

const POSTER_REQUIRED = ['id', 'title', 'category', 'worldRule', 'underlyingLogic', 'reverseLogic', 'realCase', 'actionAdvice']

function validateWorldRulePoster(poster) {
  const r = createValidationResult()

  if (!poster || typeof poster !== 'object') {
    r.ok = false
    r.errors.push('WRL_POSTER: poster is null or not an object')
    return r
  }

  for (const f of POSTER_REQUIRED) {
    if (!poster[f]) {
      r.errors.push(`WRL_POSTER: missing "${f}"`)
    }
  }

  // 防止裸数据
  if (poster._raw || poster.__raw) {
    r.errors.push('WRL_POSTER: contains raw/internal data (_raw or __raw) — must not pass raw objects to renderer')
  }

  // 防止 worldRule = underlyingLogic
  if (poster.worldRule && poster.underlyingLogic && poster.worldRule === poster.underlyingLogic) {
    r.errors.push('WRL_POSTER: worldRule must not equal underlyingLogic')
  }

  r.ok = r.errors.length === 0
  r.metadata.errorCount = r.errors.length
  r.metadata.warningCount = r.warnings.length
  return r
}

module.exports = { validateWorldRulePoster }
