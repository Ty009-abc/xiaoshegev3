/**
 * expansionPlanner.js — 扩张规划引擎（第六册 Part 6）
 *
 * 能力：
 *   1. 自动生成扩张建议
 *   2. 渠道优先级排序
 *   3. 预算分配建议
 *   4. 扩张路线图
 *
 * 输入来源：
 *   - acquisitionEngine → 渠道ROI/LTV数据
 *   - bottleneckDetector → 瓶颈诊断
 *   - growthSimulator → 增长预测
 *   - revenueEngine → 收入数据
 */
const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)
const ONE_DAY = 86400000

// ═══════════════════════════
// generateExpansionPlan — 生成扩张计划
// ═══════════════════════════

async function generateExpansionPlan(db) {
  const ts = now()
  const today = _todayKey(ts)

  try {
    // 收集数据
    const [phase, bottlenecks, kpis, highValueSegs, simulated] = await Promise.all([
      _safeCall(db, 'scaleEngine', 'detectPhase'),
      _safeCall(db, 'bottleneckDetector', 'detectBottlenecks'),
      _safeCall(db, 'scaleEngine', 'getScaleKPIs'),
      _safeCall(db, 'acquisitionEngine', 'getHighValueSegments'),
      _safeCall(db, 'growthSimulator', 'simulateGrowth'),
    ])

    const totalUsers = phase?.totalUsers || 0
    const currentPhase = phase?.currentPhase?.phase || 'validation'

    // ── 生成建议 ──
    const recommendations = []

    // 1. 基于阶段
    const stageRec = _getStageRecommendation(currentPhase, totalUsers)
    if (stageRec) recommendations.push({ ...stageRec, category: 'stage' })

    // 2. 基于瓶颈
    const topBottleneck = bottlenecks?.topBottleneck
    if (topBottleneck && topBottleneck.severity !== 'low') {
      recommendations.push({
        priority: topBottleneck.severity === 'critical' ? 1 : 2,
        action: `修复${topBottleneck.label}`,
        detail: topBottleneck.fix,
        expectedImpact: topBottleneck.severity === 'critical' ? 'high' : 'medium',
        category: 'bottleneck',
      })
    }

    // 3. 基于渠道数据
    const bestSource = highValueSegs?.bestSource
    if (bestSource) {
      recommendations.push({
        priority: 1,
        action: `扩大${bestSource}渠道`,
        detail: `${bestSource}渠道用户LTV最高，建议增加该渠道内容产出`,
        expectedImpact: 'high',
        category: 'channel',
      })
    }

    // 4. 基于收入
    if (kpis?.revenueGrowth < 10 && totalUsers > 100) {
      recommendations.push({
        priority: 2,
        action: '优化变现漏斗',
        detail: '付费转化率偏低，建议优化会员中心页和报告预览',
        expectedImpact: 'medium',
        category: 'monetization',
      })
    }

    // 5. 投流建议
    if (totalUsers > 10000) {
      recommendations.push({
        priority: 3,
        action: '开启投流测试',
        detail: '用户基础已足够，建议小规模测试抖音信息流（日预算100元）',
        expectedImpact: 'medium',
        category: 'paid_growth',
      })
    }

    // 6. 内容矩阵建议
    if (totalUsers > 1000) {
      recommendations.push({
        priority: 2,
        action: '启动内容矩阵',
        detail: '当前阶段适合启动1-2个子账号（赌场内幕号/认知暴击号），用AI辅助内容',
        expectedImpact: 'high',
        category: 'content_matrix',
      })
    }

    // 7. 私域建议
    if (totalUsers > 500) {
      recommendations.push({
        priority: 2,
        action: '建立私域体系',
        detail: '当前用户基数适合建立认知觉醒群，筛选高价值用户进入VIP群',
        expectedImpact: 'medium',
        category: 'private_traffic',
      })
    }

    // 排序
    recommendations.sort((a, b) => a.priority - b.priority)

    // ── 渠道优先级排序 ──
    const channelPriority = _rankChannels(highValueSegs)

    // ── 预算分配 ──
    const budgetAllocation = _generateBudgetAllocation(channelPriority, totalUsers, currentPhase)

    // ── 扩张路线图 ──
    const roadmap = _generateRoadmap(currentPhase, totalUsers, recommendations)

    const plan = {
      phase: currentPhase,
      totalUsers,
      recommendations,
      channelPriority,
      budgetAllocation,
      roadmap,
      summary: recommendations.length > 0
        ? `优先级: ${recommendations[0].action}。下一步: ${recommendations[1]?.action || recommendations[0].action}`
        : '数据收集中，建议继续全渠道测试',
      generatedAt: ts,
    }

    // 写入 expansion_plans
    try {
      const exist = await db.collection('expansion_plans').where({ date: today }).limit(1).get()
      if (exist.data.length > 0) {
        await db.collection('expansion_plans').doc(exist.data[0]._id).update({ data: { ...plan, updatedAt: ts } })
      } else {
        await db.collection('expansion_plans').add({ data: { ...plan, date: today, createdAt: ts } })
      }
    } catch (_) {}

    return plan
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getExpansionPlan — 查询最新扩张计划
// ═══════════════════════════

async function getExpansionPlan(db) {
  const ts = now()
  try {
    const latest = await db.collection('expansion_plans')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get().catch(() => ({ data: [] }))

    if (latest.data.length > 0) return latest.data[0]

    // 如果没有，现场生成
    return await generateExpansionPlan(db)
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getExpansionHistory — 规划历史
// ═══════════════════════════

async function getExpansionHistory(db, limit = 30) {
  try {
    const history = await db.collection('expansion_plans')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get().catch(() => ({ data: [] }))

    return history.data.map(p => ({
      date: p.date,
      phase: p.phase,
      totalUsers: p.totalUsers,
      topRecommendation: p.recommendations?.[0]?.action || '无',
      summary: p.summary,
    }))
  } catch (_) {
    return []
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

async function _safeCall(db, moduleName, methodName) {
  try {
    const mod = require(`./${moduleName}.js`)
    return await mod[methodName](db)
  } catch (_) {
    return null
  }
}

function _getStageRecommendation(phase, totalUsers) {
  switch (phase) {
    case 'validation':
      return {
        priority: 1,
        action: '内容验证 + 第一波种子用户',
        detail: `当前 ${totalUsers} 用户，重点验证产品价值。建议：日更1-2条赌场认知内容，引导完成首个挑战`,
        expectedImpact: 'high',
      }
    case 'flywheel':
      return {
        priority: 1,
        action: '裂变助推 + 内容矩阵冷启动',
        detail: `当前 ${totalUsers} 用户，适合启动裂变系统和子账号。建议：开启邀请奖励，启动1-2个矩阵号`,
        expectedImpact: 'high',
      }
    case 'scaling':
      return {
        priority: 1,
        action: '系统自动化 + 付费投流',
        detail: `当前 ${totalUsers} 用户，重点做留存和变现。建议：启动自动化运营管线，小规模投流测试`,
        expectedImpact: 'high',
      }
    case 'brand':
      return {
        priority: 1,
        action: '品牌建设 + 矩阵放大',
        detail: '规模化阶段，建议：品牌合作 + KOL联动 + 全渠道矩阵运营',
        expectedImpact: 'high',
      }
    default:
      return null
  }
}

function _rankChannels(highValueSegs) {
  if (!highValueSegs?.segments) return [{ channel: 'organic', score: 50, priority: 'primary' }]

  return highValueSegs.segments.slice(0, 5).map((s, i) => ({
    channel: s.source,
    score: s.avgLtv || 0,
    paidRate: s.paidRate || 0,
    priority: i === 0 ? 'primary' : i === 1 ? 'secondary' : 'tertiary',
  }))
}

function _generateBudgetAllocation(channelPriority, totalUsers, phase) {
  if (phase === 'validation') {
    return { total: 0, note: '验证期不建议投流', allocation: [] }
  }

  const total = phase === 'scaling' ? 50000 : phase === 'brand' ? 100000 : 10000 // 分

  if (channelPriority.length === 0) {
    return { total, note: '暂无渠道数据，建议平均分配', allocation: [] }
  }

  const primary = channelPriority.filter(c => c.priority === 'primary')
  const secondary = channelPriority.filter(c => c.priority === 'secondary')
  const tertiary = channelPriority.filter(c => c.priority === 'tertiary')

  const primaryShare = 0.5
  const secondaryShare = 0.30
  const tertiaryShare = 0.20

  const allocation = []

  if (primary.length > 0) {
    const perPrimary = Math.round((total * primaryShare) / primary.length)
    primary.forEach(c => allocation.push({ channel: c.channel, budget: perPrimary, share: primaryShare * 100, tier: 'primary' }))
  }

  if (secondary.length > 0) {
    const perSecondary = Math.round((total * secondaryShare) / secondary.length)
    secondary.forEach(c => allocation.push({ channel: c.channel, budget: perSecondary, share: secondaryShare * 100, tier: 'secondary' }))
  }

  if (tertiary.length > 0) {
    const perTertiary = Math.round((total * tertiaryShare) / tertiary.length)
    tertiary.forEach(c => allocation.push({ channel: c.channel, budget: perTertiary, share: tertiaryShare * 100, tier: 'tertiary' }))
  }

  return {
    total,
    allocated: allocation.reduce((s, a) => s + a.budget, 0),
    allocation,
    note: totalUsers > 10000 ? '基于LTV数据分配' : '建议待数据更充分后调整',
  }
}

function _generateRoadmap(phase, totalUsers, recommendations) {
  const phases = []

  if (phase === 'validation') {
    phases.push({ label: '当前: 验证期', target: 1000, remaining: 1000 - totalUsers, actions: ['日均1-2条内容', '完成100个种子用户', '验证付费转化'] })
    phases.push({ label: '下一步: 飞轮期', target: 10000, actions: ['启动裂变系统', '建立1-2个矩阵号', '优化分享率>15%'] })
  } else if (phase === 'flywheel') {
    phases.push({ label: '当前: 飞轮期', target: 10000, remaining: 10000 - totalUsers, actions: ['裂变奖励推广', '矩阵号冷启动', '提高K-factor'] })
    phases.push({ label: '下一步: 规模化', target: 100000, actions: ['全渠道自动化', '付费投流测试', '私域体系完善'] })
  } else if (phase === 'scaling') {
    phases.push({ label: '当前: 规模化', target: 100000, remaining: 100000 - totalUsers, actions: ['全渠道分发', '投流优化', '自动化运营'] })
    phases.push({ label: '下一步: 品牌化', target: 1000000, actions: ['品牌合作', 'KOL联动', '矩阵全开'] })
  } else {
    phases.push({ label: '当前: 品牌化', target: 1000000, remaining: '无限', actions: ['品牌深耕', '全矩阵运营', '生态建设'] })
  }

  return phases
}

module.exports = {
  generateExpansionPlan,
  getExpansionPlan,
  getExpansionHistory,
}
