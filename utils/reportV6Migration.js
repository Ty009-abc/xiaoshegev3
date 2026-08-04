/**
 * utils/reportV6Migration.js — RC6.0 V4/V5 → V6 报告迁移
 *
 * 职责：将旧版报告的 potential 字段映射为 destinySimulator。
 * 旧报告必须正常打开、不白屏、不报错、不丢失旧字段。
 * 本阶段不删除 potential。
 *
 * @version RC6.0_DESTINY_ENGINE
 */
'use strict'

var DestinySim = require('./reportDestinySimulator')
var CogVerdict = require('./cognitiveVerdictBuilder')

/* ═══════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════ */

/**
 * 将旧 potential 字段迁移为 destinySimulator
 *
 * @param {Object} potential — 旧版 potential 字段
 * @param {Object} report — 完整 skeleton
 * @returns {Object} destinySimulator
 */
function migratePotentialToDestinySimulator(potential, report) {
  var pt = potential || {}
  var sc = (report || {}).scoreCard || {}

  var currentIndex = toNum(pt.score, (sc.overall || 50))
  var currentLevel = DestinySim.normalizeDestinyLevel(currentIndex)

  return {
    currentIndex: currentIndex,
    currentLevel: currentLevel.key,
    currentLevelLabel: currentLevel.label,

    horizonDays: 365,
    repairCycleDays: toNum(pt.estimatedRecoveryDays, toNum(pt.repairCycleDays, 90)),

    baselinePath: {
      title: '继续保持现状',
      summary: '继续当前模式，没有结构性改变。',
      systemProgress: 24,
      riskLevel: 'high',
      riskLabel: '较高',
      outcome: '一年后大概率面临相同的困境，但积累的时间成本更高。',
    },

    actionPath: {
      title: '执行翻身方案',
      summary: '建立获客和产品化体系。',
      systemProgress: clamp(currentIndex + 15, currentIndex, 92),
      riskLevel: 'medium',
      riskLabel: '中等',
      projectedIndex: clamp(currentIndex + 15, currentIndex, 92),
      outcome: '通过结构性调整，预计有显著提升空间。',
    },

    strengths: (pt.advantages || pt.strengths || []).slice(0, 3),
    constraints: (pt.constraints || []).slice(0, 3),

    turningPoints: [
      { day: 7, label: '复盘首个付费客户来源' },
      { day: 30, label: '固定一个主攻平台' },
      { day: toNum(pt.estimatedRecoveryDays, 90), label: '验证一条可复制获客路径' },
    ],

    keyVariable: (pt.constraints && pt.constraints.length > 0) ? '建立持续获客系统' : '完成第一次市场验证',
    confidence: 'migrated_from_v4',
  }
}

/**
 * 在 Normalizer 中调用：如果 report 有 potential 但没有 destinySimulator，自动迁移
 *
 * @param {Object} report — skeleton
 * @returns {Object} report — 可能增加了 destinySimulator / cognitiveVerdict
 */
function ensureV6Fields(report) {
  if (!report) return report

  // potential → destinySimulator
  if (!report.destinySimulator && report.potential) {
    report.destinySimulator = migratePotentialToDestinySimulator(report.potential, report)
  }

  // fallback destinySimulator
  if (!report.destinySimulator) {
    report.destinySimulator = DestinySim.computeDestinySimulator({}, report)
  }

  // cognitiveVerdict
  if (!report.cognitiveVerdict) {
    report.cognitiveVerdict = CogVerdict.cognitiveVerdictFallback({
      scoreCard: report.scoreCard,
      fatalRules: report.fatalRules,
    })
  }

  return report
}

/* ═══════════════════════════════════════════════════════════════
   Utility
   ═══════════════════════════════════════════════════════════════ */

function toNum(v, fallback) {
  var n = Number(v)
  return isNaN(n) ? (fallback || 0) : n
}

function clamp(v, min, max) {
  var n = Number(v)
  if (isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

/* ═══════════════════════════════════════════════════════════════
   Export
   ═══════════════════════════════════════════════════════════════ */

module.exports = {
  migratePotentialToDestinySimulator,
  ensureV6Fields,
}
