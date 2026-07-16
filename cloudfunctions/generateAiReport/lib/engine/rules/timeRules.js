/**
 * engine/rules/timeRules.js — V4 时间规则 (10 rules)
 *
 * Rule ID range: R_TIME_001 ~ R_TIME_010
 */
module.exports = [
  {
    id: 'R_TIME_001',
    name: '每周<2小时 — 极低行动容量',
    condition(data) {
      return data.weeklyTimeRaw?.level === 'very_low';
    },
    weight: 30,
    level: 'fatal',
    output: {
      title: '时间极度匮乏',
      description: '每周可自由支配时间不足2小时，几乎不可能开展任何副业',
      advice: '先优化时间结构：外包低价值任务、简化日程、寻求高效工具。时间不够是优先级问题不是客观约束',
    },
  },
  {
    id: 'R_TIME_002',
    name: '2-5小时 — 轻量验证可行',
    condition(data) {
      return data.weeklyTimeRaw?.level === 'low';
    },
    weight: 18,
    level: 'warning',
    output: {
      title: '每周2-5小时 — 仅够轻量验证',
      description: '5小时/周足够做一个简单的内容账号或接到1-2个外包小单',
      advice: '把2-5小时全投入一个方向，不要分散。选一个30分钟就能出成果的任务',
    },
  },
  {
    id: 'R_TIME_003',
    name: '5-10小时 — 可做深度副业',
    condition(data) {
      return data.weeklyTimeRaw?.level === 'moderate_low';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '每周5-10小时 — 中等行动容量',
      description: '5-10小时/周可以做一份需要每周持续投入的副业',
      advice: '每天保持1-2小时固定时间投入，周末集中做需要深度思考的事',
    },
  },
  {
    id: 'R_TIME_004',
    name: '10-20小时 — 副业加速',
    condition(data) {
      return data.weeklyTimeRaw?.level === 'moderate';
    },
    weight: 8,
    level: 'advantage',
    output: {
      title: '每周10-20小时 — 充足行动容量',
      description: '每周有2-3个整天或每天2-3小时，可以做一份需要系统运营的副业',
      advice: '把时间分为三块：获客40%/交付40%/学习迭代20%',
    },
  },
  {
    id: 'R_TIME_005',
    name: '>20小时 — 全职级别的自由',
    condition(data) {
      return data.weeklyTimeRaw?.level === 'high';
    },
    weight: 8,
    level: 'advantage',
    output: {
      title: '每周20+小时 — 近乎全职创业时间',
      description: '你拥有的自由时间等于半个全职创业者',
      advice: '按创业的标准要求自己：设定月度里程碑、做周复盘、规划季度目标',
    },
  },

  // ═══════════════════════════════════════════════════════════
  // R_TIME_006–R_TIME_010: 时间与其它维度的交叉
  // ═══════════════════════════════════════════════════════════
  {
    id: 'R_TIME_006',
    name: '时间少+目标大 — 目标需要收缩',
    condition(data) {
      return data.weeklyTimeRaw?.level === 'very_low' &&
             (data.primaryGoalRaw?.level === 'side_hustle' || data.primaryGoalRaw?.level === 'brand');
    },
    weight: 26,
    level: 'fatal',
    output: {
      title: '时间与目标严重不匹配',
      description: '你想做副业/建立品牌但每周只有不到2小时——这个时间量连启动都成问题',
      advice: '要么释放更多时间（减少娱乐/无效社交/低价值任务），要么把目标缩小为"验证一个可行方向"',
    },
  },
  {
    id: 'R_TIME_007',
    name: '时间少+技能强 — 高时薪外包',
    condition(data) {
      return data.weeklyTimeRaw?.level === 'low' &&
             data.skillValidationRaw?.level === 'market_validated';
    },
    weight: 12,
    level: 'info',
    output: {
      title: '用钱换时间',
      description: '你已有被验证的技能但时间有限，应该考虑外包低价值任务释放时间',
      advice: '把小时时薪在50元以下的任务全部外包。用释放出的时间做高价值交付',
    },
  },
  {
    id: 'R_TIME_008',
    name: '时间充裕+执行力强 — 需要方向',
    condition(data) {
      return (data.weeklyTimeRaw?.level === 'high' || data.weeklyTimeRaw?.level === 'moderate') &&
             data.executionStabilityRaw?.level === 'stable' &&
             data.monetizableSkillRaw?.level === 'none';
    },
    weight: 22,
    level: 'warning',
    output: {
      title: '有时间有行动力但缺方向',
      description: '你具备创业最重要的条件——时间和执行力，但卡在没有明确的变现能力上',
      advice: '选一个跟你职业相关的技能，用30天时间做刻意训练和免费输出，看市场反馈',
    },
  },
  {
    id: 'R_TIME_009',
    name: '零碎时间用户 — 自动化/内容优先',
    condition(data) {
      return data.weeklyTimeRaw?.level === 'low' ||
             data.weeklyTimeRaw?.level === 'moderate_low';
    },
    weight: 14,
    level: 'info',
    output: {
      title: '碎片化时间利用',
      description: '你的可用时间是碎片化的——不适合需要长块时间投入的事',
      advice: '选择可以在30分钟以内出成果的事：发一条内容/联系一个客户/做一个小任务',
    },
  },
  {
    id: 'R_TIME_010',
    name: '时间充裕+安全垫足 — 可全职探索',
    condition(data) {
      return (data.weeklyTimeRaw?.level === 'high') &&
             data.safetyMonthsRaw?.level === 'strong' &&
             data.debtPressureRaw?.level === 'none';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '最佳创业条件 — 时间+金钱双自由',
      description: '你有时间、有安全垫、没负债——这是创业的黄金条件',
      advice: '不要满足于小规模副业。把这个条件用来做一件需要3-6个月才能见到回报的事',
    },
  },
]
