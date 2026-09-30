#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/profile-authority.test.js
 *
 * RC8_9_P0_PROFILE_DATA_CHAIN — profile is server-authoritative; unknown != real 0.
 *
 *  A  server challenge_records > 0  → challengeCount > 0
 *  B  server ai_reports > 0         → reportCount > 0
 *  C  local history 0, server > 0   → server wins
 *  C2 local > 0, server 0           → local compatibility fallback used
 *  D  openid missing                → explicit loadError, counts null, no false zero
 *  E  server read failure           → explicit loadError, counts null
 *  F  paid report exists            → reportCount includes it (+ paidReportCount)
 *  G  finished challenge normal_awakened, profile unclassified → label 普通觉醒型, no raw enum
 *  H  cv field present              → cvText numeric (authoritative)
 *  H2 cv field absent               → cvText '—' (never fake 0)
 *  I  streak field absent           → streakText '—' (never fake 0)
 *  S  source invariants
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
        orderBy: () => q,
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
        get: async () => {
          if (name === 'badges') return { data: o.badgeDocs || [] }
          if (name === 'challenge_records' && q._w && q._w.status === 'finished') {
            return { data: o.finishedDocs || [] }
          }
          return { data: [] }
        },
      }
      return q
    },
  }
  const sandbox = {
    require: (id) => {
      if (id.indexOf('analytics') >= 0) return { track: () => {}, flush: () => {} }
      if (id.indexOf('reportHistory') >= 0) return { count: () => (o.localCount || 0) }
      if (id.indexOf('worldModelLabels') >= 0) return require(path.join(ROOT, 'utils', 'worldModelLabels.js'))
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
  // ── C ──
  {
    const p = loadProfile({ aiReportsTotal: 5, localCount: 0 })
    await p.loadData()
    eq(p.data.reportCount, 5, 'C: server count wins over empty local history')
  }
  // ── C2 ──
  {
    const p = loadProfile({ aiReportsTotal: 0, localCount: 3 })
    await p.loadData()
    eq(p.data.reportCount, 3, 'C2: local compatibility used only when server is 0')
  }
  // ── D: openid missing ──
  {
    const p = loadProfile({ openid: '' })
    await p.loadData()
    ok(p.data.loadError === true, 'D: loadError true')
    ok(p.data.countsLoaded === false, 'D: countsLoaded false')
    eq(p.data.challengeCount, null, 'D: challengeCount null (not false 0)')
    eq(p.data.reportCount, null, 'D: reportCount null (not false 0)')
    ok(p._errors.some((e) => /openid missing/.test(e)), 'D: explicit console.error')
  }
  // ── E: server read failure ──
  {
    const p = loadProfile({ rejectChallenge: true })
    await p.loadData()
    ok(p.data.loadError === true, 'E: loadError true on failure')
    eq(p.data.challengeCount, null, 'E: challengeCount null on failure')
    ok(p._errors.some((e) => /data load failed/.test(e)), 'E: failure surfaced via console.error')
  }
  // ── F: paid included ──
  {
    const p = loadProfile({ aiReportsTotal: 1, paidTotal: 1 })
    await p.loadData()
    eq(p.data.reportCount, 1, 'F: reportCount includes paid report')
    eq(p.data.paidReportCount, 1, 'F: paidReportCount from ai_reports{isPaid:true}')
  }
  // ── G: classification from finished finalType (no raw enum) ──
  {
    const p = loadProfile({ finishedDocs: [{ finalType: 'normal_awakened' }], profile: { mainType: 'unclassified' } })
    await p.loadData()
    eq(p.data.classificationLabel, '普通觉醒型', 'G: label 普通觉醒型 from authoritative finalType')
    ok(!/unclassified/.test(p.data.classificationLabel), 'G: no raw enum exposed')
  }
  // ── G2: profile mainType populated wins ──
  {
    const p = loadProfile({ profile: { mainType: 'system_thinker' } })
    await p.loadData()
    ok(!!p.data.classificationLabel && p.data.classificationLabel !== 'unclassified', 'G2: profile mainType mapped, no raw enum')
  }
  // ── G3: no authoritative result → empty (UI neutral fallback) ──
  {
    const p = loadProfile({ profile: { mainType: 'unclassified' }, finishedDocs: [] })
    await p.loadData()
    eq(p.data.classificationLabel, '', 'G3: unknown classification = empty (no raw enum)')
  }
  // ── H: cv present ──
  {
    const p = loadProfile({ userInfo: { cv: 45 } })
    await p.loadData()
    eq(p.data.cvText, '45', 'H: cv text = authoritative value')
  }
  // ── H2: cv absent ──
  {
    const p = loadProfile({ userInfo: { cv: undefined } })
    await p.loadData()
    eq(p.data.cvText, '—', 'H2: cv unknown → — (never fake 0)')
  }
  // ── I: streak absent ──
  {
    const p = loadProfile({})
    await p.loadData()
    eq(p.data.streakText, '—', 'I: streak unknown → — (never fake 0)')
  }

  // ── S: source invariants ──
  {
    const src = fs.readFileSync(PAGE, 'utf8')
    const load = (src.split('async loadData() {')[1] || '').split('\n  // 分类标签')[0]
    ok(!/catch\s*\(\s*_\s*\)\s*\{\s*\}/.test(load), 'S1: loadData has no empty catch(_) swallow')
    ok(/ai_reports'\)\.where\(\{ openid \}\)\.count\(\)/.test(load), 'S2: reportCount reads ai_reports (server)')
    ok(/challenge_records'\)\.where\(\{ openid \}\)\.count\(\)/.test(src), 'S3: challengeCount reads challenge_records (server)')
    ok(/serverReportCount > 0 \? serverReportCount : localCount/.test(load), 'S4: local cannot override non-zero server count')
    ok(/if \(!openid\)/.test(load), 'S5: explicit openid guard present')
    ok(/worldModelTypeLabel/.test(src), 'S6: classification via canonical mapper (no client invention)')
    ok(!/mainType\s*\|\|\s*'unclassified'/.test(src), 'S7: no raw unclassified enum in source')
  }

  console.log(`  _TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
