#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/report-history-authority.test.js
 *
 * RC8_9_P0_PROFILE_DATA_CHAIN + RC8_13_P0_HISTORY_LIST_SERVER_AUTHORITY_FIX —
 * 「我的报告」is SERVER-AUTHORITATIVE via the getReportHistory cloud function.
 *
 * Local legacy history is shown ONLY when the server confirms zero, and is then
 * labelled as local-only. It is NEVER used on server error or unauthorized.
 *
 *  D  server empty total → confirmed-empty (local-only shown only if present, labelled)
 *  K  challenge_final report present     → route to report-preview (recordId)
 *  L  legacy6q report (server payload)   → route via legacy6q handoff
 *  E  server read failure                → ERROR state, NO local fallback, retry enabled
 *  F  unauthorized (401)                 → UNAUTHORIZED state, no local fallback
 *  S  source invariants
 *
 * Logic + source-asset only. No network / DB / device claim.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const PAGE = path.join(ROOT, 'pages', 'report-history', 'report-history.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_9_P0_REPORT_HISTORY_AUTHORITY')

function load (opt) {
  const o = opt || {}
  const errors = []
  let page = null
  const nav = []
  const gd = { openid: 'oZa463Yb2VY0k9Es_pGzdHFtigNo' }
  const sandbox = {
    require: (id) => {
      if (id.indexOf('aiReportService') >= 0) {
        return {
          getReportHistory: () => {
            if (o.reject) return Promise.reject(new Error('simulated network failure'))
            return Promise.resolve(o.resp || { code: 0, data: { items: [], total: 0 } })
          },
        }
      }
      if (id.indexOf('reportHistory') >= 0) {
        return {
          list: () => (o.localList || []),
          get: (id) => (o.localList || []).find((r) => r.id === id) || null,
          count: () => (o.localList || []).length,
        }
      }
      throw new Error('unexpected require: ' + id)
    },
    Page: (c) => { page = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
    setTimeout: () => 0, clearTimeout: () => {},
    getApp: () => ({ globalData: gd }),
    wx: {
      navigateTo: (x) => { nav.push({ m: 'navigateTo', url: x.url }); x.success && x.success({}); x.complete && x.complete() },
      showToast: () => {}, navigateBack: () => {},
    },
  }
  const warns = []
  sandbox.console = Object.assign({}, console, { error: (...a) => errors.push(a.join(' ')), warn: (...a) => warns.push(a.join(' ')) })
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(PAGE, 'utf8'), sandbox, { filename: PAGE })
  const p = Object.assign({}, page)
  p.data = JSON.parse(JSON.stringify(page.data || {}))
  p.setData = function (x) { Object.assign(this.data, x) }
  p._nav = nav
  p._errors = errors
  p._warns = warns
  p._gd = gd
  return p
}

const CF_ITEM = { id: 'ARCF9bc1766a2b0fbbcdfc0cdc3f', kind: 'challenge_final', recordId: 'CR1790632776226vtmih6', dateText: '2026/01/01 10:00', title: '世界模型报告', preview: '一句话结论' }
const LQ_ITEM = { id: 'rpt_6q_1', kind: 'legacy6q', recordId: '', dateText: '2026/01/02 10:00', title: '认知诊断报告', preview: '致命一句话', payload: { fatal_sentence: '致命一句话', system_trap: '困局', core_problem: '核心', strategy_path: '路径', advice: ['a'] } }

