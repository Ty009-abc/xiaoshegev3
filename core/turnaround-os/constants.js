/**
 * core/turnaround-os/constants.js — V6 Constants & Enums
 *
 * 所有枚举、阶段、游戏、杠杆类型集中管理
 * 不允许魔法字符串出现在引擎代码中
 *
 * @version 6.0.0
 */

// ═══════════════════════════════════════
// 五大翻身阶段
// ═══════════════════════════════════════

const WEALTH_STAGES = {
  SURVIVAL: 'SURVIVAL',
  STABILITY: 'STABILITY',
  LEVERAGE: 'LEVERAGE',
  SYSTEM: 'SYSTEM',
  COMPOUNDING: 'COMPOUNDING',
}

const WEALTH_STAGE_LABELS = {
  SURVIVAL: '生存修复期',
  STABILITY: '现金流稳定期',
  LEVERAGE: '杠杆建立期',
  SYSTEM: '个人系统建设期',
  COMPOUNDING: '复利扩张期',
}

// ═══════════════════════════════════════
// 阶段流转顺序
// ═══════════════════════════════════════

const STAGE_ORDER = [
  WEALTH_STAGES.SURVIVAL,
  WEALTH_STAGES.STABILITY,
  WEALTH_STAGES.LEVERAGE,
  WEALTH_STAGES.SYSTEM,
  WEALTH_STAGES.COMPOUNDING,
]

// ═══════════════════════════════════════
// 错误游戏类型
// ═══════════════════════════════════════

const WRONG_GAMES = {
  SELLING_TIME: 'SELLING_TIME',
  SINGLE_INCOME: 'SINGLE_INCOME',
  OPPORTUNITY_CHASING: 'OPPORTUNITY_CHASING',
  SKILL_WITHOUT_DISTRIBUTION: 'SKILL_WITHOUT_DISTRIBUTION',
  CONTENT_WITHOUT_MONETIZATION: 'CONTENT_WITHOUT_MONETIZATION',
  BUSINESS_WITHOUT_SYSTEM: 'BUSINESS_WITHOUT_SYSTEM',
}

const WRONG_GAME_LABELS = {
  SELLING_TIME: '只出售时间',
  SINGLE_INCOME: '单一收入依赖',
  OPPORTUNITY_CHASING: '不断追逐机会',
  SKILL_WITHOUT_DISTRIBUTION: '有技能但没有流量与分发',
  CONTENT_WITHOUT_MONETIZATION: '有内容但没有商业闭环',
  BUSINESS_WITHOUT_SYSTEM: '有生意但没有可复制系统',
}

// ═══════════════════════════════════════
// 杠杆类型
// ═══════════════════════════════════════

const LEVERAGE_TYPES = {
  AI_PRODUCTIVITY: 'AI_PRODUCTIVITY',
  CONTENT_DISTRIBUTION: 'CONTENT_DISTRIBUTION',
  SALES_CONVERSION: 'SALES_CONVERSION',
  KNOWLEDGE_PRODUCT: 'KNOWLEDGE_PRODUCT',
  SERVICE_PRODUCTIZATION: 'SERVICE_PRODUCTIZATION',
  AUTOMATION_SYSTEM: 'AUTOMATION_SYSTEM',
  TEAM_CAPITAL: 'TEAM_CAPITAL',
  ASSET_COMPOUNDING: 'ASSET_COMPOUNDING',
}

const LEVERAGE_LABELS = {
  AI_PRODUCTIVITY: 'AI效率杠杆',
  CONTENT_DISTRIBUTION: '内容与流量杠杆',
  SALES_CONVERSION: '销售成交杠杆',
  KNOWLEDGE_PRODUCT: '知识产品杠杆',
  SERVICE_PRODUCTIZATION: '服务产品化杠杆',
  AUTOMATION_SYSTEM: '自动化系统杠杆',
  TEAM_CAPITAL: '团队与资本杠杆',
  ASSET_COMPOUNDING: '资产复利杠杆',
}

// ═══════════════════════════════════════
// 职业类型枚举
// ═══════════════════════════════════════

const OCCUPATION_TYPES = {
  EMPLOYEE: 'employee',
  FREELANCER: 'freelancer',
  CREATOR: 'creator',
  BUSINESS_OWNER: 'business_owner',
  PROFESSIONAL: 'professional',
  OTHER: 'other',
}

// ═══════════════════════════════════════
// 阶段判断阈值
// ═══════════════════════════════════════

