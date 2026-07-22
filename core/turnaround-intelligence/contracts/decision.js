/**
 * core/turnaround-intelligence/contracts/decision.js
 *
 * CP6-D Decision Contract — 固定 Decision Catalog（≤12） + One Decision Rule
 *
 * 整个 CP6-D 的核心入口：从 CoreContradiction + Opportunity 推导唯一 PrimaryDecision。
 *
 * @version 6.2.0
 * @checkpoint CP6-D
 */

// ═══════════════════════════════════════
// Decision Catalog — 12 个固定 Code
// ═══════════════════════════════════════

const DECISION_CATALOG = Object.freeze({

  BUILD_EXECUTION_SYSTEM: {
    code: 'BUILD_EXECUTION_SYSTEM',
    title: '建立连续执行系统',
    description: '从"想"到"做"，建立至少21天的连续执行闭环',
    category: 'EXECUTION',
    expectedCycleDays: 90,
  },

  BUILD_SECOND_INCOME: {
    code: 'BUILD_SECOND_INCOME',
    title: '建立第二收入线',
    description: '从单一收入结构扩展到至少两条收入线',
    category: 'INCOME',
    expectedCycleDays: 180,
  },

  INCREASE_MONETIZATION: {
    code: 'INCREASE_MONETIZATION',
    title: '提升变现能力',
    description: '将现有能力和知识转化为实际收入',
    category: 'INCOME',
    expectedCycleDays: 90,
  },

  DEEPEN_SPECIALIZATION: {
    code: 'DEEPEN_SPECIALIZATION',
    title: '技能深度专精',
    description: '聚焦一个方向深度积累，避免分散精力',
    category: 'CAPABILITY',
    expectedCycleDays: 180,
  },

  REDUCE_DECISION_FATIGUE: {
    code: 'REDUCE_DECISION_FATIGUE',
    title: '减少决策疲劳',
    description: '建立自动化决策规则，减少日常精力消耗',
    category: 'EXECUTION',
    expectedCycleDays: 30,
  },

  BUILD_DISCIPLINE: {
    code: 'BUILD_DISCIPLINE',
    title: '建立纪律系统',
    description: '通过固定时间、固定动作建立不可动摇的执行习惯',
    category: 'EXECUTION',
    expectedCycleDays: 60,
  },

  REBUILD_RISK_FRAMEWORK: {
    code: 'REBUILD_RISK_FRAMEWORK',
    title: '重建风险框架',
    description: '在当前不确定性中建立基本的决策边界和风险认知',
    category: 'PSYCHOLOGY',
    expectedCycleDays: 60,
  },

  CREATE_ASSET_ACCUMULATION: {
    code: 'CREATE_ASSET_ACCUMULATION',
    title: '启动资产积累',
    description: '从零开始建立基本的财务安全垫和复利入口',
    category: 'INCOME',
    expectedCycleDays: 365,
  },

  IMPROVE_CONTENT_OUTPUT: {
    code: 'IMPROVE_CONTENT_OUTPUT',
    title: '提升内容产出',
    description: '将思考和学习成果转化为可见的内容输出',
    category: 'CAPABILITY',
    expectedCycleDays: 90,
  },

  BUILD_AI_WORKFLOW: {
    code: 'BUILD_AI_WORKFLOW',
    title: '构建AI工作流',
    description: '利用AI工具建立可复制的工作流程，降低执行成本',
    category: 'CAPABILITY',
    expectedCycleDays: 60,
  },

  OPTIMIZE_INCOME_STRUCTURE: {
    code: 'OPTIMIZE_INCOME_STRUCTURE',
    title: '优化收入结构',
    description: '从被动收入向主动收入转型，优化结构和稳定性',
    category: 'INCOME',
    expectedCycleDays: 120,
  },

  STRENGTHEN_LONG_TERM_HABITS: {
    code: 'STRENGTHEN_LONG_TERM_HABITS',
    title: '强化长期习惯',
    description: '利用已有的自律优势，建立更多可复利的长期习惯',
    category: 'EXECUTION',
    expectedCycleDays: 180,
  },
})

