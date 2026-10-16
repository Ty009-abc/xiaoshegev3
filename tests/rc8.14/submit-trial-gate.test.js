'use strict'
/**
 * tests/rc8.14/submit-trial-gate.test.js — RC8_14_D12_R6A submit-side free-trial gate.
 *
 * Engine level (REAL cloudfunction code + in-memory CloudBase-like DB from _harness).
 * Verifies the new submit-side paywall that closes the free-trial bypass:
 *   - free (trialMode) submits at idx 0,1,2 succeed
 *   - free idx3 submit DENIED (NEED_PAYMENT) with ZERO writes (no score, no profile, no index move)
 *   - paid (trialMode:false) idx3+ submit succeeds (existing paid path preserved)
 *   - entitlement read failure ⇒ fail-closed (deny)
 *   - client-forged membership/openid fields are ignored (server identity only)
 *   - cross-user ownership rejected
 *   - idempotent / conflict / CAS semantics preserved
 */
const path = require('path')
const { makeDb, seed, stubCloud, makeBank } = require('./_harness.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const SC = path.join(__dirname, '../../cloudfunctions/submitChallengeChoice/index.js')
function load (db, openid) {
  const restore = stubCloud(openid || 'u', db)
  delete require.cache[require.resolve(SC)]
  return { main: require(SC).main, restore }
}
function planOf (ids) {
  return { planVersion: 'rc8.14_v1', challengeLength: ids.length, eventBankVersion: 'bank_x', eventIds: ids.slice(), createdAt: 1, source: 'personalized_v1' }
}
function bankInto (db, n) { const b = makeBank(n); for (const e of b) seed(db, 'challenge_events', e); return b }
const rec = (db, rid) => db._store.challenge_records.find((x) => x.recordId === rid)
const snap = (o) => JSON.stringify(o)
async function run (db, openid, args) { const { main: fn, restore } = load(db, openid); try { return await fn(args) } finally { restore() } }

async function main () {
  console.log('RC8_14_D12_R6A — SUBMIT-SIDE FREE-TRIAL GATE (engine level)')

  // ── 1) free idx0 / idx1 / idx2 succeed ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'R0', recordId: 'R0', openid: 'u', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 0, choices: [], plan: planOf(ids) })
    const a = await run(db, 'u', { recordId: 'R0', eventId: ids[0], choiceKey: 'A' })
    const b = await run(db, 'u', { recordId: 'R0', eventId: ids[1], choiceKey: 'A' })
    const c = await run(db, 'u', { recordId: 'R0', eventId: ids[2], choiceKey: 'B' })
    ok(a.code === 0 && a.data.currentEventIndex === 1, 'free idx0 submit succeeds → idx1')
    ok(b.code === 0 && b.data.currentEventIndex === 2, 'free idx1 submit succeeds → idx2')
    ok(c.code === 0 && c.data.currentEventIndex === 3, 'free idx2 submit succeeds → idx3')
    ok(rec(db, 'R0').choices.length === 3, 'three free choices recorded')
  }

  // ── 2) free idx3 VALID eventId → DENIED, zero writes ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'R3', recordId: 'R3', openid: 'u', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 3, choices: [{ eventId: ids[0], choice: 'A' }, { eventId: ids[1], choice: 'A' }, { eventId: ids[2], choice: 'A' }], rawScores: { systemThinking: 15, longTermism: 12 }, tags: ['t1'], plan: planOf(ids) })
    seed(db, 'user_profiles', { _id: 'P3', openid: 'u', systemThinking: 60, updatedAt: 111 })
    const beforeRec = snap(rec(db, 'R3'))
    const beforeProf = snap(db._store.user_profiles.find((p) => p.openid === 'u'))
    const r = await run(db, 'u', { recordId: 'R3', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 1002, 'free idx3 valid eventId → NEED_PAYMENT(1002)')
    ok(r.data && r.data.needPayment === true && r.data.locked === true, 'denial payload marked needPayment/locked')
    ok(r.data && r.data.code === 'TRIAL_BOUNDARY_REACHED', 'denial payload code TRIAL_BOUNDARY_REACHED')
    ok(snap(rec(db, 'R3')) === beforeRec, 'ZERO record writes on denial (scores/choices/index unchanged)')
    ok(snap(db._store.user_profiles.find((p) => p.openid === 'u')) === beforeProf, 'ZERO profile writes on denial')
  }

  // ── 3) free idx3 GUESSED (future) eventId → still DENIED (gate precedes plan guard) ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'R3b', recordId: 'R3b', openid: 'u', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 3, choices: [], plan: planOf(ids) })
    const before = snap(rec(db, 'R3b'))
    const r = await run(db, 'u', { recordId: 'R3b', eventId: ids[10], choiceKey: 'C' })
    ok(r.code === 1002, 'free idx3 guessed/future eventId → NEED_PAYMENT(1002)')
    ok(snap(rec(db, 'R3b')) === before, 'ZERO writes on guessed-event denial')
  }

  // ── 4) free idx3 REPEATED denials → stable, no state drift, no new record ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'R3c', recordId: 'R3c', openid: 'u', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 3, choices: [], plan: planOf(ids) })
    const n0 = db._store.challenge_records.length
    const r1 = await run(db, 'u', { recordId: 'R3c', eventId: ids[3], choiceKey: 'A' })
    const r2 = await run(db, 'u', { recordId: 'R3c', eventId: ids[3], choiceKey: 'A' })
    const r3 = await run(db, 'u', { recordId: 'R3c', eventId: ids[4], choiceKey: 'B' })
    ok([r1, r2, r3].every((x) => x.code === 1002), 'repeated denials all NEED_PAYMENT')
    ok(db._store.challenge_records.length === n0, 'no new/reset trial record created on denial')
  }

  // ── 5) paid (trialMode:false) idx3 valid submit succeeds ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'P3', recordId: 'P3', openid: 'u', mode: 'challenge', trialMode: false, unlocked: true, status: 'processing', currentEventIndex: 3, choices: [], plan: planOf(ids) })
    const r = await run(db, 'u', { recordId: 'P3', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 0 && r.data.currentEventIndex === 4, 'paid idx3 valid submit succeeds → idx4 (paid path preserved)')
  }

  // ── 6) paid user (trialMode:true) WITH challenge_full entitlement → idx3 allowed ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'E3', recordId: 'E3', openid: 'u', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 3, choices: [], plan: planOf(ids) })
    seed(db, 'entitlements', { _id: 'ENT1', openid: 'u', permissions: ['challenge_full'], sources: [{ productId: 'challenge_39_9' }] })
    const r = await run(db, 'u', { recordId: 'E3', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 0 && r.data.currentEventIndex === 4, 'entitled user (challenge_full) allowed past idx3')
  }

  // ── 7) expired/downgraded entitlement (permissions lack challenge_full) → DENIED ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'X3', recordId: 'X3', openid: 'u', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 3, choices: [], plan: planOf(ids) })
    seed(db, 'entitlements', { _id: 'ENTX', openid: 'u', permissions: ['full_report'], sources: [{ productId: 'challenge_39_9', expiresAt: 1 }] })
    const before = snap(rec(db, 'X3'))
    const r = await run(db, 'u', { recordId: 'X3', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 1002, 'downgraded/expired entitlement → DENIED(1002)')
    ok(snap(rec(db, 'X3')) === before, 'no write on expired-entitlement denial')
  }

  // ── 8) entitlement lookup FAILURE → fail-closed (deny) ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'F3', recordId: 'F3', openid: 'u', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 3, choices: [], plan: planOf(ids) })
    const badDb = Object.assign({}, db, { collection: (n) => { if (n === 'entitlements') throw new Error('entitlements unavailable'); return db.collection(n) } })
    const r = await run(badDb, 'u', { recordId: 'F3', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 1002, 'entitlement read failure → fail-closed DENY(1002)')
  }

  // ── 9) client-forged membership/openid/counters ignored ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'G3', recordId: 'G3', openid: 'u', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 3, choices: [], plan: planOf(ids) })
    const before = snap(rec(db, 'G3'))
    const r = await run(db, 'u', { recordId: 'G3', eventId: ids[3], choiceKey: 'A', membershipLevel: 'vip', challenge_full: true, trialCount: 0, unlocked: true, openid: 'attacker', openId: 'attacker' })
    ok(r.code === 1002, 'client-forged membership/entitlement/openid fields ignored → DENIED')
    ok(snap(rec(db, 'G3')) === before, 'no write on forged-client denial')
  }

  // ── 10) different openid ownership rejected (id ownership guard intact) ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'O1', recordId: 'O1', openid: 'ua', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 0, choices: [], plan: planOf(ids) })
    const before = snap(rec(db, 'O1'))
    const r = await run(db, 'ub', { recordId: 'O1', eventId: ids[0], choiceKey: 'A' })
    ok(r.code === 404, 'other-user ownership rejected → NOT_FOUND(404)')
    ok(snap(rec(db, 'O1')) === before, 'no cross-user write')
  }

  // ── 11) duplicate identical retry → idempotent, no double score (free idx<3) ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'D1', recordId: 'D1', openid: 'u', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 0, choices: [], plan: planOf(ids) })
    const a = await run(db, 'u', { recordId: 'D1', eventId: ids[0], choiceKey: 'A' })
    const b = await run(db, 'u', { recordId: 'D1', eventId: ids[0], choiceKey: 'A' })
    ok(a.code === 0 && b.code === 0 && b.data.idempotent === true, 'duplicate identical retry idempotent')
    ok(rec(db, 'D1').choices.length === 1 && rec(db, 'D1').currentEventIndex === 1, 'no double score on retry')
  }

  // ── 12) different-choice conflict remains 409 (free idx<3) ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'C1', recordId: 'C1', openid: 'u', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 0, choices: [], plan: planOf(ids) })
    await run(db, 'u', { recordId: 'C1', eventId: ids[0], choiceKey: 'A' })
    const r = await run(db, 'u', { recordId: 'C1', eventId: ids[0], choiceKey: 'B' })
    ok(r.code === 409 && r.data.conflict === true, 'different-choice conflict → 409')
  }

  // ── 13) two submissions racing at idx2 → advance at most once ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'RC2', recordId: 'RC2', openid: 'u', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 2, choices: [{ eventId: ids[0], choice: 'A' }, { eventId: ids[1], choice: 'A' }], plan: planOf(ids) })
    const res = await Promise.all([
      run(db, 'u', { recordId: 'RC2', eventId: ids[2], choiceKey: 'A' }),
      run(db, 'u', { recordId: 'RC2', eventId: ids[2], choiceKey: 'B' }),
    ])
    const r = rec(db, 'RC2')
    ok(r.currentEventIndex === 3, 'racing at idx2 advances at most once (idx=3)')
    ok(r.choices.filter((c) => c.eventId === ids[2]).length === 1, 'exactly one choice recorded for the raced event')
    ok(res.filter((x) => x.code === 0 && !x.data.duplicate).length === 1, 'exactly one winner')
    ok(res.some((x) => x.code === 409), 'loser got CONFLICT(409)')
  }

  // ── 14) legacy plan (trialMode:false owned) at idx3+ allowed; legacy no-plan free idx0 allowed ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'L1', recordId: 'L1', openid: 'u', mode: 'challenge', trialMode: false, status: 'processing', currentEventIndex: 5, choices: [], plan: planOf(ids) })
    const paid = await run(db, 'u', { recordId: 'L1', eventId: ids[5], choiceKey: 'A' })
    ok(paid.code === 0 && paid.data.currentEventIndex === 6, 'legacy owned (trialMode:false) idx5 allowed (no regression)')
    seed(db, 'challenge_records', { _id: 'L2', recordId: 'L2', openid: 'u2', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 0, choices: [] })
    const legacyFree = await run(db, 'u2', { recordId: 'L2', eventId: ids[0], choiceKey: 'A' })
    ok(legacyFree.code === 0, 'legacy free record (no plan) idx0 allowed')
  }

  // ── 15) R6C: stale cached permissions with an EXPIRED source no longer authorize ──
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { _id: 'T1', recordId: 'T1', openid: 'u', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 3, choices: [], plan: planOf(ids) })
    seed(db, 'entitlements', { _id: 'ENTT', openid: 'u', permissions: ['challenge_full'], sources: [{ productId: 'challenge_39_9', expiresAt: 1 }] })
    const before = snap(rec(db, 'T1'))
    const r = await run(db, 'u', { recordId: 'T1', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 1002, 'R6C: stale cached permissions with EXPIRED source → DENIED(1002) (bypass closed)')
    ok(snap(rec(db, 'T1')) === before, 'R6C: no write on expired-source denial')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
