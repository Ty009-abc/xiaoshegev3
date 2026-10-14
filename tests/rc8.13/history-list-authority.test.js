#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.13/history-list-authority.test.js — RC8_13_P0_HISTORY_LIST_SERVER_AUTHORITY_FIX
 *
 * Server-authoritative history list functions (getReportHistory, getChallengeRecords)
 * + shared policy parity + profile/list totals equality + client rewiring.
 *
 *  A  SHARED_ARTIFACT_IDENTITY: reportVisibility / challengeListability byte-identical across consumers
 *  B  REPORT_POLICY: excludes shadow/empty/non-canonical; retains legacy6q + challenge_final(recordId)
 *  C  CHALLENGE_POLICY: includes processing + finished; closed-set status; day capped, no day for finished
 *  D  GET_REPORT_HISTORY: owner-scoped items/total; detail identity resolvable; no raw private payload for challenge_final
 *  E  GET_CHALLENGE_RECORDS: owner-scoped items/total/finishedTotal; status normalized; action mapping
 *  F  IDENTITY: spoofed event.openid ignored; no openid → AUTH_FAILED
 *  G  CROSS_USER_ISOLATION: only the authenticated openid's rows
 *  H  READ_ONLY: no add/update/set/remove/delete in either function
 *  I  PAGINATION: total = all eligible; items = page; countComplete only when full; stable order; no dup across pages
 *  J  PROFILE_PARITY: getProfileStats.total == getReportHistory.total / getChallengeRecords.total
 *  K  CLIENT_WIRING: pages consume server APIs; no direct collection read; explicit error/empty/unauth states
 *
 * Logic + source-asset only. No network / DB / device claim.
 */
const path = require('path')
const fs = require('fs')
const vm = require('vm')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..', '..')
const CF = path.join(ROOT, 'cloudfunctions')
const PROF_DIR = path.join(CF, 'getProfileStats')
const RH_DIR = path.join(CF, 'getReportHistory')
const CH_DIR = path.join(CF, 'getChallengeRecords')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')

console.log('RC8_13_HISTORY_LIST_AUTHORITY')

// ── A SHARED_ARTIFACT_IDENTITY ──
{
  ok(sha(path.join(PROF_DIR, 'lib', 'reportVisibility.js')) === sha(path.join(RH_DIR, 'lib', 'reportVisibility.js')), 'A reportVisibility byte-identical (profile↔reportHistory)')
  ok(sha(path.join(PROF_DIR, 'lib', 'challengeListability.js')) === sha(path.join(CH_DIR, 'lib', 'challengeListability.js')), 'A challengeListability byte-identical (profile↔challengeRecords)')
  ok(!fs.existsSync(path.join(PROF_DIR, 'lib', 'countPolicy.js')), 'A stale countPolicy.js removed (no drifted copy)')
}

const reportPolicy = require(path.join(RH_DIR, 'lib', 'reportVisibility.js'))
const challengePolicy = require(path.join(CH_DIR, 'lib', 'challengeListability.js'))

// ── B REPORT_POLICY ──
{
  ok(reportPolicy.kindOf({ type: 'challenge_final', recordId: 'CR1' }) === 'challenge_final', 'B challenge_final+recordId viewable')
  ok(reportPolicy.kindOf({ type: 'challenge_final' }) === '', 'B challenge_final w/o recordId NOT viewable')
  ok(reportPolicy.kindOf({ type: 'diagnostic', content: { fatal_sentence: 'x' } }) === 'legacy6q', 'B legacy6q via fatal_sentence')
  ok(reportPolicy.kindOf({ type: 'diagnostic', content: { system_trap: 'y' } }) === 'legacy6q', 'B legacy6q via system_trap')
  ok(reportPolicy.kindOf({ type: 'diagnostic_world_model_v2_shadow' }) === '', 'B shadow NOT viewable')
  ok(reportPolicy.kindOf({ type: 'diagnostic_world_model_v2_1_shadow' }) === '', 'B v2_1 shadow NOT viewable')
  ok(reportPolicy.kindOf({ type: 'diagnostic_world_model_v1', content: { report: {} } }) === '', 'B v1 non-canonical NOT viewable')
  ok(reportPolicy.kindOf(null) === '', 'B null NOT viewable')
  const mix = [
    { type: 'diagnostic_world_model_v2_shadow' },
    { type: 'diagnostic_world_model_v1', content: { report: {} } },
    { type: 'challenge_final', recordId: 'CR1' },
    { type: 'diagnostic', content: { fatal_sentence: 's', system_trap: 't' } },
    { type: 'diagnostic', content: { fatal_sentence: 'q' } },
  ]
  eq(reportPolicy.countViewableReports(mix), 3, 'B mixed set → 3 viewable')
}

