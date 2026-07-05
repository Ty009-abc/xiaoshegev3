/**
 * adminManageContent - 内容管理
 * 白名单表: daily_insights / world_rules / challenge_events
 * actions: create / update / disable / enable / delete
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { ok, fail, CODES } = require('./lib/response.js')

function checkAdmin(db, openid) {
  return db.collection('system_configs').where({ key: 'admin_users', status: 'active' }).limit(1).get()
    .then(r => { const c = r.data[0]; return c && c.value && c.value.openids && c.value.openids.includes(openid) })
    .catch(() => false)
}

const now = () => Date.now()

const CONTENT_COLLECTIONS = ['daily_insights', 'world_rules', 'challenge_events']
const VALID_ACTIONS = ['create', 'update', 'disable', 'enable', 'delete']

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const adminOpenid = wxContext.OPENID
  if (!adminOpenid) return fail(CODES.AUTH_FAILED)

  const { collection, action, data = {}, docId = '' } = event
  if (!collection || !action) return fail(CODES.PARAM_ERROR, '缺少 collection 或 action')
  if (!CONTENT_COLLECTIONS.includes(collection)) return fail(CODES.PARAM_ERROR, '不允许管理: ' + collection)
  if (!VALID_ACTIONS.includes(action)) return fail(CODES.PARAM_ERROR, '无效 action: ' + action)

  const ts = now()
  console.log(`[adminManageContent] collection=${collection} action=${action}`)

  try {
    if (!(await checkAdmin(db, adminOpenid))) return fail(CODES.PERMISSION_DENIED)

    const col = db.collection(collection)
    let result

    switch (action) {
      case 'create': {
        const createData = { ...data, status: data.status || 'active', createdAt: ts, updatedAt: ts }
        result = await col.add({ data: createData })
        break
      }
      case 'update': {
        if (!docId) return fail(CODES.PARAM_ERROR, 'update 需要 docId')
        const updateData = { ...data, updatedAt: ts }
        delete updateData._id
        result = await col.doc(docId).update({ data: updateData })
        break
      }
      case 'disable':
        if (!docId) return fail(CODES.PARAM_ERROR, 'disable 需要 docId')
        result = await col.doc(docId).update({ data: { status: 'inactive', updatedAt: ts } })
        break
      case 'enable':
        if (!docId) return fail(CODES.PARAM_ERROR, 'enable 需要 docId')
        result = await col.doc(docId).update({ data: { status: 'active', updatedAt: ts } })
        break
      case 'delete':
        if (!docId) return fail(CODES.PARAM_ERROR, 'delete 需要 docId')
        result = await col.doc(docId).remove()
        break
    }

    // 写入 admin_logs
    await db.collection('admin_logs').add({
      data: {
        adminOpenid,
        action: 'manage_content',
        target: `${collection}/${action}/${docId || 'new'}`,
        before: {},
        after: { collection, action, data, docId, result },
        createdAt: ts,
      },
    })

    return ok({ message: `${action} 成功`, result })
  } catch (err) {
    console.error('[adminManageContent] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
