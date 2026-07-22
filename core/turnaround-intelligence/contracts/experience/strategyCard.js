/**
 * core/turnaround-intelligence/contracts/experience/strategyCard.js
 *
 * CP6-F Strategy Card Contract — 第一决策 + 翻身路线
 *
 * One Decision Rule: 只有第一决策
 * Roadmap 4 phases: 时间轴
 *
 * @version 6.4.0
 * @checkpoint CP6-F
 */

function createStrategyCardOutput({ version, primaryDecision, roadmap }) {
  if (!version) throw new Error('StrategyCard: version required')
  if (!primaryDecision) throw new Error('StrategyCard: primaryDecision required')
  if (!roadmap || !Array.isArray(roadmap) || roadmap.length === 0) {
    throw new Error('StrategyCard: roadmap required')
  }

  return Object.freeze({
    cardId: 'strategy',
    cardIndex: [3, 4],
    title: '翻身路线',
    primaryDecision: Object.freeze({
      decision: primaryDecision.decision,
      label: primaryDecision.label || '第一决策',
      instruction: primaryDecision.instruction || '未来30天，其它事情全部靠后。',
      rule: 'One Decision Rule — 只输出一个决策',
    }),
    roadmap: Object.freeze(roadmap.map(p => Object.freeze({
      period: p.period,
      action: p.action,
      emphasis: p.emphasis,
    }))),
  })
}

module.exports = { createStrategyCardOutput }
