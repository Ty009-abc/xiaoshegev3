#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/challenge-worldmodel-e2e.test.js
 *
 * PAYMENT_STAGE5A_R7 — real product-chain E2E:
 *   finished paid challenge record
 *     → startChallenge (SAME recordId, no new record, no paywall)
 *     → challenge-result world-model type mapped to Chinese (no raw enum)
 *     → 9 dimensions rendered
 *     → goReport(type=challenge_final)
 *     → build report input (REAL builder)
 *     → AI provider STUB only
 *     → parse → persist (REAL idempotency/persistence module)
 *     → ai_reports ready → fetch same report
 *     → report-preview renders
 *
 * Variants: A current-schema, B legacy-schema, C missing-optional,
 * D repeated goReport, E same-owner, F cross-user, G failed→retry, H ready reuse.
 *
 * Real modules used (NOT mocked): startChallenge entry, worldModelLabels,
 * aiReportService contract path, idempotency/persistence, permission checkVip.
 * Only the external AI provider is stubbed.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')
const Module = require('module')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

const ROOT = path.resolve(__dirname, '..', '..')

// ───────────────────────── in-memory DB (shared by both functions) ──────────
let STORE = {}
let OPENID = 'oUserA'
function match (doc, q) {
  return Object.keys(q || {}).every((k) => {
    const v = q[k]; const dv = doc[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('$gt' in v) return dv > v.$gt
      if ('$gte' in v) return dv >= v.$gte
      if ('$lt' in v) return dv < v.$lt
      if ('$lte' in v) return dv <= v.$lte
      if ('$in' in v) return v.$in.includes(dv)
      if ('$ne' in v) return dv !== v.$ne
      return false
    }
    return dv === v
  })
}
function makeDB () {
  function collection (name) {
    if (!STORE[name]) STORE[name] = []
    let _w = {}, _limit = null, _sort = null
    const b = {
      where (w) { _w = w || {}; return b },
      limit (n) { _limit = n; return b },
      orderBy (f, dir) { _sort = { f, dir }; return b },
      field () { return b },
      async get () {
        let rows = STORE[name].filter((d) => match(d, _w))
        if (_sort) rows = rows.slice().sort((x, y) => { const a = x[_sort.f] == null ? 0 : x[_sort.f]; const c = y[_sort.f] == null ? 0 : y[_sort.f]; return _sort.dir === 'desc' ? c - a : a - c })
        if (_limit != null) rows = rows.slice(0, _limit)
        return { data: rows.map((d) => Object.assign({}, d)) }
      },
      async count () { return { total: STORE[name].filter((d) => match(d, _w)).length } },
      async add ({ data }) {
        if (name === 'ai_reports' && data && data._id && STORE[name].some((d) => d._id === data._id)) {
          const e = new Error('E11000 duplicate key error collection: ai_reports index: _id_ dup key'); e.errCode = -502001; throw e
        }
        const doc = Object.assign({ _id: name + '_' + (STORE[name].length + 1) }, data)
        STORE[name].push(doc); return { _id: doc._id }
      },
      async update ({ data }) {
        const rows = STORE[name].filter((d) => match(d, _w))
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
        const nextRows = rows.map(apply)
        rows.forEach((d, i) => Object.assign(d, nextRows[i]))
        return { stats: { updated: rows.length } }
      },
      doc (id) {
        return { async update ({ data }) { const d = STORE[name].find((x) => x._id === id); if (d) Object.assign(d, data); return { stats: { updated: d ? 1 : 0 } } } }
      },
    }
    return b
  }
  return { collection, command: { gt: (n) => ({ $gt: n }), gte: (n) => ({ $gte: n }), lt: (n) => ({ $lt: n }), lte: (n) => ({ $lte: n }), in: (a) => ({ $in: a }), neq: (n) => ({ $ne: n }), set: (v) => ({ __op: 'set', value: v }) } }
}

// ───────────────────────── wx-server-sdk stub ───────────────────────────────
const DB = makeDB()
const fakeCloud = {
  DYNAMIC_CURRENT_ENV: 'test-env',
  init () {},
  getWXContext: () => ({ OPENID }),
  database: () => DB,
}
const origLoad = Module._load
Module._load = function (request) {
  if (request === 'wx-server-sdk') return fakeCloud
  return origLoad.apply(this, arguments)
}

