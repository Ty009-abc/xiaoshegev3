/**
 * turnaroundEngine.js — TURNAROUND_DIAGNOSIS_10Q_DECISION_ENGINE_V2
 *
 * 现实约束引擎 + 交叉规则引擎
 * 禁止 AI 根据 10 题答案自由发挥
 * 规则引擎固化管理：现金流健康度、负债压力、技能杠杆、时间容量、
 *   创业准备度、风险容量、目标可行性 → 允许/限制/禁止路径
 */

// ═══════════════════════════ 阶段1a: 金额归一化结构 ═══════════════════════════

/**
 * 金额归一化 → { raw, min, max, representativeValue }
 * 所有区间字符串和数值输入统一转换为结构化对象
 */
function normalizeAmount(raw) {
  const v = String(raw ?? '').trim()
  // 先尝试已有结构化
  if (typeof raw === 'object' && raw !== null && typeof raw.representativeValue === 'number') {
    return { raw: raw.raw || String(raw.representativeValue), min: raw.min ?? raw.representativeValue, max: raw.max ?? raw.representativeValue, representativeValue: raw.representativeValue }
  }
  // 数值输入
  const numeric = parseFloat(v)
  if (!isNaN(numeric) && v !== '' && !/[^\d.]/.test(v)) {
    return { raw: v, min: numeric, max: numeric, representativeValue: numeric }
  }
  // 区间字符串匹配
  // 策略：先按已知的区间格式精确匹配，再回退到正则
  
  // ── 精确区间模式 ──
  // X以下 / X万元以下
  const rBelow = v.match(/^([\d]+(?:\.[\d]+)?)\s*(?:万(?:元)?)?\s*以下$/)
  if (rBelow) { const n = parseFloat(rBelow[1]) * (v.includes('万') ? 10000 : 1); return { raw: v, min: 0, max: n, representativeValue: Math.round(n * 0.5) } }
  // X以上 / X万元以上
  const rAbove = v.match(/^([\d]+(?:\.[\d]+)?)\s*(?:万(?:元)?)?\s*以上$/)
  if (rAbove) { const n = parseFloat(rAbove[1]) * (v.includes('万') ? 10000 : 1); return { raw: v, min: n, max: n * 3, representativeValue: Math.round(n * 1.5) } }
  // 混合区间：X–Y万（例如 6000–1万）— 第一个是千元，第二个是万元
  const rMixed = v.match(/^([\d]+)\s*[–\-]\s*([\d]+)\s*万(?:元)?$/)
  if (rMixed) {
    const lo = parseInt(rMixed[1])
    const hi = parseInt(rMixed[2]) * 10000
    // 如果 lo 在千元范围（3000-8000），lo 不乘 10000
    // 否则（如 1–5万），lo 也乘 10000
    if (lo >= 1000) return { raw: v, min: lo, max: hi, representativeValue: Math.round((lo + hi) / 2) }
    return { raw: v, min: lo * 10000, max: hi, representativeValue: Math.round((lo * 10000 + hi) / 2) }
  }
  // X–Y万（含万的区间）如 1–5万元（两端都是万）
  const rRangeWan = v.match(/^([\d]+(?:\.[\d]+)?)\s*[–\-]\s*([\d]+(?:\.[\d]+)?)\s*万(?:元)?$/)
  if (rRangeWan) { const lo = parseFloat(rRangeWan[1]) * 10000, hi = parseFloat(rRangeWan[2]) * 10000; return { raw: v, min: lo, max: hi, representativeValue: Math.round((lo + hi) / 2) } }
  // X–Y（纯数字千元区间）如 3000–6000
  const rRange1 = v.match(/^([\d]+)\s*[–\-]\s*([\d]+)\s*$/)
  if (rRange1) { const lo = parseInt(rRange1[1]), hi = parseInt(rRange1[2]); return { raw: v, min: lo, max: hi, representativeValue: Math.round((lo + hi) / 2) } }

  // ── 回退：通用正则 ──
  const match = v.match(/[\d]+[.\d]*/g)
  if (match && match.length >= 1) {
    const nums = match.map(Number).filter(n => !isNaN(n))
    if (nums.length === 1) {
      // 单值 "5万以上" → 50000; "1万元以下" → 10000
      if (v.includes('以上') || v.includes('高于') || v.includes('超过')) {
        const val = nums[0] * (v.includes('万') ? 10000 : 1)
        return { raw: v, min: val, max: val * 3, representativeValue: val * 1.5 }
      }
      if (v.includes('以下') || v.includes('低于') || v.includes('不到')) {
        const val = nums[0] * (v.includes('万') ? 10000 : 1)
        return { raw: v, min: 0, max: val, representativeValue: val * 0.5 }
      }
      // 孤数值 → 按中值处理
      const val = nums[0] * (v.includes('万') ? 10000 : 1)
      return { raw: v, min: val * 0.5, max: val * 1.5, representativeValue: val }
    }
    if (nums.length >= 2) {
      const mult = v.includes('万') ? 10000 : 1
      // 取第一个和最后一个数值作为[min, max]
      const lo = nums[0] * mult
      const hi = nums[nums.length - 1] * mult
      // 修复：如果两个数字相差超过1000倍（如 6000×1 vs 10000×1）→ 说明不同单位
      // 检查：如果第一个数字在 3000-8000 范围（表示千元区间），而第二个在 1-5 范围（万元）
      let adjustedHi = hi
      if (!v.includes('万') && hi >= 10000 && lo < 10000) {
        // '6000–1万' 格式：lo=6000 hi=10000，正确只需确保 hi 已经用 ×1
        adjustedHi = hi
      }
      // 但如果是 '6000–10000万' 之类的异常格式
      return { raw: v, min: lo, max: adjustedHi, representativeValue: Math.round((lo + adjustedHi) / 2) }
    }
  }
  // 兜底
  return { raw: v, min: 0, max: 0, representativeValue: 0 }
}

