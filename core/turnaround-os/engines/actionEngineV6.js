/**
 * core/turnaround-os/engines/actionEngineV6.js
 *
 * V6 Action Engine — CHECKPOINT_5
 *
 * 把 Mission Plan 转化为可执行、可追踪、可恢复的 Action Plan。
 *
 * 核心调用链:
 *   MissionDefinition → ActionPlan → ActionDefinition → ActionExecution → State
 *
 * 禁止:
 *   - 修改 MissionDefinition
 *   - 调用上游 Engine
 *   - AI / DB / Payment / Date / Math.random
 *
 * @version 6.0.0
 * @status CHECKPOINT_5
 */

var C = require('../constants')
var { createActionDefinition, createActionExecution } = require('../schemas/actionContractV6')
var { createActionPlan, createWeeklySummary, createExecutionRule, createDependencyEdge } = require('../contracts/actionPlanContractV6')
var { scheduleActions } = require('./actionSchedulerV6')
var { transitionActionState, EVENTS } = require('../state/actionStateMachineV6')

// ═══════════════════════════════════════
// 1. generateActionPlan
// ═══════════════════════════════════════

/**
 * generateActionPlan — 主入口
 *
 * @param {Object} params
 * @param {Object} params.missionPlan      — Mission Plan (CHECKPOINT_4B output)
 * @param {Object} params.profile          — identityEngine 输出
 * @param {Object} params.strategy         — turnaroundEngine 输出
 * @param {Object} [params.executionContext] — 可选: { planId, previousPlan }
 * @returns {Object} ActionPlan
 */
function generateActionPlan(params) {
  params = params || {}
  var missionPlan = params.missionPlan
  var profile = params.profile
  var strategy = params.strategy
  var ctx = params.executionContext || {}

  // 收集所有 Mission
  var allMissions = collectAllMissions(missionPlan)

  // 调度
  var scheduleResult = scheduleActions(allMissions, profile, strategy, missionPlan)
  var actions = scheduleResult.actions
  var dailySchedule = scheduleResult.dailySchedule
  var warnings = scheduleResult.warnings

  // 构建依赖图
  var deps = buildDependencyMap(actions, allMissions)

  // 构建 Plan
  var dailyScheduleObj = {}
  var totalMins = 0
  for (var k in dailySchedule) {
    dailyScheduleObj[k] = dailySchedule[k]
    totalMins += dailySchedule[k].estimatedTotalMinutes
  }

  var plan = createActionPlan({
    planId: ctx.planId || makePlanId(profile, strategy),
    sourceMissionPlanVersion: (missionPlan && missionPlan.version) || '6.0',
  })

  plan.actions = actions
  plan.dailySchedule = dailyScheduleObj
  plan.dependencies = deps
  plan.blockedActions = deps.warnings.map(function(w) { return w.actionId || '' }).filter(Boolean)

  // Weekly schedule summary
  plan.weeklySchedule = computeWeeklySchedule(actions, dailyScheduleObj)

  // Execution rules
  plan.executionRules = buildExecutionRules(profile, actions, deps)

  // Confidence
  plan.confidence = calculateActionConfidence(profile, strategy, actions)

  // Evidence
  plan.evidence = {
    ruleHits: ['ACT_ENGINE_DETERMINISTIC', 'ACT_ZERO_AI', 'ACT_ZERO_DB'],
    sourceFields: ['missionPlan', 'profile', 'strategy'],
    actionLinks: actions.map(function(a) { return a.actionId }),
  }

  // 附加 warnings 到 dependencies
  plan.dependencies.warnings = plan.dependencies.warnings.concat(
    warnings.map(function(w) { return { actionId: '', message: w } })
  )

  return plan
}

// ═══════════════════════════════════════
// 2. createActionExecution
// ═══════════════════════════════════════

function createActionExecutionContext(actionDefinition, overrides) {
  overrides = overrides || {}
  var exec = createActionExecution(actionDefinition)
  if (overrides.status) exec.status = overrides.status
  if (overrides.progress !== undefined) exec.progress = overrides.progress
  if (overrides.startedAt) exec.startedAt = overrides.startedAt
  if (overrides.completedAt) exec.completedAt = overrides.completedAt
  if (overrides.submittedProof) exec.submittedProof = overrides.submittedProof.slice()
  if (overrides.attemptCount !== undefined) exec.attemptCount = overrides.attemptCount
  if (overrides.lastFailureReason) exec.lastFailureReason = overrides.lastFailureReason
  if (overrides.maxAttempts !== undefined) exec.maxAttempts = overrides.maxAttempts
  return exec
}

