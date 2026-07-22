/**
 * core/turnaround-intelligence/contracts/experience/insightCard.js
 *
 * CP6-F Insight Card Contract — 认知暴击（固定三段）
 *
 * ⚠️ 禁止自由发挥，固定模板
 *
 * @version 6.4.0
 * @checkpoint CP6-F
 */

function createInsightCardOutput({ version, content }) {
  if (!version) throw new Error('InsightCard: version required')
  if (!content) throw new Error('InsightCard: content required')
  if (!content.youThought) throw new Error('InsightCard: content.youThought required')
  if (!content.actually) throw new Error('InsightCard: content.actually required')
  if (!content.realProblem) throw new Error('InsightCard: content.realProblem required')

  return Object.freeze({
    cardId: 'insight',
    cardIndex: 1,
    title: '认知暴击',
    layout: Object.freeze({
      size: 'FULL',
      template: 'FIXED_THREE_SEGMENT',
      visualWeight: 'HEAVY',
    }),
    content: Object.freeze({
      youThought: content.youThought,
      actually: content.actually,
      realProblem: content.realProblem,
    }),
    templateLocked: true,
    noFreeform: '此卡片使用固定三段模板，禁止自由发挥',
  })
}

module.exports = { createInsightCardOutput }
