/**
 * contracts/report/turnaroundPoster.contract.js
 *
 * 翻身报告海报契约 — 校验海报数据是否符合规范。
 */

function createValidationResult() {
  return { ok: true, errors: [], warnings: [], metadata: {} }
}

const POSTER_REQUIRED = ['verdict', 'contradiction', 'potential', 'decision', 'primaryAction']
const CONTRADICTION_KEYS = ['code', 'title', 'description']
const DECISION_KEYS = ['code', 'title', 'reason']
const POTENTIAL_KEYS = ['score', 'level', 'advantages', 'constraints']
const ACTION_KEYS = ['title', 'checkpoint', 'successCriteria']

function validateTurnaroundPoster(poster) {
  const r = createValidationResult()

  if (!poster || typeof poster !== 'object') {
    r.ok = false
    r.errors.push('POSTER: poster is null or not an object')
    return r
  }

  // 必填区段
  for (const s of POSTER_REQUIRED) {
    if (!poster[s]) {
      r.errors.push(`POSTER: missing "${s}" section`)
    }
  }

  // Verdict
  if (poster.verdict) {
    if (typeof poster.verdict !== 'string' || poster.verdict.trim() === '') {
      r.errors.push('POSTER: verdict must be a non-empty string')
    }
    if (/^(undefined|null|NaN)$/i.test(poster.verdict)) {
      r.errors.push('POSTER: verdict contains undefined/null/NaN literal')
    }
  }

  // Contradiction
  if (poster.contradiction) {
    const cc = poster.contradiction
    for (const k of CONTRADICTION_KEYS) {
      if (!(k in cc)) {
        r.errors.push(`POSTER: contradiction missing key "${k}"`)
      }
    }
    if (cc.code === 'FALLBACK') {
      r.warnings.push('POSTER: contradiction.code is FALLBACK')
    }
  }

  // Decision
  if (poster.decision) {
    const dc = poster.decision
    const hasEmpty = (!dc.code || dc.code === '') && (!dc.title || dc.title === '' || dc.title === '[empty]')
    if (hasEmpty && !dc.provisional) {
      r.warnings.push('POSTER: decision is empty and not provisional')
    }
  }

  // Potential
  if (poster.potential) {
    const pt = poster.potential
    if (typeof pt.score !== 'number' || pt.score < 0 || pt.score > 100) {
      r.errors.push('POSTER: potential.score must be between 0-100')
    }
    if (!Array.isArray(pt.advantages)) {
      r.errors.push('POSTER: potential.advantages must be an array')
    }
    if (!Array.isArray(pt.constraints)) {
      r.errors.push('POSTER: potential.constraints must be an array')
    }
  }

  // PrimaryAction
  if (poster.primaryAction) {
    const pa = poster.primaryAction
    if (pa.title) {
      if (typeof pa.title !== 'string' || pa.title.trim() === '') {
        r.errors.push('POSTER: primaryAction.title is empty')
      }
      if (/^(undefined|null)$/i.test(pa.title)) {
        r.errors.push('POSTER: primaryAction.title is literal undefined/null')
      }
    }
  }

  // 禁止 null/undefined 字面值
  const json = JSON.stringify(poster)
  if (/\bnull\b/.test(json)) {
    r.warnings.push('POSTER: contains JSON null values (may cause UI issues)')
  }

  r.ok = r.errors.length === 0
  r.metadata.errorCount = r.errors.length
  r.metadata.warningCount = r.warnings.length
  return r
}

module.exports = { validateTurnaroundPoster }
