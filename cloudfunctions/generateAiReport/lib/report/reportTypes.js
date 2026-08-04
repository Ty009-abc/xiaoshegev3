/**
 * report/reportTypes.js — V4 Report Contract 类型常量
 *
 * 所有枚举值集中定义。禁止在 Mapper/Prompt 中自造名字。
 */

// ═══════════════════════════════════════════════════════════════
// Wealth Stage 固定枚举
// ═══════════════════════════════════════════════════════════════
const WEALTH_STAGES = [
  'SURVIVAL',
  'STABLE',
  'ACCUMULATION',
  'LEVERAGE',
  'SYSTEM',
  'FREEDOM',
]

// stage 判定规则: 从 overall score 映射
function deriveWealthStage(overallScore) {
  if (overallScore <= 20) return 'SURVIVAL'
  if (overallScore <= 40) return 'STABLE'
  if (overallScore <= 60) return 'ACCUMULATION'
  if (overallScore <= 75) return 'LEVERAGE'
  if (overallScore <= 90) return 'SYSTEM'
  return 'FREEDOM'
}

// ═══════════════════════════════════════════════════════════════
// Wealth Path 固定枚举 (7 项)
// ═══════════════════════════════════════════════════════════════
const WEALTH_PATHS = [
  'working',       // 打工晋升
  'sideBusiness',  // 副业
  'freelance',     // 自由职业/技术服务
  'investment',    // 投资/资产
  'content',       // 内容/IP
  'ai',            // AI 赋能
  'entrepreneur',  // 创业
]

// ═══════════════════════════════════════════════════════════════
// Emotion 枚举
// ═══════════════════════════════════════════════════════════════
const HEADLINE_EMOTIONS = [
  'warning',   // 严重警告
  'alert',     // 警惕
  'hopeful',   // 希望
  'confident', // 自信
  'neutral',   // 中性
]

// ═══════════════════════════════════════════════════════════════
// Severity 范围约束
// ═══════════════════════════════════════════════════════════════
const SEVERITY_RANGE = { min: 0, max: 100 }

// ═══════════════════════════════════════════════════════════════
// Report 13 个固定 section 名
// ═══════════════════════════════════════════════════════════════
const REPORT_SECTIONS = [
  'headline',
  'wealthStage',
  'fatalDiagnosis',
  'fatalRules',
  'advantageRules',
  'opportunityRules',
  'scoreCard',
  'wealthProbability',
  'wealthPath',
  'actionPlan',
  'stopDoing',
  'identityUpgrade',
  'finalStrike',
  // v6.5.2: 结构化语义字段
  'verdict',
  'contradiction',
  'potential',
  'decision',
  'primaryAction',
]

// ═══════════════════════════════════════════════════════════════
// 30-Day Plan 固定天数
// ═══════════════════════════════════════════════════════════════
const ACTION_PLAN_DAYS = ['day1', 'day3', 'day7', 'day15', 'day30']

// ═══════════════════════════════════════════════════════════════
// Identity 固定阶段
// ═══════════════════════════════════════════════════════════════
const IDENTITY_STAGES = [
  '打工者',
  '技能经营者',
  '生产效率者',
  '资产拥有者',
  '系统建设者',
]

module.exports = {
  WEALTH_STAGES,
  deriveWealthStage,
  WEALTH_PATHS,
  HEADLINE_EMOTIONS,
  SEVERITY_RANGE,
  REPORT_SECTIONS,
  ACTION_PLAN_DAYS,
  IDENTITY_STAGES,
}
