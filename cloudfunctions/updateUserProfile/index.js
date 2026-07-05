/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * updateUserProfile 云函数
 *
 * 职责：更新用户认知画像
 *   - 支持增量更新九大认知维度
 *   - 支持追加 tags
 *   - 自动重新计算 wealthPotentialScore / turnaroundProbability / mainType / subType
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')

const now = () => Date.now()

// 九维加权计算财富潜力分
function calcWealthPotential(scores) {
  const weights = {
    capitalThinking: 0.20,
    leverageThinking: 0.18,
    systemThinking: 0.16,
    informationSensitivity: 0.12,
    probabilityMindset: 0.10,
    riskAwareness: 0.08,
    longTermism: 0.08,
    decisionStability: 0.05,
    laborMindset: 0.03,
  }
  let total = 0
  for (const [k, w] of Object.entries(weights)) {
    total += (scores[k] || 50) * w
  }
  return Math.min(100, Math.max(0, Math.round(total)))
}

// 简单翻身概率
function calcTurnaroundProbability(scores) {
  const keyAvg = (
    (scores.leverageThinking || 50) +
    (scores.informationSensitivity || 50) +
    (scores.systemThinking || 50)
  ) / 3
  return Math.min(95, Math.max(5, Math.round(keyAvg * 0.8 + (scores.riskAwareness || 50) * 0.2)))
}

// 主类型判定
function calcMainType(scores) {
  const map = [
    ['laborMindset', 'labor_mindset'],
    ['probabilityMindset', 'probability_mindset'],
    ['systemThinking', 'system_thinker'],
    ['leverageThinking', 'leverage_thinker'],
    ['capitalThinking', 'capital_thinker'],
  ]
  let maxK = 'laborMindset'
  let maxV = 0
  for (const [k] of map) {
    if ((scores[k] || 50) > maxV) { maxV = scores[k]; maxK = k }
  }
  const found = map.find(([k]) => k === maxK)
  return found ? found[1] : 'unclassified'
}

function calcSubType(mainType) {
  const subtypes = {
    labor_mindset: 'hard_worker',
    probability_mindset: 'calculated_risk_taker',
    system_thinker: 'system_builder',
    leverage_thinker: 'leverage_master',
    capital_thinker: 'capital_allocator',
    unclassified: 'new_user',
  }
  return subtypes[mainType] || 'new_user'
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) return fail(CODES.AUTH_FAILED)

  const { scores, tags } = event
  console.log(`[updateUserProfile] openid=${openid} scores=`, scores, 'tags=', tags)

  if (!scores && !tags) {
    return fail(CODES.PARAM_ERROR, '请至少提供 scores 或 tags')
  }

  const ts = now()

  try {
    const profilesCol = db.collection('user_profiles')
    const profileRes = await profilesCol.where({ openid }).limit(1).get()
    const existing = profileRes.data[0]

    if (!existing) {
      return fail(CODES.NOT_FOUND, '用户认知画像不存在，请先登录')
    }

    const updateData = { updatedAt: ts }

    // 九维增量更新
    if (scores) {
      const dims = [
        'laborMindset', 'probabilityMindset', 'systemThinking',
        'leverageThinking', 'capitalThinking', 'riskAwareness',
        'informationSensitivity', 'longTermism', 'decisionStability',
      ]
      for (const dim of dims) {
        if (scores[dim] !== undefined && scores[dim] !== 0) {
          const newVal = (existing[dim] || 50) + (scores[dim] || 0)
          updateData[dim] = Math.min(100, Math.max(0, newVal))
        }
      }
    }

    // 合并当前完整分用于类型计算
    const currentScores = {}
    const dims = [
      'laborMindset', 'probabilityMindset', 'systemThinking',
      'leverageThinking', 'capitalThinking', 'riskAwareness',
      'informationSensitivity', 'longTermism', 'decisionStability',
    ]
    for (const dim of dims) {
      currentScores[dim] = updateData[dim] !== undefined ? updateData[dim] : (existing[dim] || 50)
    }

    updateData.wealthPotentialScore = calcWealthPotential(currentScores)
    updateData.turnaroundProbability = calcTurnaroundProbability(currentScores)
    updateData.mainType = calcMainType(currentScores)
    updateData.subType = calcSubType(updateData.mainType)

    // tags 追加
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const existingTags = existing.tags || []
      const merged = new Set([...existingTags, ...tags])
      updateData.tags = Array.from(merged)
    }

    await profilesCol.doc(existing._id).update({ data: updateData })
    console.log(`[updateUserProfile] 更新完成`)

    return ok({ profile: { ...existing, ...updateData } })
  } catch (err) {
    console.error('[updateUserProfile] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
