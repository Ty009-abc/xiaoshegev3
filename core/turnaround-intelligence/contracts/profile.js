/**
 * core/turnaround-intelligence/contracts/profile.js
 *
 * CP6-B Profile 数据契约
 *
 * 定义 Profile Engine 的输出结构、枚举、验证规则。
 *
 * Profile Engine 回答: "这个人当前呈现出怎样的稳定模式？"
 * 不负责评分（评分由 Cognitive Engine 负责）。
 *
 * @version 6.0.0
 * @checkpoint CP6-B
 */

const { BEHAVIOR_TAGS, PSYCHOLOGY_TAGS, WEALTH_TAGS, PATTERN_TAGS } = require('./tags')

// ═══════════════════════════════════════
// 人格原型 (Archetypes) — 8 种
// ═══════════════════════════════════════

const ARCHETYPES = {
  EXECUTOR: 'EXECUTOR',           // 行动兑现型
  THINKER: 'THINKER',             // 深度思考型
  EXPLORER: 'EXPLORER',           // 路径探索型
  STABILIZER: 'STABILIZER',       // 稳定守成型
  OPPORTUNIST: 'OPPORTUNIST',     // 机会驱动型
  STRUGGLER: 'STRUGGLER',         // 生存承压型
  DREAMER: 'DREAMER',             // 理想先行型
  REBUILDER: 'REBUILDER',         // 重建反弹型
}

const ARCHETYPE_LABELS = {
  EXECUTOR: '行动兑现型',
  THINKER: '深度思考型',
  EXPLORER: '路径探索型',
  STABILIZER: '稳定守成型',
  OPPORTUNIST: '机会驱动型',
  STRUGGLER: '生存承压型',
  DREAMER: '理想先行型',
  REBUILDER: '重建反弹型',
}

// ═══════════════════════════════════════
// 人生阶段 (Life Stages) — 6 种
// ═══════════════════════════════════════

const LIFE_STAGES = {
  SURVIVAL: 'SURVIVAL',                   // 生存期
  EXPLORATION: 'EXPLORATION',             // 探索期
  ACCUMULATION: 'ACCUMULATION',           // 积累期
  BREAKTHROUGH: 'BREAKTHROUGH',           // 突破期
  EXPANSION: 'EXPANSION',                 // 扩展期
  REBUILDING: 'REBUILDING',               // 重建期
}

const LIFE_STAGE_LABELS = {
  SURVIVAL: '生存期',
  EXPLORATION: '探索期',
  ACCUMULATION: '积累期',
  BREAKTHROUGH: '突破期',
  EXPANSION: '扩展期',
  REBUILDING: '重建期',
}

// ═══════════════════════════════════════
// 决策风格 (Decision Styles) — 4 种
// ═══════════════════════════════════════

const DECISION_STYLES = {
  ANALYSIS_HEAVY: 'ANALYSIS_HEAVY',           // 分析驱动
  INTUITION_DRIVEN: 'INTUITION_DRIVEN',       // 直觉驱动
  EXTERNAL_REFERENCED: 'EXTERNAL_REFERENCED', // 外部参照
  IMPULSE_DRIVEN: 'IMPULSE_DRIVEN',           // 冲动驱动
}

const DECISION_STYLE_LABELS = {
  ANALYSIS_HEAVY: '分析驱动',
  INTUITION_DRIVEN: '直觉驱动',
  EXTERNAL_REFERENCED: '外部参照',
  IMPULSE_DRIVEN: '冲动驱动',
}

// ═══════════════════════════════════════
// 执行风格 (Execution Styles) — 4 种
// ═══════════════════════════════════════

const EXECUTION_STYLES = {
  CONSISTENT: 'CONSISTENT',               // 持续执行
  INTERRUPTED: 'INTERRUPTED',             // 间歇性执行
  DELAY_THEN_BURST: 'DELAY_THEN_BURST',   // 延迟后爆发
  AVOIDANT: 'AVOIDANT',                   // 回避型
}

const EXECUTION_STYLE_LABELS = {
  CONSISTENT: '持续执行',
  INTERRUPTED: '间歇性执行',
  DELAY_THEN_BURST: '延迟后爆发',
  AVOIDANT: '回避型',
}

// ═══════════════════════════════════════
// 风险风格 (Risk Styles) — 4 种
// ═══════════════════════════════════════

const RISK_STYLES = {
  CALCULATED: 'CALCULATED',               // 计算型
  EMOTIONAL_SWING: 'EMOTIONAL_SWING',     // 情绪化摇摆
  AVOIDANT: 'AVOIDANT',                   // 规避型
  SEEKING: 'SEEKING',                     // 寻求型
}

