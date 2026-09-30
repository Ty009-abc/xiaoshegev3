'use strict'
/**
 * lib/raw6qStore.js — RC8_10B STAGE_D1
 *
 * Persist + load the user's RAW 6Q answers (age / job / education / income /
 * anxiety / rootCause) as the L0 AUTHORITY — WITHOUT deriving facts from the
 * generated report.
 *
 * Stored in a DEDICATED input collection `user_6q_raw` (the RAW INPUT store —
 * NOT a competing profile authority, and NOT mixed into `ai_reports` so the
 * server-authoritative reportCount is never inflated). Bound to the
 * authenticated openid (caller passes cloud.getWXContext().OPENID — never a
 * client value). Idempotent by requestId. Stores completedAt / version / source.
 *
 * @version rc8_10b_raw6q_v1
 */

const RAW_COLLECTION = 'user_6q_raw'
const RAW_TYPE = 'raw_6q'
const RAW_VERSION = 'turnaround_strategy_6q_v1'
const RAW_SOURCE = 'RAW_6Q'
const RAW_STATUS = 'completed'
const RAW_FIELDS = ['age', 'job', 'education', 'income', 'anxiety', 'rootCause']
// Canonical snapshot schema: ONE document per completed submission with the six
// answers stored FLAT at the top level (no per-question docs, no nested bags).
const SCHEMA_VERSION = 2

function s (v) { return (v === undefined || v === null) ? '' : String(v).trim() }

/** Normalize + validate the raw answers. Numeric fields validated; text kept verbatim. */
function normalizeRaw6Q (answers) {
  const a = answers || {}
  const facts = {}
  const errors = []
  for (const k of RAW_FIELDS) {
    const v = s(a[k])
    if (!v) { errors.push('MISSING:' + k); continue }
    if ((k === 'age' || k === 'income') && !/^\d+$/.test(v)) { errors.push('NOT_NUMERIC:' + k); continue }
    facts[k] = v
  }
  return { valid: errors.length === 0, facts: errors.length ? null : facts, errors }
}

/**
 * Persist ONE raw 6Q entity (idempotent by requestId + openid).
 * @returns {Promise<{ok:boolean, rawId?:string, reason?:string}>}
 */
async function persistRaw6Q (db, { openid, requestId, answers, ts }) {
  if (!openid) return { ok: false, reason: 'NO_OPENID' }
  const norm = normalizeRaw6Q(answers)
  if (!norm.valid) return { ok: false, reason: 'INVALID:' + norm.errors.join(',') }

  try {
    if (requestId) {
      const dup = await db.collection(RAW_COLLECTION)
        .where({ openid, requestId }).limit(1).get()
      if (dup.data && dup.data[0]) return { ok: true, rawId: dup.data[0].rawId || dup.data[0]._id }
    }
    const rawId = 'raw6q_' + (requestId || String(ts))
    // ONE immutable versioned snapshot per completed submission — the six
    // answers are the atomic set (never split/merged across versions).
    await db.collection(RAW_COLLECTION).add({
      data: {
        // ── canonical snapshot fields (flat) ──
        openid,
        sixQRecordId: rawId,
        sixQVersion: RAW_VERSION,
        status: RAW_STATUS,
        age: norm.facts.age,
        job: norm.facts.job,
        education: norm.facts.education,
        income: norm.facts.income,
        anxiety: norm.facts.anxiety,
        rootCause: norm.facts.rootCause,
        completedAt: ts,
        createdAt: ts,
        source: RAW_SOURCE,
        schemaVersion: SCHEMA_VERSION,
        // ── transport/idempotency metadata ──
        rawId,
        requestId: requestId || '',
        diagnosticVersion: RAW_VERSION,
        updatedAt: ts,
      },
    })
    return { ok: true, rawId }
  } catch (e) {
    return { ok: false, reason: 'DB_ERROR:' + ((e && e.message) || String(e)) }
  }
}

/**
 * LATEST_COMPLETED_SET_ONLY (RAW_6Q_LATEST_SET_ONLY):
 *   WHERE openid = current_authenticated_openid AND status = 'completed'
 *   ORDER BY completedAt desc, createdAt desc
 *   LIMIT 1
 * Returns the single active set — old sets are NEVER merged/filled/used for
 * current reasoning. A set is one indivisible version (no cross-version mixing).
 * @returns {Promise<object|null>}
 */
async function loadActiveRaw6Q (db, openid) {
  if (!openid) return null
  try {
    const r = await db.collection(RAW_COLLECTION)
      .where({ openid, status: RAW_STATUS })
      .get()
    let docs = (r.data || [])
    if (!docs.length) return null
    // PRIMARY completedAt DESC, SECONDARY createdAt DESC, TERTIARY sixQVersion DESC.
    if (docs.length > 1) {
      docs = docs.slice().sort((a, b) =>
        ((b.completedAt || 0) - (a.completedAt || 0)) ||
        ((b.createdAt || 0) - (a.createdAt || 0)) ||
        String(b.sixQVersion || '').localeCompare(String(a.sixQVersion || '')))
    }
    return docs[0] || null
  } catch (_) { return null }
}

module.exports = {
  RAW_COLLECTION, RAW_TYPE, RAW_VERSION, RAW_SOURCE, RAW_STATUS, RAW_FIELDS, SCHEMA_VERSION,
  normalizeRaw6Q, persistRaw6Q, loadActiveRaw6Q, loadLatestRaw6Q: loadActiveRaw6Q,
}
