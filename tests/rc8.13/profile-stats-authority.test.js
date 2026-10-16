#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.13/profile-stats-authority.test.js — RC8_13_P0_PROFILE_HISTORY_AUTHORITY_FIX
 *
 * Server-authority stats function (getProfileStats) + canonical count policy.
 *
 *  A  COUNT_POLICY: viewable-report rule == report-history kindOf rule (incl. shadow exclusion)
 *  B  HANDLER_IDENTITY: owner-scoped counts from getWXContext().OPENID
 *  C  ZERO_CONFIRMED: no qualifying records → 0 (not an error)
 *  D  CROSS_USER_ISOLATION: only the authenticated openid's rows are counted
 *  E  AUTH_GUARD: no openid → AUTH_FAILED, no data leak
 *  F  NO_TRUST_CLIENT_OPENID: event.openid cannot override identity
 *  G  CHALLENGE_SEMANTICS: challengeCount (all) + challengeFinishedCount
 *  H  REPORT_TOTAL vs COUNT: raw diagnostic rows vs viewable reports
 *  I  READ_ONLY: no add/update/set/remove/delete on any collection
 *  J  RESPONSE_ENVELOPE: {code,message,data} + counts shape; DB error → fail(DB_ERROR)
 *  K  SOURCE_INVARIANTS: identity from getWXContext, no client openid trust, frozen fns untouched
 *
 * Logic + source-asset only. No network / DB / device claim.
 */
const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const FN_DIR = path.join(ROOT, 'cloudfunctions', 'getProfileStats')
const INDEX = path.join(FN_DIR, 'index.js')
const POLICY = path.join(FN_DIR, 'lib', 'reportVisibility.js')
const CHALLENGE_POLICY = path.join(FN_DIR, 'lib', 'challengeListability.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_13_PROFILE_STATS_AUTHORITY')

const policy = require(POLICY)
const challengePolicy = require(CHALLENGE_POLICY)
const idxSrc = fs.readFileSync(INDEX, 'utf8')

;(async () => {
// ── A COUNT_POLICY ──
{
  // viewable = challenge_final w/ recordId, or content.fatal_sentence, or content.system_trap
  ok(policy.isViewableReport({ type: 'challenge_final', recordId: 'CR1' }) === true, 'A challenge_final+recordId viewable')
  ok(policy.isViewableReport({ type: 'challenge_final' }) === false, 'A challenge_final no recordId NOT viewable')
  ok(policy.isViewableReport({ type: 'diagnostic', content: { fatal_sentence: 'x' } }) === true, 'A fatal_sentence viewable')
  ok(policy.isViewableReport({ type: 'diagnostic', content: { system_trap: 'y' } }) === true, 'A system_trap viewable')
  ok(policy.isViewableReport({ type: 'diagnostic_world_model_v2_shadow' }) === false, 'A shadow (empty) NOT viewable')
  ok(policy.isViewableReport({ type: 'diagnostic_world_model_v1', content: { report: 1, diagnosis: 1 } }) === false, 'A v1 non-canonical NOT viewable')
  ok(policy.isViewableReport(null) === false, 'A null NOT viewable')
  // batch: owner-like mix of 6 rows → exactly 1 viewable
  const mix = [
    { type: 'diagnostic_world_model_v2_1_shadow' },
    { type: 'diagnostic_world_model_v2_shadow' },
    { type: 'diagnostic_world_model_v2_shadow' },
    { type: 'diagnostic_world_model_v1', content: { report: {} } },
    { type: 'diagnostic_world_model_v1', content: { report: {} } },
    { type: 'diagnostic', content: { fatal_sentence: 's', system_trap: 't' } },
  ]
  eq(policy.countViewableReports(mix), 1, 'A owner mix → 1 viewable (5 non-canonical excluded)')
  eq(policy.countViewableReports([]), 0, 'A empty → 0')
  // pagesFor
  eq(policy.pagesFor(0, 100), 0, 'A pagesFor(0)=0')
  eq(policy.pagesFor(6, 100), 1, 'A pagesFor(6)=1')
  eq(policy.pagesFor(250, 100), 3, 'A pagesFor(250)=3')
  // single canonical challenge listability predicate (shared w/ getChallengeRecords)
  ok(challengePolicy.isListableChallenge({ status: 'processing' }) === true, 'A processing listable')
  ok(challengePolicy.isListableChallenge({ status: 'finished' }) === true, 'A finished listable')
  ok(challengePolicy.isListableChallenge({}) === true, 'A owner row listable')
  ok(challengePolicy.isListableChallenge(null) === false, 'A null NOT listable')
  eq(challengePolicy.statusKind('processing'), 'processing', 'A statusKind processing')
  eq(challengePolicy.statusKind('finished'), 'finished', 'A statusKind finished')
  eq(challengePolicy.statusKind('weird'), 'unknown', 'A statusKind unknown closed-set')
  eq(challengePolicy.displayDay(31, 'finished'), 0, 'A finished shows no day (day=31 artifact hidden)')
  eq(challengePolicy.displayDay(31, 'processing'), 30, 'A processing day capped at 30')
  eq(challengePolicy.displayDay(4, 'processing'), 4, 'A processing day passthrough <=30')
  // parity: the visibility rule lives in the SHARED module consumed by BOTH
  // getProfileStats and getReportHistory (identical artifact) — no client copy.
  const rhFn = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'getReportHistory', 'index.js'), 'utf8')
  ok(/reportVisibility\.js/.test(rhFn), 'A getReportHistory uses shared reportVisibility policy')
  ok(/reportVisibility\.js/.test(idxSrc), 'A getProfileStats uses shared reportVisibility policy')
  const chFn = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'getChallengeRecords', 'index.js'), 'utf8')
  ok(/challengeListability\.js/.test(chFn), 'A getChallengeRecords uses shared challengeListability policy')
  ok(/challengeListability\.js/.test(idxSrc), 'A getProfileStats uses shared challengeListability policy')
  const rhPage = fs.readFileSync(path.join(ROOT, 'pages/report-history/report-history.js'), 'utf8')
  ok(!/function kindOf/.test(rhPage), 'A client report-history carries NO policy copy')
  ok(/getReportHistory/.test(rhPage), 'A client report-history consumes the server list API')
  // parity with report-history kindOf source
  // parity: profile & report-history share ONE visibility rule (identical artifact)
  const profVis = require(path.join(ROOT, 'cloudfunctions/getProfileStats/lib/reportVisibility.js'))
  const rhVis = require(path.join(ROOT, 'cloudfunctions/getReportHistory/lib/reportVisibility.js'))
  ok(profVis.kindOf({ type: 'challenge_final', recordId: 'x' }) === rhVis.kindOf({ type: 'challenge_final', recordId: 'x' }), 'A parity: profile & report-history share one visibility rule')
  ok(profVis.kindOf({ type: 'diagnostic', content: { fatal_sentence: 'x' } }) === 'legacy6q', 'A parity: legacy6q visible in shared rule')
}

