#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/challenge-report-idempotency.test.js
 *
 * PAYMENT_STAGE5C_GENERATEAIREPORT_IDEMPOTENCY — deterministic acceptance matrix.
 *
 *  A  first generation                       → one entity, deterministic reportId
 *  B  consecutive reloads (unpaid)           → same reportId, one entity, locked
 *  C  same-user concurrency (in-flight)      → one winner, other reuses status
 *  D  distinct records                       → independent entities, no bleed
 *  E  cross-user access                      → denied, no entity, no leak
 *  F  AI failure + controlled retry          → same entity reused, reportId stable
 *  G  stale takeover vs stale writer         → stale writer cannot clobber
 *  H  unpaid read                            → body stays locked
 *  I  paid reload                            → full body readable
 *  J  response-shape + isPaid ownership      → legacy shapes preserved; gen never writes isPaid
 *
 * Exercises the REAL lib/challengeReportIdempotency.js against an in-memory DB
 * that enforces `_id` uniqueness (E11000) and returns conditional-update counts.
 * No network, no real DB, no charge.
 */

const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const LIB = path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'challengeReportIdempotency.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE5C challenge_final idempotency')

// ── in-memory DB: enforces _id uniqueness, conditional updates by equality ──
const CTRL = {
  vip: false,
  callAI: null,
  updates: [],     // captured update {name, where, data}
  addDelay: 0,
}
function makeErrDup () {
  const e = new Error('E11000 duplicate key error collection: ai_reports index: _id_ dup key')
  e.errCode = -502001
  return e
}
function match (doc, q) {
  return Object.keys(q || {}).every((k) => doc[k] === q[k])
}
function makeDB (seed) {
  const store = { ai_reports: [], challenge_records: [], ai_logs: [], command: null }
  Object.keys(seed || {}).forEach((k) => { store[k] = seed[k].slice() })
  function collection (name) {
    let _w = {}
    const b = {
      where (w) { _w = w || {}; return b },
      limit () { return b },
      orderBy () { return b },
      field () { return b },
      async get () { return { data: (store[name] || []).filter((d) => match(d, _w)).map((d) => Object.assign({}, d)) } },
      async count () { return { total: (store[name] || []).filter((d) => match(d, _w)).length } },
      async add ({ data }) {
        if (CTRL.addDelay) await new Promise((r) => setTimeout(r, CTRL.addDelay))
        store[name] = store[name] || []
        if (name === 'ai_reports' && data && data._id) {
          if (store[name].some((d) => d._id === data._id)) throw makeErrDup()
        }
        const doc = Object.assign({ _id: name + '_' + (store[name].length + 1) }, data)
        store[name].push(doc)
        return { _id: doc._id }
      },
      async update ({ data }) {
        const rows = (store[name] || []).filter((d) => match(d, _w))
        CTRL.updates.push({ name, where: Object.assign({}, _w), data: Object.assign({}, data) })
        rows.forEach((d) => Object.assign(d, data))
        return { stats: { updated: rows.length } }
      },
      doc (id) {
        return {
          async update ({ data }) {
            const d = (store[name] || []).find((x) => x._id === id)
            CTRL.updates.push({ name, where: { _id: id }, data: Object.assign({}, data) })
            if (d) Object.assign(d, data)
            return { stats: { updated: d ? 1 : 0 } }
          },
        }
      },
    }
    return b
  }
  return {
    collection,
    command: { gt: (n) => ({ $gt: n }), in: (a) => ({ $in: a }) },
    _store: store,
  }
}

const SAMPLE = JSON.stringify({
  oneSentence: '你有对冲思维，但缺少长期主义。',
  worldModelType: '侥幸型翻身者',
  turnaroundProbability: 0.42,
  finalStrike: '世界不欠你一个机会。',
})

function deps (over) {
  return Object.assign({
    callAI: async () => ({ success: true, content: SAMPLE, tokens: 11 }),
    buildReportPrompt: () => ({ systemPrompt: 'SYS', userMessage: 'USR' }),
    checkVip: async () => CTRL.vip,
    emitModelCall: () => Promise.resolve(),
  }, over || {})
}

function dev (over) {
  return Object.assign({ db: DB, openid: 'oUserA', event: { recordId: 'rec1' }, ts: Date.now() }, over || {})
}

let idem = null
let DB = null

function reset (seed) {
  CTRL.vip = false
  CTRL.updates = []
  CTRL.addDelay = 0
  DB = makeDB(Object.assign({
    challenge_records: [{ _id: 'cr1', recordId: 'rec1', openid: 'oUserA', status: 'processing', scores: { capitalThinking: 31 }, tags: ['x'] }],
    ai_reports: [],
    ai_logs: [],
  }, seed || {}))
  idem = require(LIB)
}

