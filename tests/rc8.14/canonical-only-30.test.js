'use strict'
/**
 * tests/rc8.14/canonical-only-30.test.js — RC814 Phase 2
 *
 * PROOF: a 30-event plan is achievable for every occupation using ONLY the
 * canonical bank CE001–CE050, with the historical non-canonical GAME* rows
 * excluded from the new-plan candidate set.
 *
 * Background: staging carries 4 pre-existing non-canonical rows
 * (GAME015/016/020/021, days 31–34, scenarioTags: [], no EVENT_META). They are
 * historical data that must be PRESERVED but must never be load-bearing for a
 * new plan. This test measures exactly that separation.
 *
 * Checks per occupation (21):
 *   - plan length == 30
 *   - every chosen id is canonical (CE001–CE050)
 *   - ids are unique
 *   - required scoring fields exist on every chosen event
 *   - primary themes are distinct (the STEP_5 dedupe key)
 *   - contraindications are honoured
 *   - no plan depends on a GAME row
 *   - determinism: rebuilding from identical inputs yields an identical plan
 *   - recovery: a legacy partially-answered record recovers deterministically
 *     with its answered prefix preserved
 *
 * Pure local: in-memory DB, real plan/catalog modules, no network.
 */
const path = require('path')
const { makeDb, seed } = require('./_harness.js')

const REPO = path.resolve(__dirname, '..', '..')
const planAuth = require(path.join(REPO, 'cloudfunctions/common/challengePlan.js'))
const personal = require(path.join(REPO, 'cloudfunctions/common/challengePersonalization.js'))
const catalog = require(path.join(REPO, 'cloudfunctions/common/challengeEventCatalog.js'))
const canonEvents = require(path.join(REPO, 'data/challenge_events.js')).DEFAULT_CHALLENGE_EVENTS

const CANON = canonEvents.filter((e) => /^CE\d{3}$/.test(String(e.eventId)))
const GAME_ROWS = [
  { eventId: 'GAME015', day: 31, title: '历史题15', description: 'd', difficulty: 2, status: 'active', scenarioTags: [], cognitiveDimension: '', choices: [{ key: 'A', text: 'a', tags: [] }, { key: 'B', text: 'b', tags: [] }, { key: 'C', text: 'c', tags: [] }] },
  { eventId: 'GAME016', day: 32, title: '历史题16', description: 'd', difficulty: 2, status: 'active', scenarioTags: [], cognitiveDimension: '', choices: [{ key: 'A', text: 'a', tags: [] }, { key: 'B', text: 'b', tags: [] }, { key: 'C', text: 'c', tags: [] }] },
  { eventId: 'GAME020', day: 33, title: '历史题20', description: 'd', difficulty: 2, status: 'active', scenarioTags: [], cognitiveDimension: '', choices: [{ key: 'A', text: 'a', tags: [] }, { key: 'B', text: 'b', tags: [] }, { key: 'C', text: 'c', tags: [] }] },
  { eventId: 'GAME021', day: 34, title: '历史题21', description: 'd', difficulty: 2, status: 'active', scenarioTags: [], cognitiveDimension: '', choices: [{ key: 'A', text: 'a', tags: [] }, { key: 'B', text: 'b', tags: [] }, { key: 'C', text: 'c', tags: [] }] },
]

/** The 21 occupations measured in Phase 1. */
const OCCS = ['个体老板', '保安', '保洁', '内容创作者', '农户', '农民', '厨师', '司机', '售货员',
  '外卖员', '学生', '宝妈', '导购', '工人', '快递员', '技术人员', '服务员', '理发', '白领', '美容', '销售']

const DIMS = ['laborMindset', 'probabilityMindset', 'systemThinking', 'leverageThinking', 'capitalThinking',
  'riskAwareness', 'informationSensitivity', 'longTermism', 'decisionStability']

let pass = 0
let fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m) } }
const T = (s) => console.log('\n── ' + s)
const isCanon = (id) => /^CE\d{3}$/.test(String(id))

function seedBank (db, rows) {
  for (const e of rows) seed(db, 'challenge_events', JSON.parse(JSON.stringify(e)))
  return db
}