// ═══════════════════════════════════════
// CoreContradiction + Opportunity → Decision 映射
// 原则: 每条规则有且仅有一个 DecisionCode
// ═══════════════════════════════════════

const CONTRADICTION_TO_DECISION = Object.freeze({

  // 学习×执行 → 建立执行系统（最高优先级，因为这是最常见的根本矛盾）
  LEARNING_EXECUTION_CONFLICT: {
    primary: 'BUILD_EXECUTION_SYSTEM',
    reason: '核心矛盾是学习能力强但执行弱，必须从建立执行系统开始',
  },

  // 野心×纪律 → 建立纪律
  AMBITION_DISCIPLINE_CONFLICT: {
    primary: 'BUILD_DISCIPLINE',
    reason: '野心和纪律之间的落差是最常见的失败模式',
  },

  // 速度×持续性 → 提升内容产出（从速度转为稳定产出）
  SPEED_CONSISTENCY_CONFLICT: {
    primary: 'IMPROVE_CONTENT_OUTPUT',
    reason: '执行力强但不够持续，需要从短跑转为马拉松',
  },

  // 思考×行动 → 减少决策疲劳
  THINKING_ACTION_CONFLICT: {
    primary: 'REDUCE_DECISION_FATIGUE',
    reason: '思考太多导致行动瘫痪，必须简化决策流程',
  },

  // 风险×回报 → 重建风险框架
  RISK_REWARD_CONFLICT: {
    primary: 'REBUILD_RISK_FRAMEWORK',
    reason: '风险评估失当导致行动受阻或过度冒险',
  },

  // 稳定×成长 → 构建AI工作流（用技术杠杆打破稳定陷阱）
  STABILITY_GROWTH_CONFLICT: {
    primary: 'BUILD_AI_WORKFLOW',
    reason: '稳定环境中需要技术杠杆突破成长瓶颈',
  },
})

// ═══════════════════════════════════════
// createDecisionOutput
// ═══════════════════════════════════════

function createDecision({ code, confidence, coreContradiction, opportunity }) {
  if (!code) throw new Error('Decision: code required')
  const def = DECISION_CATALOG[code]
  if (!def) {
    if (code === 'UNKNOWN') {
      return createFallbackDecision({ confidence, coreContradiction, opportunity })
    }
    throw new Error(`Unknown decision: "${code}"`)
  }
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error('Decision: confidence out of range')
  }
  if (!coreContradiction) throw new Error('Decision: coreContradiction required')
  // opportunity 允许为 null（回退场景无 conflict 时不产生 opportunity）

  return Object.freeze({
    primaryDecision: {
      code,
      title: DECISION_CATALOG[code].title,
      description: DECISION_CATALOG[code].description,
      category: DECISION_CATALOG[code].category,
      priority: 1,
      confidence: clamp(Math.round(confidence * 100) / 100, 0, 1),
      expectedCycleDays: DECISION_CATALOG[code].expectedCycleDays,
      basedOn: Object.freeze({
        coreContradiction,
        opportunity,
      }),
    },
  })
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

function createFallbackDecision({ confidence, coreContradiction, opportunity }) {
  return Object.freeze({
    primaryDecision: {
      code: 'UNKNOWN',
      title: '信息不足',
      description: '当前证据太少，无法确定唯一决策方向。建议继续收集更多行为数据。',
      category: 'UNKNOWN',
      priority: 1,
      confidence: clamp(Math.round((confidence || 0.15) * 100) / 100, 0, 1),
      expectedCycleDays: 90,
      basedOn: Object.freeze({ coreContradiction: coreContradiction || null, opportunity: opportunity || null }),
    },
  })
}

module.exports = { DECISION_CATALOG, CONTRADICTION_TO_DECISION, createDecision, createFallbackDecision }
