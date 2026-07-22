/**
 * core/turnaround-intelligence/renderers/actionRenderer.js
 *
 * CP6-E Action Renderer — 只允许一个 PrimaryAction
 *
 * 从 Decision + 第一个 Milestone 生成唯一行动建议。
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

const { createActionOutput } = require('../contracts/narrative/action')
const { DECISION_CATALOG } = require('../contracts/decision')

const FIRST_ACTION_MAP = {
  BUILD_EXECUTION_SYSTEM: {
    title: '未来7天建立每日执行记录',
    why: '这是所有改变的第一步——没有记录就没有改进。先证明你能连续7天完成一件核心任务。',
    successCriteria: '连续7天每日完成1项核心任务（完成即记录，不追求完美）',
  },
  BUILD_SECOND_INCOME: {
    title: '未来7天评估可用资源和能力',
    why: '第二收入不会从天而降。你需要先盘点自己有什么，才能决定做什么。',
    successCriteria: '完成个人资源清单（时间/技能/人脉/资金），确定1个可行方向',
  },
  BUILD_DISCIPLINE: {
    title: '未来7天建立一个固定时间动作',
    why: '纪律不靠意志力，靠习惯。选一个每天同一时间做的动作，坚持7天。',
    successCriteria: '连续7天在同一时间完成同一个固定动作',
  },
  REDUCE_DECISION_FATIGUE: {
    title: '未来7天列出并简化3个日常决策',
    why: '你的精力被太多的日常决策消耗。先消除最简单的3个。',
    successCriteria: '确定3个自动化决策规则并开始执行',
  },
  REBUILD_RISK_FRAMEWORK: {
    title: '未来7天列出过去5个决策失误',
    why: '在建立新框架之前，先看清楚旧的错误模式。',
    successCriteria: '完成5个失败决策的回顾分析，找出共同模式',
  },
  // 默认: UNKNOWN + 其他
  _DEFAULT: {
    title: '未来7天记录每日行为数据',
    why: '没有足够的数据，任何建议都不可靠。先记录，再决定。',
    successCriteria: '连续7天记录每日执行/学习/消费等关键行为',
  },
}

function run(input) {
  const decision = (input.decision || {}).primaryDecision || {}
  const milestone = input.milestone || {}
  const ms = milestone.milestones || []

  const decisionCode = decision.code
  const firstMs = ms.length > 0 ? ms[0] : null

  let template = FIRST_ACTION_MAP[decisionCode] || FIRST_ACTION_MAP._DEFAULT

  return createActionOutput({
    title: template.title,
    why: template.why,
    successCriteria: template.successCriteria,
    basedOn: {
      decision: decisionCode,
      milestone: firstMs ? `${firstMs.day}天: ${firstMs.target}` : '第一个里程碑',
    },
  })
}

module.exports = { run }
