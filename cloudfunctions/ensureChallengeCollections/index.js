/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * ensureChallengeCollections 云函数
 *
 * 安全幂等集合初始化器。
 * 只在集合不存在时创建，不清空、不写 seed。
 * 适用：challenge_records (及其他挑战链必需集合)
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const REQUIRED_COLLECTIONS = [
  'challenge_records',
  'challenge_events',
  'ai_reports',
]

/**
 * 幂等创建集合：先 try 查询，失败则创建
 */
async function ensureCollection(name) {
  try {
    await db.collection(name).limit(1).get()
    const countRes = await db.collection(name).count()
    return { collection: name, created: false, existedAlready: true, count: countRes.total }
  } catch (err) {
    if (err.errCode === -502005 || (err.message && err.message.includes('not exist'))) {
      try {
        await db.createCollection(name)
        return { collection: name, created: true, existedAlready: false, count: 0 }
      } catch (createErr) {
        // race condition: another call created it between check and create
        if (createErr.errCode === -502005 || (createErr.message && createErr.message.includes('already exist'))) {
          return { collection: name, created: false, existedAlready: true, count: -1, note: 'race condition, already exists' }
        }
        return { collection: name, created: false, error: createErr.message || String(createErr) }
      }
    }
    return { collection: name, created: false, error: err.message || String(err) }
  }
}

exports.main = async (event, context) => {
  const results = []
  for (const name of REQUIRED_COLLECTIONS) {
    const r = await ensureCollection(name)
    results.push(r)
    console.log(`[ensureChallengeCollections] ${name}: created=${r.created} existed=${r.existedAlready} count=${r.count}`)
  }
  return { code: 0, results }
}
