'use strict'
/**
 * tests/rc8.14/plan-authority.test.js — RC8_14_A plan authority invariants.
 * Pure module + in-memory DB.
 */
const path = require('path')
const { makeDb, seed, makeBank } = require('./_harness.js')
const plan = require(path.join(__dirname, '../../cloudfunctions/getChallengeEvent/lib/challengePlan.js'))
const catalog = require(path.join(__dirname, '../../cloudfunctions/getChallengeEvent/lib/challengeEventCatalog.js'))
const { buildPersonalizedPlan } = require(path.join(__dirname, '../../cloudfunctions/getChallengeEvent/lib/challengePersonalization.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

function ctx (occ) {
  return { sixQText: '', message: '', explicitProfile: { occupation: occ || null, income: 8000, capital: { known: false }, goal: null }, profile: null, challengeEvidence: null }
}

async function buildWith (n, occ, record) {
  const db = makeDb()
  const bank = makeBank(n)
  for (const e of bank) seed(db, 'challenge_events', e)
  const rec = record || { recordId: 'CR1', openid: 'u', mode: 'challenge', currentEventIndex: 0, choices: [] }
  return plan.buildPlan({
    db, openid: 'u', record: rec, ctx: ctx(occ), buildPersonalizedPlan,
  })
}

async function main () {
  console.log('RC8_14_A — CHALLENGE PLAN AUTHORITY')

  // 30 eligible → exactly 30 distinct
  {
    const r = await buildWith(30, null)
    ok(r.status === plan.PLAN_STATUS.OK, '30-bank builds OK (' + r.status + ')')
    ok(r.plan.eventIds.length === 30, 'plan length 30')
    ok(new Set(r.plan.eventIds).size === 30, 'plan has 30 distinct ids')
    ok(r.plan.challengeLength === 30, 'challengeLength field = 30')
    ok(/^bank_/.test(r.plan.eventBankVersion), 'eventBankVersion set')
    ok(r.plan.planVersion === plan.PLAN_VERSION, 'planVersion set')
    ok(new Set(r.plan.eventIds).size === r.plan.eventIds.length && r.plan.eventIds.every((id) => /^CE\d{3}$/.test(id)), 'plan ids are a permutation of CE bank ids')
  }

  // 40 eligible → still exactly 30, distinct
  {
    const r = await buildWith(40, null)
    ok(r.status === plan.PLAN_STATUS.OK && r.plan.eventIds.length === 30 && new Set(r.plan.eventIds).size === 30, '40-bank → 30 distinct')
  }

  // 120 eligible → exactly 30
  {
    const r = await buildWith(120, null)
    ok(r.status === plan.PLAN_STATUS.OK && r.plan.eventIds.length === 30 && new Set(r.plan.eventIds).size === 30, '120-bank → 30 distinct')
  }

  // 28 eligible (厨师 filters CE004 + CE007 from the real 30-bank metadata) → FAIL CLOSED
  {
    const r = await buildWith(30, '厨师')
    ok(r.status === plan.PLAN_STATUS.INSUFFICIENT, '28-eligible → INSUFFICIENT_ELIGIBLE_EVENTS (' + r.status + ')')
    ok(r.eligibleCount === 28, 'reports eligibleCount=28 (got ' + r.eligibleCount + ')')
    ok(r.required === 30, 'reports required=30')
  }

  // determinism
  {
    const a = await buildWith(30, '白领')
    const b = await buildWith(30, '白领')
    ok(JSON.stringify(a.plan.eventIds) === JSON.stringify(b.plan.eventIds), 'plan construction is deterministic')
  }

  // ALREADY — never rebuild silently
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const rec = { recordId: 'CR9', openid: 'u', mode: 'challenge', currentEventIndex: 0, choices: [], plan: { planVersion: 'rc8.14_v1', challengeLength: 30, eventIds: makeBank(30).map((e) => e.eventId).slice(0, 30) } }
    rec.plan.eventIds = [...new Set(rec.plan.eventIds)]
    const r = await plan.buildPlan({ db, openid: 'u', record: rec, ctx: ctx(), buildPersonalizedPlan })
    ok(r.status === plan.PLAN_STATUS.ALREADY, 'existing valid plan → ALREADY (no rebuild)')
  }

  // validatePlan + eventIdAtIndex
  {
    const good = { planVersion: 'rc8.14_v1', challengeLength: 30, eventIds: makeBank(30).map((e) => e.eventId) }
    ok(plan.validatePlan(good, { mode: 'challenge' }).ok, 'validatePlan accepts 30 distinct')
    const dupIds = good.eventIds.slice(); dupIds[5] = dupIds[4]
    ok(!plan.validatePlan({ ...good, eventIds: dupIds }, { mode: 'challenge' }).ok, 'validatePlan rejects duplicate ids')
    ok(!plan.validatePlan({ ...good, eventIds: good.eventIds.slice(0, 29) }, { mode: 'challenge' }).ok, 'validatePlan rejects wrong length')
    ok(plan.eventIdAtIndex(good, 0) === 'CE001', 'eventIdAtIndex(0)')
    ok(plan.eventIdAtIndex(good, 30) === null, 'eventIdAtIndex(30) = null (no day 31)')
    ok(plan.eventIdAtIndex(good, 29) === 'CE030', 'eventIdAtIndex(29) = last')
  }

  // diagnostic length
  {
    const r = await buildWith(30, null, { recordId: 'CRd', openid: 'u', mode: 'diagnostic', currentEventIndex: 0, choices: [] })
    ok(r.status === plan.PLAN_STATUS.OK && r.plan.eventIds.length === 6, 'diagnostic → 6 distinct')
  }

  // legacy recovery: prefix preserved, distinct, no re-serve
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const rec = {
      recordId: 'CRleg', openid: 'u', mode: 'challenge', currentEventIndex: 3,
      choices: [{ eventId: 'CE005', choice: 'A' }, { eventId: 'CE001', choice: 'B' }, { eventId: 'CE003', choice: 'A' }],
    }
    const r = await plan.recoverLegacyPlan({ db, openid: 'u', record: rec, ctx: ctx(), buildPersonalizedPlan })
    ok(r.status === plan.PLAN_STATUS.OK, 'legacy recovery OK (' + r.status + ')')
    ok(JSON.stringify(r.plan.eventIds.slice(0, 3)) === JSON.stringify(['CE005', 'CE001', 'CE003']), 'legacy prefix preserved in order')
    ok(new Set(r.plan.eventIds).size === 30, 'legacy recovered plan has 30 distinct')
    ok(r.plan.source === 'legacy_recovery_v1', 'legacy plan source tagged')
  }

  // legacy unrecoverable: duplicate answered history refuses (never silently fix)
  {
    const db = makeDb()
    for (const e of makeBank(30)) seed(db, 'challenge_events', e)
    const rec = { recordId: 'CRbad', openid: 'u', mode: 'challenge', currentEventIndex: 2, choices: [{ eventId: 'CE001' }, { eventId: 'CE001' }] }
    const r = await plan.recoverLegacyPlan({ db, openid: 'u', record: rec, ctx: ctx(), buildPersonalizedPlan })
    ok(r.status === plan.PLAN_STATUS.UNRECOVERABLE, 'duplicate legacy history → UNRECOVERABLE (refuse)')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