async function build (db, occ) {
  const record = { mode: 'challenge', status: 'processing', choices: [] }
  const ctx = { explicitProfile: { occupation: occ }, sixQText: '', message: '' }
  // Mirror the production call site (startChallenge/_buildPlanOrFail and
  // getChallengeEvent/_ensurePlan both pass eventMeta), otherwise the Phase-2
  // catalog scope would be inert here and the test would not measure it.
  return planAuth.buildPlan({
    db,
    record,
    ctx,
    buildPersonalizedPlan: personal.buildPersonalizedPlan,
    eventMeta: catalog.EVENT_META,
    openid: 'synth-rc814@staging.invalid',
  })
}

async function main () {
  console.log('RC814 PHASE 2 — CANONICAL-ONLY 30-EVENT PROOF')

  // ── 0) bank sanity ──
  T('0) canonical bank integrity')
  ok(CANON.length === 50, 'canonical bank has 50 events CE001–CE050 (got ' + CANON.length + ')')
  ok(new Set(CANON.map((e) => e.eventId)).size === 50, 'canonical ids are unique')
  ok(CANON.every((e) => isCanon(e.eventId)), 'every canonical id matches CE\\d{3}')
  const legacy30 = CANON.filter((e) => Number(e.eventId.slice(2)) <= 30)
  ok(legacy30.length === 30, 'CE001–CE030 all present (got ' + legacy30.length + ')')
  ok(legacy30.every((e) => e.status === 'active'), 'CE001–CE030 are all status=active')
  ok(legacy30.every((e) => e.day >= 1 && e.day <= 30), 'CE001–CE030 keep days 1–30')
  const metaCoverage = CANON.filter((e) => catalog.EVENT_META[e.eventId]).length
  ok(metaCoverage === 50, 'EVENT_META covers all 50 canonical events (got ' + metaCoverage + ')')

  // ── 1) canonical-only pool, per occupation ──
  T('1) canonical-only plan for all 21 occupations')
  const dbCanon = seedBank(makeDb(), CANON)
  const rows = []
  for (const occ of OCCS) {
    const r = await build(dbCanon, occ)
    if (!r || r.status !== 'OK') {
      ok(false, occ + ' -> ' + (r && r.status) + ' (eligible ' + (r && r.eligibleCount) + '/' + (r && r.required) + ')')
      rows.push({ occ, ok: false })
      continue
    }
    const ids = r.plan.eventIds
    const problems = []
    if (ids.length !== 30) problems.push('LEN' + ids.length)
    if (new Set(ids).size !== ids.length) problems.push('DUP')
    if (!ids.every(isCanon)) problems.push('NON_CANONICAL:' + ids.filter((i) => !isCanon(i)).join(','))
    if (ids.some((i) => /^GAME/.test(i))) problems.push('GAME_DEPENDENCY')
    ok(problems.length === 0, occ + ' -> 30 canonical, unique (' + (problems.join(' ') || 'ok') + ')')
    rows.push({ occ, ok: problems.length === 0, ids })
  }
  const builtOk = rows.filter((r) => r.ok).length
  console.log('  occupations with a clean 30-event canonical plan: ' + builtOk + '/' + OCCS.length)

  // ── 2) scoring-field completeness ──
  T('2) required scoring fields')
  {
    let bad = []
    for (const row of rows.filter((r) => r.ok)) {
      for (const id of row.ids) {
        const ev = CANON.find((e) => e.eventId === id)
        const m = catalog.EVENT_META[id]
        if (!ev) { bad.push(id + ':NO_EVENT'); continue }
        if (!ev.title || !Array.isArray(ev.choices) || ev.choices.length < 2) bad.push(id + ':EVENT_SHAPE')
        if (!m) { bad.push(id + ':NO_META'); continue }
        if (!Array.isArray(m.domains) || m.domains.length === 0) bad.push(id + ':DOMAINS')
        if (!Array.isArray(m.occupationAffinity) || m.occupationAffinity.length === 0) bad.push(id + ':AFFINITY')
        if (!m.cognitiveDimension || DIMS.indexOf(m.cognitiveDimension) === -1) bad.push(id + ':' + m.cognitiveDimension)
        if (!Array.isArray(m.scenarioTags) || m.scenarioTags.length === 0) bad.push(id + ':TAGS')
        if (!Array.isArray(m.contraindications)) bad.push(id + ':CONTRA_SHAPE')
      }
    }
    ok(bad.length === 0, 'every planned event carries complete scoring fields (' + bad.slice(0, 6).join(' ') + ')')
  }

  // ── 3) topic diversity (the STEP_5 dedupe key) ──
  T('3) topic diversity')
  {
    let collapsed = []
    for (const row of rows.filter((r) => r.ok)) {
      const themes = row.ids.map((id) => (catalog.EVENT_META[id] || {}).scenarioTags?.[0] || '')
      if (themes.some((t) => !t)) collapsed.push(row.occ + ':EMPTY_THEME')
      if (new Set(themes).size !== themes.length) collapsed.push(row.occ + ':DUP_THEME(' + new Set(themes).size + '/' + themes.length + ')')
    }
    ok(collapsed.length === 0, 'primary themes are distinct and non-empty in every plan (' + collapsed.slice(0, 6).join(' ') + ')')

    const dimSpread = []
    for (const row of rows.filter((r) => r.ok)) {
      const dims = new Set(row.ids.map((id) => (catalog.EVENT_META[id] || {}).cognitiveDimension))
      dimSpread.push(dims.size)
    }
    const minDim = Math.min.apply(null, dimSpread)
    const maxDim = Math.max.apply(null, dimSpread)
    ok(minDim >= 8, 'each plan spans >= 8 of the 9 cognitive dimensions (min ' + minDim + ')')
    console.log('  dimension coverage per plan: min=' + minDim + ' max=' + maxDim)
  }

  // ── 4) contraindications honoured ──
  T('4) contraindications')
  {
    let violations = []
    for (const row of rows.filter((r) => r.ok)) {
      for (const id of row.ids) {
        const m = catalog.EVENT_META[id]
        if (m && Array.isArray(m.contraindications) && m.contraindications.indexOf(row.occ) !== -1) {
          violations.push(row.occ + '<-' + id)
        }
      }
    }
    ok(violations.length === 0, 'no plan contains an event contraindicated for its occupation (' + violations.slice(0, 6).join(' ') + ')')

    // control: the filter is actually live
    const chefIds = (rows.find((r) => r.occ === '厨师') || {}).ids || []
    const contraForChef = CANON.filter((e) => ((catalog.EVENT_META[e.eventId] || {}).contraindications || []).indexOf('厨师') !== -1).map((e) => e.eventId)
    ok(contraForChef.length > 0, 'control: at least one event IS contraindicated for 厨师 (' + contraForChef.length + ')')
    ok(!chefIds.some((i) => contraForChef.indexOf(i) !== -1), 'control: 厨师 plan excludes those events')
  }

  // ── 5) GAME rows must not be load-bearing ──
  T('5) no dependency on historical GAME rows')
  {
    const dbMixed = seedBank(makeDb(), CANON.concat(GAME_ROWS))
    let gameUsed = []
    let lenMismatch = []
    for (const occ of OCCS) {
      const r = await build(dbMixed, occ)
      if (!r || r.status !== 'OK') { lenMismatch.push(occ + ':' + (r && r.status)); continue }
      if (r.plan.eventIds.length !== 30) lenMismatch.push(occ + ':LEN' + r.plan.eventIds.length)
      const g = r.plan.eventIds.filter((i) => /^GAME/.test(i))
      if (g.length) gameUsed.push(occ + ':' + g.join(','))
    }
    ok(lenMismatch.length === 0, 'with GAME present, every plan is still exactly 30 (' + lenMismatch.slice(0, 5).join(' ') + ')')
    ok(gameUsed.length === 0, 'GAME rows are NOT selected into any new plan (' + gameUsed.slice(0, 5).join(' ') + ')')
    console.log('  note: GAME rows remain in the collection (historical data preserved) but are')
    console.log('        never required, and never chosen, by a canonical 30-event plan.')

    // removal must not break any plan
    const dbNoGame = seedBank(makeDb(), CANON)
    let broke = []
    for (const occ of OCCS) {
      const r = await build(dbNoGame, occ)
      if (!r || r.status !== 'OK' || r.plan.eventIds.length !== 30) broke.push(occ + ':' + (r && r.status))
    }
    ok(broke.length === 0, 'every plan still builds with GAME rows absent (' + broke.slice(0, 5).join(' ') + ')')
  }

  // ── 6) determinism ──
  T('6) deterministic planning')
  {
    let nonDet = []
    for (const occ of OCCS) {
      const a = await build(seedBank(makeDb(), CANON), occ)
      const b = await build(seedBank(makeDb(), CANON), occ)
      if (!a || !b || a.status !== 'OK' || b.status !== 'OK') { nonDet.push(occ + ':BUILD'); continue }
      if (a.plan.eventIds.join(',') !== b.plan.eventIds.join(',')) nonDet.push(occ + ':ORDER')
      if (a.plan.eventBankVersion !== b.plan.eventBankVersion) nonDet.push(occ + ':BANKVER')
    }
    ok(nonDet.length === 0, 'identical inputs produce identical plans (' + nonDet.slice(0, 5).join(' ') + ')')
  }

  // ── 7) deterministic recovery of a legacy partially-answered record ──
  T('7) deterministic recovery preserves answered history')
  {
    const db = seedBank(makeDb(), CANON)
    const answered = ['CE001', 'CE002', 'CE003']
    const record = {
      _id: 'CR_SYNTH_REC',
      recordId: 'CR_SYNTH_REC',
      openid: 'synth-rc814@staging.invalid',
      mode: 'challenge',
      status: 'processing',
      trialMode: true,
      currentEventIndex: 3,
      choices: [
        { eventId: 'CE001', choiceKey: 'A', tags: [] },
        { eventId: 'CE002', choiceKey: 'B', tags: [] },
        { eventId: 'CE003', choiceKey: 'C', tags: [] },
      ],
    }
    const ctx = { explicitProfile: { occupation: '白领' }, sixQText: '', message: '' }
    const a = await planAuth.recoverLegacyPlan({
      db, record, ctx, buildPersonalizedPlan: personal.buildPersonalizedPlan,
      openid: record.openid, eventMeta: catalog.EVENT_META,
    })
    ok(!!a && a.status === 'OK', 'recovery succeeds for a legacy 3-answer record (' + (a && a.status) + ')')
    const ids = (a && a.plan && a.plan.eventIds) || []
    ok(ids.length === 30, 'recovered plan length 30 (got ' + ids.length + ')')
    ok(answered.every((id, i) => ids[i] === id), 'answered prefix preserved in order')
    ok(ids.every(isCanon), 'recovered plan is canonical-only')
    ok(new Set(ids).size === 30, 'recovered plan has no duplicate ids')

    const b = await planAuth.recoverLegacyPlan({
      db, record, ctx, buildPersonalizedPlan: personal.buildPersonalizedPlan,
      openid: record.openid, eventMeta: catalog.EVENT_META,
    })
    ok(!!b && b.status === 'OK' && b.plan.eventIds.join(',') === ids.join(','), 'recovery is deterministic (same plan on repeat)')

    ok(record.choices.length === 3 && record.currentEventIndex === 3,
      'recovery did NOT mutate answered history or the index')

    // history must survive against the mixed bank too
    const dbMixed = seedBank(makeDb(), CANON.concat(GAME_ROWS))
    const c = await planAuth.recoverLegacyPlan({
      db: dbMixed, record, ctx, buildPersonalizedPlan: personal.buildPersonalizedPlan,
      openid: record.openid, eventMeta: catalog.EVENT_META,
    })
    ok(!!c && c.status === 'OK' && c.plan.eventIds.filter((i) => /^GAME/.test(i)).length === 0,
      'recovery against the mixed bank still yields a canonical-only plan')
  }

  // ── 8) 30-day completion reachability ──
  T('8) 30-day completion reachability')
  {
    const db = seedBank(makeDb(), CANON)
    const r = await build(db, '学生')
    ok(!!r && r.status === 'OK', 'student plan built')
    const ids = (r && r.plan && r.plan.eventIds) || []
    const served = []
    for (let i = 0; i < ids.length; i++) served.push(planAuth.eventIdAtIndex({ eventIds: ids }, i))
    ok(served.length === 30, 'exactly 30 events are servable (got ' + served.length + ')')
    ok(new Set(served).size === 30, 'all 30 served events are distinct')
    ok(served.every(isCanon), 'every served event is canonical')
    const eventsById = {}
    for (const e of CANON) eventsById[e.eventId] = e
    ok(served.every((id) => !!eventsById[id]), 'every served id resolves to a real event document')
    const totalDays = new Set(served.map((id) => eventsById[id].day)).size
    ok(totalDays === 30, 'the 30 served events span 30 distinct days (got ' + totalDays + ')')
  }

  console.log('\n─────────────────────────────────────────')
  console.log('CANONICAL_ONLY_30_TEST pass=' + pass + ' fail=' + fail)
  console.log('CANONICAL_ONLY_30_VERDICT = ' + (fail === 0 ? 'PASS' : 'FAIL'))
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
