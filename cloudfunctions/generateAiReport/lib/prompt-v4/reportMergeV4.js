/**
 * prompt-v4/reportMergeV4.js (v3.2)
 *
 * 合并引擎 Base Contract + AI 输出 → Final Report。
 *
 * 原则：
 * - Base Contract = 权威事实
 * - AI Output = 仅表达补丁
 * - 数字、score、概率、recommend 全部取 Base
 * - AI 的 ruleId 必须匹配 Base 已有 ruleId
 *
 * v3.2: wealthPath 合并增加大小写容忍 + 严格校验，彻底防止 undefined
 */

// ═══════════════════════════════════════════════════════════════
// 可写字段白名单 (从 report root 开始)
// ═══════════════════════════════════════════════════════════════

const WRITABLE_PATHS = new Set([
  'headline.title',
  'headline.subtitle',
  'fatalDiagnosis.mainProblem',
  'fatalDiagnosis.reason',
  'fatalRules.*.title',
  'fatalRules.*.description',
  'fatalRules.*.why',
  'advantageRules.*.title',
  'advantageRules.*.description',
  'advantageRules.*.why',
  'opportunityRules.*.description',
  'opportunityRules.*.why',
  'wealthPath.*.reason',
  'actionPlan.*.goal',
  'actionPlan.*.tasks',
  'actionPlan.*.checkpoint',
  'stopDoing.items',
  'identityUpgrade.currentIdentity',
  'identityUpgrade.targetIdentity',
  'identityUpgrade.gap',
  'identityUpgrade.upgradePath',
  'finalStrike.sentence',
  'finalStrike.shareTitle',
])

/**
 * 检查路径是否在白名单中（支持 * 通配符）
 */
function isWritable(path) {
  for (const p of WRITABLE_PATHS) {
    if (matchPath(p, path)) return true
  }
  return false
}

function matchPath(pattern, path) {
  const patternParts = pattern.split('.')
  const pathParts = path.split('.')
  if (patternParts.length !== pathParts.length) return false
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === '*') continue
    if (patternParts[i] !== pathParts[i]) return false
  }
  return true
}

// ═══════════════════════════════════════════════════════════════
// 深拷贝
// ═══════════════════════════════════════════════════════════════

function deepClone(obj) {
  if (obj === null || obj === undefined) return obj
  return JSON.parse(JSON.stringify(obj))
}

// ═══════════════════════════════════════════════════════════════
// wealthPath key 标准化 — 容忍大小写差异
// ═══════════════════════════════════════════════════════════════

/**
 * 构建一个大小写不敏感的 mapping：{ lowercaseName: originalName }
 * 用于 AI 输出 wealthPathReasons 的 key 可能与 Base Contract name 大小写不一致时做容错匹配
 */
function buildPathNameMap(baseWealthPaths) {
  const map = {}
  for (const p of (baseWealthPaths || [])) {
    if (p.name) {
      map[p.name.toLowerCase()] = p.name
    }
  }
  return map
}

/**
 * 从 wealthPathReasons（AI 输出）中查出 Base Contract 对应的 path 条目
 * 返回 { basePath, reason } 或 null
 */
function resolveWealthPathReason(baseWealthPaths, aiReasons, pathName) {
  if (!aiReasons || typeof aiReasons !== 'object') return null

  const nameMap = buildPathNameMap(baseWealthPaths)

  // 精确匹配
  if (aiReasons[pathName] !== undefined) {
    return aiReasons[pathName]
  }

  // 大小写容错匹配
  const lowerName = pathName.toLowerCase()
  if (nameMap[lowerName]) {
    const exactKey = Object.keys(aiReasons).find(
      k => k.toLowerCase() === lowerName && aiReasons[k] !== undefined
    )
    if (exactKey) return aiReasons[exactKey]
  }

  return null
}

// ═══════════════════════════════════════════════════════════════
// 合并逻辑 (v3.2)
// ═══════════════════════════════════════════════════════════════

