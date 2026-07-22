/**
 * core/turnaround-intelligence/contracts/risk.js
 *
 * CP6-C Risk Contract — 风险定义
 *
 * Risk Engine 回答："为什么翻不了身？"
 *
 * 每个风险项：
 *   - riskCode        唯一标识
 *   - severity        0-100 严重程度
 *   - reversibility   HIGH | MEDIUM | LOW — 可逆性（两个月 vs 两年）
 *   - estimatedRecoveryDays — 预计建立新习惯/改善风险的周期
 *   - evidenceRefs    证据引用
 *   - patternRefs     模式引用（如有）
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

// ═══════════════════════════════════════
// Risk Codes — 风险编码表
// ═══════════════════════════════════════

const RISK_CODES = Object.freeze({

  // === 执行层风险 ===
  EXECUTION_FRAGMENTATION: {
    code: 'EXECUTION_FRAGMENTATION',
    label: '执行碎片化',
    category: 'EXECUTION',
    description: '计划频繁中断，无法形成持续执行闭环',
  },
  ANALYSIS_PARALYSIS: {
    code: 'ANALYSIS_PARALYSIS',
    label: '分析瘫痪',
    category: 'EXECUTION',
    description: '过度思考导致无法启动行动',
  },
  EMOTIONAL_INTERRUPTION: {
    code: 'EMOTIONAL_INTERRUPTION',
    label: '情绪中断',
    category: 'EXECUTION',
    description: '情绪波动导致执行周期性中断',
  },

  // === 财富层风险 ===
  INCOME_FRAGILITY_RISK: {
    code: 'INCOME_FRAGILITY_RISK',
    label: '收入脆弱风险',
    category: 'WEALTH',
    description: '单一收入来源，抗风险能力极弱',
  },
  LIQUIDITY_CRISIS_RISK: {
    code: 'LIQUIDITY_CRISIS_RISK',
    label: '流动性危机风险',
    category: 'WEALTH',
    description: '负债加上收入不稳定，流动性风险很高',
  },
  FINANCIAL_DISORDER_RISK: {
    code: 'FINANCIAL_DISORDER_RISK',
    label: '财务失控风险',
    category: 'WEALTH',
    description: '短视消费加上单一收入，财务逐渐恶化',
  },
  NO_FINANCIAL_BUFFER_RISK: {
    code: 'NO_FINANCIAL_BUFFER_RISK',
    label: '无安全垫风险',
    category: 'WEALTH',
    description: '没有财务缓冲，小风险即可造成危机',
  },

  // === 心理层风险 ===
  LEARNED_HELPLESSNESS_RISK: {
    code: 'LEARNED_HELPLESSNESS_RISK',
    label: '习得性无助风险',
    category: 'PSYCHOLOGY',
    description: '自我否定加上外部归因，失去改变动力',
  },
  ANXIETY_DRIVEN_RISK: {
    code: 'ANXIETY_DRIVEN_RISK',
    label: '焦虑驱动风险',
    category: 'PSYCHOLOGY',
    description: '高焦虑导致决策偏向保守，错过机会',
  },
  ADDICTIVE_RISK_BEHAVIOR: {
    code: 'ADDICTIVE_RISK_BEHAVIOR',
    label: '成瘾型风险行为',
    category: 'PSYCHOLOGY',
    description: '高风险偏好加上焦虑，进入赌博式决策循环',
  },
  NO_SELF_DRIVE_RISK: {
    code: 'NO_SELF_DRIVE_RISK',
    label: '内在动力缺乏风险',
    category: 'PSYCHOLOGY',
    description: '外部归因加上短视，没有自主改变意愿',
  },
  DEFENSIVE_STANCE_RISK: {
    code: 'DEFENSIVE_STANCE_RISK',
    label: '防御型心态风险',
    category: 'PSYCHOLOGY',
    description: '过度规避风险加上追求稳定，缺乏突破意识',
  },

  // === 综合层风险 ===
  LEARNING_EXECUTION_GAP_RISK: {
    code: 'LEARNING_EXECUTION_GAP_RISK',
    label: '学习-执行缺口风险',
    category: 'COMPOSITE',
    description: '学习输入多但行动滞后，知识没转化成结果',
  },
  COGNITION_EXECUTION_GAP_RISK: {
    code: 'COGNITION_EXECUTION_GAP_RISK',
    label: '认知-执行缺口风险',
    category: 'COMPOSITE',
    description: '认知能力强但执行弱，形成明显落差',
  },
  AMBITION_DISCIPLINE_GAP_RISK: {
    code: 'AMBITION_DISCIPLINE_GAP_RISK',
    label: '高欲低纪风险',
    category: 'COMPOSITE',
    description: '欲望高但纪律性弱，容易持续放弃',
  },
})

// ═══════════════════════════════════════
// Reversibility Levels
// ═══════════════════════════════════════

const REVERSIBILITY = Object.freeze({
  HIGH: {
    level: 'HIGH',
    label: '高可逆',
    description: '可通过短期（≤60天）建立新习惯来改善',
  },
  MEDIUM: {
    level: 'MEDIUM',
    label: '中可逆',
    description: '需要中期（60-120天）调整行为模式',
  },
  LOW: {
    level: 'LOW',
    label: '低可逆',
    description: '长期形成，预计改善周期 120-365 天',
  },
})

// ═══════════════════════════════════════
// Risk Categories
// ═══════════════════════════════════════

const RISK_CATEGORIES = Object.freeze({
  EXECUTION: 'EXECUTION',
  WEALTH: 'WEALTH',
  PSYCHOLOGY: 'PSYCHOLOGY',
  COMPOSITE: 'COMPOSITE',
})

// ═══════════════════════════════════════
// Classification thresholds
// ═══════════════════════════════════════

const SEVERITY_LEVELS = Object.freeze({
  CRITICAL: { min: 80, label: '严重' },
  HIGH: { min: 65, label: '高位' },
  MODERATE: { min: 45, label: '中等' },
  LOW: { min: 25, label: '低位' },
  NEGLIGIBLE: { min: 0, label: '可忽略' },
})

function getSeverityLevel(score) {
  if (score >= 80) return 'CRITICAL'
  if (score >= 65) return 'HIGH'
  if (score >= 45) return 'MODERATE'
  if (score >= 25) return 'LOW'
  return 'NEGLIGIBLE'
}

// ═══════════════════════════════════════
// Create Risk Output
// ═══════════════════════════════════════

/**
 * createRiskOutput — 验证并冻结 Risk Engine 输出
 */
