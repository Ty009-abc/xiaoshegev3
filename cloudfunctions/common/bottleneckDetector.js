/**
 * bottleneckDetector.js — 增长瓶颈检测引擎（第六册 Part 6）
 *
 * 能力：
 *   1. 自动识别增长瓶颈
 *   2. 瓶颈严重度评分
 *   3. 修复建议生成
 *   4. 瓶颈趋势追踪
 *
 * 瓶颈类型：
 *   traffic / conversion / retention / engagement / monetization / content_supply
 *
 * 按阶段映射：
 *   0-1k: 流量瓶颈    1k-10k: 转化瓶颈
 *   10k-100k: 留存瓶颈  100k+: 组织效率瓶颈
 */
const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)
const ONE_DAY = 86400000

// ── 瓶颈定义 ──
const BOTTLENECK_TYPES = {
  traffic: {
    label: '流量瓶颈',
    description: '获客速度不足',
    severity: { critical: 70, warning: 40 },
    cause: '内容供给不足 / 渠道单一 / 分享率低',
    fix: '扩大内容矩阵 / 增加渠道分发 / 优化分享素材',
  },
  conversion: {
    label: '转化瓶颈',
    description: '用户进入后不激活',
    severity: { critical: 70, warning: 40 },
    cause: 'onboarding体验差 / 价值传递不清 / CTA弱',
    fix: '优化新用户引导 / 提升第一个挑战完成率 / 强化报告预览',
  },
  retention: {
    label: '留存瓶颈',
    description: '用户流失过快',
    severity: { critical: 70, warning: 40 },
    cause: '内容更新慢 / 缺乏新鲜感 / 未建立习惯',
    fix: '增加日均内容 / 建立每日挑战习惯 / 启动流失预警引擎',
  },
  engagement: {
    label: '互动瓶颈',
    description: '用户活跃度不足',
    severity: { critical: 70, warning: 40 },
    cause: '挑战难度不当 / 社交功能弱 / 反馈不足',
    fix: '优化挑战难度梯度 / 增加排行榜 / 强化即时反馈',
  },
  monetization: {
    label: '变现瓶颈',
    description: '付费转化偏低',
    severity: { critical: 70, warning: 40 },
    cause: '付费价值感不足 / 价格与价值不匹配 / CTA触发时机不当',
    fix: '优化付费点触发时机 / 提供免费试用 / 强化社交证明',
  },
  content_supply: {
    label: '内容供给瓶颈',
    description: '内容产出跟不上需求',
    severity: { critical: 70, warning: 40 },
    cause: '单人产能有限 / 缺乏AI辅助 / 内容复用率低',
    fix: '启用内容引擎 / 启动AI辅助管线 / 开始矩阵号分发',
  },
}

// ── 按阶段的检测权重 ──
const PHASE_WEIGHTS = {
  validation: { traffic: 0.35, conversion: 0.25, content_supply: 0.20, engagement: 0.15, retention: 0.05, monetization: 0.00 },
  flywheel:   { conversion: 0.30, traffic: 0.25, retention: 0.20, monetization: 0.15, engagement: 0.05, content_supply: 0.05 },
  scaling:    { retention: 0.35, monetization: 0.25, engagement: 0.20, content_supply: 0.15, conversion: 0.05, traffic: 0.00 },
  brand:      { monetization: 0.30, engagement: 0.25, retention: 0.20, content_supply: 0.15, traffic: 0.05, conversion: 0.05 },
}

// ═══════════════════════════
// detectBottlenecks — 核心瓶颈检测
// ═══════════════════════════

