'use strict'
/**
 * lib/cognitiveProfile/personalization/learningHistoryV6.js
 *
 * RC8.4 V6 R78 §15–§17 — MERGE-SAFE LEARNING HISTORY WRITEBACK.
 *
 * Marks an item as SEEN only when it is ACTUALLY opened/viewed (§15), not merely
 * because it was ranked. Views write into the canonical profile's
 * learningHistory:
 *   world rule viewed  → seenRuleIds
 *   insight viewed     → seenInsightIds
 *   strike viewed      → seenStrikeIds
 *
 * §16 UNION only — never resets. §17 seen ≠ saved/collected: the existing
 * client-side saved/collected list stays a SEPARATE concern; this module only
 * records "seen".
 *
 * FAILURE-ISOLATED: never throws; a write failure degrades to a no-op result.
 * No AI. Single I/O: the merge-safe user_profiles update.
 */

const { PROVENANCE, CONFIDENCE } = require('../profileSchemaV1.js')

const SEEN_KINDS = Object.freeze({
  RULE: 'rule',
  INSIGHT: 'insight',
  STRIKE: 'strike'
})

const FIELD_BY_KIND = Object.freeze({
  rule: 'seenRuleIds',
  insight: 'seenInsightIds',
  strike: 'seenStrikeIds'
})

function union (a, b) {
  const set = new Set()
  for (const x of (Array.isArray(a) ? a : [])) if (x) set.add(x)
  for (const x of (Array.isArray(b) ? b : [])) if (x) set.add(x)
  return Array.from(set)
}

/**
 * Pure builder: merge ONE seen id into a copy of an existing learningHistory.
 * @returns {Object} new learningHistory (never mutates the input)
 */
function mergeSeen (existingHistory, kind, id, ts) {
  const field = FIELD_BY_KIND[kind]
  if (!field || !id) return existingHistory || null
  const prev = existingHistory || {}
  return {
    seenRuleIds: union(prev.seenRuleIds, kind === 'rule' ? [id] : []),
    seenInsightIds: union(prev.seenInsightIds, kind === 'insight' ? [id] : []),
    seenStrikeIds: union(prev.seenStrikeIds, kind === 'strike' ? [id] : []),
    provenance: PROVENANCE.OBSERVED,
    confidence: CONFIDENCE.HIGH,
    source: 'learning_history_view',
    updatedAt: (ts != null ? ts : Date.now())
  }
}

/**
 * Merge-safe DB writeback of a single "seen" event. Never throws.
 * @returns {Promise<{ok, wrote, reason, idempotent}>}
 */
async function markSeen (db, openid, kind, id, ts) {
  const result = { ok: false, wrote: false, reason: 'UNKNOWN', idempotent: false }
  try {
    if (!db || !openid) { result.reason = 'NO_DB_OR_OPENID'; return result }
    const field = FIELD_BY_KIND[kind]
    if (!field || !id) { result.reason = 'BAD_ARGS'; return result }

    const col = db.collection('user_profiles')
    const res = await col.where({ openid }).limit(1).get()
    const existing = (res.data && res.data[0]) || null
    if (!existing) { result.reason = 'NO_PROFILE_DOC'; return result }

    const prev = existing.learningHistory || {}
    const prevList = Array.isArray(prev[field]) ? prev[field] : []
    if (prevList.indexOf(id) !== -1) {
      result.ok = true
      result.idempotent = true
      result.reason = 'ALREADY_SEEN'
      return result
    }

    const nextHistory = mergeSeen(prev, kind, id, ts)
    await col.doc(existing._id).update({ data: { learningHistory: nextHistory, updatedAt: (ts != null ? ts : Date.now()) } })
    result.ok = true
    result.wrote = true
    result.reason = 'WROTE'
    return result
  } catch (e) {
    result.ok = false
    result.wrote = false
    result.reason = 'WRITE_FAIL'
    try {
      // §27 privacy: presence + reason only — no openid, no profile dump.
      console.error('[V6Profile] mark_seen_fail openid_present=' + (openid ? 'true' : 'false') + ' kind=' + kind + ' reason=' + result.reason)
    } catch (_) {}
    return result
  }
}

module.exports = {
  SEEN_KINDS,
  FIELD_BY_KIND,
  mergeSeen,
  markSeen
}
