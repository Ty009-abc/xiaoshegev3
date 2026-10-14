'use strict'
/**
 * tests/rc8.14/property.test.js — RC8_14_A randomized property test.
 * 1000 iterations asserting: no duplicate eventIds, no invalid eligibility,
 * no premature completion, no extra served question.
 */
const path = require('path')
const { makeDb, seed, makeBank } = require('./_harness.js')
const A = require(path.join(__dirname, '../../cloudfunctions/getChallengeEvent/lib/challengePlan.js'))
const { buildPersonalizedPlan } = require(path.join(__dirname, '../../cloudfunctions/getChallengeEvent/lib/challengePersonalization.js'))
const catalog = require(path.join(__dirname, '../../cloudfunctions/getChallengeEvent/lib/challengeEventCatalog.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const ITER = 1000
const OCCS = [null, '', '厨师', '白领', '个体老板', '外卖员', '宝妈', '学生', '技术人员', '销售']

function ctx (occ) {
  return { sixQText: '', message: '', explicitProfile: { occupation: occ || null, income: 8000, capital: { known: false } }, profile: null, challengeEvidence: null }
}

async function main () {
  console.log('RC8_14_A — PROPERTY TEST (iterations=' + ITER + ')')

  let dupViol = 0, eligViol = 0, lenViol = 0, prematureViol = 0, extraServeViol = 0, okCount = 0, insufficient = 0

  for (let i = 0; i < ITER; i++) {
    const n = [30, 28, 40, 120][i % 4]
    const occ = OCCS[i % OCCS.length]
    const db = makeDb()
    const bank = makeBank(n)
    for (const e of bank) seed(db, 'challenge_events', e)
    const record = { recordId: 'CR' + i, openid: 'u', mode: 'challenge', currentEventIndex: 0, choices: [] }
    const res = await A.buildPlan({ db, openid: 'u', record, ctx: ctx(occ), buildPersonalizedPlan })

    if (res.status === A.PLAN_STATUS.INSUFFICIENT) { insufficient++; continue }
    if (res.status !== A.PLAN_STATUS.OK) { lenViol++; continue }
    okCount++

    const ids = res.plan.eventIds
    // property: no duplicate eventIds
    if (new Set(ids).size !== ids.length || ids.length !== 30) dupViol++
    // property: no invalid eligibility (all ids in the active bank)
    const bankIds = new Set(bank.map((e) => e.eventId))
    if (!ids.every((id) => bankIds.has(id))) eligViol++
    // property: no invalid eligibility (occupation gate respected)
    if (occ) {
      const meta = catalog.EVENT_META
      if (ids.some((id) => ((meta[id] || {}).contraindications || []).includes(occ))) eligViol++
    }
    // property: no premature completion — index 30 yields null, index < 30 yields an id
    if (A.eventIdAtIndex(res.plan, 30) !== null) prematureViol++
    if (A.eventIdAtIndex(res.plan, 29) === null) prematureViol++
    // property: no extra served question (plan length exactly 30 → indices 0..29)
    if (A.eventIdAtIndex(res.plan, 31) !== null) extraServeViol++
  }

  ok(dupViol === 0, 'no plan has duplicate eventIds (violations=' + dupViol + ')')
  ok(eligViol === 0, 'no plan has an ineligible event (violations=' + eligViol + ')')
  ok(lenViol === 0, 'no OK plan has wrong length (violations=' + lenViol + ')')
  ok(prematureViol === 0, 'no premature completion / no missing last (violations=' + prematureViol + ')')
  ok(extraServeViol === 0, 'no extra served question beyond 30 (violations=' + extraServeViol + ')')
  ok(okCount > 0, 'property test exercised OK plans (' + okCount + ')')
  ok(insufficient > 0, 'property test exercised insufficient-pool path (' + insufficient + ')')

  console.log('  _TEST pass=' + pass + ' fail=' + fail + ' (ok=' + okCount + ' insufficient=' + insufficient + ')')
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
