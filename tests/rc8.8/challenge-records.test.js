#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.8/challenge-records.test.js
 *
 * H. Challenge records — history list page + profile route rewiring.
 *    Source: challenge_records where { openid } (client-direct read).
 *
 * Node built-ins only. Runnable from repo root.
 */

const path = require('path')
const fs = require('fs')
const ROOT = path.resolve(__dirname, '..', '..')
const APP = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))

let dbData = []
function makeWx() {
  return {
    cloud: {
      database: () => ({
        collection: (name) => ({
          where: () => ({
            orderBy: () => ({ limit: () => ({ get: () => Promise.resolve({ data: name === 'challenge_records' ? dbData : [] }) }) }),
          }),
        }),
      }),
    },
    navigateTo(o) { this._nav = this._nav || []; this._nav.push(o.url) },
    navigateBack() {}, showToast() {},
  }
}
function loadPage(rel, openid) {
  global.wx = makeWx()
  global.getApp = () => ({ globalData: { openid: openid === undefined ? 'o123' : openid } })
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
  // C1: renders records with status/day/date
  dbData = [
    { recordId: 'CR1', status: 'processing', currentDay: 3, startedAt: 1700000000000, finalType: '' },
    { recordId: 'CR2', status: 'finished', currentDay: 30, startedAt: 1690000000000, finalType: '系统构建者' },
    { recordId: 'CR3', status: 'weird', currentDay: 1, createdAt: 1680000000000 },
  ]
  const cfg = loadPage('pages/challenge-records/challenge-records.js')
  const p = mk(cfg); p.onShow(); await wait()
  ok(p.data.records.length === 3, `renders 3 (${p.data.records.length})`)
  ok(p.data.records[0].statusText === '进行中' && p.data.records[0].dayText === '第 3 天', 'processing + day')
  ok(p.data.records[1].statusText === '已完成' && p.data.records[1].typeText === '系统构建者', 'finished + type')
  ok(/\d{4}\/\d{2}\/\d{2}/.test(p.data.records[0].dateText), `date formatted (${p.data.records[0].dateText})`)
  ok(p.data.records[2].statusText === 'weird', 'unknown status passthrough')

  // C2: tap → challenge-result?recordId=
  p.onTapRecord({ currentTarget: { dataset: { id: 'CR2' } } })
  ok(global.wx._nav[0] === '/pages/challenge-result/challenge-result?recordId=CR2', `detail route (${global.wx._nav[0]})`)

  // C3: empty state (no openid)
  const cfg2 = loadPage('pages/challenge-records/challenge-records.js', '')
  const p2 = mk(cfg2); p2.onShow(); await wait()
  ok(p2.data.records.length === 0 && p2.data.loading === false, 'empty when no openid')

  // C4: profile rewired
  const prof = fs.readFileSync(path.join(ROOT, 'pages/profile/profile.js'), 'utf8')
  ok(/goChallenges[^\n]*challenge-records/.test(prof), 'profile goChallenges -> challenge-records')
  ok(!/goChallenges[^\n]*challenge-start/.test(prof), 'profile goChallenges no longer -> challenge-start')

  // C5: challenge-start preserved (tabBar + pages + callers)
  ok(APP.pages.includes('pages/challenge-start/challenge-start'), 'challenge-start still registered')
  ok(APP.tabBar.list.some((i) => i.pagePath === 'pages/challenge-start/challenge-start'), 'challenge-start still a tabBar page')
  ok(APP.pages.includes('pages/challenge-records/challenge-records'), 'challenge-records registered')

  // C6: count source unchanged
  ok(/challenge_records'\)\.where\(\{ openid \}\)\.count\(\)/.test(prof), 'profile challengeCount still counts challenge_records')

  console.log(`\nCHALLENGE_RECORDS_TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})()
