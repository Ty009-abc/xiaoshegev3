'use strict'
/**
 * tests/rc8.14/submit-atomicity.test.js — RC8_14_B submit concurrency semantics.
 *
 * Engine level (loads the REAL cloudfunction code + an in-memory CloudBase-like DB).
 * Covers the required conflict semantics:
 *   - same record/event, identical choice  → effect once, consistent (idempotent)
 *   - same event, different choices        → exactly one wins, others CONFLICT(409)
 *   - out-of-order / expired event         → no advance (PARAM_ERROR)
 *   - failure retry                        → no duplicate side effects
 *   - different record / different user    → isolated
 * NOT real-identity function level (that requires a bound client → BLOCKED elsewhere).
 */
const path = require('path')
const { makeDb, seed, stubCloud, makeBank } = require('./_harness.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const SC = path.join(__dirname, '../../cloudfunctions/submitChallengeChoice/index.js')
function load (db, openid) {
  const restore = stubCloud(openid || 'u', db)
  delete require.cache[require.resolve(SC)]
  return { main: require(SC).main, restore }
}
function planOf (ids) {
  return { planVersion: 'rc8.14_v1', challengeLength: ids.length, eventBankVersion: 'bank_x', eventIds: ids.slice(), createdAt: 1, source: 'personalized_v1' }
}
function bankInto (db, n) { const b = makeBank(n); for (const e of b) seed(db, 'challenge_events', e); return b }
const rec1 = (db, rid) => db._store.challenge_records.find((x) => x.recordId === rid)

async function main () {
  console.log('RC8_14_B — SUBMIT ATOMICITY / CONFLICT SEMANTICS (engine level)')

  // 1) duplicate identical submit (sequential) → idempotent, no double score
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CR1', openid: 'u', mode: 'challenge', status: 'processing', currentEventIndex: 0, choices: [], plan: planOf(ids) })
    const { main: fn, restore } = load(db)
    const a = await fn({ recordId: 'CR1', eventId: ids[0], choiceKey: 'A' })
    const b = await fn({ recordId: 'CR1', eventId: ids[0], choiceKey: 'A' })
    restore()
    const rec = rec1(db, 'CR1')
    ok(a.code === 0 && b.code === 0, 'both identical submits return code 0')
    ok(b.data.duplicate === true && b.data.idempotent === true, '2nd identical submit flagged idempotent')
    ok(rec.choices.length === 1, 'exactly one choice recorded (no double score)')
    ok(rec.currentEventIndex === 1, 'index advanced exactly once')
    ok(rec.rawScores.longTermism === (bank[0].choices[0].effects.longTermism), 'rawScores not double-accumulated')
  }

  // 2) concurrent identical submits → one effect, consistent index
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CR2', openid: 'u', mode: 'challenge', status: 'processing', currentEventIndex: 0, choices: [], plan: planOf(ids) })
    const { main: fn, restore } = load(db)
    const res = await Promise.all(Array.from({ length: 6 }, () => fn({ recordId: 'CR2', eventId: ids[0], choiceKey: 'A' })))
    restore()
    const rec = rec1(db, 'CR2')
    const successes = res.filter((r) => r.code === 0 && !r.data.duplicate)
    ok(successes.length === 1, 'exactly one first-writer success under 6 concurrent identical submits')
    ok(rec.choices.length === 1 && rec.currentEventIndex === 1, 'index advanced once, one choice')
    ok(res.every((r) => r.code === 0), 'all concurrent identical submits return code 0 (idempotent convergence)')
    ok(new Set(res.map((r) => r.data.currentEventIndex)).size === 1, 'all report the same resulting index')
  }

  // 3) concurrent DIFFERENT choices on same current event → one wins, others CONFLICT
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CR3', openid: 'u', mode: 'challenge', status: 'processing', currentEventIndex: 0, choices: [], plan: planOf(ids) })
    const { main: fn, restore } = load(db)
    const keys = ['A', 'B', 'A', 'B', 'A', 'B']
    const res = await Promise.all(keys.map((k) => fn({ recordId: 'CR3', eventId: ids[0], choiceKey: k })))
    restore()
    const rec = rec1(db, 'CR3')
    const winner = rec.choices[0].choice
    const conflicts = res.filter((r) => r.code === 409)
    const successes = res.filter((r) => r.code === 0 && !r.data.duplicate)
    ok(successes.length === 1, 'exactly one winner under concurrent DIFFERENT choices')
    ok(rec.choices.length === 1, 'only one choice recorded')
    ok(rec.currentEventIndex === 1, 'index advanced exactly once')
    ok(conflicts.length === keys.filter((k) => k !== winner).length, 'all differing-choice requests returned CONFLICT(409)')
    ok(res.filter((r) => r.code === 0).every((r) => r.data.choice === winner), 'all code-0 responses correspond to the winning choice only')
    ok(conflicts.every((r) => r.data && r.data.conflict === true), 'conflict payload marked')
  }

  // 4) out-of-order / expired event → no advance
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CR4', openid: 'u', mode: 'challenge', status: 'processing', currentEventIndex: 5, choices: ids.slice(0, 5).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(ids) })
    const { main: fn, restore } = load(db)
    const stale = await fn({ recordId: 'CR4', eventId: ids[2], choiceKey: 'B' }) // already answered, diff choice
    const ahead = await fn({ recordId: 'CR4', eventId: ids[9], choiceKey: 'A' }) // future event, not current
    const current = await fn({ recordId: 'CR4', eventId: ids[5], choiceKey: 'A' }) // correct current
    restore()
    const rec = rec1(db, 'CR4')
    ok(stale.code === 409, 're-submitting an already-answered event with a different choice → CONFLICT')
    ok(ahead.code === 400, 'submitting a non-current (future) event → PARAM_ERROR')
    ok(current.code === 0 && current.data.currentEventIndex === 6, 'only the current event advances')
    ok(rec.currentEventIndex === 6 && rec.choices.length === 6, 'expired/out-of-order submissions did not advance index')
  }

  // 5) failure retry → no duplicate side effects (retry of a successful write is idempotent)
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CR5', openid: 'u', mode: 'challenge', status: 'processing', currentEventIndex: 0, choices: [], plan: planOf(ids) })
    const { main: fn, restore } = load(db)
    const first = await fn({ recordId: 'CR5', eventId: ids[0], choiceKey: 'A' })
    const retry1 = await fn({ recordId: 'CR5', eventId: ids[0], choiceKey: 'A' })
    const retry2 = await fn({ recordId: 'CR5', eventId: ids[0], choiceKey: 'A' })
    restore()
    const rec = rec1(db, 'CR5')
    ok(first.code === 0 && retry1.code === 0 && retry2.code === 0, 'retries all succeed (idempotent)')
    ok(rec.choices.length === 1 && rec.currentEventIndex === 1, 'retries produced no duplicate side effects')
    ok(retry1.data.currentEventIndex === first.data.currentEventIndex, 'retry reports the same index as the original')
  }

  // 6) isolation: two records / two users, concurrent → independent advances
  {
    const db = makeDb(); const bank = bankInto(db, 30); const ids = bank.map((e) => e.eventId)
    seed(db, 'challenge_records', { recordId: 'CRA', openid: 'ua', mode: 'challenge', status: 'processing', currentEventIndex: 0, choices: [], plan: planOf(ids) })
    seed(db, 'challenge_records', { recordId: 'CRB', openid: 'ub', mode: 'challenge', status: 'processing', currentEventIndex: 0, choices: [], plan: planOf(ids) })
    let r1, r2, restore1, restore2
    ;({ main: r1, restore: restore1 } = load(db, 'ua'))
    const fnA = r1
    restore1()
    ;({ main: r2, restore: restore2 } = load(db, 'ub'))
    const fnB = r2
    restore2()
    // load both under separate stubs is tricky; instead run with a per-call openid stub
    const resA = await runWith(db, 'ua', 'CRA', ids[0], 'A')
    const resB = await runWith(db, 'ub', 'CRB', ids[0], 'B')
    const a = rec1(db, 'CRA'); const b = rec1(db, 'CRB')
    ok(resA.code === 0 && resB.code === 0, 'both users submit successfully')
    ok(a.choices.length === 1 && b.choices.length === 1, 'each record has exactly its own one choice')
    ok(a.choices[0].choice === 'A' && b.choices[0].choice === 'B', 'choices did not cross-contaminate')
    ok(a.currentEventIndex === 1 && b.currentEventIndex === 1, 'both advanced independently')
    ok(resA.code === 0 && (await runWith(db, 'ua', 'CRB', ids[0], 'A')).code === 404, 'user cannot write another user record')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}

async function runWith (db, openid, recordId, eventId, choiceKey) {
  const { main: fn, restore } = load(db, openid)
  try { return await fn({ recordId, eventId, choiceKey }) } finally { restore() }
}

main().catch((e) => { console.error(e); process.exit(1) })
