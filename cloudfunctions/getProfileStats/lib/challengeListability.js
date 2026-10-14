'use strict'
/**
 * challengeListability.js — RC8_13_P0_HISTORY_LIST_SERVER_AUTHORITY_FIX
 *
 * CANONICAL challenge listability predicate. Single source of truth.
 *
 * IDENTICAL shared artifact copied (byte-for-byte) into:
 *   - cloudfunctions/getProfileStats/lib/challengeListability.js
 *   - cloudfunctions/getChallengeRecords/lib/challengeListability.js
 *
 * A user-owned challenge_records row is LISTABLE iff it is a real challenge
 * instance the user can see and act on. Every owner row is listable; the list
 * normalises status into a small closed set so the client never renders a raw
 * enum and always knows whether a record is resumable (processing) or complete
 * (finished).
 *
 *   processing → 进行中 (resume: /pages/challenge-play?mode=challenge&recordId=)
 *   finished   → 已完成 (detail: /pages/challenge-result?recordId=)
 *   anything else → 未知 (visibility preserved, no guaranteed action)
 *
 * NOTE: profile challengeCount and getChallengeRecords.total MUST both equal the
 * count of owner rows so the two surfaces can never disagree. isListableChallenge
 * therefore accepts every owner row; the status mapping is presentation-only.
 */

const CHALLENGE_STATUS = { PROCESSING: 'processing', FINISHED: 'finished', UNKNOWN: 'unknown' }
const MAX_CHALLENGE_DAYS = 30

/** A raw challenge_records row is listable? (owner-scoped by the caller) */
function isListableChallenge (r) {
  return !!r
}

/** Normalise a raw status to the closed set. */
function statusKind (status) {
  if (status === CHALLENGE_STATUS.PROCESSING) return CHALLENGE_STATUS.PROCESSING
  if (status === CHALLENGE_STATUS.FINISHED) return CHALLENGE_STATUS.FINISHED
  return CHALLENGE_STATUS.UNKNOWN
}

/** Human label for a raw status. */
function statusLabel (status) {
  const k = statusKind(status)
  if (k === CHALLENGE_STATUS.PROCESSING) return '进行中'
  if (k === CHALLENGE_STATUS.FINISHED) return '已完成'
  return '未知'
}

/**
 * Display day for a record. The product is a 30-day challenge; the stored
 * currentDay for a COMPLETED challenge is 31 (submitChallengeChoice sets
 * currentDay = currentEventIndex + 1 on the final answer, then status=finished).
 * That is a storage/off-by-one artifact, NOT a 31-day entitlement. Never surface
 * a day > 30, and never show a day for a finished record.
 * @returns {number} 0 when no day should be shown
 */
function displayDay (currentDay, status) {
  if (statusKind(status) === CHALLENGE_STATUS.FINISHED) return 0
  const d = Number(currentDay) || 0
  if (d <= 0) return 0
  return Math.min(d, MAX_CHALLENGE_DAYS)
}

module.exports = {
  CHALLENGE_STATUS, MAX_CHALLENGE_DAYS,
  isListableChallenge, statusKind, statusLabel, displayDay,
}
