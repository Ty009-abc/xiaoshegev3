/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * getChallengeRecord 云函数
 *
 * 仅允许读取当前 openid 自己的记录
 * 不返回 effects 细节
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

  console.log(`[getChallengeRecord] openid=${openid} recordId=${recordId}`)

  try {
    const res = await db.collection('challenge_records')
      .where({ recordId, openid })
      .limit(1)
      .get()

    const record = res.data[0]
    if (!record) return fail(CODES.NOT_FOUND, '挑战记录不存在')

    return ok({
      recordId: record.recordId,
      status: record.status,
      currentDay: record.currentDay,
      currentEventIndex: record.currentEventIndex,
      scores: record.scores,
      tags: record.tags,
      choices: record.choices,
      finalType: record.finalType || '',
      trialMode: record.trialMode || false,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
    })
  } catch (err) {
    console.error('[getChallengeRecord] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
