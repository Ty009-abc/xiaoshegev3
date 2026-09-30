'use strict'
/**
 * common/quotaAuthority.js
 *
 * RC8_11_STAGE2 — server-authoritative free AI quota.
 *
 * SOURCE OF TRUTH: `quota_usage` collection, permission `basic_ai`.
 * DAY KEY: Asia/Shanghai (UTC+8), explicit — NOT server-local.
 *
 * RULES:
 *   - count only SUCCESSFULLY COMPLETED AI answers
 *   - failed model call consumes 0 (consume is called AFTER a successful turn)
 *   - blocked / validation failure consumes 0 (validator never blocks delivery)
 *   - membership bypasses free quota (unlimited / high)
 *   - free user allowed exactly `FREE_LIMIT` completed answers/day
 *   - 4th attempt returns allowed:false / reason=QUOTA_EXCEEDED
 *   - client counter is NEVER trusted
 *
 * RACE SAFETY:
 *   Every successful completion atomically reserves one slot via the DB
 *   `inc` primitive (expression update on the server) which is atomic even
 *   under concurrency, so at most `FREE_LIMIT` rows can pass per (openid, day).
 *
 * No network. `now` is injectable for deterministic tests.
 */

const crypto = require('crypto')

const FREE_LIMIT = 3
const PERMISSION = 'basic_ai'
const TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000 // Asia/Shanghai (no DST)

/** Deterministic, privacy-safe doc id (openid hashed; never stored in the id). */
function quotaDocId (openid, date) {
  const h = crypto.createHash('sha1').update(String(openid) + '|' + PERMISSION + '|' + date).digest('hex').slice(0, 24)
  return 'qu_' + h
}

/** Asia/Shanghai calendar day key `YYYY-MM-DD` for a given epoch-ms. */
function dayKey (ts) {
  const t = typeof ts === 'number' ? ts : Number(ts) || 0
  const d = new Date(t + TIMEZONE_OFFSET_MS)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * getQuotaStatus — read-only. Never mutates.
 * @returns {Promise<{isMember:boolean, limit:number, used:number, remaining:number, allowed:boolean, date:string}>}
 */
async function getQuotaStatus (db, openid, { isMember = false, now } = {}) {
  const date = dayKey(now != null ? now : Date.now())
  if (isMember) {
    return { isMember: true, limit: FREE_LIMIT, used: 0, remaining: Infinity, allowed: true, date }
  }
  if (!openid) {
    return { isMember: false, limit: FREE_LIMIT, used: 0, remaining: 0, allowed: false, date }
  }
  let used = 0
  try {
    const res = await db.collection('quota_usage').where({ openid, date, permission: PERMISSION }).limit(1).get()
    used = (res && res.data && res.data[0] && res.data[0].count) || 0
  } catch (_) {
    // Fail-closed: if usage cannot be read, treat as exhausted (do NOT grant).
    return { isMember: false, limit: FREE_LIMIT, used: FREE_LIMIT, remaining: 0, allowed: false, date, readError: true }
  }
  const remaining = Math.max(0, FREE_LIMIT - used)
  return { isMember: false, limit: FREE_LIMIT, used, remaining, allowed: remaining > 0, date }
}

/**
 * consumeQuota — called ONLY after a successfully completed AI answer.
 * Atomically reserves one slot. Never exceeds FREE_LIMIT.
 *
 * Race safety: ensure the (openid, day) row exists (idempotent deterministic
 * `_id`), then reserve with a single GUARDED atomic increment
 * `where({_id, count < FREE_LIMIT}).update({count: inc(1)})`. The guard + inc
 * execute atomically server-side, so under any concurrency at most FREE_LIMIT
 * reservations succeed.
 * @returns {Promise<{ok:boolean, remaining:number, used:number, exhausted:boolean, date:string}>}
 */
async function consumeQuota (db, openid, { isMember = false, now } = {}) {
  const ts = now != null ? now : Date.now()
  const date = dayKey(ts)
  if (isMember) {
    return { ok: true, remaining: Infinity, used: 0, exhausted: false, date, isMember: true }
  }
  if (!openid) return { ok: false, remaining: 0, used: 0, exhausted: true, date }

  const id = quotaDocId(openid, date)
  const col = db.collection('quota_usage')

  // Ensure the row exists (count 0). Concurrent creators: exactly one wins.
  try {
    await col.add({ data: { _id: id, openid, date, permission: PERMISSION, count: 0, createdAt: ts, updatedAt: ts } })
  } catch (_) { /* already exists */ }

  const inc = (db.command && db.command.inc) ? db.command.inc(1) : 1
  const lt = (db.command && db.command.lt) ? db.command.lt(FREE_LIMIT) : FREE_LIMIT
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await col.where({ _id: id, count: lt }).update({ data: { count: inc, updatedAt: ts } })
      const updated = (res && res.stats && res.stats.updated) || 0
      if (updated === 1) {
        const status = await getQuotaStatus(db, openid, { isMember: false, now: ts })
        return { ok: true, remaining: status.remaining, used: status.used, exhausted: status.remaining <= 0, date }
      }
      // Guarded update matched nothing → count already at/over limit.
      break
    } catch (_) {
      // Retry the whole reservation once (e.g. create/inc race).
    }
  }
  const status = await getQuotaStatus(db, openid, { isMember: false, now: ts })
  return { ok: false, remaining: 0, used: status.used, exhausted: status.remaining <= 0, date }
}

module.exports = { FREE_LIMIT, PERMISSION, dayKey, quotaDocId, getQuotaStatus, consumeQuota }