/**
 * @param {Object} baseContract — 完整的 V4 Report Contract
 * @param {Object} aiOutput — parseAIOutput 返回的 data
 * @returns {{ ok: boolean, data?: Object, violations?: string[] }}
 */
function mergeReportV4(baseContract, aiOutput) {
  if (!baseContract || !baseContract.report) {
    return { ok: false, violations: ['baseContract.report is missing'] }
  }
  if (!aiOutput || typeof aiOutput !== 'object') {
    return { ok: false, violations: ['aiOutput is missing or not an object'] }
  }

  const result = deepClone(baseContract)
  const violations = []
  const report = result.report

  // ── 1. headline ──
  if (aiOutput.headline) {
    if (aiOutput.headline.title && isWritable('headline.title')) {
      report.headline.title = aiOutput.headline.title
    }
    if (aiOutput.headline.subtitle && isWritable('headline.subtitle')) {
      report.headline.subtitle = aiOutput.headline.subtitle
    }
    // emotion + severity 不可改 — 保持 base
  }

  // ── 2. fatalDiagnosis ──
  if (aiOutput.fatalDiagnosis && report.fatalDiagnosis) {
    if (aiOutput.fatalDiagnosis.mainProblem) {
      report.fatalDiagnosis.mainProblem = aiOutput.fatalDiagnosis.mainProblem
    }
    if (aiOutput.fatalDiagnosis.reason) {
      report.fatalDiagnosis.reason = aiOutput.fatalDiagnosis.reason
    }
    // severity, confidence, matchedRuleIds 不可改
  }

  // ── 3. fatalRules — 只覆盖 title/description/why, ruleId 必须匹配 ──
  if (aiOutput.fatalRules && Array.isArray(aiOutput.fatalRules)) {
    const baseFatalMap = new Map(report.fatalRules.map(r => [r.ruleId, r]))
    for (const aiRule of aiOutput.fatalRules) {
      if (!aiRule.ruleId) continue
      const baseRule = baseFatalMap.get(aiRule.ruleId)
      if (!baseRule) {
        violations.push(`AI fatal rule ${aiRule.ruleId} has no matching base rule`)
        continue
      }
      if (aiRule.title) baseRule.title = aiRule.title
      if (aiRule.description) baseRule.description = aiRule.description
      if (aiRule.why) baseRule.why = aiRule.why
      // weight 不可改
    }
    if (aiOutput.fatalRules.length > report.fatalRules.length) {
      violations.push('AI attempted to add new fatal rules')
    }
  }

  // ── 4. advantageRules ──
  if (aiOutput.advantageRules && Array.isArray(aiOutput.advantageRules)) {
    const baseAdvMap = new Map(report.advantageRules.map(r => [r.ruleId, r]))
    for (const aiRule of aiOutput.advantageRules) {
      if (!aiRule.ruleId) continue
      const baseRule = baseAdvMap.get(aiRule.ruleId)
      if (!baseRule) {
        violations.push(`AI advantage rule ${aiRule.ruleId} has no matching base rule`)
        continue
      }
      if (aiRule.title) baseRule.title = aiRule.title
      if (aiRule.description) baseRule.description = aiRule.description
      if (aiRule.why) baseRule.why = aiRule.why
    }
    if (aiOutput.advantageRules.length > report.advantageRules.length) {
      violations.push('AI attempted to add new advantage rules')
    }
  }

  // ── 5. opportunityRules — 匹配 area ──
  if (aiOutput.opportunityRules && Array.isArray(aiOutput.opportunityRules)) {
    const baseOppMap = new Map(report.opportunityRules.map(o => [o.area, o]))
    for (const aiOpp of aiOutput.opportunityRules) {
      if (!aiOpp.area) continue
      const baseOpp = baseOppMap.get(aiOpp.area)
      if (!baseOpp) {
        violations.push(`AI opportunity area "${aiOpp.area}" not in base opportunities`)
        continue
      }
      if (aiOpp.description) baseOpp.description = aiOpp.description
      if (aiOpp.why) baseOpp.why = aiOpp.why
    }
  }

  // ── 6. wealthPath — 只改 reason（v3.2 大小写容错 + 强校验） ──
  if (aiOutput.wealthPathReasons && report.wealthPath) {
    let reasonApplied = 0
    for (const path of report.wealthPath) {
      if (!path.name) {
        violations.push(`Base wealthPath entry has no name — this is a data integrity issue`)
        continue
      }
      const matchedReason = resolveWealthPathReason(report.wealthPath, aiOutput.wealthPathReasons, path.name)
      if (matchedReason && typeof matchedReason === 'string') {
        path.reason = matchedReason
        reasonApplied++
      }
      // recommend + score 不可改 — 保持 base
    }

    // v3.2: 如果 AI 返回了 wealthPathReasons 但没有一个匹配上，报 violation
    if (reasonApplied === 0 && Object.keys(aiOutput.wealthPathReasons).length > 0) {
      const aiKeys = Object.keys(aiOutput.wealthPathReasons).join(', ')
      const baseKeys = report.wealthPath.map(p => p.name).join(', ')
      violations.push(
        `WEALTH_PATH_KEY_MISMATCH: AI keys [${aiKeys}] none matched base keys [${baseKeys}]. ` +
        `Check case-sensitivity or naming. Expected keys: ${baseKeys}`
      )
    }
  }

  // ── 7. actionPlan ──
  if (aiOutput.actionPlan && report.actionPlan) {
    const days = ['day1', 'day3', 'day7', 'day15', 'day30']
    for (const day of days) {
      if (!aiOutput.actionPlan[day]) continue
      const aiDay = aiOutput.actionPlan[day]
      const baseDay = report.actionPlan[day]
      if (!baseDay) continue
      if (aiDay.goal) baseDay.goal = aiDay.goal
      if (Array.isArray(aiDay.tasks) && aiDay.tasks.length > 0) baseDay.tasks = aiDay.tasks
      if (aiDay.checkpoint) baseDay.checkpoint = aiDay.checkpoint
    }
  }

  // ── 8. stopDoing ──
  if (aiOutput.stopDoingItems) {
    if (Array.isArray(aiOutput.stopDoingItems) && aiOutput.stopDoingItems.length > 0) {
      report.stopDoing.items = aiOutput.stopDoingItems.filter(item => typeof item === 'string')
    }
  }

  // ── 9. identityUpgrade ──
  if (aiOutput.identityUpgrade && report.identityUpgrade) {
    const aiIu = aiOutput.identityUpgrade
    const baseIu = report.identityUpgrade
    if (aiIu.currentIdentity) baseIu.currentIdentity = aiIu.currentIdentity
    if (aiIu.targetIdentity) baseIu.targetIdentity = aiIu.targetIdentity
    if (aiIu.gap) baseIu.gap = aiIu.gap
    if (aiIu.upgradePath) baseIu.upgradePath = aiIu.upgradePath
  }

  // ── 10. finalStrike ──
  if (aiOutput.finalStrike && report.finalStrike) {
    if (aiOutput.finalStrike.sentence) report.finalStrike.sentence = aiOutput.finalStrike.sentence
    if (aiOutput.finalStrike.shareTitle) report.finalStrike.shareTitle = aiOutput.finalStrike.shareTitle
  }

  return {
    ok: violations.length === 0,
    data: result,
    violations: violations.length > 0 ? violations : undefined,
  }
}

// ═══════════════════════════════════════════════════════════════
// 导出 (v3.2 add: resolveWealthPathReason + buildPathNameMap)
// ═══════════════════════════════════════════════════════════════

module.exports = {
  mergeReportV4,
  isWritable,
  WRITABLE_PATHS,
  resolveWealthPathReason,
  buildPathNameMap,
}
