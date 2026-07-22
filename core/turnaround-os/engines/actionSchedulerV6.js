/**
 * core/turnaround-os/engines/actionSchedulerV6.js
 *
 * V6 Action Scheduler — 时间/风险/成本感知调度
 *
 * 将 MissionDefinition 列表拆解为每日 Action，考虑：
 *   - 用户每周时间预算
 *   - Mission 预计耗时
 *   - Mission 优先级
 *   - 任务依赖
 *   - 7d/30d/90d 阶段边界
 *   - 成本限制
 *   - 风险限制
 *   - 用户能力与焦虑水平
 *
 * 纯规则引擎，无 AI/Date/Random/DB/Payment。
 *
 * @version 6.0.0
 * @status CHECKPOINT_5
 */

var C = require('../constants')
var { createActionDefinition, makeActionId } = require('../schemas/actionContractV6')
var { createDailySlot } = require('../contracts/actionPlanContractV6')

var SURVIVAL = C.WEALTH_STAGES.SURVIVAL

/**
 * scheduleActions — 把 Mission 列表拆成 Action 并按天安排
 *
 * @param {Array}  missions       — MissionDefinition[]
 * @param {Object} profile        — identityEngine output
 * @param {Object} strategy       — turnaroundEngine output
 * @param {Object} projection     — destinyProjectionEngine output
 * @returns {{ actions: Array, dailySchedule: Object, warnings: Array }}
 */
function scheduleActions(missions, profile, strategy, projection) {
  var stage = (profile.wealthStage || SURVIVAL).toUpperCase()
  var caps = profile.capabilities || {}
  var psych = profile.psychology || {}
  var reality = profile.reality || {}
  var availableHours = reality.availableHoursPerWeek || 5
  var anxiety = psych.anxiety || 50
  var execution = caps.execution || 50

  // 时间预算（分钟/天）
  var budget = getBudget(stage, availableHours)
  var maxDailyMinutes = budget.maxDailyMinutes
  var maxSingleAction = budget.maxSingleActionMinutes

  // 拆 mission → actions
  var actions = []
  var seqGen = makeSeqGenerator()
  for (var i = 0; i < missions.length; i++) {
    var m = missions[i]
    var chunked = chunkMission(m, maxSingleAction, stage, anxiety, execution)
    for (var j = 0; j < chunked.length; j++) {
      chunked[j].sequence = seqGen(m.phase)
      actions.push(createActionDefinition(chunked[j]))
    }
  }

  // 按天安排
  var dailySchedule = {}
  var warnings = []
  var dayBounds = getPhaseBounds()
  var currentDay = dayBounds.DAY_7.start
  var phaseActives = { DAY_7: [], DAY_30: [], DAY_90: [] }

  // 分组按 phase
  for (var k = 0; k < actions.length; k++) {
    var a = actions[k]
    phaseActives[a.phase] = phaseActives[a.phase] || []
    phaseActives[a.phase].push(a)
  }

  // 每个 phase 顺序安排
  var phases = ['DAY_7', 'DAY_30', 'DAY_90']
  for (var p = 0; p < phases.length; p++) {
    var ph = phases[p]
    var phaseActions = phaseActives[ph] || []
    var bnd = dayBounds[ph]
    var day = bnd.start

    for (var q = 0; q < phaseActions.length; q++) {
      var act = phaseActions[q]
      var mins = act.estimatedMinutes

      // 检查每日容量
      if (day > bnd.end) {
        warnings.push('Phase ' + ph + ' overflow: action ' + act.actionId + ' scheduled beyond boundary')
        day = bnd.end
      }

      // 创建/获取当天 slot
      var key = 'd' + day
      if (!dailySchedule[key]) {
        dailySchedule[key] = createDailySlot(day, { theme: bnd.theme })
      }

      var slot = dailySchedule[key]

      // 如果当天容量已满，推进到下一天
      if (slot.estimatedTotalMinutes + mins > maxDailyMinutes && slot.actionIds.length > 0) {
        day++
        if (day > bnd.end) day = bnd.end
        key = 'd' + day
        if (!dailySchedule[key]) {
          dailySchedule[key] = createDailySlot(day, { theme: bnd.theme })
        }
        slot = dailySchedule[key]
      }

      // 分配
      act.scheduledDay = day
      slot.actionIds.push(act.actionId)
      slot.estimatedTotalMinutes += mins
    }

    // 推进到下个 phase 起始日
    day = bnd.end + 1
  }

  return { actions: actions, dailySchedule: dailySchedule, warnings: warnings }
}

