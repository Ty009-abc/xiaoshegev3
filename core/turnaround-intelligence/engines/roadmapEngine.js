/**
 * core/turnaround-intelligence/engines/roadmapEngine.js
 *
 * CP6-D Roadmap Engine — 固定四阶段 + exitCriteria
 *
 * 不生成任务列表——只定义阶段目标 + 退出条件。
 * 数据流: Decision → Roadmap (四阶段)
 *
 * @version 6.2.0
 * @checkpoint CP6-D
 */

const { PHASES, DECISION_ROADMAP, createRoadmapOutput } = require('../contracts/roadmap')

function run(input) {
  const decision = (input.decision || {}).primaryDecision || {}
  const decisionCode = decision.code

  if (!decisionCode || !DECISION_ROADMAP[decisionCode]) {
    // 无 Decision → 通用最小版
    return createRoadmapOutput({
      version: '6.2.0',
      decisionCode: decisionCode || 'UNKNOWN',
      phases: [
        {
          phase: 1, code: PHASES.REPAIR.code, label: PHASES.REPAIR.label,
          duration: 30, goal: '识别最关键的一个问题',
          exitCriteria: ['完成问题诊断', '确定第一步行动'],
        },
        {
          phase: 2, code: PHASES.BUILD.code, label: PHASES.BUILD.label,
          duration: 60, goal: '建立基础执行能力',
          exitCriteria: ['连续7天执行', '开始产生初步结果'],
        },
        {
          phase: 3, code: PHASES.EXPAND.code, label: PHASES.EXPAND.label,
          duration: 90, goal: '扩展已验证的方法',
          exitCriteria: ['结果扩大≥2倍', '方法可复制'],
        },
        {
          phase: 4, code: PHASES.COMPOUND.code, label: PHASES.COMPOUND.label,
          duration: 180, goal: '系统进入自动循环',
          exitCriteria: ['系统无需维护即可运行', '持续产生结果'],
        },
      ],
    })
  }

  const template = DECISION_ROADMAP[decisionCode]
  const phaseKeys = ['REPAIR', 'BUILD', 'EXPAND', 'COMPOUND']
  const phaseDefs = [PHASES.REPAIR, PHASES.BUILD, PHASES.EXPAND, PHASES.COMPOUND]
  const phases = phaseDefs.map(p => {
    const t = template.phases[p.code.replace('PHASE_', '')] || template.phases[p.code]
    return {
      phase: p.phase,
      code: p.code,
      label: p.label,
      duration: t.duration,
      goal: t.goal,
      exitCriteria: [...t.exitCriteria],
    }
  })

  return createRoadmapOutput({
    version: '6.2.0',
    decisionCode,
    phases,
  })
}

module.exports = { run }
