/**
 * utils/worldRuleContentValidator.js
 *
 * 世界规则海报内容质量校验器
 * 在生成海报前执行，确保所有卡片有真实内容
 *
 * 三级状态：
 *   COMPLETE  — 四个核心字段完整，正常生成
 *   TEMPORARY — 只缺 underlyingLogic，但 worldRule / reverseLogic / actionAdvice 完整，允许生成
 *   MISSING   — 缺 worldRule / reverseLogic / actionAdvice 任一，阻止生成
 */

/**
 * 简单文本清理
 */
function clean(text) {
  if (!text || typeof text !== 'string') return ''
  return text.trim().replace(/\s+/g, ' ')
}

/**
 * 计算中文字符数（近似）
 */
function charCount(text) {
  if (!text) return 0
  let count = 0
  for (const ch of text) {
    count += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 1 : 0.5
  }
  return Math.round(count)
}

/**
 * 占位句列表
 */
const PLACEHOLDER_TEXTS = [
  '该条规则暂未补充底层逻辑',
  '该规则基于客观世界的运行规律推导而来',
  '该条规则暂未补充反向推理',
  '该条规则暂未补充行动建议',
]

function isPlaceholder(text) {
  if (!text) return false
  const t = clean(text)
  return PLACEHOLDER_TEXTS.some(p => t.includes(p.replace(/\s+/g, '').substring(0, 10)))
}

/**
 * 简单相似度检测（基于关键词重叠）
 */
function similarityScore(a, b) {
  if (!a || !b) return 0
  const wordsA = new Set(clean(a).split('').filter(c => /[\u4e00-\u9fff]/.test(c)))
  const wordsB = new Set(clean(b).split('').filter(c => /[\u4e00-\u9fff]/.test(c)))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let overlap = 0
  for (const w of wordsA) { if (wordsB.has(w)) overlap++ }
  return overlap / Math.max(wordsA.size, wordsB.size)
}

/**
 * 校验世界规则海报内容
 *
 * @returns {{ ok, status: 'COMPLETE'|'TEMPORARY'|'MISSING', errors, warnings, missingFields }}
 */
function validateWorldRuleContent(rule) {
  if (!rule) return { ok: false, status: 'MISSING', errors: ['rule is null'], warnings: [], missingFields: ['rule'] }

  const errors = []
  const warnings = []
  const missingFields = []

  const wr = clean(rule.worldRule)
  const ul = clean(rule.underlyingLogic)
  const rl = clean(rule.reverseLogic)
  const aa = clean(rule.actionAdvice)

  // 核心字段非空检查
  if (!wr) { errors.push('01 世界规则为空'); missingFields.push('worldRule') }
  if (!ul) { missingFields.push('underlyingLogic') }
  if (!rl) { errors.push('03 反向推理为空'); missingFields.push('reverseLogic') }
  if (!aa) { errors.push('04 行动建议为空'); missingFields.push('actionAdvice') }

  // 判定状态
  let status = 'COMPLETE'
  if (!wr || !rl || !aa) {
    status = 'MISSING'
  } else if (!ul) {
    // 仅缺 underlyingLogic，其余三个完整 → TEMPORARY
    status = 'TEMPORARY'
    warnings.push('02 底层逻辑暂时缺失，使用过渡内容')
  }

  // 01 == 02 完全相同
  if (wr && ul && wr === ul) {
    errors.push('01 世界规则 与 02 底层逻辑 内容完全相同')
    if (status === 'COMPLETE') status = 'MISSING'
  }

  // 01 与 02 相似度过高
  if (wr && ul && status === 'COMPLETE') {
    const sim = similarityScore(wr, ul)
    if (sim > 0.7) {
      errors.push('01 与 02 内容相似度过高 (' + Math.round(sim * 100) + '%)')
      status = 'MISSING'
    }
  }

  // 02 是占位句
  if (ul && isPlaceholder(ul)) {
    errors.push('02 底层逻辑包含占位句')
    if (status !== 'MISSING') status = 'MISSING'
  }

  // 长度建议（仅 COMPLETE 状态时有效）
  if (status === 'COMPLETE') {
    const ulChars = charCount(ul)
    if (ulChars < 50) warnings.push('02 底层逻辑偏短 (' + ulChars + '字)，建议 80-140 字')
    if (ulChars > 200) warnings.push('02 底层逻辑偏长 (' + ulChars + '字)，建议 80-140 字')
  }

  const rlChars = charCount(rl)
  if (rlChars > 0 && rlChars < 40) {
    warnings.push('03 反向推理偏短 (' + rlChars + '字)，建议 70-160 字')
  }

  const aaChars = charCount(aa)
  if (aaChars > 0 && aaChars < 20) {
    warnings.push('04 行动建议偏短 (' + aaChars + '字)，建议 40-100 字')
  }

  const ok = status !== 'MISSING'

  return { ok, status, errors, warnings, missingFields }
}

module.exports = { validateWorldRuleContent }