// ═══════════════════════════════════════════════════════════════════════════
;(async () => {
  // ── A: first generation ──
  {
    reset()
    const r = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(r.code, 0, 'A gen code 0')
    ok(r.data && r.data.reportId, 'A reportId present')
    eq(DB._store.ai_reports.length, 1, 'A exactly one entity')
    eq(DB._store.ai_reports[0].status, 'ready', 'A status ready')
    eq(r.data.locked, true, 'A unpaid → locked')
    ok(!r.data.content, 'A unpaid → no body')
    eq(r.data.summary.oneSentence, '你有对冲思维，但缺少长期主义。', 'A summary preserved')
  }

  // ── B: consecutive reloads ──
  {
    reset()
    const r1 = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    const r2 = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    const r3 = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(r1.data.reportId, r2.data.reportId, 'B reload same reportId (1-2)')
    eq(r2.data.reportId, r3.data.reportId, 'B reload same reportId (2-3)')
    eq(DB._store.ai_reports.length, 1, 'B still one entity after 3 calls')
    eq(r3.data.locked, true, 'B reload locked')
  }

  // ── C: same-user concurrency (one in flight) ──
  {
    reset()
    let releaseAI
    const gate = new Promise((res) => { releaseAI = res })
    const slowDeps = deps({ callAI: async () => { await gate; return { success: true, content: SAMPLE, tokens: 11 } } })
    const p1 = idem.runChallengeFinalReport(dev({ deps: slowDeps }))
    // let p1 claim + reach the AI await
    for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r))
    eq(DB._store.ai_reports.length, 1, 'C one entity after claim')
    eq(DB._store.ai_reports[0].status, 'generating', 'C entity generating')
    // concurrent second request (no new entity, explicit status, no body)
    const r2 = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(r2.code, 0, 'C concurrent code 0')
    eq(r2.data.status, 'generating', 'C concurrent → status generating')
    ok(!r2.data.content, 'C concurrent → no incomplete body')
    eq(DB._store.ai_reports.length, 1, 'C still one entity while in flight')
    releaseAI()
    const r1 = await p1
    eq(r1.code, 0, 'C winner code 0')
    eq(DB._store.ai_reports[0].status, 'ready', 'C winner completes → ready')
    const r3 = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(r3.data.reportId, r1.data.reportId, 'C reload matches winner reportId')
    eq(DB._store.ai_reports.length, 1, 'C final one entity')
  }

  // ── C2: true atomic claim race (both read empty, both add same _id) ──
  {
    reset({ challenge_records: [
      { _id: 'cr1', recordId: 'rec1', openid: 'oUserA', status: 'processing', scores: {}, tags: [] },
    ] })
    // pre-insert the winner's generating entity to simulate the loser's dup path
    const repId = idem.logicalReportId('oUserA', 'rec1')
    await DB.collection('ai_reports').add({ data: { _id: repId, reportId: repId, openid: 'oUserA', recordId: 'rec1', type: 'challenge_final', status: 'generating', claimToken: 'winner', claimAt: Date.now() } })
    // loser calls: add throws E11000 → must fall back to generating (no 2nd entity)
    const rl = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(rl.data.status, 'generating', 'C2 loser → generating')
    eq(DB._store.ai_reports.length, 1, 'C2 loser does not create 2nd entity')
  }

  // ── D: distinct records ──
  {
    reset({ challenge_records: [
      { _id: 'cr1', recordId: 'rec1', openid: 'oUserA', status: 'processing', scores: {}, tags: [] },
      { _id: 'cr2', recordId: 'rec2', openid: 'oUserA', status: 'processing', scores: {}, tags: [] },
    ] })
    const r1 = await idem.runChallengeFinalReport(dev({ event: { recordId: 'rec1' }, deps: deps() }))
    const r2 = await idem.runChallengeFinalReport(dev({ event: { recordId: 'rec2' }, deps: deps() }))
    ok(r1.data.reportId !== r2.data.reportId, 'D distinct reportIds')
    eq(DB._store.ai_reports.length, 2, 'D two independent entities')
    eq(new Set(DB._store.ai_reports.map((d) => d.recordId)).size, 2, 'D no record bleed')
  }

  // ── E: cross-user access ──
  {
    reset()
    const rb = await idem.runChallengeFinalReport(dev({ openid: 'oUserB', event: { recordId: 'rec1' }, deps: deps() }))
    eq(rb.code, require(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'errorCodes.js')).CODES.NOT_FOUND, 'E wrong owner → NOT_FOUND')
    eq(DB._store.ai_reports.length, 0, 'E no entity created for outsider')
    ok(!rb.data, 'E no report/paid leak')
    // cross-user on an existing entity (openid mismatch guard)
    reset()
    await idem.runChallengeFinalReport(dev({ deps: deps() }))
    const ent = DB._store.ai_reports[0]
    ent.openid = 'oUserB' // tamper to simulate a forged ownership row
    const rb2 = await idem.runChallengeFinalReport(dev({ openid: 'oUserA', deps: deps() }))
    eq(rb2.code, require(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'errorCodes.js')).CODES.PERMISSION_DENIED, 'E entity-owner mismatch → denied')
  }

  // ── F: AI failure + controlled retry ──
  {
    reset()
    const rFail = await idem.runChallengeFinalReport(dev({ deps: deps({ callAI: async () => ({ success: false, error: 'provider timeout' }) }) }))
    eq(rFail.code, require(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'errorCodes.js')).CODES.AI_ERROR, 'F failure → AI_ERROR')
    eq(DB._store.ai_reports.length, 1, 'F one entity after failure')
    eq(DB._store.ai_reports[0].status, 'failed', 'F status failed')
    const rid = DB._store.ai_reports[0].reportId
    const rRetry = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(rRetry.code, 0, 'F retry code 0')
    eq(rRetry.data.reportId, rid, 'F retry reuses same reportId')
    eq(DB._store.ai_reports.length, 1, 'F retry does not create 2nd entity')
    eq(DB._store.ai_reports[0].status, 'ready', 'F retry → ready')
  }

  // ── G: stale takeover vs stale writer (no clobber) ──
  {
    reset()
    const repId = idem.logicalReportId('oUserA', 'rec1')
    const old = Date.now() - 10 * 60 * 1000
    await DB.collection('ai_reports').add({ data: { _id: repId, reportId: repId, openid: 'oUserA', recordId: 'rec1', type: 'challenge_final', status: 'generating', claimToken: 'oldwriter', claimAt: old } })
    // a new request takes over (CAS on observed claimAt) and completes
    const rTake = await idem.runChallengeFinalReport(dev({ deps: deps({ callAI: async () => ({ success: true, content: JSON.stringify({ oneSentence: 'NEW', worldModelType: 'n', turnaroundProbability: 1 }), tokens: 1 }) }) }))
    eq(rTake.code, 0, 'G takeover code 0')
    eq(DB._store.ai_reports[0].status, 'ready', 'G takeover → ready')
    eq(DB._store.ai_reports[0].content.oneSentence, 'NEW', 'G takeover content stands')
    // stale writer tries to complete with its OLD token → must NOT overwrite
    const stale = await DB.collection('ai_reports')
      .where({ _id: repId, claimToken: 'oldwriter', status: 'generating' })
      .update({ data: { status: 'ready', content: { oneSentence: 'STALE' } } })
    eq(stale.stats.updated, 0, 'G stale writer update affects 0 rows')
    eq(DB._store.ai_reports[0].content.oneSentence, 'NEW', 'G stale writer did not clobber')
  }

  // ── H: unpaid read stays locked ──
  {
    reset()
    await idem.runChallengeFinalReport(dev({ deps: deps() }))
    const r = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(r.data.locked, true, 'H locked')
    ok(!r.data.content, 'H no body for unpaid')
    eq(r.data.isPaid, false, 'H isPaid false')
    ok(r.data.summary && typeof r.data.summary === 'object', 'H summary object present')
  }

  // ── I: paid reload reads full body ──
  {
    // I1: membership entitlement (server authority)
    reset()
    CTRL.vip = true
    await idem.runChallengeFinalReport(dev({ deps: deps() }))
    const r = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(r.data.locked, false, 'I1 membership → unlocked')
    ok(r.data.content && r.data.content.finalStrike, 'I1 full body readable')
    eq(r.data.isPaid, true, 'I1 isPaid true at read')

    // I2: finalizer-written isPaid=true
    reset()
    await idem.runChallengeFinalReport(dev({ deps: deps() }))
    DB._store.ai_reports[0].isPaid = true
    const r2 = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(r2.data.locked, false, 'I2 report.isPaid → unlocked')
    ok(r2.data.content && r2.data.content.oneSentence, 'I2 full body readable')
  }

  // ── J: shape + isPaid ownership ──
  {
    reset()
    const r = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(Object.keys(r.data).sort().join(','), ['isPaid', 'locked', 'preview', 'reportId', 'summary'].sort().join(','), 'J unpaid shape unchanged')
    eq(Object.keys(r.data.summary).sort().join(','), ['oneSentence', 'turnaroundProbability', 'worldModelType'].sort().join(','), 'J summary shape unchanged')
    // generation must NOT write isPaid anywhere (owned by finalizer)
    const wrotePaid = CTRL.updates.some((u) => Object.prototype.hasOwnProperty.call(u.data, 'isPaid'))
    ok(!wrotePaid, 'J generation never writes isPaid')
    const entDoc = DB._store.ai_reports[0]
    ok(!Object.prototype.hasOwnProperty.call(entDoc, 'isPaid'), 'J claim doc carries no isPaid')
    // paid shape
    reset()
    CTRL.vip = true
    await idem.runChallengeFinalReport(dev({ deps: deps() }))
    const rp = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(Object.keys(rp.data).sort().join(','), ['content', 'isPaid', 'locked', 'reportId', 'reportType'].sort().join(','), 'J paid shape')
  }

  console.log(`\nchallenge-report-idempotency_TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
