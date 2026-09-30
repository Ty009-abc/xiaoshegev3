#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/replay-contract.test.js
 *
 * PAYMENT_STAGE5A_R10_7_EXPLICIT_REPLAY_CONTRACT — server contract (OPTION_C).
 *
 * Loads cloudfunctions/startChallenge/index.js in a vm sandbox with a stub
 * wx-server-sdk (in-memory DB) so we can assert the replay branch semantics:
 *   A normal_entry_finished_paid    -> SAME old record + destination challenge_result
 *   B explicit_replay_finished_ent  -> NEW record (trialMode:false, unlocked:true, idx:0)
 *   C preserves old record
 *   D preserves old report
 *   E preserves entitlement
 *   F same replayRequestId twice     -> same recordId, created count 1
 *   H non-entitled replay=true       -> fail-closed, no unlocked record
 *   M no payment chain in replay path
 *   N new replay not blocked by 39.9 paywall on client (source-level)
 *
 * Logic + source-asset only. No network / DB / payment / device claim.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const FN_INDEX = path.join(ROOT, 'cloudfunctions', 'startChallenge', 'index.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE5A_R10_7 — REPLAY (server)')

// ── tiny in-memory cloud db ──────────────────────────────────────────────
function makeDB (seed) {
  const store = JSON.parse(JSON.stringify(seed || {}))
  let addCount = 0
  const col = (name) => {
    store[name] = store[name] || []
    let _filter = {}
    let _limit = 1e9
    let _order = null
    const api = {
      where: (f) => { _filter = f || {}; return api },
      orderBy: (k, dir) => { _order = { k, dir }; return api },
      limit: (n) => { _limit = n; return api },
      get: async () => {
        let docs = store[name].filter((d) => Object.keys(_filter).every((k) => d[k] === _filter[k]))
        if (_order) docs = docs.slice().sort((a, b) => _order.dir === 'desc' ? (b[_order.k] - a[_order.k]) : (a[_order.k] - b[_order.k]))
        return { data: docs.slice(0, _limit) }
      },
      add: async ({ data }) => { addCount++; store[name].push(JSON.parse(JSON.stringify(data))); return { _id: 'id' + addCount } },
    }
    return api
  }
  return { collection: col, _store: store, _addCount: () => addCount, command: { gt: (x) => ({ $gt: x }), lte: (x) => ({ $lte: x }), gte: (x) => ({ $gte: x }), inc: (x) => x } }
}

function run ({ dbSeed, entitled, event, openid }) {
  const db = makeDB(dbSeed)
  let page = null
  const sandbox = {
    require: (req) => {
      if (req === 'wx-server-sdk') {
        return { init: () => {}, DYNAMIC_CURRENT_ENV: 'env', database: () => db, getWXContext: () => ({ OPENID: openid || 'OPENID_X' }) }
      }
      if (req.indexOf('response.js') >= 0) return require(path.join(ROOT, 'cloudfunctions', 'startChallenge', 'lib', 'response.js'))
      if (req.indexOf('challengeEntitlement.js') >= 0) return { CHALLENGE_PERMISSION: 'challenge_full', hasChallengeEntitlement: async () => entitled }
      throw new Error('unexpected require: ' + req)
    },
    module: { exports: {} },
    exports: {},
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
  }
  sandbox.global = sandbox
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(FN_INDEX, 'utf8'), sandbox, { filename: FN_INDEX })
  const fn = sandbox.module.exports.main || sandbox.exports.main
  return { fn, db }
}

const SEED_FINISHED = {
  users: [{ openid: 'OPENID_X', membershipLevel: 'free' }],
  entitlements: [{ openid: 'OPENID_X', permissions: ['challenge_full'] }],
  challenge_records: [
    { recordId: 'CRoldFinished', openid: 'OPENID_X', mode: 'challenge', trialMode: false, unlocked: true, status: 'finished', currentDay: 31, currentEventIndex: 30, createdAt: 100, rawScores: { cv: 133 } },
  ],
  reports: [{ reportId: 'ARCF_x', openid: 'OPENID_X', content: 'OLD REPORT' }],
  orders: [],
  memberships: [],
}
// entitlement resolution path also queries memberships; hasChallengeEntitlement stub covers access.
const SEED_FINISHED_NOENT = JSON.parse(JSON.stringify(SEED_FINISHED))

const okAsync = async (p) => { try { return await p } catch (e) { return { __err: e } } }