function createRiskOutput({
  version,
  risks,
  topRisk,
  totalRiskScore,
  evidenceRefs,
  patternRefs,
}) {
  if (!version) throw new Error('RiskOutput: version required')
  if (!Array.isArray(risks)) throw new Error('RiskOutput: risks must be an array')
  if (!topRisk || !topRisk.riskCode) throw new Error('RiskOutput: topRisk required')
  if (typeof totalRiskScore !== 'number' || totalRiskScore < 0) {
    throw new Error(`RiskOutput: totalRiskScore must be ≥0, got ${totalRiskScore}`)
  }
  if (!Array.isArray(evidenceRefs)) throw new Error('RiskOutput: evidenceRefs required')

  // 验证每条风险
  for (const risk of risks) {
    if (!risk.riskCode) throw new Error(`Risk item missing riskCode`)
    if (!RISK_CODES[risk.riskCode]) throw new Error(`Unknown riskCode: "${risk.riskCode}"`)
    if (typeof risk.severity !== 'number' || risk.severity < 0 || risk.severity > 100) {
      throw new Error(`Risk ${risk.riskCode}: severity out of range: ${risk.severity}`)
    }
    if (!['HIGH', 'MEDIUM', 'LOW'].includes(risk.reversibility)) {
      throw new Error(`Risk ${risk.riskCode}: invalid reversibility: ${risk.reversibility}`)
    }
    if (typeof risk.estimatedRecoveryDays !== 'number' || risk.estimatedRecoveryDays < 0) {
      throw new Error(`Risk ${risk.riskCode}: invalid estimatedRecoveryDays: ${risk.estimatedRecoveryDays}`)
    }
    if (!Array.isArray(risk.evidenceRefs)) {
      throw new Error(`Risk ${risk.riskCode}: evidenceRefs must be an array`)
    }
  }

  return Object.freeze({
    version,
    risks: Object.freeze(risks.map(r => Object.freeze({ ...r }))),
    topRisk: Object.freeze({ ...topRisk }),
    totalRiskScore: Math.round(clamp(totalRiskScore, 0, 100)),
    evidenceRefs: Object.freeze([...evidenceRefs]),
    patternRefs: patternRefs ? Object.freeze([...patternRefs]) : Object.freeze([]),
  })
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

module.exports = {
  RISK_CODES,
  REVERSIBILITY,
  RISK_CATEGORIES,
  SEVERITY_LEVELS,
  getSeverityLevel,
  createRiskOutput,
}