const RISK_STYLE_LABELS = {
  CALCULATED: '计算型',
  EMOTIONAL_SWING: '情绪化摇摆',
  AVOIDANT: '规避型',
  SEEKING: '寻求型',
}

// ═══════════════════════════════════════
// 优势/限制 Code 枚举
// ═══════════════════════════════════════

const STRENGTH_CODES = {
  LEARNING_CAPACITY: 'LEARNING_CAPACITY',
  EXECUTION_CONSISTENCY: 'EXECUTION_CONSISTENCY',
  ADAPTABILITY: 'ADAPTABILITY',
  SELF_AWARENESS: 'SELF_AWARENESS',
  RISK_AWARENESS: 'RISK_AWARENESS',
  RESILIENCE: 'RESILIENCE',
  NETWORK_CAPITAL: 'NETWORK_CAPITAL',
  FINANCIAL_DISCIPLINE: 'FINANCIAL_DISCIPLINE',
  GROWTH_MINDSET: 'GROWTH_MINDSET',
  CREATIVITY: 'CREATIVITY',
}

const CONSTRAINT_CODES = {
  LOW_EXECUTION_CONTINUITY: 'LOW_EXECUTION_CONTINUITY',
  ANALYSIS_PARALYSIS: 'ANALYSIS_PARALYSIS',
  EMOTIONAL_DECISION: 'EMOTIONAL_DECISION',
  SINGLE_INCOME_DEPENDENCY: 'SINGLE_INCOME_DEPENDENCY',
  LOW_RISK_TOLERANCE: 'LOW_RISK_TOLERANCE',
  HIGH_RISK_NO_CONTROL: 'HIGH_RISK_NO_CONTROL',
  SHORT_TERM_FOCUS: 'SHORT_TERM_FOCUS',
  ISOLATION: 'ISOLATION',
  SELF_DOUBT: 'SELF_DOUBT',
  LACK_OF_LEVERAGE: 'LACK_OF_LEVERAGE',
  DEBT_PRESSURE: 'DEBT_PRESSURE',
  OPPORTUNITY_HOPPING: 'OPPORTUNITY_HOPPING',
}

// ═══════════════════════════════════════
// Summary Code 枚举
// ═══════════════════════════════════════

const SUMMARY_CODES = {
  HIGH_COGNITION_LOW_CONVERSION: 'HIGH_COGNITION_LOW_CONVERSION',
  HIGH_EXECUTION_LOW_STRATEGY: 'HIGH_EXECUTION_LOW_STRATEGY',
  SURVIVAL_MODE_ACTIVATED: 'SURVIVAL_MODE_ACTIVATED',
  BALANCED_GROWTH: 'BALANCED_GROWTH',
  UNTAPPED_POTENTIAL: 'UNTAPPED_POTENTIAL',
  RISK_DOMINATED: 'RISK_DOMINATED',
  DISCIPLINED_BUILDING: 'DISCIPLINED_BUILDING',
  DIRECTION_LESS: 'DIRECTION_LESS',
}

// ═══════════════════════════════════════
// createProfileOutput — 创建 Profile 输出
// ═══════════════════════════════════════

/**
 * createProfileOutput
 *
 * @param {Object} params
 * @param {string} params.version
 * @param {Object} params.archetype      — { primary, secondary, label, confidence }
 * @param {Object} params.lifeStage       — { code, label, confidence }
 * @param {Object} params.decisionStyle   — { code, label, confidence }
 * @param {Object} params.executionStyle  — { code, label, confidence }
 * @param {Object} params.riskStyle       — { code, label, confidence }
 * @param {Object[]} params.strengths     — [{ code, label, score, evidenceRefs }]
 * @param {Object[]} params.constraints   — [{ code, label, severity, evidenceRefs }]
 * @param {Object[]} params.dominantPatterns — [{ tag, strength, evidenceRefs }]
 * @param {string} params.summaryCode
 * @param {string[]} params.evidenceRefs
 * @param {number} params.confidence
 * @returns {Object} 冻结的 ProfileOutput
 */
