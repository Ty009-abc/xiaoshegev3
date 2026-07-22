/**
 * core/turnaround-intelligence/engines/milestoneEngine.js
 *
 * CP6-D Milestone Engine — 从 Roadmap 拆出 ≥3 个里程碑
 *
 * 每个里程碑有 day + target + verification + phaseLabel.
 *
 * @version 6.2.0
 * @checkpoint CP6-D
 */

const { createMilestoneOutput } = require('../contracts/milestone')

function run(input) {
  const roadmap = input.roadmap || {}
  const bottleneck = input.bottleneck || {}
  const phases = roadmap.phases || []
  const bottleneckWeek = bottleneck.expectedWeek || 4

  if (phases.length === 0) {
    return createMilestoneOutput({
      version: '6.2.0',
      milestones: [
        { day: 7,  target: '完成初步诊断',       verification: '输出完整诊断报告', phaseLabel: '修复' },
        { day: 21, target: '建立每日执行习惯',    verification: '连续7天执行记录',  phaseLabel: '建立' },
        { day: 90, target: '形成可复制的方法论',  verification: '方法论文档化',     phaseLabel: '放大' },
      ],
    })
  }

  const milestones = []
  let cumulativeDay = 0

  for (const phase of phases) {
    cumulativeDay += phase.duration

    // 每个阶段至少拆1个里程碑
    milestones.push({
      day: cumulativeDay,
      target: phase.goal,
      verification: phase.exitCriteria[0] || `达到"${phase.goal}"`,
      phaseLabel: phase.label,
    })
  }

  // 在瓶颈周额外插入一个早期检查点
  const bottleneckCheck = {
    day: Math.min(bottleneckWeek * 7, cumulativeDay - 7),
    target: `通过瓶颈检查：${bottleneck.title || '执行连续性'}`,
    verification: bottleneck.prevention ? bottleneck.prevention[0] : '无中断记录',
    phaseLabel: '修复',
  }

  // 确保不重复
  const allDays = milestones.map(m => m.day)
  if (!allDays.includes(bottleneckCheck.day) && bottleneckCheck.day > 0) {
    milestones.push(bottleneckCheck)
  }

  milestones.sort((a, b) => a.day - b.day)

  return createMilestoneOutput({
    version: '6.2.0',
    milestones: milestones.slice(0, 6),
  })
}

module.exports = { run }