// ═══════════════════════════════════════
// 时间预算计算
// ═══════════════════════════════════════

function getBudget(stage, availableHours) {
  var weeklyBudget = C.WEEKLY_TIME_BUDGET_MINUTES[stage]
  if (!weeklyBudget) weeklyBudget = { min: 120, max: 300 }

  // 用户实际可用时间覆盖
  var userWeeklyMax = availableHours * 60
  var effectiveMax = Math.min(weeklyBudget.max, userWeeklyMax)

  // 每日预算
  var dailyWorkDays = 5  // 每周5个工作日
  var maxDailyMinutes = Math.round(effectiveMax / dailyWorkDays)
  var maxSingleActionMinutes = Math.min(60, Math.round(maxDailyMinutes * 0.6))

  return {
    weeklyMin: weeklyBudget.min,
    weeklyMax: effectiveMax,
    maxDailyMinutes: maxDailyMinutes,
    maxSingleActionMinutes: maxSingleActionMinutes,
  }
}

// ═══════════════════════════════════════
// Phase 边界
// ═══════════════════════════════════════

function getPhaseBounds() {
  return {
    DAY_7:  { start: 1,  end: 7,  theme: '验证方向' },
    DAY_30: { start: 8,  end: 30, theme: '建设结构' },
    DAY_90: { start: 31, end: 90, theme: '最小系统' },
  }
}

// ═══════════════════════════════════════
// Mission → Actions 拆解
// ═══════════════════════════════════════

function chunkMission(mission, maxSingleActionMinutes, stage, anxiety, execution) {
  var total = mission.estimatedMinutes || 30
  var maxChunk = maxSingleActionMinutes

  // 高焦虑 → 更小的块（15-30分钟）
  if (anxiety > 70) maxChunk = Math.min(maxChunk, 30)
  if (anxiety > 85) maxChunk = Math.min(maxChunk, 20)

  // 低执行能力 → 更小的块
  if (execution < 30) maxChunk = Math.min(maxChunk, 25)

  var chunks = []
  var remaining = total
  var chunkIdx = 1
  var totalChunks = Math.ceil(total / maxChunk)

  while (remaining > 0) {
    var chunkSize = Math.min(remaining, maxChunk)
    remaining -= chunkSize

    var act = {
      actionId: makeActionId(mission.phase, mission.category, chunkIdx),
      missionId: mission.missionId,
      phase: mission.phase,
      sequence: 0, // filled by caller
      category: mission.category,
      title: totalChunks > 1
        ? mission.title + ' (' + chunkIdx + '/' + totalChunks + ')'
        : mission.title,
      instruction: totalChunks > 1
        ? 'Part ' + chunkIdx + ': ' + mission.instruction
        : mission.instruction,
      estimatedMinutes: chunkSize,
      estimatedCostLevel: mission.estimatedCostLevel,
      riskLevel: mission.riskLevel,
      difficulty: mission.difficulty,
      priorityScore: mission.priorityScore || 0,
      scheduledDay: 0, // filled by schedule
      proofRequirement: chunkIdx === totalChunks ? (mission.proofOfCompletion || []) : [],
      successCriteria: chunkIdx === totalChunks ? (mission.successCriteria || []) : [],
      failureSignals: chunkIdx === totalChunks ? (mission.failureSignals || []) : [],
      dependencies: chunkIdx > 1
        ? [makeActionId(mission.phase, mission.category, chunkIdx - 1)]
        : [],
      fallback: mission.fallback || { type: 'RETRY', trigger: 'action_failed' },
      tags: mission.category ? [mission.category] : [],
      linkedLeverage: mission.linkedLeverage || '',
      linkedWrongGame: mission.linkedWrongGame || '',
    }

    chunks.push(act)
    chunkIdx++
  }

  return chunks
}

// ═══════════════════════════════════════
// sequence 生成器
// ═══════════════════════════════════════

function makeSeqGenerator() {
  var counters = { DAY_7: 0, DAY_30: 0, DAY_90: 0 }
  return function(phase) {
    counters[phase] = (counters[phase] || 0) + 1
    return counters[phase]
  }
}

module.exports = {
  scheduleActions,
  chunkMission,
  getBudget,
}