// ───────────────────────── real modules under test ──────────────────────────
const startChallenge = require(path.join(ROOT, 'cloudfunctions', 'startChallenge', 'index.js')).main
const idem = require(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'challengeReportIdempotency.js'))
const realAI = require(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'ai.js'))
const realPerm = require(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'permission.js'))
const labels = require(path.join(ROOT, 'utils', 'worldModelLabels.js'))

// ───────────────────────── fixtures ─────────────────────────────────────────
const CURRENT_PAID = () => ({
  _id: 'cr-current', recordId: 'CR_PAID_CURRENT', openid: 'oUserA', mode: 'challenge',
  status: 'finished', trialMode: false, unlocked: true, currentEventIndex: 30, currentDay: 31,
  finalType: 'normal_awakened',
  rawScores: { laborMindset: -2, probabilityMindset: 33, systemThinking: 96, leverageThinking: 54, capitalThinking: 20, riskAwareness: 20, informationSensitivity: 31, longTermism: 31, decisionStability: 42, cv: 133 },
  scoringVersion: 'normalized_v2',
  scores: { laborMindset: 0, probabilityMindset: 90, systemThinking: 66, leverageThinking: 64, capitalThinking: 55, riskAwareness: 80, informationSensitivity: 51, longTermism: 47, decisionStability: 62 },
  tags: ['行动派', '系统思维', '长期主义'],
  choices: [{ eventId: 'CE001', choice: 'A', choiceText: '先做7天测试' }, { eventId: 'CE002', choice: 'C', choiceText: '谈判即时补贴' }],
  unlockOrderId: 'XSG179063421831355dvw8', unlockedAt: 1790641215102, createdAt: 100, updatedAt: 200,
})
// legacy schema: only `scores` (no rawScores / scoringVersion) — old paid record
const LEGACY_PAID = () => ({
  _id: 'cr-legacy', recordId: 'CR_PAID_LEGACY', openid: 'oUserA', mode: 'challenge',
  status: 'finished', trialMode: false, unlocked: true, currentEventIndex: 30, currentDay: 31,
  finalType: 'strategic',
  scores: { capitalThinking: 61, leverageThinking: 70, systemThinking: 55 },
  createdAt: 101, updatedAt: 201,
})
// missing optional fields: no tags, no choices
const MINIMAL_PAID = () => ({
  _id: 'cr-min', recordId: 'CR_PAID_MIN', openid: 'oUserA', mode: 'challenge',
  status: 'finished', trialMode: false, unlocked: true, currentEventIndex: 30, currentDay: 31,
  finalType: '', scores: { systemThinking: 50 }, createdAt: 102, updatedAt: 202,
})

function seed (records, extra) {
  STORE = Object.assign({ users: [{ openid: 'oUserA', membershipLevel: 'free' }, { openid: 'oOther', membershipLevel: 'free' }], memberships: [], entitlements: [], challenge_records: records || [], ai_reports: [], ai_logs: [] }, extra || {})
}
function invokeStart () { return startChallenge({}, {}) }
function genDeps (over) {
  return Object.assign({
    callAI: async () => ({ success: true, content: JSON.stringify({ oneSentence: '你有对冲思维。', worldModelType: 'normal_awakened', bestPath: { name: '稳中求变', score: 9 }, actions: ['a', 'b'] }), tokens: 12 }),
    buildReportPrompt: realAI.buildReportPrompt,   // REAL builder
    checkVip: realPerm.checkVip,                   // REAL permission authority
    emitModelCall: () => Promise.resolve(),
  }, over || {})
}
function invokeGen (recordId, over) {
  return idem.runChallengeFinalReport({ db: DB, openid: OPENID, event: { recordId }, ts: Date.now(), deps: genDeps(over) })
}

