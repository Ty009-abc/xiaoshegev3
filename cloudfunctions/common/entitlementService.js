/**
 * cloudfunctions/common/entitlementService.js — 权益生命周期服务（canonical）
 *
 * PAYMENT_STAGE5A_R2_ENTITLEMENT_AUTHORITY_REPAIR
 *
 * 本文件为唯一权威权益实现。verifyPayment / payCallback 各持一份**字节一致**的副本
 * （lib/entitlementService.js）。禁止任何一侧单独修改业务语义。
 *
 * 核心原则（fail-closed / target-proven）：
 *   1. 业务分支只按「显式商品权益权威」选择，绝不凭权限字符串（permList.includes）误触发无关写。
 *   2. 一次性商品必须**精确定位唯一目标**（0 匹配=失败；>1 匹配=fail closed + 审计）。
 *   3. 写入后必须**回读证明**目标已生效，才可返回 success。
 *   4. 会员类天然非幂等：以「该 paid orderId 是否已在本用户 memberships 记录中」作为
 *      幂等权威，同一订单重放绝不重复叠加时长。
 *   5. 失败时返回 success:false，允许 finalizer 的权益状态机在 pending/applying 重试。
 *
 * 显式商品权益映射：
 *   report_9_9      → report unlock only   → ai_reports.reportId = relatedId
 *   challenge_39_9  → challenge unlock only → challenge_records.recordId = relatedId
 *   vip_month_99 / vip_year_299 → membership entitlement only
 */

const {
  PRODUCT_PERMISSIONS,
  FREE_PERMISSIONS,
  hasPermission,
  getMembershipLevel,
} = require('./permissionEngine.js')

const now = () => Date.now()
const DAY_MS = 86400 * 1000

const PERM = {
  REPORT_UNLOCK: 'report_unlock',
  CHALLENGE_UNLOCK: 'challenge_unlock',
  FULL_REPORT: 'full_report',
  CHALLENGE_FULL: 'challenge_full',
  VIP: 'vip',
}

const MEMBERSHIP_TYPES = ['subscription', 'membership', 'bundle']

// 审计集合（缺失时静默失败，绝不影响权威结果）
async function _audit (db, doc, ts) {
  try {
    await db.collection('entitlement_audit').add({ data: Object.assign({ createdAt: ts || now() }, doc) })
  } catch (_) {}
}

/**
 * applyReportUnlock — report_9_9 专用目标权威
 * 目标：ai_reports where { reportId: relatedId, openid }，要求唯一。
 * 幂等：目标已是 isPaid=true 视为已应用并回读证明。
 */
async function applyReportUnlock (db, order, ts) {
  const { openid, orderId, relatedId } = order
  if (!relatedId) return { ok: false, applied: false, reason: 'REPORT_RELATED_ID_MISSING' }

  // 先尝试幂等回读：已应用则直接证明成功
  const pre = await db.collection('ai_reports').where({ reportId: relatedId, openid }).limit(2).get()
  const preRows = (pre && pre.data) || []
  if (preRows.length > 1) {
    await _audit(db, { orderId, openid, relatedId, action: 'report_target_ambiguous', matched: preRows.length }, ts)
    return { ok: false, applied: false, ambiguous: true, reason: 'AMBIGUOUS_TARGET', matched: preRows.length }
  }
  if (preRows.length === 0) {
    return { ok: false, applied: false, missing: true, reason: 'TARGET_MISSING' }
  }
  if (preRows[0].isPaid === true) {
    return { ok: true, applied: true, idempotent: true, reason: 'ALREADY_APPLIED' }
  }

  const upd = await db.collection('ai_reports').where({ reportId: relatedId, openid }).update({
    data: {
      isPaid: true,
      unlockOrderId: orderId,
      unlockedAt: ts,
      updatedAt: ts,
    },
  })
  const updated = upd && upd.stats ? (upd.stats.updated || 0) : 0
  if (updated !== 1) {
    await _audit(db, { orderId, openid, relatedId, action: 'report_update_zero', updated }, ts)
    return { ok: false, applied: false, reason: 'UPDATE_ZERO' }
  }

  // 回读证明
  const proof = await db.collection('ai_reports').where({ reportId: relatedId, openid }).limit(1).get()
  const row = (proof && proof.data && proof.data[0]) || null
  if (!row || row.isPaid !== true) {
    await _audit(db, { orderId, openid, relatedId, action: 'report_proof_failed' }, ts)
    return { ok: false, applied: false, reason: 'PROOF_FAILED' }
  }
  return { ok: true, applied: true, reason: 'APPLIED' }
}