// ═══════════════════════════════════════
// 3. transitionActionState (re-export)
// ═══════════════════════════════════════

// transitionActionState 直接从 state/actionStateMachineV6 转出
// 这里封装一个便捷方法：applyTransition
function applyTransition(execution, event, payload) {
  return transitionActionState({ execution: execution, event: event, payload: payload || {} })
}

// ═══════════════════════════════════════
// 内部: 收集所有 Mission
// ═══════════════════════════════════════

function collectAllMissions(missionPlan) {
  var all = []
  if (!missionPlan) return all
  var phases = ['day7', 'day30', 'day90']
  for (var i = 0; i < phases.length; i++) {
    var p = missionPlan[phases[i]]
    if (p && Array.isArray(p.missions)) {
      all = all.concat(p.missions)
    }
  }
  return all
}

// ═══════════════════════════════════════
// 内部: Plan ID
// ═══════════════════════════════════════

function makePlanId(profile, strategy) {
  var stage = (profile && profile.wealthStage) || 'UNK'
  var lever = (strategy && strategy.primaryStrategy && strategy.primaryStrategy.primaryLeverage)
    ? strategy.primaryStrategy.primaryLeverage.type
    : 'UNK'
  return 'AP_' + stage.substring(0, 4).toUpperCase() + '_' + lever.substring(0, 4).toUpperCase() + '_V6'
}

// ═══════════════════════════════════════
// 内部: 依赖图
// ═══════════════════════════════════════

function buildDependencyMap(actions, missions) {
  var edges = []
  var criticalPaths = []
  var warnings = []
  var seenIds = {}

  for (var i = 0; i < actions.length; i++) {
    var a = actions[i]
    seenIds[a.actionId] = true

    // Action 内部的 chunk 依赖
    if (a.dependencies && a.dependencies.length > 0) {
      for (var j = 0; j < a.dependencies.length; j++) {
        edges.push(createDependencyEdge({
          from: a.dependencies[j],
          to: a.actionId,
          type: 'REQUIRED',
          reason: 'sequential chunk',
        }))
      }
    }
  }

  // 检测 fallback 循环
  for (var k = 0; k < actions.length; k++) {
    var act = actions[k]
    var fb = act.fallback
    if (fb && fb.targetActionId) {
      var target = fb.targetActionId

      // self-cycle
      if (target === act.actionId) {
        warnings.push({ actionId: act.actionId, message: 'Fallback self-cycle: ' + target })
        continue
      }

      // 目标不存在
      if (!seenIds[target]) {
        warnings.push({ actionId: act.actionId, message: 'Fallback target not found: ' + target })
      }
    }
  }

  // 检测依赖循环
  var cycles = findDependencyCycles(edges)
  for (var c = 0; c < cycles.length; c++) {
    warnings.push({ actionId: '', message: 'Dependency cycle: ' + cycles[c].join(' → ') })
  }

  // 关键路径（简化：按 phase 串联的 REQUIRED 链）
  criticalPaths = findCriticalPaths(edges, actions)

  return {
    edges: edges,
    criticalPaths: criticalPaths,
    warnings: warnings,
  }
}

// ═══════════════════════════════════════
// 依赖循环检测（DFS）
// ═══════════════════════════════════════

function findDependencyCycles(edges) {
  var cycles = []
  var adj = {}
  for (var i = 0; i < edges.length; i++) {
    var e = edges[i]
    if (!adj[e.from]) adj[e.from] = []
    adj[e.from].push(e.to)
  }

  // 每个节点做 DFS
  var allNodes = Object.keys(adj)
  for (var j = 0; j < allNodes.length; j++) {
    var node = allNodes[j]
    var visited = {}
    var stack = [node]
    var path = []
    while (stack.length > 0) {
      var cur = stack[stack.length - 1]
      if (visited[cur]) {
        stack.pop()
        path.pop()
        continue
      }
      visited[cur] = true
      path.push(cur)
      var neighbors = adj[cur] || []
      for (var k = 0; k < neighbors.length; k++) {
        var n = neighbors[k]
        if (n === node && path.length > 1) {
          // found cycle
          cycles.push(path.slice().concat(node))
          stack = []
          break
        }
        if (!visited[n]) {
          stack.push(n)
        }
      }
      if (stack.length === 0) break
      if (stack[stack.length - 1] === cur) {
        stack.pop()
        path.pop()
      }
    }
  }

  return cycles
}

