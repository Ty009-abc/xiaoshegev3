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
 *
 * RC8_14_B — 并发冲突语义（服务端原子性，非进程内锁 / 非客户端防重复点击）:
 *   - 同一记录 + 同一事件 + 相同选择：只生效一次，重复请求返回一致结果(idempotent)。
 *   - 同一事件 + 不同选择：只允许一个成功，其余显式返回 CONFLICT(409)。
 *   - 过期/非当前事件：不得推进后续事件（PARAM_ERROR）。
 *   - 不同记录 / 不同用户：互不干扰（条件写按 _id + openid + 版本）。
 *   推进采用「版本条件原子更新」（CAS on currentEventIndex），失败则重读并按语义裁决；
 *   事件推进、choices 记录、rawScores/scores/tags 计数在同一原子写内提交，重试不产生重复副作用。
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const { ok, fail, CODES } = require('./lib/response.js')
const planAuthority = require('./lib/challengePlan.js')
const {
  DIMS, SCORING_VERSION,
  normalizeScores, initRawScores, accumulateRawScores,
  detectScoringVersion, calcFinalType, calcWealthPotential,
} = require('./lib/scoring.js')
const now = () => Date.now()

// 有界 CAS 重试：冲突者会被重新裁决（幂等 / 冲突 / 过期），不会无限自旋。
const MAX_CAS_ATTEMPTS = 5

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { recordId, eventId, choiceKey } = event
  if (!recordId || !eventId || !choiceKey) {
    return fail(CODES.PARAM_ERROR, '缺少 recordId/eventId/choiceKey')
  }

  console.log(`[submitChoice] openid=${openid} recordId=${recordId} eventId=${eventId} choice=${choiceKey}`)

  try {
    // 1) 查 record（仅本人记录：openid 限定，天然用户隔离）
    const recRes = await db.collection('challenge_records').where({ recordId, openid }).limit(1).get()
    const record = recRes.data[0]
    if (!record) return fail(CODES.NOT_FOUND, '挑战记录不存在')
    if (record.status === 'finished') return fail(CODES.PARAM_ERROR, '挑战已完成')

    // 2) 查 event（题目本身必须存在且 active）
    const evtRes = await db.collection('challenge_events').where({ eventId, status: 'active' }).limit(1).get()
    const ce = evtRes.data[0]
    if (!ce) return fail(CODES.NOT_FOUND, '题目不存在')

    // 3) 选项必须存在（早失败，避免无效写）
    const choice = (ce.choices || []).find(c => c.key === choiceKey)
    if (!choice) return fail(CODES.PARAM_ERROR, '选项不存在')

    // ── CAS 循环：所有"是否推进 / 是否冲突 / 是否重复"的裁决都在最新状态上进行 ──
    let base = record
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
      // 版本令牌：currentEventIndex（startChallenge 建档时必写；缺失视为 0，保证可终止）
      const baseIdx = Number.isInteger(base.currentEventIndex) ? base.currentEventIndex : 0
      const plan = (base.plan && Array.isArray(base.plan.eventIds)) ? base.plan : null
      const expectedId = plan ? planAuthority.eventIdAtIndex(plan, baseIdx) : null
      const answered = (base.choices || []).find(c => c && c.eventId === eventId)

      // (a) 已作答同一事件
      if (answered) {
        if (answered.choice === choiceKey) {
          // 相同选择：幂等，不重复计分、不推进
          return ok({
            recordId, eventId, choice: answered.choice, duplicate: true, idempotent: true,
            currentEventIndex: base.currentEventIndex,
            status: base.status,
            _note: '该题已提交且选择一致，未重复计分',
          })
        }
        // 不同选择：冲突，只有第一次生效
        const conflict = fail(CODES.CONFLICT, '该题已用其他选项提交，请刷新')
        conflict.data = { recordId, eventId, submittedChoice: answered.choice, currentEventIndex: base.currentEventIndex, conflict: true }
        return conflict
      }

      // (b) 有持久化 plan 时，plan 是唯一权威：eventId 必须等于当前索引题，否则视为过期/越界
      if (plan && expectedId && expectedId !== eventId) {
        return fail(CODES.PARAM_ERROR, '提交的题目与当前进度不一致')
      }
      // 无 plan（legacy）时：以 record.currentEventIndex 与已答题为准；已答题已在 (a) 处理，
      // 未作答事件在无 plan 下按历史行为允许推进（错误题由前端/后续 plan 收敛约束）。

      // 4) 计分引擎（基于最新 base 重算，保证重试不重复副作用）
      const scoringVer = detectScoringVersion(base)
      let rawScores, scores
      if (scoringVer === SCORING_VERSION) {
        rawScores = accumulateRawScores(base.rawScores, choice.effects || {})
        scores = normalizeScores(rawScores)
      } else {
        rawScores = accumulateRawScores(null, choice.effects || {})
        scores = normalizeScores(rawScores)
      }
      const currentCV = scoringVer === SCORING_VERSION ? (base.rawScores?.cv || 0) : 0
      const newCV = (choice.effects?.cv !== undefined) ? currentCV + (choice.effects.cv || 0) : currentCV
      rawScores.cv = newCV
      scores.cv = Math.max(0, Math.min(100, newCV))

      // 5) tags 合并去重
      const currentTags = base.tags || []
      const mergedTags = Array.from(new Set([...currentTags, ...(choice.tags || [])]))

      // 6) choices 追加
      const ts = now()
      const newChoices = [
        ...(base.choices || []),
        { eventId, choice: choiceKey, choiceText: choice.text, createdAt: ts },
      ]

      // 7) 进度 —— 完成以【持久化 plan 长度】为准（非 bank count）
      const newIndex = baseIdx + 1
      const isDiagnostic = base.mode === 'diagnostic'
      const diagLimit = 6
      let totalEvents
      if (plan) {
        totalEvents = plan.eventIds.length
      } else {
        const totalRes = await db.collection('challenge_events').where({ status: 'active' }).count()
        totalEvents = totalRes.total
      }
      const target = isDiagnostic ? Math.min(diagLimit, totalEvents || diagLimit) : totalEvents
      const isLast = newIndex >= target
      const displayDay = Math.min(newIndex + 1, target)

      const updateData = {
        scores,
        rawScores,
        scoringVersion: SCORING_VERSION,
        tags: mergedTags,
        choices: newChoices,
        currentEventIndex: newIndex,
        currentDay: displayDay,
        updatedAt: ts,
      }
      if (isLast) {
        updateData.status = 'finished'
        updateData.finishedAt = ts
        updateData.finalType = calcFinalType(scores)
      } else {
        updateData.status = 'processing'
      }

      // 8) 版本条件原子更新：仅当 currentEventIndex 仍等于读到的基准版本才写入。
      //    并发下只有一个请求命中（其余 stats.updated===0），从根上消除"读-改-写"丢更新。
      const upd = await db.collection('challenge_records')
        .where({ _id: base._id, openid, status: db.command.neq('finished'), currentEventIndex: baseIdx })
        .update({ data: updateData })

      if (!upd.stats || upd.stats.updated !== 1) {
        // 竞争失败：重新读取最新状态，下一轮按 (a)/(b) 语义裁决（幂等 / 冲突 / 过期）
        const fresh = await db.collection('challenge_records').where({ recordId, openid }).limit(1).get()
        const f = fresh.data[0]
        if (!f) return fail(CODES.NOT_FOUND, '挑战记录不存在')
        if (f.status === 'finished') {
          const again = (f.choices || []).find(c => c && c.eventId === eventId)
          if (again && again.choice === choiceKey) {
            return ok({ recordId, eventId, choice: again.choice, duplicate: true, idempotent: true, currentEventIndex: f.currentEventIndex, status: f.status, _note: '该题已提交且选择一致，未重复计分' })
          }
          return fail(CODES.PARAM_ERROR, '挑战已完成')
        }
        base = f
        continue
      }

      // 9) 同步 user_profiles（尽力而为；失败不影响已提交的权威记录）
      try {
        const profRes = await db.collection('user_profiles').where({ openid }).limit(1).get()
        if (profRes.data[0]) {
          const profileUpdate = { updatedAt: ts }
          for (const dim of DIMS) {
            if (choice.effects && choice.effects[dim] !== undefined && choice.effects[dim] !== 0) {
              profileUpdate[dim] = scores[dim] !== undefined ? scores[dim] : 50
            }
          }
          profileUpdate.wealthPotentialScore = calcWealthPotential({ ...profRes.data[0], ...profileUpdate })
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
    }

    // 有界重试耗尽（高竞争）：不产生副作用，返回冲突让客户端重试
    return fail(CODES.CONFLICT, '并发提交冲突，请重试')
  } catch (err) {
    console.error('[submitChoice] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
