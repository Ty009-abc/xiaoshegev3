/**
 * utils/worldModelTags.js
 *
 * PAYMENT_STAGE5A_R9_UI_PRODUCTIZATION — canonical CORE-TRAIT presenter.
 *
 * The challenge engine records `tags` as a raw, order-of-answer accumulation
 * (cloudfunctions/submitChallengeChoice/index.js merges each chosen option's
 * `choice.tags`). Across the full 30-question pool the raw set can contain
 * well over a hundred distinct strings — dumping all of them onto the result
 * page is a debug artifact, not a product experience.
 *
 * This module is the SINGLE source of truth for:
 *   1. de-duplicating + sanitising the raw tag list, and
 *   2. selecting & ordering the highest-value traits for display, and
 *   3. capping the display at MAX_CORE_TAGS.
 *
 * Hard rules:
 *   - PRESENTATION ONLY. Never mutates storage/engine values.
 *   - No AI call, no network, no DB. Pure function.
 *   - Deterministic: same input → same output.
 *   - NEVER returns more than MAX_CORE_TAGS entries.
 *
 * @version world_model_tags_v1
 */

// Maximum core traits rendered on the challenge-result page.
const MAX_CORE_TAGS = 8

/**
 * Curated PRIORITY ordering of the highest-value / highest-signal traits from
 * the live challenge tag pool. A trait's display rank = its index here.
 * Traits not listed keep their original relative order and rank AFTER all
 * priority traits (stable), so the cap still prefers high-value signal.
 */
const CORE_TAG_PRIORITY = Object.freeze([
  // ── leverage / system / compounding (highest signal) ──
  '杠杆升级', '开源杠杆', '合作杠杆', '自动化思维', '系统思维', '系统化', '系统优先',
  '系统重构', '能力复制', '能力迁移', '能力护城河', '价值链升级',
  // ── opportunity / information ──
  '机会捕捉', '信息优先', '信息获取', '信息验证', '数据驱动', '资源整合', '政策利用',
  '合法套利', '法律杠杆', '市场定位', '差异化战略',
  // ── long-term / asset building ──
  '长期主义', '长期资产', '长期价值', '长期信息资产', '资产配置', '现金流+资产',
  '延迟满足', '产品化思维', '产品转型', '风险可控', '稳健策略', '稳健防御', '稳健保守',
  // ── cognition / decision quality ──
  '认知觉醒', '认知更新', '认知免疫', '主动升级', '主动设计', '策略转向', '模式升级',
  '实验思维', '实验主义', '理性试错', '低成本试错', '低成本测试', '数据驱动',
  '决策前置', '风险识别', '止损意识', '仓位管理', '风险管理', '风险底线', '风险隔离',
  '价值交换', '价值意识', '谈判杠杆', '合作杠杆', '网络建设', '精益主义', '品质壁垒',
])

const _RANK = (() => {
  const m = Object.create(null)
  CORE_TAG_PRIORITY.forEach((t, i) => { if (!(t in m)) m[t] = i })
  return m
})()

/**
 * Normalise an arbitrary raw tags value into a clean, de-duplicated string array.
 * Accepts arrays of strings (ignores non-strings / empty / whitespace-only).
 * @param {*} raw
 * @returns {string[]}
 */
function normalizeTags (raw) {
  if (!Array.isArray(raw)) return []
  const seen = Object.create(null)
  const out = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const t = item.trim()
    if (!t) continue
    if (seen[t]) continue
    seen[t] = true
    out.push(t)
  }
  return out
}

/**
 * Select the highest-value core traits for display.
 *
 * @param {*} raw               raw `record.tags` value
 * @param {number} [max]        display cap (defaults to MAX_CORE_TAGS)
 * @returns {{ coreTraits: string[], total: number, hiddenCount: number }}
 */
function resolveCoreTraits (raw, max) {
  const limit = (typeof max === 'number' && max > 0) ? max : MAX_CORE_TAGS
  const tags = normalizeTags(raw)
  // Stable sort: priority-listed first (by rank), everything else next in
  // original order. Array.prototype.sort is stable in modern engines, so keys
  // that tie keep their input order.
  const ordered = tags
    .map((t, i) => ({ t, i, rank: (t in _RANK) ? _RANK[t] : Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => (a.rank - b.rank) || (a.i - b.i))
    .map((x) => x.t)
  const coreTraits = ordered.slice(0, limit)
  return {
    coreTraits,
    total: tags.length,
    hiddenCount: Math.max(0, tags.length - coreTraits.length),
  }
}

module.exports = {
  MAX_CORE_TAGS,
  CORE_TAG_PRIORITY,
  normalizeTags,
  resolveCoreTraits,
}
