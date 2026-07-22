/**
 * core/turnaround-intelligence/contracts/tags.js
 *
 * CP6 统一标签枚举体系 (Tag Taxonomy)
 *
 * 所有 Engine 必须使用同一套 Tag，禁止自行发明。
 * 标签体系覆盖行为、财富、心理三个维度。
 *
 * @version 6.0.0
 * @checkpoint CP6-A
 */

// ═══════════════════════════════════════
// 行为标签 (BEHAVIOR)
// ═══════════════════════════════════════

const BEHAVIOR_TAGS = {
  ACTION_DELAY: 'ACTION_DELAY',             // 行动拖延
  ACTION_FAST: 'ACTION_FAST',               // 行动迅速
  OVERTHINKING: 'OVERTHINKING',             // 过度思考/决策瘫痪
  LEARNING: 'LEARNING',                     // 学习/信息输入
  DISCIPLINE: 'DISCIPLINE',                 // 自律/执行力
  EMOTION_DRIVEN: 'EMOTION_DRIVEN',         // 情绪驱动（非理性决策）
  CONSUMPTION_PATTERN: 'CONSUMPTION_PATTERN', // 消费模式
  LONG_TERM_ORIENTED: 'LONG_TERM_ORIENTED', // 长期导向
  SHORT_TERM_ORIENTED: 'SHORT_TERM_ORIENTED', // 短期导向
  PERSISTENCE: 'PERSISTENCE',               // 持续性
  INCONSISTENCY: 'INCONSISTENCY',           // 不一致/反复
  EXECUTION_WEAK: 'EXECUTION_WEAK',         // 执行力不足
  EXECUTION_STRONG: 'EXECUTION_STRONG',     // 执行力强
}

const BEHAVIOR_TAG_LABELS = {
  ACTION_DELAY: '行动拖延',
  ACTION_FAST: '行动迅速',
  OVERTHINKING: '过度思考',
  LEARNING: '学习吸收',
  DISCIPLINE: '自律力',
  EMOTION_DRIVEN: '情绪驱动',
  CONSUMPTION_PATTERN: '消费模式',
  LONG_TERM_ORIENTED: '长期导向',
  SHORT_TERM_ORIENTED: '短期导向',
  PERSISTENCE: '持续性',
  INCONSISTENCY: '不一致性',
  EXECUTION_WEAK: '执行力不足',
  EXECUTION_STRONG: '执行力强',
}

// ═══════════════════════════════════════
// 财富标签 (WEALTH)
// ═══════════════════════════════════════

const WEALTH_TAGS = {
  HIGH_INCOME: 'HIGH_INCOME',               // 高收入
  LOW_INCOME: 'LOW_INCOME',                 // 低收入
  SINGLE_INCOME: 'SINGLE_INCOME',           // 单一收入来源
  MULTI_INCOME: 'MULTI_INCOME',             // 多收入来源
  NO_ASSET: 'NO_ASSET',                     // 无资产积累
  HAS_ASSET: 'HAS_ASSET',                   // 有资产积累
  INVESTMENT_ACTIVE: 'INVESTMENT_ACTIVE',   // 主动投资
  INVESTMENT_PASSIVE: 'INVESTMENT_PASSIVE', // 被动投资
  DEBT_PRESSURE: 'DEBT_PRESSURE',           // 负债压力
  FINANCIAL_BUFFER: 'FINANCIAL_BUFFER',     // 经济缓冲
  INCOME_UNSTABLE: 'INCOME_UNSTABLE',       // 收入不稳定
  INCOME_STABLE: 'INCOME_STABLE',           // 收入稳定
}

const WEALTH_TAG_LABELS = {
  HIGH_INCOME: '高收入',
  LOW_INCOME: '低收入',
  SINGLE_INCOME: '单一收入来源',
  MULTI_INCOME: '多收入来源',
  NO_ASSET: '无资产积累',
  HAS_ASSET: '有资产积累',
  INVESTMENT_ACTIVE: '主动投资',
  INVESTMENT_PASSIVE: '被动投资',
  DEBT_PRESSURE: '负债压力',
  FINANCIAL_BUFFER: '经济缓冲',
  INCOME_UNSTABLE: '收入不稳定',
  INCOME_STABLE: '收入稳定',
}

// ═══════════════════════════════════════
// 心理标签 (PSYCHOLOGY)
// ═══════════════════════════════════════

const PSYCHOLOGY_TAGS = {
  RISK_AVOID: 'RISK_AVOID',                 // 风险规避
  RISK_SEEK: 'RISK_SEEK',                   // 风险偏好
  SELF_DOUBT: 'SELF_DOUBT',                 // 自我怀疑/低自我效能感
  CONFIDENCE: 'CONFIDENCE',                 // 自信
  STABILITY_SEEKING: 'STABILITY_SEEKING',   // 稳定寻求
  GROWTH_MINDSET: 'GROWTH_MINDSET',         // 成长心态
  FIXED_MINDSET: 'FIXED_MINDSET',           // 固定心态
  ANXIETY_HIGH: 'ANXIETY_HIGH',             // 高焦虑
  ANXIETY_LOW: 'ANXIETY_LOW',               // 低焦虑
  EXTERNAL_LOCUS: 'EXTERNAL_LOCUS',         // 外部归因
  INTERNAL_LOCUS: 'INTERNAL_LOCUS',         // 内部归因
  RESILIENCE_HIGH: 'RESILIENCE_HIGH',       // 高适应力
  RESILIENCE_LOW: 'RESILIENCE_LOW',         // 低适应力
}

