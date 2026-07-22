/**
 * core/turnaround-intelligence/contracts/leverage.js
 *
 * CP6-C Leverage Contract — 12 个固定杠杆编码
 *
 * 每个杠杆项包含:
 *   code, title, strength, priority, confidence, reason, evidenceRefs
 *
 * 禁止 AI 自由命名杠杆
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

// ═══════════════════════════════════════
// Leverage Catalog — 12 个固定 Code
// ═══════════════════════════════════════

const LEVERAGE_CATALOG = Object.freeze({

  LEARNING_SPEED: {
    code: 'LEARNING_SPEED',
    title: '学习速度',
    category: 'CAPABILITY',
    estimatedTimeToImpact: 30,
    description: '学习吸收能力强，新知识转化快',
  },

  EXECUTION_SPEED: {
    code: 'EXECUTION_SPEED',
    title: '执行速度',
    category: 'CAPABILITY',
    estimatedTimeToImpact: 15,
    description: '启动快、动手能力强',
  },

  COMMUNICATION: {
    code: 'COMMUNICATION',
    title: '沟通表达',
    category: 'CAPABILITY',
    estimatedTimeToImpact: 20,
    description: '善于表达和影响他人',
  },

  SALES: {
    code: 'SALES',
    title: '销售转化',
    category: 'CAPABILITY',
    estimatedTimeToImpact: 20,
    description: '能有效说服和完成交易',
  },

  TECHNOLOGY: {
    code: 'TECHNOLOGY',
    title: '技术优势',
    category: 'CAPABILITY',
    estimatedTimeToImpact: 30,
    description: '技术功底扎实，可打造产品壁垒',
  },

  NETWORK: {
    code: 'NETWORK',
    title: '人际网络',
    category: 'RESOURCE',
    estimatedTimeToImpact: 0,
    description: '有现成的人脉资源可用',
  },

  DISCIPLINE: {
    code: 'DISCIPLINE',
    title: '自律坚持',
    category: 'PSYCHOLOGY',
    estimatedTimeToImpact: 60,
    description: '能持续执行，形成复利效应',
  },

  CREATIVITY: {
    code: 'CREATIVITY',
    title: '创造力',
    category: 'CAPABILITY',
    estimatedTimeToImpact: 30,
    description: '能提出差异化方案',
  },

  CONSISTENCY: {
    code: 'CONSISTENCY',
    title: '持续力',
    category: 'PSYCHOLOGY',
    estimatedTimeToImpact: 45,
    description: '有耐心长期投入，不急于回报',
  },

  SPECIALIZATION: {
    code: 'SPECIALIZATION',
    title: '专精深度',
    category: 'CAPABILITY',
    estimatedTimeToImpact: 60,
    description: '在某个领域有深度积累',
  },

  RESOURCE_INTEGRATION: {
    code: 'RESOURCE_INTEGRATION',
    title: '资源整合',
    category: 'RESOURCE',
    estimatedTimeToImpact: 30,
    description: '能把不同资源组合变现',
  },

  CONTENT_CREATION: {
    code: 'CONTENT_CREATION',
    title: '内容创作',
    category: 'CAPABILITY',
    estimatedTimeToImpact: 45,
    description: '能持续生产有价值的内容',
  },
})

// ═══════════════════════════════════════
// Evidence Tag → Leverage 映射
// ═══════════════════════════════════════

const TAG_TO_LEVERAGE = Object.freeze({
  'LEARNING': 'LEARNING_SPEED',
  'EXECUTION_STRONG': 'EXECUTION_SPEED',
  'ACTION_FAST': 'EXECUTION_SPEED',
  'DISCIPLINE': 'DISCIPLINE',
  'PERSISTENCE': 'CONSISTENCY',
  'LONG_TERM_ORIENTED': 'CONSISTENCY',
  'GROWTH_MINDSET': 'LEARNING_SPEED',
  'RESILIENCE_HIGH': 'CONSISTENCY',
  'CONFIDENCE': 'COMMUNICATION',
  'MULTI_INCOME': 'RESOURCE_INTEGRATION',
})

// ═══════════════════════════════════════
// Profile Strength → Leverage 映射
// ═══════════════════════════════════════

const STRENGTH_TO_LEVERAGE = Object.freeze({
  'LEARNING_CAPACITY': 'LEARNING_SPEED',
  'SELF_AWARENESS': 'LEARNING_SPEED',
  'ACCEPTING_REALITY': 'CONSISTENCY',
})

// ═══════════════════════════════════════
// Leverage Output
// ═══════════════════════════════════════

/**
 * 只输出 Top 3 Leverage
 */
function createLeverageOutput({
  version,
  topLeverages,
  totalLeverageScore,
}) {
  if (!version) throw new Error('LeverageOutput: version required')
  if (!Array.isArray(topLeverages)) throw new Error('LeverageOutput: topLeverages must be an array')
  if (topLeverages.length > 3) {
    throw new Error('LeverageOutput: topLeverages max 3, got ' + topLeverages.length)
  }
  if (typeof totalLeverageScore !== 'number') throw new Error('LeverageOutput: totalLeverageScore required')

  for (let i = 0; i < topLeverages.length; i++) {
    const l = topLeverages[i]
    if (!l.code) throw new Error(`topLeverages[${i}]: code required`)
    if (!LEVERAGE_CATALOG[l.code]) throw new Error(`Unknown leverage code: "${l.code}"`)
    if (typeof l.strength !== 'number' || l.strength < 0 || l.strength > 100) {
      throw new Error(`Leverage ${l.code}: strength out of range`)
    }
    if (l.priority !== i + 1) throw new Error(`topLeverages[${i}]: priority must be ${i + 1}`)
    if (typeof l.confidence !== 'number' || l.confidence < 0 || l.confidence > 1) {
      throw new Error(`Leverage ${l.code}: confidence out of range`)
    }
    if (typeof l.reason !== 'string') throw new Error(`Leverage ${l.code}: reason required`)
    if (!Array.isArray(l.evidenceRefs)) throw new Error(`Leverage ${l.code}: evidenceRefs required`)
  }

  return Object.freeze({
    version,
    topLeverages: Object.freeze(topLeverages.map(l => Object.freeze({ ...l }))),
    totalLeverageScore: Math.round(clamp(totalLeverageScore, 0, 100)),
  })
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

module.exports = {
  LEVERAGE_CATALOG,
  TAG_TO_LEVERAGE,
  STRENGTH_TO_LEVERAGE,
  createLeverageOutput,
}