/**
 * applyChallengeUnlock — challenge_39_9 专用目标权威
 * 目标：challenge_records where { recordId: relatedId, openid }，要求唯一。
 * （历史缺陷：把 relatedId 当作 Mongo 主键查询 → 0 行更新。）
 * 幂等：trialMode===false 或 unlocked===true 视为已应用并回读证明。
 */
async function applyChallengeUnlock (db, order, ts) {
  const { openid, orderId, relatedId } = order
  if (!relatedId) return { ok: false, applied: false, reason: 'CHALLENGE_RELATED_ID_MISSING' }

  const pre = await db.collection('challenge_records').where({ recordId: relatedId, openid }).limit(2).get()
  const preRows = (pre && pre.data) || []
  if (preRows.length !== 1) {
    await _audit(db, {
      orderId, openid, relatedId, action: 'challenge_target_not_unique', matched: preRows.length,
    }, ts)
    return {
      ok: false,
      applied: false,
      ambiguous: preRows.length > 1,
      missing: preRows.length === 0,
      reason: preRows.length > 1 ? 'AMBIGUOUS_TARGET' : 'TARGET_MISSING',
      matched: preRows.length,
    }
  }
  if (preRows[0].trialMode === false || preRows[0].unlocked === true) {
    return { ok: true, applied: true, idempotent: true, reason: 'ALREADY_APPLIED' }
  }

  const upd = await db.collection('challenge_records').where({ recordId: relatedId, openid }).update({
    data: {
      trialMode: false,
      unlocked: true,
      unlockOrderId: orderId,
      unlockedAt: ts,
      updatedAt: ts,
    },
  })
  const updated = upd && upd.stats ? (upd.stats.updated || 0) : 0
  if (updated !== 1) {
    await _audit(db, { orderId, openid, relatedId, action: 'challenge_update_zero', updated }, ts)
    return { ok: false, applied: false, reason: 'UPDATE_ZERO' }
  }

  // 回读证明
  const proof = await db.collection('challenge_records').where({ recordId: relatedId, openid }).limit(1).get()
  const row = (proof && proof.data && proof.data[0]) || null
  if (!row || !(row.trialMode === false || row.unlocked === true)) {
    await _audit(db, { orderId, openid, relatedId, action: 'challenge_proof_failed' }, ts)
    return { ok: false, applied: false, reason: 'PROOF_FAILED' }
  }
  return { ok: true, applied: true, reason: 'APPLIED' }
}

/**
 * applyMembership — vip_month_99 / vip_year_299 等会员类
 * 幂等权威：该 paid orderId 是否已记录在本用户 memberships（任意状态）中。
 * 同一订单重放 → 不再叠加时长，直接回读证明。
 */
async function applyMembership (db, order, ts) {
  const { openid, orderId } = order
  const productRes = await db.collection('products').where({ productId: order.productId }).limit(1).get()
  const product = (productRes && productRes.data && productRes.data[0]) || {}
  const durationDays = product.durationDays || 0
  const level = _productIdToLevel(order.productId)

  // ── 幂等闸门：该 orderId 是否已发放过会员权益 ──
  const byOrder = await db.collection('memberships').where({ openid, orderId }).limit(1).get()
  if (byOrder && byOrder.data && byOrder.data.length > 0) {
    return { ok: true, applied: true, idempotent: true, reason: 'MEMBERSHIP_ALREADY_GRANTED_FOR_ORDER' }
  }

  const existingMember = await db.collection('memberships')
    .where({ openid, status: 'active', expiredAt: db.command.gt(ts) })
    .limit(1).get()

  if (existingMember && existingMember.data && existingMember.data.length > 0) {
    const old = existingMember.data[0]
    const newExpires = Math.max(old.expiredAt || 0, ts) + durationDays * DAY_MS
    await db.collection('memberships').doc(old._id).update({
      data: { expiredAt: newExpires, lastOrderId: orderId, updatedAt: ts },
    })
  } else {
    const expiresAt = durationDays > 0 ? ts + durationDays * DAY_MS : 0
    await db.collection('memberships').add({
      data: {
        openid, status: 'active', level,
        memberType: order.productId, permissions: PRODUCT_PERMISSIONS[order.productId] || [PERM.VIP],
        orderId, startedAt: ts, expiredAt: expiresAt,
        createdAt: ts, updatedAt: ts,
      },
    })
  }

  await db.collection('users').where({ openid }).update({
    data: { membershipLevel: level, updatedAt: ts },
  })

  // 回读证明：本订单已在 memberships 留痕
  const proof = await db.collection('memberships').where({ openid, orderId }).limit(1).get()
  if (!(proof && proof.data && proof.data.length > 0)) {
    await _audit(db, { orderId, openid, action: 'membership_proof_failed' }, ts)
    return { ok: false, applied: false, reason: 'PROOF_FAILED' }
  }
  return { ok: true, applied: true, reason: 'APPLIED' }
}

