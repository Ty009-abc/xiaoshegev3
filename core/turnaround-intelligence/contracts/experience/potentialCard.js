/**
 * core/turnaround-intelligence/contracts/experience/potentialCard.js
 *
 * CP6-F Potential Card Contract — 翻身潜力卡片
 *
 * 必须包含 disclaimer
 *
 * @version 6.4.0
 * @checkpoint CP6-F
 */

function createPotentialCardOutput({ version, content }) {
  if (!version) throw new Error('PotentialCard: version required')
  if (!content) throw new Error('PotentialCard: content required')
  if (typeof content.score !== 'number' || content.score < 0 || content.score > 100) {
    throw new Error('PotentialCard: content.score out of range')
  }
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(content.level)) throw new Error('PotentialCard: invalid level')
  if (!content.disclaimer) throw new Error('PotentialCard: disclaimer required')

  return Object.freeze({
    cardId: 'potential',
    cardIndex: 2,
    title: '翻身潜力',
    layout: Object.freeze({
      size: 'COMPACT',
      scoreHighlight: true,
    }),
    content: Object.freeze({
      score: Math.round(content.score),
      level: content.level,
      reversibility: content.reversibility,
      estimatedRecoveryDays: content.estimatedRecoveryDays,
      window: Object.freeze({ ...content.window }),
    }),
    footer: Object.freeze({
      disclaimer: content.disclaimer,
    }),
  })
}

module.exports = { createPotentialCardOutput }
