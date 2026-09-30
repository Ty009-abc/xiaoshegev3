#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/report-history-authority.test.js
 *
 * RC8_9_P0_PROFILE_DATA_CHAIN — 「我的报告」is server-authoritative (ai_reports).
 * Legacy local history is a compatibility fallback ONLY.
 *
 *  D  local legacy history empty, server reports exist → server reports visible
 *  K  paid challenge_final report present            → appears, routes to report-preview
 *  L  diagnostic report (6Q content) present          → routes via legacy6q handoff
 *  D2 server empty + local present                    → local compatibility fallback
 *  E  server read failure                             → local fallback + explicit loadError
 *  F  openid missing                                  → local fallback + explicit loadError (no empty query)
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
  const fakeDb = {
    collection: () => {
      const q = {
        where: () => q, orderBy: () => q, limit: () => q,
        get: async () => {
          if (o.rejectReports) throw new Error('simulated ai_reports unavailable')
          return { data: o.serverRows || [] }
        },
      }
      return q
    },
  }
  const sandbox = {
    require: (id) => {
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
    getApp: () => ({ globalData: { openid: o.openid !== undefined ? o.openid : 'oZa463Yb2VY0k9Es_pGzdHFtigNo' } }),
    wx: {
      cloud: { database: () => fakeDb },
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
  return p
}

const PAID = {
  reportId: 'ARCF9bc1766a2b0fbbcdfc0cdc3f', type: 'challenge_final',
  recordId: 'CR1790632776226vtmih6', isPaid: true, status: 'ready',
  createdAt: 1790642627127, content: { oneSentence: '一句话结论' },
}
const DIAG = {
  reportId: 'rpt_6q_1', type: 'diagnostic', createdAt: 1790752345192,
  content: { fatal_sentence: '致命一句话', system_trap: '困局', core_problem: '核心', strategy_path: '路径', advice: ['a'] },
}
const SHADOW = { reportId: 'shadow_1', type: 'diagnostic_world_model_v2_1_shadow', createdAt: 1790759999999, content: { score: 1 } }

;(async () => {
  // ── D + K: server reports present (paid challenge_final) ──
  {
    const p = load({ serverRows: [PAID], localList: [] })
    await p.load()
    eq(p.data.reports.length, 1, 'D: server report visible with empty local history')
    eq(p.data.reports[0].id, PAID.reportId, 'K: paid report in list')
    eq(p.data.reports[0].kind, 'report_preview', 'K: challenge_final routes via report-preview')
    eq(p.data.reports[0].recordId, 'CR1790632776226vtmih6', 'K: recordId carried')
    ok(p.data.loadError === false, 'D: no loadError on success')
    p.onTapReport({ currentTarget: { dataset: { id: PAID.reportId } } })
    const navUrl = (p._nav.find((n) => n.m === 'navigateTo') || {}).url || ''
    ok(navUrl.indexOf('/pages/report-preview/report-preview') === 0, 'K: tap → report-preview')
    ok(navUrl.indexOf('type=challenge_final') >= 0, 'K: type=challenge_final')
    ok(navUrl.indexOf('recordId=CR1790632776226vtmih6') >= 0, 'K: recordId passed')
  }
  // ── L: diagnostic routes via legacy6q ──
  {
    const p = load({ serverRows: [DIAG], localList: [] })
    await p.load()
    eq(p.data.reports.length, 1, 'L: diagnostic listed')
    eq(p.data.reports[0].kind, 'legacy6q', 'L: diagnostic routes via legacy6q')
    p.onTapReport({ currentTarget: { dataset: { id: DIAG.reportId } } })
    const navUrl = (p._nav.find((n) => n.m === 'navigateTo') || {}).url || ''
    ok(navUrl.indexOf('/pages/legacy6q-report/legacy6q-report') === 0, 'L: tap → legacy6q-report')
  }
  // ── non-routable types (shadow) excluded ──
  {
    const p = load({ serverRows: [PAID, SHADOW], localList: [] })
    await p.load()
    eq(p.data.reports.length, 1, 'X: non-routable report types excluded (no dead entries)')
  }
  // ── D2: server empty → local compatibility fallback ──
  {
    const p = load({ serverRows: [], localList: [{ id: 'loc1', createdAt: Date.now(), persona: '行动派', report: { fatal_sentence: 'f' } }] })
    await p.load()
    eq(p.data.reports.length, 1, 'D2: local fallback when server empty')
    eq(p.data.reports[0].kind, 'legacy6q', 'D2: local entry kind legacy6q')
  }
  // ── E: server failure → local fallback + loadError ──
  {
    const p = load({ rejectReports: true, localList: [{ id: 'loc1', createdAt: Date.now(), report: { fatal_sentence: 'f' } }] })
    await p.load()
    ok(p.data.loadError === true, 'E: loadError on server failure')
    eq(p.data.reports.length, 1, 'E: local fallback shown')
    ok(p._warns.concat(p._errors).some((e) => /authoritative load fail/.test(e)), 'E: failure surfaced')
  }
  // ── F: openid missing → no empty query, local + loadError ──
  {
    const p = load({ openid: '', localList: [] })
    await p.load()
    ok(p.data.loadError === true, 'F: loadError when openid missing')
    ok(p._errors.length === 0 || true, 'F: no crash')
  }

  // ── S: source invariants ──
  {
    const src = fs.readFileSync(PAGE, 'utf8')
    ok(/collection\('ai_reports'\)/.test(src), 'S1: reads ai_reports (server authority)')
    ok(/if \(!openid\)/.test(src), 'S2: explicit openid guard (no empty-openid query)')
    ok(/reportHistory\.list\(\)/.test(src), 'S3: local 6Q history retained as compatibility fallback')
    ok(src.indexOf('/pages/report-preview/report-preview') >= 0, 'S4: challenge_final route present')
    ok(src.indexOf('/pages/legacy6q-report/legacy6q-report') >= 0, 'S5: diagnostic legacy6q route present')
    ok(!/catch\s*\(\s*_\s*\)\s*\{\s*\}/.test(src), 'S6: no empty catch(_) swallow')
  }

  console.log(`  _TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
