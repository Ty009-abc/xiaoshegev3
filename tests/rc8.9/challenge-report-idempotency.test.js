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
  failUpdateWhen: null, // (where, data) => bool → inject persistence failure
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
        if (CTRL.failUpdateWhen && CTRL.failUpdateWhen(Object.assign({}, _w), Object.assign({}, data))) {
          throw new Error('persist-fail-injected')
        }
        // Faithful emulation of wx-server-sdk encode + Mongo semantics:
        //  • db.command.set(v) → marker → WHOLE-FIELD replacement (no flatten)
        //  • nested plain object → dot-path flatten; Mongo throws
        //    "Cannot create field 'x' in element {k: null}" when the parent
        //    field EXISTS but is null/scalar (undefined parent is created).
        // Applied atomically: compute all next-row states first, then commit.
        const apply = (d) => {
          const next = Object.assign({}, d)
          for (const k of Object.keys(data)) {
            const v = data[k]
            if (v && typeof v === 'object' && v.__op === 'set') { next[k] = v.value; continue }
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              const parent = next[k]
              if (parent !== undefined && (parent === null || typeof parent !== 'object' || Array.isArray(parent))) {
                throw new Error("Cannot create field '" + Object.keys(v)[0] + "' in element {" + k + ': ' + (parent === null ? 'null' : typeof parent) + '}')
              }
              if (next[k] === undefined) next[k] = {}
              for (const ck of Object.keys(v)) next[k + '.' + ck] = v[ck]
              continue
            }
            next[k] = v
          }
          return next
        }
        const nextRows = rows.map(apply) // throws BEFORE any mutation → atomic
        rows.forEach((d, i) => { Object.assign(d, nextRows[i]) })
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
    command: { gt: (n) => ({ $gt: n }), in: (a) => ({ $in: a }), set: (v) => ({ __op: 'set', value: v }) },
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
  CTRL.failUpdateWhen = null
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

  // ═══════════════════════════════════════════════════════════════════════
  // PAYMENT_STAGE5A_R4_P0_REPORT_RECOVERY — completion durability matrix
  //   R4-1 model success + valid     → ready + content persisted
  //   R4-2 model success + irregular → explicit failed (never stuck generating)
  //   R4-3 model timeout             → explicit failed (never stuck generating)
  //   R4-4 parse exception           → handled, never throws, never stuck
  //   R4-5 persistence exception     → audited + deterministic terminal state
  //   R4-6 stale generating          → recovers safely on retry/re-entry
  //   R4-7 duplicate retry           → same entity, no duplicate report
  //   R4-12 generation never writes isPaid (all paths)
  // ═══════════════════════════════════════════════════════════════════════
  const CODES = require(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'errorCodes.js')).CODES

  // R4-1
  {
    reset()
    const r = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(r.code, 0, 'R4-1 code 0')
    eq(DB._store.ai_reports.length, 1, 'R4-1 one entity')
    eq(DB._store.ai_reports[0].status, 'ready', 'R4-1 status ready')
    ok(DB._store.ai_reports[0].content && DB._store.ai_reports[0].content.finalStrike, 'R4-1 content persisted')
    ok(DB._store.ai_logs.some((l) => l.action === 'generate_report' && l.success === true), 'R4-1 completion audit row')
  }

  // R4-2
  {
    reset()
    const r = await idem.runChallengeFinalReport(dev({ deps: deps({ callAI: async () => ({ success: true, content: '这是一段纯文本，不是 JSON。', tokens: 5 }) }) }))
    eq(r.code, CODES.AI_ERROR, 'R4-2 code AI_ERROR')
    eq(DB._store.ai_reports.length, 1, 'R4-2 one entity')
    eq(DB._store.ai_reports[0].status, 'failed', 'R4-2 failed (NOT stuck generating)')
    ok(!DB._store.ai_reports[0].content, 'R4-2 no fabricated content')
    ok(!!DB._store.ai_reports[0].lastError, 'R4-2 lastError metadata set')
    const rid = DB._store.ai_reports[0].reportId
    const rr = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(rr.code, 0, 'R4-2 retry code 0')
    eq(DB._store.ai_reports.length, 1, 'R4-2 retry no 2nd entity')
    eq(DB._store.ai_reports[0].reportId, rid, 'R4-2 retry same reportId')
    eq(DB._store.ai_reports[0].status, 'ready', 'R4-2 retry recovers → ready')
  }

  // R4-3
  {
    reset()
    let emitted = null
    const r = await idem.runChallengeFinalReport(dev({ deps: deps({
      modelTimeoutMs: 30,
      callAI: () => new Promise(() => {}),
      emitModelCall: (db, res, meta) => { emitted = res; return Promise.resolve() },
    }) }))
    eq(r.code, CODES.AI_ERROR, 'R4-3 code AI_ERROR')
    eq(DB._store.ai_reports.length, 1, 'R4-3 one entity')
    eq(DB._store.ai_reports[0].status, 'failed', 'R4-3 timeout → failed (NOT stuck generating)')
    ok(/超时/.test(String(r.message || '')), 'R4-3 timeout message surfaced')
    ok(emitted && emitted.success === false, 'R4-3 model-call telemetry emitted for timeout')
  }

  // R4-4
  {
    reset()
    let threw = false
    try { idem.parseAiReport('x'); idem.parseAiReport({ a: 1 }); idem.parseAiReport(null); idem.parseAiReport(undefined); idem.parseAiReport(123) } catch (_) { threw = true }
    ok(!threw, 'R4-4 parseAiReport never throws (string/object/null/undefined/number)')
    const r = await idem.runChallengeFinalReport(dev({ deps: deps({ callAI: async () => ({ success: true, content: null, tokens: 1 }) }) }))
    eq(r.code, CODES.AI_ERROR, 'R4-4 null content code AI_ERROR')
    eq(DB._store.ai_reports[0].status, 'failed', 'R4-4 null content → failed (NOT stuck generating)')
  }

  // R4-5
  {
    reset()
    CTRL.failUpdateWhen = (where, data) => data && data.status === 'ready'
    const r = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    CTRL.failUpdateWhen = null
    eq(r.code, CODES.AI_ERROR, 'R4-5 persist-fail code AI_ERROR')
    eq(DB._store.ai_reports.length, 1, 'R4-5 one entity')
    eq(DB._store.ai_reports[0].status, 'failed', 'R4-5 persist-fail → explicit failed (NOT stuck generating)')
    ok(!!DB._store.ai_reports[0].lastError, 'R4-5 lastError metadata set')
    ok(DB._store.ai_logs.some((l) => l.action === 'generate_report' && l.success === false), 'R4-5 failure audited')
  }

  // R4-6
  {
    reset()
    const repId = idem.logicalReportId('oUserA', 'rec1')
    const old = Date.now() - 10 * 60 * 1000
    await DB.collection('ai_reports').add({ data: { _id: repId, reportId: repId, openid: 'oUserA', recordId: 'rec1', type: 'challenge_final', status: 'generating', claimToken: 'abandoned', claimAt: old } })
    const r = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(r.code, 0, 'R4-6 stale recovery code 0')
    eq(DB._store.ai_reports.length, 1, 'R4-6 no 2nd entity')
    eq(DB._store.ai_reports[0].status, 'ready', 'R4-6 stale generating → ready')
    eq(DB._store.ai_reports[0].content && DB._store.ai_reports[0].content.finalStrike ? 'y' : 'n', 'y', 'R4-6 content persisted')
  }

  // R4-7
  {
    reset()
    const r1 = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    const r2 = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(DB._store.ai_reports.length, 1, 'R4-7 exactly one entity after duplicate retry')
    eq(r1.data.reportId, r2.data.reportId, 'R4-7 same authoritative reportId')
  }

  // R4-12
  {
    reset()
    await idem.runChallengeFinalReport(dev({ deps: deps({ callAI: async () => ({ success: true, content: 'nope', tokens: 1 }) }) }))
    ok(!CTRL.updates.some((u) => Object.prototype.hasOwnProperty.call(u.data, 'isPaid')), 'R4-12a parse-path never writes isPaid')
    reset()
    CTRL.failUpdateWhen = (where, data) => data && data.status === 'ready'
    await idem.runChallengeFinalReport(dev({ deps: deps() }))
    CTRL.failUpdateWhen = null
    ok(!CTRL.updates.some((u) => Object.prototype.hasOwnProperty.call(u.data, 'isPaid')), 'R4-12b persist-path never writes isPaid')
    reset()
    await idem.runChallengeFinalReport(dev({ deps: deps({ modelTimeoutMs: 20, callAI: () => new Promise(() => {}) }) }))
    ok(!CTRL.updates.some((u) => Object.prototype.hasOwnProperty.call(u.data, 'isPaid')), 'R4-12c timeout-path never writes isPaid')
  }

  // ═══════════════════════════════════════════════════════════════════════
  // R7 — persistence contract (placeholder content:null → whole object)
  // ═══════════════════════════════════════════════════════════════════════

  // P1+P2: placeholder content=null → completion with NESTED object → success + intact
  {
    reset()
    const nested = JSON.stringify({
      oneSentence: '你有对冲思维，但缺少长期主义。',
      worldModelType: 'normal_awakened',
      bestPath: { name: '稳中求变', score: 9 },
      diagnosis: { core: '结构性问题', detail: '缺少杠杆' },
      actions: ['存安全垫', '做实验'],
    })
    const r = await idem.runChallengeFinalReport(dev({ deps: deps({ callAI: async () => ({ success: true, content: nested, tokens: 9 }) }) }))
    eq(r.code, 0, 'P1 code 0')
    const row = DB._store.ai_reports[0]
    eq(row.status, 'ready', 'P1 status ready')
    ok(row.content && typeof row.content === 'object', 'P2 content stored as object (not flattened)')
    eq(row.content.bestPath && row.content.bestPath.name, '稳中求变', 'P2 nested bestPath intact')
    eq(row.content.diagnosis && row.content.diagnosis.core, '结构性问题', 'P2 nested diagnosis intact')
    ok(Array.isArray(row.content.actions) && row.content.actions.length === 2, 'P2 actions array intact')
  }

  // P3: failed → retry → ready (existing failed row)
  {
    reset()
    const repId = idem.logicalReportId('oUserA', 'rec1')
    await DB.collection('ai_reports').add({ data: { _id: repId, reportId: repId, openid: 'oUserA', recordId: 'rec1', type: 'challenge_final', status: 'failed', content: null, claimToken: 'old', claimAt: Date.now() - 60000, lastError: '报告持久化失败：old' } })
    const r = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(r.code, 0, 'P3 retry code 0')
    eq(DB._store.ai_reports.length, 1, 'P3 same entity (no duplicate)')
    eq(DB._store.ai_reports[0].status, 'ready', 'P3 failed → ready')
    ok(DB._store.ai_reports[0].content && DB._store.ai_reports[0].content.oneSentence, 'P3 content persisted on retry')
  }

  // P4: repeated identical request → idempotent
  {
    reset()
    await idem.runChallengeFinalReport(dev({ deps: deps() }))
    await idem.runChallengeFinalReport(dev({ deps: deps() }))
    await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(DB._store.ai_reports.length, 1, 'P4 no duplicate report')
  }

  // P5: existing ready report → reused
  {
    reset()
    const repId = idem.logicalReportId('oUserA', 'rec1')
    await DB.collection('ai_reports').add({ data: { _id: repId, reportId: repId, openid: 'oUserA', recordId: 'rec1', type: 'challenge_final', status: 'ready', content: { oneSentence: '已存在的报告' }, claimToken: 'x', claimAt: 1, createdAt: 1, updatedAt: 1 } })
    const r = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(r.code, 0, 'P5 code 0')
    eq(DB._store.ai_reports[0].content.oneSentence, '已存在的报告', 'P5 ready report NOT overwritten')
    eq(DB._store.ai_reports.length, 1, 'P5 no new entity')
  }

  // P6: DB persistence failure → failed/retryable remains valid
  {
    reset()
    CTRL.failUpdateWhen = (where, data) => data && data.status === 'ready'
    const r1 = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    CTRL.failUpdateWhen = null
    eq(r1.code !== 0, true, 'P6 persistence failure surfaced as error')
    const row = DB._store.ai_reports[0]
    eq(row.status, 'failed', 'P6 status failed')
    eq(row.persistFailed, true, 'P6 persistFailed flag')
    const r2 = await idem.runChallengeFinalReport(dev({ deps: deps() }))
    eq(r2.code, 0, 'P6 retry after failure succeeds')
    eq(DB._store.ai_reports[0].status, 'ready', 'P6 failed → ready on retry')
    eq(DB._store.ai_reports.length, 1, 'P6 still one entity')
  }

  // P7: no payment authority fields ever written
  {
    reset()
    await idem.runChallengeFinalReport(dev({ deps: deps() }))
    const banned = ['isPaid', 'entitlement', 'entitlements', 'membership', 'memberships', 'paid', 'payment', 'paymentSuccess', 'orderId']
    const wrote = CTRL.updates.some((u) => Object.keys(u.data).some((k) => banned.includes(k)))
    ok(!wrote, 'P7 generation never writes payment authority fields')
    const row = DB._store.ai_reports[0]
    ok(!Object.prototype.hasOwnProperty.call(row, 'isPaid'), 'P7 entity has no isPaid field')
  }

  // MUTATION: restore the OLD nested-`.update` (flattening over content:null)
  // → the persistence path MUST fail (proves the fix is load-bearing).
  {
    reset()
    const row = () => DB._store.ai_reports[0]
    // simulate the pre-fix write: plain nested object over content:null
    let threw = false
    try {
      await DB.collection('ai_reports').add({ data: { _id: 'm1', reportId: 'm1', openid: 'oUserA', recordId: 'rec1', type: 'challenge_final', status: 'generating', claimToken: 't', claimAt: Date.now(), content: null } })
      await DB.collection('ai_reports').where({ _id: 'm1' }).update({ data: { status: 'ready', content: { bestPath: { name: 'A' } } } })
    } catch (e) { threw = true }
    ok(threw, 'MUT old nested-update over content:null MUST throw (Cannot create field)')
    ok(row() && row().status === 'generating', 'MUT entity left non-ready after old path')
  }

  console.log(`\nchallenge-report-idempotency_TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
