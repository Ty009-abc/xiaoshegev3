'use strict'
/**
 * tests/rc8.14/completion.test.js — RC8_14_A completion + idempotency.
 * submitChallengeChoice: plan authority, duplicate submit, day clamp, isLast.
 */
const path = require('path')
const { makeDb, seed, stubCloud, makeBank } = require('./_harness.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const FN = path.join(__dirname, '../../cloudfunctions/submitChallengeChoice/index.js')
function loadFn (db, openid) {
  const restore = stubCloud(openid || 'u', db)
  delete require.cache[require.resolve(FN)]
  const main = require(FN).main
  return { main, restore }
}
function planOf (ids) {
  return { planVersion: 'rc8.14_v1', challengeLength: ids.length, eventBankVersion: 'bank_x', eventIds: ids.slice(), createdAt: 1, source: 'personalized_v1' }
}
function baseBank () { return makeBank(30) }

async function main () {
  console.log('RC8_14_A — COMPLETION + IDEMPOTENCY')

  // 1) submit at index 0 (expected plan[0]) → advance
  {
    const db = makeDb()
    for (const e of baseBank()) seed(db, 'challenge_events', e)
    const ids = baseBank().map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CR1', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 0, choices: [], plan: planOf(ids) })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CR1', eventId: ids[0], choiceKey: 'A' })
    restore()
    ok(r.code === 0, 'submit OK')
    ok(r.data.currentEventIndex === 1, 'index advanced to 1')
    ok(r.data.isLast === false, 'not last')
  }

  // 2) duplicate submission of an already-answered event → idempotent, no advance
  {
    const db = makeDb()
    for (const e of baseBank()) seed(db, 'challenge_events', e)
    const ids = baseBank().map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CR2', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 2, choices: [{ eventId: ids[0], choice: 'A' }, { eventId: ids[1], choice: 'B' }], plan: planOf(ids) })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CR2', eventId: ids[0], choiceKey: 'A' }) // resubmit index 0
    restore()
    ok(r.code === 0 && r.data.idempotent === true, 'duplicate submit → idempotent (no re-score)')
    ok(r.data.currentEventIndex === 2, 'index NOT advanced on duplicate')
    const rec = db._store.challenge_records.find((x) => x.recordId === 'CR2')
    ok(rec.choices.length === 2, 'choices unchanged on duplicate')
  }

  // 3) out-of-order / invalid transition → rejected
  {
    const db = makeDb()
    for (const e of baseBank()) seed(db, 'challenge_events', e)
    const ids = baseBank().map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CR3', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 5, choices: [], plan: planOf(ids) })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CR3', eventId: ids[9], choiceKey: 'A' }) // wrong event for index 5
    restore()
    ok(r.code !== 0, 'invalid index transition → rejected')
  }

  // 4) final submission (index 29) → finished, day 30 (never 31), finalType set
  {
    const db = makeDb()
    for (const e of baseBank()) seed(db, 'challenge_events', e)
    const ids = baseBank().map((e) => e.eventId)
    const choices = []
    for (let i = 0; i < 29; i++) choices.push({ eventId: ids[i], choice: 'A' })
    seed(db, 'challenge_records', { recordId: 'CR4', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 29, choices, plan: planOf(ids) })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CR4', eventId: ids[29], choiceKey: 'A' })
    restore()
    ok(r.code === 0, 'final submit OK')
    ok(r.data.isLast === true && r.data.status === 'finished', 'isLast + finished on 30th')
    const rec = db._store.challenge_records.find((x) => x.recordId === 'CR4')
    ok(rec.currentDay === 30, 'currentDay clamped = 30 (never 31)')
    ok(rec.choices.length === 30, 'exactly 30 submissions recorded')
    ok(typeof rec.finalType === 'string' && rec.finalType.length > 0, 'finalType computed')
  }

  // 5) no early completion: only 30 valid submissions end the challenge
  {
    const db = makeDb()
    for (const e of baseBank()) seed(db, 'challenge_events', e)
    const ids = baseBank().map((e) => e.eventId)
    const choices = []
    for (let i = 0; i < 10; i++) choices.push({ eventId: ids[i], choice: 'A' })
    seed(db, 'challenge_records', { recordId: 'CR5', openid: 'u', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 10, choices, plan: planOf(ids) })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CR5', eventId: ids[10], choiceKey: 'A' })
    restore()
    ok(r.data.isLast === false && r.data.status === 'processing', 'not finished at 11/30')
  }

  // 6) AI report idempotency source check: finished state blocks resubmission
  {
    const db = makeDb()
    for (const e of baseBank()) seed(db, 'challenge_events', e)
    const ids = baseBank().map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CR6', openid: 'u', mode: 'challenge', status: 'finished', trialMode: false, currentEventIndex: 30, choices: [], plan: planOf(ids) })
    const { main: fn, restore } = loadFn(db)
    const r = await fn({ recordId: 'CR6', eventId: ids[0], choiceKey: 'A' })
    restore()
    ok(r.code !== 0, 'finished record rejects further submits (report idempotency preserved)')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