// ── C CHALLENGE_POLICY ──
{
  ok(challengePolicy.isListableChallenge({ status: 'processing' }), 'C processing listable')
  ok(challengePolicy.isListableChallenge({ status: 'finished' }), 'C finished listable')
  eq(challengePolicy.statusLabel('processing'), '进行中', 'C label 进行中')
  eq(challengePolicy.statusLabel('finished'), '已完成', 'C label 已完成')
  eq(challengePolicy.statusLabel('mystery'), '未知', 'C label 未知')
  eq(challengePolicy.displayDay(2, 'processing'), 2, 'C processing day 2')
  eq(challengePolicy.displayDay(31, 'processing'), 30, 'C day capped at 30')
  eq(challengePolicy.displayDay(31, 'finished'), 0, 'C finished shows no day')
}

// ── handler harness (mock wx-server-sdk with a filterable fake DB) ──
function makeDb (data) {
  function builder (name) {
    const st = { w: {}, field: null, skip: 0, limit: -1, order: [] }
    const api = {
      where (w) { st.w = w || {}; return api },
      field (f) { st.field = f; return api },
      orderBy (k, d) { st.order.push([k, d]); return api },
      skip (n) { st.skip = n; return api },
      limit (n) { st.limit = n; return api },
      _rows () {
        let rows = (data[name] || []).filter((r) => Object.keys(st.w).every((k) => r[k] === st.w[k]))
        for (let i = st.order.length - 1; i >= 0; i--) {
          const [k, d] = st.order[i]
          rows = rows.slice().sort((a, b) => {
            const av = a[k], bv = b[k]
            if (av === bv) return 0
            const c = av > bv ? 1 : -1
            return d === 'desc' ? -c : c
          })
        }
        return rows
      },
      async count () { return { total: this._rows().length } },
      async get () {
        let rows = this._rows()
        if (st.skip) rows = rows.slice(st.skip)
        if (st.limit >= 0) rows = rows.slice(0, st.limit)
        return { data: rows }
      },
    }
    api.add = () => { throw new Error('WRITE_FORBIDDEN') }
    api.doc = () => ({ update: () => { throw new Error('WRITE_FORBIDDEN') } })
    return api
  }
  return { collection: (name) => builder(name), _raw: data }
}

function loadFn (dir, data, openid, event) {
  const src = fs.readFileSync(path.join(dir, 'index.js'), 'utf8')
  const db = makeDb(data)
  let main = null
  const sandbox = {
    require: (id) => {
      if (id === 'wx-server-sdk') return { init: () => {}, DYNAMIC_CURRENT_ENV: 'env', database: () => db, getWXContext: () => ({ OPENID: openid }) }
      if (id.indexOf('response.js') >= 0) return require(path.join(dir, 'lib', 'response.js'))
      if (id.indexOf('reportVisibility.js') >= 0) return reportPolicy
      if (id.indexOf('challengeListability.js') >= 0) return challengePolicy
      throw new Error('unexpected require: ' + id)
    },
    module: { exports: {} }, exports: {},
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise, isFinite,
    Buffer, setTimeout: () => 0, clearTimeout: () => {},
  }
  sandbox.exports = sandbox.module.exports
  vm.createContext(sandbox)
  vm.runInContext(src, sandbox, { filename: path.join(dir, 'index.js') })
  main = sandbox.module.exports.main || sandbox.exports.main
  return { call: (ev) => main(ev || {}, {}), src }
}

