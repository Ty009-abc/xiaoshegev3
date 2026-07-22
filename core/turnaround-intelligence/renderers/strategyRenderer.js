/**
 * core/turnaround-intelligence/renderers/strategyRenderer.js
 *
 * CP6-E Strategy Renderer — 仅翻译 Roadmap，不推理
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

const { createStrategyOutput } = require('../contracts/narrative/strategy')

const PERIOD_LABELS = {
  PHASE_REPAIR:  { period: '未来30天',   emphasis: '紧急优先' },
  PHASE_BUILD:   { period: '未来90天',   emphasis: '建立系统' },
  PHASE_EXPAND:  { period: '未来180天',  emphasis: '扩大规模' },
  PHASE_COMPOUND:{ period: '未来365天',  emphasis: '进入复利' },
}

/**
 * ⚠️ 此函数禁止新增任何推理
 * 只将 Roadmap 的 goal 翻译为面向用户的 action 文字
 */
function run(input) {
  const roadmap = input.roadmap || {}
  const phases = roadmap.phases || []

  if (phases.length === 0) {
    return createStrategyOutput({
      version: '6.3.0',
      phases: [
        { period: '未来30天', action: '收集足够的行为数据以生成个性化策略', emphasis: '准备阶段' },
      ],
    })
  }

  const narrative = phases.map(p => {
    const label = PERIOD_LABELS[p.code] || { period: `第${p.phase}阶段`, emphasis: p.label }
    return {
      period: label.period,
      action: p.goal,
      emphasis: label.emphasis,
    }
  })

  return createStrategyOutput({
    version: '6.3.0',
    phases: narrative,
  })
}

module.exports = { run }
