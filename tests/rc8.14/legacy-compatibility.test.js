'use strict'
/**
 * tests/rc8.14/legacy-compatibility.test.js — RC8_14_A legacy records.
 * Classify by plan availability; preserve completed records; recover active
 * legacy explicitly; refuse when safe recovery cannot be proven.
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

async function main () {
  console.log('RC8_14_A — LEGACY COMPATIBILITY')

  // 1) finished historical record → preserved, no plan created, unchanged
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const snapshot = {
      recordId: 'CRF', openid: 'u', mode: 'challenge', status: 'finished', currentEventIndex: 30, currentDay: 31,
      trialMode: false, finalType: 'system_thinker',
      choices: [{ eventId: 'CE001', choice: 'A' }, { eventId: 'CE029', choice: 'B' }],
      scores: { systemThinking: 78 }, rawScores: { systemThinking: 40 },
    }
    seed(db, 'challenge_records', JSON.parse(JSON.stringify(snapshot)))
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CRF' })
    restore()
    ok(r.code === 0 && r.data.finished === true, 'finished record returns finished')
    const rec = db._store.challenge_records.find((x) => x.recordId === 'CRF')
    ok(!rec.plan, 'finished record NOT given a plan (unchanged)')
    ok(JSON.stringify(rec.choices) === JSON.stringify(snapshot.choices), 'historical choices unchanged')
    ok(rec.finalType === 'system_thinker' && rec.currentDay === 31, 'finish fields unchanged')
    ok(JSON.stringify(rec.scores) === JSON.stringify(snapshot.scores), 'scores unchanged')
  }

  // 2) active legacy record (choices, no plan) → served from a NON-repeating plan
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    seed(db, 'challenge_records', {
      recordId: 'CRL', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false,
      currentEventIndex: 3, choices: [{ eventId: ids[0] }, { eventId: ids[1] }, { eventId: ids[2] }],
    })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CRL' })
    restore()
    ok(r.code === 0 && !r.data.finished, 'active legacy served an event')
    ok(!ids.slice(0, 3).includes(r.data.eventId), 'served event is NOT an already-answered one (no repeat)')
  }

  // 3) active legacy with answer history that cannot yield a distinct plan → refuse
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    seed(db, 'challenge_records', {
      recordId: 'CRU', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false,
      currentEventIndex: 2, choices: [{ eventId: 'CE001' }, { eventId: 'CE001' }], // duplicate history
    })
    const res = await A.recoverLegacyPlan({
      db, openid: 'u',
      record: db._store.challenge_records.find((x) => x.recordId === 'CRU'),
      ctx: {}, buildPersonalizedPlan: require(path.join(__dirname, '../../cloudfunctions/getChallengeEvent/lib/challengePersonalization.js')).buildPersonalizedPlan,
    })
    ok(res.status === A.PLAN_STATUS.UNRECOVERABLE, 'duplicate legacy history → refuse recovery (stop & report)')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
