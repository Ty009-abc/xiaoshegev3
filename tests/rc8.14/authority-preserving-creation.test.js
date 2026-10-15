'use strict'
/**
 * tests/rc8.14/authority-preserving-creation.test.js — RC8_14_D12_R2_5
 * Permanent regression for the R2.4 P0: an uncertain authority outcome must
 * NEVER delete a record (a READY session may already point at it). Also proves
 * deterministic creation identity → idempotent creation under retries/takeover.
 *
 * Level: MOCK_TEST (in-memory harness with real SDK semantics: unique `_id`,
 * conditional-write stats.updated). Deterministic barriers / controlled faults.
 */
const path = require('path')
const { makeDb, seed, stubCloud, makeBank } = require('./_harness.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const FN = path.join(__dirname, '../../cloudfunctions/startChallenge/index.js')
function planOf (ids) { return { planVersion: 'rc8.14_v1', challengeLength: ids.length, eventBankVersion: 'bank_x', eventIds: ids.slice(), createdAt: 1, source: 'p' } }
function ids () { return makeBank(30).map((e) => e.eventId) }
function seedBank (db) { for (const e of makeBank(30)) seed(db, 'challenge_events', e) }
function load (db, openid) { const r = stubCloud(openid || 'uA', db); delete require.cache[require.resolve(FN)]; return { main: require(FN).main, restore: r } }
const cnt = (db, n) => (db._store[n] || []).length
const sess = (db) => (db._store.challenge_active || [])[0] || null
const recs = (db) => (db._store.challenge_records || []).filter((r) => r.openid === 'uA')

// Wrap challenge_active READS to fail once `armed` is set (simulates an authority
// read outage AFTER markReady already committed).
function armReadOutage (db) {
  const state = { armed: false }
  const orig = db.collection.bind(db)
  db.collection = (name) => {
    const c = orig(name)
    if (name !== 'challenge_active') return c
    const ow = c.where.bind(c)
    c.where = (q) => {
      const ch = ow(q); const og = ch.get.bind(ch); const ol = ch.limit.bind(ch)
      const wrap = (o) => { o.get = async () => { if (state.armed) throw new Error('authority read outage'); return og() }; return o }
      wrap(ch); ch.limit = (n) => { const a = ol(n); wrap(a); return a }
      return ch
    }
    return c
  }
  return state
}

async function main () {
  console.log('RC8_14_D12_R2_5 — AUTHORITY-PRESERVING CREATION')

  // 1) THE R2.4 P0: markReady commits READY, subsequent authority read fails →
  //    record MUST be preserved (never deleted); authority pointer stays intact;
  //    retry (reads healed) resumes the SAME recordId.
  {
    let db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const outage = armReadOutage(db)
    let inserted = false
    const orig = db.collection.bind(db)
    db.collection = (name) => {
      const c = orig(name)
      if (name === 'challenge_records') { const oadd = c.add.bind(c); c.add = async (o) => { const r = await oadd(o); inserted = true; return r } }
      return c
    }
    const outage2 = armReadOutage(db)
    // re-arm on the final wrapping (challenge_active)
    let { main: fn, restore } = load(db, 'uA')
    // Arm only AFTER the record insert (so markReady succeeds but the authority
    // read that confirms it fails).
    const armedAtInsert = { get armed () { return inserted } }
    // Patch: use a dynamic armed proxy
    db.collection = (function (base) {
      return (name) => {
        const c = base(name)
        if (name !== 'challenge_active') return c
        const ow = c.where.bind(c)
        c.where = (q) => {
          const ch = ow(q); const og = ch.get.bind(ch); const ol = ch.limit.bind(ch)
          const wrap = (o) => { o.get = async () => { if (inserted) throw new Error('authority read outage'); return og() }; return o }
          wrap(ch); ch.limit = (n) => { const a = ol(n); wrap(a); return a }
          return ch
        }
        return c
      }
    })(db.collection)
    const r1 = await fn({}); restore()
    const s = sess(db); const pointed = s && s.recordId
    ok(cnt(db, 'challenge_records') === 1, 'P0: canonical record PRESERVED (never deleted on uncertain authority)')
    ok(!!pointed && recs(db).some((x) => x.recordId === pointed), 'P0: READY authority pointer intact (not dangling)')
    ok(s && s.state === 'READY', 'P0: session remained READY (authority not invalidated)')
    ok(r1.code !== 0 || (r1.data && r1.data.recordId), 'P0: no FALSE success — response is either failure or the real record')
    // reads healed → retry resumes the SAME record
    ;({ main: fn, restore } = load(db, 'uA'))
    const r2 = await fn({}); restore()
    ok(r2.code === 0 && r2.data.recordId === pointed && cnt(db, 'challenge_records') === 1, 'P0: retry resumes the SAME authoritative recordId (idempotent)')
  }

  // 2) A valid READY record is never removed by any startChallenge path
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const R = ids()
    seed(db, 'challenge_records', { recordId: 'CR_READY', _id: 'CR_READY', openid: 'uA', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 1, choices: R.slice(0, 1).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(R), createdAt: 1, updatedAt: 1 })
    seed(db, 'challenge_active', { _id: 'uA', ownerToken: 'tok_A', state: 'READY', recordId: 'CR_READY', creationId: 'CR_READY', readyAt: 1, expiresAt: null })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({}); restore()
    ok(r.data.recordId === 'CR_READY', 'READY record: resumed (authority respected)')
    ok(cnt(db, 'challenge_records') === 1, 'READY record: preserved (no delete, no duplicate)')
  }

  // 3) deterministic creation identity: uncertain commit → retry converges SAME recordId
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const orig = db.collection.bind(db)
    let threw = false
    db.collection = (name) => {
      const c = orig(name)
      if (name === 'challenge_records' && !threw) { const oadd = c.add.bind(c); c.add = async (o) => { await oadd(o); threw = true; throw new Error('timeout after commit') } }
      return c
    }
    let { main: fn, restore } = load(db, 'uA')
    const r1 = await fn({}); restore(); db.collection = orig
    ;({ main: fn, restore } = load(db, 'uA'))
    const r2 = await fn({}); restore()
    ok(r1.code === 0 && r2.code === 0 && r1.data.recordId === r2.data.recordId, 'stable identity: uncertain commit → retry converges to the SAME recordId')
    ok(cnt(db, 'challenge_records') === 1, 'stable identity: exactly ONE record (idempotent creation)')
  }

  // 4) two owners competing with stable (deterministic) IDs → ONE record
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    let { main: fn, restore } = load(db, 'uA')
    const res = await Promise.all([fn({}), fn({})]); restore()
    const set = new Set(res.filter((r) => r.code === 0).map((r) => r.data.recordId))
    ok(set.size === 1 && cnt(db, 'challenge_records') === 1, 'stable IDs: two simultaneous starts → ONE record, one recordId')
  }

  // 5) eight simultaneous starts → ONE record (deterministic identity)
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const { main: fn, restore } = load(db, 'uA')
    const res = await Promise.all(Array.from({ length: 8 }, () => fn({}))); restore()
    const set = new Set(res.filter((r) => r.code === 0).map((r) => r.data.recordId))
    ok(set.size === 1 && cnt(db, 'challenge_records') === 1, '8× simultaneous: ONE record (deterministic identity)')
  }

  // 6) recordId field == document _id for newly created records (deterministic binding)
  {
    const db = makeDb(); seedBank(db); seed(db, 'users', { openid: 'uA' })
    const { main: fn, restore } = load(db, 'uA')
    const r = await fn({}); restore()
    const rec = recs(db)[0]
    ok(rec._id === rec.recordId && rec.recordId === r.data.recordId, 'deterministic identity: document _id === recordId === response')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
