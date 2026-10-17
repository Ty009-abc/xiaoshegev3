'use strict'
/**
 * tests/rc8.14/start-mode-authority.test.js
 * RC814_STARTCHALLENGE_MODE_AUTHORITY — adversarial regression.
 *
 * Engine level: loads the REAL cloudfunction code + in-memory CloudBase-like DB.
 *
 * Proven invariants:
 *   1) `mode` is allow-listed server-side. Unknown / malformed / wrong-typed
 *      values are rejected with 400 PARAM_ERROR and ZERO writes — before any
 *      DB read, session claim, or record creation.
 *   2) Absent / null / '' mode means DEFAULT (legacy clients send nothing).
 *   3) `trialMode` derives ONLY from the server-resolved entitlement. A free
 *      user can no longer obtain `trialMode=false` by asking for diagnostic.
 *   4) Forged request fields (trialMode / unlocked / membership / permissions /
 *      isVip / openid / VIP level) never influence authority.
 *   5) Diagnostic stays a legitimate 6-question path for free users, never
 *      claims the challenge READY session, and never becomes a 30-day challenge.
 *   6) Legitimate challenge creation / resume semantics are preserved for both
 *      free (trial) and entitled (unlocked) users.
 */
const path = require('path')
const { makeDb, seed, stubCloud, makeBank } = require('./_harness.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  \u2717 ' + m) } }

const FN = path.join(__dirname, '../../cloudfunctions/startChallenge/index.js')

function loadFn (db, openid) {
  const restore = stubCloud(openid || 'u', db)
  delete require.cache[require.resolve(FN)]
  const main = require(FN).main
  return { main, restore }
}
async function run (db, openid, args) {
  const { main: fn, restore } = loadFn(db, openid)
  try { return await fn(args || {}) } finally { restore() }
}

function bank (db, n) { const b = makeBank(n || 30); for (const e of b) seed(db, 'challenge_events', e); return b }
function baseDb () {
  const db = makeDb()
  bank(db, 30)
  seed(db, 'users', { openid: 'u' })
  return db
}
const recs = (db) => db._store.challenge_records || []
const active = (db) => db._store.challenge_active || []
const byId = (db, rid) => recs(db).find((x) => x.recordId === rid)

const DAY = 86400000

/** Grant challenge_full the way the payment finalizer does (permanent one-off). */
function grantPermanent (db, openid) {
  seed(db, 'entitlements', {
    _id: 'ENT_' + openid, openid, permissions: ['challenge_full'],
    sources: [{ productId: 'challenge_39_9', orderId: 'O_' + openid, expiresAt: 0 }],
  })
}
function grantTimedVip (db, openid, ms) {
  seed(db, 'entitlements', {
    _id: 'ENTV_' + openid, openid, permissions: ['challenge_full'],
    sources: [{ productId: 'vip_month_39_9', orderId: 'O_' + openid, expiresAt: Date.now() + ms }],
  })
}

