'use strict'
/**
 * tests/rc8.14/insufficient-pool.test.js — RC8_14_A fail-closed + entitlement.
 * startChallenge must NOT create a record nor consume entitlement when the
 * eligible pool < challenge length.
 */
const path = require('path')
const { makeDb, seed, stubCloud, makeBank } = require('./_harness.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const FN = path.join(__dirname, '../../cloudfunctions/startChallenge/index.js')
function loadFn (db, openid) {
  const restore = stubCloud(openid || 'u', db)
  delete require.cache[require.resolve(FN)]
  const main = require(FN).main
  return { main, restore }
}

async function main () {
  console.log('RC8_14_A — INSUFFICIENT POOL / FAIL-CLOSED')

  // 1) entitled user + 厨师 (28 eligible) → INSUFFICIENT, no record created
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    seed(db, 'users', { openid: 'u' })
    seed(db, 'user_profiles', { openid: 'u', occupation: '厨师' })
    seed(db, 'memberships', { openid: 'u', status: 'active', permissions: ['challenge_full'], expiredAt: 9e12 })
    const { main: fn, restore } = loadFn(db)
    const before = (db._store.challenge_records || []).length
    const r = await fn({})
    restore()
    const after = (db._store.challenge_records || []).length
    ok(r.code !== 0, 'entitled 厨师 → non-success')
    ok(r.data && r.data.code === 'INSUFFICIENT_ELIGIBLE_EVENTS', 'INSUFFICIENT_ELIGIBLE_EVENTS code')
    ok(before === after, 'no challenge record created (fail-closed)')
  }

  // 2) entitled user + full eligible bank (no occupation) → record + plan with 30 distinct
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    seed(db, 'users', { openid: 'u' })
    seed(db, 'memberships', { openid: 'u', status: 'active', permissions: ['challenge_full'], expiredAt: 9e12 })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({})
    restore()
    ok(r.code === 0, 'entitled user → success')
    const rec = db._store.challenge_records.find((x) => x.recordId === r.data.recordId)
    ok(rec && rec.plan && rec.plan.eventIds.length === 30, 'record persisted with 30-event plan')
    ok(new Set(rec.plan.eventIds).size === 30, 'persisted plan is 30 distinct')
    ok(rec.trialMode === false, 'entitled → trialMode false')
  }

  // 3) trial user + full eligible bank → trial record with plan
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    seed(db, 'users', { openid: 'u' })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({})
    restore()
    ok(r.code === 0 && r.data.trialMode === true, 'no entitlement → trial')
    const rec = db._store.challenge_records.find((x) => x.recordId === r.data.recordId)
    ok(rec && rec.plan && rec.plan.eventIds.length === 30, 'trial record also carries a 30-event plan')
  }

  // 4) diagnostic mode → 6-event plan
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    seed(db, 'users', { openid: 'u' })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ mode: 'diagnostic' })
    restore()
    ok(r.code === 0, 'diagnostic success')
    const rec = db._store.challenge_records.find((x) => x.recordId === r.data.recordId)
    ok(rec && rec.plan && rec.plan.eventIds.length === 6, 'diagnostic plan = 6 distinct')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
