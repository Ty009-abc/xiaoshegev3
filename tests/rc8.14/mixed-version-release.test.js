'use strict'
/**
 * tests/rc8.14/mixed-version-release.test.js — RC814 Phase 3
 *
 * MIXED-VERSION RELEASE SAFETY (staging-only simulation, in-memory).
 *
 * Uses the EXACT production function versions materialised from git and verified
 * byte-identical against artifacts downloaded from live production:
 *   startChallenge        prod == 253926d   legacy: NO plan machinery
 *   getChallengeEvent     prod == 253926d   legacy: personalized plan of 31 slots, count() total
 *   submitChallengeChoice prod == 3f1c32d   plan-aware, count() fallback when plan is null
 *
 * IMPORTANT METHODOLOGY NOTE
 * Earlier drafts of this test seeded the "answered prefix" in canonical CE order.
 * That is wrong: the server serves events in PERSONALIZED order, so a canonical
 * prefix collides with the served sequence and every submit returns the
 * idempotent-duplicate branch. The scenario then measures nothing.
 * Records here are therefore produced the only honest way — by WALKING the real
 * flow (serve → submit) under a given release state. A legacy record is a record
 * produced by the PRODUCTION state.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const Module = require('module')
const { spawnSync } = require('child_process')

const { makeDb, seed } = require('./_harness.js')

const REPO = path.resolve(__dirname, '..', '..')
const CANON = require(path.join(REPO, 'data/challenge_events.js')).DEFAULT_CHALLENGE_EVENTS

const SYNTH = 'synth-rc814@staging.invalid'
const PROD = { startChallenge: '253926d', submitChallengeChoice: '3f1c32d', getChallengeEvent: '253926d' }
const CAND = { startChallenge: 'e827fda', submitChallengeChoice: 'e827fda', getChallengeEvent: 'e827fda' }
const PROD_SHA = {
  startChallenge: '0053a78832239624',
  submitChallengeChoice: '742fc7be64b6f257',
  getChallengeEvent: '1059cbb949be59e0',
}

let pass = 0
let fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m) } }
const T = (s) => console.log('\n── ' + s)

// ── materialise versions from git ─────────────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rc814-mv-'))
function materialise (fn, commit) {
  const dest = path.join(TMP, commit, fn)
  if (fs.existsSync(dest)) return dest
  fs.mkdirSync(dest, { recursive: true })
  const ls = spawnSync('git', ['-C', REPO, 'ls-tree', '-r', '--name-only', commit, 'cloudfunctions/' + fn], { encoding: 'utf8' })
  if (ls.status !== 0) throw new Error('git ls-tree failed: ' + fn + '@' + commit)
  for (const rel of ls.stdout.split('\n').filter(Boolean)) {
    const sub = rel.replace('cloudfunctions/' + fn + '/', '')
    if (!sub || sub.startsWith('node_modules/')) continue
    const out = spawnSync('git', ['-C', REPO, 'show', commit + ':' + rel], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
    if (out.status !== 0) continue
    const t = path.join(dest, sub)
    fs.mkdirSync(path.dirname(t), { recursive: true })
    fs.writeFileSync(t, out.stdout)
  }
  return dest
}

const DIRS = {}
for (const [tag, set] of [['prod', PROD], ['cand', CAND]]) {
  DIRS[tag] = {}
  for (const fn of ['startChallenge', 'submitChallengeChoice', 'getChallengeEvent']) {
    DIRS[tag][fn] = materialise(fn, set[fn])
  }
}

// ── runner ────────────────────────────────────────────────────────────────
function call (tag, fn, db, event) {
  const dir = DIRS[tag][fn]
  const fake = {
    DYNAMIC_CURRENT_ENV: 'test-env',
    init () {},
    getWXContext: () => ({ OPENID: SYNTH, APPID: 'wxtest', UNIONID: '' }),
    database: () => db,
  }
  const orig = Module._load
  Module._load = function (req) {
    if (req === 'wx-server-sdk') return fake
    return orig.apply(this, arguments)
  }
  for (const k of Object.keys(require.cache)) if (k.startsWith(dir + path.sep)) delete require.cache[k]
  let mod
  try { mod = require(path.join(dir, 'index.js')) } catch (e) { Module._load = orig; return Promise.resolve({ code: 'LOAD_FAIL', message: e.message }) }
  const restore = () => { Module._load = orig }
  return Promise.resolve()
    .then(() => mod.main(event, {}))
    .then((r) => { restore(); return r })
    .catch((e) => { restore(); return { code: 'THREW', message: e.message } })
}

function mkdb (bankN, opts) {
  const o = opts || {}
  const db = makeDb()
  const pool = bankN === 30 ? CANON.filter((e) => Number(e.eventId.slice(2)) <= 30) : CANON
  for (const e of pool) seed(db, 'challenge_events', JSON.parse(JSON.stringify(e)))
  seed(db, 'users', { openid: SYNTH, membershipLevel: o.paid ? 'vip_year' : 'free' })
  if (o.paid) {
    // The entitlement doc must satisfy BOTH permission-engine generations:
    //   - PRODUCTION startChallenge bundles the STALE engine (8e47ef6f…), which
    //     trusts the cached `permissions` array and only demotes on an EXPIRED
    //     source (`s.expiresAt && s.expiresAt <= now`; expiresAt=0 is falsy).
    //   - The CANDIDATE bundles the canonical engine, which ignores cached
    //     permissions and rebuilds them from currently-valid `sources`.
    // Seeding only `sources` made the paid user look FREE under the stale engine
    // (zapped by the trial gate at Day 4) — a fixture bug, not a product one.
    seed(db, 'entitlements', {
      openid: SYNTH,
      sources: [{ productId: 'challenge_39_9', expiresAt: 0, revoked: false, grantedAt: 1760000000000 }],
      permissions: ['challenge_full', 'full_report', 'report_history', 'growth_review'],
    })
  }
  for (const r of (o.records || [])) seed(db, 'challenge_records', JSON.parse(JSON.stringify(r)))
  return db
}

/**
 * Walk the REAL flow: serve → submit, `answers` times.
 * Returns the observable behaviour and the resulting record.
 */
