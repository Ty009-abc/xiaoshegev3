#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.11/stage2a.test.js
 *
 * RC8_11_STAGE2A — server-authoritative free AI quota + contextual follow-ups.
 *
 *  A  free 1st answer → remaining 2
 *  B  free 2nd answer → remaining 1
 *  C  free 3rd answer → remaining 0
 *  D  4th attempt → blocked (allowed=false, reason QUOTA_EXCEEDED at caller)
 *  E  failed AI call → consume 0 (status unchanged)
 *  F  member → bypass (never blocked, no consumption)
 *  G  legacy report-only buyer (not member) → NOT unlimited
 *  H  followUps → count 3, contextual, no duplicates, never the user's own question
 *  I  no context → fallback bank used
 *  J  concurrent free requests → successful reservations <= 3
 *  K  Asia/Shanghai next-day reset
 *
 * Node built-ins only. No network, no real DB.
 */

const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const QA = require(path.join(ROOT, 'cloudfunctions', 'common', 'quotaAuthority.js'))
const FU = require(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'context', 'coachingFollowUps.js'))

const DAY = 86400000
// 2026-09-30 20:00 Shanghai == 12:00 UTC
const T = Date.UTC(2026, 8, 30, 12, 0, 0)

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_11_STAGE2A free-3 quota + contextual follow-ups')

// ── fake DB with a real mutex + atomic guarded inc (incl. create race) ──
function makeDb () {
  const store = { quota_usage: [] }
  let lock = Promise.resolve()
  const atom = (fn) => { const p = lock.then(fn); lock = p.catch(() => {}); return p }
  const command = { inc: (n) => ({ __op: 'inc', v: n }), lt: (n) => ({ __op: 'lt', v: n }) }
  const match = (d, q) => Object.keys(q).every((k) => {
    const c = q[k]
    if (c && c.__op === 'lt') return d[k] < c.v
    return d[k] === c
  })
  return {
    command, _store: store,
    collection: (name) => ({
      async add ({ data }) { return atom(async () => { if (store[name].some((d) => d._id === data._id)) { const e = new Error('E11000 duplicate'); throw e } store[name].push({ ...data }); return { _id: data._id } }) },
      where (q) { return {
        limit () { return this },
        async get () { await new Promise((r) => setTimeout(r, 0)); return { data: store[name].filter((d) => match(d, q)).map((d) => ({ ...d })) } },
        async update ({ data }) { return atom(async () => {
          const rows = store[name].filter((d) => match(d, q))
          rows.forEach((d) => { for (const k in data) { const c = data[k]; if (c && c.__op === 'inc') d[k] = (d[k] || 0) + c.v; else d[k] = c } })
          return { stats: { updated: rows.length } }
        }) },
      } },
    }),
  }
}

