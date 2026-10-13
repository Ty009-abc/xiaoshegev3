#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/profile-authority.test.js
 *
 * RC8_9_P0_PROFILE_DATA_CHAIN + RC8_13_P0_PROFILE_HISTORY_AUTHORITY_FIX —
 * profile is server-authoritative; unknown != real 0; zero(confirmed) != unknown.
 *
 * Counts now come from the getProfileStats cloud function (identity resolved
 * server-side from getWXContext().OPENID) — the broken client direct-DB count
 * query is gone.
 *
 *  A  server reportCount/challengeCount → profile fields
 *  B  server counts propagate verbatim
 *  C  server 0 → confirmed ZERO (countsLoaded true, not '—')
 *  D  openid missing                → explicit loadError, counts null, no false zero
 *  E  getProfileStats failure       → explicit loadError, counts null (never loaded)
 *  E2 failure after a success       → last valid counts preserved
 *  F  paid report exists            → paidReportCount
 *  G  finished challenge finalType, profile unclassified → label 普通觉醒型, no raw enum
 *  G2 profile mainType populated wins
 *  G3 no authoritative result → empty (UI neutral fallback)
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
    collection: (name) => ({
      where: () => fakeDb.collection(name),
      orderBy: () => fakeDb.collection(name),
      limit: () => fakeDb.collection(name),
      count: async () => ({ total: 0 }),
      get: async () => {
        if (name === 'badges') return { data: o.badgeDocs || [] }
        return { data: [] }
      },
    }),
  }
  const sandbox = {
    require: (id) => {
      if (id.indexOf('analytics') >= 0) return { track: () => {}, flush: () => {} }
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
          if (!x || !x.name) return Promise.resolve({ result: { code: 0, data: {} } })
          if (x.name === 'getMemory') return Promise.resolve({ result: { data: { memoryEnabled: true } } })
          if (x.name === 'getMembership') return Promise.resolve({ result: { code: 0, data: {} } })
          if (x.name === 'getProfileStats') {
            if (o.rejectStats) return Promise.reject(new Error('simulated getProfileStats unavailable'))
            if (o.statsFailCode) return Promise.resolve({ result: { code: 4001, message: 'db error' } })
            const counts = Object.assign({
              reportCount: 0, reportTotalRecords: 0, paidReportCount: 0,
              challengeCount: 0, challengeFinishedCount: 0,
            }, o.stats || {})
            return Promise.resolve({ result: { code: 0, data: { counts, latestFinishedType: o.latestFinishedType || '' } } })
          }
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
    const p = loadProfile({ stats: { challengeCount: 1, reportCount: 1 } })
    await p.loadData()
    eq(p.data.challengeCount, 1, 'A: challengeCount = server 1')
    eq(p.data.reportCount, 1, 'A: reportCount = server 1')
    ok(p.data.countsLoaded === true, 'A: countsLoaded true')
    ok(p.data.loadError === false, 'A: no loadError')
  }
  // ── B ──
  {
    const p = loadProfile({ stats: { reportCount: 127, challengeCount: 27 } })
    await p.loadData()
    eq(p.data.reportCount, 127, 'B: reportCount verbatim 127')
    eq(p.data.challengeCount, 27, 'B: challengeCount verbatim 27')
  }
  // ── C: confirmed zero (not unknown) ──
  {
    const p = loadProfile({ stats: { reportCount: 0, challengeCount: 0 } })
    await p.loadData()
    eq(p.data.reportCount, 0, 'C: confirmed ZERO reportCount')
    eq(p.data.challengeCount, 0, 'C: confirmed ZERO challengeCount')
    ok(p.data.countsLoaded === true, 'C: countsLoaded true (zero is a real value)')
    ok(p.data.loadError === false, 'C: no loadError on real zero')
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
  // ── E: stats failure (never loaded) ──
  {
    const p = loadProfile({ rejectStats: true })
    await p.loadData()
    ok(p.data.loadError === true, 'E: loadError true on failure')
    eq(p.data.challengeCount, null, 'E: challengeCount null on failure (unknown, not 0)')
    eq(p.data.reportCount, null, 'E: reportCount null on failure (unknown, not 0)')
    ok(p._errors.some((e) => /getProfileStats failed/.test(e)), 'E: failure surfaced via console.error')
  }
  // ── E2: failure preserves last valid counts ──
  {
    let reject = false
    let page = null
    const sandbox = {
      require: (id) => {
        if (id.indexOf('analytics') >= 0) return { track: () => {}, flush: () => {} }
        if (id.indexOf('worldModelLabels') >= 0) return require(path.join(ROOT, 'utils', 'worldModelLabels.js'))
        throw new Error('unexpected require: ' + id)
      },
      Page: (c) => { page = c },
      console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
      setTimeout: () => 0, clearTimeout: () => {},
      getApp: () => ({ globalData: { openid: 'oZa463Yb2VY0k9Es_pGzdHFtigNo', userInfo: {}, profile: {} } }),
      wx: { cloud: {
        callFunction: (x) => {
          if (x && x.name === 'getProfileStats') {
            if (reject) return Promise.reject(new Error('boom'))
            return Promise.resolve({ result: { code: 0, data: { counts: { reportCount: 5, challengeCount: 2 } } } })
          }
          return Promise.resolve({ result: { code: 0, data: { data: { memoryEnabled: true } } } })
        },
        database: () => ({ collection: () => ({ where () { return this }, orderBy () { return this }, limit () { return this }, get: async () => ({ data: [] }) }) }),
      }, showToast: () => {}, navigateTo: () => {} },
    }
    sandbox.console = Object.assign({}, console, { error: () => {}, warn: () => {} })
    vm.createContext(sandbox)
    vm.runInContext(fs.readFileSync(PAGE, 'utf8'), sandbox, { filename: PAGE })
    const p = Object.assign({}, page)
    p.data = JSON.parse(JSON.stringify(page.data || {}))
    p.setData = function (x) { Object.assign(this.data, x) }
    await p.loadData()
    eq(p.data.reportCount, 5, 'E2: first success reportCount 5')
    reject = true
    await p.loadData()
    eq(p.data.reportCount, 5, 'E2: failure preserves last valid reportCount (not 0/—)')
    ok(p.data.loadError === true, 'E2: failure still flagged')
  }
  // ── F: paid included ──
  {
    const p = loadProfile({ stats: { reportCount: 1, paidReportCount: 1 } })
    await p.loadData()
    eq(p.data.reportCount, 1, 'F: reportCount includes paid report')
    eq(p.data.paidReportCount, 1, 'F: paidReportCount from server')
  }
  // ── G: classification from finished finalType (no raw enum) ──
  {
    const p = loadProfile({ latestFinishedType: 'normal_awakened', profile: { mainType: 'unclassified' } })
    await p.loadData()
    eq(p.data.classificationLabel, '普通觉醒型', 'G: label 普通觉醒型 from server finalType')
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
    const p = loadProfile({ profile: { mainType: 'unclassified' }, latestFinishedType: '' })
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
    ok(/name:\s*'getProfileStats'/.test(src), 'S1: profile consumes getProfileStats (server)')
    ok(!/collection\('ai_reports'\)\.where\(\{ openid \}\)\.count\(\)/.test(src), 'S2: broken direct ai_reports count removed')
    ok(!/collection\('challenge_records'\)\.where\(\{ openid \}\)\.count\(\)/.test(src), 'S3: broken direct challenge_records count removed')
    ok(!/require\(['"][^'"]*reportHistory/.test(src), 'S4: local-history override dependency removed')
    ok(/const openid = gd\.openid \|\| ''/.test(src), 'S5: explicit openid guard present (source comment)')
    ok(/if \(!openid\)/.test(src), 'S5b: explicit openid guard present')
    ok(/worldModelTypeLabel/.test(src), 'S6: classification via canonical mapper (no client invention)')
    ok(!/mainType\s*\|\|\s*'unclassified'/.test(src), 'S7: no raw unclassified enum in source')
    ok(!/catch\s*\(\s*_\s*\)\s*\{\s*\}/.test(src), 'S8: no empty catch(_) swallow')
  }

  console.log(`  _TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