/**
 * grantEntitlements — 支付成功后发放权益（canonical，target-proven）
 *
 * @returns {{ success, granted, summary, applied, idempotent, reason }}
 *   success === true 仅当目标权益已被证明生效。
 */
async function grantEntitlements (db, order, ts = now()) {
  const { openid, productId, orderId, relatedId } = order
  if (!openid || !productId) return { success: false, granted: [], applied: false, summary: '缺少 openid 或 productId' }

  try {
    const productRes = await db.collection('products').where({ productId }).limit(1).get()
    const product = (productRes && productRes.data && productRes.data[0]) || {}
    const perms = PRODUCT_PERMISSIONS[productId] || [product.permission || productId]

    let target = { ok: true, applied: true, reason: 'NO_TARGET_REQUIRED' }
    const granted = []

    // ── 显式商品权益权威（非 permList 推断）──
    if (product.permission === PERM.REPORT_UNLOCK || productId === 'report_9_9') {
      target = await applyReportUnlock(db, order, ts)
      if (!target.ok) return _fail(target, '报告权益未发放（目标未证明）')
      granted.push(PERM.REPORT_UNLOCK, ...perms.filter((p) => p !== PERM.CHALLENGE_UNLOCK))
    } else if (product.permission === PERM.CHALLENGE_UNLOCK || productId === 'challenge_39_9') {
      target = await applyChallengeUnlock(db, order, ts)
      if (!target.ok) return _fail(target, '挑战权益未发放（目标未证明）')
      granted.push(PERM.CHALLENGE_UNLOCK, ...perms)
    } else if (MEMBERSHIP_TYPES.includes(product.type)) {
      target = await applyMembership(db, order, ts)
      if (!target.ok) return _fail(target, '会员权益未发放（目标未证明）')
      granted.push(...perms)
    } else {
      // 其它一次性 / 咨询：仅登记权限字符串，无存储目标
      granted.push(...perms)
    }

    // ── entitlements 权限缓存 ──
    const uniquePerms = [...new Set(granted)]
    await _upsertEntitlements(db, openid, uniquePerms, productId, ts)

    return {
      success: true,
      granted: uniquePerms,
      applied: true,
      idempotent: !!target.idempotent,
      summary: `已发放 ${uniquePerms.length} 项权益`,
    }
  } catch (err) {
    console.error('[entitlementService] grantEntitlements 异常:', err.message)
    return { success: false, granted: [], applied: false, summary: '发放异常: ' + err.message }
  }
}

function _fail (target, summary) {
  return { success: false, granted: [], applied: false, reason: target.reason, summary }
}

/**
 * revokeEntitlements — 退款回收权益
 * 显式商品权益权威回收；不改变既有对外行为。
 */
async function revokeEntitlements (db, order) {
  const { openid, productId, relatedId } = order
  const ts = now()
  try {
    const productRes = await db.collection('products').where({ productId }).limit(1).get()
    const product = (productRes && productRes.data && productRes.data[0]) || {}

    if (MEMBERSHIP_TYPES.includes(product.type)) {
      await db.collection('memberships').where({ openid, status: 'active' }).update({
        data: { status: 'refunded', updatedAt: ts },
      })
      await db.collection('users').where({ openid }).update({
        data: { membershipLevel: 'free', updatedAt: ts },
      })
    }

    if (product.permission === PERM.REPORT_UNLOCK && relatedId) {
      await db.collection('ai_reports').where({ reportId: relatedId, openid }).update({
        data: { isPaid: false, updatedAt: ts },
      })
    }
    if (product.permission === PERM.CHALLENGE_UNLOCK && relatedId) {
      await db.collection('challenge_records').where({ recordId: relatedId, openid }).update({
        data: { trialMode: true, unlocked: false, updatedAt: ts },
      })
    }

    await _downgradeToFree(db, openid)
  } catch (e) {
    console.error('[entitlementService] revokeEntitlements 异常:', e.message)
  }
}

