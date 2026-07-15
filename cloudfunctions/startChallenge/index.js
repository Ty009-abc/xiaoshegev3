/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * startChallenge 云函数
 *
 * 职责:
 *   1. 检查 challenge_unlock 权限
 *   2. 无权限 → trialMode=true，仅前 3 题
 *   3. 创建 challenge_records，初始化九维评分=50
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const now = () => Date.now()

const VIP_LEVELS = ['vip_month', 'vip_quarter', 'vip_year', 'svip', 'lifetime']

// 生成 recordId
function genRecordId() {
  const ts = now()
  const rnd = Math.random().toString(36).slice(2, 8)
  return `CR${ts}${rnd}`
}

const DEFAULT_INIT = {
  laborMindset: 0, probabilityMindset: 0, systemThinking: 0,
  leverageThinking: 0, capitalThinking: 0, riskAwareness: 0,
  informationSensitivity: 0, longTermism: 0, decisionStability: 0,
  cv: 0,
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { mode = 'default' } = event
  const isDiagnostic = mode === 'diagnostic'

  try {
    // 判断权限
    let hasAccess = false
    const userRes = await db.collection('users').where({ openid }).limit(1).get()
    if (!userRes.data[0]) return fail(CODES.AUTH_FAILED, '用户不存在')

    const user = userRes.data[0]

    if (VIP_LEVELS.includes(user.membershipLevel)) {
      // 检查 memberships 表
      const memberRes = await db.collection('memberships')
        .where({ openid, status: 'active' })
        .limit(1)
        .get()

      if (memberRes.data[0] && (!memberRes.data[0].expiredAt || memberRes.data[0].expiredAt > ts)) {
        const perms = memberRes.data[0].permissions || []
        if (perms.includes('challenge_unlock')) hasAccess = true
      }
    }

    const trialMode = isDiagnostic ? false : !hasAccess

    // 创建记录
    const recordId = genRecordId()
    const record = {
      recordId,
      openid,
      currentDay: 1,
      currentEventIndex: 0,
      status: 'processing',
      rawScores: { ...DEFAULT_INIT }, scoringVersion: 'normalized_v2',
      choices: [],
      tags: [],
      finalType: '',
      trialMode,
      mode: isDiagnostic ? 'diagnostic' : 'challenge',
      startedAt: ts,
      finishedAt: null,
      createdAt: ts,
      updatedAt: ts,
    }

    await db.collection('challenge_records').add({ data: record })

    return ok({
      recordId,
      currentDay: 1,
      currentEventIndex: 0,
      trialMode,
      mode: isDiagnostic ? 'diagnostic' : 'challenge',
      ...(trialMode ? { trialLimit: 3 } : {}),
    })
  } catch (err) {
    console.error('[startChallenge] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