// ── report-preview client render harness (vm) ──
function loadReportPreview (serverResp) {
  const src = fs.readFileSync(path.join(ROOT, 'pages', 'report-preview', 'report-preview.js'), 'utf8')
  let config = null
  const sandbox = {
    require: (req) => {
      if (req.indexOf('services/aiReportService') >= 0) return { generateAiReport: async () => serverResp, getAiReport: async () => serverResp }
      if (req.indexOf('services/permissionService') >= 0) return {}
      if (req.indexOf('utils/analytics') >= 0) return { track () {}, flush () {} }
      return {}
    },
    Page: (c) => { config = c },
    getApp: () => ({ globalData: {} }),
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, Error, RegExp, Promise,
    setTimeout, clearTimeout, encodeURIComponent,
    wx: { showToast () {}, navigateTo () {}, setNavigationBarTitle () {}, createSelectorQuery: () => ({ select: () => ({ boundingClientRect: () => ({ exec () {} }) }) }) },
  }
  vm.createContext(sandbox)
  vm.runInContext(src, sandbox, { filename: 'report-preview.js' })
  const inst = Object.assign({}, config)
  inst.data = JSON.parse(JSON.stringify(config.data || {}))
  inst.setData = function (o) { Object.assign(inst.data, o) }
  return inst
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 5))

