/**
 * engine/rules/cashflowRules.js — V4 现金流规则 (15 rules)
 *
 * Rule ID range: R_CF_001 ~ R_CF_015
 */
module.exports = [
  // ═══════════════════════════════════════════════════════════
  // R_CF_001–R_CF_005: 月结余核心规则
  // ═══════════════════════════════════════════════════════════
  {
    id: 'R_CF_001',
    name: '月度赤字 — 生存警报',
    condition(data) {
      return data.monthlySurplusRaw?.level === 'negative';
    },
    weight: 35,
    level: 'fatal',
    output: {
      title: '现金流断裂',
      description: '每月支出超过收入，正在消耗储蓄。这不是发展问题，是生存问题',
      advice: '暂停所有投资/创业计划，第一优先级：削减支出使月结余归零，再找增收途径',
    },
  },
  {
    id: 'R_CF_002',
    name: '月结余为零 — 脆弱的平衡',
    condition(data) {
      return data.monthlySurplusRaw?.level === 'zero';
    },
    weight: 30,
    level: 'fatal',
    output: {
      title: '月光族 — 无燃料状态',
      description: '收支刚好持平，没有任何产能积累，一次意外就能触发危机',
      advice: '每月挤出至少500元作为第一笔投资资金，从减少非必要消费开始',
    },
  },
  {
    id: 'R_CF_003',
    name: '低结余 — 仅够生存',
    condition(data) {
      return data.monthlySurplusRaw?.level === 'low';
    },
    weight: 22,
    level: 'warning',
    output: {
      title: '月结余偏低',
      description: '一个月只能存下不超过5000元，试错空间有限',
      advice: '优先使用零成本验证方式（内容输出/社交获客/技能服务），不要投入需要金钱的试验',
    },
  },
  {
    id: 'R_CF_004',
    name: '中等结余 — 可验证',
    condition(data) {
      return data.monthlySurplusRaw?.level === 'moderate';
    },
    weight: 12,
    level: 'advantage',
    output: {
      title: '月度燃料充足',
      description: '月结余5000~10000，具备小规模试错的条件',
      advice: '每月可以拿出2000~3000作为验证预算，尝试至少3种变现方向，快速试错',
    },
  },
  {
    id: 'R_CF_005',
    name: '高结余 — 充沛行动燃料',
    condition(data) {
      return data.monthlySurplusRaw?.level === 'high' || data.monthlySurplusRaw?.level === 'moderate_high';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '高行动燃料',
      description: '月结余超过10000元，具备充足的试错和投资预算',
      advice: '不要把结余全部存银行。分三份：稳健投资40% + 技能提升30% + 高风险验证30%',
    },
  },

  // ═══════════════════════════════════════════════════════════
  // R_CF_006–R_CF_010: 安全垫规则
  // ═══════════════════════════════════════════════════════════
  {
    id: 'R_CF_006',
    name: '安全垫<1月 — 零容错',
    condition(data) {
      return data.safetyMonthsRaw?.level === 'critical';
    },
    weight: 35,
    level: 'fatal',
    output: {
      title: '零安全垫',
      description: '储蓄撑不到一个月——任何一个意外（生病/失业/家人出事）就是严重危机',
      advice: '立即暂停所有非必要支出和投资计划，100%聚焦建立3个月安全垫',
    },
  },
  {
    id: 'R_CF_007',
    name: '安全垫1-3月 — 极度脆弱',
    condition(data) {
      return data.safetyMonthsRaw?.level === 'very_low';
    },
    weight: 30,
    level: 'fatal',
    output: {
      title: '安全垫不足3个月',
      description: '连一次行业波动都扛不过去。焦虑来源于这个现实，不是认知问题',
      advice: '先把安全垫建到6个月再考虑任何需要前期投入的机会',
    },
  },
  {
    id: 'R_CF_008',
    name: '安全垫3-6月 — 勉强及格',
    condition(data) {
      return data.safetyMonthsRaw?.level === 'low';
    },
    weight: 22,
    level: 'warning',
    output: {
      title: '安全垫及格线',
      description: '3-6个月缓冲是及格线。可以开始小规模尝试，但不能做需要6个月以上才回本的事',
      advice: '保持安全垫不消耗的前提下，小型验证是可行的——用月结余而不是储蓄做实验',
    },
  },
  {
    id: 'R_CF_009',
    name: '安全垫6-12月 — 转型窗口',
    condition(data) {
      return data.safetyMonthsRaw?.level === 'moderate';
    },
    weight: 12,
    level: 'advantage',
    output: {
      title: '6个月转型窗口',
      description: '6-12个月安全垫给了转型选项权——这是80%的人不具备的奢侈',
      advice: '这是最好的转型时机：用主业稳住安全垫，专注用业余时间验证第二个方向',
    },
  },
  {
    id: 'R_CF_010',
    name: '安全垫>12月 — 选择权充沛',
    condition(data) {
      return data.safetyMonthsRaw?.level === 'strong';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '选择权最大化',
      description: '超过12个月的安全垫意味着可以承担一次完整的失败而不影响生存',
      advice: '不要再等。选择权不会自己变成行动。选出3个方向，每个投1个月验证',
    },
  },

  // ═══════════════════════════════════════════════════════════
  // R_CF_011–R_CF_012: 负债规则
  // ═══════════════════════════════════════════════════════════
  {
    id: 'R_CF_011',
    name: '消费贷/高负债 — 生存优先',
    condition(data) {
      return data.debtPressureRaw?.level === 'high';
    },
    weight: 35,
    level: 'fatal',
    output: {
      title: '高负债 — 一切问题的根源',
      description: '消费贷/高负债是认知翻身的最大障碍。利息在吞噬你未来的一切可能性',
      advice: '任何创业、投资、副业计划都必须暂停。第一优先级：消灭高利息债务',
    },
  },
  {
    id: 'R_CF_012',
    name: '房贷低月供 — 结构性负债可接受',
    condition(data) {
      return data.debtPressureRaw?.level === 'mortgage_low';
    },
    weight: 12,
    level: 'info',
    output: {
      title: '低月供房贷 — 正常负债',
      description: '低月供房贷属于结构性负债，只要你还有稳定收入可以覆盖',
      advice: '不需要急于还清房贷。把额外资金投入收益率更高的方向',
    },
  },
  {
    id: 'R_CF_013',
    name: '无负债+安全垫>12月 — 可承担创业风险',
    condition(data) {
      return data.debtPressureRaw?.level === 'none' &&
             data.safetyMonthsRaw?.level === 'strong';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '零负债 + 高安全垫 = 终极自由态',
      description: '没有债务负担，有充足安全垫——这是创业者最理想的启动状态',
      advice: '可以考虑以更大的赌注投入方向验证，但一次只赌一个方向',
    },
  },

  // ═══════════════════════════════════════════════════════════
  // R_CF_014–R_CF_015: 组合规则
  // ═══════════════════════════════════════════════════════════
  {
    id: 'R_CF_014',
    name: '高负债+想投资 — 禁止',
    condition(data) {
      return data.debtPressureRaw?.level === 'high';
    },
    weight: 35,
    level: 'fatal',
    output: {
      title: '高负债 — 一切投资必须暂停',
      description: '高负债状态下任何投资/创业/副业前期投入都可能变成新的债务负担',
      advice: '严禁任何杠杆投资、炒股、加密货币、借新债还旧债。先把高息债务降到可控水平',
    },
  },
  {
    id: 'R_CF_015',
    name: '月结余为负+安全垫<3月 — 极度紧急',
    condition(data) {
      return data.monthlySurplusRaw?.level === 'negative' &&
             (data.safetyMonthsRaw?.level === 'critical' || data.safetyMonthsRaw?.level === 'very_low');
    },
    weight: 35,
    level: 'fatal',
    output: {
      title: '双重现金流危机',
      description: '入不敷出且几乎无安全垫——这是最高等级的生存警告',
      advice: '停止一切非必需活动。降低支出、协商债务延期、寻找额外收入，先撑过30天',
    },
  },
]
