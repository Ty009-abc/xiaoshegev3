/**
 * turnaroundEngine.js — TURNAROUND_DIAGNOSIS_10Q_DECISION_ENGINE_V1
 *
 * 现实约束引擎 + 交叉规则引擎
 * 禁止 AI 根据 10 题答案自由发挥
 * 规则引擎固化管理：现金流健康度、负债压力、技能杠杆、时间容量、
 *   创业准备度、风险容量、目标可行性 → 允许/限制/禁止路径
 */

// ═══════════════════════════ 阶段1: 标准化 & 归一化 ═══════════════════════════

function normalizeAnswers(raw) {
  return {
    age: parseInt(raw.age) || 0,
    occupation: raw.occupationDetail || raw.occupation || raw.job || '',
    occupationCategory: categorizeOccupation(raw.occupationDetail || raw.occupation || raw.job || ''),
    monthlyIncome: parseIncomeRange(raw.monthlyIncome || raw.income || 0),
    savings: parseSavingsRange(raw.savings || 0),
    savingsRaw: parseSavingsValue(raw.savings || 0),
    debt: parseDebtLevel(raw.debt || 'none'),
    monthlyExpense: parseInt(raw.monthlyExpense) || 0,
    freeTimeHours: parseTimeRange(raw.freeTimeHours || 0),
    bestSkill: raw.bestSkill || '',
    goal: raw.goal || '',
    maxLoss: parseMaxLoss(raw.maxLoss || raw.riskCapacity || 'low'),
  }
}

// 区间字符串 → 中位数值
function parseIncomeRange(val) {
  const v = String(val || '')
  if (v.includes('3000以下')) return 2000
  if (v.includes('3000–') || v.includes('3000-')) return 4500
  if (v.includes('6000–') || v.includes('6000-')) return 8000
  if (v.includes('1万–') || v.includes('1万-') || v.includes('10000–') || v.includes('10000-')) return 15000
  if (v.includes('2万–') || v.includes('2万-')) return 35000
  if (v.includes('5万以上')) return 70000
  return parseInt(v) || 0
}

// 储蓄区间 → 实际中位数值
function parseSavingsValue(val) {
  const v = String(val || '')
  if (v.includes('1万元以下')) return 5000
  if (v.includes('1–5') || v.includes('1-5')) return 30000
  if (v.includes('5–10') || v.includes('5-10')) return 75000
  if (v.includes('10–30') || v.includes('10-30')) return 200000
  if (v.includes('30–100') || v.includes('30-100')) return 650000
  if (v.includes('100万')) return 1500000
  return parseInt(v) || 0
}

// 时间区间 → 中位数
function parseTimeRange(val) {
  const v = String(val || '')
  if (v.includes('几乎为0')) return 0.3
  if (v.includes('1小时以内')) return 0.7
  if (v.includes('1–2') || v.includes('1-2')) return 1.5
  if (v.includes('2–4') || v.includes('2-4')) return 3
  if (v.includes('4小时以上')) return 6
  return parseFloat(v) || 0
}

function categorizeOccupation(occ) {
  const o = occ.toLowerCase()
  if (o.includes('学生') || o.includes('待业') || o.includes('无业')) return 'student_unemployed'
  if (o.includes('企业主') || o.includes('老板') || o.includes('创始人') || o.includes('创业')) return 'business_owner'
  if (o.includes('个体') || o.includes('自雇') || o.includes('自由职业') || o.includes('freelance')) return 'self_employed'
  if (o.includes('销售') || o.includes('市场') || o.includes('运营') || o.includes('房产')) return 'commercial'
  if (o.includes('程序') || o.includes('工程师') || o.includes('开发') || o.includes('技术') || o.includes('IT') || o.includes('码农') || o.includes('AI') || o.includes('前端')) return 'tech_professional'
  if (o.includes('医生') || o.includes('律师') || o.includes('会计') || o.includes('设计') || o.includes('咨询') || o.includes('教师') || o.includes('教授')) return 'licensed_professional'
  return 'employee'
}

function parseSavingsRange(val) {
  // 先尝试区间映射再尝试直接 parseInt
  const sVal = parseSavingsValue(val)
  if (sVal < 10000) return 'under_10k'
  if (sVal < 50000) return '10k_50k'
  if (sVal < 100000) return '50k_100k'
  if (sVal < 300000) return '100k_300k'
  if (sVal < 1000000) return '300k_1m'
  return 'over_1m'
}

