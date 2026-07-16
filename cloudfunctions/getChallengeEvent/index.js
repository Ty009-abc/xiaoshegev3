/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * getChallengeEvent 云函数
 *
 * 规则:
 *   1. 查询 challenge_records 获取 currentEventIndex
 *   2. 根据 currentEventIndex 取 challenge_events（按 sort 排序）
 *   3. trialMode 且 currentEventIndex >= 3 → need_payment
 *   4. 不返回 choices.effects 给前端
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { recordId } = event
  if (!recordId) return fail(CODES.PARAM_ERROR, '缺少 recordId')

  console.log(`[getChallengeEvent] openid=${openid} recordId=${recordId}`)

  try {
    // 读取挑战记录
    const recordRes = await db.collection('challenge_records')
      .where({ recordId, openid })
      .limit(1)
      .get()

    const record = recordRes.data[0]
    if (!record) return fail(CODES.NOT_FOUND, '挑战记录不存在')

    const isDiagnostic = record.mode === 'diagnostic'
    const diagLimit = 6

    if (record.status === 'finished') {
      return ok({
        finished: true,
        recordId,
        finalType: record.finalType,
        message: '挑战已完成，请查看结果',
      })
    }

    // 诊断模式：6题上限 → 标记完成
    if (isDiagnostic && record.currentEventIndex >= diagLimit) {
      await db.collection('challenge_records').doc(record._id).update({
        data: { status: 'finished', finishedAt: Date.now(), updatedAt: Date.now() }
      }).catch(() => {})
      return ok({ finished: true, recordId, finalType: record.finalType || 'diagnostic_done', message: '诊断完成，请查看翻身策略报告' })
    }

    // trialMode 限制（非诊断模式）
    if (!isDiagnostic && record.trialMode && record.currentEventIndex >= 3) {
      return ok({
        recordId,
        locked: true,
        trialMode: true,
        needPayment: true,
        currentEventIndex: record.currentEventIndex,
        message: '免费体验已结束，付费后解锁完整30天挑战',
      })
    }

    // 读取题目库（按 day 排序取第 currentEventIndex 条）
    const eventsRes = await db.collection('challenge_events')
      .where({ status: 'active' })
      .orderBy('day', 'asc')
      .skip(record.currentEventIndex)
      .limit(1)
      .get()

    const ce = eventsRes.data[0]
    if (!ce) return fail(CODES.NOT_FOUND, '题目已用完，恭喜完成挑战！')

    // 构造返回：不暴露 effects
    const choices = (ce.choices || []).map(c => ({
      key: c.key,
      text: c.text,
      tags: c.tags,
    }))

    const totalEventsRes = await db.collection('challenge_events')
      .where({ status: 'active' })
      .count()

    return ok({
      finished: false,
      eventId: ce.eventId,
      day: ce.day,
      title: ce.title,
      description: ce.description,
      choices,
      difficulty: ce.difficulty,
      progress: {
        current: record.currentEventIndex + 1,
        total: totalEventsRes.total,
        day: ce.day,
      },
      trialMode: record.trialMode || false,
      ...(record.trialMode ? { trialRemaining: Math.max(0, 3 - record.currentEventIndex) } : {}),
    })
  } catch (err) {
    console.error('[getChallengeEvent] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
