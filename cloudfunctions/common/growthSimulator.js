/**
 * growthSimulator.js — 增长模拟器（第六册 Part 6）
 *
 * 能力：
 *   1. 30/60/90 日增长模拟
 *   2. 多场景模拟（乐观/基准/悲观）
 *   3. 关键指标波动敏感性分析
 *   4. 增长预测与实际对比
 *
 * 核心公式：
 *   NextDay DAU = Today DAU × (1 + organicGrowth) + Today DAU × shareRate × K × inviteToActive
 *
 * 简化模型（基于 viral loop）：
 *   Day(n+1) = Day(n) × (1 + dailyOrganic) + Day(n) × shareRate × kFactor × 0.3
 */
const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)
const ONE_DAY = 86400000

// ── 默认场景参数 ──
const DEFAULT_PARAMS = {
  dailyOrganicGrowth: 0.02,   // 自然日增长 2%
  shareRate: 0.15,            // 分享率 15%
  kFactor: 0.3,               // K-Factor 0.3
  inviteToActive: 0.3,        // 邀请到激活 30%
  retentionRate: 0.30,        // 日留存率 30%
  paidBudgetPerDay: 0,        // 日投流预算（分）
  paidCac: 20,                // 投流 CAC
  contentAttractionRate: 0.005, // 内容引流率
}

// ── 场景预设 ──
const SCENARIOS = {
  pessimistic: {
    label: '悲观',
    dailyOrganicGrowth: 0.01,
    shareRate: 0.08,
    kFactor: 0.15,
    retentionRate: 0.20,
    contentAttractionRate: 0.002,
  },
  baseline: {
    label: '基准',
    dailyOrganicGrowth: 0.02,
    shareRate: 0.15,
    kFactor: 0.3,
    retentionRate: 0.30,
    contentAttractionRate: 0.005,
  },
  optimistic: {
    label: '乐观',
    dailyOrganicGrowth: 0.04,
    shareRate: 0.25,
    kFactor: 0.5,
    retentionRate: 0.40,
    contentAttractionRate: 0.01,
  },
}

// ═══════════════════════════
// simulateGrowth — 核心模拟函数
// ═══════════════════════════

