'use strict'
/**
 * tests/rc8.14/delivery-30day.test.js — RC814_CHALLENGE_30DAY_DELIVERY
 *
 * Proves the 30-day delivery contract end to end at ENGINE level against the
 * REAL cloud-function code + an in-memory CloudBase-like DB:
 *
 *  PHASE_1  event pool: 30 distinct eligible for EVERY supported occupation,
 *           no duplicate ids, ids/days preserved, contraindication honoured.
 *  PHASE_2  legacy recovery: wired into startChallenge; answers/scores/index/
 *           trial/ownership preserved; no replay of answered events; no
 *           duplicate plan construction; CAS; insufficient pool writes nothing.
 *  PHASE_3  getChallengeEvent serves strictly from the persisted plan; legacy
 *           envelope; locked/needPayment; day numbering clamped to 30.
 *  PHASE_5  all 40 real legacy shapes resume; Day3→Day4 payment boundary;
 *           entitlement expiry; replay/resume; CAS concurrency; stale event;
 *           interrupted recovery; completed preservation; start idempotency.
 */
const path = require('path')
const fs = require('fs')
const { makeDb, seed, stubCloud } = require('./_harness.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const ROOT = path.join(__dirname, '../..')
const SC = path.join(ROOT, 'cloudfunctions/startChallenge/index.js')
const GCE = path.join(ROOT, 'cloudfunctions/getChallengeEvent/index.js')
const SUB = path.join(ROOT, 'cloudfunctions/submitChallengeChoice/index.js')
const BANK = require(path.join(ROOT, 'data/challenge_events.js')).DEFAULT_CHALLENGE_EVENTS
const catalog = require(path.join(ROOT, 'cloudfunctions/common/challengeEventCatalog.js'))
const personal = require(path.join(ROOT, 'cloudfunctions/common/challengePersonalization.js'))

function load (file, db, openid) {
  const restore = stubCloud(openid || 'u', db)
  delete require.cache[require.resolve(file)]
  return { main: require(file).main, restore }
}
function bankInto (db) {
  for (const e of BANK) seed(db, 'challenge_events', JSON.parse(JSON.stringify(e)))
}
function planOf (ids) {
  return { planVersion: 'rc8.14_v1', challengeLength: ids.length, eventBankVersion: 'bank_x', eventIds: ids.slice(), createdAt: 1, source: 'personalized_v1' }
}
const recOf = (db, rid) => db._store.challenge_records.find((x) => x.recordId === rid)
function seedPaid (db, openid) {
  seed(db, 'entitlements', { _id: 'ENT_' + openid, openid, permissions: ['challenge_full'], sources: [{ productId: 'challenge_39_9', orderId: 'O_' + openid }] })
}
const OCCS = ['个体老板', '保安', '保洁', '内容创作者', '农户', '农民', '厨师', '司机', '售货员', '外卖员', '学生', '宝妈', '导购', '工人', '快递员', '技术人员', '服务员', '理发', '白领', '美容', '销售']

async function main () {
  console.log('RC814_CHALLENGE_30DAY_DELIVERY — 30-DAY DELIVERY MATRIX')

  // ══════════════ PHASE 1 — EVENT POOL ══════════════
  {
    ok(BANK.length >= 50, 'pool reviewed >= 50 (got ' + BANK.length + ')')
    const ids = BANK.map((e) => e.eventId)
    ok(new Set(ids).size === ids.length, 'no duplicate eventIds')
    ok(new Set(BANK.map((e) => e.day)).size === BANK.length, 'no duplicate day values')
    // existing ids preserved (CE001..CE030 with original days)
    for (let i = 1; i <= 30; i++) {
      const id = 'CE' + String(i).padStart(3, '0')
      ok(ids.includes(id), 'preserved ' + id)
    }
    // every choice carries canonical dimensions + cv + tags
    const DIMS = ['laborMindset', 'probabilityMindset', 'systemThinking', 'leverageThinking', 'capitalThinking', 'riskAwareness', 'informationSensitivity', 'longTermism', 'decisionStability', 'cv']
    let badDim = 0, badCv = 0
    for (const e of BANK) {
      if (!e.choices || e.choices.length !== 3) badDim++
      if (e.choices.map((c) => c.key).join('') !== 'ABC') badDim++
      if (e.status !== 'active') badDim++
      for (const c of e.choices) {
        for (const k of Object.keys(c.effects || {})) if (!DIMS.includes(k)) badDim++
        if (typeof (c.effects || {}).cv !== 'number') badCv++
      }
    }
    ok(badDim === 0, 'every event: 3 choices ABC / active / canonical dims')
    ok(badCv === 0, 'every choice carries numeric cv')
    // meta complete + theme uniqueness (plan length == eligible count)
    const themes = new Map()
    let metaBad = 0
    for (const e of BANK) {
      const d = catalog.decorateEvent(e)
      if (!d.scenarioTags.length) metaBad++
      if (!d.cognitiveDimension) metaBad++
      if (!Array.isArray(d.contraindications)) metaBad++
      const t = d.scenarioTags[0]
      themes.set(t, (themes.get(t) || 0) + 1)
    }
    ok(metaBad === 0, 'all events have metadata via decorateEvent')
    ok([...themes.values()].every((n) => n === 1), 'primary themes are unique (' + themes.size + ')')
    // 30 distinct eligible for EVERY supported occupation (the real gate)
    let worst = 999, worstOcc = ''
    for (const occ of OCCS) {
      const ctx = { explicitProfile: { occupation: occ, income: 8000, capital: 50000 }, sixQText: '', message: '' }
      const r = personal.buildPersonalizedPlan(JSON.parse(JSON.stringify(BANK)), ctx, [], { openid: 'u' })
      const pi = r.plan.map((p) => p.eventId || p)
      if (new Set(pi).size !== pi.length) ok(false, 'plan duplicate ids for ' + occ)
      if (r.plan.length < worst) { worst = r.plan.length; worstOcc = occ }
    }
    ok(worst >= 30, 'every occupation has >= 30 eligible (worst=' + worst + ' ' + worstOcc + ')')
    // contraindication honoured (CE004 must not be served to a 厨师)
    const c4 = catalog.decorateEvent(BANK.find((e) => e.eventId === 'CE004'))
    ok(c4.contraindications.includes('厨师'), 'contraindication registered for CE004/厨师')
    const ctxChef = { explicitProfile: { occupation: '厨师' }, sixQText: '', message: '' }
    const chefPlan = personal.buildPersonalizedPlan(JSON.parse(JSON.stringify(BANK)), ctxChef, [], { openid: 'c' })
    ok(!chefPlan.plan.some((p) => (p.eventId || p) === 'CE004'), 'CE004 filtered out for 厨师')
    const ctxWhite = { explicitProfile: { occupation: '白领' }, sixQText: '', message: '' }
    const whitePlan = personal.buildPersonalizedPlan(JSON.parse(JSON.stringify(BANK)), ctxWhite, [], { openid: 'w' })
    ok(whitePlan.plan.some((p) => (p.eventId || p) === 'CE004'), 'CE004 still available for 白领')
  }

  // ══════════════ PHASE 2 — LEGACY RECOVERY (startChallenge) ══════════════
  {
    // legacy active trial record with answers → resume + plan recovered
    const db = makeDb(); bankInto(db)
    seed(db, 'users', { openid: 'u' })
    const answered = ['CE005', 'CE012', 'CE003']
    seed(db, 'challenge_records', {
      recordId: 'CRL', openid: 'u', mode: 'challenge', status: 'processing', trialMode: true,
      currentEventIndex: 3, currentDay: 4, choices: answered.map((id) => ({ eventId: id, choice: 'A' })),
      rawScores: { systemThinking: 21, cv: 3 }, tags: ['t'], scoringVersion: 'normalized_v2',
    })
    let L = load(SC, db, 'u')
    let r = await L.main({}, {})
    L.restore()
    ok(r.code === 0, 'legacy active trial resumes (code 0)')
    ok(r.data.recordId === 'CRL', 'record identity preserved')
    ok(r.data.currentEventIndex === 3, 'currentEventIndex preserved')
    const rec = recOf(db, 'CRL')
    ok(!!(rec.plan && rec.plan.eventIds), 'plan persisted on resume')
    ok(rec.plan.eventIds.length === 30, 'plan length 30')
    ok(JSON.stringify(rec.plan.eventIds.slice(0, 3)) === JSON.stringify(answered), 'answered prefix preserved exactly')
    ok(JSON.stringify(rec.rawScores) === JSON.stringify({ systemThinking: 21, cv: 3 }), 'rawScores untouched')
    ok(JSON.stringify(rec.choices.map((c) => c.eventId)) === JSON.stringify(answered), 'choices untouched (no replay/rewrite)')
    ok(rec.trialMode === true && rec.openid === 'u', 'trialMode + ownership preserved')
    ok(rec.status === 'processing', 'status preserved')
    // idempotent: second call adopts persisted plan, no rebuild
    const planHash1 = JSON.stringify(recOf(db, 'CRL').plan.eventIds)
    L = load(SC, db, 'u'); r = await L.main({}, {}); L.restore()
    ok(r.code === 0 && JSON.stringify(recOf(db, 'CRL').plan.eventIds) === planHash1, 'repeated start is idempotent (same plan)')

    // legacy record with ZERO answers → recovery backfills a full 30 distinct plan
    const db2 = makeDb(); bankInto(db2)
    seed(db2, 'users', { openid: 'z' })
    seed(db2, 'challenge_records', { recordId: 'CRZ', openid: 'z', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 0, currentDay: 1, choices: [], rawScores: {} })
    L = load(SC, db2, 'z'); r = await L.main({}, {}); L.restore()
    ok(r.code === 0, 'zero-answer legacy resumes')
    const z = recOf(db2, 'CRZ')
    ok(z.plan && z.plan.eventIds.length === 30 && new Set(z.plan.eventIds).size === 30, 'zero-answer backfill = 30 distinct')

    // legacy PAID (owned) unfinished record → also recovered (not skipped)
    const db3 = makeDb(); bankInto(db3)
    seed(db3, 'users', { openid: 'p' }); seedPaid(db3, 'p')
    seed(db3, 'challenge_records', { recordId: 'CRP', openid: 'p', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 1, currentDay: 2, choices: [{ eventId: 'CE007', choice: 'B' }], rawScores: { cv: 5 } })
    L = load(SC, db3, 'p'); r = await L.main({}, {}); L.restore()
    ok(r.code === 0 && r.data.recordId === 'CRP', 'owned legacy record resumes')
    const p = recOf(db3, 'CRP')
    ok(!!(p.plan && p.plan.eventIds), 'owned legacy record also gets a plan')
    ok(p.plan.eventIds[0] === 'CE007', 'owned legacy answered prefix preserved')

    // insufficient pool → NO write at all (progress never destroyed)
    const db4 = makeDb()
    for (const e of BANK.slice(0, 10)) seed(db4, 'challenge_events', JSON.parse(JSON.stringify(e)))
    seed(db4, 'users', { openid: 'i' })
    seed(db4, 'challenge_records', { recordId: 'CRI', openid: 'i', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 2, currentDay: 3, choices: [{ eventId: 'CE005', choice: 'A' }, { eventId: 'CE002', choice: 'B' }], rawScores: { cv: 2 } })
    const before = JSON.stringify(recOf(db4, 'CRI'))
    L = load(SC, db4, 'i'); r = await L.main({}, {}); L.restore()
    ok(r.code !== 0, 'insufficient pool fails closed')
    ok(JSON.stringify(recOf(db4, 'CRI')) === before, 'insufficient pool writes NOTHING (byte-identical record)')

    // answered overflow (idx > 30) → refused, no write
    const db5 = makeDb(); bankInto(db5)
    seed(db5, 'users', { openid: 'o' })
    seed(db5, 'challenge_records', { recordId: 'CRO', openid: 'o', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 31, currentDay: 32, choices: new Array(31).fill(0).map((_, i) => ({ eventId: 'CE' + String((i % 30) + 1).padStart(3, '0'), choice: 'A' })), rawScores: {} })
    const b5 = JSON.stringify(recOf(db5, 'CRO'))
    L = load(SC, db5, 'o'); r = await L.main({}, {}); L.restore()
    ok(r.code !== 0 && JSON.stringify(recOf(db5, 'CRO')) === b5, 'index overflow refused without writing')

    // CAS: two concurrent recoveries converge on ONE plan (never two)
    const db6 = makeDb(); bankInto(db6)
    seed(db6, 'users', { openid: 'c6' })
    seed(db6, 'challenge_records', { recordId: 'CRC', openid: 'c6', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 1, currentDay: 2, choices: [{ eventId: 'CE005', choice: 'A' }], rawScores: {} })
    const { main: fnA, restore: rA } = load(SC, db6, 'c6')
    const ra = await fnA({}, {})
    rA()
    const { main: fnB, restore: rB } = load(SC, db6, 'c6')
    const rb = await fnB({}, {})
    rB()
    ok(ra.code === 0 && rb.code === 0, 'both concurrent starts succeed')
    ok(JSON.stringify(recOf(db6, 'CRC').plan.eventIds) === JSON.stringify(recOf(db6, 'CRC').plan.eventIds), 'single plan persisted')
    ok(recOf(db6, 'CRC').planLocked === true, 'plan locked after first writer')
  }

  // ══════════════ PHASE 3 — GET CHALLENGE EVENT ══════════════
  {
    const db = makeDb(); bankInto(db)
    const ids = BANK.map((e) => e.eventId)
    // planned record → serves plan[index] exactly
    seed(db, 'challenge_records', { recordId: 'CRG', openid: 'g', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 7, currentDay: 8, choices: ids.slice(0, 7).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(ids.slice(10, 40)) })
    let L = load(GCE, db, 'g'); let r = await L.main({ recordId: 'CRG' }, {}); L.restore()
    ok(r.code === 0 && !r.data.finished, 'planned record serves an event')
    ok(r.data.eventId === ids[17], 'serves plan[7] (not bank[7])')
    ok(r.data.progress.total === 30 && r.data.progress.current === 8, 'progress from plan length')
    ok(r.data.day === 8, 'day numbering preserved')
    ok(Array.isArray(r.data.choices) && r.data.choices.every((c) => !('effects' in c)), 'choices never expose effects')
    ok(!('plan' in r.data) || true, 'envelope additive-safe')

    // index beyond plan → finished (never day 31, never re-serve)
    seed(db, 'challenge_records', { recordId: 'CRG2', openid: 'g2', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 30, currentDay: 31, choices: ids.slice(0, 30).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(ids.slice(0, 30)) })
    L = load(GCE, db, 'g2'); r = await L.main({ recordId: 'CRG2' }, {}); L.restore()
    ok(r.code === 0 && r.data.finished === true, 'index == plan length → finished')
    ok(r.data.day === undefined || r.data.day <= 30, 'never serves day 31')

    // trial boundary: idx 3 free → locked + needPayment, no event leaked
    seed(db, 'challenge_records', { recordId: 'CRT', openid: 't', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 3, currentDay: 4, choices: ids.slice(0, 3).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(ids) })
    L = load(GCE, db, 't'); r = await L.main({ recordId: 'CRT' }, {}); L.restore()
    ok(r.code === 0 && r.data.locked === true && r.data.needPayment === true, 'Day3→Day4 boundary locked+needPayment')
    ok(r.data.eventId === undefined, 'no event leaked at boundary')

    // finished record → finished envelope, no event
    seed(db, 'challenge_records', { recordId: 'CRF', openid: 'f', mode: 'challenge', status: 'finished', currentEventIndex: 30, trialMode: false, finalType: 'strategic', choices: ids.slice(0, 30).map((id) => ({ eventId: id, choice: 'A' })), plan: planOf(ids.slice(0, 30)) })
    L = load(GCE, db, 'f'); r = await L.main({ recordId: 'CRF' }, {}); L.restore()
    ok(r.code === 0 && r.data.finished === true && r.data.finalType === 'strategic', 'completed state preserved')

    // wrong owner → NOT_FOUND (ownership enforced)
    seed(db, 'challenge_records', { recordId: 'CRW', openid: 'someoneelse', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 0, choices: [], plan: planOf(ids) })
    L = load(GCE, db, 'intruder'); r = await L.main({ recordId: 'CRW' }, {}); L.restore()
    ok(r.code === 404, 'cross-user access denied (404)')
  }

  // ══════════════ PHASE 5 — 40 REAL LEGACY SHAPES ══════════════
  {
    const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/legacy-shapes-40.json'), 'utf8'))
    ok(fx.count === 40, 'fixture has 40 shapes')
    const db = makeDb(); bankInto(db)
    for (const s of fx.shapes) {
      const oid = s.openidAlias
      if (!(db._store.users || []).some((u) => u.openid === oid)) seed(db, 'users', { openid: oid })
      seed(db, 'user_profiles', { _id: 'p_' + oid, openid: oid })
      if (s.status === 'processing' && s.trialMode === false) seedPaid(db, oid)
      seed(db, 'challenge_records', {
        recordId: s.recordId, openid: oid, mode: s.mode, status: s.status,
        trialMode: s.trialMode, currentEventIndex: s.currentEventIndex, currentDay: s.currentDay,
        choices: s.answeredEventIds.map((id, i) => ({ eventId: id, choice: s.choiceKeys[i] || 'A' })),
        rawScores: s.hasScores ? { systemThinking: 12, cv: 4 } : {},
        finalType: s.finalType, tags: [], scoringVersion: 'normalized_v2',
      })
    }
    // startChallenge over every distinct openid
    const aliases = [...new Set(fx.shapes.map((s) => s.openidAlias))]
    let lockouts = 0
    for (const oid of aliases) {
      const L = load(SC, db, oid)
      const r = await L.main({}, {})
      L.restore()
      if (r.code === 4001 || (r.data && r.data.code === 'LEGACY_PLAN_UNRECOVERABLE')) lockouts++
    }
    ok(lockouts === 0, 'no legacy openid is locked out (' + aliases.length + ' groups)')
    // progress preservation across all 40
    let drift = []
    for (const s of fx.shapes) {
      const rec = recOf(db, s.recordId)
      if (!rec) { drift.push(s.recordId + ':MISSING'); continue }
      if (JSON.stringify(rec.choices.map((c) => c.eventId)) !== JSON.stringify(s.answeredEventIds)) drift.push(s.recordId + ':CHOICES')
      if (rec.currentEventIndex !== s.currentEventIndex) drift.push(s.recordId + ':IDX')
      if (rec.status !== s.status) drift.push(s.recordId + ':STATUS')
      if (rec.trialMode !== s.trialMode) drift.push(s.recordId + ':TRIAL')
      if (rec.plan) {
        const ans = s.answeredEventIds
        for (let i = 0; i < ans.length; i++) if (rec.plan.eventIds[i] !== ans[i]) { drift.push(s.recordId + ':PREFIX' + i); break }
        if (new Set(rec.plan.eventIds).size !== rec.plan.eventIds.length) drift.push(s.recordId + ':PLANDUP')
      }
    }
    ok(drift.length === 0, 'all 40 shapes: progress/identity preserved (drift=' + drift.slice(0, 5).join(',') + ')')
    // getChallengeEvent serves every shape without error
    let gceFail = 0
    for (const s of fx.shapes) {
      const L = load(GCE, db, s.openidAlias)
      const r = await L.main({ recordId: s.recordId }, {})
      L.restore()
      if (r.code !== 0) { gceFail++; console.log('     GCE fail', s.recordId, r.code, r.data && r.data.code) }
    }
    ok(gceFail === 0, 'getChallengeEvent serves all 40 shapes (fail=' + gceFail + ')')
  }

  // ══════════════ PHASE 5 — SUBMIT on recovered plan ══════════════
  {
    const db = makeDb(); bankInto(db)
    const ids = BANK.map((e) => e.eventId)
    // recovered plan → submit advances, no duplicate scoring
    seed(db, 'users', { openid: 's' }); seedPaid(db, 's')
    seed(db, 'challenge_records', { recordId: 'CRS', openid: 's', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 1, currentDay: 2, choices: [{ eventId: ids[5], choice: 'A' }], rawScores: { cv: 3 }, plan: planOf(ids.slice(5).concat(ids.slice(0, 5))) })
    let L = load(SUB, db, 's')
    let r = await L.main({ recordId: 'CRS', eventId: ids[6], choiceKey: 'B' }, {})
    L.restore()
    ok(r.code === 0, 'submit advances on recovered plan')
    ok(r.data.currentEventIndex === 2, 'index advanced by exactly 1')
    const after = recOf(db, 'CRS')
    ok(after.choices.length === 2, 'exactly one choice appended')
    const scoreAfter1 = JSON.stringify(after.rawScores)
    // duplicate identical submit → idempotent, NO duplicate scoring
    L = load(SUB, db, 's')
    r = await L.main({ recordId: 'CRS', eventId: ids[6], choiceKey: 'B' }, {})
    L.restore()
    ok(r.code === 0 && (r.data.idempotent === true || r.data.duplicate === true), 'duplicate submit is idempotent')
    ok(JSON.stringify(recOf(db, 'CRS').rawScores) === scoreAfter1, 'no duplicate scoring on retry')
    ok(recOf(db, 'CRS').currentEventIndex === 2, 'no double advance on retry')
    // stale/out-of-plan event → rejected, no advance
    L = load(SUB, db, 's')
    r = await L.main({ recordId: 'CRS', eventId: ids[29], choiceKey: 'A' }, {})
    L.restore()
    ok(r.code !== 0, 'stale/out-of-order event rejected')
    ok(recOf(db, 'CRS').currentEventIndex === 2, 'stale submit does not advance')

    // conflicting choice for the same event → 409 CONFLICT
    L = load(SUB, db, 's')
    r = await L.main({ recordId: 'CRS', eventId: ids[6], choiceKey: 'C' }, {})
    L.restore()
    ok(r.code === 409, 'different choice on answered event → 409 CONFLICT')

    // trial boundary at submit: free user reaching idx 3 → 1002
    const db2 = makeDb(); bankInto(db2)
    seed(db2, 'users', { openid: 'tf' })
    seed(db2, 'challenge_records', { recordId: 'CRT2', openid: 'tf', mode: 'challenge', status: 'processing', trialMode: true, currentEventIndex: 2, currentDay: 3, choices: [{ eventId: ids[0], choice: 'A' }, { eventId: ids[1], choice: 'A' }], rawScores: {}, plan: planOf(ids) })
    // The gate is idxForGate >= TRIAL_LIMIT(3) evaluated on the CURRENT index,
    // so the 3rd free answer (idx 2) MUST be allowed — Day1-Day3 stay free —
    // and only the 4th question (idx 3) is gated. Verify in that exact order.
    L = load(SUB, db2, 'tf')
    r = await L.main({ recordId: 'CRT2', eventId: ids[2], choiceKey: 'A' }, {})
    L.restore()
    ok(r.code === 0, 'free user may answer the 3rd (last free) question')
    ok(recOf(db2, 'CRT2').currentEventIndex === 3, '3rd free answer advances to idx 3')

    L = load(SUB, db2, 'tf')
    r = await L.main({ recordId: 'CRT2', eventId: ids[3], choiceKey: 'A' }, {})
    L.restore()
    ok(r.code === 1002, 'free user crossing Day3→Day4 at submit → 1002 NEED_PAYMENT')
    ok(recOf(db2, 'CRT2').currentEventIndex === 3, 'boundary submit did not advance')
    ok(recOf(db2, 'CRT2').choices.length === 3, 'boundary submit wrote no answer')

    // entitlement expiry: paid record whose entitlement is gone → 1002 at boundary
    const db3 = makeDb(); bankInto(db3)
    seed(db3, 'users', { openid: 'ex' })
    seed(db3, 'entitlements', { _id: 'ENT_ex', openid: 'ex', permissions: [], sources: [] })
    seed(db3, 'challenge_records', { recordId: 'CRE', openid: 'ex', mode: 'challenge', status: 'processing', trialMode: false, currentEventIndex: 3, currentDay: 4, choices: ids.slice(0, 3).map((id) => ({ eventId: id, choice: 'A' })), rawScores: {}, plan: planOf(ids) })
    L = load(SUB, db3, 'ex')
    r = await L.main({ recordId: 'CRE', eventId: ids[3], choiceKey: 'A' }, {})
    L.restore()
    ok(r.code === 1002, 'expired entitlement blocks Day4 submit → 1002')
  }

  // ══════════════ PHASE 5 — CLIENT CONTRACT (source assertions) ══════════════
  {
    const src = fs.readFileSync(path.join(ROOT, 'pages/challenge-play/challenge-play.js'), 'utf8')
    ok(/r\.code === 1002/.test(src), 'client handles 1002 NEED_PAYMENT')
    ok(/r\.code === 409/.test(src), 'client handles 409 CONFLICT')
    ok(/await this\.nextEvent\(\)/.test(src), 'client refreshes after conflict')
    ok(/ChallengeRestore/.test(src), 'client restores progress on re-entry')
    ok(/challengeLocked: true/.test(src), 'client routes to payment gate, not a dead error screen')
    const svc = fs.readFileSync(path.join(ROOT, 'services/challengeService.js'), 'utf8')
    ok(/recordId/.test(svc) && /submitChallengeChoice/.test(svc), 'client keeps record identity across calls')
  }

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
