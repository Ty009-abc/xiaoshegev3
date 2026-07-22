/**
 * core/turnaround-analytics/dashboards/reportAnalytics.js
 *
 * V6.5 Gate A — Report Analytics（卡片漏斗分析）
 *
 * @version 6.5.0
 */

function createReportAnalytics(input) {
  // input = report-level stats for a single report
  const cards = input.cards || []

  return Object.freeze({
    version: '6.5.0',
    reportId: input.reportId || '',
    sessionId: input.sessionId || '',
    userId: input.userId || '',

    /**
     * 卡片漏斗
     * 每张卡片的展示和交互数据
     */
    cardFunnel: Object.freeze(cards.map((card, i) => Object.freeze({
      cardId: card.cardId,
      cardIndex: i,
      impression: card.impression || 0,
      tap: card.tap || 0,
      expand: card.expand || 0,
      durationMs: card.durationMs || 0,
    }))),

    /**
     * 总耗时
     */
    totalDurationMs: cards.reduce((s, c) => s + (c.durationMs || 0), 0),

    /**
     * 完成率
     */
    completionRate: cards.length === 7
      ? (cards.filter(c => c.impression > 0).length / 7) : 0,

    /**
     * 证据展开率
     */
    evidenceExpandRate: (() => {
      const evidence = cards.find(c => c.cardId === 'evidence')
      return evidence && evidence.impression > 0
        ? (evidence.expand || 0) / evidence.impression : 0
    })(),
  })
}

module.exports = { createReportAnalytics }