async function main () {
  console.log('RC814 — STARTCHALLENGE MODE AUTHORITY (adversarial)')

  // ── 1) unknown mode rejected, zero writes ───────────────────────────────
  {
    const bads = ['challenge', 'DIAGNOSTIC', 'Diagnostic', 'diagnostics', 'diag',
      'diagnostic ', ' diagnostic', 'defaultx', '__proto__', 'constructor', 'toString']
    for (const bad of bads) {
      const db = baseDb()
      const before = recs(db).length + active(db).length
      const r = await run(db, 'u', { mode: bad })
      const after = recs(db).length + active(db).length
      ok(r.code === 400, `unknown mode ${JSON.stringify(bad)} → 400 PARAM_ERROR`)
      ok(after === before, `unknown mode ${JSON.stringify(bad)} wrote NOTHING`)
    }
  }

  // ── 2) malformed / wrong-typed mode rejected ────────────────────────────
  {
    const bads = [123, 0, true, false, {}, [], ['diagnostic'], { mode: 'diagnostic' }, NaN]
    for (const bad of bads) {
      const db = baseDb()
      const before = recs(db).length + active(db).length
      const r = await run(db, 'u', { mode: bad })
      const after = recs(db).length + active(db).length
      ok(r.code === 400, `malformed mode ${String(JSON.stringify(bad))} → 400`)
      ok(after === before, `malformed mode ${String(JSON.stringify(bad))} wrote NOTHING`)
    }
  }

  // ── 3) absent / null / '' mode ⇒ DEFAULT, normal challenge ──────────────
  for (const absent of [undefined, null, '']) {
    const db = baseDb()
    const ev = absent === undefined ? {} : { mode: absent }
    const r = await run(db, 'u', ev)
    const label = absent === '' ? "''" : String(absent)
    ok(r.code === 0, `mode=${label} accepted as default`)
    ok(r.data && r.data.mode === 'challenge', `mode=${label} creates a challenge record`)
    const rec = byId(db, r.data.recordId)
    ok(rec && rec.mode === 'challenge', `mode=${label} persisted mode=challenge`)
  }

  // ── 4) THE FIX: free user + mode:'diagnostic' can NO LONGER mint trialMode=false
  {
    const db = baseDb() // no entitlement, no membership
    const r = await run(db, 'u', { mode: 'diagnostic' })
    ok(r.code === 0, 'free user diagnostic still succeeds (legit path preserved)')
    const rec = byId(db, r.data.recordId)
    ok(rec, 'diagnostic record created')
    ok(rec.trialMode === true, 'FIX: diagnostic record trialMode=true (NOT the paid marker)')
    ok(r.data.trialMode === true, 'FIX: response trialMode=true for free diagnostic')
    ok(rec.mode === 'diagnostic', 'diagnostic record keeps mode=diagnostic')
  }

  // ── 5) paid user + diagnostic ⇒ trialMode=false legitimately (from entitlement)
  {
    const db = baseDb()
    grantPermanent(db, 'u')
    const r = await run(db, 'u', { mode: 'diagnostic' })
    ok(r.code === 0, 'paid user diagnostic succeeds')
    const rec = byId(db, r.data.recordId)
    ok(rec.trialMode === false, 'paid diagnostic trialMode=false derived from ENTITLEMENT')
  }

  // ── 6) forged fields cannot grant paid status to a free user ────────────
  {
    const db = baseDb()
    const r = await run(db, 'u', {
      trialMode: false, unlocked: true, isVip: true, vipLevel: 'vip_year',
      permissions: ['challenge_full', 'challenge_unlock'],
      membership: { status: 'active', permissions: ['challenge_full'] },
      entitlement: { permissions: ['challenge_full'] },
      openid: 'attacker',
    })
    ok(r.code === 0, 'free challenge start still succeeds')
    const rec = byId(db, r.data.recordId)
    ok(rec.trialMode === true, 'FORGED trialMode/unlocked/vip/membership/permissions IGNORED → trialMode=true')
    ok(rec.unlocked !== true, 'FORGED unlocked not written')
    ok(rec.openid === 'u', 'FORGED openid ignored (server identity used)')
  }

  // ── 7) forged openid cannot operate another user's records ──────────────
  {
    const db = baseDb()
    seed(db, 'users', { openid: 'victim' })
    grantPermanent(db, 'victim')
    const vr = await run(db, 'victim', {})
    ok(vr.code === 0 && vr.data.unlocked === true, 'victim starts an unlocked challenge')
    // attacker tries to resume the victim's record by claiming openid
    const ar = await run(db, 'u', { openid: 'victim' })
    ok(ar.code === 0, 'attacker start succeeds (as themselves)')
    ok(ar.data.recordId !== vr.data.recordId, 'attacker did NOT receive the victim record')
    const arrec = byId(db, ar.data.recordId)
    ok(arrec.openid === 'u', 'attacker record bound to server openid, not forged one')
    const vrec = byId(db, vr.data.recordId)
    ok(vrec.openid === 'victim' && vrec.trialMode === false, 'victim record untouched')
  }

  // ── 8) free challenge stays free (trial, 3-question boundary) ───────────
  {
    const db = baseDb()
    const r = await run(db, 'u', {})
    ok(r.code === 0 && r.data.trialMode === true, 'free user → trial record')
    ok(r.data.trialLimit === 3, 'free trial exposes trialLimit=3')
    ok(r.data.unlocked === undefined, 'free record carries no unlocked flag')
    ok(byId(db, r.data.recordId).trialMode === true, 'persisted trialMode=true')
  }

  // ── 9) paid challenge retains access (permanent + timed VIP) ────────────
  {
    const db = baseDb(); grantPermanent(db, 'u')
    const r = await run(db, 'u', {})
    ok(r.code === 0 && r.data.trialMode === false && r.data.unlocked === true, 'permanent unlock → entitled challenge')
  }
  {
    const db = baseDb(); grantTimedVip(db, 'u', 7 * DAY)
    const r = await run(db, 'u', {})
    ok(r.code === 0 && r.data.trialMode === false && r.data.unlocked === true, 'valid timed VIP → entitled challenge')
  }
  // ── 10) expired VIP rejected (no access) ────────────────────────────────
  {
    const db = baseDb(); grantTimedVip(db, 'u', -1 * DAY)
    const r = await run(db, 'u', {})
    ok(r.code === 0 && r.data.trialMode === true, 'expired VIP → treated as free (trial), not entitled')
  }

  // ── 11) diagnostic is bounded to SIX questions (independent of bank size)
  {
    const db = baseDb()
    const r = await run(db, 'u', { mode: 'diagnostic' })
    const rec = byId(db, r.data.recordId)
    ok(rec.plan && rec.plan.eventIds.length === 6, 'diagnostic plan length = 6 (never 30)')
    ok(new Set(rec.plan.eventIds).size === 6, 'diagnostic plan events are distinct')
  }

  // ── 12) diagnostic does NOT claim the challenge READY session ──────────
  {
    const db = baseDb()
    await run(db, 'u', { mode: 'diagnostic' })
    ok(active(db).length === 0, 'FIX: diagnostic did not create a challenge_active READY session')
  }
  // ── 13) diagnostic then normal start ⇒ a real challenge (no account lockout)
  {
    const db = baseDb()
    const d = await run(db, 'u', { mode: 'diagnostic' })
    ok(d.code === 0, 'diagnostic created first')
    const c = await run(db, 'u', {})
    ok(c.code === 0, 'FIX: subsequent normal start SUCCEEDS (was WRONG_MODE lockout)')
    ok(c.data.mode === 'challenge', 'normal start returns mode=challenge')
    const crec = byId(db, c.data.recordId)
    ok(crec && crec.mode === 'challenge', 'normal start persisted a challenge record')
    ok(crec.trialMode === true, 'normal start for free user is a trial (not paid)')
    const ready = active(db)[0]
    ok(ready && ready.recordId === c.data.recordId, 'READY pointer points at the CHALLENGE record')
    ok(ready.recordId !== d.data.recordId, 'READY pointer does NOT point at the diagnostic record')
  }

  // ── 14) diagnostic cannot be laundered into a challenge ────────────────
  {
    const db = baseDb()
    const d = await run(db, 'u', { mode: 'diagnostic' })
    const drec = byId(db, d.data.recordId)
    ok(drec.mode === 'diagnostic', 'diagnostic record mode immutable across a later start')
    // a second diagnostic request must not upgrade/resume it as challenge
    const d2 = await run(db, 'u', { mode: 'diagnostic' })
    ok(d2.code === 0 && d2.data.mode === 'diagnostic', 'second diagnostic stays diagnostic')
    const readyRec = active(db).map((a) => a.recordId)
    ok(!readyRec.includes(d.data.recordId), 'diagnostic never becomes the READY challenge target')
    // and no challenge record was created out of the diagnostic
    const challengeRecs = recs(db).filter((r0) => r0.mode === 'challenge')
    ok(challengeRecs.length === 0, 'no challenge record fabricated from diagnostic sessions')
  }

  // ── 15) paid resume semantics preserved (owned unlocked record reused) ──
  {
    const db = baseDb(); grantPermanent(db, 'u')
    const first = await run(db, 'u', {})
    ok(first.code === 0 && first.data.unlocked === true, 'paid creates unlocked challenge')
    const again = await run(db, 'u', {})
    ok(again.code === 0, 'paid second start succeeds')
    ok(again.data.recordId === first.data.recordId, 'paid resume returns the SAME record (no duplicate)')
    ok(again.data.resumed === true && again.data.trialMode === false, 'paid resume marked resumed + not trial')
  }

  // ── 16) free trial resume preserved (idx 0..2 resumes, no duplicate) ────
  {
    const db = baseDb()
    const first = await run(db, 'u', {})
    const rid = first.data.recordId
    const r0 = recs(db).find((x) => x.recordId === rid)
    r0.currentEventIndex = 2
    r0.choices = r0.plan.eventIds.slice(0, 2).map((id) => ({ eventId: id, choice: 'A' }))
    const again = await run(db, 'u', {})
    ok(again.code === 0 && again.data.recordId === rid, 'free trial at idx2 resumes the SAME record')
    ok(again.data.trialMode === true, 'free resume stays trial')
  }

  // ── 17) free trial at idx>=3 → payment boundary, no new record ─────────
  {
    const db = baseDb()
    const first = await run(db, 'u', {})
    const rid = first.data.recordId
    const r0 = recs(db).find((x) => x.recordId === rid)
    r0.currentEventIndex = 3
    r0.choices = r0.plan.eventIds.slice(0, 3).map((id) => ({ eventId: id, choice: 'A' }))
    const n0 = recs(db).length
    const again = await run(db, 'u', {})
    ok(again.code === 0 && again.data.needPayment === true, 'free trial at Day4 → needPayment boundary')
    ok(recs(db).length === n0, 'free trial boundary does NOT create another trial')
  }

  // ── 18) replay remains entitlement-gated (mode cannot bypass it) ───────
  {
    const db = baseDb()
    const n0 = recs(db).length
    const r = await run(db, 'u', { replay: true, replayRequestId: 'rid-1' })
    ok(r.code !== 0, 'free user replay DENIED')
    ok(recs(db).length === n0, 'denied replay created NO record')
  }
  {
    const db = baseDb(); grantPermanent(db, 'u')
    const r = await run(db, 'u', { replay: true, replayRequestId: 'rid-2' })
    ok(r.code === 0 && r.data.unlocked === true, 'entitled replay allowed')
    const again = await run(db, 'u', { replay: true, replayRequestId: 'rid-2' })
    ok(again.code === 0 && again.data.idempotent === true, 'replay idempotent on same request id')
    ok(again.data.recordId === r.data.recordId, 'replay idempotency returns same record')
  }

  // ── 19) unauthenticated request rejected before mode handling ──────────
  {
    const db = baseDb()
    // NB: loadFn does `openid || 'u'`, so an empty string collapses to 'u'.
    // Use stubCloud directly with a resolver returning '' to model a real
    // missing OPENID (no login state).
    const restore = stubCloud(() => '', db)
    delete require.cache[require.resolve(FN)]
    let r
    try { r = await require(FN).main({ mode: 'diagnostic' }) } finally { restore() }
    ok(r.code === 401, 'no openid → 401 AUTH_FAILED')
    ok(recs(db).length === 0, 'unauthenticated request wrote nothing')
  }

  // ── 20) unknown user rejected, zero writes ────────────────────────────
  {
    const db = makeDb(); bank(db, 30) // users collection left empty
    const r = await run(db, 'ghost', {})
    ok(r.code === 401, 'missing user doc → 401')
    ok(recs(db).length === 0, 'unknown user wrote nothing')
  }

  // ── 21) mode allow-list is exact-match only (no coercion) ─────────────
  {
    // String objects / boxed values must not sneak through
    const db = baseDb()
    const boxed = Object('diagnostic') // typeof 'object'
    const r = await run(db, 'u', { mode: boxed })
    ok(r.code === 400, 'boxed String("diagnostic") rejected (no coercion)')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
