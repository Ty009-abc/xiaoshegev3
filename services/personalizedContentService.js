/**
 * 珠澳小事哥 · 认知操作系统
 * services/personalizedContentService.js — RC8.4 V6 R78.2
 *
 * ONE client-side wrapper for the `getPersonalizedContent` cloud function.
 * Pages MUST NOT scatter raw wx.cloud.callFunction calls — they use this.
 *
 *   getFeed()          → single feed { worldRule, dailyInsight, strike }
 *   markSeen(kind,id)  → fire-and-forget view accounting (learningHistory)
 *
 * FAILURE-ISOLATED by contract:
 *   - getFeed() NEVER rejects — returns `null` on any failure so callers fall
 *     back to legacy behavior (getTodayStrike / getDailyInsight / getWorldRules).
 *   - markSeen() NEVER rejects and NEVER throws — an error here must not block
 *     navigation or rendering.
 *
 * The three pickX() helpers are PURE view-mappers (feed JSON → page data) so the
 * wiring logic stays unit-testable and identical across pages.
 */

function call(name, data) {
  return wx.cloud.callFunction({ name: name, data: data }).then(function (r) { return r && r.result })
}

/**
 * Fetch the personalization feed.
 * @returns {Promise<Object|null>} feed data, or null on ANY failure.
 */
function getFeed() {
  try {
    return call('getPersonalizedContent', { action: 'feed' })
      .then(function (res) {
        if (res && res.code === 0 && res.data) return res.data
        return null
      })
      .catch(function () { return null })
  } catch (_) {
    return Promise.resolve(null)
  }
}

/**
 * Mark a content item as SEEN (user explicitly opened it).
 * Fire-and-forget: never throws, never blocks navigation/rendering.
 * @param {'rule'|'insight'|'strike'} kind
 * @param {string} id  canonical content id (WR00x / DI00x / STRIKE_0xx)
 * @returns {Promise<Object|null>}
 */
function markSeen(kind, id) {
  if (!kind || !id) return Promise.resolve(null)
  try {
    return call('getPersonalizedContent', { action: 'view', kind: kind, id: id })
      .then(function (res) { return res || null })
      .catch(function () { return null })
  } catch (_) {
    return Promise.resolve(null)
  }
}

// ── §5 PURE VIEW MAPPERS ────────────────────────────────────────────
// Each returns null when the corresponding surface is NOT genuinely
// personalized, so the caller keeps its existing legacy behavior.
//
// §16/§17: a LEGACY profile (legacy 9 dims only) or EMPTY profile (no
// cognitive profile) must keep the 100% legacy experience for DAILY and
// STRIKE — so those surfaces stay on the legacy path unless the engine
// returns a genuinely personalized (non-legacy) item.
//
// §12/§16: the WORLD-RULE pin may still surface for a legacy profile when the
// engine derives a rule from the legacy dimensions, but it must NOT carry the
// personalization label in that case.

/** Home cognition-strike: feed.strike ONLY when personalized + non-legacy. */
function pickStrike(feed) {
  if (!feed || !feed.strike || feed.strike.personalized !== true || feed.isLegacy === true) return null
  const c = feed.strike.content
  if (!c || !c.core_strike) return null
  const s = Object.assign({}, c, { id: feed.strike.contentId || c.id || '' })
  return { strike: s, id: s.id, label: feed.strike.label || '' }
}

/** Daily cognition: feed.dailyInsight ONLY when personalized + non-legacy. */
function pickDaily(feed) {
  if (!feed || !feed.dailyInsight || feed.dailyInsight.personalized !== true || feed.isLegacy === true) return null
  const c = feed.dailyInsight.content
  if (!c) return null
  return {
    insight: c,
    id: feed.dailyInsight.insightId || c.insightId || '',
    label: feed.dailyInsight.label || '根据你最近的认知诊断推荐',
    personalized: true,
    fallback: false,
  }
}

/** World-rule pinned recommendation: feed.worldRule when personalized + usable. */
function pickWorldRule(feed) {
  if (!feed || !feed.worldRule || feed.worldRule.personalized !== true) return null
  const c = feed.worldRule.content
  if (!c || (!c.ruleId && !feed.worldRule.ruleId)) return null
  // §16 — legacy-driven rule: keep the pin but suppress the label.
  const label = feed.isLegacy === true ? '' : (feed.worldRule.label || '根据你最近的认知诊断推荐')
  return { ruleId: feed.worldRule.ruleId || c.ruleId, content: c, label: label }
}

module.exports = {
  getFeed: getFeed,
  markSeen: markSeen,
  pickStrike: pickStrike,
  pickDaily: pickDaily,
  pickWorldRule: pickWorldRule,
}
