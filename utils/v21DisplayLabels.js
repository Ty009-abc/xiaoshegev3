/**
 * utils/v21DisplayLabels.js
 *
 * RC8.3 Stage1B R4.4 — V2.1 认知报告「展示层」本地化映射（PRESENTATION ONLY）。
 *
 * 仅把内部枚举 token 翻译成用户可读中文标签；绝不改变任何内部存储/引擎值。
 * 内部引擎字段（construct / orientation / state / blindSpotId 等）保持原值不变，
 * 仅页面渲染时调用本映射产出展示文本。
 *
 * 严格边界：
 *   - 纯静态映射表，无推理、无评分、无诊断权威；
 *   - 缺失/未知 token 时回退到原 token（fail-safe，不臆造文案）；
 *   - 不包含任何财富/经济/概率/置信度内容。
 *
 * @version world_model_v2_1 (presentation labels)
 */

const CONSTRUCT_LABELS = Object.freeze({
  DECISION: '决策模型',
  FEEDBACK: '反馈回路',
  PROBABILITY: '概率认知',
  RISK: '风险模型',
  LEVERAGE: '杠杆模型',
  TIME: '时间视角',
  IDENTITY: '身份边界',
  OPPORTUNITY: '机会识别',
  SYSTEMS: '系统思维',
})

const ORIENTATION_LABELS = Object.freeze({
  DISTORTED: '明显偏差',
  HEALTHY: '状态健康',
  MIXED: '信号混合',
  NEUTRAL: '暂无明显倾向',
  UNKNOWN: '证据待确认',
})

const STATE_LABELS = Object.freeze({
  STRONG: '证据较强',
  MODERATE: '证据中等',
  WEAK: '证据较弱',
  UNKNOWN: '证据待确认',
})

function constructLabel(construct) {
  return CONSTRUCT_LABELS[construct] || construct
}

function orientationLabel(orientation) {
  return ORIENTATION_LABELS[orientation] || orientation
}

function stateLabel(state) {
  return STATE_LABELS[state] || state
}

module.exports = {
  CONSTRUCT_LABELS,
  ORIENTATION_LABELS,
  STATE_LABELS,
  constructLabel,
  orientationLabel,
  stateLabel,
}
