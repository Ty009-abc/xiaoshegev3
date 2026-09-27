/**
 * lib/reportStore6q.js — RC8.9B 报告实体持久化/读取（legacy 6Q 线）
 *
 * 复用既有 ai_reports 集合（不新建集合）。
 * - 写：persist6qReport（幂等：一个 requestId → 一个实体）
 * - 读：count6qReports / list6qReports
 *
 * 只持久化「最终公开 5 卡片快照」；绝不存 secret / 支付载荷 /
 * 内部思维链 / 原始模型内部字段。
 *
 * @version RC8.9B
 */
'use strict'

const REPORT_TYPE = 'turnaround_6q'
const DIAGNOSTIC_VERSION = 'turnaround_strategy_6q_v1'
const SCHEMA_VERSION = 1

/** 与既有 rpt_v4_ / AR 约定一致的稳定 ID（6Q 命名空间） */
function buildReportId (ts) {
  const rand = Math.random().toString(36).slice(2, 8)
  return `rpt_6q_${ts}_${rand}`
}

/**
 * 持久化 ONE 6Q 报告实体。
 * 幂等：当 requestId 已存在同类型记录时复用其 reportId，不重复写入。
 * @returns {string} reportId
 */
async function persist6qReport (db, { openid, requestId, publicRep, meta, ts }) {
  const m = meta || {}
  if (requestId) {
    const dup = await db.collection('ai_reports')
      .where({ openid, requestId, reportType: REPORT_TYPE }).limit(1).get()
    if (dup.data && dup.data[0]) return dup.data[0].reportId
  }
  const reportId = buildReportId(ts)
  await db.collection('ai_reports').add({
    data: {
      reportId,
      openid,
      requestId: requestId || '',
      reportType: REPORT_TYPE,
      diagnosticVersion: DIAGNOSTIC_VERSION,
      type: 'diagnostic',
      content: publicRep,
      // 可选（若已安全可得）：渲染来源 / 兜底原因，不含 raw prompt
      renderSource: m.renderSource || '',
      reasonCodes: Array.isArray(m.fallbackFields) ? m.fallbackFields.slice() : [],
      schemaVersion: SCHEMA_VERSION,
      createdAt: ts,
      updatedAt: ts,
    },
  })
  return reportId
}

async function count6qReports (db, openid) {
  const r = await db.collection('ai_reports').where({ openid, reportType: REPORT_TYPE }).count()
  return r.total || 0
}

async function list6qReports (db, openid, limit) {
  const r = await db.collection('ai_reports')
    .where({ openid, reportType: REPORT_TYPE })
    .orderBy('createdAt', 'desc')
    .limit(limit || 20)
    .field({ reportId: true, reportType: true, diagnosticVersion: true, createdAt: true, renderSource: true })
    .get()
  return r.data || []
}

module.exports = {
  REPORT_TYPE, DIAGNOSTIC_VERSION, SCHEMA_VERSION,
  buildReportId, persist6qReport, count6qReports, list6qReports,
}