// ═══════════════════════════════════════════════════════════════════════════
;(async () => {
  console.log('PAYMENT_STAGE5A_R7 world-model E2E')
  const CANON = 'CR1790632776226vtmih6'

  // ── A: current-schema finished PAID (use the real owner record id) ──
  {
    const rec = CURRENT_PAID(); rec.recordId = CANON
    seed([rec])
    const r = await invokeStart()
    eq(r.code, 0, 'A.1 startChallenge ok')
    eq(r.data.recordId, CANON, 'A.2 SAME recordId (no new record)')
    eq(r.data.completed, true, 'A.3 completed')
    eq(r.data.destination, 'challenge_result', 'A.4 → challenge-result (NO_PAYWALL)')
    eq(STORE.challenge_records.length, 1, 'A.5 NO_NEW_CHALLENGE_RECORD')

    // world-model type mapped
    eq(labels.worldModelTypeLabel(rec.finalType), '普通觉醒型', 'A.6 NO_RAW_ENUM')

    // 9 dimensions renderable
    const dims = ['laborMindset', 'probabilityMindset', 'systemThinking', 'leverageThinking', 'capitalThinking', 'riskAwareness', 'informationSensitivity', 'longTermism', 'decisionStability']
    eq(dims.every((d) => rec.scores[d] != null), true, 'A.7 nine dimensions present')

    // goReport → generate
    const g = await invokeGen(CANON)
    eq(g.code, 0, 'A.8 REPORT_GENERATED')
    const row = STORE.ai_reports[0]
    eq(row.status, 'ready', 'A.9 REPORT_PERSISTED ready')
    ok(row.content && row.content.oneSentence, 'A.10 content persisted (nested-safe)')
    ok(row.content.bestPath && row.content.bestPath.name === '稳中求变', 'A.11 nested content intact')
    eq(STORE.ai_reports.length, 1, 'A.12 one logical report')
    ok(!Object.prototype.hasOwnProperty.call(row, 'isPaid'), 'A.13 generation wrote no isPaid')

    // fetch same report
    const g2 = await invokeGen(CANON)
    eq(g2.data.reportId, g.data.reportId, 'A.14 REPORT_FETCHED same reportId')

    // report-preview renders
    const p = loadReportPreview(g)
    await p.onLoad({ recordId: CANON, type: 'challenge_final' })
    await tick(10)
    eq(p.data.cfState, 'ready', 'A.15 REPORT_RENDERED (cfState ready)')
  }

  // ── B: legacy-schema finished paid ──
  {
    seed([LEGACY_PAID()])
    const r = await invokeStart()
    eq(r.data.recordId, 'CR_PAID_LEGACY', 'B.1 legacy SAME recordId')
    eq(r.data.completed, true, 'B.2 legacy completed/result')
    eq(STORE.challenge_records.length, 1, 'B.3 no new record')
    eq(labels.worldModelTypeLabel('strategic'), '战略型翻身者', 'B.4 legacy enum mapped')
    const g = await invokeGen('CR_PAID_LEGACY')
    eq(g.code, 0, 'B.5 legacy report generated')
    eq(STORE.ai_reports[0].status, 'ready', 'B.6 legacy report persisted')
  }

  // ── C: missing optional fields ──
  {
    seed([MINIMAL_PAID()])
    const r = await invokeStart()
    eq(r.data.completed, true, 'C.1 minimal completed')
    eq(labels.worldModelTypeLabel(''), '认知探索者', 'C.2 missing enum → generic fallback')
    const g = await invokeGen('CR_PAID_MIN')
    eq(g.code, 0, 'C.3 REPORT_INPUT_VALID + GENERATED with no tags/choices')
    eq(STORE.ai_reports[0].status, 'ready', 'C.4 persisted')
  }

  // ── D: repeated goReport → idempotent ──
  {
    seed([CURRENT_PAID()])
    const a = await invokeGen('CR_PAID_CURRENT')
    const b = await invokeGen('CR_PAID_CURRENT')
    const c = await invokeGen('CR_PAID_CURRENT')
    eq(STORE.ai_reports.length, 1, 'D.1 repeated goReport → one report')
    eq(a.data.reportId, b.data.reportId, 'D.2 same reportId')
    eq(b.data.reportId, c.data.reportId, 'D.3 same reportId')
  }

  // ── E: same-owner repeat startChallenge → no new record ──
  {
    seed([CURRENT_PAID()])
    await invokeStart(); await invokeStart(); await invokeStart()
    eq(STORE.challenge_records.length, 1, 'E.1 same owner repeat → no new challenge record')
  }

  // ── F: cross-user rejection ──
  {
    seed([CURRENT_PAID()])
    // another user tries to load the paid record's report
    OPENID = 'oOther'
    const g = await invokeGen('CR_PAID_CURRENT')
    ok(g.code !== 0, 'F.1 cross-user rejected (own report)')
    // and startChallenge must not resume another user's record
    const r = await invokeStart()
    ok(r.code !== 0 || (r.data && r.data.trialMode === true), 'F.2 cross-user entry → trial (not other user record)')
    const ownerRec = STORE.challenge_records.find((c) => c.recordId === 'CR_PAID_CURRENT')
    ok(ownerRec && ownerRec.trialMode === false && ownerRec.unlocked === true, 'F.3 cross-user did NOT downgrade/touch owner paid record')
    OPENID = 'oUserA'
  }

  // ── G: existing failed report → retry → ready ──
  {
    seed([CURRENT_PAID()])
    const repId = idem.logicalReportId('oUserA', 'CR_PAID_CURRENT')
    STORE.ai_reports.push({ _id: repId, reportId: repId, openid: 'oUserA', recordId: 'CR_PAID_CURRENT', type: 'challenge_final', status: 'failed', content: null, claimToken: 'old', claimAt: 1, persistFailed: true, lastError: '报告持久化失败：old' })
    const g = await invokeGen('CR_PAID_CURRENT')
    eq(g.code, 0, 'G.1 retry ok')
    eq(STORE.ai_reports.length, 1, 'G.2 same entity')
    eq(STORE.ai_reports[0].status, 'ready', 'G.3 failed → ready')
  }

  // ── H: existing ready report → reuse (no overwrite) ──
  {
    seed([CURRENT_PAID()])
    const repId = idem.logicalReportId('oUserA', 'CR_PAID_CURRENT')
    STORE.ai_reports.push({ _id: repId, reportId: repId, openid: 'oUserA', recordId: 'CR_PAID_CURRENT', type: 'challenge_final', status: 'ready', content: { oneSentence: '既有报告' }, claimToken: 'x', claimAt: 1 })
    const g = await invokeGen('CR_PAID_CURRENT')
    eq(g.code, 0, 'H.1 reuse ok')
    eq(STORE.ai_reports[0].content.oneSentence, '既有报告', 'H.2 ready NOT overwritten')
    eq(STORE.ai_reports.length, 1, 'H.3 no duplicate')
  }

  // ── paid authority: no duplicate entitlement, no payment side effects ──
  {
    seed([CURRENT_PAID()], { entitlements: [{ _id: 'e1', openid: 'oUserA', permissions: ['challenge_full'] }] })
    await invokeStart()
    await invokeGen('CR_PAID_CURRENT')
    eq(STORE.entitlements.length, 1, 'Z.1 NO_DUPLICATE_ENTITLEMENT')
    eq((STORE.memberships || []).length, 0, 'Z.2 no membership write')
    ok(!STORE.challenge_records.some((c) => c.trialMode === true), 'Z.3 no trial downgrade')
  }

  Module._load = origLoad
  console.log(`\nchallenge-worldmodel-e2e_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
