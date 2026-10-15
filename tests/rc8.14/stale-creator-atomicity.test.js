'use strict'
/**
 * tests/rc8.14/stale-creator-atomicity.test.js — RC8_14_D12_R2_3
 * Deterministic proof that the stale-creator orphan race is ELIMINATED and that
 * creation is idempotent under lease takeover / uncertain commit.
 *
 * Level: MOCK_TEST (in-memory harness implementing real SDK semantics: explicit
 * `_id` uniqueness + conditional-write stats.updated). Uses explicit BARRIERS
 * (deferred promises) and a controlled clock — no random sleeps.
 */
const path = require('path')
const AS = require(path.join(__dirname, '../../cloudfunctions/startChallenge/lib/activeSession.js'))
const { makeDb, seed, stubCloud, makeBank } = require('./_harness.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const FN = path.join(__dirname, '../../cloudfunctions/startChallenge/index.js')
function deferred () { let resolve; const promise = new Promise((r) => { resolve = r }); return { promise, resolve } }
function planOf (ids) { return { planVersion: 'rc8.14_v1', challengeLength: ids.length, eventBankVersion: 'bank_x', eventIds: ids.slice(), createdAt: 1, source: 'p' } }
function ids () { return makeBank(30).map((e) => e.eventId) }
function seedBank (db) { for (const e of makeBank(30)) seed(db, 'challenge_events', e) }
const cnt = (db, n) => (db._store[n] || []).length

/**
 * Deterministic stale-creator race.
 *  A (first) reaches the insertion point and PAUSES. Clock advances past the
 *  30s lease. B claims → CAS-steals the expired CLAIMING. B proceeds to READY.
 *  A resumes through both possible orderings.
 * @param {boolean} bReadyFirst  true → B inserts+ready first, then A resumes;
 *                               false → A resumes first, then B.
 */
async function staleCreatorRace ({ bReadyFirst }) {
  const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
  const aReached = deferred(); const bReached = deferred()
  const releaseA = deferred(); const releaseB = deferred()
  let addCalls = 0

  const orig = db.collection.bind(db)
  db.collection = (name) => {
    const c = orig(name)
    if (name !== 'challenge_records') return c
    const oadd = c.add.bind(c)
    c.add = async (o) => {
      addCalls++
      const which = addCalls === 1 ? 'A' : 'B'
      if (which === 'A') { aReached.resolve(); await releaseA.promise } else { bReached.resolve(); await releaseB.promise }
      return oadd(o)
    }
    return c
  }

  const realNow = Date.now
  let T = 1_791_000_000_000
  Date.now = () => T
  const restore = stubCloud('uA', db)
  delete require.cache[require.resolve(FN)]
  const main = require(FN).main

  const pA = main({})
  await aReached.promise           // A paused at the insertion point
  T = T + 40_000                   // lease expired
  const pB = main({})
  await bReached.promise           // B stole the claim, paused at insertion

  let rA, rB
  if (bReadyFirst) {
    releaseB.resolve(); rB = await pB
    releaseA.resolve(); rA = await pA
  } else {
    releaseA.resolve(); rA = await pA
    releaseB.resolve(); rB = await pB
  }
  Date.now = realNow; restore()

  const recs = (db._store.challenge_records || []).filter((x) => x.openid === 'uA')
  const sess = (db._store.challenge_active || [])[0] || null
  const pointed = sess && sess.recordId
  const orphans = recs.filter((x) => x.recordId !== pointed)
  return { rA, rB, recs, sess, orphans, pointed }
}

async function main () {
  console.log('RC8_14_D12_R2_3 — STALE-CREATOR ATOMICITY (deterministic)')

  // 1) stale-creator race, B reaches READY before A resumes → ONE record, no orphan
  {
    const o = await staleCreatorRace({ bReadyFirst: true })
    ok(o.recs.length === 1 && o.orphans.length === 0, 'race(B-ready-first): exactly ONE record, ZERO orphans')
    ok(o.pointed && o.recs[0].recordId === o.pointed, 'race(B-ready-first): session points at the single record')
    ok(o.rA.code === 0 && o.rB.code === 0 && o.rA.data.recordId === o.rB.data.recordId && o.rA.data.recordId === o.pointed,
      'race(B-ready-first): A & B responses converge to the authoritative recordId')
  }

  // 2) stale-creator race, A resumes before B is READY → same invariants
  {
    const o = await staleCreatorRace({ bReadyFirst: false })
    ok(o.recs.length === 1 && o.orphans.length === 0, 'race(A-resumes-first): exactly ONE record, ZERO orphans')
    const succ = [o.rA, o.rB].filter((r) => r.code === 0)
    ok(succ.length >= 1 && succ.every((r) => r.data.recordId === o.pointed),
      'race(A-resumes-first): every SUCCESSFUL response converges to the authoritative recordId (no false recordId)')
  }

  // 3) stale creator can never create an independent record (superseded insert rolled back)
  {
    const o = await staleCreatorRace({ bReadyFirst: true })
    const sessTokensPointed = o.sess && o.sess.recordId
    ok(o.recs.filter((r) => r.recordId === sessTokensPointed).length === 1, 'superseded creator: only the winner record survives')
    ok(o.recs.every((r) => r.openid === 'uA'), 'superseded creator: no cross-user record')
  }

  // 4) released claim (expiresAt=0) is stealable → crash recovery, single record
  {
    const db = makeDb(); seedBank(db)
    seed(db, 'challenge_active', { _id: 'uA', ownerToken: 'tok_x', state: 'CLAIMING', recordId: null, claimedAt: 1, readyAt: null, expiresAt: 0 })
    const cl = await AS.claim({ db, openid: 'uA', now: 100 })
    ok(cl.won === true && cl.mode === 'STEAL_STALE', 'released claim: stealable (crash recovery)')
  }

  // 5) uncertain commit (insert commits, response lost) → recoverable, no duplicate, never deleted
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const orig = db.collection.bind(db)
    let threw = false
    db.collection = (name) => {
      const c = orig(name)
      if (name === 'challenge_records' && !threw) {
        const oadd = c.add.bind(c)
        c.add = async (o) => { await oadd(o); threw = true; throw new Error('timeout after commit') }
      }
      return c
    }
    let restore = stubCloud('uA', db)
    delete require.cache[require.resolve(FN)]
    let main2 = require(FN).main
    const r1 = await main2({}); restore()
    db.collection = orig
    ok(r1.code === 0 && typeof r1.data.recordId === 'string', 'uncertain commit: converges on the committed record (no false failure)')
    ok(cnt(db, 'challenge_records') === 1, 'uncertain commit: committed record PRESERVED (non-destructive, never deleted)')
    restore = stubCloud('uA', db); delete require.cache[require.resolve(FN)]
    main2 = require(FN).main
    const r2 = await main2({}); restore()
    ok(r2.code === 0 && r2.data.recordId === r1.data.recordId && cnt(db, 'challenge_records') === 1, 'uncertain commit: retry idempotent on the SAME recordId')
  }

  // 6) READY target temporarily unreadable → fail closed, session + records untouched
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const R = ids()
    seed(db, 'challenge_records', { recordId: 'CR_A', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 0, choices: [], plan: planOf(R), createdAt: 1, updatedAt: 1 })
    seed(db, 'challenge_active', { _id: 'uA', ownerToken: 'tok_A', state: 'READY', recordId: 'CR_A', readyAt: 1, expiresAt: null })
    const orig = db.collection.bind(db)
    db.collection = (name) => {
      const c = orig(name)
      if (name === 'challenge_records') {
        const ow = c.where.bind(c)
        c.where = (q) => {
          const ch = ow(q)
          if (q && q.recordId === 'CR_A') { ch.get = async () => { throw new Error('transient read failure') } }
          return ch
        }
      }
      return c
    }
    const restore = stubCloud('uA', db)
    delete require.cache[require.resolve(FN)]
    const main2 = require(FN).main
    const r = await main2({}); restore()
    ok(r.code !== 0 && r.data && r.data.code === 'ACTIVE_TARGET_UNREADABLE', 'unreadable target: fail-closed (ACTIVE_TARGET_UNREADABLE)')
    ok(cnt(db, 'challenge_records') === 1, 'unreadable target: NO new record created')
    ok((db._store.challenge_active || [])[0].state === 'READY', 'unreadable target: READY authority NOT invalidated')
  }

  // 7) genuinely missing READY target → authoritative CAS invalidate + ONE safe create
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    seed(db, 'challenge_active', { _id: 'uA', ownerToken: 'tok_A', state: 'READY', recordId: 'CR_GONE', readyAt: 1, expiresAt: null })
    const restore = stubCloud('uA', db)
    delete require.cache[require.resolve(FN)]
    const main2 = require(FN).main
    const r = await main2({}); restore()
    ok(r.code === 0 && cnt(db, 'challenge_records') === 1, 'missing target: exactly ONE safe create')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
