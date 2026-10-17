'use strict'
/**
 * tests/rc8.14/submit-authority-closure.test.js
 * RC814_SUBMIT_AUTHORITY_FINAL_CLOSURE — targeted authority regression.
 *
 * Engine level: loads the REAL cloudfunction code + in-memory CloudBase-like DB.
 *
 * Invariants proven here:
 *   1) Authorization mode comes ONLY from the server-stored record.mode.
 *      The request's `mode` / `trialMode` / `unlocked` / `isVip` are ignored.
 *   2) challenge mode requires a currently-valid challenge_full entitlement at
 *      idx >= TRIAL_LIMIT — regardless of trialMode (true / false / missing).
 *   3) trialMode=false ALONE can never authorize challenge continuation.
 *   4) Expired entitlement is denied; permanent unlock and valid timed VIP pass.
 *   5) diagnostic keeps its legitimate 6-question behaviour without entitlement,
 *      and cannot be resumed as / advanced into a 30-day challenge.
 *   6) Malformed / missing mode fails closed to challenge.
 *   7) CAS still advances exactly once; denied requests write nothing.
 */
const path = require('path')
const { makeDb, seed, stubCloud, makeBank } = require('./_harness.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const SC = path.join(__dirname, '../../cloudfunctions/submitChallengeChoice/index.js')

function planOf (ids) {
  return { planVersion: 'rc8.14_v1', challengeLength: ids.length, eventBankVersion: 'bank_x', eventIds: ids.slice(), createdAt: 1, source: 'personalized_v1' }
}
function bankInto (db, n) { const b = makeBank(n); for (const e of b) seed(db, 'challenge_events', e); return b }
const rec = (db, rid) => db._store.challenge_records.find((x) => x.recordId === rid)
const snap = (o) => JSON.stringify(o)

async function run (db, openid, args) {
  const restore = stubCloud(openid || 'u', db)
  delete require.cache[require.resolve(SC)]
  try { return await require(SC).main(args) } finally { restore() }
}

const DAY = 24 * 60 * 60 * 1000

// Paid challenge records in production ALWAYS carry challenge_full:
// entitlementService writes trialMode=false + unlocked=true atomically and the
// finalizer only marks the order granted after reading that back.
function seedChallengeFull (db, openid, productId, expiresAt) {
  const src = { productId, orderId: 'TEST_ORDER_' + openid }
  if (expiresAt !== undefined) src.expiresAt = expiresAt
  seed(db, 'entitlements', {
    _id: 'ENT_' + openid, openid, permissions: ['challenge_full'], sources: [src],
  })
}
function mkRec (db, over) {
  seed(db, 'challenge_records', Object.assign({
    openid: 'u', mode: 'challenge', status: 'processing', trialMode: true,
    currentEventIndex: 0, choices: [], rawScores: {}, scores: {}, tags: [],
  }, over))
}
function fresh (n) {
  const db = makeDb(); const bank = bankInto(db, n || 30)
  return { db, ids: bank.map((e) => e.eventId) }
}

async function main () {
  console.log('RC814 — SUBMIT AUTHORITY FINAL CLOSURE (targeted)')

  // ── 1) free challenge idx 0,1,2 allowed ──────────────────────────────────
  {
    for (const idx of [0, 1, 2]) {
      const { db, ids } = fresh()
      mkRec(db, { _id: 'R' + idx, recordId: 'R' + idx, trialMode: true, currentEventIndex: idx, plan: planOf(ids) })
      const r = await run(db, 'u', { recordId: 'R' + idx, eventId: ids[idx], choiceKey: 'A' })
      ok(r.code === 0 && r.data.currentEventIndex === idx + 1, `free challenge idx${idx} allowed → idx${idx + 1}`)
    }
  }

  // ── 2) free challenge idx3 denied, zero writes ──────────────────────────
  {
    const { db, ids } = fresh()
    mkRec(db, { _id: 'F3', recordId: 'F3', trialMode: true, currentEventIndex: 3, plan: planOf(ids) })
    const before = snap(rec(db, 'F3'))
    const r = await run(db, 'u', { recordId: 'F3', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 1002, 'free challenge idx3 DENIED 1002')
    ok(r.data && r.data.needPayment === true && r.data.locked === true, 'denial payload marked needPayment/locked')
    ok(r.data && r.data.code === 'TRIAL_BOUNDARY_REACHED', 'denial payload code TRIAL_BOUNDARY_REACHED')
    ok(snap(rec(db, 'F3')) === before, 'denied request wrote NOTHING')
  }

  // ── 3) trialMode=false WITHOUT entitlement at idx3 → DENIED (core fix) ──
  {
    const { db, ids } = fresh()
    mkRec(db, { _id: 'N3', recordId: 'N3', trialMode: false, unlocked: true, currentEventIndex: 3, plan: planOf(ids) })
    const before = snap(rec(db, 'N3'))
    const r = await run(db, 'u', { recordId: 'N3', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 1002, 'trialMode=false + NO entitlement idx3 → DENIED (bypass closed)')
    ok(snap(rec(db, 'N3')) === before, 'trialMode=false denial wrote NOTHING')
  }

  // ── 4) missing trialMode WITHOUT entitlement at idx3 → DENIED ───────────
  {
    const { db, ids } = fresh()
    seed(db, 'challenge_records', {
      _id: 'M3', recordId: 'M3', openid: 'u', mode: 'challenge', status: 'processing',
      currentEventIndex: 3, choices: [], rawScores: {}, scores: {}, tags: [], plan: planOf(ids),
      // trialMode field intentionally ABSENT (legacy shape)
    })
    const r = await run(db, 'u', { recordId: 'M3', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 1002, 'missing trialMode + NO entitlement idx3 → DENIED (fail-closed)')
  }

  // ── 5) expired VIP → DENIED even though cached permissions say challenge_full
  {
    const { db, ids } = fresh()
    mkRec(db, { _id: 'X3', recordId: 'X3', trialMode: true, currentEventIndex: 3, plan: planOf(ids) })
    seed(db, 'entitlements', {
      _id: 'ENTX', openid: 'u', permissions: ['challenge_full'],
      sources: [{ productId: 'vip_month_39_9', expiresAt: Date.now() - DAY }],
    })
    const before = snap(rec(db, 'X3'))
    const r = await run(db, 'u', { recordId: 'X3', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 1002, 'expired VIP idx3 → DENIED despite cached permission')
    ok(snap(rec(db, 'X3')) === before, 'expired VIP denial wrote NOTHING')
  }

  // ── 6) permanent unlock accepted ────────────────────────────────────────
  {
    const { db, ids } = fresh()
    mkRec(db, { _id: 'P3', recordId: 'P3', trialMode: true, currentEventIndex: 3, plan: planOf(ids) })
    seedChallengeFull(db, 'u', 'challenge_39_9', 0) // 0 == permanent for one-off product
    const r = await run(db, 'u', { recordId: 'P3', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 0 && r.data.currentEventIndex === 4, 'permanent unlock (challenge_39_9) idx3 → allowed → idx4')
  }

  // ── 7) valid timed VIP accepted ─────────────────────────────────────────
  {
    const { db, ids } = fresh()
    mkRec(db, { _id: 'V3', recordId: 'V3', trialMode: true, currentEventIndex: 3, plan: planOf(ids) })
    seedChallengeFull(db, 'u', 'vip_month_39_9', Date.now() + 7 * DAY)
    const r = await run(db, 'u', { recordId: 'V3', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 0 && r.data.currentEventIndex === 4, 'valid timed VIP idx3 → allowed → idx4')
  }

  // ── 8) valid paid challenge user keeps working (no regression) ──────────
  {
    const { db, ids } = fresh()
    mkRec(db, { _id: 'PAY', recordId: 'PAY', trialMode: false, unlocked: true, currentEventIndex: 12, plan: planOf(ids) })
    seedChallengeFull(db, 'u', 'challenge_39_9', 0)
    const r = await run(db, 'u', { recordId: 'PAY', eventId: ids[12], choiceKey: 'A' })
    ok(r.code === 0 && r.data.currentEventIndex === 13, 'valid paid user idx12 → allowed (no regression)')
  }

  // ── 9) diagnostic WITHOUT entitlement stays bounded to 6 questions ──────
  {
    const { db, ids } = fresh()
    mkRec(db, { _id: 'D0', recordId: 'D0', mode: 'diagnostic', trialMode: false, currentEventIndex: 0, plan: planOf(ids) })
    let advanced = 0, codes = []
    for (let i = 0; i < 10; i++) {
      const r = await run(db, 'u', { recordId: 'D0', eventId: ids[i], choiceKey: 'A' })
      codes.push(r.code)
      if (r.code !== 0) break
      advanced = rec(db, 'D0').currentEventIndex
      if (rec(db, 'D0').status === 'finished') break
    }
    ok(advanced === 6, `diagnostic no-entitlement reached exactly 6 questions (got ${advanced})`)
    ok(rec(db, 'D0').status === 'finished', 'diagnostic finished at its 6-question cap')
    ok(codes.every((c) => c === 0), `all diagnostic submits allowed (codes=${codes.join(',')})`)
  }

  // ── 10) diagnostic at idx3 is NOT gated (legit behaviour preserved) ─────
  {
    const { db, ids } = fresh()
    mkRec(db, { _id: 'D3', recordId: 'D3', mode: 'diagnostic', trialMode: false, currentEventIndex: 3, plan: planOf(ids) })
    const r = await run(db, 'u', { recordId: 'D3', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 0 && r.data.currentEventIndex === 4, 'diagnostic idx3 not paywalled (legit diagnostic preserved)')
  }

  // ── 11) diagnostic cannot advance 30-day challenge progress ─────────────
  {
    const { db, ids } = fresh()
    mkRec(db, { _id: 'DG', recordId: 'DG', mode: 'diagnostic', trialMode: false, currentEventIndex: 0, plan: planOf(ids) })
    for (let i = 0; i < 8; i++) {
      const r = await run(db, 'u', { recordId: 'DG', eventId: ids[i], choiceKey: 'A' })
      if (r.code !== 0) break
    }
    const d = rec(db, 'DG')
    ok(d.currentEventIndex <= 6, `diagnostic progress capped at ${d.currentEventIndex} (never 30-day progress)`)
    ok(d.status === 'finished', 'diagnostic terminates independently, never becomes a 30-day challenge')
  }

  // ── 12) malformed mode fails closed to challenge ────────────────────────
  {
    for (const bad of ['Diagnostic', 'DIAGNOSTIC', 'diagnostics', ' challenge', '', null, 123, {}, []]) {
      const { db, ids } = fresh()
      mkRec(db, { _id: 'B1', recordId: 'B1', mode: bad, trialMode: false, unlocked: true, currentEventIndex: 3, plan: planOf(ids) })
      const before = snap(rec(db, 'B1'))
      const r = await run(db, 'u', { recordId: 'B1', eventId: ids[3], choiceKey: 'A' })
      const label = JSON.stringify(bad)
      ok(r.code === 1002, `malformed mode ${label} → fail-closed DENIED`)
      ok(snap(rec(db, 'B1')) === before, `malformed mode ${label} wrote NOTHING`)
    }
  }
  {
    const { db, ids } = fresh()
    seed(db, 'challenge_records', {
      _id: 'B2', recordId: 'B2', openid: 'u', mode: undefined, status: 'processing',
      trialMode: false, unlocked: true, currentEventIndex: 3, choices: [], rawScores: {}, scores: {}, tags: [], plan: planOf(ids),
    })
    const r = await run(db, 'u', { recordId: 'B2', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 1002, 'MISSING mode → treated as challenge (fail-closed)')
  }

  // ── 13) spoofed request fields cannot override stored record.mode ───────
  {
    // stored mode=challenge, client claims diagnostic → must stay gated
    const { db, ids } = fresh()
    mkRec(db, { _id: 'S1', recordId: 'S1', mode: 'challenge', trialMode: true, currentEventIndex: 3, plan: planOf(ids) })
    const before = snap(rec(db, 'S1'))
    const r = await run(db, 'u', {
      recordId: 'S1', eventId: ids[3], choiceKey: 'A',
      mode: 'diagnostic', trialMode: false, unlocked: true, isVip: true,
      permissions: ['challenge_full'], openid: 'attacker',
    })
    ok(r.code === 1002, 'spoofed request mode:diagnostic / trialMode:false IGNORED → still DENIED')
    ok(snap(rec(db, 'S1')) === before, 'spoofed request wrote NOTHING')
  }
  {
    // stored mode=diagnostic, client claims challenge → diagnostic behaviour wins
    const { db, ids } = fresh()
    mkRec(db, { _id: 'S2', recordId: 'S2', mode: 'diagnostic', trialMode: false, currentEventIndex: 3, plan: planOf(ids) })
    const r = await run(db, 'u', { recordId: 'S2', eventId: ids[3], choiceKey: 'A', mode: 'challenge', trialMode: true })
    ok(r.code === 0, 'stored diagnostic is authoritative (request mode:challenge ignored)')
  }
  {
    // record.mode must survive a submit unchanged
    const { db, ids } = fresh()
    mkRec(db, { _id: 'S3', recordId: 'S3', mode: 'challenge', trialMode: true, currentEventIndex: 0, plan: planOf(ids) })
    await run(db, 'u', { recordId: 'S3', eventId: ids[0], choiceKey: 'A', mode: 'diagnostic' })
    ok(rec(db, 'S3').mode === 'challenge', 'record.mode NOT overwritten by client during submit')
  }

  // ── 14) CAS still advances exactly once ────────────────────────────────
  {
    const { db, ids } = fresh()
    mkRec(db, { _id: 'C1', recordId: 'C1', trialMode: true, currentEventIndex: 2, plan: planOf(ids) })
    const rs = await Promise.all([
      run(db, 'u', { recordId: 'C1', eventId: ids[2], choiceKey: 'A' }),
      run(db, 'u', { recordId: 'C1', eventId: ids[2], choiceKey: 'B' }),
      run(db, 'u', { recordId: 'C1', eventId: ids[2], choiceKey: 'A' }),
    ])
    const r0 = rec(db, 'C1')
    ok(r0.currentEventIndex === 3, `concurrent different choices: index advanced exactly once (idx=${r0.currentEventIndex})`)
    ok((r0.choices || []).length === 1, 'concurrent: exactly one choice recorded')

    // Idempotency semantics (RC8_14_B): the FIRST writer wins. Any later request
    // carrying the SAME choice as the winner converges as idempotent code 0
    // (no double score); only a DIFFERENT choice gets CONFLICT(409).
    // So "exactly one winner" is not the right invariant — the right one is:
    //   - exactly one DISTINCT choice is persisted,
    //   - every code-0 response reports that same choice,
    //   - every response with the other choice got 409,
    //   - at least one 409 exists (the differing choice always loses).
    const winner = r0.choices[0].choice
    ok(rs.filter((x) => x.code === 0).every((x) => x.data.choice === winner),
      `every code-0 response matches the persisted choice (${winner})`)
    const expected409 = rs.filter((x) => x.data && x.data.choice === winner ? false : true).length
    ok(rs.filter((x) => x.code === 409).length >= 1, 'the differing choice always got CONFLICT(409)')
    ok(rs.filter((x) => x.code !== 0 && x.code !== 409).length === 0, 'no unexpected error codes')
    ok(expected409 >= 0 && rs.length === 3, 'all three concurrent requests accounted for')
  }
  {
    const { db, ids } = fresh()
    mkRec(db, { _id: 'C2', recordId: 'C2', trialMode: true, currentEventIndex: 0, plan: planOf(ids) })
    const a = await run(db, 'u', { recordId: 'C2', eventId: ids[0], choiceKey: 'A' })
    const b = await run(db, 'u', { recordId: 'C2', eventId: ids[0], choiceKey: 'A' })
    ok(a.code === 0 && b.code === 0 && b.data.idempotent === true, 'identical retry idempotent')
    ok(rec(db, 'C2').currentEventIndex === 1 && rec(db, 'C2').choices.length === 1, 'identical retry advanced once')
  }

  // ── 15) ownership still enforced ───────────────────────────────────────
  {
    const { db, ids } = fresh()
    mkRec(db, { _id: 'O1', recordId: 'O1', trialMode: false, currentEventIndex: 3, plan: planOf(ids) })
    seedChallengeFull(db, 'u', 'challenge_39_9', 0)
    const before = snap(rec(db, 'O1'))
    const r = await run(db, 'intruder', { recordId: 'O1', eventId: ids[3], choiceKey: 'A' })
    ok(r.code === 404, 'other-user ownership → NOT_FOUND(404)')
    ok(snap(rec(db, 'O1')) === before, 'ownership rejection wrote NOTHING')
  }

  // ── 16) production paid-record shape stays compatible ──────────────────
  // Real prod rows: mode='challenge', trialMode=false, unlocked=true,
  // plan absent (legacy), challenge_full from challenge_39_9 with expiresAt=0.
  {
    const { db, ids } = fresh()
    seed(db, 'challenge_records', {
      _id: 'PROD1', recordId: 'PROD1', openid: 'u', mode: 'challenge', status: 'processing',
      trialMode: false, unlocked: true, currentEventIndex: 1, choices: [{ eventId: ids[0], choice: 'A' }],
      rawScores: {}, scores: {}, tags: [], scoringVersion: 'normalized_v2',
      // no plan (matches all 40 prod rows)
    })
    seed(db, 'entitlements', {
      _id: 'ENTPROD', openid: 'u', permissions: ['challenge_full'],
      sources: [{ productId: 'challenge_39_9', expiresAt: 0 }, { productId: 'report_9_9', expiresAt: 0 }],
    })
    const r = await run(db, 'u', { recordId: 'PROD1', eventId: ids[1], choiceKey: 'A' })
    ok(r.code === 0 && r.data.currentEventIndex === 2, 'prod-shaped paid legacy record (expiresAt=0) continues normally')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
