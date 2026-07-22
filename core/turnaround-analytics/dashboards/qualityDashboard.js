/**
 * core/turnaround-analytics/dashboards/qualityDashboard.js
 *
 * V6.5 Gate A — Quality Dashboard（质量看板）
 *
 * 每天自动统计。
 *
 * @version 6.5.0
 */

function createQualityDashboard({ date, reports, systemMetrics }) {
  if (!date) throw new Error('QualityDashboard: date required')
  if (!reports || !Array.isArray(reports)) throw new Error('QualityDashboard: reports required')

  const total = reports.length

  // AI 性能
  const durations = reports.map(r => r.aiDurationMs || 0).filter(d => d > 0)
  const avgAiMs = durations.length > 0 ? avg(durations) : 0
  const p95AiMs = durations.length > 0 ? percentile(durations, 95) : 0

  // 空报告
  const emptyCount = reports.filter(r => r.isEmpty).length

  // Retry
  const retryCount = reports.filter(r => (r.retryCount || 0) > 0).length
  const avgRetries = reports.reduce((s, r) => s + (r.retryCount || 0), 0) / (total || 1)

  // Fallback
  const fallbackCount = reports.filter(r => r.usedFallback).length

  // Consistency
  const consistencyScores = reports.map(r => r.consistencyScore || 0).filter(s => s > 0)
  const avgConsistency = consistencyScores.length > 0 ? avg(consistencyScores) : 0

  // Potential
  const potentialScores = reports.map(r => r.potentialScore || 0).filter(s => s > 0)
  const avgPotential = potentialScores.length > 0 ? avg(potentialScores) : 0

  // Decision 分布
  const decisionDist = {}
  for (const r of reports) {
    const d = r.primaryDecision || 'UNKNOWN'
    decisionDist[d] = (decisionDist[d] || 0) + 1
  }
  const decisionTop5 = Object.entries(decisionDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count, pct: ((count / total) * 100).toFixed(1) }))

  // 崩溃
  const crashCount = systemMetrics ? (systemMetrics.crashCount || 0) : 0

  return Object.freeze({
    version: '6.5.0',
    date,
    summary: {
      totalReports: total,
      crashCount,
    },
    aiPerformance: {
      avgMs: Math.round(avgAiMs),
      p95Ms: Math.round(p95AiMs),
      emptyReportRate: total > 0 ? ((emptyCount / total) * 100).toFixed(1) + '%' : '0%',
      retryRate: total > 0 ? ((retryCount / total) * 100).toFixed(1) + '%' : '0%',
      avgRetries: avgRetries.toFixed(1),
      fallbackRate: total > 0 ? ((fallbackCount / total) * 100).toFixed(1) + '%' : '0%',
    },
    quality: {
      avgConsistency: Math.round(avgConsistency),
      avgPotential: Math.round(avgPotential),
      sufficientQualityRate: total > 0
        ? ((reports.filter(r => (r.consistencyScore || 0) >= 85).length / total) * 100).toFixed(1) + '%'
        : '0%',
    },
    decisionTop5,
  })
}

function avg(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length }
function percentile(arr, p) { const s = [...arr].sort((a, b) => a - b); return s[Math.ceil((p / 100) * s.length) - 1] || 0 }

module.exports = { createQualityDashboard }
