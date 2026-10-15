'use strict'
/**
 * tests/rc8.14/active-session-authority.test.js — RC8_14_D12_R2_2
 * Adversarial tests for the P0 fix: challenge_active READY is the SINGLE
 * authority for a user's active challenge; a fresh create must never replace a
 * valid READY session, and a challenge_records list scan miss must never create
 * a duplicate.
 *
 * Level: MOCK_TEST (in-memory harness). The harness implements real SDK
 * semantics: explicit-`_id` unique insert (throws E11000), conditional update
 * returning stats.updated, doc.set upsert, remove.
 */
const path = require('path')
const AS = require(path.join(__dirname, '../../cloudfunctions/startChallenge/lib/activeSession.js'))
const { makeDb, seed, stubCloud, makeBank } = require('./_harness.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const FN = path.join(__dirname, '../../cloudfunctions/startChallenge/index.js')
function load (db, openid) {
  const restore = stubCloud(openid || 'uA', db)
  delete require.cache[require.resolve(FN)]
  return { main: require(FN).main, restore }
}
function planOf (ids) {
  return { planVersion: 'rc8.14_v1', challengeLength: ids.length, eventBankVersion: 'bank_x', eventIds: ids.slice(), createdAt: 1, source: 'personalized_v1' }
}
function ids () { return makeBank(30).map((e) => e.eventId) }
function seedBank (db) { for (const e of makeBank(30)) seed(db, 'challenge_events', e) }
const cnt = (db, n) => (db._store[n] || []).length
const recs = (db) => (db._store.challenge_records || [])

// Instrument the trial-scan (trialMode:true) so a "scan miss" can be injected
// and its invocation counted. Returns restore().
function hookTrialScan (db, behavior) {
  const orig = db.collection.bind(db)
  let calls = 0
  db.collection = (name) => {
    const c = orig(name)
    if (name !== 'challenge_records') return c
    const ow = c.where.bind(c)
    c.where = (q) => {
      const ch = ow(q)
      const isTrialScan = q && q.mode === 'challenge' && q.trialMode === true && q.status && q.status.__op === 'neq'
      if (isTrialScan) {
        const og = ch.get.bind(ch)
        ch.get = async () => { calls++; if (behavior === 'miss') return { data: [] }; return og() }
      }
      return ch
    }
    return c
  }
  return { calls: () => calls, restore: () => { db.collection = orig } }
}

async function main () {
  console.log('RC8_14_D12_R2_2 — ACTIVE-SESSION AUTHORITY (READY is authoritative)')

  // 1) B1 deterministic repro: READY valid + trial scan miss → ONE record (was 2)
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const R = ids()
    seed(db, 'challenge_records', { recordId: 'CR_A', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 0, choices: [], plan: planOf(R), createdAt: 1, updatedAt: 1 })
    seed(db, 'challenge_active', { _id: 'uA', ownerToken: 'tok_A', state: 'READY', recordId: 'CR_A', readyAt: 1, expiresAt: null })
    const hook = hookTrialScan(db, 'miss')
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore(); hook.restore()
    ok(r.code === 0 && r.data.recordId === 'CR_A', 'B1: resumes authoritative READY recordId (not a new one)')
    ok(cnt(db, 'challenge_records') === 1, 'B1: NO duplicate created (1 record) — pre-fix produced 2')
    ok(hook.calls() === 0, 'B1: trial scan never consulted when READY is valid')
  }

  // 2) READY valid + concurrent start → all converge, ONE record
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const R = ids()
    seed(db, 'challenge_records', { recordId: 'CR_A', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 1, choices: R.slice(0, 1).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(R), createdAt: 1, updatedAt: 1 })
    seed(db, 'challenge_active', { _id: 'uA', ownerToken: 'tok_A', state: 'READY', recordId: 'CR_A', readyAt: 1, expiresAt: null })
    const { main: fn, restore } = load(db, 'uA')
    const res = await Promise.all(Array.from({ length: 6 }, () => fn({})))
    restore()
    ok(res.every((x) => x.code === 0 && x.data.recordId === 'CR_A'), 'READY+concurrent: all responses share READY recordId')
    ok(cnt(db, 'challenge_records') === 1, 'READY+concurrent: exactly ONE record')
  }

  // 3) READY valid + different candidate present → READY wins (not reselected)
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const R = ids()
    seed(db, 'challenge_records', { recordId: 'CR_higher', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 2, choices: R.slice(0, 2).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(R), createdAt: 9, updatedAt: 9 })
    seed(db, 'challenge_records', { recordId: 'CR_ready', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 0, choices: [], plan: planOf(R), createdAt: 1, updatedAt: 1 })
    seed(db, 'challenge_active', { _id: 'uA', ownerToken: 'tok_A', state: 'READY', recordId: 'CR_ready', readyAt: 1, expiresAt: null })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.data.recordId === 'CR_ready', 'READY authority beats a higher-index legacy candidate (no reselection)')
    ok(cnt(db, 'challenge_records') === 2, 'READY+different candidate: no records added/removed')
  }

  // 4) READY idx3 + idx0 legacy trial → payment-gated at idx3; idx0 not reset
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const R = ids()
    seed(db, 'challenge_records', { recordId: 'CR0', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 0, choices: [], plan: planOf(R), createdAt: 1, updatedAt: 1 })
    seed(db, 'challenge_records', { recordId: 'CR3', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 3, choices: R.slice(0, 3).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(R), createdAt: 2, updatedAt: 2 })
    seed(db, 'challenge_active', { _id: 'uA', ownerToken: 'tok_A', state: 'READY', recordId: 'CR3', readyAt: 2, expiresAt: null })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.data.recordId === 'CR3' && r.data.needPayment === true, 'READY idx3 + idx0 legacy: payment-gated at idx3 (no idx0 reset)')
    ok(cnt(db, 'challenge_records') === 2, 'READY idx3: no new record created')
  }

  // 5) READY missing target → explicit CAS invalidate + exactly one safe create
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    seed(db, 'challenge_active', { _id: 'uA', ownerToken: 'tok_A', state: 'READY', recordId: 'CR_GONE', readyAt: 1, expiresAt: null })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code === 0 && typeof r.data.recordId === 'string' && r.data.recordId !== 'CR_GONE', 'READY missing: safe new record created')
    ok(cnt(db, 'challenge_records') === 1, 'READY missing: exactly ONE record (no duplicate)')
  }

  // 6) READY malformed target → fail-closed, NO new record
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    seed(db, 'challenge_records', { recordId: 'CR_BAD', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 0, choices: [], plan: { planVersion: 'rc8.14_v1', challengeLength: 5, eventBankVersion: 'bank_x', eventIds: ['CE001', 'CE002'] }, createdAt: 1, updatedAt: 1 })
    seed(db, 'challenge_active', { _id: 'uA', ownerToken: 'tok_A', state: 'READY', recordId: 'CR_BAD', readyAt: 1, expiresAt: null })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code !== 0 && r.data && r.data.code === 'LEGACY_PLAN_UNRECOVERABLE', 'READY malformed: fail-closed (UNRECOVERABLE)')
    ok(cnt(db, 'challenge_records') === 1, 'READY malformed: NO new free record')
  }

  // 7) READY finished target → result route, NO new record
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const R = ids()
    seed(db, 'challenge_records', { recordId: 'CR_FIN', openid: 'uA', mode: 'challenge', status: 'finished', trialMode: false, currentEventIndex: 30, choices: R.map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(R), finalType: 'lt', createdAt: 1, updatedAt: 1 })
    seed(db, 'challenge_active', { _id: 'uA', ownerToken: 'tok_A', state: 'READY', recordId: 'CR_FIN', readyAt: 1, expiresAt: null })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code === 0 && r.data.completed === true && r.data.destination === 'challenge_result', 'READY finished: routes result')
    ok(cnt(db, 'challenge_records') === 1, 'READY finished: NO new record')
  }

  // 8) two initial simultaneous claims (fresh user) → ONE record
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const { main: fn, restore } = load(db, 'uA')
    const res = await Promise.all([fn({}), fn({})])
    restore()
    const idsSet = new Set(res.filter((r) => r.code === 0).map((r) => r.data.recordId))
    ok(idsSet.size === 1 && cnt(db, 'challenge_records') === 1, 'two simultaneous initial claims → ONE record, one recordId')
  }

  // 9) eight simultaneous starts on a fresh entitled user → ONE record
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    seed(db, 'entitlements', { openid: 'uA', permissions: ['challenge_full'], sources: [] })
    const { main: fn, restore } = load(db, 'uA')
    const res = await Promise.all(Array.from({ length: 8 }, () => fn({})))
    restore()
    const idsSet = new Set(res.filter((r) => r.code === 0).map((r) => r.data.recordId))
    ok(idsSet.size === 1 && cnt(db, 'challenge_records') === 1, '8× entitled start → ONE record')
    const s = (db._store.challenge_active || [])[0]
    ok(s.state === 'READY' && idsSet.has(s.recordId), '8× entitled start: session READY → winner recordId')
  }

  // 10) stale creator after lease takeover → old token markReady refused
  {
    const db = makeDb(); seedBank(db)
    seed(db, 'challenge_active', { _id: 'uA', ownerToken: 'tok_old', state: 'CLAIMING', recordId: null, claimedAt: 1, readyAt: null, expiresAt: 5 })
    const cl = await AS.claim({ db, openid: 'uA', now: 100 })
    ok(cl.won && cl.mode === 'STEAL_STALE' && cl.token !== 'tok_old', 'stale takeover: new owner acquired expired CLAIMING')
    const late = await AS.markReady({ db, openid: 'uA', token: 'tok_old', recordId: 'CR_late', now: 101 })
    ok(late.won === false, 'stale creator: late markReady REFUSED (fencing)')
    const good = await AS.markReady({ db, openid: 'uA', token: cl.token, recordId: 'CR_new', now: 102 })
    ok(good.won === true, 'stale takeover: current owner markReady wins')
    ok((db._store.challenge_active || [])[0].recordId === 'CR_new', 'stale creator cannot override new authority')
  }

  // 11) failed markReady after record creation → record still returned once (no crash, no dup)
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const orig = db.collection.bind(db)
    db.collection = (name) => {
      const c = orig(name)
      if (name === 'challenge_active') { const ow = c.where.bind(c); c.where = (q) => { const ch = ow(q); ch.update = async () => ({ stats: { updated: 0 } }); return ch } }
      return c
    }
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code === 0 && typeof r.data.recordId === 'string', 'failed finalization: record still returned')
    ok(cnt(db, 'challenge_records') === 1, 'failed finalization: exactly ONE record')
  }

  // 12) response lost after record creation → retry resumes the same record
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    let { main: fn, restore } = load(db, 'uA')
    const r1 = await fn({}); restore()
    ;({ main: fn, restore } = load(db, 'uA'))
    const r2 = await fn({}); restore()
    ok(r1.data.recordId === r2.data.recordId && cnt(db, 'challenge_records') === 1, 'response lost: retry converges, no duplicate')
  }

  // 13) DB timeout with uncertain commit (add inserts then throws) → orphan reconciled, no duplicate
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const orig = db.collection.bind(db)
    let threw = false
    db.collection = (name) => {
      const c = orig(name)
      if (name === 'challenge_records' && !threw) {
        const oadd = c.add.bind(c)
        c.add = async (o) => { await oadd(o); threw = true; throw new Error('simulated timeout with uncertain commit') }
      }
      return c
    }
    let { main: fn, restore } = load(db, 'uA')
    const r1 = await fn({}); restore()
    db.collection = orig
    ok(r1.code !== 0, 'uncertain commit: first request fails (no false success)')
    ok(cnt(db, 'challenge_records') === 1, 'uncertain commit: orphan record exists exactly once')
    ;({ main: fn, restore } = load(db, 'uA'))
    const r2 = await fn({}); restore()
    ok(r2.code === 0 && cnt(db, 'challenge_records') === 1, 'uncertain commit: retry reconciles to the orphan (no duplicate)')
  }

  // 14) concurrent start + submit → no duplicate, submit advances once
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const R = ids()
    let { main: fn, restore } = load(db, 'uA')
    const r0 = await fn({}); restore()
    const rid = r0.data.recordId
    const SC = path.join(__dirname, '../../cloudfunctions/submitChallengeChoice/index.js')
    const rs = stubCloud('uA', db); delete require.cache[require.resolve(SC)]
    const subMain = require(SC).main
    ;({ main: fn, restore } = load(db, 'uA'))
    const [rs1, rs2] = await Promise.all([fn({}), subMain({ recordId: rid, eventId: R[0], choiceKey: 'A' })])
    rs(); restore()
    ok(rs1.code === 0 && rs1.data.recordId === rid, 'start+submit: start resumes same recordId')
    ok(recs(db).find((x) => x.recordId === rid).currentEventIndex === 1 && cnt(db, 'challenge_records') === 1, 'start+submit: advance once, no dup')
  }

  // 15) cross-user isolation
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' }); seed(db, 'users', { openid: 'uB' })
    let l = load(db, 'uA'); const a = await l.main({}); l.restore()
    l = load(db, 'uB'); const b = await l.main({}); l.restore()
    ok(a.data.recordId !== b.data.recordId && cnt(db, 'challenge_records') === 2 && cnt(db, 'challenge_active') === 2, 'cross-user isolation: distinct records + sessions')
  }

  // 16) paid and trial concurrent entry (two users) → isolated, no cross-escalation
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'paid' }); seed(db, 'users', { openid: 'free' })
    seed(db, 'entitlements', { openid: 'paid', permissions: ['challenge_full'], sources: [] })
    let lp = load(db, 'paid'); let lf = load(db, 'free')
    const [rp, rf] = await Promise.all([lp.main({}), lf.main({})]); lp.restore(); lf.restore()
    ok(rp.data.trialMode === false && rp.data.unlocked === true, 'paid entry: entitled record')
    ok(rf.data.trialMode === true && rf.data.trialLimit === 3, 'trial entry: trial record (no paid escalation)')
    ok(rp.data.recordId !== rf.data.recordId, 'paid/trial concurrent: distinct records')
  }

  // 17) expired entitlement → resumes trial, no paid escalation
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const R = ids()
    seed(db, 'memberships', { openid: 'uA', status: 'active', permissions: ['challenge_full'], expiredAt: 1 })
    seed(db, 'challenge_records', { recordId: 'CRt', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 1, choices: R.slice(0, 1).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(R), createdAt: 1, updatedAt: 1 })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.data.trialMode === true && r.data.recordId === 'CRt' && cnt(db, 'challenge_records') === 1, 'expired entitlement: trial resumed, no escalation, no new record')
  }

  // 18) malformed legacy plan (no READY) → fail-closed, no new trial
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    seed(db, 'challenge_records', { recordId: 'CRbad', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 0, choices: [], plan: { planVersion: 'rc8.14_v1', challengeLength: 5, eventBankVersion: 'bank_x', eventIds: ['CE001', 'CE002'] }, createdAt: 1, updatedAt: 1 })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.code !== 0 && cnt(db, 'challenge_records') === 1, 'malformed legacy plan: refused, NO new free record')
  }

  // 19) replay branch regression → entitled round, idempotent by replayRequestId
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    seed(db, 'entitlements', { openid: 'uA', permissions: ['challenge_full'], sources: [] })
    let { main: fn, restore } = load(db, 'uA')
    const r1 = await fn({ replay: true, replayRequestId: 'RID1' }); restore()
    ;({ main: fn, restore } = load(db, 'uA'))
    const r2 = await fn({ replay: true, replayRequestId: 'RID1' }); restore()
    ok(r1.code === 0 && r1.data.replay === true && r1.data.trialMode === false, 'replay: entitled round')
    ok(r2.data.idempotent === true && r2.data.recordId === r1.data.recordId && cnt(db, 'challenge_records') === 1, 'replay: idempotent, no duplicate')
  }

  // 20) Day-3 boundary regression via legacy scan (no READY authority)
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const R = ids()
    seed(db, 'challenge_records', { recordId: 'CR3', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 3, choices: R.slice(0, 3).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(R), createdAt: 1, updatedAt: 1 })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({})
    restore()
    ok(r.data.needPayment === true && r.data.recordId === 'CR3' && cnt(db, 'challenge_records') === 1, 'legacy Day-3 boundary: payment-gated, no new trial')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
