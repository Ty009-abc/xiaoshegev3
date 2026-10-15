'use strict'
/**
 * tests/rc8.14/trial-resume-atomic.test.js — RC8_14_D12
 * Trial resume + atomic active-session authority.
 *
 * Level: MOCK_TEST (in-memory harness). Exercises the REAL startChallenge
 * cloud function with a stub wx-server-sdk. No network, no real DB.
 *
 * Covers: first trial, idx0/1/2 resume, idx3 need_payment (no new record),
 * sequential repeat, 8× simultaneous start (single recordId), response-loss
 * retry, claim steal after crash/expiry, stale-owner fencing, record-creation
 * failure, claim-finalization failure, concurrent start+submit, multiple
 * historical trials, malformed plan, inconsistent idx/choices, active paid
 * record, expired membership, trial→paid, cross-user isolation, replay
 * regression, Day-30 completion, and preservation invariants.
 */
const path = require('path')
const AS = require(path.join(__dirname, '../../cloudfunctions/startChallenge/lib/activeSession.js'))
const { makeDb, seed, stubCloud, makeBank } = require('./_harness.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const FN = path.join(__dirname, '../../cloudfunctions/startChallenge/index.js')
function load (db, openid) {
  const restore = stubCloud(openid || 'u', db)
  delete require.cache[require.resolve(FN)]
  return { main: require(FN).main, restore }
}
function planOf (ids) {
  return { planVersion: 'rc8.14_v1', challengeLength: ids.length, eventBankVersion: 'bank_x', eventIds: ids.slice(), createdAt: 1, source: 'personalized_v1' }
}
function bankIds () { return makeBank(30).map((e) => e.eventId) }
function seedBank (db) { for (const e of makeBank(30)) seed(db, 'challenge_events', e) }
function cnt (db, n) { return (db._store[n] || []).length }
const recs = (db) => (db._store.challenge_records || [])

async function main () {
  console.log('RC8_14_D12 — TRIAL RESUME + ATOMIC ACTIVE-SESSION')

  // 1) first trial start (fresh user) → creates exactly one trial record
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code === 0 && r.data.trialMode === true && r.data.trialLimit === 3, 'first trial: trialMode + trialLimit=3')
    ok(r.data.currentEventIndex === 0 && typeof r.data.recordId === 'string', 'first trial: idx0 + recordId')
    ok(cnt(db, 'challenge_records') === 1, 'first trial: exactly one record created')
    const s = (db._store.challenge_active || [])[0]
    ok(s && s.state === 'READY' && s.recordId === r.data.recordId, 'first trial: active session READY → recordId')
  }

  // 2) idx0 resume → same recordId, no new record, progress preserved
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const ids = bankIds()
    seed(db, 'challenge_records', { recordId: 'CR0', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 0, choices: [], plan: planOf(ids), rawScores: { systemThinking: 7 }, createdAt: 111, updatedAt: 222 })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code === 0 && r.data.resumed === true && r.data.recordId === 'CR0', 'idx0 resume: same recordId')
    ok(cnt(db, 'challenge_records') === 1, 'idx0 resume: no new record')
    const rec = recs(db).find((x) => x.recordId === 'CR0')
    ok(rec.rawScores.systemThinking === 7 && rec.createdAt === 111, 'idx0 resume: scores + createdAt preserved')
  }

  // 3) idx1 / idx2 resume
  for (const idx of [1, 2]) {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const ids = bankIds()
    seed(db, 'challenge_records', { recordId: 'CR' + idx, openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: idx, choices: ids.slice(0, idx).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(ids), createdAt: 1, updatedAt: 1 })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code === 0 && r.data.recordId === 'CR' + idx && r.data.currentEventIndex === idx, 'idx' + idx + ' resume: same record at idx ' + idx)
    ok(cnt(db, 'challenge_records') === 1, 'idx' + idx + ' resume: no new record')
  }

  // 4) idx3 → payment boundary, NO new record
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const ids = bankIds()
    seed(db, 'challenge_records', { recordId: 'CR3', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 3, choices: ids.slice(0, 3).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(ids), createdAt: 1, updatedAt: 1 })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code === 0 && r.data.needPayment === true && r.data.locked === true, 'idx3: payment boundary returned')
    ok(r.data.recordId === 'CR3' && cnt(db, 'challenge_records') === 1, 'idx3: same record, no new free trial created')
  }

  // 5) sequential repeated start → same recordId, one record
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    let { main: fn, restore } = load(db, 'uA')
    const r1 = await fn({}); restore()
    ;({ main: fn, restore } = load(db, 'uA'))
    const r2 = await fn({}); restore()
    ;({ main: fn, restore } = load(db, 'uA'))
    const r3 = await fn({}); restore()
    ok(r1.data.recordId === r2.data.recordId && r2.data.recordId === r3.data.recordId, 'sequential start: stable recordId')
    ok(cnt(db, 'challenge_records') === 1, 'sequential start: exactly one record after 3 calls')
  }

  // 6) eight simultaneous start requests → exactly ONE record, all same recordId
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const { main: fn, restore } = load(db, 'uA')
    const results = await Promise.all(Array.from({ length: 8 }, () => fn({})))
    restore()
    const okRes = results.filter((r) => r.code === 0)
    const ids = new Set(okRes.map((r) => r.data.recordId))
    ok(okRes.length >= 1, '8× start: at least one success')
    ok(ids.size === 1, '8× start: all successful responses share ONE recordId')
    ok(cnt(db, 'challenge_records') === 1, '8× start: exactly ONE record created (no duplicates)')
  }

  // 7) response loss then retry → resumes, does not create a second record
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    let { main: fn, restore } = load(db, 'uA')
    const r1 = await fn({}); restore()
    // simulate the client never receiving r1, then retrying
    ;({ main: fn, restore } = load(db, 'uA'))
    const r2 = await fn({}); restore()
    ok(r1.data.recordId === r2.data.recordId && cnt(db, 'challenge_records') === 1, 'response-loss retry: converged, no duplicate')
  }

  // 8) claim creator crash + expiration recovery → stale CLAIMING is stolen
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    seed(db, 'challenge_active', { _id: 'uA', ownerToken: 'tok_dead', state: 'CLAIMING', recordId: null, claimedAt: 1, readyAt: null, expiresAt: 2 }) // long expired
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code === 0 && typeof r.data.recordId === 'string', 'stale CLAIMING: start succeeds')
    const s = (db._store.challenge_active || [])[0]
    ok(s.state === 'READY' && s.recordId === r.data.recordId && s.ownerToken !== 'tok_dead', 'stale CLAIMING: stolen + marked READY by new owner')
    ok(cnt(db, 'challenge_records') === 1, 'stale CLAIMING: one record created')
  }

  // 9) stale-owner fencing → old owner cannot finalize after takeover
  {
    const db = makeDb(); seedBank(db)
    seed(db, 'challenge_active', { _id: 'uA', ownerToken: 'tok_old', state: 'CLAIMING', recordId: null, claimedAt: 1, readyAt: null, expiresAt: 5 })
    const cl = await AS.claim({ db, openid: 'uA', now: 100 }) // steals (expired)
    ok(cl.won && cl.token !== 'tok_old', 'fencing: new claimant acquired the stale claim')
    const bad = await AS.markReady({ db, openid: 'uA', token: 'tok_old', recordId: 'CR_old', now: 101 })
    ok(bad.won === false, 'fencing: OLD token markReady refused (CAS on ownerToken)')
    const good = await AS.markReady({ db, openid: 'uA', token: cl.token, recordId: 'CR_new', now: 102 })
    ok(good.won === true, 'fencing: NEW token markReady wins')
    const s = (db._store.challenge_active || [])[0]
    ok(s.recordId === 'CR_new', 'fencing: session points to the new owner record')
  }

  // 10) record creation failure → claim released (stealable), fail returned
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const orig = db.collection.bind(db)
    db.collection = (name) => {
      const c = orig(name)
      if (name === 'challenge_records') c.add = async () => { throw new Error('simulated add failure') }
      return c
    }
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code !== 0, 'creation failure: non-zero code returned')
    const s = (db._store.challenge_active || [])[0]
    ok(s && s.state === 'CLAIMING' && s.expiresAt === 0, 'creation failure: claim released (expiresAt=0 → stealable)')
    ok(cnt(db, 'challenge_records') === 0, 'creation failure: no record persisted')
  }

  // 11) claim finalization failure → NO false success, NO orphan (R2.3 rollback)
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const orig = db.collection.bind(db)
    db.collection = (name) => {
      const c = orig(name)
      if (name === 'challenge_active') {
        const ow = c.where.bind(c)
        c.where = (q) => { const ch = ow(q); ch.update = async () => ({ stats: { updated: 0 } }); return ch }
      }
      return c
    }
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code !== 0, 'finalization failure: NO false successful recordId')
    ok(cnt(db, 'challenge_records') === 0, 'finalization failure: unconfirmed record rolled back (no orphan)')
  }

  // 12) concurrent start + submit on same record → no duplicate, submit advances once
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const ids = bankIds()
    let { main: fn, restore } = load(db, 'uA')
    const r0 = await fn({}); restore()
    const rid = r0.data.recordId
    const SC = path.join(__dirname, '../../cloudfunctions/submitChallengeChoice/index.js')
    const rSubmit = (function () { const rs = stubCloud('uA', db); delete require.cache[require.resolve(SC)]; return { main: require(SC).main, restore: rs } })()
    ;({ main: fn, restore } = load(db, 'uA'))
    const [rStart, rSub] = await Promise.all([fn({}), rSubmit.main({ recordId: rid, eventId: ids[0], choiceKey: 'A' })])
    rSubmit.restore(); restore()
    ok(rStart.code === 0 && rStart.data.recordId === rid, 'start+submit: start resumes same record')
    const rec = recs(db).find((x) => x.recordId === rid)
    ok(rec && rec.currentEventIndex === 1 && rec.choices.length === 1, 'start+submit: submit advanced idx exactly once')
    ok(cnt(db, 'challenge_records') === 1, 'start+submit: no duplicate record')
  }

  // 13) multiple historical trials → deterministic max-index selection
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const ids = bankIds()
    seed(db, 'challenge_records', { recordId: 'CRa', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 0, choices: [], plan: planOf(ids), createdAt: 10, updatedAt: 10 })
    seed(db, 'challenge_records', { recordId: 'CRb', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 2, choices: ids.slice(0, 2).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(ids), createdAt: 20, updatedAt: 20 })
    seed(db, 'challenge_records', { recordId: 'CRc', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 1, choices: ids.slice(0, 1).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(ids), createdAt: 30, updatedAt: 30 })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.data.recordId === 'CRb', 'multiple trials: selects highest currentEventIndex (CRb idx2)')
    ok(cnt(db, 'challenge_records') === 3, 'multiple trials: no records created/deleted')
  }

  // 14) malformed plan (only) → UNRECOVERABLE, no new trial
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    seed(db, 'challenge_records', { recordId: 'CRbad', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 0, choices: [], plan: { planVersion: 'rc8.14_v1', challengeLength: 5, eventBankVersion: 'bank_x', eventIds: ['CE001', 'CE002'] }, createdAt: 1, updatedAt: 1 })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code !== 0, 'malformed plan: refused (non-zero)')
    ok(cnt(db, 'challenge_records') === 1, 'malformed plan: NO new trial created')
  }

  // 15) inconsistent choices vs index → UNRECOVERABLE
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const ids = bankIds()
    seed(db, 'challenge_records', { recordId: 'CRinc', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 2, choices: [{ eventId: ids[0], choice: 'A' }], plan: planOf(ids), createdAt: 1, updatedAt: 1 })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code !== 0, 'inconsistent idx/choices: refused')
    ok(cnt(db, 'challenge_records') === 1, 'inconsistent idx/choices: no new record')
  }

  // 16) active PAID record → owned-record precedence resume (no trial)
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const ids = bankIds()
    seed(db, 'challenge_records', { recordId: 'CRpaid', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 4, choices: ids.slice(0, 4).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(ids), createdAt: 1, updatedAt: 1 })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code === 0 && r.data.recordId === 'CRpaid' && r.data.trialMode === false, 'paid active: resumed owned record (no trial)')
    ok(cnt(db, 'challenge_records') === 1, 'paid active: no new trial created')
  }

  // 17) expired membership + free → resumes trial (no re-lock, no escalation)
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const ids = bankIds()
    seed(db, 'memberships', { openid: 'uA', status: 'active', permissions: ['challenge_full'], expiredAt: 1 })
    seed(db, 'challenge_records', { recordId: 'CRt', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 1, choices: ids.slice(0, 1).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(ids), createdAt: 1, updatedAt: 1 })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code === 0 && r.data.recordId === 'CRt' && r.data.trialMode === true, 'expired membership: resumes trial (no paid escalation)')
    ok(cnt(db, 'challenge_records') === 1, 'expired membership: no new record')
  }

  // 18) trial → paid transition → new entitled record; trial history preserved
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const ids = bankIds()
    seed(db, 'entitlements', { openid: 'uA', permissions: ['challenge_full'], sources: [] })
    seed(db, 'challenge_records', { recordId: 'CRt', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 2, choices: ids.slice(0, 2).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(ids), createdAt: 1, updatedAt: 1 })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code === 0 && r.data.trialMode === false && r.data.unlocked === true, 'trial→paid: new entitled record (trialMode=false, unlocked)')
    ok(r.data.recordId !== 'CRt', 'trial→paid: distinct new recordId')
    ok(recs(db).find((x) => x.recordId === 'CRt').currentEventIndex === 2, 'trial→paid: old trial history preserved')
    ok(cnt(db, 'challenge_records') === 2, 'trial→paid: exactly one new record')
  }

  // 19) cross-user isolation → distinct records, distinct sessions
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' }); seed(db, 'users', { openid: 'uB' })
    let { main: fnA, restore: rA } = load(db, 'uA')
    const a = await fnA({}); rA()
    let { main: fnB, restore: rB } = load(db, 'uB')
    const b = await fnB({}); rB()
    ok(a.data.recordId !== b.data.recordId, 'cross-user: distinct recordIds')
    ok(cnt(db, 'challenge_records') === 2 && cnt(db, 'challenge_active') === 2, 'cross-user: 2 records + 2 sessions (isolated)')
  }

  // 20) replay branch regression → explicit new entitled round (idempotent)
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    seed(db, 'entitlements', { openid: 'uA', permissions: ['challenge_full'], sources: [] })
    let { main: fn, restore } = load(db, 'uA')
    const r1 = await fn({ replay: true, replayRequestId: 'RID1' }); restore()
    ;({ main: fn, restore } = load(db, 'uA'))
    const r2 = await fn({ replay: true, replayRequestId: 'RID1' }); restore()
    ok(r1.code === 0 && r1.data.replay === true && r1.data.trialMode === false, 'replay: creates entitled round')
    ok(r2.data.idempotent === true && r2.data.recordId === r1.data.recordId, 'replay: idempotent by replayRequestId')
    ok(cnt(db, 'challenge_records') === 1, 'replay: no duplicate for same replayRequestId')
  }

  // 21) replay denied without entitlement (fail-closed) — regression
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({ replay: true, replayRequestId: 'RID2' })
    restore()
    ok(r.code !== 0, 'replay: denied without entitlement (fail-closed)')
    ok(cnt(db, 'challenge_records') === 0, 'replay: no record created when denied')
  }

  // 22) Day-30 completion compatibility → finished owned record routes to result
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const ids = bankIds()
    seed(db, 'challenge_records', { recordId: 'CRfin', openid: 'uA', mode: 'challenge', status: 'finished', trialMode: false, currentEventIndex: 30, choices: ids.map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(ids), finalType: 'longtermist', createdAt: 1, updatedAt: 1 })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code === 0 && r.data.completed === true && r.data.destination === 'challenge_result', 'Day30: finished record → result route')
    ok(cnt(db, 'challenge_records') === 1, 'Day30: no new record on completion')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