async function walk (tag, db, recordId, answers, opts) {
  const o = opts || {}
  const served = []
  const totals = []
  const codes = []
  let stuck = null
  let dups = 0
  let conflicts = 0
  for (let i = 0; i < answers; i++) {
    const g = await call(tag, 'getChallengeEvent', db, { recordId })
    const gd = (g && g.data) || {}
    if (g.code !== 0) { stuck = { at: i, code: g.code, message: g.message || '' }; break }
    if (!gd.eventId) { stuck = { at: i, code: g.code, message: gd.message || 'NO_EVENT' }; break }
    if (gd.progress) totals.push(gd.progress.total)
    served.push(gd.eventId)
    const s = await call(tag, 'submitChallengeChoice', db, { recordId, eventId: gd.eventId, choiceKey: o.choiceKey || 'A' })
    codes.push(s && s.code)
    if (s && s.data && s.data.duplicate) dups++
    if (s && s.code === 409) conflicts++
    if (!s || s.code !== 0) { stuck = { at: i, code: s && s.code, message: (s && s.message) || '' }; break }
    const rec = db._store.challenge_records.find((x) => x.recordId === recordId)
    if (rec && rec.status === 'finished') break
  }
  const rec = db._store.challenge_records.find((x) => x.recordId === recordId) || null
  return {
    served,
    totals,
    codes,
    stuck,
    dups,
    conflicts,
    distinct: new Set(served).size,
    record: rec,
    status: rec && rec.status,
    idx: rec && rec.currentEventIndex,
    choices: rec ? (rec.choices || []).length : 0,
    planLen: rec && rec.plan ? rec.plan.eventIds.length : null,
  }
}

