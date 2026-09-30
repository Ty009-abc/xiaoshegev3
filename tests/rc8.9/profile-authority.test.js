#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/profile-authority.test.js
 *
 * RC8_9_P0_PROFILE_AUTHORITY — profile counts are server-authoritative.
 *
 *  A  server challenge_records > 0  → UI challengeCount > 0
 *  B  server ai_reports > 0         → UI reportCount > 0
 *  C  local history 0, server > 0   → server wins (local is secondary only)
 *  C2 local > 0, server 0           → local compatibility fallback used
 *  D  openid missing                → explicit loadError (NO false zero authority)
 *  E  server read failure           → explicit loadError, no silent swallow
 *  F  paid report exists            → reportCount includes it (+ paidReportCount)
 *  S  source: no catch(_){} in loadData; ai_reports counted; secondary policy present
 *
 * Logic + source-asset only. No network / DB / device claim.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const PAGE = path.join(ROOT, 'pages', 'profile', 'profile.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_9_P0_PROFILE_AUTHORITY')

function loadProfile (opt) {
  const o = opt || {}
  const errors = []
  let page = null
  const fakeDb = {
    collection: (name) => {
      const q = {
        _w: null,
        where: (w) => { q._w = w; return q },
        limit: () => q,
        count: async () => {
          if (name === 'challenge_records') {
            if (o.rejectChallenge) throw new Error('simulated challenge_records unavailable')
            return { total: o.challengeTotal != null ? o.challengeTotal : 0 }
          }
          if (name === 'ai_reports') {
            if (o.rejectReports) throw new Error('simulated ai_reports unavailable')
            const paidOnly = !!(q._w && q._w.isPaid)
            return { total: paidOnly ? (o.paidTotal || 0) : (o.aiReportsTotal || 0) }
          }
          return { total: 0 }
        },
        get: async () => ({ data: name === 'badges' ? (o.badgeDocs || []) : [] }),
      }
      return q
    },
  }
  const sandbox = {
    require: (id) => {
      if (id.indexOf('analytics') >= 0) return { track: () => {}, flush: () => {} }
      if (id.indexOf('reportHistory') >= 0) return { count: () => (o.localCount || 0) }
      throw new Error('unexpected require: ' + id)
    },
    Page: (c) => { page = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
    setTimeout: () => 0, clearTimeout: () => {},
    getApp: () => ({ globalData: {
      openid: o.openid !== undefined ? o.openid : 'oZa463Yb2VY0k9Es_pGzdHFtigNo',
      userInfo: Object.assign({ membershipLevel: 'free', cv: 0, level: 1, memoryNoticeShown: true }, o.userInfo || {}),
      profile: o.profile || {},
    } }),
    wx: {
      cloud: {
        callFunction: (x) => {
          if (x && x.name === 'getMemory') return Promise.resolve({ result: { data: { memoryEnabled: true } } })
          return Promise.resolve({ result: { code: 0, data: {} } })
        },
        database: () => fakeDb,
      },
      showToast: () => {}, showModal: () => {}, navigateTo: () => {},
    },
  }
  // capture console.error without muting it entirely
  sandbox.console = Object.assign({}, console, { error: (...a) => errors.push(a.join(' ')), warn: () => {} })
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(PAGE, 'utf8'), sandbox, { filename: PAGE })
  const p = Object.assign({}, page)
  p.data = JSON.parse(JSON.stringify(page.data || {}))
  p.setData = function (x) { Object.assign(this.data, x) }
  p._errors = errors
  return p
}

;(async () => {
  // ── A ──
  {
    const p = loadProfile({ challengeTotal: 27 })
    await p.loadData()
    eq(p.data.challengeCount, 27, 'A: challengeCount = server 27')
    ok(p.data.countsLoaded === true, 'A: countsLoaded true')
    ok(p.data.loadError === false, 'A: no loadError')
  }
  // ── B ──
  {
    const p = loadProfile({ aiReportsTotal: 127 })
    await p.loadData()
    eq(p.data.reportCount, 127, 'B: reportCount = server 127')
  }
  // ── C: local 0, server > 0 → server wins ──
  {
    const p = loadProfile({ aiReportsTotal: 5, localCount: 0 })
    await p.loadData()
    eq(p.data.reportCount, 5, 'C: server count wins over empty local history')
  }
  // ── C2: local > 0, server 0 → local compat fallback ──
  {
    const p = loadProfile({ aiReportsTotal: 0, localCount: 3 })
    await p.loadData()
    eq(p.data.reportCount, 3, 'C2: local compatibility used only when server is 0')
  }
  // ── D: openid missing → explicit error, no false-zero authority ──
  {
    const p = loadProfile({ openid: '' })
    await p.loadData()
    ok(p.data.loadError === true, 'D: loadError true when openid missing')
    ok(p.data.countsLoaded === false, 'D: countsLoaded false when openid missing')
    ok(p._errors.some((e) => /openid missing/.test(e)), 'D: explicit console.error (not silent)')
  }
  // ── E: server read failure → explicit error, no silent swallow ──
  {
    const p = loadProfile({ rejectChallenge: true })
    await p.loadData()
    ok(p.data.loadError === true, 'E: loadError true on server read failure')
    ok(p.data.countsLoaded === false, 'E: countsLoaded false on server read failure')
    ok(p._errors.some((e) => /counts load failed/.test(e)), 'E: failure surfaced via console.error')
  }
  // ── F: paid report included ──
  {
    const p = loadProfile({ aiReportsTotal: 1, paidTotal: 1 })
    await p.loadData()
    eq(p.data.reportCount, 1, 'F: reportCount includes the paid report')
    eq(p.data.paidReportCount, 1, 'F: paidReportCount from ai_reports{isPaid:true}')
  }

  // ── S: source invariants ──
  {
    const src = fs.readFileSync(PAGE, 'utf8')
    const load = (src.split('async loadData() {')[1] || '').split('\n  },')[0]
    ok(!/catch\s*\(\s*_\s*\)\s*\{\s*\}/.test(load), 'S1: loadData has no empty catch(_) swallow')
    ok(/ai_reports'\)\.where\(\{ openid: openid \}\)\.count\(\)/.test(load), 'S2: reportCount reads ai_reports (server)')
    ok(/challenge_records'\)\.where\(\{ openid \}\)\.count\(\)/.test(src), 'S3: challengeCount reads challenge_records (server)')
    ok(/serverReportCount > 0 \? serverReportCount : localCount/.test(load), 'S4: local history cannot override non-zero server count')
    ok(/reportHistory\.count\(\)/.test(src), 'S5: local 6Q history retained as secondary compatibility source')
    ok(/if \(!openid\)/.test(load), 'S6: explicit openid guard present')
  }

  console.log(`  _TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
