/**
 * cloudfunctions/expireMemberships/index.js — 过期会员清理（定时任务）
 *
 * 第五册 Part 3：权限系统
 *
 * 建议每日 02:00 执行（Cron: 0 2 * * *）
 *
 * 职责：
 *   1. 清理过期 memberships
 *   2. 降级 entitlements
 *   3. 同步 users.membershipLevel → free
 *   4. 写 evolution_logs
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { revokeExpiredPermissions } = require('./lib/permissionEngine.js')
const { refreshEntitlements } = require('./lib/entitlementService.js')

const now = () => Date.now()

exports.main = async (event) => {
  const ts = now()
  console.log('[expireMemberships] 开始执行...')

  try {
    // 1. 清理过期权限
    const revokeResult = await revokeExpiredPermissions(db)
    console.log(`[expireMemberships] 过期清理: ${JSON.stringify(revokeResult)}`)

    // 2. 主动修复不一致的 entitlements
    const activeMembers = await db.collection('memberships')
      .where({ status: 'active' })
      .limit(100)
      .get()

    let refreshed = 0
    for (const mem of activeMembers.data) {
      try {
        await refreshEntitlements(db, mem.openid)
        refreshed++
      } catch (_) {}
    }

    // 3. 清理过期 entitlements sources
    const entRes = await db.collection('entitlements')
      .where({ 'sources.expiresAt': db.command.lte(ts) })
      .limit(100)
      .get()

    for (const ent of entRes.data) {
      await refreshEntitlements(db, ent.openid)
    }

    // 4. 写日志
    await db.collection('evolution_logs').add({
      data: {
        operation: 'expire_memberships',
        targetId: `batch_${ts}`,
        detail: {
          expiredMembers: revokeResult.expiredCount,
          refreshed,
          timestamp: ts,
        },
        createdAt: ts,
      },
    })

    return {
      code: 0,
      message: '过期清理完成',
      data: {
        expiredMembers: revokeResult.expiredCount,
        refreshed,
        timestamp: ts,
      },
    }
  } catch (err) {
    console.error('[expireMemberships] 异常:', err.message)
    return { code: -1, message: err.message }
  }
}