// 区间字符串 → 中位数值（保留向后兼容）
function parseIncomeRange(val) {
  return normalizeAmount(val).representativeValue
}

// 储蓄区间 → 实际中位数值（保留向后兼容）
function parseSavingsValue(val) {
  return normalizeAmount(val).representativeValue
}

// 时间区间 → 小数值
function parseTimeRange(val) {
  const v = String(val || '')
  if (v.includes('几乎为0')) return 0.3
  if (v.includes('1小时以内')) return 0.7
  if (v.includes('1–2') || v.includes('1-2')) return 1.5
  if (v.includes('2–4') || v.includes('2-4')) return 3
  if (v.includes('4小时以上')) return 6
  return parseFloat(v) || 0
}

// ═══════════════════════════ 阶段1b: 标准化 & 归一化 ═══════════════════════════

function normalizeAnswers(raw) {
  const incomeAmt = normalizeAmount(raw.monthlyIncome || raw.income || 0)
  const savingsAmt = normalizeAmount(raw.savings || 0)
  const expenseAmt = normalizeAmount(raw.monthlyExpense || 0)
  const maxLossAmt = normalizeAmount(raw.maxLoss || raw.riskCapacity || '0')

  return {
    age: parseInt(raw.age) || 0,
    occupation: raw.occupationDetail || raw.occupation || raw.job || '',
    occupationCategory: categorizeOccupation(raw.occupationDetail || raw.occupation || raw.job || ''),
    // 金额归一化结构
    monthlyIncome: { raw: incomeAmt.raw, min: incomeAmt.min, max: incomeAmt.max, representativeValue: incomeAmt.representativeValue },
    savings: { raw: savingsAmt.raw, min: savingsAmt.min, max: savingsAmt.max, representativeValue: savingsAmt.representativeValue },
    monthlyExpense: { raw: expenseAmt.raw, min: expenseAmt.min, max: expenseAmt.max, representativeValue: expenseAmt.representativeValue },
    maxLoss: { raw: maxLossAmt.raw, min: maxLossAmt.min, max: maxLossAmt.max, representativeValue: maxLossAmt.representativeValue },
    // 向后兼容的数值字段
    incomeValue: incomeAmt.representativeValue,
    savingsValue: savingsAmt.representativeValue,
    expenseValue: expenseAmt.representativeValue,
    maxLossValue: maxLossAmt.representativeValue,
    // 分类字段
    savingsRange: parseSavingsRange(raw.savings || 0),
    savingsRaw: parseSavingsValue(raw.savings || 0),
    debt: parseDebtLevel(raw.debt || 'none'),
    freeTimeHours: parseTimeRange(raw.freeTimeHours || 0),
    bestSkill: raw.bestSkill || '',
    goal: raw.goal || '',
  }
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

  const income = a.incomeValue ?? (a.monthlyIncome?.representativeValue ?? 0)
  const expense = a.expenseValue ?? (a.monthlyExpense?.representativeValue ?? 0)
  const savingsVal = a.savingsValue ?? (a.savings?.representativeValue ?? 0)

  // 1. 现金流健康度
  const monthlySurplus = income - expense
  if (monthlySurplus <= 0) s.cashFlowHealth = 'critical'
  else if (monthlySurplus < 3000) s.cashFlowHealth = 'fragile'
  else if (monthlySurplus < 10000) s.cashFlowHealth = 'moderate'
  else s.cashFlowHealth = 'healthy'

  // 2. 应急缓冲（储蓄能撑几个月）
  const monthlyBuffer = expense > 0 ? Math.round(savingsVal / expense) : 999
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
  const maxLossVal = a.maxLossValue ?? (a.maxLoss?.representativeValue ?? 0)
  const rawStr = String(a.maxLoss?.raw ?? a.maxLoss ?? '').toLowerCase()
  if (rawStr.includes('几十万') || rawStr.includes('较大') || maxLossVal >= 500000) return 3
  if (rawStr.includes('几万') || maxLossVal >= 30000) return 2
  if (rawStr.includes('小额') || rawStr.includes('几千') || maxLossVal > 0) return 1
  // 'none' / '不能接受'
  if (rawStr.includes('不能接受') || rawStr.includes('没有任何') || rawStr === 'none' || rawStr === 'zero' || rawStr === '0') return 0
  // 向后兼容旧的 parseMaxLoss 映射
  const oldLoss = parseMaxLoss(a.maxLoss?.raw ?? a.maxLoss ?? 0)
  if (oldLoss === 'high') return 3
  if (oldLoss === 'medium') return 2
  if (oldLoss === 'low') return 1
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

/** 路径对象构建器 */
function pathObj(path, status, reason, triggeredRules) {
  return { path, status, reason, triggeredRules: Array.isArray(triggeredRules) ? triggeredRules : [triggeredRules] }
}

function applyCrossRules(a, s) {
  const allowed = []
  const restricted = []
  const forbidden = []

  const g = String(a.goal || '').toLowerCase()
  const occ = String(a.occupation || '').toLowerCase()
  const incomeVal = a.incomeValue ?? 0
  const expenseVal = a.expenseValue ?? 0
  const savingsVal = a.savingsValue ?? 0

  // ── 规则R01: 低储蓄 + 低现金流 + 实体创业 → 禁止 ──
  if ((s.savingsRange === 'under_10k' || s.savingsRange === '10k_50k') &&
      (s.cashFlowHealth === 'fragile' || s.cashFlowHealth === 'critical') &&
      (g.includes('创业') || g.includes('开店') || g.includes('生意') || g.includes('实体'))) {
    forbidden.push(pathObj(
      '重资产实体创业（门店/装修/囤货）', 'forbidden',
      `当前储蓄不足（约${savingsVal}元）且现金流${s.cashFlowHealth === 'critical' ? '已断裂' : '脆弱'}，实体创业固定成本过高`,
      ['R01']))
    restricted.push(pathObj(
      '轻资产服务型创业（私厨/上门/咨询）', 'restricted',
      '可以先以最小成本验证市场需求，但必须不增加固定负债',
      ['R01']))
  }

  // ── 规则R02: 厨师 + 低储蓄 + 创业 → 优先技能路径 ──
  if ((occ.includes('厨师') || occ.includes('厨') || occ.includes('cook') || occ.includes('chef')) &&
      (s.savingsRange === 'under_10k' || s.savingsRange === '10k_50k') &&
      g.includes('创业')) {
    allowed.push(pathObj(
      '技能变现：私厨服务 / 上门做菜 / 小型定制餐饮', 'allowed',
      `利用现有厨艺技能，零固定成本启动，储蓄${savingsVal}元足够覆盖食材和基本设备`,
      ['R02']))
    allowed.push(pathObj(
      '内容IP：短视频/直播展示厨艺 → 积累粉丝 → 课程/带货', 'allowed',
      '技能可转化为内容资产，边际成本趋零',
      ['R02']))
    allowed.push(pathObj(
      '低成本MVP：家庭厨房/共享厨房 → 验证市场后再考虑实体店', 'allowed',
      '用最小可行产品验证市场需求，避免过早承担固定成本',
      ['R02']))
    forbidden.push(pathObj(
      '租大型门店 / 重装修 / 高固定成本创业', 'forbidden',
      `储蓄${savingsVal}元不足以支撑商业租约+装修+3个月运营成本`,
      ['R02']))
    restricted.push(pathObj(
      '实体餐饮店', 'restricted',
      '建议先在线上/私域验证6个月现金流再考虑实体化',
      ['R02']))
  }

  // ── 规则R03: 高负债 → 第一优先级现金流修复 ──
  if (s.debtPressure === 'high') {
    allowed.push(pathObj(
      '现金流修复：降低支出/协商还款计划/增加稳定收入来源', 'allowed',
      `月入${incomeVal}支出${expenseVal}，负债压力高，必须首先修复现金流`,
      ['R03']))
    allowed.push(pathObj(
      '副业增收（低风险低投入）：技能外包/线上兼职/零工平台', 'allowed',
      '用额外收入还清/降低负债，不可借新债还旧债',
      ['R03']))
    forbidden.push(pathObj(
      '辞职创业 / 借钱投资 / 高风险投机', 'forbidden',
      '当前负债压力高，辞职/借新钱将在30-60天内导致现金流断裂',
      ['R03']))
    forbidden.push(pathObj(
      '扩大消费 / 增加负债 / 以贷养贷', 'forbidden',
      '以贷养贷是最高杠杆的破产路径',
      ['R03']))
  }

  // ── 规则R04: 月度赤字 → 第一阶段必须修复现金流 ──
  if (s.cashFlowHealth === 'critical') {
    if (!allowed.some(p => p.path.includes('现金流修复'))) {
      allowed.push(pathObj(
        '现金流修复：立刻削减非必要支出/寻找增收渠道', 'allowed',
        `月入${incomeVal}支出${expenseVal}，当前每月赤字${Math.abs(s.monthlySurplus)}元，储蓄只能撑${s.monthlyBuffer}个月`,
        ['R04']))
    }
    forbidden.push(pathObj(
      '投资、创业、扩大消费', 'forbidden',
      `现金流已断裂（月结余${s.monthlySurplus}元），如不修复，${s.monthlyBuffer < 3 ? '3个月内面临严重危机' : '储蓄很快耗尽'}`,
      ['R04']))
    restricted.push(pathObj(
      '任何需要前期投入的事业', 'restricted',
      '先解决生存再谈发展',
      ['R04']))
  }

  // ── 规则R05: 低技能杠杆 + 低储蓄 → 先建能力 ──
  if (s.skillLeverage === 'very_low' || s.skillLeverage === 'low') {
    if (s.savingsRange === 'under_10k' || s.savingsRange === '10k_50k') {
      allowed.push(pathObj(
        '技能建设优先：选择一个可线上交付的技能（剪辑/文案/客服/运营），3个月集中训练', 'allowed',
        '没有可市场化的技能是一切限制的根源；先用3个月搭一个技能基底',
        ['R05']))
      forbidden.push(pathObj(
        '在没有可售卖技能前直接创业', 'forbidden',
        '创业=用技能或资本换取溢价。目前两者都不具备',
        ['R05']))
      restricted.push(pathObj(
        '创业', 'restricted',
        '先验证技能市场价值后再考虑',
        ['R05']))
    }
  }

  // ── 规则R06: 时间不足 + 副业目标 → 限制 ──
  if (s.timeCapacity === 'insufficient' && g.includes('副业')) {
    restricted.push(pathObj(
      '投入大量时间的副业', 'restricted',
      `每天可自由支配时间仅${a.freeTimeHours}小时，传统副业时间投入产出比有限`,
      ['R06']))
    allowed.push(pathObj(
      '零碎时间变现：内容分发/自动化小店/投资学习', 'allowed',
      '选择不需要长块时间的变现方式才是正确思路',
      ['R06']))
    allowed.push(pathObj(
      '效率优化优先：先用1个月优化时间结构', 'allowed',
      '外包/自动化/简化低价值任务以释放时间',
      ['R06']))
  }

  // ── 规则R07: 负债用户 × 投资翻身 → 危险路径 ──
  if ((s.debtPressure === 'medium' || s.debtPressure === 'high') &&
      (g.includes('投资') || g.includes('理财') || g.includes('炒股') || g.includes('基金') || g.includes('币'))) {
    forbidden.push(pathObj(
      '借钱投资/杠杆投资', 'forbidden',
      '负债+投资=双重风险乘数，是通往破产的高速公路',
      ['R07']))
    restricted.push(pathObj(
      '投资', 'restricted',
      '仅在债务可控且使用闲钱的前提下可小额定投指数基金',
      ['R07']))
  }

  // ── 规则R08: 高收入但无时间 → 尊重核心收入 ──
  if (s.cashFlowHealth === 'healthy' && s.timeCapacity === 'insufficient') {
    restricted.push(pathObj(
      '需要大量时间投入的副业/创业', 'restricted',
      `当前主业是核心资产（月${incomeVal}），大量时间的副业机会成本过高`,
      ['R08']))
    allowed.push(pathObj(
      '资本配置优化：提升储蓄率/投资/被动收入构建', 'allowed',
      '用钱换时间——不需要额外时间投入的资产增值',
      ['R08']))
    allowed.push(pathObj(
      '效率优化：外包低价值任务/释放可支配时间', 'allowed',
      `月${incomeVal}的主业值得花月${expenseVal}中的一部分外包低效任务`,
      ['R08']))
  }

  // ── 规则R09: 低负债 + 技能高杠杆 + 时间充裕 + 目标创业 → 绿灯 ──
  if ((s.debtPressure === 'none' || s.debtPressure === 'low') &&
      s.skillLeverage === 'high' &&
      (s.timeCapacity === 'deep_side_hustle' || s.timeCapacity === 'full_time_entrepreneur') &&
      g.includes('创业')) {
    allowed.push(pathObj(
      '低风险验证创业：用现有技能最小化MVBP → 验证→放大', 'allowed',
      '负债低、技能强、时间充裕——这是三种最稀缺创业条件的交集',
      ['R09']))
    allowed.push(pathObj(
      '注册个体户/公司，建立正规收款渠道和财务体系', 'allowed',
      '合规是规避创业最大非市场风险的基础',
      ['R09']))
  }

  // ── 规则R10: 月盈余充裕 + 有大储蓄 → 可考虑被动投资 ──
  if (s.cashFlowHealth === 'healthy' && s.emergencyBuffer === 'strong') {
    allowed.push(pathObj(
      '资产配置优化：闲置资金按比例配置（稳健/成长/高风险）', 'allowed',
      `储蓄${savingsVal}元，月结余${s.monthlySurplus}元——有足够的闲钱进行梯度配置`,
      ['R10']))
    allowed.push(pathObj(
      '寻找可产生复利效应的投资机会', 'allowed',
      '钱生钱是最高杠杆——前提是现金流健康且储蓄充足',
      ['R10']))
  }

  // ── 规则R00: 中间层默认路径（任何合法画像至少一条 allowedPath）──
  if (allowed.length === 0) {
    // 根据目标类型给一条现实路径
    if (g.includes('建立') || g.includes('个人事业') || g.includes('品牌')) {
      allowed.push(pathObj(
        '低成本个人品牌：选择一个细分领域，用90天完成30篇内容+30次互动', 'allowed',
        '你的现金流尚未达到可以承受重大试错的程度，但具备小规模验证条件。先内容+互动，再变现',
        ['R00_DEFAULT_MODERATE']))
    } else if (g.includes('副业') || g.includes('增收')) {
      allowed.push(pathObj(
        '保持主业现金流 + 小规模副业验证：用业余时间完成3次最小成交测试', 'allowed',
        `月结余${s.monthlySurplus}元不足以支撑裸辞，但足够支撑每月小规模尝试`,
        ['R00_DEFAULT_MODERATE']))
    } else if (g.includes('创业') || g.includes('开店') || g.includes('生意')) {
      allowed.push(pathObj(
        '低风险创业验证：选择一个几乎零固定成本的商业模式，先成交一次再扩大', 'allowed',
        `储蓄${savingsVal}元可支撑数月的低投入验证，但不足以支撑重资产模式`,
        ['R00_DEFAULT_MODERATE']))
    } else {
      allowed.push(pathObj(
        '保持主业现金流，在不增加重大固定成本的前提下，用90天完成一次低成本验证', 'allowed',
        `现金流${s.cashFlowHealth}，储蓄${savingsVal}元——不急于做大，先验证一个关键假设`,
        ['R00_DEFAULT_MODERATE']))
    }
  }

  // ── 阶段4: 冲突消解 ──
  // 优先级: forbidden > restricted > allowed
  // 同一条 path 只能出现在最高优先级集合
  const forbiddenPaths = resolveConflicts(forbidden, restricted, allowed)
  const restrictedPaths = resolveConflictsRestricted(restricted, forbidden, allowed)
  const allowedPaths = resolveConflictsAllowed(allowed, forbidden, restricted)

  return { allowedPaths, restrictedPaths, forbiddenPaths }
}

function resolveConflicts(forbidden, restricted, allowed) {
  // forbidden 优先：任何出现在其他集合中的同名路径，移除
  const fPaths = new Set(forbidden.map(f => f.path))
  return Object.values(
    forbidden.reduce((acc, f) => {
      if (!acc[f.path]) acc[f.path] = f
      return acc
    }, {})
  )
}

function resolveConflictsRestricted(restricted, forbidden, allowed) {
  const fPaths = new Set(forbidden.map(f => f.path))
  return Object.values(
    restricted
      .filter(r => !fPaths.has(r.path))
      .reduce((acc, r) => {
        if (!acc[r.path]) acc[r.path] = r
        return acc
      }, {})
  )
}

function resolveConflictsAllowed(allowed, forbidden, restricted) {
  const fPaths = new Set(forbidden.map(f => f.path))
  const rPaths = new Set(restricted.map(r => r.path))
  return Object.values(
    allowed
      .filter(a => !fPaths.has(a.path) && !rPaths.has(a.path))
      .reduce((acc, a) => {
        if (!acc[a.path]) acc[a.path] = a
        return acc
      }, {})
  )
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
      // 金额归一化结构
      monthlyIncome: a.monthlyIncome,
      savings: a.savings,
      monthlyExpense: a.monthlyExpense,
      maxLoss: a.maxLoss,
      // 数值兼容字段
      monthlyIncomeValue: a.incomeValue,
      savingsValue: a.savingsValue,
      monthlyExpenseValue: a.expenseValue,
      maxLossValue: a.maxLossValue,
      // 分类字段
      savingsRange: a.savingsRange,
      debtLevel: a.debt,
      freeTimeHours: a.freeTimeHours,
      bestSkill: a.bestSkill,
      goal: a.goal,
    },
    constraintAnalysis: constraints,
    ...paths,
  }
}

module.exports = { analyzeProfile, normalizeAnswers, computeConstraints, applyCrossRules, normalizeAmount }
