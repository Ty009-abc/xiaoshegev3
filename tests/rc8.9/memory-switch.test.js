#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/memory-switch.test.js
 *
 * RC8_9_MEMORY_SWITCH — 记忆开关 is a persisted setting with no destructive side
 * effects; 清除全部记忆 is a SEPARATE destructive action limited to the memory domain.
 *
 *  A  memory ON  → switch true, persisted, no deletes
 *  B  memory OFF → switch false, persisted (enabled:false), no deletes
 *  C  re-enable  → persisted enabled:true
 *  D  toggle persistence failure → UI rollback to previous value + error toast
 *  E  clear memory → clearMemory({}) only; confirmation required; no other collection touched
 *  F  getMemory unavailable on load → no crash (switch keeps last known)
 *  H  server memoryEnabled:false → switch reflects server authority
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

console.log('RC8_9_MEMORY_SWITCH')

function load (opt) {
  const o = opt || {}
  const calls = []
  const toasts = []
  let modalCfg = null
  let modalSuccess = null
  let page = null

  const fakeDb = {
    collection: () => {
      const q = { where: () => q, orderBy: () => q, limit: () => q,
        count: async () => ({ total: 0 }), get: async () => ({ data: [] }), update: async () => ({}) }
      return q
    },
  }
  const sandbox = {
    require: (id) => {
      if (id.indexOf('analytics') >= 0) return { track: () => {}, flush: () => {} }
      if (id.indexOf('reportHistory') >= 0) return { count: () => 0, list: () => [], get: () => null }
      if (id.indexOf('worldModelLabels') >= 0) return require(path.join(ROOT, 'utils', 'worldModelLabels.js'))
      throw new Error('unexpected require: ' + id)
    },
    Page: (c) => { page = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
    setTimeout: () => 0, clearTimeout: () => {},
    getApp: () => ({ globalData: { openid: 'oZa463Yb2VY0k9Es_pGzdHFtigNo', userInfo: { membershipLevel: 'free', cv: 0, memoryNoticeShown: true }, profile: {} } }),
    wx: {
      cloud: {
        callFunction: (x) => {
          calls.push(x.name)
          if (x.name === 'getMemory') {
            if (o.getMemoryReject) return Promise.reject(new Error('simulated getMemory failure'))
            return Promise.resolve({ result: { code: 0, data: { memoryEnabled: o.serverMemoryEnabled !== false } } })
          }
          if (x.name === 'toggleMemory') {
            if (o.toggleReject) return Promise.reject(new Error('simulated toggle failure'))
            if (o.toggleCode) return Promise.resolve({ result: { code: o.toggleCode, message: 'rejected' } })
            return Promise.resolve({ result: { code: 0 } })
          }
          if (x.name === 'clearMemory') {
            if (o.clearReject) return Promise.reject(new Error('simulated clear failure'))
            return Promise.resolve({ result: { code: 0 } })
          }
          return Promise.resolve({ result: { code: 0, data: {} } })
        },
        database: () => fakeDb,
      },
      showToast: (t) => toasts.push(t),
      showModal: (cfg) => { modalCfg = cfg; if (cfg.success) modalSuccess = cfg.success },
      navigateTo: () => {},
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(PAGE, 'utf8'), sandbox, { filename: PAGE })
  const p = Object.assign({}, page)
  p.data = JSON.parse(JSON.stringify(page.data || {}))
  p.setData = function (x) { Object.assign(this.data, x) }
  p._calls = calls
  p._toasts = toasts
  p._modal = () => modalCfg
  p._confirmModal = async () => { if (modalSuccess) await modalSuccess({ confirm: true }) }
  return p
}

;(async () => {
  // ── A: memory ON ──
  {
    const p = load()
    p.data.memoryEnabled = true
    await p.onToggleMemory({ detail: { value: true } })
    eq(p.data.memoryEnabled, true, 'A: switch on')
    ok(p._calls.includes('toggleMemory'), 'A: toggleMemory called')
    ok(!p._calls.includes('clearMemory'), 'A: no destructive clear on toggle')
    ok(p._toasts.some((t) => /开启/.test(t.title)), 'A: on toast')
  }
  // ── B: memory OFF ──
  {
    const p = load()
    p.data.memoryEnabled = true
    await p.onToggleMemory({ detail: { value: false } })
    eq(p.data.memoryEnabled, false, 'B: switch off')
    ok(p._calls.includes('toggleMemory'), 'B: toggleMemory called (persist off)')
    ok(!p._calls.includes('clearMemory'), 'B: toggle NEVER deletes memory')
    ok(p._toasts.some((t) => /关闭/.test(t.title)), 'B: off toast')
  }
  // ── C: re-enable ──
  {
    const p = load()
    p.data.memoryEnabled = false
    await p.onToggleMemory({ detail: { value: true } })
    eq(p.data.memoryEnabled, true, 'C: re-enabled')
    ok(p._calls.includes('toggleMemory'), 'C: persisted on')
  }
  // ── D: toggle persistence failure → rollback ──
  {
    const p = load({ toggleReject: true })
    p.data.memoryEnabled = true
    await p.onToggleMemory({ detail: { value: false } })
    eq(p.data.memoryEnabled, true, 'D: UI rolled back to authoritative prev (true)')
    ok(p._toasts.some((t) => /失败/.test(t.title)), 'D: failure toast visible')
  }
  // ── D2: non-zero code also rolls back ──
  {
    const p = load({ toggleCode: -1 })
    p.data.memoryEnabled = false
    await p.onToggleMemory({ detail: { value: true } })
    eq(p.data.memoryEnabled, false, 'D2: non-zero code rolls back')
  }
  // ── E: clear memory (separate destructive action) ──
  {
    const p = load()
    p.onClearMemory()
    const cfg = p._modal()
    ok(!!cfg, 'E: clear shows confirmation modal')
    ok(/不可恢复/.test(cfg.content || ''), 'E: irreversible warning present')
    ok(/不受影响|不影响/.test(cfg.content || ''), 'E: states reports/challenges/权益 untouched')
    eq((cfg.confirmText || '').length <= 4, true, 'E: confirmText ≤4 chars (WeChat limit)')
    await p._confirmModal()
    ok(p._calls.includes('clearMemory'), 'E: clearMemory called after confirm')
    const clears = p._calls.filter((c) => c === 'clearMemory')
    eq(clears.length, 1, 'E: exactly one clearMemory call')
    ok(!p._calls.includes('toggleMemory'), 'E: clear does not toggle the switch')
  }
  // ── E2: cancel → no call ──
  {
    const p = load()
    p.onClearMemory()
    // simulate cancel: do not invoke success confirm
    ok(!p._calls.includes('clearMemory'), 'E2: no clear on cancel')
  }
  // ── F: getMemory unavailable on load → no crash ──
  {
    const p = load({ getMemoryReject: true })
    let threw = false
    try { await p.loadData() } catch (e) { threw = true }
    ok(!threw, 'F: loadData tolerates getMemory failure')
    ok(p._calls.includes('getMemory'), 'F: getMemory attempted')
  }
  // ── H: server authority ──
  {
    const p = load({ serverMemoryEnabled: false })
    await p.loadData()
    eq(p.data.memoryEnabled, false, 'H: switch reflects server memoryEnabled:false')
  }

  // ── S: source invariants ──
  {
    const src = fs.readFileSync(PAGE, 'utf8')
    const toggle = (src.split('async onToggleMemory(e) {')[1] || '').split('// 清除记忆')[0]
    ok(/toggleMemory/.test(toggle), 'S1: toggle persists to toggleMemory cloud fn')
    ok(!/clearMemory/.test(toggle), 'S2: toggle NEVER calls clearMemory (switch != delete)')
    ok(/setData\(\{ memoryEnabled: prev \}\)/.test(toggle), 'S3: failure rollback present')
    ok(!/catch\s*\(\s*_\s*\)\s*\{\s*\}/.test(toggle), 'S4: no silent catch on toggle')
    const clear = (src.split('onClearMemory() {')[1] || '').split('async _showMemoryProfile')[0]
    ok(/clearMemory'/.test(clear), 'S5: clear calls clearMemory cloud fn')
    ok(/wx\.showModal/.test(clear), 'S6: clear requires confirmation')
    ok(!/toggleMemory/.test(clear), 'S7: clear does not toggle the switch')
    const wxml = fs.readFileSync(path.join(ROOT, 'pages', 'profile', 'profile.wxml'), 'utf8')
    ok(/bindchange="onToggleMemory"/.test(wxml), 'S8: switch bound to onToggleMemory')
    ok(/已有记忆不会自动删除/.test(wxml), 'S9: OFF subtext states no auto-delete')
    ok(/不受影响/.test(wxml) || /不受影响/.test(src), 'S10: copy states business data preserved')
  }

  console.log(`  _TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
