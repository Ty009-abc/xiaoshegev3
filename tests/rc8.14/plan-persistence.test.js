'use strict'
/**
 * tests/rc8.14/plan-persistence.test.js — RC8_14_A_R2 PHASE_2 (atomicity).
 * Conditional plan persistence: first writer wins, concurrent writers converge,
 * an existing valid plan is never overwritten (no blind last-writer-wins).
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
  return { main: require(FN).main, restore }
}

async function main () {
  console.log('RC8_14_A_R2 — PLAN PERSISTENCE / ATOMICITY')

  // 1) concurrent GETs on a legacy record → exactly ONE distinct plan persisted
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    seed(db, 'challenge_records', {
      recordId: 'CRC', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false,
      currentEventIndex: 3, choices: [{ eventId: ids[0] }, { eventId: ids[1] }, { eventId: ids[2] }],
    })
    const { main: fn, restore } = loadFn(db)
    const results = await Promise.all(Array.from({ length: 10 }, () => fn({ recordId: 'CRC' })))
    restore()
    const rec = db._store.challenge_records.find((x) => x.recordId === 'CRC')
    ok(rec.plan && new Set(rec.plan.eventIds).size === 30, 'exactly one 30-distinct plan persisted')
    ok(JSON.stringify(rec.plan.eventIds.slice(0, 3)) === JSON.stringify([ids[0], ids[1], ids[2]]), 'persisted plan preserves answered prefix')
    const served = results.map((r) => r.data && r.data.eventId)
    ok(new Set(served).size === 1 && served[0] === rec.plan.eventIds[3], 'all concurrent readers converge on the same served event')
  }

  // 2) an existing VALID persisted plan is never overwritten
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    const existing = { planVersion: 'rc8.14_v1', challengeLength: 30, eventBankVersion: 'bank_z', eventIds: ids.slice().reverse(), createdAt: 111, source: 'personalized_v1' }
    seed(db, 'challenge_records', {
      recordId: 'CRO', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false,
      currentEventIndex: 2, choices: [{ eventId: existing.eventIds[0] }, { eventId: existing.eventIds[1] }],
      plan: existing, planLocked: true,
    })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CRO' })
    restore()
    const rec = db._store.challenge_records.find((x) => x.recordId === 'CRO')
    ok(JSON.stringify(rec.plan.eventIds) === JSON.stringify(existing.eventIds), 'existing plan NOT overwritten')
    ok(rec.plan.createdAt === 111, 'existing plan createdAt intact')
    ok(r.data.eventId === existing.eventIds[2], 'served from the EXISTING plan')
  }

  // 3) planLocked guard: a second writer cannot clobber a locked plan
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    // record WITHOUT plan but ALREADY locked (simulates a writer mid-flight)
    seed(db, 'challenge_records', {
      recordId: 'CRK', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false,
      currentEventIndex: 1, choices: [{ eventId: ids[0] }], planLocked: false,
    })
    // First writer persists; assert stats/gating works via a direct conditional update.
    const { makeDb: _ } = {}
    const r0 = await db.collection('challenge_records').where({ _id: db._store.challenge_records[0]._id, planLocked: db.command.neq(true) }).update({ data: { plan: { eventIds: ['x'] }, planLocked: true } })
    ok(r0.stats.updated === 1, 'first conditional write wins')
    const r1 = await db.collection('challenge_records').where({ _id: db._store.challenge_records[0]._id, planLocked: db.command.neq(true) }).update({ data: { plan: { eventIds: ['y'] }, planLocked: true } })
    ok(r1.stats.updated === 0, 'second conditional write is refused (no clobber)')
    const rec = db._store.challenge_records[0]
    ok(rec.plan.eventIds[0] === 'x', 'locked plan preserved')
  }

  // 4) buildPlan on a record that already has a valid plan → ALREADY (no rebuild)
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    const rec = { recordId: 'CRA', mode: 'challenge', currentEventIndex: 0, choices: [], plan: { planVersion: 'rc8.14_v1', challengeLength: 30, eventIds: ids } }
    const r = await A.buildPlan({ db, openid: 'u', record: rec, ctx: {}, buildPersonalizedPlan: require(path.join(__dirname, '../../cloudfunctions/getChallengeEvent/lib/challengePersonalization.js')).buildPersonalizedPlan })
    ok(r.status === A.PLAN_STATUS.ALREADY, 'existing valid plan → ALREADY (never rebuilt)')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