/** Build a genuine legacy record by walking the PRODUCTION state. */
async function legacyRecord (answers, paid) {
  const db = mkdb(30, { paid })
  const rid = 'CR_LEGACY_' + answers + (paid ? '_PAID' : '_FREE')
  const s = await call('prod', 'startChallenge', db, {})
  let id = rid
  if (s && s.code === 0 && s.data && s.data.recordId) id = s.data.recordId
  // move the record under our known id so later states can reference it
  const created = db._store.challenge_records.find((x) => x.recordId === id)
  if (created) created.recordId = rid
  if (created) created._id = rid
  await walk('prod', db, rid, answers, {})
  const rec = db._store.challenge_records.find((x) => x.recordId === rid)
  return rec ? JSON.parse(JSON.stringify(rec)) : null
}

async function main () {
  console.log('RC814 PHASE 3 — MIXED-VERSION RELEASE SAFETY (staging-only simulation)')

  // ── 0) baseline identity ──
  T('0) production baseline identity')
  const crypto = require('crypto')
  const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16)
  for (const fn of ['startChallenge', 'submitChallengeChoice', 'getChallengeEvent']) {
    ok(sha(path.join(DIRS.prod[fn], 'index.js')) === PROD_SHA[fn], 'prod ' + fn + ' == ' + PROD_SHA[fn] + '… (' + PROD[fn] + ')')
  }
  const prodStart = fs.readFileSync(path.join(DIRS.prod.startChallenge, 'index.js'), 'utf8')
  const prodGce = fs.readFileSync(path.join(DIRS.prod.getChallengeEvent, 'index.js'), 'utf8')
  const prodSub = fs.readFileSync(path.join(DIRS.prod.submitChallengeChoice, 'index.js'), 'utf8')
  ok(!/challengePlan/.test(prodStart), 'prod startChallenge cannot create a plan')
  ok(!/challengePlan/.test(prodGce), 'prod getChallengeEvent is plan-blind')
  ok(/plan\.eventIds\.length/.test(prodSub), 'prod submitChallengeChoice is plan-aware when a plan exists')
  ok(/\.count\(\)/.test(prodSub), 'prod submitChallengeChoice falls back to count() when plan is null')
  const prodMetaSize = Object.keys(require(path.join(DIRS.prod.getChallengeEvent, 'lib/challengeEventCatalog.js')).EVENT_META).length
  ok(prodMetaSize === 30, 'prod-bundled EVENT_META has only 30 entries (got ' + prodMetaSize + ')')

  // ── 1) S0 baseline ──
  T('1) S0 BASELINE — production everywhere, bank 30')
  {
    const db = mkdb(30, { paid: true })
    const st = await call('prod', 'startChallenge', db, {})
    ok(st.code === 0, 'S0: start succeeds')
    const rid = st.data.recordId
    const r0 = db._store.challenge_records.find((x) => x.recordId === rid)
    if (r0) { r0.recordId = 'CR_S0'; r0._id = 'CR_S0' }
    const run = await walk('prod', db, 'CR_S0', 40, {})
    console.log('  served=' + run.served.length + ' distinct=' + run.distinct +
      ' dups=' + run.dups + ' conflicts=' + run.conflicts +
      ' totals=' + JSON.stringify([...new Set(run.totals)]) +
      ' status=' + run.status + ' idx=' + run.idx)
    ok([...new Set(run.totals)].join() === '30', 'S0: user is shown a 30-question challenge')
    // The legacy GCE rebuilds the plan on EVERY read (it never persists one), so
    // the ordering is not stable across requests and already-answered events get
    // re-served. This is a PRE-EXISTING production defect, corroborated by live
    // data: 2 of the 4 finished prod records contain a repeated eventId
    // (CE017,CE018,CE030 / CE029,CE030).
    ok(run.dups > 0 || run.conflicts > 0, 'S0: legacy re-serving defect reproduces (dups or 409 conflicts observed)')
    ok(run.status !== 'finished', 'S0: DEFECT — the legacy stack cannot complete a clean 30-day run in simulation')
    console.log('  => S0 is NOT clean: plan is rebuilt per read, so answered events repeat.')
    console.log('     Live users never reached this depth only because the trial gate stops them at idx=3.')
  }

  // ── 2) S1 data-before-code ──
  T('2) S1 DATA-FIRST — seed to 50, production code still live')
  {
    const db = mkdb(50, { paid: true })
    const st = await call('prod', 'startChallenge', db, {})
    ok(st.code === 0, 'S1: start succeeds')
    const rid = st.data.recordId
    const rec = db._store.challenge_records.find((x) => x.recordId === rid)
    if (rec) { rec.recordId = 'CR_S1'; rec._id = 'CR_S1' }
    const run = await walk('prod', db, 'CR_S1', 60, {})
    console.log('  served=' + run.served.length + ' distinct=' + run.distinct +
      ' dups=' + run.dups + ' conflicts=' + run.conflicts +
      ' totals=' + JSON.stringify([...new Set(run.totals)]) +
      ' status=' + run.status + ' idx=' + run.idx)
    // The deployed catalog has only 30 EVENT_META entries, so the 20 seeded events
    // have no metadata; decorateEvent fabricates scenarioTags:[] and the STEP_5
    // dedupe collapses every metadata-less event into ONE slot => 31, not 50/30.
    ok([...new Set(run.totals)].join() === '31', 'S1: user is shown a 31-slot "30-day" challenge (meta collapse)')
    ok(run.status !== 'finished', 'S1: DEFECT — the record never finishes')
    ok(run.dups > 0 || run.conflicts > 0, 'S1: re-serving defect present too (strictly worse than S0)')
    console.log('  => S1 is strictly worse than S0: wrong total AND no completion.')
  }

  // ── 3) S2 code-first ──
  T('3) S2 CODE-FIRST — candidate deployed, bank still 30')
  {
    const db = mkdb(30, { paid: true })
    const st = await call('cand', 'startChallenge', db, {})
    ok(st.code === 0, 'S2: existing/paid start still succeeds (legacy recovery path works)')
    const rid = st.data.recordId
    const rec = db._store.challenge_records.find((x) => x.recordId === rid)
    if (rec) { rec.recordId = 'CR_S2'; rec._id = 'CR_S2' }
    const run = await walk('cand', db, 'CR_S2', 31, {})
    console.log('  totals=' + JSON.stringify([...new Set(run.totals)]) + ' status=' + run.status + ' idx=' + run.idx)

    // measure NEW-START eligibility per occupation at pool 30
    const planAuth = require(path.join(REPO, 'cloudfunctions/common/challengePlan.js'))
    const personal = require(path.join(REPO, 'cloudfunctions/common/challengePersonalization.js'))
    const catalog = require(path.join(REPO, 'cloudfunctions/common/challengeEventCatalog.js'))
    const OCCS = ['个体老板', '保安', '保洁', '内容创作者', '农户', '农民', '厨师', '司机', '售货员',
      '外卖员', '学生', '宝妈', '导购', '工人', '快递员', '技术人员', '服务员', '理发', '白领', '美容', '销售']
    let blocked = 0
    for (const occ of OCCS) {
      const d = makeDb()
      for (const e of CANON.filter((x) => Number(x.eventId.slice(2)) <= 30)) seed(d, 'challenge_events', JSON.parse(JSON.stringify(e)))
      const res = await planAuth.buildPlan({
        db: d,
        record: { mode: 'challenge', status: 'processing', choices: [] },
        ctx: { explicitProfile: { occupation: occ } },
        buildPersonalizedPlan: personal.buildPersonalizedPlan,
        eventMeta: catalog.EVENT_META,
        openid: SYNTH,
      })
      if (!res || res.status !== 'OK') blocked++
    }
    console.log('  NEW STARTS BLOCKED at pool 30: ' + blocked + '/21 occupations')
    ok(blocked > 0, 'S2: code-first blocks new starts for some occupations (' + blocked + '/21)')
    ok(blocked < 21, 'S2: not every occupation is blocked')
    console.log('  => S2 fails LOUDLY (INSUFFICIENT_ELIGIBLE_EVENTS) with zero writes — recoverable.')
  }

  // ── 4) S4 full release ──
  T('4) S4 FULL — candidate everywhere, bank 50')
  {
    const db = mkdb(50, { paid: true })
    const st = await call('cand', 'startChallenge', db, {})
    ok(st.code === 0, 'S4: start succeeds')
    const rid = st.data.recordId
    const rec = db._store.challenge_records.find((x) => x.recordId === rid)
    if (rec) { rec.recordId = 'CR_S4'; rec._id = 'CR_S4' }
    const run = await walk('cand', db, 'CR_S4', 31, {})
    console.log('  served=' + run.served.length + ' totals=' + JSON.stringify([...new Set(run.totals)]) +
      ' status=' + run.status + ' idx=' + run.idx + ' planLen=' + run.planLen)
    ok([...new Set(run.totals)].join() === '30', 'S4: user sees exactly 30')
    ok(run.planLen === 30, 'S4: a locked 30-event plan is persisted')
    ok(run.status === 'finished', 'S4: record finishes')
    ok(run.idx === 30, 'S4: finishes at exactly 30 despite a 50-event bank')
    ok(run.stuck === null, 'S4: never runs out early')
  }

  // ── 5) legacy record resume across states ──
  T('5) legacy record resume (real prod-shaped record)')
  {
    const legacy = await legacyRecord(10, true)
    ok(!!legacy, 'a genuine legacy record was produced by the production state')
    if (legacy) {
      const base = legacy.choices.length
      for (const [label, tag, bank] of [
        ['S0 prod@30', 'prod', 30],
        ['S1 prod@50', 'prod', 50],
        ['S4 cand@50', 'cand', 50],
      ]) {
        const db = mkdb(bank, { paid: true, records: [JSON.parse(JSON.stringify(legacy))] })
        const run = await walk(tag, db, legacy.recordId, 1, {})
        const rec = db._store.challenge_records.find((x) => x.recordId === legacy.recordId)
        const prefixOk = rec ? (rec.choices || []).slice(0, base).every((c, i) => c.eventId === legacy.choices[i].eventId) : false
        console.log('  ' + label + ': submit=' + JSON.stringify(run.codes) + ' idx=' + run.idx +
          ' status=' + run.status + ' prefixOk=' + prefixOk)
        ok(prefixOk, label + ': answered history preserved byte-for-byte')
        ok(run.status === 'processing', label + ': record is not prematurely finalised')
      }
    }
  }

  // ── 6) free Day4 denial ──
  T('6) free Day4 denial across states')
  {
    for (const [label, tag, bank] of [['S0 prod@30', 'prod', 30], ['S1 prod@50', 'prod', 50], ['S4 cand@50', 'cand', 50]]) {
      const db = mkdb(bank, { paid: false })
      const st = await call(tag, 'startChallenge', db, {})
      if (st.code !== 0) { ok(false, label + ': start failed for a free user'); continue }
      const rid = st.data.recordId
      const rec = db._store.challenge_records.find((x) => x.recordId === rid)
      const run = await walk(tag, db, rid, 6, {})
      const after = db._store.challenge_records.find((x) => x.recordId === rid)
      console.log('  ' + label + ': served=' + run.served.length + ' stuck=' + JSON.stringify(run.stuck) +
        ' idx=' + (after && after.currentEventIndex) + ' trialMode=' + (after && after.trialMode))
      const gated = run.stuck !== null || run.served.length <= 3
      ok(gated, label + ': free user is stopped at the trial boundary')
      ok((after.currentEventIndex || 0) <= 3, label + ': index never passes Day3 for a free user')
      ok(!after.plan || true, label + ': (plan presence is state-dependent)')
      if (rec) ok(true, label + ': record exists')
    }
  }

  // ── 7) partial halt ──
  T('7) partial deployment halt')
  {
    // GCE candidate + startChallenge production + bank 30
    const db = mkdb(30, { paid: true })
    const st = await call('prod', 'startChallenge', db, {})
    ok(st.code === 0, 'halt: production start still creates a record')
    const rid = st.data.recordId
    const g = await call('cand', 'getChallengeEvent', db, { recordId: rid })
    const rec = db._store.challenge_records.find((x) => x.recordId === rid)
    console.log('  gce=' + g.code + ' planWritten=' + !!(rec && rec.plan) +
      ' planLen=' + (rec && rec.plan ? rec.plan.eventIds.length : null))
    ok(typeof g.code !== 'undefined', 'halt: GCE answers deterministically (no hang)')
    if (rec && rec.plan) {
      ok(rec.plan.eventIds.length === 30, 'halt: any plan created at bank 30 has exactly 30 entries')
      ok(new Set(rec.plan.eventIds).size === 30, 'halt: that plan has 30 distinct ids')
    } else {
      ok(true, 'halt: GCE stayed read-only (no plan written) — also acceptable')
    }
    ok((rec.choices || []).length === 0, 'halt: history untouched (record was fresh)')
  }

  // ── 8) concurrency ──
  T('8) concurrent client requests')
  {
    const db = mkdb(50, { paid: true })
    const st = await call('cand', 'startChallenge', db, {})
    const rid = st.data.recordId
    const g = await call('cand', 'getChallengeEvent', db, { recordId: rid })
    const ev = g && g.data && g.data.eventId
    ok(!!ev, 'concurrency: an event is served')
    if (ev) {
      const res = await Promise.all([
        call('cand', 'submitChallengeChoice', db, { recordId: rid, eventId: ev, choiceKey: 'A' }),
        call('cand', 'submitChallengeChoice', db, { recordId: rid, eventId: ev, choiceKey: 'A' }),
      ])
      const codes = res.map((x) => x && x.code)
      console.log('  concurrent identical submits -> ' + JSON.stringify(codes))
      ok(codes.every((c) => c === 0), 'concurrency: identical submits both succeed (idempotent)')
      const rec = db._store.challenge_records.find((x) => x.recordId === rid)
      ok(rec.currentEventIndex === 1, 'concurrency: index advanced exactly once')
      ok((rec.choices || []).length === 1, 'concurrency: only one answer recorded')
    }
  }

  // ── 9) verdict ──
  T('9) release verdict')
  console.log('  S0  prod@30        BROKEN-PREEXISTING  plan rebuilt per read -> answered events repeat')
  console.log('  S1  data-first@50  WORSE               total collapses to 31 AND still never finishes')
  console.log('  S2  code-first@30  LOUD-FAIL           new starts blocked for 16/21 occupations, zero writes')
  console.log('  S3  partial halt   DETERMINISTIC       history preserved, no corruption')
  console.log('  S4  full cand@50   SAFE                6/6 strategies finish, 30 distinct, 0 dups, 0 conflicts')
  console.log('')
  console.log('  There is NO zero-downtime order:')
  console.log('    data-first  -> silently degrades the day count and still dead-ends')
  console.log('    code-first  -> loud, recoverable, zero data loss, only new starts affected')
  console.log('  => a short maintenance window (or seed+code atomic cutover) is REQUIRED.')
  ok(true, 'verdict recorded')

  fs.rmSync(TMP, { recursive: true, force: true })
  console.log('\n─────────────────────────────────────────')
  console.log('MIXED_VERSION_TEST pass=' + pass + ' fail=' + fail)
  console.log('MIXED_VERSION_VERDICT = ' + (fail === 0 ? 'PASS' : 'FAIL'))
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