async function simulateGrowth(db, params = {}) {
  const ts = now()

  try {
    // 合并参数
    const p = { ...DEFAULT_PARAMS, ...params }

    // 获取当前基准数据
    const today = _todayKey(ts)
    const currentDau = await db.collection('growth_events')
      .where({ event: 'mini_enter', date: today })
      .count().then(r => r.total).catch(() => 0) || 100 // fallback

    const totalUsers = await db.collection('users').count().then(r => r.total).catch(() => 0) || 500

    // ─── 三场景模拟 ───
    const scenarios = {}
    for (const [name, preset] of Object.entries(SCENARIOS)) {
      const sp = { ...p, ...preset }
      const forecast = _runSimulation(sp, currentDau, totalUsers, 90)
      scenarios[name] = {
        label: preset.label,
        forecast,
        summary: {
          dau90d: forecast[89].dau,
          dau180d: null, // 仅90日模拟
          totalUsers90d: forecast[89].totalUsers,
          growth: Math.round((forecast[89].dau / Math.max(currentDau, 1) - 1) * 10000) / 100,
          viralShare: Math.round((forecast[89].newFromViral / Math.max(forecast[89].newUsers, 1)) * 10000) / 100,
        },
      }
    }

    return {
      currentDau,
      currentTotalUsers: totalUsers,
      params: p,
      scenarios,
      milestones: _extractMilestones(scenarios, currentDau),
      simulatedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// compareToActual — 模拟 vs 实际对比
// ═══════════════════════════

async function compareToActual(db, days = 30) {
  const ts = now()
  try {
    // 获取实际数据
    const actual = []
    for (let i = days - 1; i >= 0; i--) {
      const d = _todayKey(ts - i * ONE_DAY)
      const dau = await db.collection('growth_events')
        .where({ event: 'mini_enter', date: d })
        .count().then(r => r.total).catch(() => 0)
      actual.push({ date: d, dau })
    }

    // 获取模拟数据（用 days 天前的 DAU 作为基准）
    const baseDau = actual[0]?.dau || 100
    const totalUsers = await db.collection('users').count().then(r => r.total).catch(() => 0)
    const simulated = _runSimulation(DEFAULT_PARAMS, baseDau, totalUsers, days)

    // 计算偏差
    const comparison = actual.map((a, i) => ({
      date: a.date,
      actualDau: a.dau,
      simulatedDau: simulated[i]?.dau || 0,
      deviation: a.dau > 0 ? Math.round(((simulated[i]?.dau || 0) - a.dau) / a.dau * 10000) / 100 : 0,
    }))

    const avgDeviation = comparison.length > 0
      ? Math.round(comparison.reduce((s, c) => s + Math.abs(c.deviation), 0) / comparison.length * 100) / 100
      : 0

    return {
      comparison,
      avgDeviation,
      accuracy: avgDeviation < 10 ? 'high' : avgDeviation < 25 ? 'medium' : 'low',
      note: avgDeviation > 25 ? '模拟偏差较大，建议检查增长假设参数' : '模拟准确度可接受',
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// simulateWhatIf — 假设分析
// ═══════════════════════════

async function simulateWhatIf(db, whatIfParams) {
  const ts = now()
  try {
    const base = await simulateGrowth(db, DEFAULT_PARAMS)
    const adjusted = await simulateGrowth(db, { ...DEFAULT_PARAMS, ...whatIfParams })

    // 对比 90 天结果
    const base90 = base.scenarios?.baseline?.forecast?.[89]
    const adj90 = adjusted.scenarios?.baseline?.forecast?.[89]

    return {
      baseScenario: { dau90d: base90?.dau || 0, totalUsers90d: base90?.totalUsers || 0 },
      adjustedScenario: { dau90d: adj90?.dau || 0, totalUsers90d: adj90?.totalUsers || 0 },
      impact: {
        dauChange: base90?.dau > 0 ? Math.round(((adj90?.dau || 0) - base90.dau) / base90.dau * 10000) / 100 : 0,
        absoluteDifference: (adj90?.dau || 0) - (base90?.dau || 0),
      },
      whatIfParams,
      insight: adj90?.dau > base90?.dau
        ? '参数调整后增长加速，建议采纳变更'
        : '参数调整后增长放缓，当前参数更优',
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getScenarios — 场景预设
// ═══════════════════════════

function getScenarios() {
  return SCENARIOS
}

// ═══════════════════════════
// 辅助 — 模拟核心
// ═══════════════════════════

function _runSimulation(p, startDau, startUsers, days) {
  const forecast = []
  let dau = startDau
  let totalUsers = startUsers

  for (let d = 0; d < days; d++) {
    // 有机增长
    const organic = Math.round(dau * p.dailyOrganicGrowth)

    // 内容引流
    const content = Math.round(Math.max(1, dau) * p.contentAttractionRate * (1 + Math.random() * 0.5))

    // 裂变增长
    const shares = Math.round(dau * p.shareRate)
    const viralNew = Math.round(shares * p.kFactor * p.inviteToActive)

    // 投流增长
    const paidNew = p.paidBudgetPerDay > 0 ? Math.round(p.paidBudgetPerDay / Math.max(p.paidCac, 1)) : 0

    // 留存损失
    const retained = Math.round(dau * p.retentionRate)
    const newUsers = organic + content + viralNew + paidNew

    dau = retained + newUsers
    totalUsers += newUsers

    forecast.push({
      day: d + 1,
      dau,
      totalUsers,
      newUsers,
      organic,
      content,
      newFromViral: viralNew,
      newFromPaid: paidNew,
    })
  }

  return forecast
}

function _extractMilestones(scenarios, currentDau) {
  const base = scenarios.baseline?.forecast || []
  const milestones = []

  const targets = [1000, 5000, 10000, 50000, 100000]
  targets.forEach(t => {
    if (t <= currentDau) return // 已达标
    const day = base.findIndex(f => f.dau >= t)
    if (day >= 0) {
      milestones.push({ target: t.toLocaleString(), days: day + 1, label: `${t.toLocaleString()} DAU` })
    }
  })

  return milestones
}

module.exports = {
  DEFAULT_PARAMS,
  SCENARIOS,
  simulateGrowth,
  compareToActual,
  simulateWhatIf,
  getScenarios,
}
