/**
 * core/turnaround-intelligence/renderers/timelineRenderer.js
 *
 * CP6-E Timeline Renderer — 渲染 Milestone 为时间轴
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

const { createTimelineOutput } = require('../contracts/narrative/timeline')

function run(input) {
  const milestone = input.milestone || {}
  const ms = milestone.milestones || []

  if (ms.length === 0) {
    return createTimelineOutput({
      version: '6.3.0',
      timeline: [
        { day: 7,  title: '开始记录',           milestone: '每日执行记录',    successCriteria: '连续7天不间断' },
        { day: 30, title: '形成习惯',           milestone: '习惯稳定运行',    successCriteria: '无需意志力维持' },
      ],
    })
  }

  // ⚠️ 只渲染 Milestone 数据，不新增推理
  const timeline = ms.map(m => ({
    day: m.day,
    title: m.target,
    milestone: m.verification,
    successCriteria: m.phaseLabel ? `${m.phaseLabel}阶段完成` : '达成阶段目标',
  }))

  return createTimelineOutput({
    version: '6.3.0',
    timeline,
  })
}

module.exports = { run }
