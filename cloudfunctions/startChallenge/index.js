/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * startChallenge 云函数
 *
 * 职责:
 *   1. 权益权威判定（entitlements → memberships，不再只看会员等级）
 *   2. 已拥有挑战记录优先复用（trialMode === false 或 unlocked === true）
 *   3. 仅真正无权益用户才创建 trialMode=true 记录
 *
 * PAYMENT_STAGE5A_R6_CHALLENGE_ENTRY_AUTHORITY
 *   入口优先级（服务端权威，绝不信任客户端声明）:
 *     A. 已拥有记录（trialMode===false 或 unlocked===true），取最新
 *        → 存在且未 finished: 返回同一 recordId（resumed, completed=false）
 *        → 存在且 finished:   返回同一 recordId（resumed, completed=true, destination=challenge_result）
 *        两种情况都【不新建】任何记录。
 *     B. 无已拥有记录但持有 challenge_39_9 权益（entitlements.challenge_full）
 *        → 全新一轮只能以 entitled 身份开始（trialMode=false），绝不降级为 trial。
 *     C. 既无已拥有记录也无权益 → trialMode=true（免费前 3 题）。
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const { hasChallengeEntitlement } = require('./lib/challengeEntitlement.js')
const now = () => Date.now()

const VIP_LEVELS = ['vip_month', 'vip_quarter', 'vip_year', 'svip', 'lifetime']

// 生成 recordId（接收请求级 ts，确保 recordId 时间戳与记录时间一致）
function genRecordId(ts) {
  const rnd = Math.random().toString(36).slice(2, 8)
  return `CR${ts}${rnd}`
}

const DEFAULT_INIT = {
  laborMindset: 0, probabilityMindset: 0, systemThinking: 0,
  leverageThinking: 0, capitalThinking: 0, riskAwareness: 0,
  informationSensitivity: 0, longTermism: 0, decisionStability: 0,
  cv: 0,
}

// ── 权益权威：entitlements(挑战权益) 优先；会员仅作快速路径（真正裁量在 permissionEngine）──
async function _resolveChallengeAccess(openid, ts) {
  let hasAccess = false

  // (1) 会员快速路径：仅在会员有效且权限含 challenge_unlock/challenge_full 时
  try {
    const memberRes = await db.collection('memberships')
      .where({ openid, status: 'active' })
      .limit(1)
      .get()
    const member = memberRes.data[0]
    if (member && (!member.expiredAt || member.expiredAt > ts)) {
      const perms = member.permissions || []
      if (perms.includes('challenge_unlock') || perms.includes('challenge_full')) hasAccess = true
    }
  } catch (_) {}

  // (2) 权威权益：entitlements / memberships 的 challenge_full（canonical permissionEngine）
  if (!hasAccess) {
    try { hasAccess = await hasChallengeEntitlement(db, openid) } catch (_) { hasAccess = false }
  }

  return hasAccess
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  // 请求级时间戳 —— 同一个请求内所有时间字段使用同一个 ts
  const ts = now()

  const { mode = 'default' } = event
  const isDiagnostic = mode === 'diagnostic'

  try {
    const userRes = await db.collection('users').where({ openid }).limit(1).get()
    if (!userRes.data[0]) return fail(CODES.AUTH_FAILED, '用户不存在')

    // 服务端权威权益（一次性解析，后续复用）
    const hasAccess = isDiagnostic ? false : await _resolveChallengeAccess(openid, ts)
    const trialMode = isDiagnostic ? false : !hasAccess

    // ── A. 已拥有记录优先（trialMode===false 或 unlocked===true，取最新）──
    if (!isDiagnostic) {
      let owned = null

      // A1：trialMode === false（支付 finalizer 写入的解锁权威）
      const ownedRes = await db.collection('challenge_records')
        .where({ openid, mode: 'challenge', trialMode: false })
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()
      owned = ownedRes.data[0] || null

      // A2：兜底 unlocked === true（字段/旧数据形态）
      if (!owned) {
        const ownedRes2 = await db.collection('challenge_records')
          .where({ openid, mode: 'challenge', unlocked: true })
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get()
        owned = ownedRes2.data[0] || null
      }

      if (owned) {
        if (owned.status !== 'finished') {
          // 未完成 → 续玩同一记录
          console.log(`[startChallenge] resume owned record recordId=${owned.recordId}`)
          return ok({
            recordId: owned.recordId,
            currentDay: owned.currentDay,
            currentEventIndex: owned.currentEventIndex,
            trialMode: false,
            unlocked: true,
            mode: 'challenge',
            scoringVersion: owned.scoringVersion || 'normalized_v2',
            rawScores: owned.rawScores,
            resumed: true,
            completed: false,
          })
        }
        // 已完成 → 返回同一记录并路由到结果页（不新建、不 trial）
        console.log(`[startChallenge] owned record finished → route result recordId=${owned.recordId}`)
        return ok({
          recordId: owned.recordId,
          currentDay: owned.currentDay,
          currentEventIndex: owned.currentEventIndex,
          trialMode: false,
          unlocked: true,
          mode: 'challenge',
          scoringVersion: owned.scoringVersion || 'normalized_v2',
          rawScores: owned.rawScores,
          finalType: owned.finalType || '',
          resumed: true,
          completed: true,
          destination: 'challenge_result',
        })
      }

      // ── B. 无已拥有记录但持有权益 → 以 entitled（非 trial）身份开启新一轮 ──
      // 产品契约：challenge_39_9 = 一次完整挑战（结果页为核心交付）。
      // 当已拥有记录存在时上面已复用/路由；此处仅为“权益存在但无归属记录”
      // 的兜底（例如记录被清理），绝不再造 trial。
      if (hasAccess) {
        const recordId = genRecordId(ts)
        const record = _buildRecord({ recordId, openid, ts, trialMode: false, mode: 'challenge' })
        await db.collection('challenge_records').add({ data: record })
        return ok({
          recordId,
          currentDay: 1,
          currentEventIndex: 0,
          trialMode: false,
          unlocked: true,
          mode: 'challenge',
          scoringVersion: 'normalized_v2',
          rawScores: { ...DEFAULT_INIT },
        })
      }
    }

    // ── C. 真正无权益（或诊断模式）→ 原行为：trial / diagnostic ──
    const recordId = genRecordId(ts)
    const record = _buildRecord({
      recordId, openid, ts, trialMode,
      mode: isDiagnostic ? 'diagnostic' : 'challenge',
    })
    await db.collection('challenge_records').add({ data: record })

    return ok({
      recordId,
      currentDay: 1,
      currentEventIndex: 0,
      trialMode,
      mode: isDiagnostic ? 'diagnostic' : 'challenge',
      scoringVersion: 'normalized_v2',
      rawScores: { ...DEFAULT_INIT },
      ...(trialMode ? { trialLimit: 3 } : {}),
    })
  } catch (err) {
    console.error('[startChallenge] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}

function _buildRecord({ recordId, openid, ts, trialMode, mode }) {
  return {
    recordId,
    openid,
    currentDay: 1,
    currentEventIndex: 0,
    status: 'processing',
    rawScores: { ...DEFAULT_INIT },
    scoringVersion: 'normalized_v2',
    choices: [],
    tags: [],
    finalType: '',
    trialMode,
    mode,
    startedAt: ts,
    finishedAt: null,
    createdAt: ts,
    updatedAt: ts,
  }
}
