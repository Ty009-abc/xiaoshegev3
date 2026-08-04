/**
 * contracts/poster/posterExport.contract.js
 *
 * 海报导出契约 — 校验导出海报的完整性和合法性。
 */

function createValidationResult() {
  return { ok: true, errors: [], warnings: [], metadata: {} }
}

const MIN_CANVAS_WIDTH = 100
const MIN_CANVAS_HEIGHT = 100

function validatePosterExport(posterData, options = {}) {
  const r = createValidationResult()

  if (!posterData || typeof posterData !== 'object') {
    r.ok = false
    r.errors.push('EXPORT: posterData is null or not an object')
    return r
  }

  // Canvas 尺寸检查
  const w = posterData.width || options.width || 0
  const h = posterData.height || options.height || 0
  r.metadata.width = w
  r.metadata.height = h

  if (w < MIN_CANVAS_WIDTH || h < MIN_CANVAS_HEIGHT) {
    r.errors.push(`EXPORT: canvas size ${w}x${h} < minimum ${MIN_CANVAS_WIDTH}x${MIN_CANVAS_HEIGHT}`)
  }
  if (w === 1 && h === 1) {
    r.errors.push('EXPORT: canvas is 1x1 — cannot render meaningful content')
  }

  // 必须有实际内容
  const type = posterData.type || options.type || 'unknown'
  r.metadata.type = type

  const hasContent = (
    posterData.verdict ||
    posterData.worldRule ||
    (Array.isArray(posterData.lines) && posterData.lines.length > 0) ||
    (posterData.title && posterData.title !== '')
  )
  if (!hasContent) {
    r.warnings.push('EXPORT: poster appears to have no meaningful content (background only?)')
  }

  // 必须包含校验信息
  if (posterData.version && posterData.version !== 'v4' && posterData.version !== 'v5') {
    r.warnings.push(`EXPORT: unrecognized poster version "${posterData.version}"`)
  }

  r.ok = r.errors.length === 0
  r.metadata.errorCount = r.errors.length
  r.metadata.warningCount = r.warnings.length
  return r
}

module.exports = {
  validatePosterExport,
  MIN_CANVAS_WIDTH,
  MIN_CANVAS_HEIGHT,
}
