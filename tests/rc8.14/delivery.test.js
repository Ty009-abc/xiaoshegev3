'use strict'
/**
 * tests/rc8.14/delivery.test.js — RC8_14_A delivery (getChallengeEvent).
 * Loads the real cloud function with a stubbed wx-server-sdk + in-memory DB.
 */
const path = require('path')
const { makeDb, seed, stubCloud, makeBank } = require('./_harness.js')
const A = require(path.join(__dirname, '../../cloudfunctions/getChallengeEvent/lib/challengePlan.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const FN = path.join(__dirname, '../../cloudfunctions/getChallengeEvent/index.js')
function loadFn (db, openid) {
  const restore = stubCloud(openid || 'u', db)
  delete require.cache[require.resolve(FN)]
  const main = require(FN).main
  return { main, restore }
}

function planOf (ids) {
  return { planVersion: 'rc8.14_v1', challengeLength: ids.length, eventBankVersion: 'bank_x', eventIds: ids.slice(), createdAt: 1, source: 'personalized_v1' }
}

async function main () {
  console.log('RC8_14_A — DELIVERY (plan-only, no bank-skip)')

  // 1) serves plan[idx] exactly
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CR1', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 0, choices: [], plan: planOf(ids) })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CR1' })
    restore()
    ok(r.code === 0, 'serves OK')
    ok(r.data.eventId === ids[0], 'serves plan[0] (' + r.data.eventId + ')')
    ok(r.data.day === 1, 'display day = 1')
    ok(r.data.progress.total === 30, 'progress total = 30 (plan length)')
  }

  // 2) repeated request for same index → same event (idempotent)
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CR2', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 4, choices: [], plan: planOf(ids) })
    const { main: fn, restore } = loadFn(db)
    const a = await fn({ recordId: 'CR2' })
    const b = await fn({ recordId: 'CR2' })
    restore()
    ok(a.data.eventId === b.data.eventId && a.data.eventId === ids[4], 'repeated request → identical event (plan[4])')
  }

  // 3) index at plan end → finished (NO bank-skip re-serve, NO day 31)
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CR3', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 30, choices: [], plan: planOf(ids) })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CR3' })
    restore()
    ok(r.code === 0 && r.data.finished === true, 'index==30 → finished')
    ok(!r.data.eventId, 'no event served at index 30')
    ok(r.data.progress.day === 30, 'day clamped to 30 (never 31)')
  }

  // 4) resume after "restart" → deterministic next (no repeat of answered)
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    seed(db, 'challenge_records', {
      recordId: 'CR4', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 3,
      choices: [{ eventId: ids[0] }, { eventId: ids[1] }, { eventId: ids[2] }], plan: planOf(ids),
    })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CR4' })
    restore()
    ok(r.data.eventId === ids[3], 'resume → plan[3], not an answered event')
  }

  // 5) insufficient eligible pool (厨师) → fail-closed, no event
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    // profile occupation = 厨师 → CE004 + CE007 filtered → 28 eligible
    seed(db, 'user_profiles', { openid: 'u', occupation: '厨师' })
    seed(db, 'challenge_records', { recordId: 'CR5', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 0, choices: [] })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CR5' })
    restore()
    ok(r.code !== 0, 'insufficient pool → non-success code')
    ok(r.data && r.data.code === 'INSUFFICIENT_ELIGIBLE_EVENTS', 'INSUFFICIENT_ELIGIBLE_EVENTS surfaced')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
