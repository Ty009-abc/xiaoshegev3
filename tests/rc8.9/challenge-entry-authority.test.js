#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/challenge-entry-authority.test.js
 *
 * PAYMENT_STAGE5A_R6_CHALLENGE_ENTRY_AUTHORITY
 *
 * Server entry authority (startChallenge) + minimal client routing:
 *   ENTITLED + UNFINISHED → resume same record
 *   ENTITLED + FINISHED   → same record + route to challenge-result
 *   ENTITLED (no owned)   → never trialMode=true
 *   FREE/unentitled       → trialMode=true (trial gate)
 *   owned record ALWAYS outranks later stale trial records
 *   challenge_full entitlement is authoritative even when membershipLevel=free
 *     and even when memberships is absent.
 *
 * Node built-ins only; wx-server-sdk + permissionEngine run against an
 * in-memory DB. No network, no real DB, no charge.
 */

const path = require('path')
const Module = require('module')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

// ── in-memory DB (supports equality + comparison ops + orderBy/limit) ────────
let STORE = {}
let OPENID = 'oUser'
let added = []
function match (doc, q) {
  return Object.keys(q).every((k) => {
    const v = q[k], dv = doc[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('$gt' in v) return dv > v.$gt
      if ('$gte' in v) return dv >= v.$gte
      if ('$lt' in v) return dv < v.$lt
      if ('$lte' in v) return dv <= v.$lte
      return false
    }
    return dv === v
  })
}
function collection (name) {
  if (!STORE[name]) STORE[name] = []
  const chain = (q) => {
    let _sort = null, _limit = null, _skip = 0
    const api = {
      orderBy: (f, dir) => { _sort = { f, dir }; return api },
      skip: (n) => { _skip = n; return api },
      limit: (n) => { _limit = n; return api },
      get: async () => {
        let rows = STORE[name].filter((d) => match(d, q))
        if (_sort) rows = rows.slice().sort((a, b) => { const x = a[_sort.f] == null ? 0 : a[_sort.f]; const y = b[_sort.f] == null ? 0 : b[_sort.f]; return _sort.dir === 'desc' ? (y - x) : (x - y) })
        if (_skip) rows = rows.slice(_skip)
        if (_limit != null) rows = rows.slice(0, _limit)
        return { data: rows.map((d) => ({ ...d })) }
      },
      count: async () => ({ total: STORE[name].filter((d) => match(d, q)).length }),
    }
    return api
  }
  return {
    where: (q) => chain(q),
    add: async ({ data }) => { const d = Object.assign({ _id: name + '_' + (STORE[name].length + 1) }, data); STORE[name].push(d); added.push({ name, data }); return { _id: d._id } },
    doc: () => ({ update: async () => ({ stats: { updated: 1 } }) }),
  }
}
const fakeCloud = {
  DYNAMIC_CURRENT_ENV: 'test-env',
  init () {},
  getWXContext: () => ({ OPENID }),
  database: () => ({ collection }),   // no db.command → permissionEngine uses { $gt }
}
const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return fakeCloud
  return origLoad.apply(this, arguments)
}

const ROOT = path.resolve(__dirname, '..', '..')
const FN = path.join(ROOT, 'cloudfunctions', 'startChallenge', 'index.js')
delete require.cache[require.resolve(FN)]
const startChallenge = require(FN).main

function reset (seed) {
  STORE = Object.assign({ users: [], memberships: [], entitlements: [], challenge_records: [] }, seed || {})
  added = []
  OPENID = 'oUser'
}
const FREE_USER = [{ openid: 'oUser', membershipLevel: 'free' }]
const ENTITLED = [{ openid: 'oUser', permissions: ['challenge_full', 'full_report', 'report_history', 'growth_review'], sources: [{ productId: 'challenge_39_9', expiresAt: 0 }] }]

console.log('PAYMENT_STAGE5A_R6 challenge entry authority')

