'use strict'
/**
 * tests/rc8.14/concurrency-resume.test.js — RC8_14_A concurrency + resume + expired-membership.
 */
const path = require('path')
const { makeDb, seed, stubCloud, makeBank } = require('./_harness.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const GE = path.join(__dirname, '../../cloudfunctions/getChallengeEvent/index.js')
const SC = path.join(__dirname, '../../cloudfunctions/submitChallengeChoice/index.js')
function load (fnPath, db, openid) {
  const restore = stubCloud(openid || 'u', db)
  delete require.cache[require.resolve(fnPath)]
  const main = require(fnPath).main
  return { main, restore }
}
function planOf (ids) {
  return { planVersion: 'rc8.14_v1', challengeLength: ids.length, eventBankVersion: 'bank_x', eventIds: ids.slice(), createdAt: 1, source: 'personalized_v1' }
}

async function main () {
  console.log('RC8_14_A — CONCURRENCY / RESUME / EXPIRED MEMBERSHIP')

  // 1) concurrent identical GETs → same event, no duplication
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CRC', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 7, choices: [], plan: planOf(ids) })
    const { main: fn, restore } = load(GE, db)
    const results = await Promise.all(Array.from({ length: 8 }, () => fn({ recordId: 'CRC' })))
    restore()
    const served = results.map((r) => r.data.eventId)
    ok(new Set(served).size === 1 && served[0] === ids[7], 'concurrent GETs → single deterministic event')
  }

  // 2) concurrent duplicate submits → only one advance (idempotency guard)
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CRS', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 0, choices: [], plan: planOf(ids) })
    const { main: fn, restore } = load(SC, db)
    const results = await Promise.all(Array.from({ length: 5 }, () => fn({ recordId: 'CRS', eventId: ids[0], choiceKey: 'A' })))
    restore()
    const rec = db._store.challenge_records.find((x) => x.recordId === 'CRS')
    // first advances to 1; the rest see currentEventIndex=1 whose expected is ids[1] → duplicate → idempotent
    ok(rec.choices.length === 1, 'only one score recorded under concurrent duplicate submits')
    ok(rec.currentEventIndex === 1, 'index advanced exactly once')
  }

  // 3) expired membership with legacy rights → still resume owned record (no re-lock)
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    seed(db, 'users', { openid: 'u' })
    seed(db, 'memberships', { openid: 'u', status: 'active', permissions: ['challenge_full'], expiredAt: 1 }) // expired
    seed(db, 'challenge_records', { recordId: 'CRO', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, unlocked: true, currentEventIndex: 3, choices: [], plan: planOf(ids), createdAt: 100 })
    const { main: fn, restore } = load(path.join(__dirname, '../../cloudfunctions/startChallenge/index.js'), db)
    const r = await fn({})
    restore()
    ok(r.code === 0 && r.data.resumed === true, 'expired membership + owned record → resume (no new trial)')
    ok(r.data.recordId === 'CRO', 'resumes the same owned recordId')
  }

  // 4) resume after restart: state read from persisted plan, deterministic
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CRR', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 12, choices: ids.slice(0, 12).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(ids) })
    let { main: fn, restore } = load(GE, db)
    const a = (await fn({ recordId: 'CRR' })).data.eventId
    restore()
    ;({ main: fn, restore } = load(GE, db)) // simulate process restart (re-require)
    const b = (await fn({ recordId: 'CRR' })).data.eventId
    restore()
    ok(a === b && a === ids[12], 'restart+resume → identical next event (plan[12])')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
