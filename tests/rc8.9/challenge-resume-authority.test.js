#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/challenge-resume-authority.test.js
 *
 * OWNER_CHALLENGE_ACCESS_RESTORED — server-authoritative resume.
 * Entry flow (challenge-start → startChallenge) must NOT create a fresh trial
 * record when the user already owns an UNLOCKED challenge record
 * (challenge_records.trialMode === false || unlocked === true, written by the
 * payment finalizer). Before this fix, every tap created a new trialMode:true
 * record → owner re-locked despite a paid challenge_39_9 entitlement.
 *
 * Node built-ins only; wx-server-sdk stubbed in-memory.
 */

const path = require('path')
const Module = require('module')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

// ── in-memory DB ──
let STORE = {}
let OPENID = 'oUser'
let added = []
function match (doc, q) { return Object.keys(q).every((k) => doc[k] === q[k]) }
function collection (name) {
  if (!STORE[name]) STORE[name] = []
  const chain = (q) => {
    const rowsOf = () => STORE[name].filter((d) => match(d, q))
    const api = {
      orderBy: () => api,
      skip: () => api,
      limit: () => api,
      get: async () => ({ data: rowsOf().map((d) => ({ ...d })) }),
      count: async () => ({ total: rowsOf().length }),
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
  database: () => ({ collection }),
}
// stub wx-server-sdk BEFORE loading the function
const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return fakeCloud
  return origLoad.apply(this, arguments)
}

const FN = path.join(ROOTDIR(), 'cloudfunctions', 'startChallenge', 'index.js')
function ROOTDIR () { return path.resolve(__dirname, '..', '..') }
delete require.cache[require.resolve(FN)]
const startChallenge = require(FN).main

function reset (seed) {
  STORE = Object.assign({ users: [], memberships: [], challenge_records: [] }, seed || {})
  added = []
  OPENID = 'oUser'
}

;(async () => {
  // R1: unlocked record → resume, NO new record
  {
    reset({
      users: [{ openid: 'oUser', membershipLevel: 'free' }],
      challenge_records: [
        { _id: 'a', recordId: 'CR_UNLOCKED', openid: 'oUser', mode: 'challenge', status: 'processing', currentEventIndex: 3, trialMode: false, unlocked: true, createdAt: 100 },
      ],
    })
    const r = await startChallenge({}, {})
    eq(r.code, 0, 'R1.0: ok')
    eq(r.data.recordId, 'CR_UNLOCKED', 'R1.1: resumes unlocked record')
    eq(r.data.trialMode, false, 'R1.2: resumed trialMode=false')
    eq(r.data.resumed, true, 'R1.3: resumed flag')
    eq(added.length, 0, 'R1.4: NO new record created')
  }

  // R2: unlocked ONLY via unlocked:true (trialMode missing) → resume
  {
    reset({
      users: [{ openid: 'oUser', membershipLevel: 'free' }],
      challenge_records: [
        { _id: 'a', recordId: 'CR_UNLOCKED2', openid: 'oUser', mode: 'challenge', status: 'processing', currentEventIndex: 2, unlocked: true, createdAt: 100 },
      ],
    })
    const r = await startChallenge({}, {})
    eq(r.data.recordId, 'CR_UNLOCKED2', 'R2.1: resumes unlocked===true record')
    eq(added.length, 0, 'R2.2: no new record')
  }

  // R3: no unlocked record → normal trial creation
  {
    reset({ users: [{ openid: 'oUser', membershipLevel: 'free' }], challenge_records: [] })
    const r = await startChallenge({}, {})
    eq(r.code, 0, 'R3.0: ok')
    eq(r.data.trialMode, true, 'R3.1: new trial record')
    eq(added.length, 1, 'R3.2: one record created')
    ok(/^CR\d/.test(r.data.recordId), 'R3.3: fresh recordId')
  }

  // R4: paid entitlement must NOT create a NEW trial even if other trials exist
  {
    reset({
      users: [{ openid: 'oUser', membershipLevel: 'free' }],
      challenge_records: [
        { _id: 't1', recordId: 'CR_T1', openid: 'oUser', mode: 'challenge', status: 'processing', currentEventIndex: 3, trialMode: true, createdAt: 500 },
        { _id: 'u1', recordId: 'CR_PAID', openid: 'oUser', mode: 'challenge', status: 'processing', currentEventIndex: 3, trialMode: false, unlocked: true, createdAt: 100 },
      ],
    })
    const r = await startChallenge({}, {})
    eq(r.data.recordId, 'CR_PAID', 'R4.1: picks the unlocked record, not a trial')
    eq(added.length, 0, 'R4.2: no new record')
  }

  // R5: finished unlocked record → do NOT resume as playable; (must create new so a fresh cycle can start)
  {
    reset({
      users: [{ openid: 'oUser', membershipLevel: 'free' }],
      challenge_records: [
        { _id: 'f', recordId: 'CR_DONE', openid: 'oUser', mode: 'challenge', status: 'finished', currentEventIndex: 30, trialMode: false, unlocked: true, createdAt: 100 },
      ],
    })
    const r = await startChallenge({}, {})
    eq(r.data.resumed, undefined, 'R5.1: finished record not resumed as playable')
    eq(added.length, 1, 'R5.2: creates a new cycle record')
  }

  // R6: active membership grants access (legacy path preserved) — hasAccess=true → trialMode false
  {
    reset({
      users: [{ openid: 'oUser', membershipLevel: 'vip_month' }],
      memberships: [{ openid: 'oUser', status: 'active', expiredAt: 9999999999999, permissions: ['challenge_unlock'] }],
      challenge_records: [],
    })
    const r = await startChallenge({}, {})
    eq(r.data.trialMode, false, 'R6.1: member → unlocked record')
    eq(added.length, 1, 'R6.2: one new record (no resume target)')
  }

  // R7: different-openid isolation — another user's unlocked record never resumes
  {
    reset({
      users: [{ openid: 'oUser', membershipLevel: 'free' }],
      challenge_records: [
        { _id: 'x', recordId: 'CR_OTHER', openid: 'oOther', mode: 'challenge', status: 'processing', trialMode: false, unlocked: true, createdAt: 100 },
      ],
    })
    const r = await startChallenge({}, {})
    eq(r.data.trialMode, true, 'R7.1: other user record not resumed')
    eq(added.length, 1, 'R7.2: creates own trial')
  }

  // R8: diagnostic mode unaffected
  {
    reset({ users: [{ openid: 'oUser', membershipLevel: 'free' }], challenge_records: [] })
    const r = await startChallenge({ mode: 'diagnostic' }, {})
    eq(r.data.mode, 'diagnostic', 'R8.1: diagnostic mode')
    eq(added[0].data.mode, 'diagnostic', 'R8.2: diagnostic record created')
  }

  Module._load = origLoad
  console.log(`CHALLENGE_RESUME_AUTHORITY_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