;(async () => {
  // A: paid/unlocked UNFINISHED → same recordId, no new record
  {
    reset({
      users: FREE_USER,
      challenge_records: [
        { _id: 'u1', recordId: 'CR_PAID_OPEN', openid: 'oUser', mode: 'challenge', status: 'processing', currentEventIndex: 12, trialMode: false, unlocked: true, createdAt: 100 },
      ],
    })
    const r = await startChallenge({}, {})
    eq(r.code, 0, 'A.0 ok')
    eq(r.data.recordId, 'CR_PAID_OPEN', 'A.1 same recordId')
    eq(r.data.resumed, true, 'A.2 resumed')
    eq(r.data.completed, false, 'A.3 completed=false')
    eq(r.data.trialMode, false, 'A.4 trialMode=false')
    eq(r.data.unlocked, true, 'A.5 unlocked=true')
    eq(added.length, 0, 'A.6 NO new record')
  }

  // B: paid/unlocked FINISHED → same recordId + completed + result destination
  {
    reset({
      users: FREE_USER,
      challenge_records: [
        { _id: 'f1', recordId: 'CR_PAID_DONE', openid: 'oUser', mode: 'challenge', status: 'finished', currentEventIndex: 30, finalType: 'normal_awakened', trialMode: false, unlocked: true, createdAt: 100 },
      ],
    })
    const r = await startChallenge({}, {})
    eq(r.data.recordId, 'CR_PAID_DONE', 'B.1 same recordId')
    eq(r.data.completed, true, 'B.2 completed=true')
    eq(r.data.destination, 'challenge_result', 'B.3 destination=challenge_result')
    eq(r.data.trialMode, false, 'B.4 trialMode=false')
    eq(added.length, 0, 'B.5 NO new record')
  }

  // C: paid record + newer stale trials → paid record wins (no rely on createdAt of trials)
  {
    reset({
      users: FREE_USER,
      challenge_records: [
        { _id: 't1', recordId: 'CR_TRIAL1', openid: 'oUser', mode: 'challenge', status: 'processing', currentEventIndex: 3, trialMode: true, createdAt: 900 },
        { _id: 't2', recordId: 'CR_TRIAL2', openid: 'oUser', mode: 'challenge', status: 'processing', currentEventIndex: 3, trialMode: true, createdAt: 999 },
        { _id: 'p1', recordId: 'CR_PAID', openid: 'oUser', mode: 'challenge', status: 'processing', currentEventIndex: 30, trialMode: false, unlocked: true, createdAt: 100 },
      ],
    })
    const r = await startChallenge({}, {})
    eq(r.data.recordId, 'CR_PAID', 'C.1 paid record wins over newer trials')
    eq(added.length, 0, 'C.2 no new record')
  }

  // D: entitlement exists but NO owned record → creates entitled record (NEVER trial)
  {
    reset({ users: FREE_USER, entitlements: ENTITLED, challenge_records: [] })
    const r = await startChallenge({}, {})
    eq(r.data.trialMode, false, 'D.1 entitled new record is NOT trial')
    eq(r.data.unlocked, true, 'D.2 unlocked=true')
    eq(added.length, 1, 'D.3 one record created')
    eq(added[0].data.trialMode, false, 'D.4 persisted trialMode=false')
  }

  // E: free/non-entitled → trialMode=true (valid trial gate)
  {
    reset({ users: FREE_USER, challenge_records: [] })
    const r = await startChallenge({}, {})
    eq(r.data.trialMode, true, 'E.1 free → trial')
    eq(r.data.trialLimit, 3, 'E.2 trialLimit=3')
    eq(added[0].data.trialMode, true, 'E.3 persisted trial')
  }

  // F: paid record currentEventIndex > 3 → returns owned record, trialMode=false (no paywall gate)
  {
    reset({
      users: FREE_USER,
      challenge_records: [
        { _id: 'p', recordId: 'CR_PAID_GT3', openid: 'oUser', mode: 'challenge', status: 'processing', currentEventIndex: 20, trialMode: false, unlocked: true, createdAt: 100 },
      ],
    })
    const r = await startChallenge({}, {})
    eq(r.data.recordId, 'CR_PAID_GT3', 'F.1 resumes owned idx>3')
    eq(r.data.trialMode, false, 'F.2 trialMode=false → getChallengeEvent will NOT lock')
    eq(r.data.currentEventIndex, 20, 'F.3 index preserved')
    eq(added.length, 0, 'F.4 no new record')
  }

  // G: paid finished → server result route + trialMode=false (no 39.9 CTA path)
  {
    reset({
      users: FREE_USER,
      challenge_records: [
        { _id: 'f', recordId: 'CR_PAID_DONE2', openid: 'oUser', mode: 'challenge', status: 'finished', currentEventIndex: 30, trialMode: false, unlocked: true, createdAt: 100 },
      ],
    })
    const r = await startChallenge({}, {})
    eq(r.data.destination, 'challenge_result', 'G.1 result destination')
    eq(r.data.trialMode, false, 'G.2 not trial')
    eq(added.length, 0, 'G.3 no new record')
  }

  // H: repeat entry x5 → no additional record
  {
    reset({
      users: FREE_USER,
      challenge_records: [
        { _id: 'p', recordId: 'CR_PAID_REP', openid: 'oUser', mode: 'challenge', status: 'processing', currentEventIndex: 5, trialMode: false, unlocked: true, createdAt: 100 },
      ],
    })
    for (let i = 0; i < 5; i++) await startChallenge({}, {})
    eq(added.length, 0, 'H.1 five entries → zero new records')
  }

  // I: membershipLevel=free BUT challenge_full entitlement → treated as entitled
  {
    reset({ users: FREE_USER, entitlements: ENTITLED, challenge_records: [] })
    const r = await startChallenge({}, {})
    eq(r.data.trialMode, false, 'I.1 free level + entitlement → NOT trial')
  }

  // J: memberships absent → challenge entitlement still works
  {
    reset({ users: FREE_USER, entitlements: ENTITLED, challenge_records: [] })
    eq(STORE.memberships.length, 0, 'J.0 no memberships seeded')
    const r = await startChallenge({}, {})
    eq(r.data.trialMode, false, 'J.1 entitlement w/o membership → entitled')
  }

  // M: stale trial + paid FINISHED → finished paid result wins
  {
    reset({
      users: FREE_USER,
      challenge_records: [
        { _id: 't', recordId: 'CR_TRIAL_NEW', openid: 'oUser', mode: 'challenge', status: 'processing', currentEventIndex: 3, trialMode: true, createdAt: 999 },
        { _id: 'f', recordId: 'CR_PAID_FIN', openid: 'oUser', mode: 'challenge', status: 'finished', currentEventIndex: 30, trialMode: false, unlocked: true, createdAt: 100 },
      ],
    })
    const r = await startChallenge({}, {})
    eq(r.data.recordId, 'CR_PAID_FIN', 'M.1 finished paid record wins')
    eq(r.data.completed, true, 'M.2 completed=true')
    eq(r.data.destination, 'challenge_result', 'M.3 result route')
    eq(added.length, 0, 'M.4 no new record')
  }

  // ── cross-user isolation (regression guard) ──────────────────────────────
  {
    reset({
      users: FREE_USER,
      challenge_records: [
        { _id: 'x', recordId: 'CR_OTHER', openid: 'oOther', mode: 'challenge', status: 'processing', trialMode: false, unlocked: true, createdAt: 100 },
      ],
    })
    const r = await startChallenge({}, {})
    eq(r.data.trialMode, true, 'X.1 other user record never resumes → trial')
    eq(added.length, 1, 'X.2 own trial created')
  }

  // ── K/L client routing lives in challenge-start-routing.test.js (client commit) ──

  console.log(`\nchallenge-entry-authority_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