const PSYCHOLOGY_TAG_LABELS = {
  RISK_AVOID: '风险规避',
  RISK_SEEK: '风险偏好',
  SELF_DOUBT: '自我怀疑',
  CONFIDENCE: '自信',
  STABILITY_SEEKING: '稳定寻求',
  GROWTH_MINDSET: '成长心态',
  FIXED_MINDSET: '固定心态',
  ANXIETY_HIGH: '高焦虑',
  ANXIETY_LOW: '低焦虑',
  EXTERNAL_LOCUS: '外部归因',
  INTERNAL_LOCUS: '内部归因',
  RESILIENCE_HIGH: '高适应力',
  RESILIENCE_LOW: '低适应力',
}

// ═══════════════════════════════════════
// 模式标签 (PATTERN) — 跨维度复合标签
// ═══════════════════════════════════════

const PATTERN_TAGS = {
  EMOTION_INTERRUPTS_COMPOUNDING: 'EMOTION_INTERRUPTS_COMPOUNDING', // 情绪打断积累
  URGE_TO_ESCAPE: 'URGE_TO_ESCAPE',           // 逃避驱动
  ANALYSIS_PARALYSIS: 'ANALYSIS_PARALYSIS',   // 分析导致的瘫痪
  OVERWHELM_AVOIDANCE: 'OVERWHELM_AVOIDANCE', // 不知所措导致的回避
  SHINY_OBJECT_SYNDROME: 'SHINY_OBJECT_SYNDROME', // 追逐新事物
  SURVIVAL_MODE: 'SURVIVAL_MODE',             // 生存模式限制
  PERFECTIONISM_BLOCK: 'PERFECTIONISM_BLOCK', // 完美主义阻塞
  ISOLATED_WORKER: 'ISOLATED_WORKER',         // 孤军奋战
  SKILL_WITHOUT_LEVERAGE: 'SKILL_WITHOUT_LEVERAGE', // 有技能无杠杆
}

const PATTERN_TAG_LABELS = {
  EMOTION_INTERRUPTS_COMPOUNDING: '情绪打断积累',
  URGE_TO_ESCAPE: '逃避驱动',
  ANALYSIS_PARALYSIS: '分析瘫痪',
  OVERWHELM_AVOIDANCE: '不知所措回避',
  SHINY_OBJECT_SYNDROME: '新事物追逐',
  SURVIVAL_MODE: '生存模式限制',
  PERFECTIONISM_BLOCK: '完美主义阻塞',
  ISOLATED_WORKER: '孤军奋战',
  SKILL_WITHOUT_LEVERAGE: '有技能无杠杆',
}

// ═══════════════════════════════════════
// 反转信号标签 (REVERSAL)
// ═══════════════════════════════════════

const REVERSAL_TAGS = {
  STARTING_NOW: 'STARTING_NOW',               // 现在开始
  CONTROLLABLE: 'CONTROLLABLE',               // 可控因素
  LOW_BARRIER: 'LOW_BARRIER',                 // 低门槛
  HIGH_POTENTIAL: 'HIGH_POTENTIAL',           // 高潜力
  REVERSIBLE: 'REVERSIBLE',                   // 可逆
  PROGRESSIVE: 'PROGRESSIVE',                 // 渐进式可改
  ENVIRONMENT_DEPENDENT: 'ENVIRONMENT_DEPENDENT', // 环境依赖
  DEEP_ROOTED: 'DEEP_ROOTED',                 // 根深蒂固
}

const REVERSAL_TAG_LABELS = {
  STARTING_NOW: '现在开始',
  CONTROLLABLE: '可控因素',
  LOW_BARRIER: '低门槛',
  HIGH_POTENTIAL: '高潜力',
  REVERSIBLE: '可逆',
  PROGRESSIVE: '渐进式可改',
  ENVIRONMENT_DEPENDENT: '环境依赖',
  DEEP_ROOTED: '根深蒂固',
}

// ═══════════════════════════════════════
// 全部标签集合
// ═══════════════════════════════════════

const ALL_TAGS = new Set([
  ...Object.values(BEHAVIOR_TAGS),
  ...Object.values(WEALTH_TAGS),
  ...Object.values(PSYCHOLOGY_TAGS),
  ...Object.values(PATTERN_TAGS),
  ...Object.values(REVERSAL_TAGS),
])

const ALL_TAG_LABELS = {
  ...BEHAVIOR_TAG_LABELS,
  ...WEALTH_TAG_LABELS,
  ...PSYCHOLOGY_TAG_LABELS,
  ...PATTERN_TAG_LABELS,
  ...REVERSAL_TAG_LABELS,
}

Object.freeze(ALL_TAGS)
Object.freeze(ALL_TAG_LABELS)

module.exports = {
  BEHAVIOR_TAGS,
  BEHAVIOR_TAG_LABELS,
  WEALTH_TAGS,
  WEALTH_TAG_LABELS,
  PSYCHOLOGY_TAGS,
  PSYCHOLOGY_TAG_LABELS,
  PATTERN_TAGS,
  PATTERN_TAG_LABELS,
  REVERSAL_TAGS,
  REVERSAL_TAG_LABELS,
  ALL_TAGS,
  ALL_TAG_LABELS,
}
