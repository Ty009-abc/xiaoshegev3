/**
 * core/turnaround-intelligence/contracts/experience/actionCard.js
 *
 * CP6-F Action Card Contract — 第一行动（只有一件）
 *
 * @version 6.4.0
 * @checkpoint CP6-F
 */

function createActionCardOutput({ version, primaryAction }) {
  if (!version) throw new Error('ActionCard: version required')
  if (!primaryAction) throw new Error('ActionCard: primaryAction required')
  if (!primaryAction.title) throw new Error('ActionCard: primaryAction.title required')
  if (!primaryAction.why) throw new Error('ActionCard: primaryAction.why required')
  if (!primaryAction.successCriteria) throw new Error('ActionCard: primaryAction.successCriteria required')

  return Object.freeze({
    cardId: 'action',
    cardIndex: 6,
    title: '第一行动',
    layout: Object.freeze({
      size: 'COMPACT',
      urgent: true,
    }),
    primaryAction: Object.freeze({
      title: primaryAction.title,
      why: primaryAction.why,
      successCriteria: primaryAction.successCriteria,
    }),
    rule: '只此一项。不需要同时做十件事。',
  })
}

module.exports = { createActionCardOutput }