const OWN = 'oZa463Te7dLGGA5yQlRearlD8B3I'

;(async () => {
// ── D GET_REPORT_HISTORY ──
{
  const data = { ai_reports: [
    { _id: 'a1', openid: OWN, type: 'challenge_final', recordId: 'CR1', createdAt: 5 },
    { _id: 'a2', openid: OWN, type: 'diagnostic_world_model_v2_shadow', createdAt: 4 },
    { _id: 'a3', openid: OWN, type: 'diagnostic_world_model_v1', content: { report: {} }, createdAt: 3 },
    { _id: 'a4', openid: OWN, type: 'diagnostic', reportType: 'turnaround_6q', reportId: 'rpt_6q_9_x', createdAt: 2, content: { fatal_sentence: 'F', system_trap: 'T', core_problem: 'C', strategy_path: 'P', advice: ['a'] } },
    { _id: 'a5', openid: 'oOTHER', type: 'diagnostic', createdAt: 1, content: { fatal_sentence: 'Z' } },
  ] }
  const { call } = loadFn(RH_DIR, data, OWN)
  const r = await call({})
  eq(r.code, 0, 'D code 0')
  eq(r.data.total, 2, 'D total = 2 viewable (shadow + v1 excluded)')
  eq(r.data.items.length, 2, 'D items = 2')
  eq(r.data.countComplete, true, 'D countComplete true')
  const cf = r.data.items.find((i) => i.kind === 'challenge_final')
  const lq = r.data.items.find((i) => i.kind === 'legacy6q')
  ok(cf && cf.recordId === 'CR1', 'D challenge_final item has resolvable recordId')
  ok(cf && cf.content === undefined, 'D challenge_final item carries NO raw content payload')
  ok(lq && lq.payload && lq.payload.fatal_sentence === 'F', 'D legacy6q item carries normalized renderable payload')
  ok(!r.data.items.some((i) => !i.kind), 'D no item without a canonical kind')
}
// ── D2 newest-first stable order ──
{
  const data = { ai_reports: [
    { _id: 'x', openid: OWN, type: 'diagnostic', createdAt: 1, content: { fatal_sentence: 'a' } },
    { _id: 'y', openid: OWN, type: 'diagnostic', createdAt: 9, content: { fatal_sentence: 'b' } },
    { _id: 'z', openid: OWN, type: 'diagnostic', createdAt: 5, content: { fatal_sentence: 'c' } },
  ] }
  const { call } = loadFn(RH_DIR, data, OWN)
  const r = await call({})
  eq(r.data.items[0].id, 'y', 'D2 newest first (createdAt 9)')
  eq(r.data.items[2].id, 'x', 'D2 oldest last')
}

// ── E GET_CHALLENGE_RECORDS ──
{
  const data = { challenge_records: [
    { _id: 'c1', openid: OWN, recordId: 'CR1790854696330ldayod', status: 'processing', currentDay: 4, finalType: '', startedAt: 10, createdAt: 10 },
    { _id: 'c2', openid: OWN, recordId: 'CR1791918909287r1a8hf', status: 'finished', currentDay: 31, finalType: 'system_thinker', startedAt: 20, finishedAt: 21, createdAt: 20 },
    { _id: 'c3', openid: 'oOTHER', recordId: 'CRX', status: 'finished', currentDay: 30, createdAt: 30 },
  ] }
  const { call } = loadFn(CH_DIR, data, OWN)
  const r = await call({})
  eq(r.code, 0, 'E code 0')
  eq(r.data.total, 2, 'E total = 2 owner challenges')
  eq(r.data.finishedTotal, 1, 'E finishedTotal = 1')
  eq(r.data.items.length, 2, 'E items = 2')
  const proc = r.data.items.find((i) => i.recordId === 'CR1790854696330ldayod')
  const fin = r.data.items.find((i) => i.recordId === 'CR1791918909287r1a8hf')
  eq(proc.status, 'processing', 'E processing normalized')
  eq(proc.statusText, '进行中', 'E processing label')
  eq(proc.action, 'resume', 'E processing action resume')
  eq(proc.day, 4, 'E processing day 4')
  eq(fin.status, 'finished', 'E finished normalized')
  eq(fin.action, 'detail', 'E finished action detail')
  eq(fin.day, 0, 'E finished shows no day (31 artifact hidden)')
  eq(fin.finalType, 'system_thinker', 'E finished finalType surfaced')
}

// ── F IDENTITY ──
{
  const { call } = loadFn(RH_DIR, { ai_reports: [] }, OWN)
  const r = await call({ openid: 'oVICTIM' })
  eq(r.code, 0, 'F spoof ignored (still resolves)')
  const rNoAuth = await loadFn(RH_DIR, { ai_reports: [] }, '').call({})
  eq(rNoAuth.code, 401, 'F no openid → AUTH_FAILED 401')
  eq(rNoAuth.data, null, 'F no data leaked')
  const rNoAuthCh = await loadFn(CH_DIR, { challenge_records: [] }, '').call({})
  eq(rNoAuthCh.code, 401, 'F challenge no openid → 401')
}

// ── G CROSS_USER_ISOLATION ──
{
  const data = { ai_reports: [
    { _id: 'p', openid: OWN, type: 'diagnostic', createdAt: 1, content: { fatal_sentence: 'mine' } },
    { _id: 'q', openid: 'oOTHER', type: 'diagnostic', createdAt: 2, content: { fatal_sentence: 'theirs' } },
  ] }
  const { call } = loadFn(RH_DIR, data, OWN)
  const r = await call({})
  eq(r.data.total, 1, 'G only owner report counted')
  ok(r.data.items.every((i) => i.id !== 'q'), 'G other user row not exposed')
}

// ── H READ_ONLY ──
{
  const rhSrc = fs.readFileSync(path.join(RH_DIR, 'index.js'), 'utf8').replace(/\/\/.*$/gm, '')
  const chSrc = fs.readFileSync(path.join(CH_DIR, 'index.js'), 'utf8').replace(/\/\/.*$/gm, '')
  ok(!/\b(add|update|set|remove|delete)\s*\(/.test(rhSrc), 'H getReportHistory has no write calls')
  ok(!/\b(add|update|set|remove|delete)\s*\(/.test(chSrc), 'H getChallengeRecords has no write calls')
}

// ── I PAGINATION ──
{
  const rows = []
  for (let i = 0; i < 25; i++) rows.push({ _id: 'r' + i, openid: OWN, type: 'diagnostic', createdAt: i, content: { fatal_sentence: 's' + i } })
  const data = { ai_reports: rows }
  const { call } = loadFn(RH_DIR, data, OWN)
  const p1 = await call({ pageSize: 10 })
  eq(p1.data.total, 25, 'I total = 25 (all eligible)')
  eq(p1.data.items.length, 10, 'I page1 items = 10')
  eq(p1.data.countComplete, false, 'I countComplete false while more pages remain')
  ok(!!p1.data.nextCursor, 'I nextCursor present')
  const p2 = await call({ pageSize: 10, pageToken: p1.data.nextCursor })
  ok(p2.data.items.length === 10, 'I page2 items = 10')
  const p3 = await call({ pageSize: 10, pageToken: p2.data.nextCursor })
  eq(p3.data.items.length, 5, 'I page3 items = 5')
  eq(p3.data.nextCursor, null, 'I last page no cursor')
  const ids = new Set([
    ...p1.data.items.map((i) => i.id),
    ...p2.data.items.map((i) => i.id),
    ...p3.data.items.map((i) => i.id),
  ])
  eq(ids.size, 25, 'I no duplicate items across pages')
}

// ── J PROFILE_PARITY ──
{
  const aiReports = [
    { _id: 'a1', openid: OWN, type: 'challenge_final', recordId: 'CR1', createdAt: 5 },
    { _id: 'a2', openid: OWN, type: 'diagnostic_world_model_v2_shadow', createdAt: 4 },
    { _id: 'a3', openid: OWN, type: 'diagnostic', reportId: 'rp1', createdAt: 3, content: { fatal_sentence: 'F' } },
    { _id: 'a4', openid: OWN, type: 'diagnostic', reportId: 'rp2', createdAt: 2, content: { system_trap: 'T' } },
  ]
  const challenge_records = [
    { _id: 'c1', openid: OWN, recordId: 'CRa', status: 'processing', currentDay: 4, createdAt: 2 },
    { _id: 'c2', openid: OWN, recordId: 'CRb', status: 'finished', currentDay: 31, createdAt: 3 },
  ]
  const data = { ai_reports: aiReports, challenge_records: challenge_records }
  const prof = await loadFn(PROF_DIR, data, OWN).call({})
  const rh = await loadFn(RH_DIR, data, OWN).call({})
  const ch = await loadFn(CH_DIR, data, OWN).call({})
  eq(prof.data.counts.reportCount, rh.data.total, 'J profile.reportCount == getReportHistory.total')
  eq(prof.data.counts.challengeCount, ch.data.total, 'J profile.challengeCount == getChallengeRecords.total')
  eq(prof.data.counts.challengeFinishedCount, ch.data.finishedTotal, 'J profile.challengeFinishedCount == list.finishedTotal')
  eq(prof.data.counts.reportTotalRecords, 4, 'J reportTotalRecords stays raw diagnostic count')
}

// ── K CLIENT_WIRING ──
{
  const chPage = fs.readFileSync(path.join(ROOT, 'pages/challenge-records/challenge-records.js'), 'utf8')
  const rhPage = fs.readFileSync(path.join(ROOT, 'pages/report-history/report-history.js'), 'utf8')
  ok(!/wx\.cloud\.database\(\)/.test(chPage), 'K challenge-records no direct DB read')
  ok(!/wx\.cloud\.database\(\)/.test(rhPage), 'K report-history no direct DB read')
  ok(/getChallengeRecords/.test(chPage), 'K challenge-records consumes server API')
  ok(/getReportHistory/.test(rhPage), 'K report-history consumes server API')
  ok(/_useLocal\s*\(\s*\)/.test(rhPage) === false || !/catch[\s\S]{0,200}_useLocal/.test(rhPage), 'K report-history does NOT fall back local on error')
  ok(/status: 'error'/.test(chPage) && /onRetry/.test(chPage), 'K challenge-records error+retry state')
  ok(/status: 'error'/.test(rhPage) && /onRetry/.test(rhPage), 'K report-history error+retry state')
  const chWxmlU = fs.readFileSync(path.join(ROOT, 'pages/challenge-records/challenge-records.wxml'), 'utf8')
  const rhWxmlU = fs.readFileSync(path.join(ROOT, 'pages/report-history/report-history.wxml'), 'utf8')
  ok(/身份验证失败/.test(chWxmlU) && /身份验证失败/.test(rhWxmlU), 'K unauthorized state present')
  const chWxml = fs.readFileSync(path.join(ROOT, 'pages/challenge-records/challenge-records.wxml'), 'utf8')
  const rhWxml = fs.readFileSync(path.join(ROOT, 'pages/report-history/report-history.wxml'), 'utf8')
  ok(/status === 'empty'/.test(chWxml), 'K challenge empty state gated on server-confirmed zero')
  ok(/status === 'empty'/.test(rhWxml), 'K report empty state gated on server-confirmed zero')
  ok(/challenge-service|challengeService/.test(fs.readFileSync(path.join(ROOT, 'services/challengeService.js'), 'utf8')), 'K challengeService present')
  ok(/getChallengeRecords|getReportHistory/.test(chPage + rhPage), 'K both pages wired')
}

console.log(`\nRC8_13_HISTORY_LIST_AUTHORITY pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