function createProfileOutput({
  version, archetype, lifeStage, decisionStyle, executionStyle,
  riskStyle, strengths, constraints, dominantPatterns,
  summaryCode, evidenceRefs, confidence,
}) {
  // 版本
  if (!version) throw new Error('ProfileOutput: version required')

  // 原型验证
  if (!archetype || !ARCHETYPES[archetype.primary]) {
    throw new Error(`ProfileOutput: invalid primary archetype "${archetype ? archetype.primary : undefined}"`)
  }
  if (archetype.secondary && !ARCHETYPES[archetype.secondary]) {
    throw new Error(`ProfileOutput: invalid secondary archetype "${archetype.secondary}"`)
  }
  if (typeof archetype.confidence !== 'number' || archetype.confidence < 0 || archetype.confidence > 1) {
    throw new Error(`ProfileOutput: archetype confidence must be 0–1, got ${archetype.confidence}`)
  }

  // 阶段验证
  if (!lifeStage || !LIFE_STAGES[lifeStage.code]) {
    throw new Error(`ProfileOutput: invalid lifeStage "${lifeStage ? lifeStage.code : undefined}"`)
  }

  // 风格验证
  if (!decisionStyle || !DECISION_STYLES[decisionStyle.code]) {
    throw new Error(`ProfileOutput: invalid decisionStyle "${decisionStyle ? decisionStyle.code : undefined}"`)
  }
  if (!executionStyle || !EXECUTION_STYLES[executionStyle.code]) {
    throw new Error(`ProfileOutput: invalid executionStyle "${executionStyle ? executionStyle.code : undefined}"`)
  }
  if (!riskStyle || !RISK_STYLES[riskStyle.code]) {
    throw new Error(`ProfileOutput: invalid riskStyle "${riskStyle ? riskStyle.code : undefined}"`)
  }

  // 优势/限制不得使用相同 Code
  if (strengths && constraints) {
    const strengthCodes = new Set(strengths.map(s => s.code))
    for (const c of constraints) {
      if (strengthCodes.has(c.code)) {
        throw new Error(`ProfileOutput: code "${c.code}" used in both strengths and constraints`)
      }
    }
  }

  // 证据链 — 允许降级（证据不足时不强制 ≥2）
  if (!Array.isArray(evidenceRefs)) {
    throw new Error('ProfileOutput: evidenceRefs must be an array')
  }

  // 置信度
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error(`ProfileOutput: confidence must be 0–1, got ${confidence}`)
  }

  // Summary code
  if (summaryCode && !SUMMARY_CODES[summaryCode]) {
    // 允许自定义 summaryCode 前缀
  }

  return Object.freeze({
    version,
    archetype: Object.freeze({
      primary: archetype.primary,
      secondary: archetype.secondary || null,
      label: archetype.label,
      confidence: archetype.confidence,
    }),
    lifeStage: Object.freeze({
      code: lifeStage.code,
      label: lifeStage.label,
      confidence: lifeStage.confidence,
    }),
    decisionStyle: Object.freeze({
      code: decisionStyle.code,
      label: decisionStyle.label || DECISION_STYLE_LABELS[decisionStyle.code],
      confidence: decisionStyle.confidence,
    }),
    executionStyle: Object.freeze({
      code: executionStyle.code,
      label: executionStyle.label || EXECUTION_STYLE_LABELS[executionStyle.code],
      confidence: executionStyle.confidence,
    }),
    riskStyle: Object.freeze({
      code: riskStyle.code,
      label: riskStyle.label || RISK_STYLE_LABELS[riskStyle.code],
      confidence: riskStyle.confidence,
    }),
    strengths: Object.freeze((strengths || []).map(s => Object.freeze({
      code: s.code,
      label: s.label,
      score: s.score,
      evidenceRefs: Object.freeze([...s.evidenceRefs]),
    }))),
    constraints: Object.freeze((constraints || []).map(c => Object.freeze({
      code: c.code,
      label: c.label,
      severity: c.severity,
      evidenceRefs: Object.freeze([...c.evidenceRefs]),
    }))),
    dominantPatterns: Object.freeze((dominantPatterns || []).map(dp => Object.freeze({
      tag: dp.tag,
      strength: dp.strength,
      evidenceRefs: Object.freeze([...dp.evidenceRefs]),
    }))),
    summaryCode,
    evidenceRefs: Object.freeze([...evidenceRefs]),
    confidence,
  })
}

/**
 * createEvidenceRef — 创建证据引用
 */
function createEvidenceRef(evidenceId, contribution) {
  return Object.freeze({ evidenceId, contribution })
}

module.exports = {
  ARCHETYPES,
  ARCHETYPE_LABELS,
  LIFE_STAGES,
  LIFE_STAGE_LABELS,
  DECISION_STYLES,
  DECISION_STYLE_LABELS,
  EXECUTION_STYLES,
  EXECUTION_STYLE_LABELS,
  RISK_STYLES,
  RISK_STYLE_LABELS,
  STRENGTH_CODES,
  CONSTRAINT_CODES,
  SUMMARY_CODES,
  createProfileOutput,
  createEvidenceRef,
}
