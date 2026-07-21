/**
 * core/turnaround-os/contracts/missionPlanContractV6.js
 *
 * V6 Mission Plan 数据契约（冻结）
 * 统一的任务计划输出结构
 *
 * @version 6.0.0
 * @status FROZEN — CHECKPOINT_4A
 */

const { VERSION, MISSION_PHASES, MISSION_CATEGORIES_V6, MISSION_CATEGORY_CODES, COST_LEVELS, RISK_LEVELS, DIFFICULTY_LEVELS } = require('../constants')
const { createMission } = require('../schemas/missionContractV6')

/**
 * createMissionTheme
 */
function createMissionTheme(overrides = {}) {
  return {
    title: '',
    strategicGoal: '',
    primaryLeverage: '',
    currentStage: '',
    primaryWrongGame: '',
    successDefinition: '',
    ...overrides,
  }
}

/**
 * createPlanPrinciple
 */
function createPlanPrinciple(overrides = {}) {
  return {
    principleId: '',
    title: '',
    reason: '',
    ...overrides,
  }
}

/**
 * createCheckpoint
 */
function createCheckpoint(overrides = {}) {
  return {
    description: '',
    criteria: [],
    minEvidenceRequired: '',
    ...overrides,
  }
}

/**
 * createPhasePlan
 */
function createPhasePlan(phase, overrides = {}) {
  return {
    objective: '',
    missions: [],
    checkpoint: createCheckpoint(),
    exitCriteria: [],
    failureResponse: [],
    ...overrides,
    phase,
  }
}

/**
 * createWeeklyRhythm
 */
function createWeeklyRhythm(overrides = {}) {
  return {
    executionDays: [],
    reviewDay: '',
    minimumWeeklyHours: 0,
    maximumWeeklyHours: 0,
    focusRule: '',
    stopRule: '',
    ...overrides,
  }
}

/**
 * createStrategicMetric
 */
function createStrategicMetric(overrides = {}) {
  return {
    metricId: '',
    name: '',
    purpose: '',
    targetType: 'BINARY',
    targetValue: '',
    measurementMethod: '',
    reviewPhase: '',
    ...overrides,
  }
}

/**
 * createDependency
 */
function createDependency(overrides = {}) {
  return {
    from: '',
    to: '',
    type: 'REQUIRED',
    reason: '',
    ...overrides,
  }
}

/**
 * createRejectedMission
 */
function createRejectedMission(overrides = {}) {
  return {
    missionType: '',
    title: '',
    rejectionReason: '',
    blockingFactors: [],
    reconsiderCondition: '',
    ...overrides,
  }
}

/**
 * createMissionPlan — 创建空 Mission Plan
 */
function createMissionPlan(overrides = {}) {
  return {
    version: VERSION,

    missionTheme: createMissionTheme(),

    planPrinciples: [],

    day7: createPhasePlan(MISSION_PHASES.DAY_7, {
      objective: '',
      missions: [],
    }),

    day30: createPhasePlan(MISSION_PHASES.DAY_30, {
      objective: '',
      missions: [],
    }),

    day90: createPhasePlan(MISSION_PHASES.DAY_90, {
      objective: '',
      missions: [],
    }),

    weeklyRhythm: createWeeklyRhythm(),

    strategicMetrics: [],

    dependencies: {
      missionGraph: [],
      blockedMissions: [],
      criticalPath: [],
      dependencyWarnings: [],
    },

    rejectedMissions: [],

    assumptions: [],

    limitations: [],

    confidence: 0,

    evidence: {
      ruleHits: [],
      sourceFields: [],
      strategyLinks: [],
      projectionLinks: [],
    },

    ...overrides,
  }
}

/**
 * normalizeMissionId — 生成确定性 missionId
 * 格式: MSN_D{phase}_{category}_{sequence}
 */
function normalizeMissionId(phase, category, sequence) {
  var code = MISSION_CATEGORY_CODES[category] || 'UNKN'
  var parts = [
    'MSN',
    phase.replace('DAY_', 'D'),
    code,
    String(sequence).padStart(2, '0'),
  ]
  return parts.join('_')
}

module.exports = {
  createMissionTheme,
  createPlanPrinciple,
  createCheckpoint,
  createPhasePlan,
  createWeeklyRhythm,
  createStrategicMetric,
  createDependency,
  createRejectedMission,
  createMissionPlan,
  normalizeMissionId,
}
