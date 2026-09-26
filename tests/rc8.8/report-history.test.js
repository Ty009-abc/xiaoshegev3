#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.8/report-history.test.js
 *
 * I. Legacy 6Q report history — persistence / dedup / no-error-write / bound /
 *    list page / detail handoff (no second AI call) / profile count source.
 *
 * Node built-ins only. Runnable from repo root.
 */

const path = require('path')
const fs = require('fs')
const ROOT = path.resolve(__dirname, '..', '..')
const KEY = 'legacy6q_report_history' // canonical report-history storage key (ASCII)

let store = {}
function makeWx() {
  return {
    getStorageSync: (k) => (k in store ? store[k] : ''),
    setStorageSync: (k, v) => { store[k] = v },
    removeStorageSync: (k) => { delete store[k] },
    navigateTo(o) { this._nav = this._nav || []; this._nav.push(o.url) },
    switchTab(o) { this._nav = this._nav || []; this._nav.push(o.url) },
    showToast() {}, navigateBack() {},
    cloud: { callFunction: () => Promise.resolve({ result: { code: 0, data: {} } }) },
  }
}
function loadMod(rel) {
  global.wx = makeWx()
  global.getApp = () => ({ globalData: {} })
  const abs = path.join(ROOT, rel)
  delete require.cache[require.resolve(abs)]
  return require(abs)
}
function loadPage(rel, gd) {
  global.wx = makeWx()
  global.getApp = () => ({ globalData: gd || {} })
  let cap = null
  global.Page = (c) => { cap = c }
  const abs = path.join(ROOT, rel)
  delete require.cache[require.resolve(abs)]
  require(abs)
  return cap
}
const mk = (cfg) => Object.assign({ data: JSON.parse(JSON.stringify(cfg.data)), setData(o) { Object.assign(this.data, o) } }, cfg)

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const REPORT = { fatal_sentence: 'F01', core_problem: 'C02', system_trap: 'T03', strategy_path: 'P04', turnaround_path: 'P04', advice: ['a1', 'a2'] }
const HANDOFF = { requestId: 'r6q_X1', answers: { age: 30, job: '厨师', income: 8000 }, personality: { name: '清醒者', emoji: '🧠' } }

;(async () => {
  // D1: record() persists one item, no secrets
  store = {}
  const RH = loadMod('utils/reportHistory.js')
  RH.record(REPORT, HANDOFF)
  ok(Array.isArray(store[KEY]) && store[KEY].length === 1, `persist 1 (${JSON.stringify(store[KEY])})`)
  ok(store[KEY][0].id === 'r6q_X1', 'id = requestId')
  ok(store[KEY][0].persona === '清醒者', 'persona stored')
  ok(store[KEY][0].report.fatal_sentence === 'F01' && store[KEY][0].report.turnaround_path === 'P04', '5-field report stored')
  ok(!/prompt|openid|model|systemPrompt/i.test(JSON.stringify(store[KEY][0])), 'no secrets/prompt/model stored')

  // D2: dedup by id (one submission → one record)
  RH.record(REPORT, HANDOFF)
  ok(store[KEY].length === 1, `dedup same id (${store[KEY].length})`)

  // D2b: fallback/error/empty NOT stored
  RH.record({ fatal_sentence: '' }, HANDOFF)
  RH.record(null, HANDOFF)
  ok(store[KEY].length === 1, 'empty/error not stored')

  // D1b: bounded to MAX
  for (let i = 0; i < 30; i++) RH.record(REPORT, { requestId: 'r6q_' + i, answers: {}, personality: {} })
  ok(store[KEY].length <= 20, `bounded <=20 (${store[KEY].length})`)

  // D4: count = history length
  ok(RH.count() === store[KEY].length, `count matches (${RH.count()})`)

  // D3b: list page renders + detail handoff (no AI call)
  const gd = {}
  const cfg = loadPage('pages/report-history/report-history.js', gd)
  const p = mk(cfg); p.onShow()
  ok(p.data.reports.length === store[KEY].length, `list renders ${p.data.reports.length}`)
  ok(p.data.reports[0].preview === 'C02' || p.data.reports[0].preview === 'F01', `Card01 preview (${p.data.reports[0].preview})`)
  p.onTapReport({ currentTarget: { dataset: { id: p.data.reports[0].id } } })
  ok(gd._legacy6qReport && gd._legacy6qReport.fatal_sentence, 'detail hands stored report via globalData')
  ok(global.wx._nav[0] === '/pages/legacy6q-report/legacy6q-report?mode=history', `detail route (${global.wx._nav[0]})`)

  // D3c: result page consumes globalData._legacy6qReport, no model call
  const repSrc = fs.readFileSync(path.join(ROOT, 'pages/legacy6q-report/legacy6q-report.js'), 'utf8')
  ok(/app\.globalData\._legacy6qReport/.test(repSrc), 'result page reads globalData report')
  ok(!/generateLegacy6QReport|generateAiReport|callFunction/.test(repSrc), 'result page makes NO AI/cloud call')

  // D2c: persistence happens in thinking _transition (success path)
  const thinkSrc = fs.readFileSync(path.join(ROOT, 'pages/legacy6q-thinking/legacy6q-thinking.js'), 'utf8')
  ok(/reportHistory\.record\(this\._report, this\._handoff\)/.test(thinkSrc), 'thinking persists on success transition')

  // D4b: profile count source = history, not ai_reports
  const prof = fs.readFileSync(path.join(ROOT, 'pages/profile/profile.js'), 'utf8')
  ok(/reportHistory\.count\(\)/.test(prof), 'profile reportCount uses reportHistory.count()')
  ok(!/ai_reports'\)\.where\(\{ openid \}\)\.count\(\)/.test(prof), 'profile no longer counts ai_reports')
  ok(/goReports[^\n]*report-history/.test(prof), 'profile goReports -> report-history')
  ok(/goReports[^\n]*report-preview/.test(prof) === false, 'profile goReports no longer -> report-preview')

  // D5: report-preview route untouched + still registered
  const APP = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
  ok(APP.pages.includes('pages/report-preview/report-preview'), 'report-preview still registered')
  ok(APP.pages.includes('pages/report-history/report-history'), 'report-history registered')

  console.log(`\nREPORT_HISTORY_TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})()
