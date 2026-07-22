/**
 * core/turnaround-intelligence/contracts/leverage.js
 *
 * CP6-C Leverage Contract — 杠杆定义
 *
 * Leverage Engine 回答："翻身靠什么？"
 *
 * 杠杆是从 Profile 优势、正向 Pattern 和 Evidence 中
 * 识别出的可以撬动改变的力量源。
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

// ═══════════════════════════════════════
// Leverage Codes
// ═══════════════════════════════════════

const LEVERAGE_CODES = Object.freeze({

  // === 能力杠杆 ===
  LEARNING_CAPACITY_LEVERAGE: {
    code: 'LEARNING_CAPACITY_LEVERAGE',
    label: '学习能力',
    category: 'CAPABILITY',
    description: '学习吸收能力强，新知识转化快',
    reversibility: 'N/A',
    estimatedTimeToImpact: 30,
  },
  EXECUTION_CONSISTENCY_LEVERAGE: {
    code: 'EXECUTION_CONSISTENCY_LEVERAGE',
    label: '执行力优势',
    category: 'CAPABILITY',
    description: '能持续执行并有坚持的能力',
    reversibility: 'N/A',
    estimatedTimeToImpact: 15,
  },
  SELF_AWARENESS_LEVERAGE: {
    code: 'SELF_AWARENESS_LEVERAGE',
    label: '自我觉察',
    category: 'CAPABILITY',
    description: '对自身困境有清晰认知，这是改变的第一步',
    reversibility: 'N/A',
    estimatedTimeToImpact: 7,
  },

  // === 资源杠杆 ===
  MULTI_INCOME_LEVERAGE: {
    code: 'MULTI_INCOME_LEVERAGE',
    label: '多收入来源',
    category: 'RESOURCE',
    description: '已有多条收入渠道，分散风险',
    reversibility: 'N/A',
    estimatedTimeToImpact: 0,
  },
  FINANCIAL_BUFFER_LEVERAGE: {
    code: 'FINANCIAL_BUFFER_LEVERAGE',
    label: '财务安全垫',
    category: 'RESOURCE',
    description: '有存款或资产缓冲，可支撑转型期',
    reversibility: 'N/A',
    estimatedTimeToImpact: 0,
  },
  STABLE_INCOME_LEVERAGE: {
    code: 'STABLE_INCOME_LEVERAGE',
    label: '稳定收入基础',
    category: 'RESOURCE',
    description: '有稳定现金流，不用担心生存问题',
    reversibility: 'N/A',
    estimatedTimeToImpact: 0,
  },

  // === 心态杠杆 ===
  GROWTH_MINDSET_LEVERAGE: {
    code: 'GROWTH_MINDSET_LEVERAGE',
    label: '成长心态',
    category: 'PSYCHOLOGY',
    description: '相信能力可通过努力提升，愿意改变',
    reversibility: 'N/A',
    estimatedTimeToImpact: 30,
  },
  RESILIENCE_LEVERAGE: {
    code: 'RESILIENCE_LEVERAGE',
    label: '心理韧性',
    category: 'PSYCHOLOGY',
    description: '面对挫折有较强恢复力',
    reversibility: 'N/A',
    estimatedTimeToImpact: 15,
  },
  CONFIDENCE_LEVERAGE: {
    code: 'CONFIDENCE_LEVERAGE',
    label: '自信心',
    category: 'PSYCHOLOGY',
    description: '对自己有信心，敢尝试新方向',
    reversibility: 'N/A',
    estimatedTimeToImpact: 20,
  },

  // === 策略杠杆（复合） ===
  COGNITION_LEVERAGE: {
    code: 'COGNITION_LEVERAGE',
    label: '认知放大杠杆',
    category: 'STRATEGY',
    description: '认知能力强 → 一旦行动，学习效率会远超平均水平',
    reversibility: 'N/A',
    estimatedTimeToImpact: 45,
  },
  DISCIPLINE_LEVERAGE: {
    code: 'DISCIPLINE_LEVERAGE',
    label: '纪律复利杠杆',
    category: 'STRATEGY',
    description: '纪律性强 → 持续执行会形成复利效应',
    reversibility: 'N/A',
    estimatedTimeToImpact: 60,
  },
  ADAPTABILITY_LEVERAGE: {
    code: 'ADAPTABILITY_LEVERAGE',
    label: '适应力加速杠杆',
    category: 'STRATEGY',
    description: '适应力强 → 可以快速切换方向，降低试错成本',
    reversibility: 'N/A',
    estimatedTimeToImpact: 30,
  },
  LOW_RISK_LEVERAGE: {
    code: 'LOW_RISK_LEVERAGE',
    label: '低风险控制杠杆',
    category: 'STRATEGY',
    description: '风险控制力强 → 翻身过程不容易再次踩坑',
    reversibility: 'N/A',
    estimatedTimeToImpact: 90,
  },
})

// ═══════════════════════════════════════
// Leverage Categories
// ═══════════════════════════════════════

const LEVERAGE_CATEGORIES = Object.freeze({
  CAPABILITY: 'CAPABILITY',
  RESOURCE: 'RESOURCE',
  PSYCHOLOGY: 'PSYCHOLOGY',
  STRATEGY: 'STRATEGY',
})

// ═══════════════════════════════════════
// Leverage Impact Levels
// ═══════════════════════════════════════

const IMPACT_LEVELS = Object.freeze({
  IMMEDIATE: { min: 80, label: '立即可重用' },
  SHORT_TERM: { min: 60, label: '短期可撬动' },
  MEDIUM_TERM: { min: 40, label: '中期可开发' },
  LONG_TERM: { min: 20, label: '长期可培育' },
  LATENT: { min: 0, label: '隐性潜力' },
})

function getImpactLevel(score) {
  if (score >= 80) return 'IMMEDIATE'
  if (score >= 60) return 'SHORT_TERM'
  if (score >= 40) return 'MEDIUM_TERM'
  if (score >= 20) return 'LONG_TERM'
  return 'LATENT'
}

// ═══════════════════════════════════════
// Create Leverage Output
// ═══════════════════════════════════════

/**
 * createLeverageOutput — 验证并冻结 Leverage Engine 输出
 */
