/**
 * fraudDetector.js — 反作弊引擎（第六册 Part 3）
 *
 * 检测维度：
 *   1. 同设备检测 (deviceId match)
 *   2. 同 IP 检测 (ip match)
 *   3. 短时间异常邀请 (burst invite)
 *   4. 重复 openid (已邀请过)
 *
 * fraud_score 0-100
 *   > 70 → 标记作弊
 *   > 50 → 疑似 (warning)
 *   ≤ 50 → 正常
 */
const now = () => Date.now()
const ONE_HOUR = 3600000
const ONE_DAY = 86400000

// ═══════════════════════════
// quickCheck — 快速反作弊检查（记录邀请时调用）
// ═══════════════════════════

async function quickCheck(db, { inviterCode, inviteeOpenid, deviceId, ip }) {
  const ts = now()

  try {
    let fraudScore = 0
    const reasons = []

    // 1. 重复 openid — 已被邀请过
    const existCheck = await db.collection('referrals')
      .where({ inviteeOpenid })
      .count()
      .then(r => r.total)
      .catch(() => 0)

    if (existCheck > 0) {
      fraudScore += 50
      reasons.push('duplicate_invitee')
    }

    // 2. 同设备检测
    if (deviceId) {
      const sameDevice = await db.collection('referrals')
        .where({ deviceId, inviteeOpenid: db.command.neq(inviteeOpenid) })
        .count()
        .then(r => r.total)
        .catch(() => 0)
      if (sameDevice > 0) {
        fraudScore += 30
        reasons.push('same_device')
      }
    }

    // 3. 同 IP 检测
    if (ip) {
      const sameIP = await db.collection('referrals')
        .where({ ip, inviteeOpenid: db.command.neq(inviteeOpenid), createdAt: db.command.gte(ts - ONE_DAY) })
        .count()
        .then(r => r.total)
        .catch(() => 0)
      if (sameIP > 3) {
        fraudScore += 20
        reasons.push('same_ip_burst')
      }
    }

    // 4. 短时间异常邀请 — 同一邀请码 1小时内 > 20 次
    const burstCount = await db.collection('referrals')
      .where({ inviterCode, createdAt: db.command.gte(ts - ONE_HOUR) })
      .count()
      .then(r => r.total)
      .catch(() => 0)

    if (burstCount > 20) {
      fraudScore += 40
      reasons.push('burst_invite')
    } else if (burstCount > 10) {
      fraudScore += 20
      reasons.push('high_frequency')
    }

    const block = fraudScore > 70

    // 记录 fraud log
    if (fraudScore > 0) {
      try {
        await db.collection('share_events').add({
          data: {
            inviterCode,
            inviteeOpenid,
            event: 'fraud_check',
            fraudScore,
            reasons,
            blocked: block,
            deviceId,
            ip,
            createdAt: ts,
            date: new Date(ts).toISOString().slice(0, 10),
          },
        })
      } catch (_) {}
    }

    return { fraudScore, reasons, block, risk: fraudScore > 50 ? 'high' : fraudScore > 20 ? 'medium' : 'low' }
  } catch (err) {
    console.error('[fraudDetector] quickCheck 异常:', err.message)
    return { fraudScore: 0, reasons: [], block: false, risk: 'error' }
  }
}

// ═══════════════════════════
// auditInviter — 审查特定邀请人
// ═══════════════════════════

async function auditInviter(db, inviterCode) {
  const ts = now()
  try {
    const invitees = await db.collection('referrals')
      .where({ inviterCode, inviteeOpenid: db.command.exists(true) })
      .get()
      .catch(() => ({ data: [] }))

    const data = invitees.data

    // 设备/IP分析
    const devices = {}
    const ips = {}
    data.forEach(r => {
      if (r.deviceId) devices[r.deviceId] = (devices[r.deviceId] || 0) + 1
      if (r.ip) ips[r.ip] = (ips[r.ip] || 0) + 1
    })

    // 时间分布分析
    const times = data.map(r => r.createdAt || 0).sort()
    let burstCount = 0
    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i-1] < 60000) burstCount++ // 1分钟内
    }

    // 激活率分析
    const activated = data.filter(r => r.status === 'activated' || r.status === 'paid').length
    const activationRate = data.length > 0 ? Math.round((activated / data.length) * 10000) / 100 : 0

    // 综合欺诈评分
    let fraudScore = 0
    const flags = []

    if (Object.values(devices).some(v => v > 3)) {
      fraudScore += 25
      flags.push('multi_account_same_device')
    }
    if (Object.values(ips).some(v => v > 3)) {
      fraudScore += 15
      flags.push('multi_account_same_ip')
    }
    if (burstCount > 10) {
      fraudScore += 20
      flags.push('rapid_succession')
    }
    if (data.length > 20 && activationRate < 10) {
      fraudScore += 20
      flags.push('low_activation_rate')
    }

    return {
      inviterCode,
      totalInvites: data.length,
      activated,
      activationRate,
      burstCount,
      deviceUniqueCount: Object.keys(devices).length,
      ipUniqueCount: Object.keys(ips).length,
      fraudScore,
      flags,
      verdict: fraudScore > 70 ? 'fraud' : fraudScore > 40 ? 'suspicious' : 'clean',
      auditedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getFraudSummary — 作弊概览
// ═══════════════════════════

async function getFraudSummary(db) {
  const ts = now()
  try {
    const today = new Date(ts).toISOString().slice(0, 10)

    const fraudEvents = await db.collection('share_events')
      .where({ event: 'fraud_check', date: today })
      .get()
      .catch(() => ({ data: [] }))

    const blocked = fraudEvents.data.filter(e => e.blocked).length
    const highRisk = fraudEvents.data.filter(e => !e.blocked && e.fraudScore > 50).length

    return {
      date: today,
      totalChecks: fraudEvents.data.length,
      blocked,
      highRisk,
      cleanRate: fraudEvents.data.length > 0
        ? Math.round(((fraudEvents.data.length - blocked) / fraudEvents.data.length) * 10000) / 100
        : 100,
    }
  } catch (_) {
    return { date: '', totalChecks: 0, blocked: 0, highRisk: 0, cleanRate: 100 }
  }
}

module.exports = {
  quickCheck,
  auditInviter,
  getFraudSummary,
}
