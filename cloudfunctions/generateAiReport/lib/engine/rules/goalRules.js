/**
 * engine/rules/goalRules.js — V4 目标规则 (10 rules)
 *
 * Rule ID range: R_GOAL_001 ~ R_GOAL_010
 */
module.exports = [
  {
    id: 'R_GOAL_001',
    name: '副业收入目标 — 需要时间+技能',
    condition(data) {
      return data.primaryGoalRaw?.level === 'side_hustle' &&
             data.weeklyTimeRaw?.level === 'very_low';
    },
    weight: 28,
    level: 'fatal',
    output: {
      title: '目标与时间不匹配',
      description: '你想搞副业但每周可支配时间不足2小时——这个时间量几乎不可能建立任何有意义的副业',
      advice: '先释放时间（减少娱乐/简化日程/外包），或调整目标为"验证一个可行方向"',
    },
  },
  {
    id: 'R_GOAL_002',
    name: '技能变现目标 — 需要已完成验证',
    condition(data) {
      return data.primaryGoalRaw?.level === 'monetize' &&
             data.skillValidationRaw?.level === 'never';
    },
    weight: 26,
    level: 'fatal',
    output: {
      title: '目标跳过了验证阶段',
      description: '你想把技能变现，但你的能力还从未被市场验证过——需要先验证再变现',
      advice: '在设定变现目标前，先完成一次付费验证。收费99元做一件你能做的事',
    },
  },
  {
    id: 'R_GOAL_003',
    name: '个人品牌目标 — 需要内容能力+时间',
    condition(data) {
      return data.primaryGoalRaw?.level === 'brand' &&
             data.monetizableSkillRaw?.level !== 'content' &&
             data.weeklyTimeRaw?.level === 'very_low';
    },
    weight: 26,
    level: 'fatal',
    output: {
      title: '建立品牌的前提条件不足',
      description: '做个人IP需要持续的内容输出能力+大量时间投入，你的当前条件不支持这个目标',
      advice: '先降低目标：做一个垂直领域的专业号，每周只发2条，验证内容能力后再考虑品牌',
    },
  },
  {
    id: 'R_GOAL_004',
    name: '转行目标 — 需要安全垫+技能',
    condition(data) {
      return data.primaryGoalRaw?.level === 'transition' &&
             data.safetyMonthsRaw?.level === 'low';
    },
    weight: 24,
    level: 'warning',
    output: {
      title: '转行安全垫不足',
      description: '转行过程中收入可能中断，3-6个月安全垫只是及格线',
      advice: '先建立6个月以上安全垫，或在现有行业内寻找可以软着陆的机会',
    },
  },
  {
    id: 'R_GOAL_005',
    name: '副业转主业 — 需要收入验证',
    condition(data) {
      return data.primaryGoalRaw?.level === 'transition_full' &&
             data.pastAttemptStageRaw?.level !== 'stable_side';
    },
    weight: 30,
    level: 'fatal',
    output: {
      title: '尚不具备副业转主业的条件',
      description: '你想从副业转为全职，但你还没有稳定的副业收入——跳跃过大',
      advice: '在副业收入达到主业60%且持续6个月以上之前，保留主业作为安全网',
    },
  },
  {
    id: 'R_GOAL_006',
    name: '还债目标 — 正确的第一焦点',
    condition(data) {
      return data.primaryGoalRaw?.level === 'debt_repair' &&
             data.debtPressureRaw?.level === 'high';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '目标与现状匹配',
      description: '你的目标（还债/修复现金流）与你的现实（高负债）完全一致——先把债务处理好',
      advice: '专注消灭高息债务，这是回报率最高的"投资"。其他一切计划排在债务后',
    },
  },
  {
    id: 'R_GOAL_007',
    name: '找方向目标 — 验证你自己',
    condition(data) {
      return data.primaryGoalRaw?.level === 'find_direction' &&
             data.monetizableSkillRaw?.level !== 'none' &&
             data.skillValidationRaw?.level !== 'never';
    },
    weight: 16,
    level: 'warning',
    output: {
      title: '你有能力但没认出来',
      description: '你说要先找到方向，但实际上你已经有可用的技能和一定的市场反馈——你只是不相信自己',
      advice: '你不需要更远的"方向"。选择你已经会的、有人认可的任意一件事，用30天专注做',
    },
  },
  {
    id: 'R_GOAL_008',
    name: '找到方向+零方向 — 需要外部视角',
    condition(data) {
      return data.primaryGoalRaw?.level === 'find_direction' &&
             data.monetizableSkillRaw?.level === 'none' &&
             data.skillValidationRaw?.level === 'never';
    },
    weight: 24,
    level: 'fatal',
    output: {
      title: '你确实需要找到方向',
      description: '你已经诚实地承认自己不知道往哪里走——这是很多人的真实状态',
      advice: '做一次系统的能力盘点：把你会的事列出来（哪怕只会Excel函数），然后问10个人"你觉得我可以用这个做什么赚钱"',
    },
  },
  {
    id: 'R_GOAL_009',
    name: '副业目标+有技能+有时间 — 可立即启动',
    condition(data) {
      return data.primaryGoalRaw?.level === 'side_hustle' &&
             data.monetizableSkillRaw?.level !== 'none' &&
             (data.weeklyTimeRaw?.level === 'high' || data.weeklyTimeRaw?.level === 'moderate');
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '启动条件全部满足',
      description: '你有变现能力+充足时间+明确目标——可以立即启动',
      advice: '不要做计划。今天就做第一件能产生收入的事。计划是你拖延的借口',
    },
  },
  {
    id: 'R_GOAL_010',
    name: '还债目标+高负债 — 最正确的优先序',
    condition(data) {
      return data.primaryGoalRaw?.level === 'debt_repair' &&
             (data.debtPressureRaw?.level === 'high' || data.debtPressureRaw?.level === 'consumer');
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '优先序正确',
      description: '当前最聪明的策略就是先修复财务基础——你的目标跟你的现状是完全匹配的',
      advice: '按利率从高到低消灭债务，期间保持生活最小化。每消灭一笔债，你离自由就近一步',
    },
  },
]
