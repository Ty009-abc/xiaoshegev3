/**
 * adminUpdateSystemConfig - 系统配置管理
 * 配置项: paymentEnabled, challengeEnabled, dailyInsightEnabled,
 *         vipEnabled, freeAiCount, trialChallengeCount, aiModel, maintenanceMode
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

const ALLOWED_KEYS = [
  'paymentEnabled', 'challengeEnabled', 'dailyInsightEnabled',
  'vipEnabled', 'freeAiCount', 'trialChallengeCount', 'aiModel', 'maintenanceMode',
]

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const adminOpenid = wxContext.OPENID
  if (!adminOpenid) return fail(CODES.AUTH_FAILED)

  const { key, value } = event
  if (!key || value === undefined) return fail(CODES.PARAM_ERROR, '缺少 key 或 value')

  console.log(`[adminUpdateSystemConfig] key=${key}`)

  try {
    if (!(await checkAdmin(db, adminOpenid))) return fail(CODES.PERMISSION_DENIED)

    const ts = now()
    const cfRes = await db.collection('system_configs').where({ key: 'app_config', status: 'active' }).limit(1).get()
    let configDoc = cfRes.data[0]

    if (!configDoc) {
      // 不存在则创建
      const createRes = await db.collection('system_configs').add({
        data: {
          key: 'app_config',
          value: { [key]: value },
          status: 'active',
          createdAt: ts,
          updatedAt: ts,
        },
      })
      await db.collection('admin_logs').add({
        data: { adminOpenid, action: 'update_system_config', target: 'app_config/' + key, before: {}, after: { [key]: value }, createdAt: ts },
      })
      return ok({ message: '创建成功', key, value, _id: createRes._id })
    }

    // 更新
    const oldVal = configDoc.value || {}
    const newVal = { ...oldVal, [key]: value }
    await db.collection('system_configs').doc(configDoc._id).update({ data: { value: newVal, updatedAt: ts } })

    await db.collection('admin_logs').add({
      data: { adminOpenid, action: 'update_system_config', target: 'app_config/' + key, before: { [key]: oldVal[key] }, after: { [key]: value }, createdAt: ts },
    })

    return ok({ message: '更新成功', key, value })
  } catch (err) {
    console.error('[adminUpdateSystemConfig] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
