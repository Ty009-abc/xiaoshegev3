/**
 * utils/cognitionEntry.js — RC8.8_RESULT_FOOTER_DAILY_COGNITION_ROUTE_P0
 *
 * ONE shared navigation authority for the cognition entries, so the result-page
 * footer and the home page can NEVER drift apart again.
 *
 * Authority (source of truth = the CURRENT home page strike card, pages/home):
 *   今日认知暴击 → /subpkg-ai/cognitive-shock-detail/cognitive-shock-detail
 *                    ?sid=<personalizedId>   (feed genuinely personalized)
 *                    ?id=<today's date-anchored id>   (otherwise)
 *   世界规则     → /pages/world-rules/world-rules
 *   直接问小事哥 → switchTab /pages/ai-chat/ai-chat
 *
 * The OLD /pages/cognition-daily/cognition-daily is DEMOTED to a resilient
 * fallback for the strike entry only (used if the detail route fails to open),
 * so a primary tap can never dead-end — but it is no longer the primary entry.
 *
 * Pure routing: no UI, no copy, no backend changes.
 */

const { getTodayStrike } = require('./cognitionStrike.js')
const personalizedContent = require('../services/personalizedContentService.js')

const STRIKE_ROUTE = '/subpkg-ai/cognitive-shock-detail/cognitive-shock-detail'
const DAILY_LEGACY_ROUTE = '/pages/cognition-daily/cognition-daily'
const WORLD_RULES_ROUTE = '/pages/world-rules/world-rules'
const AI_CHAT_ROUTE = '/pages/ai-chat/ai-chat'

// ── lightweight double-tap guard (per target url) ──────────────────────────
const _navLock = {}
function _locked(url) {
  const now = Date.now()
  if (_navLock[url] && now - _navLock[url] < 600) return true
  _navLock[url] = now
  return false
}

/**
 * Canonical strike url — byte-identical to the home page authority.
 * @param {string} personalizedId canonical pool id ('' when not personalized)
 * @returns {string} navigateTo url
 */
function computeStrikeUrl(personalizedId) {
  const sid = personalizedId || ''
  const dateId = (getTodayStrike() || {}).id || ''
  return sid ? `${STRIKE_ROUTE}?sid=${sid}` : `${STRIKE_ROUTE}?id=${dateId}`
}

function _strikeIdOf(vm) {
  try { return (vm && vm.data && vm.data._strikeId) || '' } catch (_) { return '' }
}

/**
 * 今日认知暴击 — the ONE strike entry used by BOTH home and the result page.
 * @param {object} vm page instance (to read `_strikeId` personalization)
 */
function openCognitionStrike(vm) {
  const personalizedId = _strikeIdOf(vm)
  const url = computeStrikeUrl(personalizedId)
  if (_locked(url)) return
  wx.navigateTo({
    url,
    fail: (err) => {
      console.warn('[cognitionEntry] strike detail failed, falling back to legacy daily:', url, err)
      if (url !== DAILY_LEGACY_ROUTE && !_locked(DAILY_LEGACY_ROUTE)) {
        wx.navigateTo({ url: DAILY_LEGACY_ROUTE })
      }
    },
  })
  // R78.2 §7/§14 — SEEN = explicit open. Fire-and-forget; NEVER blocks nav.
  if (personalizedId) {
    try { personalizedContent.markSeen('strike', personalizedId) } catch (_) {}
  }
}

/**
 * 每日认知 (result-page label) — SAME destination as 今日认知暴击.
 * Kept as a distinctly-named export so the result footer reads intention, but
 * it delegates to the identical authority.
 */
function openDailyCognition(vm) {
  openCognitionStrike(vm)
}

/** 世界规则 — same route as the home page card. */
function openWorldRules() {
  wx.navigateTo({ url: WORLD_RULES_ROUTE })
}

/** 直接问小事哥 — ai-chat is a tabBar page, must use switchTab. */
function openAskXiaoshige() {
  wx.switchTab({
    url: AI_CHAT_ROUTE,
    fail: (err) => {
      console.warn('[cognitionEntry] switchTab failed:', err)
      wx.navigateTo({ url: AI_CHAT_ROUTE })
    },
  })
}

/**
 * Non-blocking: resolve the personalized strike id for a page instance,
 * mirroring the home page's feed-driven `_strikeId`. Never throws; on any
 * failure the page simply keeps the date-anchored strike.
 * @param {object} vm page instance
 * @returns {Promise<string>} resolved canonical id ('' when not personalized)
 */
function primeStrikeContext(vm) {
  if (!vm || typeof vm.setData !== 'function') return Promise.resolve('')
  return personalizedContent.getFeed()
    .then(function (feed) {
      const picked = personalizedContent.pickStrike(feed)
      const id = (picked && picked.id) || ''
      if (id) { try { vm.setData({ _strikeId: id }) } catch (_) {} }
      return id
    })
    .catch(function () { return '' })
}

module.exports = {
  STRIKE_ROUTE,
  DAILY_LEGACY_ROUTE,
  WORLD_RULES_ROUTE,
  AI_CHAT_ROUTE,
  computeStrikeUrl,
  primeStrikeContext,
  openCognitionStrike,
  openDailyCognition,
  openWorldRules,
  openAskXiaoshige,
}
