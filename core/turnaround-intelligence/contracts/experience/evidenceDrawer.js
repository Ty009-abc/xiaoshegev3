/**
 * core/turnaround-intelligence/contracts/experience/evidenceDrawer.js
 *
 * CP6-F Evidence Drawer Contract — "为什么？" 折叠证据链
 *
 * 默认折叠，展开显示: Answer → Pattern → Risk → Decision
 *
 * 这是 Explainable AI 的核心。
 *
 * @version 6.4.0
 * @checkpoint CP6-F
 */

function createEvidenceDrawerOutput({ version, chain, sources }) {
  if (!version) throw new Error('EvidenceDrawer: version required')
  if (!chain || chain.length === 0) throw new Error('EvidenceDrawer: chain required')

  return Object.freeze({
    cardId: 'evidence',
    cardIndex: 7,
    title: '为什么？',
    layout: Object.freeze({
      type: 'DRAWER',
      defaultState: 'COLLAPSED',
    }),
    chain: Object.freeze(chain.map((item, i) => Object.freeze({
      step: i + 1,
      label: item.label,
      content: item.content,
      source: item.source || '',
    }))),
    sources: sources ? [...sources] : [],
    explainabilityNote: '这条链展示了从你的原始回答到最终建议的完整推理路径。',
  })
}

module.exports = { createEvidenceDrawerOutput }
