/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * getSystemConfig 云函数
 *
 * 职责：读取 system_configs 集合，支持按 key 查询或全量返回
 *   注意：运营敏感配置（如 AI_API_KEY）不返回前端
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')

// 前端可读的 key 白名单
const PUBLIC_CONFIG_KEYS = [
  'app_version',
  'free_ai_count',
  'daily_insight_count',
  'challenge_max_days',
  'share_title',
  'share_image_url',
]

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) return fail(CODES.AUTH_FAILED)

  const { key } = event || {}
  console.log(`[getSystemConfig] openid=${openid} key=${key || 'ALL'}`)

  try {
    const configsCol = db.collection('system_configs')

    let configs
    if (key) {
      const res = await configsCol.where({ configKey: key }).limit(1).get()
      configs = res.data
    } else {
      const res = await configsCol.limit(100).get()
      configs = res.data
    }

    // 过滤：只返回白名单内的配置
    const publicConfigs = configs
      .filter(c => PUBLIC_CONFIG_KEYS.includes(c.configKey))
      .reduce((acc, c) => {
        acc[c.configKey] = c.value
        return acc
      }, {})

    return ok({ configs: publicConfigs })
  } catch (err) {
    console.error('[getSystemConfig] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