function parseDebtLevel(val) {
  const v = String(val || '').toLowerCase()
  if (v === 'none' || v === '0' || v.includes('无负债') || v === '无') return 'none'
  if (v === 'low' || v.includes('轻度') || v.includes('低负债') || v === '低') return 'low'
  if (v === 'medium' || v.includes('中度') || v.includes('中等') || v === '中' || v === 'mid') return 'medium'
  return 'high'
}

function parseMaxLoss(val) {
  const v = String(val || '').toLowerCase()
  if (v === 'none' || v === 'zero' || v === '零' || v.includes('不能接受') || v.includes('没有任何')) return 'none'
  if (v === 'low' || v === '低' || v.includes('小额') || v.includes('几千')) return 'low'
  if (v === 'medium' || v === '中等' || v.includes('几万')) return 'medium'
  if (v === 'high' || v === '高' || v.includes('几十万') || v.includes('大量') || v.includes('较大')) return 'high'
  return 'low'
}

// ═══════════════════════════ 阶段2: 约束计算引擎 ═══════════════════════════

function computeConstraints(a) {
  const s = {}

  // 1. 现金流健康度
  const monthlySurplus = a.monthlyIncome - a.monthlyExpense
  if (monthlySurplus <= 0) s.cashFlowHealth = 'critical'
  else if (monthlySurplus < 3000) s.cashFlowHealth = 'fragile'
  else if (monthlySurplus < 10000) s.cashFlowHealth = 'moderate'
  else s.cashFlowHealth = 'healthy'

  // 2. 应急缓冲（储蓄能撑几个月）
  const monthlyBuffer = a.monthlyExpense > 0 ? Math.round(a.savingsRaw / a.monthlyExpense) : 999
  if (monthlyBuffer < 1) s.emergencyBuffer = 'critical'
  else if (monthlyBuffer < 3) s.emergencyBuffer = 'dangerous'
  else if (monthlyBuffer < 6) s.emergencyBuffer = 'fragile'
  else if (monthlyBuffer < 12) s.emergencyBuffer = 'moderate'
  else s.emergencyBuffer = 'strong'

  // 3. 负债压力
  s.debtPressure = a.debt

  // 4. 技能杠杆
  s.skillLeverage = computeSkillLeverage(a.occupationCategory, a.bestSkill, a.occupation)

  // 5. 时间容量
  if (a.freeTimeHours < 1) s.timeCapacity = 'insufficient'
  else if (a.freeTimeHours < 2) s.timeCapacity = 'light_side_hustle'
  else if (a.freeTimeHours < 5) s.timeCapacity = 'deep_side_hustle'
  else s.timeCapacity = 'full_time_entrepreneur'

  // 6. 创业准备度
  s.entrepreneurshipReadiness = computeEntrepreneurshipReadiness(a, s)

  // 7. 风险容量
  s.riskCapacity = computeRiskCapacity(a, s)

  // 8. 目标可行性
  s.goalFeasibility = computeGoalFeasibility(a, s)

  // 汇总
  s.monthlySurplus = monthlySurplus
  s.monthlyBuffer = monthlyBuffer
  s.categorizedOccupation = a.occupationCategory
  s.savingsRange = a.savings

  return s
}

function computeSkillLeverage(occCat, bestSkill, occupation) {
  const high = ['tech_professional', 'licensed_professional', 'business_owner']
  const medium = ['commercial', 'self_employed']
  const low = ['employee', 'student_unemployed']

  // 如果用户明确声明了可变现技能，提升杠杆
  const skill = String(bestSkill || occupation || '').toLowerCase()
  if (skill.includes('技术') || skill.includes('编程') || skill.includes('开发') ||
      skill.includes('设计') || skill.includes('写作') || skill.includes('创作') ||
      skill.includes('销售') || skill.includes('管理') || skill.includes('人脉') ||
      skill.includes('资金') || skill.includes('投资')) {
    return 'high'
  }
  if (skill.includes('暂无') || skill.includes('无') || !bestSkill) {
    if (high.includes(occCat)) return 'medium'
    if (medium.includes(occCat)) return 'low'
    return 'very_low'
  }

  if (high.includes(occCat)) return 'high'
  if (medium.includes(occCat)) return 'medium'
  return 'low'
}