/**
 * refreshEntitlements — 重算用户权限（保持既有行为）
 */
async function refreshEntitlements (db, openid) {
  const ts = now()
  try {
    const [memRes, entRes] = await Promise.all([
      db.collection('memberships')
        .where({ openid, status: 'active', expiredAt: db.command.gt(ts) })
        .limit(1).get(),
      db.collection('entitlements').where({ openid }).limit(1).get(),
    ])

    const member = memRes.data[0]
    const ent = entRes.data[0]

    if (member) {
      const newPerms = [...new Set([
        ...FREE_PERMISSIONS,
        ...(member.permissions || []),
        ...(PRODUCT_PERMISSIONS[member.memberType] || []),
      ])]
      if (ent) {
        await db.collection('entitlements').doc(ent._id).update({ data: { permissions: newPerms, updatedAt: ts } })
      } else {
        await db.collection('entitlements').add({
          data: {
            openid, permissions: newPerms,
            sources: [{ productId: member.memberType, expiresAt: member.expiredAt }],
            createdAt: ts, updatedAt: ts,
          },
        })
      }
    } else {
      await _downgradeToFree(db, openid)
    }
    return { success: true }
  } catch (err) {
    console.error('[entitlementService] refreshEntitlements 异常:', err.message)
    return { success: false }
  }
}

/**
 * getEntitlementState — 获取用户权限完整状态（保持既有行为）
 */
async function getEntitlementState (db, openid) {
  try {
    const ts = now()
    const [entRes, memRes] = await Promise.all([
      db.collection('entitlements').where({ openid }).limit(1).get(),
      db.collection('memberships').where({ openid, status: 'active', expiredAt: db.command.gt(ts) }).limit(1).get(),
    ])
    const level = await getMembershipLevel(db, openid)
    const member = memRes.data[0]
    return {
      openid,
      permissions: entRes.data[0]?.permissions || FREE_PERMISSIONS,
      membershipLevel: level,
      membershipExpiredAt: member?.expiredAt || 0,
      isVip: level !== 'free',
      isYearly: level === 'yearly',
      sources: entRes.data[0]?.sources || [],
    }
  } catch (_) {
    return {
      openid, permissions: FREE_PERMISSIONS, membershipLevel: 'free',
      membershipExpiredAt: 0, isVip: false, isYearly: false, sources: [],
    }
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

async function _upsertEntitlements (db, openid, newPerms, productId, ts) {
  const entRes = await db.collection('entitlements').where({ openid }).limit(1).get()
  const newSource = { productId, expiresAt: 0 }
  if (entRes.data.length > 0) {
    const existing = entRes.data[0]
    const mergedPerms = [...new Set([...(existing.permissions || []), ...newPerms])]
    const mergedSources = [...(existing.sources || []), newSource]
    await db.collection('entitlements').doc(existing._id).update({
      data: { permissions: mergedPerms, sources: mergedSources, updatedAt: ts },
    })
  } else {
    await db.collection('entitlements').add({
      data: { openid, permissions: newPerms, sources: [newSource], createdAt: ts, updatedAt: ts },
    })
  }
}

async function _downgradeToFree (db, openid) {
  const ts = now()
  await db.collection('entitlements').where({ openid }).update({
    data: { permissions: FREE_PERMISSIONS, sources: [], updatedAt: ts },
  })
  await db.collection('users').where({ openid }).update({
    data: { membershipLevel: 'free', membershipExpiredAt: 0, updatedAt: ts },
  })
}

function _productIdToLevel (productId) {
  if (productId.includes('MONTHLY') || productId.includes('month')) return 'monthly'
  if (productId.includes('QUARTERLY') || productId.includes('quarter')) return 'quarterly'
  if (productId.includes('YEARLY') || productId.includes('year')) return 'yearly'
  if (productId.includes('bundle')) return 'yearly'
  return 'vip'
}

module.exports = {
  grantEntitlements,
  revokeEntitlements,
  refreshEntitlements,
  getEntitlementState,
  // target authorities (exported for deterministic tests)
  applyReportUnlock,
  applyChallengeUnlock,
  applyMembership,
}
