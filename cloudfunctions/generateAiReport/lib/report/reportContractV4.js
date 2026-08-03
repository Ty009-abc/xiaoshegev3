/**
 * report/reportContractV4.js — V4 Report Contract 唯一标准
 *
 * 定义 V4 报告的完整数据结构。
 * 任何 AI Prompt 只能填充这个 Contract 的字段。
 * 禁止新增字段。禁止删除字段。
 *
 * 此文件也是 Validator 的 schema 来源。
 *
 * v6.5.2 (RC5.15.2): 新增 verdict/contradiction/potential/decision/primaryAction
 * 结构化语义字段，从 engine 透传到 poster。旧字段保留兼容。
 */

const { REPORT_SECTIONS } = require('./reportTypes')

/**
 * V4 Report Contract 工厂函数
 *
 * @param {Object} engineResult — turnaroundEngineV4.analyze() 的输出
 * @param {Object} filledReport — Mapper 填充的报告内容
 * @returns {Object} V4 Report Contract
 */
function createReportContract(engineResult, filledReport) {
  return {
    version: 'v4',
    generatedAt: new Date().toISOString(),
    reportId: generateReportId(),
    engineVersion: engineResult.meta?.engineVersion || 'v4',
    diagnosticVersion: engineResult.normalizedProfile?.diagnosticVersion || 'v4',
    report: {
      headline: filledReport.headline || null,
      wealthStage: filledReport.wealthStage || null,
      fatalDiagnosis: filledReport.fatalDiagnosis || null,
      fatalRules: filledReport.fatalRules || [],
      advantageRules: filledReport.advantageRules || [],
      opportunityRules: filledReport.opportunityRules || [],
      scoreCard: filledReport.scoreCard || null,
      wealthProbability: filledReport.wealthProbability || null,
      wealthPath: filledReport.wealthPath || null,
      actionPlan: filledReport.actionPlan || null,
      stopDoing: filledReport.stopDoing || null,
      identityUpgrade: filledReport.identityUpgrade || null,
      finalStrike: filledReport.finalStrike || null,
      // ── v6.5.2 结构化语义字段 ──
      verdict: filledReport.verdict || null,
      contradiction: filledReport.contradiction || null,
      potential: filledReport.potential || null,
      decision: filledReport.decision || null,
      primaryAction: filledReport.primaryAction || null,
    },
  }
}

/**
 * 返回空的 Report Contract 骨架（用于 Mapper 填充）
 *
 * @returns {Object} 空骨架 — 所有 report section 初始化为 null/[]
 */
function createReportSkeleton() {
  return {
    headline: null,
    wealthStage: null,
    fatalDiagnosis: null,
    fatalRules: [],
    advantageRules: [],
    opportunityRules: [],
    scoreCard: null,
    wealthProbability: null,
    wealthPath: null,
    actionPlan: null,
    stopDoing: null,
    identityUpgrade: null,
    finalStrike: null,
    // ── v6.5.2 结构化语义字段 ──
    verdict: null,
    contradiction: null,
    potential: null,
    decision: null,
    primaryAction: null,
  }
}

/**
 * 获取所有 13 个 section 名称
 */
function getReportSections() {
  return [...REPORT_SECTIONS]
}

/**
 * 生成唯一 reportId
 */
function generateReportId() {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `rpt_v4_${ts}_${rand}`
}

module.exports = {
  createReportContract,
  createReportSkeleton,
  getReportSections,
  generateReportId,
}
