/**
 * engine/rules/incomeRules.js — V4 收入结构规则 (15 rules)
 *
 * Rule ID range: R_INC_001 ~ R_INC_015
 * Unified format: { id, name, condition(data), weight, level, output }
 */
module.exports = [
  // ═══════════════════════════════════════════════════════════
  // R_INC_001–R_INC_005: 工资/固定薪资路径
  // ═══════════════════════════════════════════════════════════
  {
    id: 'R_INC_001',
    name: '单工资依赖暴露',
    condition(data) {
      return data.incomeStructure === '工资/固定薪资' &&
             data.monthlySurplusRaw?.level === 'low';
    },
    weight: 30,
    level: 'fatal',
    output: {
      title: '单一工资依赖风险',
      description: '所有收入来自同一来源，月结余低，抗风险能力弱',
      advice: '在当前工作稳定期，必须用业余时间建立第二收入管道',
    },
  },
  {
    id: 'R_INC_002',
    name: '工资高结余 — 优势转化',
    condition(data) {
      return data.incomeStructure === '工资/固定薪资' &&
             (data.monthlySurplusRaw?.level === 'high' || data.monthlySurplusRaw?.level === 'moderate_high');
    },
    weight: 20,
    level: 'advantage',
    output: {
      title: '高收入结余 — 可系统化投资',
      description: '工资稳定且月结余充足，有条件系统化配置资产和建立副业',
      advice: '不要把结余全部消费——每月至少50%结余投入资产建设和技能投资',
    },
  },
  {
    id: 'R_INC_003',
    name: '工资 — 必须保留主业缓存',
    condition(data) {
      return data.incomeStructure === '工资/固定薪资' &&
             data.safetyMonthsRaw?.level !== 'strong';
    },
    weight: 25,
    level: 'warning',
    output: {
      title: '主业是安全垫',
      description: '安全垫不足，裸辞创业风险极高',
      advice: '保留主业现金流，用业余时间验证副业方向，至少6个月安全垫后再考虑切换',
    },
  },
  {
    id: 'R_INC_004',
    name: '工资+技术职业 — 技能商品化',
    condition(data) {
      return data.incomeStructure === '工资/固定薪资' &&
             data.monetizableSkillRaw?.level === 'technical';
    },
    weight: 18,
    level: 'advantage',
    output: {
      title: '技术能力可商品化',
      description: '拥有一项可独立交付的技术能力，具备脱离工资体系的潜在条件',
      advice: '将技术能力包装为独立服务，先在业余时间接单验证市场需求',
    },
  },
  {
    id: 'R_INC_005',
    name: '工资+无技能 — 先补能力',
    condition(data) {
      return data.incomeStructure === '工资/固定薪资' &&
             data.monetizableSkillRaw?.level === 'none';
    },
    weight: 28,
    level: 'fatal',
    output: {
      title: '无差异化能力',
      description: '仅有工资收入且无明确可变现技能，处于完全被动劳动状态',
      advice: '在保持工作的前提下，用6个月聚焦一个市场稀缺技能的刻意训练',
    },
  },

  // ═══════════════════════════════════════════════════════════
  // R_INC_006–R_INC_008: 技能服务/自由职业
  // ═══════════════════════════════════════════════════════════
  {
    id: 'R_INC_006',
    name: '技能服务 — 收入天花板可见',
    condition(data) {
      return data.incomeStructure === '技能服务（按次/项目收费）' &&
             data.monthlySurplusRaw?.level !== 'high';
    },
    weight: 22,
    level: 'warning',
    output: {
      title: '用时间换钱 — 无杠杆',
      description: '技能服务按次收费本质上仍是时间换钱，月结余低说明定价或效率不足',
      advice: '将技能产品或标准化，从按次收费升级为订阅/课程/授权等重复收入模式',
    },
  },
  {
    id: 'R_INC_007',
    name: '技能服务 — 已有市场验证',
    condition(data) {
      return data.incomeStructure === '技能服务（按次/项目收费）' &&
             data.skillValidationRaw?.level === 'market_validated';
    },
    weight: 15,
    level: 'advantage',
    output: {
      title: '技能已被市场验证',
      description: '你的能力已经被客户愿意付费验证过，这是最坚实的起点',
      advice: '扩大客户基数而不是提升技能深度——现在已经不需要再学，需要的是更多客户',
    },
  },
  {
    id: 'R_INC_008',
    name: '技能服务 — 不会获客',
    condition(data) {
      return data.incomeStructure === '技能服务（按次/项目收费）' &&
             data.monetizableSkillRaw?.level !== 'sales' &&
             data.pastAttemptStageRaw?.level === 'no_sales';
    },
    weight: 26,
    level: 'fatal',
    output: {
      title: '有技能无客户',
      description: '能干活但不会卖——这是技能服务者的经典死局',
      advice: '停止打磨技能，把70%时间投入在获取客户上：内容营销、社交获客、老客转介绍',
    },
  },

  // ═══════════════════════════════════════════════════════════
  // R_INC_009–R_INC_011: 销售/佣金
  // ═══════════════════════════════════════════════════════════
  {
    id: 'R_INC_009',
    name: '销售型 — 收入不稳定风险',
    condition(data) {
      return data.incomeStructure === '销售/佣金/提成' &&
             data.safetyMonthsRaw?.level === 'low';
    },
    weight: 28,
    level: 'fatal',
    output: {
      title: '佣金收入+薄安全垫=高危状态',
      description: '销售提成型收入本身波动大，安全垫不足意味着一个淡季就可能现金流断裂',
      advice: '优先建立6个月以上的安全垫，然后在淡季拓展第二条收入曲线',
    },
  },
  {
    id: 'R_INC_010',
    name: '销售 — 天然迁移做IP',
    condition(data) {
      return data.incomeStructure === '销售/佣金/提成' &&
             data.monetizableSkillRaw?.level === 'sales';
    },
    weight: 15,
    level: 'advantage',
    output: {
      title: '销售能力 × 个人IP — 高杠杆组合',
      description: '销售+谈判是人类社会最通用也最难被AI替代的能力，天然适合做个人IP',
      advice: '把销售方法论做内容输出，建立行业影响力，从卖别人的产品升级为卖自己',
    },
  },
  {
    id: 'R_INC_011',
    name: '销售 — 成交不等于事业',
    condition(data) {
      return data.incomeStructure === '销售/佣金/提成' &&
             data.pastAttemptStageRaw?.level !== 'stable_side' &&
             data.primaryGoalRaw?.level !== 'monetize';
    },
    weight: 20,
    level: 'warning',
    output: {
      title: '有成交无体系',
      description: '你的收入靠单笔成交驱动，没有系统化的获客和复购体系',
      advice: '把成交经验提炼为可复用的SOP，从靠人成交过渡到靠系统成交',
    },
  },

  // ═══════════════════════════════════════════════════════════
  // R_INC_012–R_INC_013: 实体生意
  // ═══════════════════════════════════════════════════════════
  {
    id: 'R_INC_012',
    name: '实体生意 — 重资产风险',
    condition(data) {
      return data.incomeStructure === '实体生意/经营收入' &&
             data.safetyMonthsRaw?.level !== 'strong';
    },
    weight: 32,
    level: 'fatal',
    output: {
      title: '实体经营+低安全垫=极度脆弱',
      description: '实体生意固定成本高，安全垫不足意味着一个差月就可以威胁生存',
      advice: '在维持实体运转的同时，立即建立线上变现渠道作为第二收入来源分流风险',
    },
  },
  {
    id: 'R_INC_013',
    name: '实体生意 — 内容化降维',
    condition(data) {
      return data.incomeStructure === '实体生意/经营收入' &&
             (data.monetizableSkillRaw?.level === 'craft' || data.monetizableSkillRaw?.level === 'sales');
    },
    weight: 18,
    level: 'advantage',
    output: {
      title: '实体经验可内容化',
      description: '实体经营经验+变现能力是稀缺组合，可以转化为内容资产',
      advice: '把实体经营的经验和方法论做成内容（短视频/文章/课程），建立线上收入管道',
    },
  },

  // ═══════════════════════════════════════════════════════════
  // R_INC_014–R_INC_015: 线上/不稳定收入
  // ═══════════════════════════════════════════════════════════
  {
    id: 'R_INC_014',
    name: '内容/流量 — 平台依赖风险',
    condition(data) {
      return data.incomeStructure === '线上内容/流量变现' &&
             data.monthlySurplusRaw?.level === 'low';
    },
    weight: 22,
    level: 'warning',
    output: {
      title: '内容变现欠稳定',
      description: '线上内容变现受平台算法和流量波动影响大，月结余低说明流量还未稳定',
      advice: '在维持内容输出的同时，建立私域流量池和多元化变现渠道（课程/咨询/带货）',
    },
  },
  {
    id: 'R_INC_015',
    name: '收入不稳定 — 现金流第一',
    condition(data) {
      return data.incomeStructure === '收入不稳定' &&
             data.safetyMonthsRaw?.level !== 'strong';
    },
    weight: 30,
    level: 'fatal',
    output: {
      title: '收入不稳定+安全垫不足',
      description: '这是最高风险组合之一。收入波动大且没有足够的缓冲，随时可能断流',
      advice: '立即优先稳定基本现金流——找一份稳定收入的兼职或降低非必要支出',
    },
  },
]
