/**
 * engine/rules/decisionRules.js — V4 决策风格规则 (10 rules)
 *
 * Rule ID range: R_DEC_001 ~ R_DEC_010
 */
module.exports = [
  {
    id: 'R_DEC_001',
    name: 'All-in决策+安全垫不足 — 禁止裸辞',
    condition(data) {
      return data.decisionStyleRaw?.level === 'all_in' &&
             data.safetyMonthsRaw?.level !== 'strong';
    },
    weight: 32,
    level: 'fatal',
    output: {
      title: '禁止裸辞创业',
      description: '你倾向于All-in但安全垫不足——裸辞创业是高危行为',
      advice: '在保留主业的前提下，用业余时间验证方向。只有副业收入≥主业60%且安全垫>12月时才能考虑All-in',
    },
  },
  {
    id: 'R_DEC_002',
    name: 'All-in+安全垫足 — 可以赌但控规模',
    condition(data) {
      return data.decisionStyleRaw?.level === 'all_in' &&
             data.safetyMonthsRaw?.level === 'strong';
    },
    weight: 14,
    level: 'warning',
    output: {
      title: 'All-in可行但需控制规模',
      description: '你有充足的安全垫，All-in不是灾难，但一次全押仍然不是最佳策略',
      advice: '把一次All-in拆成3个阶段，每个阶段1个月，在每个节点评估是否继续',
    },
  },
  {
    id: 'R_DEC_003',
    name: '边上班边测试 — 最低风险策略',
    condition(data) {
      return data.decisionStyleRaw?.level === 'side_test';
    },
    weight: 8,
    level: 'advantage',
    output: {
      title: '最明智的决策风格',
      description: '你选择边上班边小规模测试——这是认知诊断引擎推荐的最优策略',
      advice: '保持这个风格。用业余时间做3个小规模验证，哪个方向跑通了再评估是否扩大',
    },
  },
  {
    id: 'R_DEC_004',
    name: '先学再判断 — 容易转化为学习型拖延',
    condition(data) {
      return data.decisionStyleRaw?.level === 'learn_first' &&
             data.pastAttemptStageRaw?.level === 'bought_only';
    },
    weight: 30,
    level: 'fatal',
    output: {
      title: '学习变成了拖延',
      description: '你"先学再判断"的决策风格已经历史性地转化成了"只学不做"——你的过去一年证明了这一点',
      advice: '你已经学够了。30天内不允许购买任何新课程。用已经学会的东西完成一件能卖给别人的事',
    },
  },
  {
    id: 'R_DEC_005',
    name: '先学再判断 — 设定学习时间上限',
    condition(data) {
      return data.decisionStyleRaw?.level === 'learn_first' &&
             data.pastAttemptStageRaw?.level !== 'bought_only';
    },
    weight: 18,
    level: 'warning',
    output: {
      title: '学习型思维 — 设定硬性时间上限',
      description: '"先学习再行动"听起来合理，但多数人永远觉得学得不够',
      advice: '设一个硬性规则：学1周就做。1周后不管学完没有，立即进入行动阶段',
    },
  },
  {
    id: 'R_DEC_006',
    name: '等别人先做 — 错过了时间窗口',
    condition(data) {
      return data.decisionStyleRaw?.level === 'wait_for_proof';
    },
    weight: 24,
    level: 'fatal',
    output: {
      title: '你不可能等到确定性',
      description: '你"等别人先做了再跟上"——在互联网时代，你等到确定性时红利窗口已经关闭了',
      advice: '找到一个"你尊重的人正在做"的信号就足够了。不需要等到每个人都验证了',
    },
  },
  {
    id: 'R_DEC_007',
    name: '能不动就不动 — 执行惰性',
    condition(data) {
      return data.decisionStyleRaw?.level === 'avoid_all';
    },
    weight: 28,
    level: 'fatal',
    output: {
      title: '你不是"谨慎"，你在"逃避"',
      description: '你说"能不动就不动"——这不是风险偏好保守，这是执行惰性',
      advice: '你需要外力推动。今天就让一个朋友监督你：在48小时内完成一个具体的、有明确产出的小行动',
    },
  },
  {
    id: 'R_DEC_008',
    name: '能不动+有成交 — 你被恐惧困住',
    condition(data) {
      return data.decisionStyleRaw?.level === 'avoid_all' &&
             data.pastAttemptStageRaw?.level === 'small_sales';
    },
    weight: 26,
    level: 'fatal',
    output: {
      title: '你已经证明过自己，但不敢继续',
      description: '你有成交记录，证明你能做到。你不需要更多证据——你需要把成功经验放大',
      advice: '回顾你上一次成交的完整过程，忽略恐惧，复制那个过程中每一个可重复的步骤',
    },
  },
  {
    id: 'R_DEC_009',
    name: '边上班边测试+技术型 — 最安全的工程师创业路线',
    condition(data) {
      return data.decisionStyleRaw?.level === 'side_test' &&
             data.monetizableSkillRaw?.level === 'technical';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '工程师创业最佳策略',
      description: '你有技术+边上班边测试的决策风格——这是技术创业的最稳健路径',
      advice: '用业余时间做的第一个技术产品或服务，面向真实的付费用户验证，而不是闷头写半年代码',
    },
  },
  {
    id: 'R_DEC_010',
    name: 'all_in+执行力强+安全垫>12月 — 可以赌',
    condition(data) {
      return data.decisionStyleRaw?.level === 'all_in' &&
             data.executionStabilityRaw?.level === 'stable' &&
             data.safetyMonthsRaw?.level === 'strong';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '你具备All-in的条件',
      description: '安全垫充足+执行力强+有All-in勇气——这不是鲁莽，是计算过的冒险',
      advice: '给自己90天：退出一切不相关的活动，100%投入一个高杠杆方向。即使失败，你买到了无价的创业经验',
    },
  },
]
