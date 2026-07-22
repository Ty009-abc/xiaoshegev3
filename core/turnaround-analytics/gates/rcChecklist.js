/**
 * core/turnaround-analytics/gates/rcChecklist.js
 *
 * V6.5 Gate B — Release Candidate Checklist
 *
 * 五项验收全部通过才能进入 Beta。
 *
 * @version 6.5.0
 */

const RC_GATES = Object.freeze([
  {
    id: 'RC1',
    name: '功能完整性',
    required: 'ALL',
    items: [
      { feature: '首页',              status: 'PENDING', verify: 'main page renders' },
      { feature: '问卷',              status: 'PENDING', verify: '10 questions appear and submit' },
      { feature: 'AI 生成',           status: 'PENDING', verify: 'report generates end-to-end' },
      { feature: '报告展示 (7 cards)', status: 'PENDING', verify: 'all 7 cards render in order' },
      { feature: '分享',              status: 'PENDING', verify: 'share poster generates + share button works' },
      { feature: '海报',              status: 'PENDING', verify: 'poster renders correctly' },
      { feature: '支付',              status: 'PENDING', verify: 'payment flow complete' },
      { feature: '历史',              status: 'PENDING', verify: 'history list loads' },
      { feature: '收藏',              status: 'PENDING', verify: 'collection saves/unsaves' },
    ],
  },
  {
    id: 'RC2',
    name: 'AI 质量验证',
    required: '200_SAMPLES',
    items: [
      { check: '无前后矛盾',         threshold: '100%',  sampleSize: 200 },
      { check: '无重复内容',         threshold: '100%',  sampleSize: 200 },
      { check: '无空值',             threshold: '100%',  sampleSize: 200 },
      { check: '与 Decision 一致',   threshold: '≥95%', sampleSize: 200 },
      { check: 'Consistency ≥ 85',   threshold: '≥95%', sampleSize: 200 },
      { check: 'Verdict ≤35字',      threshold: '≥99%', sampleSize: 200 },
    ],
  },
  {
    id: 'RC3',
    name: '性能',
    required: 'ALL',
    items: [
      { metric: '首页加载',           target: '<1.2s',  measured: null, unit: 'ms' },
      { metric: '问卷切换',           target: '<150ms', measured: null, unit: 'ms' },
      { metric: 'Hero 渲染',          target: '<300ms', measured: null, unit: 'ms' },
      { metric: 'AI 生成 P95',        target: '<8s',    measured: null, unit: 'ms' },
      { metric: '卡片切换',           target: '<200ms', measured: null, unit: 'ms' },
      { metric: '首次可交互时间 TTI',  target: '<2s',    measured: null, unit: 'ms' },
      { metric: 'Crash Free Rate',    target: '100%',   measured: null, unit: '%' },
    ],
  },
  {
    id: 'RC4',
    name: '稳定性',
    required: '72H_MONKEY',
    items: [
      { test: 'Monkey Test 时长',     target: '72小时',           status: 'PENDING' },
      { test: 'Crash Count',         target: '0',                status: 'PENDING' },
      { test: 'Memory Leak',         target: '稳定内存使用',       status: 'PENDING' },
      { test: 'UI Thread Block',     target: '无超时卡顿',         status: 'PENDING' },
    ],
  },
  {
    id: 'RC5',
    name: '支付链路',
    required: 'ALL',
    items: [
      { step: '未购→购买',           target: '成功扣款 + 会员开通',  status: 'PENDING' },
      { step: '购买→恢复',           target: 'restore 正常恢复',   status: 'PENDING' },
      { step: '会员→功能解锁',        target: 'Premium cards 可见', status: 'PENDING' },
      { step: '会员→过期',           target: 'Premium cards 锁定', status: 'PENDING' },
      { step: '过期→重新购买',        target: '重新购买成功',        status: 'PENDING' },
      { step: '支付失败→重试',        target: '友好提示 + 重试',     status: 'PENDING' },
    ],
  },
])

function createRCChecklist({ version }) {
  if (!version) throw new Error('RCChecklist: version required')

  return Object.freeze({
    version,
    gates: RC_GATES,
    totalGates: RC_GATES.length,
    totalItems: RC_GATES.reduce((s, g) => s + g.items.length, 0),
    rule: '所有 Gate 全部 PASS 才能进入 Beta (Gate C)',
  })
}

function validateGateStatus(gateResults) {
  for (const gate of gateResults) {
    const failed = gate.items.filter(i => i.status !== 'PASS')
    if (failed.length > 0) {
      return { passed: false, gateId: gate.id, failedItems: failed.length }
    }
  }
  return { passed: true }
}

module.exports = { RC_GATES, createRCChecklist, validateGateStatus }
