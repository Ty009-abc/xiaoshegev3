/**
 * utils/membershipRights.js — canonical member-rights presenter (presentation only).
 *
 * Maps the server permission/entitlement CODES to user-facing Chinese labels so
 * that no raw code is ever shown in the UI. Raw codes are retained internally
 * (membership.permissions / accessAuthority) — this module only translates for
 * display and never decides access.
 *
 * Hard rules:
 *   - PRESENTATION ONLY. Never mutates storage / access authority.
 *   - Only rights actually granted (passed in) are returned.
 *   - Unknown code → generic Chinese fallback, NEVER the raw code.
 *
 * @version membership_rights_v1
 */

// permission code → user-facing label (canonical Chinese)
const MEMBER_RIGHT_LABELS = Object.freeze({
  full_report: '完整世界模型报告',
  report_history: '历史报告与复盘',
  vip_rules: '会员专属世界规则',
  challenge_full: '30天认知挑战',
  growth_review: '成长复盘',
  unlimited_ai: 'AI深度问答',
  // secondary codes
  advanced_reports: '进阶深度报告',
  hard_truth_mode: '硬核真相模式',
  priority_model: '优先模型响应',
  priority_ai: '优先AI处理',
  advanced_hooks: '进阶对话能力',
  // accessAuthority rights tokens (legacy alias)
  ai_member: 'AI深度问答',
  report_member: '完整世界模型报告',
  challenge_member: '30天认知挑战',
  memory_member: '长期记忆',
  scenario_member: '个性化场景',
})

// Canonical display ORDER (most meaningful first). Used to sort granted rights
// so the UI is stable and human-prioritised.
const MEMBER_RIGHT_ORDER = [
  'full_report', 'report_history', 'vip_rules',
  'challenge_full', 'growth_review', 'unlimited_ai',
  'advanced_reports', 'hard_truth_mode', 'priority_model',
]

const MEMBER_RIGHT_FALLBACK = '会员权益'

/**
 * Translate a raw permission/entitlement code to a Chinese label.
 * NEVER returns the raw code.
 */
function memberRightLabel (code) {
  if (typeof code !== 'string') return MEMBER_RIGHT_FALLBACK
  const key = code.trim()
  if (!key) return MEMBER_RIGHT_FALLBACK
  return MEMBER_RIGHT_LABELS[key] || MEMBER_RIGHT_FALLBACK
}

/**
 * Translate a list of granted codes → ordered, de-duplicated {code,label,raw}
 * objects. `raw` keeps the code internally; `label` is what the UI renders.
 * Unknown codes are dropped silently (never surface a raw code).
 */
function memberRightsView (codes) {
  const list = Array.isArray(codes) ? codes : []
  const seen = Object.create(null)
  const mapped = []
  for (const c of list) {
    if (typeof c !== 'string') continue
    const key = c.trim()
    if (!key || seen[key]) continue
    if (!MEMBER_RIGHT_LABELS[key]) continue // unknown → never show raw
    seen[key] = true
    mapped.push({ raw: key, label: MEMBER_RIGHT_LABELS[key] })
  }
  mapped.sort((a, b) => {
    const ia = MEMBER_RIGHT_ORDER.indexOf(a.raw)
    const ib = MEMBER_RIGHT_ORDER.indexOf(b.raw)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  return mapped
}

/**
 * Convenience: just the labels (ordered).
 */
function memberRightLabels (codes) {
  return memberRightsView(codes).map((r) => r.label)
}

/**
 * True if `code` is an internal code that must never be rendered raw.
 */
function isInternalRightCode (code) {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(MEMBER_RIGHT_LABELS, code.trim())
}

module.exports = {
  MEMBER_RIGHT_LABELS,
  MEMBER_RIGHT_ORDER,
  MEMBER_RIGHT_FALLBACK,
  memberRightLabel,
  memberRightsView,
  memberRightLabels,
  isInternalRightCode,
}
