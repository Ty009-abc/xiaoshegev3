#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.8/challenge-records.test.js
 *
 * H. Challenge records — history list page + profile route rewiring.
 *    Source: getChallengeRecords (SERVER-AUTHORITATIVE list cloud function).
 *    RC8_13_P0_HISTORY_LIST_SERVER_AUTHORITY_FIX — client direct collection read removed.
 *
 * Node built-ins only. Runnable from repo root.
 */

const path = require('path')
const fs = require('fs')
const ROOT = path.resolve(__dirname, '..', '..')
const APP = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))

let listResp = { code: 0, data: { items: [], total: 0, finishedTotal: 0, nextCursor: null, countComplete: true } }
let calls = []
function makeWx() {
  return {
    cloud: {
      callFunction: (x) => { calls.push(x && x.name); return Promise.resolve({ result: listResp }) },
    },
    navigateTo(o) { this._nav = this._nav || []; this._nav.push(o.url) },
    navigateBack() {}, showToast() {},
  }
}
function loadPage(rel) {
  global.wx = makeWx()
  global.getApp = () => ({ globalData: { openid: 'o123' } })
  let cap = null
  global.Page = (c) => { cap = c }
  const abs = path.join(ROOT, rel)
  delete require.cache[require.resolve(abs)]
  require(abs)
  return cap
}
const mk = (cfg) => Object.assign({ data: JSON.parse(JSON.stringify(cfg.data)), setData(o) { Object.assign(this.data, o) } }, cfg)
const wait = () => new Promise((r) => setTimeout(r, 30))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

;(async () => {
  // C1: renders server items with status/day/date
  listResp = { code: 0, data: {
    items: [
      { recordId: 'CR1', status: 'processing', statusText: '进行中', day: 3, finalType: '', action: 'resume', startedAt: 1700000000000 },
      { recordId: 'CR2', status: 'finished', statusText: '已完成', day: 0, finalType: 'strategic', action: 'detail', startedAt: 1690000000000 },
      { recordId: 'CR3', status: 'unknown', statusText: '未知', day: 1, finalType: '', action: 'none', createdAt: 1680000000000 },
    ],
    total: 3, finishedTotal: 1, nextCursor: null, countComplete: true,
  } }
  calls = []
  const cfg = loadPage('pages/challenge-records/challenge-records.js')
  const p = mk(cfg); p.onShow(); await wait()
  ok(calls[0] === 'getChallengeRecords', `uses server list API (${calls[0]})`)
  ok(p.data.status === 'success', `success state (${p.data.status})`)
  ok(p.data.records.length === 3, `renders 3 (${p.data.records.length})`)
  ok(p.data.records[0].statusText === '进行中' && p.data.records[0].dayText === '第 3 天', 'processing + day')
  ok(p.data.records[1].statusText === '已完成' && p.data.records[1].typeText === '战略型翻身者', 'finished + type label (canonical mapper)')
  ok(p.data.records[0].typeText === '' , 'processing without finalType shows no fabricated type')
  ok(/\d{4}\/\d{2}\/\d{2}/.test(p.data.records[0].dateText), `date formatted (${p.data.records[0].dateText})`)
  ok(p.data.records[2].statusText === '未知', 'unknown status normalized')

  // C1b: raw internal enum NEVER exposed; canonical label applied (RC8_13 PHASE_3)
  listResp = { code: 0, data: {
    items: [ { recordId: 'CRX', status: 'finished', statusText: '已完成', day: 0, finalType: 'system_thinker', action: 'detail' } ],
    total: 1, finishedTotal: 1, nextCursor: null, countComplete: true,
  } }
  const cfgL = loadPage('pages/challenge-records/challenge-records.js')
  const pL = mk(cfgL); pL.onShow(); await wait()
  ok(pL.data.records[0].typeText === '系统思维型', `finalType via canonical mapper (${pL.data.records[0].typeText})`)
  ok(!/system_thinker/.test(pL.data.records[0].typeText), 'raw enum system_thinker NOT exposed')
  ok(pL.data.records[0].typeText !== '系统思考型', 'forbidden label 系统思考型 NOT used')
  const pageSrcLabel = fs.readFileSync(path.join(ROOT, 'pages/challenge-records/challenge-records.js'), 'utf8')
  ok(/worldModelLabels/.test(pageSrcLabel), 'page uses canonical worldModelLabels mapper')
  ok(!/系统思考型/.test(pageSrcLabel), 'page does not inline forbidden label')
  ok(!/'系统思维型'|"系统思维型"/.test(pageSrcLabel), 'page does not inline its own classification map')

  // C2: tap finished → challenge-result?recordId=
  p.onTapRecord({ currentTarget: { dataset: { id: 'CR2', status: 'finished' } } })
  ok(global.wx._nav[0] === '/pages/challenge-result/challenge-result?recordId=CR2', `detail route (${global.wx._nav[0]})`)
  // tap processing → challenge-play resume (server-authorized action)
  p.onTapRecord({ currentTarget: { dataset: { id: 'CR1', status: 'processing' } } })
  ok(global.wx._nav[1] === '/pages/challenge-play/challenge-play?mode=challenge&recordId=CR1', `resume route (${global.wx._nav[1]})`)

  // C3: server-confirmed zero → EMPTY (not error)
  listResp = { code: 0, data: { items: [], total: 0, finishedTotal: 0, nextCursor: null, countComplete: true } }
  const cfg2 = loadPage('pages/challenge-records/challenge-records.js')
  const p2 = mk(cfg2); p2.onShow(); await wait()
  ok(p2.data.records.length === 0 && p2.data.loading === false, 'empty when server total 0')
  ok(p2.data.status === 'empty' && p2.data.empty === true, 'EMPTY only on server-confirmed zero')

  // C3b: server error → ERROR (never false empty)
  listResp = { code: 4001, message: 'db down', data: null }
  const cfg3 = loadPage('pages/challenge-records/challenge-records.js')
  const p3 = mk(cfg3); p3.onShow(); await wait()
  ok(p3.data.status === 'error' && p3.data.loadError === true, 'server error → ERROR state (no false empty)')
  ok(p3.data.records.length === 0 && p3.data.empty === false, 'error is NOT empty')

  // C4: profile rewired
  const prof = fs.readFileSync(path.join(ROOT, 'pages/profile/profile.js'), 'utf8')
  ok(/goChallenges[^\n]*challenge-records/.test(prof), 'profile goChallenges -> challenge-records')
  ok(!/goChallenges[^\n]*challenge-start/.test(prof), 'profile goChallenges no longer -> challenge-start')

  // C5: challenge-start preserved (tabBar + pages + callers)
  ok(APP.pages.includes('pages/challenge-start/challenge-start'), 'challenge-start still registered')
  ok(APP.tabBar.list.some((i) => i.pagePath === 'pages/challenge-start/challenge-start'), 'challenge-start still a tabBar page')
  ok(APP.pages.includes('pages/challenge-records/challenge-records'), 'challenge-records registered')

  // C6: count source is server-authoritative; page consumes server list
  ok(/name:\s*'getProfileStats'/.test(prof), 'profile challengeCount comes from getProfileStats (server-authoritative)')
  const pageSrc = fs.readFileSync(path.join(ROOT, 'pages/challenge-records/challenge-records.js'), 'utf8')
  ok(/getChallengeRecords/.test(pageSrc), 'challenge-records consumes getChallengeRecords')
  ok(!/wx\.cloud\.database\(\)/.test(pageSrc), 'challenge-records no longer reads DB directly')

  console.log(`\nCHALLENGE_RECORDS_TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})()
