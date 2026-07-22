/**
 * core/turnaround-analytics/experiments/experimentEngine.js
 *
 * V6.5 Gate A — A/B 实验引擎
 *
 * @version 6.5.0
 */

const EXPERIMENT_VARIANTS = Object.freeze({
  HERO_HEADLINE: {
    experimentId: 'exp_hero_headline',
    description: 'Hero 命运判决文案 A/B',
    variants: [
      { id: 'A', label: '原版', value: null },
      { id: 'B', label: '备选', value: null },
    ],
    metrics: ['阅读完成率', '分享率', '支付率'],
    trafficAllocation: { A: 0.5, B: 0.5 },
  },
  HERO_GAP: {
    experimentId: 'exp_hero_gap',
    description: '认知暴击文案 A/B',
    variants: [
      { id: 'A', label: '原版', value: null },
      { id: 'B', label: '备选', value: null },
    ],
    metrics: ['Evidence展开率', '停留时长'],
  },
  CARD_ORDER: {
    experimentId: 'exp_card_order',
    description: '卡片展示顺序',
    variants: [
      { id: 'A', label: '标准顺序', value: ['hero','insight','potential','strategy','timeline','action','evidence'] },
      { id: 'B', label: 'Potential提前', value: ['hero','potential','insight','strategy','timeline','action','evidence'] },
    ],
    metrics: ['阅读完成率', '平均停留时长'],
  },
  ACTION_WORDING: {
    experimentId: 'exp_action_wording',
    description: '第一行动文案',
    variants: [
      { id: 'A', label: '指定动作', value: null },
      { id: 'B', label: '开放选择', value: null },
    ],
    metrics: ['行动执行率', '次日留存'],
  },
})

function createExperiment({ experimentId, variants, trafficSplit }) {
  if (!EXPERIMENT_VARIANTS[experimentId]) throw new Error(`Experiment: unknown experiment "${experimentId}"`)

  const config = EXPERIMENT_VARIANTS[experimentId]

  return Object.freeze({
    ...config,
    active: true,
    startDate: new Date().toISOString(),
    trafficSplit: trafficSplit || config.trafficAllocation,
    sampleSizeRequired: 200,
    confidenceLevel: 0.95,
    results: null,
  })
}

function createExperimentResult({ experimentId, variantResults }) {
  return Object.freeze({
    experimentId,
    timestamp: new Date().toISOString(),
    variants: Object.freeze(variantResults.map(v => Object.freeze({
      variantId: v.variantId,
      impressions: v.impressions || 0,
      metrics: Object.freeze({
        completionRate: v.completionRate || 0,
        shareRate: v.shareRate || 0,
        paymentRate: v.paymentRate || 0,
        evidenceExpandRate: v.evidenceExpandRate || 0,
        retentionRate: v.retentionRate || 0,
      }),
    }))),
    winner: variantResults.length === 2
      ? (variantResults[0].completionRate > variantResults[1].completionRate ? variantResults[0].variantId : variantResults[1].variantId)
      : null,
  })
}

module.exports = {
  EXPERIMENT_VARIANTS,
  createExperiment,
  createExperimentResult,
}
