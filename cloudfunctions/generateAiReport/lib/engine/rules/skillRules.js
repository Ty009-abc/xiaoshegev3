/**
 * engine/rules/skillRules.js — V4 技能规则 (15 rules)
 *
 * Rule ID range: R_SKL_001 ~ R_SKL_015
 */
module.exports = [
  // ═══════════════════════════════════════════════════════════
  // R_SKL_001–R_SKL_005: 技能验证程度
  // ═══════════════════════════════════════════════════════════
  {
    id: 'R_SKL_001',
    name: '从未变现 — 一切问题的根源',
    condition(data) {
      return data.skillValidationRaw?.level === 'never';
    },
    weight: 32,
    level: 'fatal',
    output: {
      title: '能力未被市场验证',
      description: '你的能力从未换到过钱。在商业世界，未被付费验证的能力等于不存在',
      advice: '选一个最小可行方向，用不超过1个月时间完成第一次付费验证。免费的不算',
    },
  },
  {
    id: 'R_SKL_002',
    name: '免费帮过 — 未形成价值认知',
    condition(data) {
      return data.skillValidationRaw?.level === 'unpaid';
    },
    weight: 26,
    level: 'fatal',
    output: {
      title: '免费使用不等于有市场价值',
      description: '有人免费用过你的能力不等于有人愿意为之付费。免费和付费是完全不同的定价体系',
      advice: '下次有人需要你帮忙时开口报价，哪怕只收99元。赚钱的心理门槛必须突破',
    },
  },
  {
    id: 'R_SKL_003',
    name: '赚过一次 — 待复制',
    condition(data) {
      return data.skillValidationRaw?.level === 'earned_once';
    },
    weight: 18,
    level: 'warning',
    output: {
      title: '有一次付费≠有稳定变现能力',
      description: '赚过一次钱证明模式可行，但一次交易是偶然，连续交易才是生意',
      advice: '分析那一次成交的完整链路，总结可复制的获客→成交→交付SOP',
    },
  },
  {
    id: 'R_SKL_004',
    name: '市场已验证 — 扩大而非学习',
    condition(data) {
      return data.skillValidationRaw?.level === 'market_validated';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '能力已被市场反复验证',
      description: '你的能力已经被市场愿意掏钱认可——这是最坚实的起点',
      advice: '停止学习新技能。把100%精力投入在扩大客户基数、提价、产品化上',
    },
  },
  {
    id: 'R_SKL_005',
    name: '有稳定客户 — 接近独立',
    condition(data) {
      return data.skillValidationRaw?.level === 'stable_clients';
    },
    weight: 8,
    level: 'advantage',
    output: {
      title: '已有稳定客户群',
      description: '你已经建立了可持续的收入来源——再往前一步就可以独立',
      advice: '评估每月客户收入是否超过主业60%，如果达到了，可以开始考虑过渡到全职独立',
    },
  },

  // ═══════════════════════════════════════════════════════════
  // R_SKL_006–R_SKL_010: 变现能力类型
  // ═══════════════════════════════════════════════════════════
  {
    id: 'R_SKL_006',
    name: '技术型+未验证 — 缺的不是技能是客户',
    condition(data) {
      return data.monetizableSkillRaw?.level === 'technical' &&
             data.skillValidationRaw?.level !== 'market_validated';
    },
    weight: 24,
    level: 'fatal',
    output: {
      title: '技术强但无客户 — 技术人员经典困境',
      description: '你有硬技能但没有客户。你缺的不是更多的技术，是把技术变成商品的能力',
      advice: '立即停止学习新技术。做以下三件事：①建一个展示能力的作品集 ②在社交平台输出专业内容 ③主动联系10个潜在客户',
    },
  },
  {
    id: 'R_SKL_007',
    name: '销售/商务型+已验证 — 最强变现引擎',
    condition(data) {
      return data.monetizableSkillRaw?.level === 'sales' &&
             data.skillValidationRaw?.level === 'market_validated';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '销售能力+市场验证=超强变现',
      description: '销售和谈判是最通用也最难被替代的能力，你已有市场验证，这是一个完美的起步',
      advice: '把销售能力产品化：做销售培训/陪跑服务/销售体系咨询。从卖别人的产品升级为卖自己',
    },
  },
  {
    id: 'R_SKL_008',
    name: '手艺人型 — 轻资产优先',
    condition(data) {
      return data.monetizableSkillRaw?.level === 'craft';
    },
    weight: 22,
    level: 'warning',
    output: {
      title: '手艺人是轻资产黄金赛道',
      description: '手艺是最稳定不会被AI替代的能力——但你必须学会内容化才能放大收入',
      advice: '用短视频记录手艺过程→积累粉丝→线上课程/私域服务，不要急着开实体店',
    },
  },
  {
    id: 'R_SKL_009',
    name: '内容创作型 — 长周期商业',
    condition(data) {
      return data.monetizableSkillRaw?.level === 'content' &&
             data.safetyMonthsRaw?.level !== 'strong';
    },
    weight: 22,
    level: 'warning',
    output: {
      title: '内容创作+安全垫不足',
      description: '内容创作为主的收入模式通常需要6-12个月积累期，安全垫不足会很煎熬',
      advice: '保持一份稳定收入来源，用业余时间做内容。内容变现之前保持主业',
    },
  },
  {
    id: 'R_SKL_010',
    name: '运营/管理型 — 组织化变现',
    condition(data) {
      return data.monetizableSkillRaw?.level === 'operations';
    },
    weight: 14,
    level: 'info',
    output: {
      title: '运营管理能力 — 组织杠杆',
      description: '运营能力在独立状态下的价值低于组织内。需要考虑如何将组织能力转化为独立服务',
      advice: '运营顾问/效率教练/外包运营服务是三可行的独立方向',
    },
  },

  // ═══════════════════════════════════════════════════════════
  // R_SKL_011–R_SKL_015: 技能组合与路径
  // ═══════════════════════════════════════════════════════════
  {
    id: 'R_SKL_011',
    name: '技术+销售组合 — 最强的独立组合',
    condition(data) {
      return data.monetizableSkillRaw?.level === 'technical' &&
             data.monetizableSkillRaw?.secondaryLevel === 'sales';
    },
    weight: 12,
    level: 'advantage',
    output: {
      title: '技+销双引擎',
      description: '会技术又会销售——这是独立创业者的终极组合',
      advice: '从技术服务切入获客，逐步建立自己的小团队，放大销售能力',
    },
  },
  {
    id: 'R_SKL_012',
    name: '不明确能力 — 先盘点再行动',
    condition(data) {
      return data.monetizableSkillRaw?.level === 'none' &&
             data.skillValidationRaw?.level === 'never';
    },
    weight: 30,
    level: 'fatal',
    output: {
      title: '无方向无验证',
      description: '不知道自己有什么能力，也从未试图变现——这是最初始状态',
      advice: '先用两周做三件事：①列出你会的所有技能（哪怕是小技能）②问5个朋友：你愿意为我付钱做什么 ③找一个低门槛平台接第一个单',
    },
  },
  {
    id: 'R_SKL_013',
    name: '已有稳定成交 — 禁止继续学技能',
    condition(data) {
      return data.skillValidationRaw?.level === 'stable_clients' &&
             data.pastAttemptStageRaw?.level !== 'stable_side';
    },
    weight: 20,
    level: 'warning',
    output: {
      title: '已有付费客户 — 不该再"学习"',
      description: '你已经有了愿意付费的客户，停止到处学新技能。扩大客户群比学会第N个技能重要100倍',
      advice: '聚焦三件事：①涨价20% ②问客户要介绍 ③每周发一条专业内容',
    },
  },
  {
    id: 'R_SKL_014',
    name: '人脉型 — 需验证变现闭环',
    condition(data) {
      return data.monetizableSkillRaw?.level === 'network';
    },
    weight: 18,
    level: 'warning',
    output: {
      title: '人脉资源 — 要转化为可重复变现',
      description: '人脉是杠杆但不是收入模式。如果没有可售卖的服务，人脉只是电话号码本',
      advice: '找一个你可以独立提供的服务，用你的人脉网络作为第一个渠道',
    },
  },
  {
    id: 'R_SKL_015',
    name: '技术型+有验证 — 产品化路径',
    condition(data) {
      return data.monetizableSkillRaw?.level === 'technical' &&
             data.skillValidationRaw?.level === 'market_validated';
    },
    weight: 10,
    level: 'advantage',
    output: {
      title: '已验证技术=可产品化',
      description: '技术硬能力+市场验证=最稳定的产品化基础',
      advice: '把一次性的技术交付转为SaaS/工具/标准化服务包，从按时间收费转向按价值收费',
    },
  },
]
