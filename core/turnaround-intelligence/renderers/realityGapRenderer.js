/**
 * core/turnaround-intelligence/renderers/realityGapRenderer.js
 *
 * CP6-E Reality Gap Renderer — 固定三段模板（认知暴击）
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

const { createRealityGapOutput } = require('../contracts/narrative/realityGap')
const { CONFLICT_CATALOG } = require('../contracts/conflict')

const CC_GAP_MAP = {
  LEARNING_EXECUTION_CONFLICT: {
    youThought: '赚钱需要更多机会。',
    actually: '你拥有的机会，已经远超过你的执行能力。',
    realProblem: '你一直在学习，却没有建立任何执行系统。',
  },
  AMBITION_DISCIPLINE_CONFLICT: {
    youThought: '努力足够就能成功。',
    actually: '你真正缺少的不是努力，而是持续执行的能力。',
    realProblem: '你的野心没有配套的执行纪律。',
  },
  SPEED_CONSISTENCY_CONFLICT: {
    youThought: '做事够快就会有结果。',
    actually: '速度快但方向不稳定，等于原地画圈。',
    realProblem: '你没有把速度转化为持续性。',
  },
  THINKING_ACTION_CONFLICT: {
    youThought: '想清楚才能行动。',
    actually: '你永远想不清楚，因为真正的问题只有行动才能发现。',
    realProblem: '你用思考代替了行动。',
  },
  RISK_REWARD_CONFLICT: {
    youThought: '高风险等于高回报。',
    actually: '你经历的高风险，多数都没有产生对应回报。',
    realProblem: '你的风险评估框架需要重建。',
  },
  STABILITY_GROWTH_CONFLICT: {
    youThought: '稳定就是安全。',
    actually: '在这个时代，最大的风险就是不冒任何风险。',
    realProblem: '你对稳定的依赖正在腐蚀你的成长潜力。',
  },
}

function run(input) {
  const cc = input.coreContradiction || {}
  const risk = input.risk || {}
  const ccCode = cc.code

  if (!ccCode || !CC_GAP_MAP[ccCode]) {
    // 基于 Risk 的回退
    const riskTop = (risk.topRisks || [])[0]
    if (riskTop && riskTop.riskCode === 'INCOME_STRUCTURE_RISK') {
      return createRealityGapOutput({
        youThought: '努力工作就会有财务自由。',
        actually: '单一收入结构意味着你的财务命脉完全掌握在别人手里。',
        realProblem: '你需要建立第二收入线来分散风险。',
        basedOn: { coreContradiction: ccCode || '风险推导' },
      })
    }
    return createRealityGapOutput({
      youThought: '只要足够努力，就能改变现状。',
      actually: '信息有限，无法确定你真正的问题在哪里。',
      realProblem: '你需要更清楚地认识自己的行为模式。',
      basedOn: { coreContradiction: ccCode || '未知' },
    })
  }

  const template = CC_GAP_MAP[ccCode]

  return createRealityGapOutput({
    ...template,
    basedOn: { coreContradiction: ccCode },
  })
}

module.exports = { run }