function computeEntrepreneurshipReadiness(a, s) {
  let score = 0
  if (s.cashFlowHealth === 'healthy') score += 2
  else if (s.cashFlowHealth === 'moderate') score += 1
  if (s.emergencyBuffer === 'strong' || s.emergencyBuffer === 'moderate') score += 2
  else if (s.emergencyBuffer === 'fragile') score += 1
  if (s.debtPressure === 'none' || s.debtPressure === 'low') score += 2
  else if (s.debtPressure === 'medium') score += 1
  else score -= 1
  if (s.skillLeverage === 'high') score += 2
  else if (s.skillLeverage === 'medium') score += 1
  if (s.timeCapacity === 'full_time_entrepreneur' || s.timeCapacity === 'deep_side_hustle') score += 2
  else if (s.timeCapacity === 'light_side_hustle') score += 1
  else score -= 1

  if (score >= 8) return 'high'
  if (score >= 5) return 'moderate'
  if (score >= 2) return 'low'
  return 'very_low'
}

function computeRiskCapacity(a, s) {
  const loss = a.maxLoss
  if (loss === 'high') return 3
  if (loss === 'medium') return 2
  if (loss === 'low') return 1
  return 0
}

function computeGoalFeasibility(a, s) {
  const goal = String(a.goal || '').toLowerCase()
  let baseScore = 0

  // 评估目标与当前条件的匹配度
  if (goal.includes('清理') || goal.includes('还债') || goal.includes('偿还')) {
    baseScore = s.debtPressure === 'high' ? 3 : 1
  } else if (goal.includes('副业') || goal.includes('增收')) {
    baseScore = s.timeCapacity !== 'insufficient' ? 3 : 1
  } else if (goal.includes('转行') || goal.includes('跳槽')) {
    baseScore = s.skillLeverage !== 'very_low' ? 3 : 1
  } else if (goal.includes('创业') || goal.includes('开店') || goal.includes('生意')) {
    baseScore = s.entrepreneurshipReadiness === 'high' ? 3 :
                s.entrepreneurshipReadiness === 'moderate' ? 2 : 0
  } else if (goal.includes('积累') || goal.includes('存款') || goal.includes('第一桶金')) {
    baseScore = s.cashFlowHealth !== 'critical' ? 3 : 1
  } else if (goal.includes('个人事业') || goal.includes('建立')) {
    baseScore = s.skillLeverage !== 'very_low' ? 3 : 1
  } else {
    baseScore = 2 // 提升认知等通用目标
  }

  if (baseScore >= 3) return 'high'
  if (baseScore >= 2) return 'moderate'
  return 'low'
}

// ═══════════════════════════ 阶段3: 交叉规则引擎 ═══════════════════════════