// ── handler harness ──
function makeDb (data, log) {
  function builder (name) {
    const st = { w: {}, field: null, order: null, skip: 0, limit: -1 }
    const api = {
      where (w) { st.w = w || {}; return api },
      field (f) { st.field = f; return api },
      orderBy () { return api },
      skip (n) { st.skip = n; return api },
      limit (n) { st.limit = n; return api },
      async count () {
        const rows = (data[name] || []).filter((r) => Object.keys(st.w).every((k) => r[k] === st.w[k]))
        return { total: rows.length }
      },
      async get () {
        let rows = (data[name] || []).filter((r) => Object.keys(st.w).every((k) => r[k] === st.w[k]))
        if (st.skip) rows = rows.slice(st.skip)
        if (st.limit >= 0) rows = rows.slice(0, st.limit)
        return { data: rows }
      },
    }
    return api
  }
  return {
    collection: (name) => {
      const b = builder(name)
      // forbid writes — record any attempt
      b.add = () => { log.writes.push('add:' + name); throw new Error('WRITE_FORBIDDEN') }
      b.doc = () => ({ update: () => { log.writes.push('update:' + name) }, set: () => { log.writes.push('set:' + name) }, remove: () => { log.writes.push('remove:' + name) } })
      return b
    },
  }
}

function loadFn (data, openid, event) {
  const log = { writes: [], errors: [] }
  const db = makeDb(data, log)
  let main = null
  const sandbox = {
    require: (id) => {
      if (id === 'wx-server-sdk') {
        return {
          init: () => {},
          DYNAMIC_CURRENT_ENV: 'env',
          database: () => db,
          getWXContext: () => ({ OPENID: openid }),
        }
      }
      if (id.indexOf('response.js') >= 0) return require(path.join(FN_DIR, 'lib', 'response.js'))
      if (id.indexOf('reportVisibility.js') >= 0) return policy
      if (id.indexOf('challengeListability.js') >= 0) return challengePolicy
      throw new Error('unexpected require: ' + id)
    },
    module: { exports: {} }, exports: {},
    console: Object.assign({}, console, { error: (...a) => log.errors.push(a.join(' ')), log: () => {}, warn: () => {} }),
    Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise, isFinite,
    setTimeout: () => 0, clearTimeout: () => {},
  }
  sandbox.exports = sandbox.module.exports
  vm.createContext(sandbox)
  vm.runInContext(idxSrc, sandbox, { filename: INDEX })
  main = sandbox.module.exports.main || sandbox.exports.main
  return { main, log, call: (ev) => main(ev || event || {}, {}) }
}

