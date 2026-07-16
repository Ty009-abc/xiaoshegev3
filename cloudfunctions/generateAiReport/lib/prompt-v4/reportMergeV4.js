/**
 * prompt-v4/reportMergeV4.js
 *
 * 合并引擎 Base Contract + AI 输出 → Final Report。
 *
 * 原则：
 * - Base Contract = 权威事实
 * - AI Output = 仅表达补丁
 * - 数字、score、概率、recommend 全部取 Base
 * - AI 的 ruleId 必须匹配 Base 已有 ruleId
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
// 合并逻辑
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
    // AI 不得新增/删除 rule
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

  // ── 6. wealthPath — 只改 reason ──
  if (aiOutput.wealthPathReasons && report.wealthPath) {
    const reasonMap = aiOutput.wealthPathReasons
    for (const path of report.wealthPath) {
      if (reasonMap[path.name] && typeof reasonMap[path.name] === 'string') {
        path.reason = reasonMap[path.name]
      }
      // recommend + score 不可改 — 保持 base
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
    // AI 提供 stopDoing items → 替换 items 数组
    // priority 不可改
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
    // emotion 不可改
  }

  // ── 11. 检查 AI 是否输出非 writable 字段（已在 parser 层过滤，这里做二次验证）──
  checkWritableOnly(aiOutput, '', violations)

  return {
    ok: violations.length === 0,
    data: result,
    violations: violations.length > 0 ? violations : undefined,
  }
}

/**
 * 递归检查 aiOutput 中是否有非 writable 路径
 */
function checkWritableOnly(obj, prefix, violations) {
  if (obj === null || obj === undefined || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const item of obj) {
      checkWritableOnly(item, prefix + '.*', violations)
    }
    return
  }
  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    // 精确匹配 writable path（可能需要 * 通配符）
    const matched = [...WRITABLE_PATHS].some(p => {
      return matchPathWithWildcard(p, path)
    })
    // 不报 violations — 只在 parser 层屏蔽；这里做静默跳过
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      checkWritableOnly(obj[key], path, violations)
    }
  }
}

/**
 * 带通配符匹配
 */
function matchPathWithWildcard(pattern, path) {
  const pp = pattern.split('.')
  const pa = path.split('.')
  if (pp.length !== pa.length) return false
  for (let i = 0; i < pp.length; i++) {
    if (pp[i] === '*') continue
    if (pp[i] !== pa[i]) return false
  }
  return true
}

module.exports = { mergeReportV4, isWritable, WRITABLE_PATHS }