async function detectBottlenecks(db) {
  const ts = now()
  const today = _todayKey(ts)

  try {
    const scaleEngine = require('./scaleEngine.js')

    // 1. 获取当前阶段
    const phase = await scaleEngine.detectPhase(db)
    const currentPhase = phase.currentPhase?.phase || 'validation'
    const weights = PHASE_WEIGHTS[currentPhase] || PHASE_WEIGHTS.validation

    // 2. 收集数据
    const totalUsers = phase.totalUsers || 0
    const dau = phase.dau || 0
    const shareRate = (await _getMetric(db, 'shareRate', today)) || 0
    const paidRate = (await _getMetric(db, 'paidRate', today)) || 0
    const retention = (await _getMetric(db, 'retention', today)) || 0
    const kFactor = (await _getMetric(db, 'kFactor', today)) || 0
    const growthRate = phase.growthRate || 0

    // 3. 各维度评分（0-100，高=严重）
    const scores = {}

    // 流量瓶颈
    scores.traffic = _scoreTrafficBottleneck(dau, growthRate, shareRate, kFactor)
    // 转化瓶颈
    scores.conversion = _scoreConversionBottleneck(paidRate, shareRate)
    // 留存瓶颈
    scores.retention = _scoreRetentionBottleneck(retention, growthRate)
    // 互动瓶颈
    scores.engagement = _scoreEngagementBottleneck(dau, totalUsers, retention)
    // 变现瓶颈
    scores.monetization = _scoreMonetizationBottleneck(paidRate, totalUsers, dau)
    // 内容供给瓶颈
    scores.content_supply = _scoreContentSupplyBottleneck(totalUsers)

    // 4. 加权排序
    const weighted = Object.entries(scores).map(([type, score]) => ({
      type,
      label: BOTTLENECK_TYPES[type]?.label || type,
      rawScore: score,
      weightedScore: Math.round(score * (weights[type] || 0.1) * 100) / 100,
      weight: weights[type] || 0.1,
      severity: score >= 70 ? 'critical' : score >= 40 ? 'warning' : 'low',
      cause: BOTTLENECK_TYPES[type]?.cause || '',
      fix: BOTTLENECK_TYPES[type]?.fix || '',
    })).sort((a, b) => b.weightedScore - a.weightedScore)

    const topBottleneck = weighted.length > 0 ? weighted[0] : null

    // 5. 写入 growth_bottlenecks
    try {
      const report = {
        date: today,
        phase: currentPhase,
        topBottleneck: topBottleneck?.type || null,
        topBottleneckLabel: topBottleneck?.label || '无',
        topBottleneckSeverity: topBottleneck?.severity || 'low',
        bottlenecks: weighted,
        suggestion: topBottleneck?.fix || '当前无明显瓶颈',
        createdAt: ts,
      }
      const exist = await db.collection('growth_bottlenecks').where({ date: today }).limit(1).get()
      if (exist.data.length > 0) {
        await db.collection('growth_bottlenecks').doc(exist.data[0]._id).update({ data: { ...report, updatedAt: ts } })
      } else {
        await db.collection('growth_bottlenecks').add({ data: report })
      }
    } catch (_) {}

    return {
      phase: currentPhase,
      phaseLabel: phase.currentPhase?.label || '未知',
      topBottleneck,
      bottlenecks: weighted,
      suggestion: topBottleneck?.fix || '继续观察',
      benchmarkDau: dau,
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getBottleneckTrend — 瓶颈趋势（7日）
// ═══════════════════════════

async function getBottleneckTrend(db) {
  const ts = now()
  const trend = []

  for (let i = 6; i >= 0; i--) {
    const d = _todayKey(ts - i * ONE_DAY)
    const record = await db.collection('growth_bottlenecks')
      .where({ date: d })
      .limit(1)
      .get().catch(() => ({ data: [] }))

    if (record.data.length > 0) {
      trend.push({
        date: d,
        topBottleneck: record.data[0].topBottleneck,
        severity: record.data[0].topBottleneckSeverity,
      })
    } else {
      trend.push({ date: d, topBottleneck: null, severity: 'none' })
    }
  }

  return { trend, analysedAt: ts }
}

// ═══════════════════════════
// getBottleneckSuggestion — 针对性建议
// ═══════════════════════════

async function getBottleneckSuggestion(db) {
  const detection = await detectBottlenecks(db)
  if (detection.error) return detection

  const top = detection.topBottleneck
  if (!top || top.severity === 'low') {
    return { suggestion: '当前无明显增长瓶颈，继续保持运营节奏', action: 'maintain' }
  }

  return {
    bottleneck: top.type,
    bottleneckLabel: top.label,
    severity: top.severity,
    suggestion: top.fix,
    cause: top.cause,
    action: top.severity === 'critical' ? 'immediate' : 'planned',
  }
}

// ═══════════════════════════
// 辅助评分函数
// ═══════════════════════════

function _scoreTrafficBottleneck(dau, growthRate, shareRate, kFactor) {
  let score = 0
  if (dau < 50) score += 50       // 极低流量
  else if (dau < 200) score += 30
  else if (dau < 500) score += 15

  if (growthRate < 5) score += 30  // 增长缓慢
  else if (growthRate < 15) score += 15

  if (shareRate < 5) score += 20
  if (kFactor < 0.1) score += 20

  return Math.min(100, score)
}

function _scoreConversionBottleneck(paidRate, shareRate) {
  let score = 0
  if (paidRate < 1) score += 50
  else if (paidRate < 3) score += 30
  else if (paidRate < 5) score += 15

  if (shareRate < 8) score += 20

  return Math.min(100, score)
}

function _scoreRetentionBottleneck(retention, growthRate) {
  let score = 0
  if (retention < 10) score += 60
  else if (retention < 20) score += 40
  else if (retention < 30) score += 20

  if (growthRate < 10 && retention < 25) score += 20

  return Math.min(100, score)
}

function _scoreEngagementBottleneck(dau, totalUsers, retention) {
  const ratio = totalUsers > 0 ? dau / totalUsers : 0
  let score = 0
  if (ratio < 0.03) score += 50
  else if (ratio < 0.05) score += 30

  if (retention < 20) score += 25

  return Math.min(100, score)
}

function _scoreMonetizationBottleneck(paidRate, totalUsers, dau) {
  let score = 0
  if (paidRate < 1) score += 60
  else if (paidRate < 3) score += 30
  if (totalUsers > 1000 && paidRate < 5) score += 20
  return Math.min(100, score)
}

function _scoreContentSupplyBottleneck(totalUsers) {
  // 简化：用户数 > 1000 且无矩阵 → 内容供给瓶颈
  let score = 0
  if (totalUsers > 10000) score += 40
  else if (totalUsers > 1000) score += 20
  // 在实际系统中可检测内容发布频率
  return Math.min(100, score)
}

async function _getMetric(db, key, date) {
  // 尝试从 growth_metrics / viral_metrics / private_metrics 获取
  const collections = ['scale_metrics', 'growth_metrics', 'viral_metrics', 'private_metrics']
  for (const col of collections) {
    try {
      const record = await db.collection(col).where({ date }).limit(1).get()
      if (record.data.length > 0 && record.data[0][key] !== undefined) {
        return record.data[0][key]
      }
    } catch (_) {}
  }
  return 0
}

module.exports = {
  BOTTLENECK_TYPES,
  PHASE_WEIGHTS,
  detectBottlenecks,
  getBottleneckTrend,
  getBottleneckSuggestion,
}