// ── B HANDLER_IDENTITY ──
{
  const OWN = 'oZa463Te7dLGGA5yQlRearlD8B3I'
  const data = {
    ai_reports: [
      { openid: OWN, type: 'diagnostic', content: { fatal_sentence: 'a' }, isPaid: false },
      { openid: OWN, type: 'diagnostic_world_model_v2_shadow' },
      { openid: OWN, type: 'diagnostic_world_model_v1', content: { report: {} } },
    ],
    challenge_records: [
      { openid: OWN, status: 'processing', mode: 'challenge' },
      { openid: OWN, status: 'finished', finalType: 'normal_awakened' },
    ],
  }
  const { call } = loadFn(data, OWN)
  const r = await call({})
  eq(r.code, 0, 'B code 0')
  eq(r.data.counts.reportCount, 1, 'B viewable reports = 1')
  eq(r.data.counts.reportTotalRecords, 3, 'B raw reports = 3')
  eq(r.data.counts.challengeCount, 2, 'B challenges = 2')
  eq(r.data.counts.challengeFinishedCount, 1, 'B finished challenges = 1')
  eq(r.data.latestFinishedType, 'normal_awakened', 'B latestFinishedType surfaced')
  eq(r.data.identity, 'server', 'B identity=server')
}
// ── C ZERO_CONFIRMED ──
{
  const { call } = loadFn({ ai_reports: [], challenge_records: [] }, 'oUSER_EMPTY')
  const r = await call({})
  eq(r.code, 0, 'C code 0 (empty is success)')
  eq(r.data.counts.reportCount, 0, 'C reportCount 0')
  eq(r.data.counts.challengeCount, 0, 'C challengeCount 0')
  eq(r.data.counts.reportTotalRecords, 0, 'C reportTotalRecords 0')
}
// ── D CROSS_USER_ISOLATION ──
{
  const OWN = 'oOWN'
  const data = {
    ai_reports: [
      { openid: OWN, type: 'diagnostic', content: { fatal_sentence: 'x' } },
      { openid: 'oOTHER', type: 'diagnostic', content: { fatal_sentence: 'y' } },
      { openid: 'oOTHER', type: 'diagnostic', content: { fatal_sentence: 'z' } },
    ],
    challenge_records: [
      { openid: OWN, status: 'processing' },
      { openid: 'oOTHER', status: 'finished' },
    ],
  }
  const { call } = loadFn(data, OWN)
  const r = await call({})
  eq(r.data.counts.reportCount, 1, 'D reportCount counts ONLY owner (others inaccessible)')
  eq(r.data.counts.reportTotalRecords, 1, 'D reportTotalRecords ONLY owner')
  eq(r.data.counts.challengeCount, 1, 'D challengeCount ONLY owner')
}
// ── E AUTH_GUARD ──
{
  const { call } = loadFn({ ai_reports: [], challenge_records: [] }, '')
  const r = await call({})
  eq(r.code, 401, 'E no openid → AUTH_FAILED 401')
  eq(r.data, null, 'E no data leaked')
}
// ── F NO_TRUST_CLIENT_OPENID ──
{
  const OWN = 'oREAL'
  const data = { ai_reports: [{ openid: OWN, type: 'diagnostic', content: { fatal_sentence: 'x' } }, { openid: 'oVICTIM', type: 'diagnostic', content: { fatal_sentence: 'y' } }], challenge_records: [] }
  const { call } = loadFn(data, OWN)
  const r = await call({ openid: 'oVICTIM' }) // client tries to spoof
  eq(r.data.counts.reportCount, 1, 'F client openid spoof ignored (identity from context)')
}
// ── G CHALLENGE_SEMANTICS ──
{
  const OWN = 'oG'
  const data = { ai_reports: [], challenge_records: [
    { openid: OWN, status: 'processing', trialMode: true },
    { openid: OWN, status: 'finished' },
    { openid: OWN, status: 'finished' },
  ] }
  const { call } = loadFn(data, OWN)
  const r = await call({})
  eq(r.data.counts.challengeCount, 3, 'G challengeCount includes all statuses')
  eq(r.data.counts.challengeFinishedCount, 2, 'G finishedCount = finished only')
}
// ── H REPORT_TOTAL vs COUNT ──
{
  const OWN = 'oH'
  const data = { ai_reports: [
    { openid: OWN, type: 'challenge_final', recordId: 'CR1' },
    { openid: OWN, type: 'challenge_final' },
    { openid: OWN, type: 'diagnostic_world_model_v2_shadow' },
  ], challenge_records: [] }
  const { call } = loadFn(data, OWN)
  const r = await call({})
  eq(r.data.counts.reportCount, 1, 'H viewable=1 (1 challenge_final+recordId)')
  eq(r.data.counts.reportTotalRecords, 3, 'H raw total=3 (diagnostic口径)')
}
// ── I READ_ONLY ──
{
  const { call, log } = loadFn({ ai_reports: [{ openid: 'oI', type: 'diagnostic', content: { fatal_sentence: 'x' } }], challenge_records: [] }, 'oI')
  await call({})
  eq(log.writes.length, 0, 'I no write operations attempted')
  ok(!/\b(add|update|remove|set|delete)\s*\(/.test(idxSrc.replace(/\/\/.*$/gm, '')), 'I source has no write calls')
}
// ── J RESPONSE_ENVELOPE ──
{
  const OWN = 'oJ'
  const data = { ai_reports: [{ openid: OWN, type: 'diagnostic', content: { fatal_sentence: 'x' } }], challenge_records: [] }
  const { call } = loadFn(data, OWN)
  const r = await call({})
  ok(typeof r.code === 'number' && typeof r.message === 'string', 'J envelope {code,message}')
  ok(r.data && r.data.counts && typeof r.data.counts.reportCount === 'number', 'J counts shape')
  // DB error path
  const bad = loadFn({}, OWN)
  // force a throw by making getWXContext valid but db.collection throw
  const sandboxErr = null
  // simpler: monkey patch main's db via a fresh load whose db.collection throws
  const log2 = { writes: [], errors: [] }
  let main2 = null
  const sb2 = {
    require: (id) => {
      if (id === 'wx-server-sdk') return { init: () => {}, DYNAMIC_CURRENT_ENV: 'e', database: () => ({ collection: () => { throw new Error('db down') } }), getWXContext: () => ({ OPENID: OWN }) }
      if (id.indexOf('response.js') >= 0) return require(path.join(FN_DIR, 'lib', 'response.js'))
      if (id.indexOf('reportVisibility.js') >= 0) return policy
      if (id.indexOf('challengeListability.js') >= 0) return challengePolicy
      throw new Error('unexpected require: ' + id)
    },
    module: { exports: {} }, exports: {},
    console: Object.assign({}, console, { error: () => {}, log: () => {}, warn: () => {} }),
    Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise, isFinite,
    setTimeout: () => 0, clearTimeout: () => {},
  }
  sb2.exports = sb2.module.exports
  vm.createContext(sb2)
  vm.runInContext(idxSrc, sb2, { filename: INDEX })
  main2 = sb2.module.exports.main
  const re = await main2({}, {})
  eq(re.code, 4001, 'J DB error → fail(DB_ERROR=4001)')
  eq(re.data, null, 'J DB error no data')
}
// ── K SOURCE_INVARIANTS ──
{
  ok(/cloud\.getWXContext\(\)/.test(idxSrc) && /wxContext\.OPENID/.test(idxSrc), 'K identity from cloud.getWXContext()')
  ok(!/event\.openid/.test(idxSrc), 'K never reads event.openid')
  ok(/if \(!openid\) return fail\(CODES\.AUTH_FAILED\)/.test(idxSrc), 'K explicit AUTH_FAILED guard')
  ok(/reportVisibility\.js/.test(idxSrc), 'K uses shared reportVisibility policy')
  ok(/challengeListability\.js/.test(idxSrc), 'K uses shared challengeListability policy')
  // frozen payment functions untouched
  let changed = ''
  try { changed = require('child_process').execSync('git diff --name-only b19a05d -- cloudfunctions/createVirtualOrder cloudfunctions/verifyVirtualPayment cloudfunctions/virtualPayCallback cloudfunctions/payCallback cloudfunctions/verifyPayment', { cwd: ROOT }).toString().trim() } catch (_) { changed = 'GIT_ERR' }
  ok(changed !== 'GIT_ERR', 'K git available')
  // RC8_14_D12_R6C_R5: entitlementService.js is under an APPROVED writer exception; only these exact
  // files may change. Any OTHER frozen payment function change still fails.
  {
    const APPROVED_WRITER = new Set(['cloudfunctions/common/entitlementService.js', 'cloudfunctions/payCallback/lib/entitlementService.js', 'cloudfunctions/verifyPayment/lib/entitlementService.js', 'cloudfunctions/createVirtualOrder/lib/entitlementService.js', 'cloudfunctions/verifyVirtualPayment/lib/entitlementService.js', 'cloudfunctions/virtualPayCallback/lib/entitlementService.js'])
    const unexpected = (changed === 'GIT_ERR' ? '' : changed).split('\n').map((s) => s.trim()).filter(Boolean).filter((f) => !APPROVED_WRITER.has(f))
    eq(unexpected.join('\n'), '', 'K no NON-APPROVED frozen payment function changed')
  }
}

console.log(`  _TEST pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
