/**
 * core/turnaround-analytics/gates/stableRelease.js
 *
 * V6.5 Gate D — Stable Release Checklist + Release Dashboard
 *
 * @version 6.5.0
 */

const STABLE_CHECKLIST = Object.freeze([
  { id: 'D1', name: 'Analytics 正常',   check: 'Turnaround Console 有数据', required: true },
  { id: 'D2', name: 'RC 全通过',        check: '5 个 Gate 全部 PASS',      required: true },
  { id: 'D3', name: 'Beta KPI 达标',     check: 'HIGH 权重 KPI 全部 PASS', required: true },
  { id: 'D4', name: 'Crash = 0 (72h)',  check: '生产环境 72 小时无崩溃',     required: true },
  { id: 'D5', name: '支付生产验证',      check: '至少 10 笔真实支付成功',    required: true },
  { id: 'D6', name: '回滚方案就绪',      check: '有回滚到上一个版本的方案',  required: true },
  { id: 'D7', name: 'Release Notes',   check: 'CHANGELOG 已编写',         required: true },
])

const RELEASE_DASHBOARD = Object.freeze({
  version: '6.5.0',
  title: 'Turnaround Console',
  tabs: [
    {
      id: 'overview',
      label: '首页',
      widgets: [
        { id: 'reports_today',     label: '今日报告',      type: 'metric', value: 0, unit: '份' },
        { id: 'payments_today',    label: '今日支付',      type: 'metric', value: 0, unit: '笔' },
        { id: 'shares_today',      label: '今日分享',      type: 'metric', value: 0, unit: '次' },
        { id: 'avg_duration',      label: '平均停留',      type: 'metric', value: '0m0s', unit: '' },
        { id: 'ai_p95',            label: 'AI P95',        type: 'metric', value: '0ms', unit: '' },
        { id: 'consistency_avg',   label: '一致性均分',    type: 'metric', value: 0, unit: '分' },
        { id: 'crash_count',       label: 'Crash',         type: 'metric', value: 0, unit: '次', alertOn: '>0' },
        { id: 'daily_trend',       label: '报告趋势(7天)', type: 'chart',  chartType: 'line' },
      ],
    },
    {
      id: 'decisions',
      label: 'Decision TOP10',
      widgets: [
        { id: 'decision_distribution', label: 'Decision 分布', type: 'chart', chartType: 'bar' },
      ],
    },
    {
      id: 'experiments',
      label: 'Hero A/B',
      widgets: [
        { id: 'hero_ab_completion',    label: '阅读完成率对比',  type: 'chart', chartType: 'bar' },
        { id: 'hero_ab_share',         label: '分享率对比',      type: 'chart', chartType: 'bar' },
        { id: 'hero_ab_payment',       label: '支付率对比',      type: 'chart', chartType: 'bar' },
      ],
    },
    {
      id: 'funnel',
      label: '漏斗',
      widgets: [
        { id: 'card_funnel',           label: '卡片漏斗',       type: 'funnel', stages: [
          'Hero', 'Insight', 'Potential', 'Strategy', 'Timeline', 'Action', 'Evidence',
        ]},
        { id: 'dropoff_rate',          label: '逐卡流失率',      type: 'chart', chartType: 'line' },
      ],
    },
    {
      id: 'feedback',
      label: '用户反馈',
      widgets: [
        { id: 'thumbs_ratio',          label: '👍/👎 比例',     type: 'gauge' },
        { id: 'recent_comments',       label: '最近评论',        type: 'list' },
      ],
    },
  ],
})

function createReleaseDashboard({ reportsToday, paymentsToday, sharesToday, avgDuration, aiP95Ms, consistencyAvg, crashCount, decisionTop, funnel, feedbackRatio }) {
  return Object.freeze({
    ...RELEASE_DASHBOARD,
    data: Object.freeze({
      reportsToday: reportsToday || 0,
      paymentsToday: paymentsToday || 0,
      sharesToday: sharesToday || 0,
      avgDuration: avgDuration || '0m0s',
      aiP95Ms: aiP95Ms || 0,
      consistencyAvg: consistencyAvg || 0,
      crashCount: crashCount || 0,
      decisionTop: decisionTop || [],
      funnel: funnel || [],
      feedbackRatio: feedbackRatio || { thumbsUp: 0, thumbsDown: 0 },
    }),
  })
}

function createStableChecklist({ checks }) {
  if (!checks) throw new Error('StableChecklist: checks required')

  const items = STABLE_CHECKLIST.map(item => ({
    ...item,
    status: (checks[item.id] || false) ? 'PASS' : 'PENDING',
  }))

  const allPass = items.every(i => i.status === 'PASS')

  return Object.freeze({
    version: '6.5.0',
    name: 'Stable Release Checklist',
    items: Object.freeze(items),
    allPass,
    action: allPass ? 'git tag v6.0.0 && 正式发布' : '继续修复，暂不发布',
  })
}

module.exports = {
  STABLE_CHECKLIST,
  RELEASE_DASHBOARD,
  createReleaseDashboard,
  createStableChecklist,
}
