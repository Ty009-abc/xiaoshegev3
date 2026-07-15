/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * submitChallengeChoice 云函数
 *
 * 核心:
 *   1. 查询 record + event + choice
 *   2. rawScores 不钳位累加（保留原始增量信息）
 *   3. normalized scores 基于理论区间映射 0-100
 *   4. tags 合并去重
 *   5. choices 追加记录
 *   6. currentEventIndex + 1
 *   7. 最后一道 → status=finished → 计算 finalType
 *   8. 同步更新 user_profiles
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const {
  DIMS, SCORING_VERSION,
  normalizeScores, initRawScores, accumulateRawScores,
  detectScoringVersion, calcFinalType, calcWealthPotential,
} = require('./lib/scoring.js')
const now = () => Date.now()

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

    // 4. 计分引擎：rawScores 不钳位
    const scoringVer = detectScoringVersion(record)
    let rawScores, scores;

    if (scoringVer === SCORING_VERSION) {
      // v2: 已有 rawScores，继续累加
      rawScores = accumulateRawScores(record.rawScores, choice.effects || {})
      scores = normalizeScores(rawScores)
    } else {
      // legacy_v1: 旧记录首次使用新引擎
      // 旧 scores 可能从 50 开始已被 clamp → 从 effects 重新构建 rawScores
      // 但我们不知道旧记录的完整答题历史，从 0 开始用当前题的效果初始化
      rawScores = accumulateRawScores(null, choice.effects || {})
      scores = normalizeScores(rawScores)
      // 保留旧 scores 在 compatLegacyScores 供 AI 报告参考
    }

    // CV 保持累加逻辑
    const currentCV = scoringVer === SCORING_VERSION ? (record.rawScores?.cv || 0) : 0
    const newCV = (choice.effects?.cv !== undefined) ? currentCV + (choice.effects.cv || 0) : currentCV
    rawScores.cv = newCV
    scores.cv = Math.max(0, Math.min(100, newCV)) // CV 显示层归一化，简单钳位

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

    // 8. 更新 record — 兼容旧字段
    const updateData = {
      scores,
      rawScores,
      scoringVersion: SCORING_VERSION,
      tags: mergedTags,
      choices: newChoices,
      currentEventIndex: newIndex,
      currentDay: newIndex + 1,
      updatedAt: ts,
    }

    if (isLast) {
      updateData.status = 'finished'
      updateData.finishedAt = ts
      updateData.finalType = calcFinalType(scores)
    } else {
      updateData.status = 'processing'
    }

    await db.collection('challenge_records').doc(record._id).update({ data: updateData })

    // 9. 同步更新 user_profiles（使用 normalized scores）
    try {
      const profRes = await db.collection('user_profiles').where({ openid }).limit(1).get()
      if (profRes.data[0]) {
        const profileUpdate = { updatedAt: ts }
        for (const dim of DIMS) {
          if (choice.effects && choice.effects[dim] !== undefined && choice.effects[dim] !== 0) {
            profileUpdate[dim] = scores[dim] !== undefined ? scores[dim] : 50
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
      scoringVersion: SCORING_VERSION,
      rawScores,
      scores,
      ...(isLast ? { finalType: updateData.finalType } : {}),
      progress: { current: isLast ? totalEvents : newIndex, total: totalEvents },
    })
  } catch (err) {
    console.error('[submitChoice] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