function createLeverageOutput({
  version,
  leverages,
  topLeverage,
  totalLeverageScore,
  evidenceRefs,
}) {
  if (!version) throw new Error('LeverageOutput: version required')
  if (!Array.isArray(leverages)) throw new Error('LeverageOutput: leverages must be an array')
  if (!topLeverage || !topLeverage.code) throw new Error('LeverageOutput: topLeverage required')
  if (typeof totalLeverageScore !== 'number' || totalLeverageScore < 0) {
    throw new Error(`LeverageOutput: totalLeverageScore must be ≥0`)
  }
  if (!Array.isArray(evidenceRefs)) throw new Error('LeverageOutput: evidenceRefs required')

  for (const lev of leverages) {
    if (!lev.code) throw new Error(`Leverage item missing code`)
    if (!LEVERAGE_CODES[lev.code]) throw new Error(`Unknown leverage code: "${lev.code}"`)
    if (typeof lev.strength !== 'number' || lev.strength < 0 || lev.strength > 100) {
      throw new Error(`Leverage ${lev.code}: strength out of range: ${lev.strength}`)
    }
    if (typeof lev.estimatedTimeToImpact !== 'number' || lev.estimatedTimeToImpact < 0) {
      throw new Error(`Leverage ${lev.code}: invalid estimatedTimeToImpact`)
    }
    if (!Array.isArray(lev.evidenceRefs)) {
      throw new Error(`Leverage ${lev.code}: evidenceRefs must be an array`)
    }
  }

  return Object.freeze({
    version,
    leverages: Object.freeze(leverages.map(l => Object.freeze({ ...l }))),
    topLeverage: Object.freeze({ ...topLeverage }),
    totalLeverageScore: Math.round(clamp(totalLeverageScore, 0, 100)),
    evidenceRefs: Object.freeze([...evidenceRefs]),
  })
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

module.exports = {
  LEVERAGE_CODES,
  LEVERAGE_CATEGORIES,
  IMPACT_LEVELS,
  getImpactLevel,
  createLeverageOutput,
}