function applyCrossRules(a, s) {
  const allowed = []
  const restricted = []
  const forbidden = []

  const g = String(a.goal || '').toLowerCase()
  const occ = String(a.occupation || '').toLowerCase()

  // ── 规则1: 低储蓄 + 低现金流 + 实体创业 → 禁止 ──
  if ((s.savingsRange === 'under_10k' || s.savingsRange === '10k_50k') &&
      (s.cashFlowHealth === 'fragile' || s.cashFlowHealth === 'critical') &&
      (g.includes('创业') || g.includes('开店') || g.includes('生意') || g.includes('实体'))) {
    forbidden.push('重资产实体创业（门店/装修/囤货）——当前储蓄过低且现金流脆弱')
    restricted.push('轻资产服务型创业（私厨/上门/咨询）——但必须先验证最小可行产品')
  }

  // ── 规则2: 厨师 + 低储蓄 + 创业 → 优先技能路径 ──
  if ((occ.includes('厨师') || occ.includes('厨') || occ.includes('cook') || occ.includes('chef')) &&
      (s.savingsRange === 'under_10k' || s.savingsRange === '10k_50k') &&
      g.includes('创业')) {
    allowed.push('技能变现：私厨服务 / 上门做菜 / 小型定制餐饮')
    allowed.push('内容IP：短视频/直播展示厨艺 → 积累粉丝 → 课程/带货')
    allowed.push('低成本MVP：家庭厨房/共享厨房 → 验证市场后再考虑实体店')
    forbidden.push('租大型门店 / 重装修 / 高固定成本创业')
    restricted.push('实体餐饮店——建议先在线上/私域验证6个月现金流')
  }

  // ── 规则3: 高负债 → 第一优先级现金流修复 ──
  if (s.debtPressure === 'high') {
    allowed.push('现金流修复：降低支出/协商还款计划/增加稳定收入来源')
    allowed.push('副业增收（低风险低投入）：技能外包/线上兼职/零工平台')
    forbidden.push('辞职创业 / 借钱投资 / 高风险投机')
    forbidden.push('扩大消费 / 增加负债 / 以贷养贷')
  }

  // ── 规则4: 月度赤字 → 第一阶段必须修复现金流 ──
  if (s.cashFlowHealth === 'critical') {
    // 如果还没在允许路径中
    if (!allowed.some(p => p.includes('现金流修复'))) {
      allowed.push('现金流修复：立刻削减非必要支出/寻找增收渠道')
    }
    forbidden.push('投资、创业、扩大消费——现金流断裂是最快的破产路径')
    restricted.push('任何需要前期投入的事业——先解决生存再谈发展')
  }

  // ── 规则5: 低技能杠杆 + 低储蓄 → 先建能力 ──
  if (s.skillLeverage === 'very_low' || s.skillLeverage === 'low') {
    if (s.savingsRange === 'under_10k' || s.savingsRange === '10k_50k') {
      allowed.push('技能建设优先：选择一个可线上交付的技能（剪辑/文案/客服/运营），3个月集中训练')
      forbidden.push('在没有可售卖技能前直接创业')
      restricted.push('创业——验证技能市场价值后再考虑')
    }
  }

  // ── 规则6: 时间不足 + 副业目标 → 限制 ──
  if (s.timeCapacity === 'insufficient' && g.includes('副业')) {
    restricted.push('当前每天可自由支配时间不足1小时——副业收入增速有限')
    allowed.push('零碎时间变现：内容分发/自动化小店/投资学习')
    allowed.push('效率优化优先：先用1个月优化时间结构')
  }

  // ── 规则7: 负债用户 × 投资翻身 → 危险路径 ──
  if ((s.debtPressure === 'medium' || s.debtPressure === 'high') &&
      (g.includes('投资') || g.includes('理财') || g.includes('炒股') || g.includes('基金') || g.includes('币'))) {
    forbidden.push('借钱投资/杠杆投资——负债投资是通往破产的高速公路')
    restricted.push('投资——仅在债务负担可控且使用闲钱的前提下可小额定投')
  }

  // ── 规则8: 高收入但无时间 → 尊重核心收入 ──
  if (s.cashFlowHealth === 'healthy' && s.timeCapacity === 'insufficient') {
    restricted.push('需要大量时间投入的副业/创业——当前主业已是核心资产')
    allowed.push('资本配置优化：提升储蓄率/投资/被动收入构建')
    allowed.push('效率优化：外包低价值任务/释放可支配时间')
  }

  // ── 规则9: 低负债 + 技能高杠杆 + 时间充裕 + 目标创业 → 绿灯 ──
  if ((s.debtPressure === 'none' || s.debtPressure === 'low') &&
      s.skillLeverage === 'high' &&
      (s.timeCapacity === 'deep_side_hustle' || s.timeCapacity === 'full_time_entrepreneur') &&
      g.includes('创业')) {
    allowed.push('低风险验证创业：用现有技能最小化MVBP → 验证→放大')
    allowed.push('注册个体户/公司，建立正规收款渠道和财务体系')
  }

  // ── 规则10: 月盈余充裕 + 有大储蓄 → 可考虑被动投资 ──
  if (s.cashFlowHealth === 'healthy' && s.emergencyBuffer === 'strong') {
    allowed.push('资产配置优化：闲置资金按比例配置（稳健/成长/高风险）')
    allowed.push('寻找可产生复利效应的投资机会——钱生钱是最高杠杆')
  }

  // ── 去重 + 排序 ──
  return {
    allowedPaths: [...new Set(allowed)],
    restrictedPaths: [...new Set(restricted)],
    forbiddenPaths: [...new Set(forbidden)],
  }
}

// ═══════════════════════════ 主入口 ═══════════════════════════

function analyzeProfile(rawAnswers) {
  const a = normalizeAnswers(rawAnswers)
  const constraints = computeConstraints(a)
  const paths = applyCrossRules(a, constraints)

  return {
    rawAnswers: a,
    normalizedProfile: {
      ageGroup: a.age < 25 ? 'young' : a.age < 35 ? 'early_career' : a.age < 50 ? 'mid_career' : 'senior',
      occupationCategory: a.occupationCategory,
      occupation: a.occupation,
      monthlyIncome: a.monthlyIncome,
      savingsRange: a.savings,
      savingsRaw: a.savingsRaw,
      debtLevel: a.debt,
      monthlyExpense: a.monthlyExpense,
      freeTimeHours: a.freeTimeHours,
      bestSkill: a.bestSkill,
      goal: a.goal,
      maxLoss: a.maxLoss,
    },
    constraintAnalysis: constraints,
    ...paths,
  }
}

module.exports = { analyzeProfile, normalizeAnswers, computeConstraints, applyCrossRules }
