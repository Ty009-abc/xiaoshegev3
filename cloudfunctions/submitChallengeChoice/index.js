/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * submitChallengeChoice 云函数
 *
 * 核心:
 *   1. 查询 record + event + choice
 *   2. effects 增量合并到 scores（钳位 0-100）
 *   3. tags 合并去重
 *   4. choices 追加记录
 *   5. currentEventIndex + 1
 *   6. 最后一道 → status=finished → 计算 finalType
 *   7. 同步更新 user_profiles
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const now = () => Date.now()

const DIMS = [
  'laborMindset', 'probabilityMindset', 'systemThinking',
  'leverageThinking', 'capitalThinking', 'riskAwareness',
  'informationSensitivity', 'longTermism', 'decisionStability',
]

function clampScore(v) {
  return Math.max(0, Math.min(100, v))
}

function calcFinalType(scores) {
  if ((scores.leverageThinking || 50) > 75 && (scores.probabilityMindset || 50) > 70) return 'strategic'
  if ((scores.laborMindset || 50) > 75 && (scores.leverageThinking || 50) < 40) return 'effort_trap'
  if ((scores.riskAwareness || 50) < 35) return 'high_risk'
  if ((scores.informationSensitivity || 50) > 75) return 'opportunity_hunter'
  if ((scores.systemThinking || 50) > 75) return 'system_thinker'
  return 'normal_awakened'
}

function calcWealthPotential(scores) {
  const w = { capitalThinking: 0.2, leverageThinking: 0.18, systemThinking: 0.16, informationSensitivity: 0.12, probabilityMindset: 0.1, riskAwareness: 0.08, longTermism: 0.08, decisionStability: 0.05, laborMindset: 0.03 }
  let t = 0
  for (const [k, v] of Object.entries(w)) t += (scores[k] || 50) * v
  return Math.min(100, Math.max(0, Math.round(t)))
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { recordId, eventId, choiceKey } = event
  if (!recordId || !eventId || !choiceKey) {
    return fail(CODES.PARAM_ERROR, '缺少 recordId/eventId/choiceKey')
  }

  console.log(`[submitChoice] openid=${openid} recordId=${recordId} eventId=${eventId} choice=${choiceKey}`)
  const ts = now()

  try {
    // 1. 查 record
    const recRes = await db.collection('challenge_records').where({ recordId, openid }).limit(1).get()
    const record = recRes.data[0]
    if (!record) return fail(CODES.NOT_FOUND, '挑战记录不存在')
    if (record.status === 'finished') return fail(CODES.PARAM_ERROR, '挑战已完成')

    // 2. 查 event
    const evtRes = await db.collection('challenge_events').where({ eventId, status: 'active' }).limit(1).get()
    const ce = evtRes.data[0]
    if (!ce) return fail(CODES.NOT_FOUND, '题目不存在')

    // 3. 找到对应 choice
    const choice = (ce.choices || []).find(c => c.key === choiceKey)
    if (!choice) return fail(CODES.PARAM_ERROR, '选项不存在')

    // 4. 合并 scores
    const newScores = { ...record.scores }
    if (choice.effects) {
      for (const dim of DIMS) {
        if (choice.effects[dim] !== undefined) {
          newScores[dim] = clampScore((newScores[dim] || 50) + (choice.effects[dim] || 0))
        }
      }
      if (choice.effects.cv !== undefined) {
        newScores.cv = (newScores.cv || 0) + (choice.effects.cv || 0)
      }
    }

    // 5. tags 合并去重
    const currentTags = record.tags || []
    const newTagSet = new Set([...currentTags, ...(choice.tags || [])])
    const mergedTags = Array.from(newTagSet)

    // 6. choices 追加
    const newChoices = [
      ...(record.choices || []),
      {
        eventId,
        choice: choiceKey,
        choiceText: choice.text,
        createdAt: ts,
      },
    ]

    // 7. 计算进度
    const newIndex = record.currentEventIndex + 1
    const isDiagnostic = record.mode === 'diagnostic'
    const diagLimit = 6
    const totalRes = await db.collection('challenge_events').where({ status: 'active' }).count()
    const totalEvents = totalRes.total
    const isLast = isDiagnostic ? newIndex >= diagLimit : newIndex >= totalEvents

    // 8. 更新 record
    const updateData = {
      scores: newScores,
      tags: mergedTags,
      choices: newChoices,
      currentEventIndex: newIndex,
      currentDay: newIndex + 1,
      updatedAt: ts,
    }

    if (isLast) {
      updateData.status = 'finished'
      updateData.finishedAt = ts
      updateData.finalType = calcFinalType(newScores)
    } else {
      updateData.status = 'processing'
    }

    await db.collection('challenge_records').doc(record._id).update({ data: updateData })

    // 9. 同步更新 user_profiles
    try {
      const profRes = await db.collection('user_profiles').where({ openid }).limit(1).get()
      if (profRes.data[0]) {
        const profileUpdate = { updatedAt: ts }
        for (const dim of DIMS) {
          if (choice.effects && choice.effects[dim] !== undefined && choice.effects[dim] !== 0) {
            const newVal = clampScore((profRes.data[0][dim] || 50) + (choice.effects[dim] || 0))
            profileUpdate[dim] = newVal
          }
        }
        profileUpdate.wealthPotentialScore = calcWealthPotential({
          ...profRes.data[0], ...profileUpdate,
        })
        profileUpdate.tags = mergedTags
        profileUpdate.latestChallengeRecordId = recordId
        await db.collection('user_profiles').doc(profRes.data[0]._id).update({ data: profileUpdate })
      }
    } catch (pErr) {
      console.warn('[submitChoice] 同步 profile 失败:', pErr.message)
    }

    return ok({
      recordId,
      choice: choiceKey,
      currentEventIndex: newIndex,
      isLast,
      status: isLast ? 'finished' : 'processing',
      ...(isLast ? { finalType: updateData.finalType } : {}),
      progress: { current: isLast ? totalEvents : newIndex, total: totalEvents },
    })
  } catch (err) {
    console.error('[submitChoice] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