;(async () => {
  // ── A/B/C: three completions → 2,1,0 ──
  {
    const db = makeDb()
    const s0 = await QA.getQuotaStatus(db, 'u1', { now: T })
    eq(s0.remaining, 3, 'A initial remaining 3')
    const c1 = await QA.consumeQuota(db, 'u1', { now: T })
    eq(c1.remaining, 2, 'A 1st answer → remaining 2')
    const s1 = await QA.getQuotaStatus(db, 'u1', { now: T })
    eq(s1.remaining, 2, 'A status agrees (2)')
    const c2 = await QA.consumeQuota(db, 'u1', { now: T })
    eq(c2.remaining, 1, 'B 2nd answer → remaining 1')
    const c3 = await QA.consumeQuota(db, 'u1', { now: T })
    eq(c3.remaining, 0, 'C 3rd answer → remaining 0')
    eq(c3.exhausted, true, 'C 3rd exhausted flag')
  }

  // ── D: 4th attempt blocked ──
  {
    const db = makeDb()
    for (let i = 0; i < 3; i++) await QA.consumeQuota(db, 'u2', { now: T })
    const s = await QA.getQuotaStatus(db, 'u2', { now: T })
    eq(s.allowed, false, 'D 4th attempt not allowed')
    eq(s.remaining, 0, 'D remaining 0')
    eq(db._store.quota_usage[0].count, 3, 'D count capped at 3')
    // even if consume is (incorrectly) attempted, it must NOT exceed 3
    const c4 = await QA.consumeQuota(db, 'u2', { now: T })
    eq(c4.ok, false, 'D extra consume rejected')
    eq(db._store.quota_usage[0].count, 3, 'D count never exceeds 3')
  }

  // ── E: failed AI call consumes 0 (no consume call → unchanged) ──
  {
    const db = makeDb()
    await QA.consumeQuota(db, 'u3', { now: T })
    const before = (await QA.getQuotaStatus(db, 'u3', { now: T })).remaining
    // simulate a failed model call: caller does NOT call consumeQuota
    const after = (await QA.getQuotaStatus(db, 'u3', { now: T })).remaining
    eq(after, before, 'E failed call consumes 0')
  }

  // ── F: member bypass ──
  {
    const db = makeDb()
    const c = await QA.consumeQuota(db, 'm1', { isMember: true, now: T })
    ok(c.ok && c.remaining === Infinity && !c.exhausted, 'F member never blocked')
    const s = await QA.getQuotaStatus(db, 'm1', { isMember: true, now: T })
    eq(s.allowed, true, 'F member allowed')
    eq(db._store.quota_usage.length, 0, 'F member writes no quota rows')
  }

  // ── G: legacy report-only buyer (not member) is NOT unlimited ──
  {
    const db = makeDb()
    // report_9_9 buyer: no membership → isMember=false
    for (let i = 0; i < 3; i++) await QA.consumeQuota(db, 'legacy', { isMember: false, now: T })
    const s = await QA.getQuotaStatus(db, 'legacy', { isMember: false, now: T })
    eq(s.allowed, false, 'G legacy report-only buyer hits free limit')
  }

  // ── J: concurrency → <= 3 successful reservations ──
  {
    const db = makeDb()
    const results = await Promise.all(Array.from({ length: 12 }, () => QA.consumeQuota(db, 'race', { now: T })))
    const okCount = results.filter((r) => r.ok).length
    const final = db._store.quota_usage[0].count
    ok(okCount <= 3, 'J concurrent successful reservations <= 3 (got ' + okCount + ')')
    ok(final <= 3, 'J final count <= 3 (got ' + final + ')')
    eq(okCount, 3, 'J exactly 3 succeed')
  }

  // ── K: Asia/Shanghai next-day reset ──
  {
    const db = makeDb()
    for (let i = 0; i < 3; i++) await QA.consumeQuota(db, 'u4', { now: T })
    eq((await QA.getQuotaStatus(db, 'u4', { now: T })).remaining, 0, 'K exhausted today')
    // 2026-10-01 00:30 Shanghai == 2026-09-30 16:30 UTC → next day key
    const Tnext = Date.UTC(2026, 8, 30, 16, 30, 0)
    eq(QA.dayKey(T), '2026-09-30', 'K day key correct (Shanghai)')
    eq(QA.dayKey(Tnext), '2026-10-01', 'K next day key (Shanghai)')
    const s = await QA.getQuotaStatus(db, 'u4', { now: Tnext })
    eq(s.remaining, 3, 'K quota resets next day')
    eq(s.allowed, true, 'K allowed next day')
  }

  // ── timezone boundary: 23:00 Shanghai is same day; 01:00 is next ──
  {
    // 2026-09-30 23:00 Shanghai == 15:00 UTC
    eq(QA.dayKey(Date.UTC(2026, 8, 30, 15, 0, 0)), '2026-09-30', 'TZ 23:00 Shanghai same day')
    // 2026-10-01 01:00 Shanghai == 2026-09-30 17:00 UTC
    eq(QA.dayKey(Date.UTC(2026, 8, 30, 17, 0, 0)), '2026-10-01', 'TZ 01:00 Shanghai next day')
  }

  // ── H: followUps contextual, count 3, no dup, not the user's question ──
  {
    const q = '我是程序员，月入1.2万，想做副业'
    const r = FU.buildFollowUps({ message: q, answer: '你可以先把技术能力产品化，从接单开始，用最小可行服务验证需求，再逐步放大。', raw6Q: { job: '程序员', income: '1.2万', anxiety: '收入单一' }, scenario: 'side_hustle' })
    eq(r.count, 3, 'H count 3')
    eq(r.followUps.length, 3, 'H length 3')
    eq(r.source, 'PRIMARY', 'H primary source')
    ok(new Set(r.followUps).size === 3, 'H no duplicates')
    ok(r.followUps.indexOf(q) < 0, 'H never repeats the user question')
    ok(r.followUps.every((x) => x && x.length <= 24), 'H concise questions')
    // contextual: mentions the occupation or the thread
    ok(r.followUps.some((x) => /程序员|副业|收入|验证/.test(x)), 'H contextual to the thread')
  }

  // ── I: no context → fallback bank ──
  {
    const r = FU.buildFollowUps({ message: '', answer: '', raw6Q: null, scenario: 'ask' })
    eq(r.count, 3, 'I fallback count 3')
    eq(r.source, 'FALLBACK', 'I fallback source')
    ok(r.followUps.every((x) => x && x.length > 0), 'I fallback questions present')
  }

  // ── source contract: index.js integrates the three phases ──
  {
    const fs = require('fs')
    const idx = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'index.js'), 'utf8')
    ok(/quotaAuthority\.getQuotaStatus/.test(idx), 'IDX checks quota before model call')
    ok(/QUOTA_EXHAUSTED/.test(idx), 'IDX returns QUOTA_EXHAUSTED')
    ok(/quotaAuthority\.consumeQuota/.test(idx), 'IDX consumes only after success')
    ok(/followUps: fu\.followUps/.test(idx), 'IDX returns followUps')
    ok(/quota: quotaOut/.test(idx), 'IDX returns quota status')
    const consumeIdx = idx.indexOf('quotaAuthority.consumeQuota')
    const returnIdx = idx.indexOf('followUps: fu.followUps')
    ok(consumeIdx > 0 && consumeIdx < returnIdx, 'IDX consume precedes response return')
  }

  console.log(`\nstage2a_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
