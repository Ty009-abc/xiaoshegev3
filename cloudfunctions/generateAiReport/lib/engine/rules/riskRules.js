/**
 * engine/rules/riskRules.js — V4 风险规则 (10 rules)
 *
 * Rule ID range: R_RISK_001 ~ R_RISK_010
 */
module.exports = [
  {
    id: 'R_RISK_001',
    name: '零试错成本 — 只能做免费行动',
    condition(data) {
      return data.maxTrialCostRaw?.level === 'zero';
    },
    weight: 30,
    level: 'fatal',
    output: {
      title: '零试错成本 — 赔不起任何损失',
      description: '你无法承受任何金钱损失，任何需要前期投入的路径都被自动排除',
      advice: '所有试错必须零成本：发布内容/联系潜在客户/学习免费资源。用时间而非金钱做交易',
    },
  },
  {
    id: 'R_RISK_002',
    name: '试错成本<1000 — 仅轻量测试',
    condition(data) {
      return data.maxTrialCostRaw?.level === 'very_low';
    },
    weight: 22,
    level: 'warning',
    output: {
      title: '试错空间极小',
      description: '1000元的试错预算意味着只能用几乎零成本的方式验证方向',
      advice: '选不需要金钱投入的验证方式：发布内容、接免费项目做成案例、社交获客',
    },
  },
  {
    id: 'R_RISK_003',
    name: '试错成本1-5k — 可小规模实验',
    condition(data) {
      return data.maxTrialCostRaw?.level === 'low';
    },
    weight: 14,
    level: 'info',
    output: {
      title: '有限试错空间',
      description: '1000-5000元预算够做几次小型市场验证',
      advice: '把预算分3-5份，每份验证一个方向。失败了还有剩余预算',
    },
  },
  {
    id: 'R_RISK_004',
    name: '试错成本5-20k — 可深度验证',
    condition(data) {
      return data.maxTrialCostRaw?.level === 'moderate';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '足够的试错预算',
      description: '5000-20000预算可以做一个完整的验证周期',
      advice: '可以做需要前期投入的验证：购买设备/工具、外包一部分工作、做付费广告测试',
    },
  },
  {
    id: 'R_RISK_005',
    name: '试错成本>20k — 试错空间充足',
    condition(data) {
      return data.maxTrialCostRaw?.level === 'high';
    },
    weight: 8,
    level: 'advantage',
    output: {
      title: '充足的试错预算',
      description: '20000+试错成本让以下选项成为可能：租场地、建网站、做广告测试、外包',
      advice: '不要把全部预算一次投完。分5个阶段验证，每个阶段4k预算，每次总结迭代',
    },
  },

  {
    id: 'R_RISK_006',
    name: '失败就放弃 — 只能选最短正反馈路径',
    condition(data) {
      return data.failureResponseRaw?.level === 'give_up';
    },
    weight: 28,
    level: 'fatal',
    output: {
      title: '失败容错率极低',
      description: '你说失败后会直接放弃——这意味着你的风险取向要求极高成功率的项目',
      advice: '不要冒险。选成功率最高的路径：利用已有技能接单、做已有需求的服务',
    },
  },
  {
    id: 'R_RISK_007',
    name: 'failureResponse=换方向 — 多方向短测试',
    condition(data) {
      return data.failureResponseRaw?.level === 'change_direction';
    },
    weight: 12,
    level: 'info',
    output: {
      title: '快速换方向型',
      description: '失败后你会换方向继续试——这其实是科学实验的姿势',
      advice: '每个方向花不超过1个月验证，明确判断止损条件。这样可以快速试3-5个方向',
    },
  },
  {
    id: 'R_RISK_008',
    name: '复盘优化型 — 最佳创业心态',
    condition(data) {
      return data.failureResponseRaw?.level === 'review_optimize';
    },
    weight: 8,
    level: 'advantage',
    output: {
      title: '最健康的失败应对方式',
      description: '你说失败后会复盘优化——这是所有成功创业者共有的心态',
      advice: '你的失败不会白费。确保每次尝试都记录了"做对了什么/做错了什么/学到了什么"',
    },
  },
  {
    id: 'R_RISK_009',
    name: '会追加投入 — 需严防沉没成本陷阱',
    condition(data) {
      return data.failureResponseRaw?.level === 'add_money';
    },
    weight: 26,
    level: 'fatal',
    output: {
      title: '沉没成本陷阱 — 高风险倾向',
      description: '失败后你会追加投入——这是所有破产故事中最常见的模式',
      advice: '每次投入前设硬止损线：如果投入超过X或不到Y回报，立即停止。遵守这个规则',
    },
  },
  {
    id: 'R_RISK_010',
    name: '零试错成本+会追加投入 — 极高风险冲动组合',
    condition(data) {
      return data.maxTrialCostRaw?.level === 'zero' &&
             data.failureResponseRaw?.level === 'add_money';
    },
    weight: 32,
    level: 'fatal',
    output: {
      title: '最具破坏性的风险组合',
      description: '你说赔不起任何钱，但又说失败了会追加投入——这是一个在自我否定中的危险回路',
      advice: '严格禁止借钱或动用必需资金进行任何投资。所有行动必须严格控制在零成本范围内',
    },
  },
]
