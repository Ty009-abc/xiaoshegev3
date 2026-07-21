/**
 * core/turnaround-os/validators/validateMissionContractV6.js
 *
 * V6 Mission Contract 轻量校验器
 * 仅校验结构完整性、枚举合法性、数值范围
 * 不实现业务规则校验（留给 CHECKPOINT_4D）
 *
 * @version 6.0.0
 * @status CHECKPOINT_4A
 */

const {
  VERSION,
  MISSION_PHASES,
  MISSION_CATEGORIES_V6,
  COST_LEVELS,
  RISK_LEVELS,
  DIFFICULTY_LEVELS,
} = require('../constants')

const { FALLBACK_TYPES } = require('../schemas/missionContractV6')

const CATEGORIES = Object.values(MISSION_CATEGORIES_V6)
const COSTS = Object.values(COST_LEVELS)
const RISKS = Object.values(RISK_LEVELS)
const DIFFICULTIES = Object.values(DIFFICULTY_LEVELS)

/**
 * validateMissionContractV6 — 校验单条 Mission
 * @param {Object} mission
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateMissionContractV6(mission) {
  const errors = []
  const warnings = []

  if (!mission || typeof mission !== 'object') {
    errors.push('Mission 为空或非对象')
    return { valid: false, errors, warnings }
  }

  // missionId 非空
  if (!mission.missionId || typeof mission.missionId !== 'string' || mission.missionId.trim() === '') {
    errors.push('missionId 缺失或为空')
  }

  // phase 枚举
  if (!Object.values(MISSION_PHASES).includes(mission.phase)) {
    errors.push(`phase 非法: ${mission.phase}`)
  }

  // category 枚举
  if (!CATEGORIES.includes(mission.category)) {
    errors.push(`category 非法: ${mission.category}`)
  }

  // estimatedCostLevel 枚举
  if (!COSTS.includes(mission.estimatedCostLevel)) {
    errors.push(`estimatedCostLevel 非法: ${mission.estimatedCostLevel}`)
  }

  // riskLevel 枚举
  if (!RISKS.includes(mission.riskLevel)) {
    errors.push(`riskLevel 非法: ${mission.riskLevel}`)
  }

  // difficulty 枚举
  if (!DIFFICULTIES.includes(mission.difficulty)) {
    errors.push(`difficulty 非法: ${mission.difficulty}`)
  }

  // priorityScore 范围
  if (typeof mission.priorityScore !== 'number' || mission.priorityScore < 0 || mission.priorityScore > 100) {
    errors.push(`priorityScore 超出范围 [0,100]: ${mission.priorityScore}`)
  }

  // confidence 范围
  if (typeof mission.confidence !== 'number' || mission.confidence < 0 || mission.confidence > 100) {
    errors.push(`confidence 超出范围 [0,100]: ${mission.confidence}`)
  }

  // estimatedMinutes 范围
  if (typeof mission.estimatedMinutes !== 'number' || mission.estimatedMinutes < 1 || mission.estimatedMinutes > 1440) {
    errors.push(`estimatedMinutes 超出范围 [1,1440]: ${mission.estimatedMinutes}`)
  }

  // 无 undefined / null 字段
  checkUndefinedOrNull(mission, '', errors)

  // fallback 校验
  if (mission.fallback && typeof mission.fallback === 'object') {
    var f = mission.fallback
    if (!f.type || !Object.values(FALLBACK_TYPES).includes(f.type)) {
      errors.push('fallback.type 非法: ' + (f.type || 'empty'))
    }
    if (typeof f.instruction !== 'string' || f.instruction.trim() === '') {
      warnings.push('fallback.instruction 为空')
    }
    if (f.type === FALLBACK_TYPES.ALTERNATE_MISSION && !f.targetMissionId && !f.targetCategory) {
      warnings.push('ALTERNATE_MISSION fallback 缺少 targetMissionId 或 targetCategory')
    }
  } else if (mission.fallback) {
    warnings.push('fallback 应为对象而非字符串（旧版兼容）')
  }

  // 禁止运行态字段
  var runtimeFields = ['status', 'progress', 'completedAt', 'startedAt', 'actualMinutes', 'executionLog']
  for (var i = 0; i < runtimeFields.length; i++) {
    if (mission[runtimeFields[i]] !== undefined) {
      errors.push('MissionDefinition 不应包含运行态字段: ' + runtimeFields[i])
    }
  }

  // title 非空
  if (!mission.title || mission.title.trim() === '') {
    warnings.push('title 为空')
  }

  // whyNow 非空
  if (!mission.whyNow || mission.whyNow.trim() === '') {
    warnings.push('whyNow 为空')
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * validateMissionPlanContractV6 — 校验 Mission Plan
 * @param {Object} plan
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateMissionPlanContractV6(plan) {
  const errors = []
  const warnings = []

  if (!plan || typeof plan !== 'object') {
    errors.push('Mission Plan 为空')
    return { valid: false, errors, warnings }
  }

  // version
  if (plan.version !== VERSION) {
    errors.push(`version 应为 ${VERSION}，实际: ${plan.version}`)
  }

  // missionTheme
  if (!plan.missionTheme || typeof plan.missionTheme !== 'object') {
    errors.push('missionTheme 缺失')
  } else {
    const mt = plan.missionTheme
    if (!mt.title || mt.title.trim() === '') warnings.push('missionTheme.title 为空')
    if (!mt.strategicGoal || mt.strategicGoal.trim() === '') warnings.push('missionTheme.strategicGoal 为空')
    if (!mt.primaryLeverage || mt.primaryLeverage.trim() === '') warnings.push('missionTheme.primaryLeverage 为空')
  }

  // planPrinciples
  if (!Array.isArray(plan.planPrinciples)) errors.push('planPrinciples 应为数组')

  // day7/day30/day90
  for (const phase of ['day7', 'day30', 'day90']) {
    const p = plan[phase]
    if (!p || typeof p !== 'object') {
      errors.push(`${phase} 阶段计划缺失`)
      continue
    }
    if (!Array.isArray(p.missions)) errors.push(`${phase}.missions 应为数组`)
    if (!Array.isArray(p.exitCriteria)) errors.push(`${phase}.exitCriteria 应为数组`)
    if (!Array.isArray(p.failureResponse)) errors.push(`${phase}.failureResponse 应为数组`)

    // 校验阶段内每条 Mission
    if (Array.isArray(p.missions)) {
      for (let i = 0; i < p.missions.length; i++) {
        const mResult = validateMissionContractV6(p.missions[i])
        if (!mResult.valid) {
          errors.push(`${phase}.missions[${i}]: ${mResult.errors.join('; ')}`)
        }
      }
    }
  }

  // weeklyRhythm
  if (!plan.weeklyRhythm || typeof plan.weeklyRhythm !== 'object') {
    errors.push('weeklyRhythm 缺失')
  }

  // dependencies
  if (!plan.dependencies || typeof plan.dependencies !== 'object') {
    errors.push('dependencies 应为对象')
  } else {
    if (!Array.isArray(plan.dependencies.missionGraph)) errors.push('dependencies.missionGraph 应为数组')
    if (!Array.isArray(plan.dependencies.blockedMissions)) errors.push('dependencies.blockedMissions 应为数组')
    if (!Array.isArray(plan.dependencies.criticalPath)) errors.push('dependencies.criticalPath 应为数组')
    if (!Array.isArray(plan.dependencies.dependencyWarnings)) errors.push('dependencies.dependencyWarnings 应为数组')
  }

  // confidence 范围
  if (typeof plan.confidence !== 'number' || plan.confidence < 0 || plan.confidence > 100) {
    errors.push(`confidence 超出范围 [0,100]: ${plan.confidence}`)
  }

  // evidence
  if (!plan.evidence || typeof plan.evidence !== 'object') {
    errors.push('evidence 应为对象')
  } else {
    if (!Array.isArray(plan.evidence.ruleHits)) errors.push('evidence.ruleHits 应为数组')
    if (!Array.isArray(plan.evidence.sourceFields)) errors.push('evidence.sourceFields 应为数组')
    if (!Array.isArray(plan.evidence.strategyLinks)) errors.push('evidence.strategyLinks 应为数组')
    if (!Array.isArray(plan.evidence.projectionLinks)) errors.push('evidence.projectionLinks 应为数组')
  }

  // 无 undefined / null
  checkUndefinedOrNull(plan, '', errors)

  // 拒绝额外顶层字段
  const ALLOWED_KEYS = [
    'version', 'engineVersion', 'schemaVersion', 'missionTheme', 'planPrinciples',
    'day7', 'day30', 'day90', 'weeklyRhythm', 'strategicMetrics',
    'dependencies', 'rejectedMissions', 'assumptions', 'limitations',
    'confidence', 'evidence',
  ]
  for (const key of Object.keys(plan)) {
    if (!ALLOWED_KEYS.includes(key)) {
      errors.push('不允许的字段: ' + key)
    }
  }

  // fallback 循环依赖检测
  var allMsns = collectAllMissions(plan)
  checkFallbackCycles(allMsns, errors)

  return { valid: errors.length === 0, errors, warnings }
}

function collectAllMissions(plan) {
  var result = []
  for (var i = 0; i < (plan.day7 && plan.day7.missions ? plan.day7.missions.length : 0); i++) {
    result.push(plan.day7.missions[i])
  }
  for (var i = 0; i < (plan.day30 && plan.day30.missions ? plan.day30.missions.length : 0); i++) {
    result.push(plan.day30.missions[i])
  }
  for (var i = 0; i < (plan.day90 && plan.day90.missions ? plan.day90.missions.length : 0); i++) {
    result.push(plan.day90.missions[i])
  }
  return result
}

function checkFallbackCycles(missions, errors) {
  var idSet = {}
  for (var i = 0; i < missions.length; i++) {
    idSet[missions[i].missionId] = true
  }
  for (var i = 0; i < missions.length; i++) {
    var m = missions[i]
    var fb = m.fallback
    if (fb && fb.type && fb.targetMissionId) {
      if (!idSet[fb.targetMissionId]) {
        errors.push('fallback 目标 missionId 不存在: ' + fb.targetMissionId)
      }
      if (fb.targetMissionId === m.missionId) {
        errors.push('fallback 不能指向自身: ' + m.missionId)
      }
      // 简单可达性检测（避免直接循环）
      var targetMsn = null
      for (var j = 0; j < missions.length; j++) {
        if (missions[j].missionId === fb.targetMissionId) { targetMsn = missions[j]; break }
      }
      if (targetMsn && targetMsn.fallback && targetMsn.fallback.targetMissionId === m.missionId) {
        errors.push('fallback 循环依赖: ' + m.missionId + ' <-> ' + fb.targetMissionId)
      }
    }
  }
}

function checkUndefinedOrNull(obj, path, errors) {
  // Skip null for optional fallback fields (targetMissionId/targetCategory)
  var isFallbackOptional = path.indexOf('fallback.targetMissionId') >= 0 || path.indexOf('fallback.targetCategory') >= 0
  if (obj === undefined) {
    errors.push(path + ' 为 undefined')
    return
  }
  if (obj === null && !isFallbackOptional) {
    errors.push(path + ' 为 null')
    return
  }
  if (obj === null) return  // skip null for fallback optional fields
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      checkUndefinedOrNull(obj[i], `${path}[${i}]`, errors)
    }
    return
  }
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      checkUndefinedOrNull(obj[key], path ? `${path}.${key}` : key, errors)
    }
  }
}

module.exports = {
  validateMissionContractV6,
  validateMissionPlanContractV6,
}