const STAGE_THRESHOLDS = {
  SURVIVAL_TO_STABILITY: {
    minSafetyMonths: 3,
    maxDebtToIncomeRatio: 0.5,
    minIncomeStability: 30,
  },
  STABILITY_TO_LEVERAGE: {
    minSafetyMonths: 6,
    minDisposableHoursPerWeek: 10,
    minExecution: 40,
    hasSecondaryIncome: true,
  },
  LEVERAGE_TO_SYSTEM: {
    minReusableAssets: 1,
    minSystemThinking: 50,
    minDisposableHoursPerWeek: 15,
  },
  SYSTEM_TO_COMPOUNDING: {
    minReusableAssets: 3,
    hasTeam: true,
    minSystemThinking: 70,
  },
}

// ═══════════════════════════════════════
// 概率模型标记
// ═══════════════════════════════════════

const PROBABILITY_TYPE = 'strategy_model_estimate'

// ═══════════════════════════════════════
// 评分上下限
// ═══════════════════════════════════════

const SCORE_RANGE = {
  MIN: 0,
  MAX: 100,
}

// ═══════════════════════════════════════
// 版本
// ═══════════════════════════════════════

const VERSION = '6.0'

// ═══════════════════════════════════════
// 错误码
// ═══════════════════════════════════════

const ERROR_CODES = {
  MISSING_INPUT: 'V6_MISSING_INPUT',
  INVALID_SCHEMA: 'V6_INVALID_SCHEMA',
  V4_CONVERSION_FAILED: 'V6_V4_CONVERSION_FAILED',
  SCOPE_VIOLATION: 'V6_SCOPE_VIOLATION',
  INTERNAL_ERROR: 'V6_INTERNAL_ERROR',
}

// ═══════════════════════════════════════
// Mission Phase 枚举
// ═══════════════════════════════════════

const MISSION_PHASES = {
  DAY_7: 'DAY_7',
  DAY_30: 'DAY_30',
  DAY_90: 'DAY_90',
}

const MISSION_PHASE_LABELS = {
  DAY_7: '7天验证计划',
  DAY_30: '30天建设计划',
  DAY_90: '90天战略计划',
}

// ═══════════════════════════════════════
// Mission Category 枚举（V6 扩展版）
// ═══════════════════════════════════════

const MISSION_CATEGORIES_V6 = {
  SAFETY_REPAIR: 'SAFETY_REPAIR',
  TIME_AUDIT: 'TIME_AUDIT',
  SKILL_INVENTORY: 'SKILL_INVENTORY',
  CUSTOMER_RESEARCH: 'CUSTOMER_RESEARCH',
  VALUE_PROPOSITION: 'VALUE_PROPOSITION',
  MINIMUM_OFFER: 'MINIMUM_OFFER',
  DISTRIBUTION_TEST: 'DISTRIBUTION_TEST',
  SALES_VALIDATION: 'SALES_VALIDATION',
  CONTENT_SYSTEM: 'CONTENT_SYSTEM',
  SERVICE_PRODUCTIZATION: 'SERVICE_PRODUCTIZATION',
  AI_WORKFLOW: 'AI_WORKFLOW',
  AUTOMATION_BUILD: 'AUTOMATION_BUILD',
  SOP_BUILD: 'SOP_BUILD',
  DELEGATION_TEST: 'DELEGATION_TEST',
  ASSET_BUILD: 'ASSET_BUILD',
  SECOND_INCOME_TEST: 'SECOND_INCOME_TEST',
  REVIEW_AND_DECIDE: 'REVIEW_AND_DECIDE',
}

const MISSION_CATEGORY_LABELS_V6 = {
  SAFETY_REPAIR: '现金流安全修复',
  TIME_AUDIT: '时间结构审计',
  SKILL_INVENTORY: '技能资产盘点',
  CUSTOMER_RESEARCH: '客户需求验证',
  VALUE_PROPOSITION: '价值主张设计',
  MINIMUM_OFFER: '最小产品/服务设计',
  DISTRIBUTION_TEST: '分发渠道测试',
  SALES_VALIDATION: '成交验证',
  CONTENT_SYSTEM: '内容系统建立',
  SERVICE_PRODUCTIZATION: '服务产品化',
  AI_WORKFLOW: 'AI工作流建设',
  AUTOMATION_BUILD: '自动化系统建设',
  SOP_BUILD: 'SOP建设',
  DELEGATION_TEST: '授权测试',
  ASSET_BUILD: '可复制资产建设',
  SECOND_INCOME_TEST: '第二收入验证',
  REVIEW_AND_DECIDE: '复盘与战略决策',
}

// ═══════════════════════════════════════
// Mission Category → 4-char 固定编码
// ═══════════════════════════════════════