;(async () => {
  // ── D + K: server reports present (challenge_final) ──
  {
    const p = load({ resp: { code: 0, data: { items: [CF_ITEM], total: 1, nextCursor: null, countComplete: true } }, localList: [] })
    await p.load()
    eq(p.data.status, 'success', 'D: server success state')
    eq(p.data.reports.length, 1, 'D: server report visible')
    eq(p.data.reports[0].id, CF_ITEM.id, 'K: challenge_final item in list')
    eq(p.data.reports[0].kind, 'challenge_final', 'K: kind challenge_final')
    eq(p.data.reports[0].recordId, 'CR1790632776226vtmih6', 'K: recordId carried')
    ok(p.data.loadError === false, 'D: no loadError on success')
    ok(p.data.localOnly === false, 'D: not local-only on server success')
    p.onTapReport({ currentTarget: { dataset: { id: CF_ITEM.id } } })
    const navUrl = (p._nav.find((n) => n.m === 'navigateTo') || {}).url || ''
    ok(navUrl.indexOf('/pages/report-preview/report-preview') === 0, 'K: tap → report-preview')
    ok(navUrl.indexOf('type=challenge_final') >= 0, 'K: type=challenge_final')
    ok(navUrl.indexOf('recordId=CR1790632776226vtmih6') >= 0, 'K: recordId passed')
  }
  // ── L: legacy6q uses server-provided payload → legacy6q handoff ──
  {
    const p = load({ resp: { code: 0, data: { items: [LQ_ITEM], total: 1 } }, localList: [] })
    await p.load()
    eq(p.data.reports.length, 1, 'L: legacy6q item listed')
    eq(p.data.reports[0].kind, 'legacy6q', 'L: kind legacy6q')
    p.onTapReport({ currentTarget: { dataset: { id: LQ_ITEM.id } } })
    const navUrl = (p._nav.find((n) => n.m === 'navigateTo') || {}).url || ''
    ok(navUrl.indexOf('/pages/legacy6q-report/legacy6q-report') === 0, 'L: tap → legacy6q-report')
    ok(p._gd._legacy6qReport && p._gd._legacy6qReport.fatal_sentence === '致命一句话', 'L: server payload handed via globalData')
  }
  // ── D2: server confirmed zero + local present → local-only, labelled ──
  {
    const p = load({ resp: { code: 0, data: { items: [], total: 0 } }, localList: [{ id: 'loc1', createdAt: Date.now(), persona: '行动派', report: { fatal_sentence: 'f' } }] })
    await p.load()
    eq(p.data.status, 'empty', 'D2: server-confirmed-empty state')
    eq(p.data.reports.length, 1, 'D2: local record shown')
    ok(p.data.localOnly === true, 'D2: flagged local-only (not merged into server total)')
    eq(p.data.reports[0].local, true, 'D2: item labelled local')
  }
  // ── D3: server confirmed zero + no local → real EMPTY ──
  {
    const p = load({ resp: { code: 0, data: { items: [], total: 0 } }, localList: [] })
    await p.load()
    eq(p.data.status, 'empty', 'D3: empty state')
    ok(p.data.empty === true, 'D3: empty flag (server-confirmed zero)')
    eq(p.data.reports.length, 0, 'D3: no reports')
  }
  // ── E: server failure → ERROR, NO local fallback ──
  {
    const p = load({ reject: true, localList: [{ id: 'loc1', createdAt: Date.now(), report: { fatal_sentence: 'f' } }] })
    await p.load()
    eq(p.data.status, 'error', 'E: error state on server failure')
    ok(p.data.loadError === true, 'E: loadError true')
    eq(p.data.reports.length, 0, 'E: NO silent local fallback')
    ok(p._warns.some((e) => /server load fail/.test(e)), 'E: failure surfaced')
    ok(typeof p.onRetry === 'function', 'E: retry handler present')
  }
  // ── F: unauthorized (401) → UNAUTHORIZED, no local fallback ──
  {
    const p = load({ resp: { code: 401, message: 'auth', data: null }, localList: [{ id: 'loc1', report: { fatal_sentence: 'f' } }] })
    await p.load()
    eq(p.data.status, 'unauthorized', 'F: unauthorized state')
    ok(p.data.unauthorized === true, 'F: unauthorized flag')
    eq(p.data.reports.length, 0, 'F: no local fallback on unauthorized')
  }

  // ── S: source invariants ──
  {
    const src = fs.readFileSync(PAGE, 'utf8')
    ok(/getReportHistory/.test(src), 'S1: consumes server-authoritative list API')
    ok(!/wx\.cloud\.database\(\)/.test(src), 'S2: no client direct-DB read')
    ok(/USE_ON_SERVER_ERROR_NOT|status: 'error'|loadError: true/.test(src), 'S3: explicit error state')
    ok(src.indexOf('/pages/report-preview/report-preview') >= 0, 'S4: challenge_final route present')
    ok(src.indexOf('/pages/legacy6q-report/legacy6q-report') >= 0, 'S5: legacy6q route present')
    ok(!/catch[\s\S]{0,240}_useLocal/.test(src), 'S6: local fallback NOT wired into server-error catch')
  }

  console.log(`  _TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
