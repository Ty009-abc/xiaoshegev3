/**
 * restoreWorldRules — 世界规则安全恢复云函数
 *
 * 安全特性：
 *   1. 只操作 world_rules 集合
 *   2. 按 ruleId upsert（先查后更新/新增），不删除现有数据
 *   3. dryRun 模式先验证后执行
 *   4. 从内嵌 JSON 加载全量 280 条规则
 *
 * 用法：
 *   dryRun:  {"dryRun": true}
 *   正式恢复: {}
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 所有规则内嵌为 JSON（280 条已验证可解析的规则）
const ALL_RULES = require('./data/world_rules_280.json')

exports.main = async (event) => {
  const { dryRun = false } = event || {}
  const target = ALL_RULES.length

  // 获取现有全部数据
  const existingDocs = await db.collection('world_rules').limit(300).get()
  const existingMap = {}
  existingDocs.data.forEach(doc => { existingMap[doc.ruleId] = doc._id })
  const existingCount = Object.keys(existingMap).length

  const results = {
    target,
    existing: existingCount,
    wouldInsert: 0, wouldUpdate: 0,
    inserted: 0, updated: 0, skipped: 0, failed: 0,
    errors: []
  }

  if (dryRun) {
    for (const rule of ALL_RULES) {
      if (existingMap[rule.ruleId]) { results.wouldUpdate++ }
      else { results.wouldInsert++ }
    }
    return {
      code: 0, success: true, dryRun: true,
      message: `dryRun 完成: 目标${target} 现有${existingCount} 将新增${results.wouldInsert} 将更新${results.wouldUpdate}`,
      results
    }
  }

  // 正式恢复 —— 分批处理（每批50条，避免超时）
  const batchSize = 50
  for (let i = 0; i < ALL_RULES.length; i += batchSize) {
    const batch = ALL_RULES.slice(i, i + batchSize)
    for (const rule of batch) {
      const rid = rule.ruleId
      if (!rid) { results.failed++; continue }
      try {
        const { _id, ...data } = rule
        if (existingMap[rid]) {
          await db.collection('world_rules').doc(existingMap[rid]).update({ data })
          results.updated++
        } else {
          await db.collection('world_rules').add({ data })
          results.inserted++
        }
      } catch (err) {
        results.failed++
        results.errors.push({ ruleId: rid, error: (err.message || String(err)).substring(0, 120) })
      }
    }
    console.log(`[restoreWorldRules] Batch ${Math.floor(i/batchSize)+1}: ${i+1}-${Math.min(i+batchSize,ALL_RULES.length)}/${ALL_RULES.length}`)
  }

  // 最终验证
  const finalCount = await db.collection('world_rules').count()
  results.finalCount = finalCount.total

  return {
    code: results.failed > 0 ? 1 : 0,
    success: results.failed === 0,
    dryRun: false,
    message: `恢复完成: 目标${target} 新增${results.inserted} 更新${results.updated} 失败${results.failed} 最终${results.finalCount}`,
    results
  }
}