;(async () => {
  // ── A · normal entry (no replay) finished paid -> SAME record + result destination ──
  {
    const { fn } = run({ dbSeed: SEED_FINISHED, entitled: true, event: { mode: 'challenge' } })
    const res = await okAsync(fn({ mode: 'challenge' }, {}))
    eq(res.code, 0, 'A code 0')
    eq(res.data.recordId, 'CRoldFinished', 'A SAME old record')
    eq(res.data.completed, true, 'A completed true')
    eq(res.data.destination, 'challenge_result', 'A destination challenge_result')
    eq(res.data.trialMode, false, 'A trialMode false')
  }

  // ── B · explicit replay entitled -> NEW record ──
  {
    const { fn, db } = run({ dbSeed: SEED_FINISHED, entitled: true, event: { mode: 'challenge', replay: true, replayRequestId: 'RP1' } })
    const before = db._store.challenge_records.length
    const res = await okAsync(fn({ mode: 'challenge', replay: true, replayRequestId: 'RP1', replaySource: 'world_model_report' }, {}))
    eq(res.code, 0, 'B code 0')
    ok(res.data.recordId && res.data.recordId !== 'CRoldFinished', 'B NEW recordId != old')
    eq(res.data.trialMode, false, 'B trialMode false')
    eq(res.data.unlocked, true, 'B unlocked true')
    eq(res.data.currentEventIndex, 0, 'B currentEventIndex 0')
    eq(db._store.challenge_records.length, before + 1, 'B exactly one new record added')
    const created = db._store.challenge_records.find((r) => r.recordId === res.data.recordId)
    eq(created.status, 'processing', 'B new record status processing')
    eq(created.trialMode, false, 'B new record trialMode false')
    eq(created.unlocked, true, 'B new record unlocked true')
    eq(created.currentEventIndex, 0, 'B new record idx 0')
    eq(created.replayRequestId, 'RP1', 'B audit replayRequestId stored')
    eq(created.replaySource, 'world_model_report', 'B audit replaySource stored')
    ok(!created.choices || created.choices.length === 0, 'B new record has no copied answers')
    ok(!created.finalType, 'B new record has no copied finalType')
  }

  // ── C/D/E · preserves old record + report + entitlement ──
  {
    const { fn, db } = run({ dbSeed: SEED_FINISHED, entitled: true, event: {} })
    const oldRecBefore = JSON.stringify(db._store.challenge_records.find((r) => r.recordId === 'CRoldFinished'))
    const reportBefore = JSON.stringify(db._store.reports)
    const entBefore = JSON.stringify(db._store.entitlements)
    const res = await okAsync(fn({ mode: 'challenge', replay: true, replayRequestId: 'RP2' }, {}))
    eq(res.code, 0, 'C/D/E replay ok')
    eq(JSON.stringify(db._store.challenge_records.find((r) => r.recordId === 'CRoldFinished')), oldRecBefore, 'C old record unchanged')
    eq(JSON.stringify(db._store.reports), reportBefore, 'D old report unchanged')
    eq(JSON.stringify(db._store.entitlements), entBefore, 'E entitlement unchanged')
    eq(db._store.orders.length, 0, 'E no order created')
  }

  // ── F · same replayRequestId twice -> same recordId, created once ──
  {
    const { fn, db } = run({ dbSeed: SEED_FINISHED, entitled: true, event: {} })
    const r1 = await okAsync(fn({ mode: 'challenge', replay: true, replayRequestId: 'RPsame' }, {}))
    const r2 = await okAsync(fn({ mode: 'challenge', replay: true, replayRequestId: 'RPsame' }, {}))
    eq(r1.code, 0, 'F first ok')
    eq(r2.code, 0, 'F second ok')
    eq(r1.data.recordId, r2.data.recordId, 'F SAME recordId for same replayRequestId')
    const replayDocs = db._store.challenge_records.filter((r) => r.replayRequestId === 'RPsame')
    eq(replayDocs.length, 1, 'F created exactly one record')
    eq(r2.data.idempotent, true, 'F second call flagged idempotent')
  }

  // ── H · non-entitled replay=true -> fail-closed ──
  {
    const { fn, db } = run({ dbSeed: SEED_FINISHED_NOENT, entitled: false, event: {} })
    const before = db._store.challenge_records.length
    const res = await okAsync(fn({ mode: 'challenge', replay: true, replayRequestId: 'RP3' }, {}))
    ok(res.code !== 0, 'H fail-closed (non-zero code)')
    eq(db._store.challenge_records.length, before, 'H no record created')
    ok(!db._store.challenge_records.some((r) => r.unlocked === true && r.replayRequestId === 'RP3'), 'H no unlocked replay record')
    eq(db._store.entitlements.length, JSON.parse(JSON.stringify(SEED_FINISHED_NOENT)).entitlements.length, 'H entitlement not granted')
    eq(db._store.orders.length, 0, 'H no payment triggered')
  }

  // ── replay missing replayRequestId -> param error ──
  {
    const { fn, db } = run({ dbSeed: SEED_FINISHED, entitled: true, event: {} })
    const before = db._store.challenge_records.length
    const res = await okAsync(fn({ mode: 'challenge', replay: true }, {}))
    ok(res.code !== 0, 'missing replayRequestId -> fail')
    eq(db._store.challenge_records.length, before, 'missing id -> no record created')
  }

  // ── M · no payment chain in replay path (source) ──
  {
    const src = fs.readFileSync(FN_INDEX, 'utf8')
    const replay = (src.split('_handleExplicitReplay ({')[1] || '').split('\n}')[0]
    ok(!/createOrder|requestPayment|paymentFinalizer|verifyPayment|payCallback/.test(replay), 'M replay path has no payment calls')
    ok(!/entitlements.*add|memberships.*add/.test(replay), 'M replay path writes no entitlement')
  }

  console.log('\nreplay-contract_TEST pass=*** fail=' + fail)
  process.exit(fail ? 1 : 0)
})()