// ═══════════════════════════════════════
// 关键路径
// ═══════════════════════════════════════

function findCriticalPaths(edges, actions) {
  // 简化为：每 phase 的 REQUIRED 链按 sequence 排序
  var paths = {}
  for (var i = 0; i < actions.length; i++) {
    var a = actions[i]
    var key = a.phase
    if (!paths[key]) paths[key] = []
    paths[key].push(a.actionId)
  }
  return Object.keys(paths).map(function(p) { return paths[p] })
}

// ═══════════════════════════════════════
// Weekly Schedule
// ═══════════════════════════════════════

function computeWeeklySchedule(actions, dailySchedule) {
  var weekMap = {}
  for (var k in dailySchedule) {
    var slot = dailySchedule[k]
    var w = 'w' + Math.ceil(slot.dayNumber / 7)
    if (!weekMap[w]) {
      weekMap[w] = { startDay: slot.dayNumber, endDay: slot.dayNumber, totalActions: 0, totalMinutes: 0 }
    }
    var wd = weekMap[w]
    wd.endDay = Math.max(wd.endDay, slot.dayNumber)
    wd.totalActions += slot.actionIds.length
    wd.totalMinutes += slot.estimatedTotalMinutes
  }

  var summaries = []
  var weeks = Object.keys(weekMap).sort()
  for (var i = 0; i < weeks.length; i++) {
    var w = weekMap[weeks[i]]
    summaries.push(createWeeklySummary({
      weekNumber: i + 1,
      startDay: w.startDay,
      endDay: w.endDay,
      totalActions: w.totalActions,
      totalMinutes: w.totalMinutes,
      reviewDay: w.endDay,
    }))
  }
  return summaries.length > 0 ? summaries[0] : createWeeklySummary()
}

// ═══════════════════════════════════════
// Execution Rules
// ═══════════════════════════════════════

function buildExecutionRules(profile, actions, deps) {
  var stage = (profile && profile.wealthStage) || 'SURVIVAL'
  var maxSingleAction = 60
  if (stage === 'SURVIVAL') maxSingleAction = 45

  var rules = {
    maxConcurrentActions: stage === 'SURVIVAL' ? 2 : 3,
    maxDailyMinutes: stage === 'SURVIVAL' ? 60 : 120,
    maxSingleActionMinutes: maxSingleAction,
    requireProof: true,
    enforcedRiskCeiling: stage === 'SURVIVAL' ? 'LOW' : 'MEDIUM',
    rules: [
      createExecutionRule({
        ruleId: 'R_DEPENDENCY_FIRST',
        description: '依赖未完成时不可启动目标 Action',
        appliesTo: deps.edges.map(function(e) { return e.to }),
        priority: 100,
      }),
      createExecutionRule({
        ruleId: 'R_PROOF_REQUIRED',
        description: '每个 Action 完成必须提交完成证据',
        appliesTo: actions.map(function(a) { return a.actionId }),
        priority: 90,
      }),
      createExecutionRule({
        ruleId: 'R_DAILY_CAP',
        description: '每日不超过最大分钟数',
        appliesTo: actions.map(function(a) { return a.actionId }),
        priority: 85,
      }),
    ],
  }

  return rules
}

// ═══════════════════════════════════════
// Confidence
// ═══════════════════════════════════════

function calculateActionConfidence(profile, strategy, actions) {
  var base = 70

  // action 数量合理
  if (actions.length >= 5 && actions.length <= 30) base += 10
  else if (actions.length > 30) base -= 10

  // readiness
  var readiness = (profile && profile.strategyReadinessScore) || 50
  if (readiness >= 70) base += 10
  else if (readiness < 30) base -= 15

  // strategy confidence
  var stratConf = (strategy && strategy.verdict && strategy.verdict.confidence) || 50
  base = Math.round((base + stratConf) / 2)

  return Math.max(0, Math.min(100, base))
}

module.exports = {
  generateActionPlan,
  createActionExecutionContext,
  applyTransition,
  EVENTS,
}
