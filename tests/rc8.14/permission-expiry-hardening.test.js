'use strict'
/**
 * tests/rc8.14/permission-expiry-hardening.test.js — RC8_14_D12_R6C
 *
 * Engine-level adversarial tests for the source-validity hardening of
 * `permissionEngine.hasPermission`. Uses the REAL cloudfunction engine against the
 * in-memory CloudBase-like DB (_harness). No network, no real DB, no payment.
 *
 * Invariant under test: a permission is granted ONLY when backed by a source that
 * is CURRENTLY valid. A cached `permissions` array never authorizes; one invalid
 * source cannot borrow validity from an unrelated valid source; malformed/unknown
 * data and read failures fail closed; authorization performs NO writes.
 */
const path = require('path')
const { makeDb, seed } = require('./_harness.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const PE = path.join(__dirname, '../../cloudfunctions/common/permissionEngine.js')
function load () { delete require.cache[require.resolve(PE)]; return require(PE) }
const snap = (db) => JSON.stringify(db._store)
const DENY = (r) => r === false
const ALLOW = (r) => r === true

// entitlement with a set of sources (flat permissions intentionally stale/wrong)
function ent (db, sources, permissions) {
  seed(db, 'entitlements', { _id: 'E', openid: 'u', permissions: permissions || ['challenge_full'], sources })
}
function mem (db, over) {
  seed(db, 'memberships', Object.assign({ _id: 'M', openid: 'u', status: 'active', permissions: ['challenge_full'] }, over))
}

async function main () {
  console.log('RC8_14_D12_R6C — PERMISSION EXPIRY HARDENING (adversarial)')
  const { hasPermission } = load()
  const NOW = Date.now()
  const PAST = NOW - 60_000
  const FUTURE = NOW + 60_000

  // seed a matching candidate record for the submit-gate integration tests
  const bank = require('./_harness.js').makeBank(30)
  const ids = bank.map((e) => e.eventId)

  // ── 1) expired VIP WITHOUT cleanup → denied ──
  { const db = makeDb(); ent(db, [{ productId: 'vip_month_39_9', expiresAt: PAST }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'expired VIP (no cleanup) → denied') }

  // ── 2) expired VIP, membership row still status:'active' → denied ──
  { const db = makeDb()
    ent(db, [{ productId: 'vip_month_39_9', expiresAt: PAST }])
    mem(db, { memberType: 'vip_month_39_9', expiredAt: PAST }) // status active but already expired
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'expired VIP status still active → denied') }

  // ── 3) revoked VIP → denied ──
  { const db = makeDb()
    ent(db, [{ productId: 'vip_month_39_9', expiresAt: FUTURE, revoked: true }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'revoked entitlement source (revoked:true) → denied') }
  { const db = makeDb() // only an expired/revoked membership row (not 'active')
    seed(db, 'memberships', { _id: 'M', openid: 'u', status: 'revoked', memberType: 'vip_month_39_9', expiredAt: FUTURE, permissions: ['challenge_full'] })
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'revoked membership (status:revoked) → denied') }

  // ── 4) valid monthly VIP → allowed ──
  { const db = makeDb(); ent(db, [{ productId: 'vip_month_39_9', expiresAt: FUTURE }])
    ok(ALLOW(await hasPermission(db, 'u', 'challenge_full')), 'valid monthly VIP → allowed') }

  // ── 5) valid annual VIP → allowed ──
  { const db = makeDb(); ent(db, [{ productId: 'vip_year_299', expiresAt: FUTURE }])
    ok(ALLOW(await hasPermission(db, 'u', 'challenge_full')), 'valid annual VIP → allowed') }

  // ── 6) valid permanent challenge purchase → allowed ──
  { const db = makeDb(); ent(db, [{ productId: 'challenge_39_9', expiresAt: 0 }])
    ok(ALLOW(await hasPermission(db, 'u', 'challenge_full')), 'valid permanent challenge purchase (expiresAt:0) → allowed') }

  // ── 7) expired VIP + unrelated valid source CANNOT borrow challenge_full ──
  { const db = makeDb()
    ent(db, [{ productId: 'vip_month_39_9', expiresAt: PAST }, { productId: 'report_9_9', expiresAt: 0 }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'expired VIP + valid permanent REPORT source → challenge_full DENIED') }

  // ── 8) expired VIP + valid permanent CHALLENGE purchase → allowed ──
  { const db = makeDb()
    ent(db, [{ productId: 'vip_month_39_9', expiresAt: PAST }, { productId: 'challenge_39_9', expiresAt: 0 }])
    ok(ALLOW(await hasPermission(db, 'u', 'challenge_full')), 'expired VIP + valid permanent challenge purchase → allowed') }

  // ── 9) cached challenge_full with NO valid matching source → denied ──
  { const db = makeDb(); ent(db, [{ productId: 'report_9_9', expiresAt: 0 }], ['challenge_full', 'full_report'])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'cached challenge_full w/o matching source → denied') }
  { const db = makeDb(); ent(db, [], ['challenge_full'])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'cached challenge_full with EMPTY sources → denied') }

  // ── 10) expired entitlement source → denied ──
  { const db = makeDb(); ent(db, [{ productId: 'challenge_39_9', expiresAt: PAST }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'expired entitlement source → denied') }

  // ── 11) revoked entitlement source → denied ──
  { const db = makeDb(); ent(db, [{ productId: 'challenge_39_9', expiresAt: 0, revoked: true }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'revoked permanent entitlement source → denied') }

  // ── 12) malformed expiry → denied (fail-closed) ──
  { const db = makeDb(); ent(db, [{ productId: 'challenge_39_9', expiresAt: 'soon' }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'malformed string expiry → denied') }
  { const db = makeDb(); ent(db, [{ productId: 'challenge_39_9', expiresAt: -5 }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'negative expiry → denied') }
  { const db = makeDb(); ent(db, [{ productId: 'challenge_39_9', expiresAt: {} }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'non-numeric (object) expiry → denied') }
  { const db = makeDb(); ent(db, [{ expiresAt: 0 }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'source without productId → denied') }

  // ── 13) RC8_14_D12_R6C_R3 — expiry is PRODUCT-AWARE (permanent-vs-timed matrix) ──
  //  Permanent products (catalog durationDays=0): missing/0/null expiry ⇒ permanent.
  { const db = makeDb(); ent(db, [{ productId: 'challenge_39_9' }])
    ok(ALLOW(await hasPermission(db, 'u', 'challenge_full')), 'PERMANENT product (expiresAt undefined) → allowed') }
  { const db = makeDb(); ent(db, [{ productId: 'challenge_39_9', expiresAt: null }])
    ok(ALLOW(await hasPermission(db, 'u', 'challenge_full')), 'PERMANENT product (expiresAt null) → allowed') }
  { const db = makeDb(); ent(db, [{ productId: 'report_9_9' }])
    ok(ALLOW(await hasPermission(db, 'u', 'full_report')), 'PERMANENT product report_9_9 (missing expiry) → allowed') }
  { const db = makeDb(); ent(db, [{ productId: 'report_9_9', expiresAt: null }])
    ok(ALLOW(await hasPermission(db, 'u', 'full_report')), 'PERMANENT product report_9_9 (null expiry) → allowed') }

  //  R6C_R2 NO_GO reproducer — TIMED products with missing/0/null expiry MUST now DENY
  //  (previously ALLOW = fail-open: any product promoted to permanent by missing expiry).
  { const db = makeDb(); ent(db, [{ productId: 'vip_month_39_9' }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'TIMED vip_month_39_9 (missing expiry) → DENIED (no implicit permanent)') }
  { const db = makeDb(); ent(db, [{ productId: 'vip_month_39_9', expiresAt: null }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'TIMED vip_month_39_9 (null expiry) → DENIED') }
  { const db = makeDb(); ent(db, [{ productId: 'vip_month_39_9', expiresAt: 0 }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'TIMED vip_month_39_9 (zero expiry) → DENIED') }
  { const db = makeDb(); ent(db, [{ productId: 'vip_month_99' }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'TIMED vip_month_99 (missing expiry) → DENIED') }
  { const db = makeDb(); ent(db, [{ productId: 'vip_year_299' }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'TIMED vip_year_299 (missing expiry) → DENIED') }
  { const db = makeDb(); ent(db, [{ productId: 'vip_year_299', expiresAt: null }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'TIMED vip_year_299 (null expiry) → DENIED') }
  { const db = makeDb(); ent(db, [{ productId: 'vip_year_299', expiresAt: 0 }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'TIMED vip_year_299 (zero expiry) → DENIED') }

  //  Timed source with malformed/negative expiry ⇒ DENY
  { const db = makeDb(); ent(db, [{ productId: 'vip_month_39_9', expiresAt: 'soon' }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'TIMED malformed string expiry → DENIED') }
  { const db = makeDb(); ent(db, [{ productId: 'vip_month_39_9', expiresAt: -5 }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'TIMED negative expiry → DENIED') }
  { const db = makeDb(); ent(db, [{ productId: 'vip_month_39_9', expiresAt: {} }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'TIMED non-numeric (object) expiry → DENIED') }
  { const db = makeDb(); ent(db, [{ productId: 'vip_month_39_9', expiresAt: Infinity }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'TIMED Infinity expiry → DENIED') }

  //  Unknown productId ⇒ DENY (never implicit permanent), regardless of expiry
  { const db = makeDb(); ent(db, [{ productId: 'unknown_id', expiresAt: FUTURE }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'UNKNOWN product (future expiry) → DENIED') }
  { const db = makeDb(); ent(db, [{ productId: 'unknown_id', expiresAt: 0 }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'UNKNOWN product (zero expiry) → DENIED') }
  { const db = makeDb(); ent(db, [{ productId: 'unknown_id' }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'UNKNOWN product (missing expiry) → DENIED') }

  //  Timed boundary: expiresAt == now ⇒ DENY; slightly future ⇒ ALLOW; slightly past ⇒ DENY
  { const db = makeDb(); ent(db, [{ productId: 'vip_month_39_9', expiresAt: Date.now() }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'TIMED boundary: expiresAt == now → DENIED (strict >)') }
  { const db = makeDb(); ent(db, [{ productId: 'vip_month_39_9', expiresAt: Date.now() + 5000 }])
    ok(ALLOW(await hasPermission(db, 'u', 'challenge_full')), 'TIMED boundary: expiresAt future → ALLOWED') }
  { const db = makeDb(); ent(db, [{ productId: 'vip_year_299', expiresAt: Date.now() + 5000 }])
    ok(ALLOW(await hasPermission(db, 'u', 'challenge_full')), 'TIMED annual boundary: expiresAt future → ALLOWED') }

  //  No dependence on a products DB row: a timed product denies even when the runtime
  //  products collection is absent (this is what R6C_R2 flagged as reachable in staging).
  { const db = makeDb(); ent(db, [{ productId: 'vip_month_39_9' }])   // no products collection consulted at all
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'TIMED missing expiry denied with NO products row (no durationDays=0 default)') }

  // ── 14) timezone / boundary semantics (absolute epoch; no wall-clock TZ dependence) ──
  { const db = makeDb(); ent(db, [{ productId: 'challenge_39_9', expiresAt: Date.now() }]) // == now → expired
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'boundary: expiresAt == now → denied (strict >)') }
  { const db = makeDb(); ent(db, [{ productId: 'challenge_39_9', expiresAt: Date.now() + 3000 }])
    ok(ALLOW(await hasPermission(db, 'u', 'challenge_full')), 'boundary: expiresAt slightly in future → allowed') }
  { const db = makeDb(); ent(db, [{ productId: 'challenge_39_9', expiresAt: Date.now() - 3000 }])
    ok(DENY(await hasPermission(db, 'u', 'challenge_full')), 'boundary: expiresAt slightly past → denied') }

  // ── 15) permission DB read failure → denied (fail-closed) ──
  { const db = makeDb()
    const bad = Object.assign({}, db, { collection: (n) => { if (n === 'entitlements') throw new Error('db down'); return db.collection(n) } })
    ok(DENY(await hasPermission(bad, 'u', 'challenge_full')), 'entitlements read throws → denied (fail-closed)') }
  { const db = makeDb(); ent(db, [{ productId: 'challenge_39_9', expiresAt: 0 }])
    const bad = Object.assign({}, db, { collection: (n) => { if (n === 'memberships') throw new Error('db down'); return db.collection(n) } })
    ok(ALLOW(await hasPermission(bad, 'u', 'challenge_full')), 'memberships read throws but valid ENTITLEMENT still allows') }

  // ── 16) concurrent expiry/check (documented, deterministic) ──
  //   Two checks straddling the expiry instant: before ⇒ allowed, after ⇒ denied.
  //   Authorization reads the source validity at check time and is monotonic under
  //   expiry (never re-grants once expired). No cached-permission resurrection.
  { const db = makeDb(); ent(db, [{ productId: 'challenge_39_9', expiresAt: Date.now() + 80 }])
    const before = await hasPermission(db, 'u', 'challenge_full')
    await new Promise((r) => setTimeout(r, 140))
    const after = await hasPermission(db, 'u', 'challenge_full')
    ok(before === true && after === false, 'concurrent expiry: valid before expiry → denied after (monotonic, no resurrection)') }

  // ── 17) legacy source compatibility (permanent legacy unlock strings preserved) ──
  { const db = makeDb(); ent(db, [{ productId: 'challenge_39_9', expiresAt: 0 }])
    ok(ALLOW(await hasPermission(db, 'u', 'challenge_unlock')), 'legacy permanent challenge_39_9 → challenge_unlock preserved') }
  { const db = makeDb(); ent(db, [{ productId: 'report_9_9', expiresAt: 0 }])
    ok(ALLOW(await hasPermission(db, 'u', 'report_unlock')), 'legacy permanent report_9_9 → report_unlock preserved') }

  // ── 18) NO DB writes during authorization (pure read) ──
  { const db = makeDb(); ent(db, [{ productId: 'vip_month_39_9', expiresAt: PAST }, { productId: 'report_9_9', expiresAt: 0 }])
    const entBefore = JSON.stringify(db._store.entitlements)
    const docCountBefore = Object.values(db._store).reduce((n, a) => n + a.length, 0)
    await hasPermission(db, 'u', 'challenge_full')   // expired VIP present
    await hasPermission(db, 'u', 'full_report')      // permanent report
    await new Promise((r) => setTimeout(r, 40))      // allow any fire-and-forget window to settle
    const docCountAfter = Object.values(db._store).reduce((n, a) => n + a.length, 0)
    ok(JSON.stringify(db._store.entitlements) === entBefore, 'authorization does NOT mutate the entitlements doc (pure read)')
    ok(docCountAfter === docCountBefore, 'authorization adds/removes ZERO documents (no cleanup side effect)') }

  // ── 19) integration: submit-gate denies expired-entitlement user at idx3, zero writes ──
  { const { makeDb: mk, seed: sd, stubCloud } = require('./_harness.js')
    const SC = path.join(__dirname, '../../cloudfunctions/submitChallengeChoice/index.js')
    const db = mk(); for (const e of bank) sd(db, 'challenge_events', e)
    sd(db, 'challenge_records', { _id: 'Z3', recordId: 'Z3', openid: 'u', mode: 'challenge', trialMode: true, status: 'processing', currentEventIndex: 3, choices: [], plan: { planVersion: 'rc8.14_v1', challengeLength: 30, eventBankVersion: 'b', eventIds: ids.slice(), createdAt: 1, source: 'personalized_v1' } })
    sd(db, 'entitlements', { _id: 'EZ', openid: 'u', permissions: ['challenge_full'], sources: [{ productId: 'challenge_39_9', expiresAt: PAST }] })
    const before = JSON.stringify(db._store.challenge_records.find((r) => r.recordId === 'Z3'))
    const restore = stubCloud('u', db)
    delete require.cache[require.resolve(SC)]
    const main = require(SC).main
    const r = await main({ recordId: 'Z3', eventId: ids[3], choiceKey: 'A' })
    restore()
    ok(r.code === 1002, 'integration: expired-source user denied at idx3 (1002)')
    ok(JSON.stringify(db._store.challenge_records.find((r) => r.recordId === 'Z3')) === before, 'integration: zero record writes on denial') }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