const MISSION_CATEGORY_CODES = {
  SAFETY_REPAIR: 'SAFE',
  TIME_AUDIT: 'TIME',
  SKILL_INVENTORY: 'SKIL',
  CUSTOMER_RESEARCH: 'CUST',
  VALUE_PROPOSITION: 'VALU',
  MINIMUM_OFFER: 'MINI',
  DISTRIBUTION_TEST: 'DIST',
  SALES_VALIDATION: 'SALE',
  CONTENT_SYSTEM: 'CONT',
  SERVICE_PRODUCTIZATION: 'SERV',
  AI_WORKFLOW: 'AIWF',
  AUTOMATION_BUILD: 'AUTO',
  SOP_BUILD: 'SOPB',
  DELEGATION_TEST: 'DELE',
  ASSET_BUILD: 'ASSE',
  SECOND_INCOME_TEST: 'SECO',
  REVIEW_AND_DECIDE: 'REVI',
}

// ═══════════════════════════════════════
// Mission 成本/风险/难度级别
// ═══════════════════════════════════════

const COST_LEVELS = { NONE: 'NONE', LOW: 'LOW', MEDIUM: 'MEDIUM' }
const RISK_LEVELS = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' }
const DIFFICULTY_LEVELS = { EASY: 'EASY', MODERATE: 'MODERATE', HARD: 'HARD' }

// ═══════════════════════════════════════
// 翻身准备度阈值
// ═══════════════════════════════════════

const READINESS_THRESHOLDS = {
  VERY_HIGH: 70,
  HIGH: 55,
  MODERATE: 40,
  LOW: 25,
}

// ═══════════════════════════════════════
// 每周时间预算（按阶段）
// ═══════════════════════════════════════

const WEEKLY_TIME_BUDGET_MINUTES = {
  SURVIVAL: { min: 120, max: 300 },
  STABILITY: { min: 180, max: 420 },
  LEVERAGE: { min: 300, max: 600 },
  SYSTEM: { min: 300, max: 720 },
  COMPOUNDING: { min: 180, max: 600 },
}

// ═══════════════════════════════════════
// Review Decision 枚举
// ═══════════════════════════════════════

const REVIEW_DECISIONS = {
  CONTINUE: 'CONTINUE',
  ADJUST: 'ADJUST',
  STOP: 'STOP',
  REPEAT_VALIDATION: 'REPEAT_VALIDATION',
}

// ═══════════════════════════════════════
// 禁止任务规则
// ═══════════════════════════════════════

const FORBIDDEN_MISSIONS = {
  RESIGN: { keyword: '辞职', reason: '辞职不是翻身的第一步', blockingStage: 'SURVIVAL' },
  BORROW: { keyword: '借款', reason: '当前阶段增加负债风险', blockingStage: 'ALL' },
  COMPANY: { keyword: '注册公司', reason: '先验证需求再考虑公司结构', blockingStage: 'SURVIVAL' },
  COURSE: { keyword: '购买课程', reason: '当前阻塞因素不是知识不足', blockingStage: 'SURVIVAL' },
  FULL_PRODUCT: { keyword: '完整产品', reason: '先最小验证再逐步建设', blockingStage: 'ALL' },
  FULL_MEDIA: { keyword: '全职自媒体', reason: '先兼职验证再考虑全职', blockingStage: 'SURVIVAL' },
  STOCK: { keyword: '具体股票', reason: '翻身系统不推荐任何具体股票', blockingStage: 'ALL' },
  HIRE_BEFORE_SOP: { keyword: '招聘', reason: 'SOP未验证前不应扩招', blockingStage: 'ALL' },
  HOARDING: { keyword: '囤货', reason: '先验证需求再考虑库存', blockingStage: 'SURVIVAL' },
  HEAVY_ASSET: { keyword: '重资产', reason: '不推荐重资产投入', blockingStage: 'SURVIVAL' },
  GUARANTEED_RETURN: { keyword: '保证收益', reason: '不存在保证收益的产品', blockingStage: 'ALL' },
}

module.exports = {
  WEALTH_STAGES,
  WEALTH_STAGE_LABELS,
  STAGE_ORDER,
  WRONG_GAMES,
  WRONG_GAME_LABELS,
  LEVERAGE_TYPES,
  LEVERAGE_LABELS,
  OCCUPATION_TYPES,
  STAGE_THRESHOLDS,
  PROBABILITY_TYPE,
  SCORE_RANGE,
  VERSION,
  ERROR_CODES,
  MISSION_PHASES,
  MISSION_PHASE_LABELS,
  MISSION_CATEGORIES_V6,
  MISSION_CATEGORY_LABELS_V6,
  MISSION_CATEGORY_CODES,
  COST_LEVELS,
  RISK_LEVELS,
  DIFFICULTY_LEVELS,
  READINESS_THRESHOLDS,
  WEEKLY_TIME_BUDGET_MINUTES,
  REVIEW_DECISIONS,
  FORBIDDEN_MISSIONS,
}
