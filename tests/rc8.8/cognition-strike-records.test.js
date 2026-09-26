#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.8/cognition-strike-records.test.js
 *
 * G. Cognition strike records — canonical key (strike_collection) + legacy
 *    migration (strikecollection) + profile route rewiring.
 *
 * Node built-ins only. Runnable from repo root.
 */

const path = require('path')
const fs = require('fs')
const ROOT = path.resolve(__dirname, '..', '..')
const KEY = 'strike_collection'
const LEGACY = 'strikecollection'

let store = {}
function makeWx() {
  return {
    getStorageSync: (k) => (k in store ? store[k] : ''),
    setStorageSync: (k, v) => { store[k] = v },
    navigateTo(o) { this._nav = this._nav || []; this._nav.push(o.url) },
    navigateBack() {}, showToast() {},
  }
}
function loadPage(rel) {
  global.wx = makeWx()
  global.getApp = () => ({ globalData: {} })
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

// B1: empty state
store = {}
let cfg = loadPage('pages/cognition-strike-records/cognition-strike-records.js')
let p = mk(cfg); p.onShow()
ok(p.data.records.length === 0 && p.data.loading === false, 'empty state')

// B2: reads canonical + renders + formats time
store = {}
store[KEY] = [
  { id: 'STRIKE_007', title: '认知升级', time: '2026-09-26T10:00:00.000Z' },
  { id: '20260925', title: '昨日暴击', time: '2026-09-25T10:00:00.000Z' },
]
cfg = loadPage('pages/cognition-strike-records/cognition-strike-records.js')
p = mk(cfg); p.onShow()
ok(p.data.records.length === 2, `renders 2 records (${p.data.records.length})`)
ok(p.data.records[0].title === '认知升级', 'title carried')
ok(/\d{4}\/\d{2}\/\d{2}/.test(p.data.records[0].timeText), `timeText formatted (${p.data.records[0].timeText})`)

// B3: tap STRIKE_ -> sid param
p.data.records = [{ id: 'STRIKE_007' }]
p.onTapRecord({ currentTarget: { dataset: { id: 'STRIKE_007' } } })
ok(global.wx._nav && global.wx._nav[0] === '/subpkg-ai/cognitive-shock-detail/cognitive-shock-detail?sid=STRIKE_007', `sid route (${global.wx._nav})`)

// B4: tap date id -> id param
p.onTapRecord({ currentTarget: { dataset: { id: '20260925' } } })
ok(global.wx._nav[1] === '/subpkg-ai/cognitive-shock-detail/cognitive-shock-detail?id=20260925', `id route (${global.wx._nav[1]})`)

// B5: legacy migration
store = {}
store[LEGACY] = [{ id: 'STRIKE_001', title: 'legacy', time: '2026-09-24T00:00:00.000Z' }]
cfg = loadPage('pages/cognition-strike-records/cognition-strike-records.js')
p = mk(cfg); p.onShow()
ok(p.data.records.length === 1 && p.data.records[0].id === 'STRIKE_001', 'legacy migrated+read')
ok(Array.isArray(store[KEY]) && store[KEY].length === 1, 'migrated to canonical key')
ok(store[LEGACY].length === 1, 'legacy key kept')

// B6: profile no longer routes to cognition-daily
const prof = fs.readFileSync(path.join(ROOT, 'pages/profile/profile.js'), 'utf8')
ok(!/goDaily[^\n]*cognition-daily/.test(prof), 'profile goDaily does NOT target cognition-daily')
ok(/goDaily[^\n]*cognition-strike-records/.test(prof), 'profile goDaily targets strike records')

console.log(`\nSTRIKE_RECORDS_TEST pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
