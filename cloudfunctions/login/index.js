/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * login 云函数
 *
 * 职责：
 *   1. 获取 openid（通过 cloud.getWXContext()）
 *   2. 首次登录 → 创建 users + user_profiles
 *   3. 老用户 → 更新 lastLoginAt + lastActiveAt
 *   4. 返回 user + profile + isNewUser
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')

const now = () => Date.now()

// ── 默认值 ──
const DEFAULT_PROFILE = {
  laborMindset: 50,
  probabilityMindset: 50,
  systemThinking: 50,
  leverageThinking: 50,
  capitalThinking: 50,
  riskAwareness: 50,
  informationSensitivity: 50,
  longTermism: 50,
  decisionStability: 50,
  wealthPotentialScore: 50,
  turnaroundProbability: 30,
  mainType: 'unclassified',
  subType: 'new_user',
  tags: [],
  latestReportId: '',
  latestChallengeRecordId: '',
  createdAt: 0,
  updatedAt: 0,
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    console.error('[login] 无法获取 openid')
    return fail(CODES.AUTH_FAILED, '无法获取 openid，请确认在微信环境内')
  }

  const ts = now()
  console.log(`[login] openid=${openid}`)

  try {
    // 检查是否已存在
    const usersCol = db.collection('users')
    const profilesCol = db.collection('user_profiles')

    const userRes = await usersCol.where({ openid }).limit(1).get()
    const existingUser = userRes.data[0] || null

    if (existingUser) {
      // ── 老用户：更新活跃时间 ──
      console.log(`[login] 老用户，更新 lastLoginAt`)
      await usersCol.doc(existingUser._id).update({
        data: {
          lastLoginAt: ts,
          lastActiveAt: ts,
          updatedAt: ts,
        },
      })

      // 读取 profile
      let profile = null
      try {
        const profileRes = await profilesCol.where({ openid }).limit(1).get()
        if (profileRes.data[0]) {
          profile = profileRes.data[0]
        }
      } catch (e) {
        // profile 缺失不阻断登录
        console.error('[login] profile 查询失败:', e.message)
      }

      return ok({
        openid,
        isNewUser: false,
        user: {
          ...existingUser,
          lastLoginAt: ts,
          lastActiveAt: ts,
          updatedAt: ts,
        },
        profile,
      })
    }

    // ── 新用户：创建 user + profile ──
    console.log(`[login] 新用户，创建 user 和 profile`)

    const newUser = {
      openid,
      unionid: '',
      nickname: '',
      avatarUrl: '',
      gender: 0,
      city: '',
      province: '',
      country: '',
      phone: '',
      email: '',
      cv: 0,
      level: 1,
      exp: 0,
      membershipLevel: 'free',
      membershipExpiredAt: null,
      freeAiCount: 3,
      dailyAiUsed: 0,
      dailyInsightRead: false,
      lastLoginAt: ts,
      lastActiveAt: ts,
      status: 'active',
      createdAt: ts,
      updatedAt: ts,
    }

    const newProfile = {
      openid,
      ...DEFAULT_PROFILE,
      createdAt: ts,
      updatedAt: ts,
    }

    const userAddResult = await usersCol.add({ data: newUser })
    const profileAddResult = await profilesCol.add({ data: newProfile })

    newUser._id = userAddResult._id
    newProfile._id = profileAddResult._id

    return ok({
      openid,
      isNewUser: true,
      user: newUser,
      profile: newProfile,
    })

  } catch (err) {
    console.error('[login] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
