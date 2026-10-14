'use strict'
/**
 * tests/rc8.14/legacy-recovery-wiring.test.js — RC8_14_A_R2 PHASE_1/2/3
 * Exercises the ACTUAL getChallengeEvent path: _ensurePlan must call
 * recoverLegacyPlan for records with answered history, preserving the answered
 * prefix exactly, never re-serving answered events, refusing UNRECOVERABLE.
 */
const path = require('path')
const { makeDb, seed, stubCloud, makeBank } = require('./_harness.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const FN = path.join(__dirname, '../../cloudfunctions/getChallengeEvent/index.js')
function loadFn (db, openid) {
  const restore = stubCloud(openid || 'u', db)
  delete require.cache[require.resolve(FN)]
  return { main: require(FN).main, restore }
}
function ctxProfile (db, occ) { if (occ) seed(db, 'user_profiles', { openid: 'u', occupation: occ }) }

async function main () {
  console.log('RC8_14_A_R2 — LEGACY RECOVERY WIRING (real getChallengeEvent)')

  // 1) active legacy record with answers → served event is NOT an answered one,
  //    and the PERSISTED plan preserves the answered prefix exactly.
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    const answered = [ids[4], ids[9], ids[2]] // deliberately non-builder order
    seed(db, 'challenge_records', {
      recordId: 'CRL1', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false,
      currentEventIndex: 3, choices: answered.map((id) => ({ eventId: id, choice: 'A' })),
      scores: { systemThinking: 61 }, rawScores: { systemThinking: 21 },
    })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CRL1' })
    restore()
    ok(r.code === 0 && !r.data.finished, 'served an event (resume)')
    ok(!answered.includes(r.data.eventId), 'served event is NOT one of the answered events')
    const rec = db._store.challenge_records.find((x) => x.recordId === 'CRL1')
    ok(rec.plan && rec.plan.eventIds.length === 30, 'plan persisted (30)')
    ok(JSON.stringify(rec.plan.eventIds.slice(0, 3)) === JSON.stringify(answered), 'answered prefix preserved EXACTLY')
    ok(new Set(rec.plan.eventIds).size === 30, 'persisted plan has 30 distinct')
    ok(rec.plan.source === 'legacy_recovery_v1', 'plan tagged legacy_recovery_v1')
    ok(r.data.eventId === rec.plan.eventIds[3], 'served event == plan[3] (index-aligned)')
    // history + scores untouched
    ok(JSON.stringify(rec.choices.map((c) => c.eventId)) === JSON.stringify(answered), 'choices history unchanged')
    ok(rec.scores.systemThinking === 61 && rec.rawScores.systemThinking === 21, 'scores/rawScores unchanged')
  }

  // 2) answered prefix preserved for a paid legacy record at a larger index,
  //    and NO future event intersects the answered set.
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    const answered = [ids[1], ids[3], ids[5], ids[7], ids[11], ids[13], ids[17]] // 7 answered
    seed(db, 'challenge_records', {
      recordId: 'CRL2', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, unlocked: true,
      currentEventIndex: 7, choices: answered.map((id) => ({ eventId: id, choice: 'B' })),
    })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CRL2' })
    restore()
    ok(r.code === 0 && !r.data.finished, 'paid legacy served')
    const rec = db._store.challenge_records.find((x) => x.recordId === 'CRL2')
    const prefix = rec.plan.eventIds.slice(0, 7)
    ok(JSON.stringify(prefix) === JSON.stringify(answered), '7-event answered prefix preserved exactly')
    const tail = rec.plan.eventIds.slice(7)
    ok(tail.every((id) => !answered.includes(id)), 'NO future event intersects the answered events')
    ok(new Set(rec.plan.eventIds).size === 30, 'still 30 distinct')
  }

  // 3) duplicate answered history → explicit UNRECOVERABLE, no re-serve, no overwrite
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const ids = makeBank(30).map((e) => e.eventId)
    seed(db, 'challenge_records', {
      recordId: 'CRU', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false,
      currentEventIndex: 2, choices: [{ eventId: ids[0], choice: 'A' }, { eventId: ids[0], choice: 'B' }],
    })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CRU' })
    restore()
    ok(r.code !== 0, 'ambiguous duplicate history → non-success')
    ok(r.data && r.data.code === 'LEGACY_PLAN_UNRECOVERABLE', 'explicit LEGACY_PLAN_UNRECOVERABLE')
    const rec = db._store.challenge_records.find((x) => x.recordId === 'CRU')
    ok(!rec.plan, 'no plan written on unrecoverable')
    ok(rec.choices.length === 2, 'history not mutated')
  }

  // 4) finished historical record → returned finished, NO plan added, untouched
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const snap = {
      recordId: 'CRF', openid: 'u', mode: 'challenge', status: 'finished', currentEventIndex: 30, currentDay: 31,
      trialMode: false, finalType: 'system_thinker',
      choices: [{ eventId: 'CE001', choice: 'A' }, { eventId: 'CE029', choice: 'B' }, { eventId: 'CE029', choice: 'A' }],
      scores: { systemThinking: 78 }, rawScores: { systemThinking: 40 },
    }
    seed(db, 'challenge_records', JSON.parse(JSON.stringify(snap)))
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CRF' })
    restore()
    ok(r.code === 0 && r.data.finished === true, 'finished returns finished')
    const rec = db._store.challenge_records.find((x) => x.recordId === 'CRF')
    ok(!rec.plan, 'finished record NOT given a plan')
    ok(JSON.stringify(rec.choices) === JSON.stringify(snap.choices), 'finished choices unchanged (incl. duplicates)')
    ok(rec.currentDay === 31 && rec.finalType === 'system_thinker', 'finish fields unchanged')
  }

  // 5) AI-report idempotency: finished record cannot be re-driven
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    seed(db, 'challenge_records', { recordId: 'CRI', openid: 'u', mode: 'challenge', status: 'finished', currentEventIndex: 30, trialMode: false, choices: [] })
    const { main: fn, restore } = loadFn(db)
    const a = await fn({ recordId: 'CRI' })
    const b = await fn({ recordId: 'CRI' })
    restore()
    ok(a.data.finished === true && b.data.finished === true, 'repeated finished reads stay finished (idempotent)')
    const rec = db._store.challenge_records.find((x) => x.recordId === 'CRI')
    ok(!rec.plan && rec.status === 'finished', 'no plan / no state change on finished')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
