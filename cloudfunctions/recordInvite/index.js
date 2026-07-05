/**
 * recordInvite — 记录邀请 + 发放奖励
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const inviterOpenid = event.inviterOpenid

  if (!inviterOpenid || inviterOpenid === OPENID) return { code: 2001, message: '无效邀请' }

  try {
    // 防止重复
    const exists = await db.collection('invite_records').where({
      inviterOpenid, inviteeOpenid: OPENID
    }).get()

    if (exists.data.length) return { code: 0, message: '已记录' }

    // 写入邀请记录
    await db.collection('invite_records').add({
      data: {
        inviterOpenid,
        inviteeOpenid: OPENID,
        createdAt: Date.now(),
      },
    })

    // 给邀请人加 CV
    await db.collection('users').where({ _openid: inviterOpenid }).update({
      data: { cv: _.inc(20) },
    })

    return { code: 0, message: '邀请已记录 +20CV', data: { cvAdded: 20 } }
  } catch (e) {
    return { code: 5000, message: e.message }
  }
}
