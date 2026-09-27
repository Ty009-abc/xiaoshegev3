/**
 * cloudfunctions/adminGetUserDetail/index.js — RC8.9B 用户详情（只读）
 *
 * 返回单个用户的画像 + 行为时间线。仅管理员可调用。
 * 隐私：默认返回 maskedOpenid；完整 OpenID 仅在显式 includeRawOpenid=true 时返回
 * （前端仅在 SUPER_ADMIN/OPERATOR 详情场景请求）。
 * 不返回任何支付密钥 / nonce / 签名 / 敏感 payload。
 *
 * @version RC8.9B
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { ok, fail, CODES } = require('./lib/response.js')

function checkAdmin(db, openid) {
  return db.collection('system_configs').where({ key: 'admin_users', status: 'active' }).limit(1).get()
    .then(r => { const c = r.data[0]; return c && c.value && c.value.openids && c.value.openids.includes(openid) })
    .catch(() => false)
}

function maskOpenid(oid) {
  if (!oid || oid.length <= 8) return oid || ''
  return oid.slice(0, 4) + '***' + oid.slice(-4)
}

// 用户可读标签：User #A82F（openid 后 4 位大写）
function userLabel(oid) {
  if (!oid) return 'User #----'
  return 'User #' + oid.slice(-4).toUpperCase()
}

// 事件 → 可读行为文案（供时间线）
const EVENT_TEXT = {
  app_open: '打开小程序',
  home_view: '打开首页',
  strategy_start: '开始翻身策略',
  questionnaire_start: '开始问卷',
  question_answered: '作答一题',
  questionnaire_complete: '完成问卷',
  report_request: '请求生成报告',
  report_success: '报告生成成功',
  report_fallback: '报告降级（规则兜底）',
  report_fail: '报告生成失败',
  report_view: '查看报告',
  poster_generate: '生成海报',
  poster_save: '保存海报',
  qa_open: '打开AI问答',
  qa_send: '发送AI提问',
  payment_view: '进入付款页',
  payment_create: '创建订单',
  payment_success: '支付成功',
  payment_fail: '支付失败',
  membership_view: '查看会员页',
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const adminOpenid = wxContext.OPENID
  if (!adminOpenid) return fail(CODES.AUTH_FAILED)

  const targetOid = event && event.openid
  const includeRaw = !!(event && event.includeRawOpenid)
  if (!targetOid) return fail(CODES.PARAM_ERROR, '缺少 openid')

  try {
    if (!(await checkAdmin(db, adminOpenid))) return fail(CODES.PERMISSION_DENIED)
  } catch (err) {
    return fail(CODES.DB_ERROR, err.message)
  }

  // 审计：查看用户详情
  try {
    await db.collection('admin_audit_logs').add({
      data: {
        adminOpenid, action: 'USER_DETAIL_VIEWED', targetType: 'user', targetId: targetOid,
        before: {}, after: {}, timestamp: Date.now(),
      },
    })
  } catch (_) {}

  const detail = {
    userId: targetOid,
    maskedOpenid: maskOpenid(targetOid),
    label: userLabel(targetOid),
    basic: {}, usage: {}, monetization: {}, timeline: [],
  }
  if (includeRaw) detail.openid = targetOid

  // ── Basic / Usage / Monetization：users + user_events + orders + memberships ──
  try {
    const [userRes, evCountRes, ordersRes, memRes] = await Promise.all([
      db.collection('users').where({ openid: targetOid }).limit(1).get(),
      db.collection('user_events').where({ openid: targetOid }).count(),
      db.collection('orders').where({ openid: targetOid }).get(),
      db.collection('memberships').where({ openid: targetOid, status: 'active' }).limit(1).get(),
    ])
    const u = (userRes.data && userRes.data[0]) || {}
    const orders = ordersRes.data || []
    const paidOrders = orders.filter(o => o.status === 'paid')
    const totalPaid = paidOrders.reduce((s, o) => s + (o.totalAmount || 0), 0)

    detail.basic = {
      userId: targetOid,
      maskedOpenid: maskOpenid(targetOid),
      firstSeenAt: u.createdAt || u.firstSeenAt || 0,
      lastSeenAt: u.lastActiveAt || 0,
      createdAt: u.createdAt || 0,
      lastActiveAt: u.lastActiveAt || 0,
      status: u.status || 'active',
    }
    if (includeRaw) detail.basic.openid = targetOid

    detail.usage = {
      eventCount: evCountRes.total || 0,
      reportCount: u.reportCount || 0,
      qaCount: u.qaCount || 0,
      activeDays: u.activeDays || 0,
      lastReportAt: u.lastReportAt || 0,
      membershipLevel: u.membershipLevel || 'free',
      cv: u.cv || 0,
    }
    detail.monetization = {
      membershipLevel: u.membershipLevel || 'free',
      membershipExpiredAt: u.membershipExpiredAt || 0,
      entitlement: (memRes.data && memRes.data[0] && memRes.data[0].permissions) || [],
      orderCount: orders.length,
      paidOrderCount: paidOrders.length,
      totalPaid,
    }
  } catch (err) {
    console.warn('[adminGetUserDetail] profile load partial:', err && err.message)
  }

  // ── Timeline：最近 50 条事件，倒序 ──
  try {
    const evRes = await db.collection('user_events')
      .where({ openid: targetOid })
      .orderBy('timestamp', 'desc')
      .limit(50)
      .field({ eventName: true, timestamp: true, page: true, source: true, metadata: true })
      .get()
    detail.timeline = (evRes.data || []).map(e => ({
      eventName: e.eventName,
      text: EVENT_TEXT[e.eventName] || e.eventName,
      timestamp: e.timestamp,
      page: e.page || '',
      source: e.source || '',
    }))
  } catch (err) {
    console.warn('[adminGetUserDetail] timeline unavailable:', err && err.message)
  }

  return ok(detail)
}
