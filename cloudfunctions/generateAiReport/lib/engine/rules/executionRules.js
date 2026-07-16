/**
 * engine/rules/executionRules.js — V4 执行规则 (15 rules)
 *
 * Rule ID range: R_EXEC_001 ~ R_EXEC_015
 */
module.exports = [
  {
    id: 'R_EXEC_001',
    name: '三分钟热度 — 不推荐长周期项目',
    condition(data) {
      return data.executionStabilityRaw?.level === 'very_low';
    },
    weight: 28,
    level: 'fatal',
    output: {
      title: '执行力极弱',
      description: '计划经常中断，三分钟热度——这是长期项目的第一杀手',
      advice: '不要选任何需要30天以上才能看到反馈的项目。选一个3天内就可以完成的小事，先建立正反馈循环',
    },
  },
  {
    id: 'R_EXEC_002',
    name: '不稳定执行 — 需要外部约束',
    condition(data) {
      return data.executionStabilityRaw?.level === 'low';
    },
    weight: 22,
    level: 'warning',
    output: {
      title: '执行力不稳定',
      description: '偶尔能坚持但不稳定——需要建立外部约束机制',
      advice: '找人监督或加入社群，用外部责任驱动执行。把长期目标拆解成每天的30分钟任务',
    },
  },
  {
    id: 'R_EXEC_003',
    name: '有计划能执行 — 系统化加速',
    condition(data) {
      return data.executionStabilityRaw?.level === 'moderate';
    },
    weight: 12,
    level: 'advantage',
    output: {
      title: '执行稳定 — 系统化即可加速',
      description: '有固定计划且基本能执行——这是可持续进步的基础',
      advice: '在现有节奏基础上增加量化指标：每天做了什么，每周输出了什么，每月赚了多少',
    },
  },
  {
    id: 'R_EXEC_004',
    name: '极高执行力 — 唯一限制是机会质量',
    condition(data) {
      return data.executionStabilityRaw?.level === 'stable';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '执行力天花板',
      description: '非常稳定不需要外部督促——你的产能是绝大多数人的3-5倍',
      advice: '你现在只需要一个正确的方向。确保你把执行力投在了高杠杆的事情上',
    },
  },
  {
    id: 'R_EXEC_005',
    name: '买过课但没行动 — 学习型拖延',
    condition(data) {
      return data.pastAttemptStageRaw?.level === 'bought_only' &&
             data.executionStabilityRaw?.level !== 'stable';
    },
    weight: 30,
    level: 'fatal',
    output: {
      title: '购买课程/书籍≠行动',
      description: '你过去一年"只买过课没做过"，把消费误当成了行动。这是最常见的自我欺骗模式',
      advice: '停止购买任何新课。选一个你已买的课程，不看完全部内容——看完前30分钟就做',
    },
  },
  {
    id: 'R_EXEC_006',
    name: '<30天放弃 — 需要极短正反馈',
    condition(data) {
      return data.pastAttemptStageRaw?.level === 'under_30_days' &&
             data.executionStabilityRaw?.level !== 'stable';
    },
    weight: 28,
    level: 'fatal',
    output: {
      title: '持续不超过30天的尝试',
      description: '你的过去的行动都在30天内中断——你的反馈周期设置得太长了',
      advice: '选一个7天就可以看到明确成果的小项目。在7天内完成一轮获客→成交→交付',
    },
  },
  {
    id: 'R_EXEC_007',
    name: '做过但没卖掉 — 缺卖的能力',
    condition(data) {
      return data.pastAttemptStageRaw?.level === 'built_no_sale';
    },
    weight: 26,
    level: 'fatal',
    output: {
      title: '有产品无销售',
      description: '你做出了产品但没卖出去——这说明"做"不是问题，"卖"才是',
      advice: '接下来的30天，把所有时间花在销售上。每天至少联系5个潜在客户',
    },
  },
  {
    id: 'R_EXEC_008',
    name: '已有小额成交 — 复制>学习',
    condition(data) {
      return data.pastAttemptStageRaw?.level === 'small_sales';
    },
    weight: 14,
    level: 'advantage',
    output: {
      title: '已有成交信号',
      description: '你有小规模的成交记录，已经找到了一条可行的路。现在不需要再"想"，只需要"做更多"',
      advice: '优先复制已成功的成交模式：找到第一个客户从哪里来的，在那个渠道再做10倍投入',
    },
  },
  {
    id: 'R_EXEC_009',
    name: '已有稳定副业 — 考虑放大的时间点',
    condition(data) {
      return data.pastAttemptStageRaw?.level === 'stable_side';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '稳定副业收入 — 评估放大时机',
      description: '你已经建立了稳定的副业收入流，这是极其稀缺的成果',
      advice: '评估：副业收入是否达到主业60%？客户是否稳定？是的话可以考虑从副业过渡到主业',
    },
  },
  {
    id: 'R_EXEC_010',
    name: '从未开始 — 不是资源问题是心理问题',
    condition(data) {
      return data.pastAttemptStageRaw?.level === 'never' &&
             data.executionStabilityRaw?.level !== 'stable';
    },
    weight: 30,
    level: 'fatal',
    output: {
      title: '尚未迈出第一步',
      description: '过去一年没有任何赚钱尝试——不是能力不够，是被完美主义和恐惧困住了',
      advice: '今天做完这件事：选一个你觉得聊胜于无的方向，花30分钟做最小可执行的行动（发一条内容、发一条私信、挂一个链接）',
    },
  },
  {
    id: 'R_EXEC_011',
    name: '执行力弱+目标是建立事业 — 严重错配',
    condition(data) {
      return data.executionStabilityRaw?.level === 'very_low' &&
             (data.primaryGoalRaw?.level === 'brand' || data.primaryGoalRaw?.level === 'transition');
    },
    weight: 30,
    level: 'fatal',
    output: {
      title: '执行力与目标严重错配',
      description: '你想建立个人品牌或转行，但你的执行力极弱——目标需要1年以上持续输出，你连30天都坚持不了',
      advice: '把"建立品牌/转行"的大目标拆成30天内可见成果的小目标：写一篇/发一个视频/建一个社群',
    },
  },
  {
    id: 'R_EXEC_012',
    name: '执行强+有成交 — 飞轮已启动',
    condition(data) {
      return data.executionStabilityRaw?.level === 'stable' &&
             data.pastAttemptStageRaw?.level === 'small_sales';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '正向飞轮',
      description: '执行力强且有成交记录——你已经证明了你可以执行并获取回报',
      advice: '只需建立系统化：设定每周最低成交目标，用你的执行力把成交规模化',
    },
  },
  {
    id: 'R_EXEC_013',
    name: '执行弱+技能未验证 — 先修底层',
    condition(data) {
      return data.executionStabilityRaw?.level === 'very_low' &&
             data.skillValidationRaw?.level === 'never';
    },
    weight: 28,
    level: 'fatal',
    output: {
      title: '双短板 — 需要底层重建',
      description: '执行力弱+能力未验证——你需要先从建立基本的行动力和技能基底开始',
      advice: '先不需要考虑副业/创业。用3个月聚焦做两件事：①每天固定时间做一件事（培养行动力）②完成一次付费技能验证',
    },
  },
  {
    id: 'R_EXEC_014',
    name: '执行强+目标明确+有时间 — 最佳创业者画像',
    condition(data) {
      return data.executionStabilityRaw?.level === 'stable' &&
             data.primaryGoalRaw?.level === 'monetize' &&
             (data.weeklyTimeRaw?.level === 'high' || data.weeklyTimeRaw?.level === 'moderate');
    },
    weight: 8,
    level: 'advantage',
    output: {
      title: '最佳创业者画像',
      description: '执行力强+变现目标明确+时间充裕——这是认知诊断引擎能识别的最佳组合',
      advice: '唯一限制你的是选择了哪个方向。参考技能评估结果选择最有杠杆的变现路径',
    },
  },
  {
    id: 'R_EXEC_015',
    name: '执行强+10小时以上+安全垫足 — 可以全职冲刺',
    condition(data) {
      return data.executionStabilityRaw?.level === 'stable' &&
             (data.weeklyTimeRaw?.level === 'high') &&
             data.safetyMonthsRaw?.level === 'strong';
    },
    weight: 8,
    level: 'advantage',
    output: {
      title: '全职冲刺条件成熟',
      description: '执行力、时间和安全垫三项全部达标，你具备了90天全职冲刺的条件',
      advice: '如果主业不满意，考虑用这90天做一次全力冲刺。即使失败，你也能承受',
    },
  },
]
