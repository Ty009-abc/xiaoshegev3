#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.8/world-rule-favorite.test.js
 *
 * F. World-rule favorite — canonical key (world_rules_favorites) + one-time
 *    legacy migration (legacy key = literal U+2026 "world_…ites").
 *
 * Node built-ins only. Runnable from repo root: node tests/rc8.8/world-rule-favorite.test.js
 * Asserts real page behaviour (no stubbed module resolution needed).
 */

const path = require('path')
const ROOT = path.resolve(__dirname, '..', '..')
const LEGACY = 'world_\u2026ites'
const CANON = 'world_rules_favorites'

let store = {}
function makeWx() {
  return {
    getStorageSync: (k) => (k in store ? store[k] : ''),
    setStorageSync: (k, v) => { store[k] = v },
    removeStorageSync: (k) => { delete store[k] },
    cloud: { callFunction: () => Promise.resolve({ result: { code: 0, data: null } }) },
    showToast() {}, navigateTo() {}, switchTab() {},
  }
}
function load(rel) {
  global.wx = makeWx()
  global.getApp = () => ({ globalData: {} })
  let cap = null
  global.Page = (c) => { cap = c }
  global.Component = () => {}
  const abs = path.join(ROOT, rel)
  delete require.cache[require.resolve(abs)]
  require(abs)
  return cap
}

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

// ── A1: canonical write through the detail page's favorite toggle ──────────
const detail = load('pages/world-rule-detail/world-rule-detail.js')
const inst = Object.assign({ data: { rule: { id: 'WR001', title: 'T1', category: 'wealth' }, isFavorited: false, favoriting: false }, setData(o) { Object.assign(this.data, o) } }, detail)
detail.onLoad.call(inst, { id: 'WR001' })
inst.data.rule = { id: 'WR001', title: 'T1', category: 'wealth' }
inst.data.isFavorited = false
detail.onToggleFavorite.call(inst)
ok(Array.isArray(store[CANON]) && store[CANON].length === 1, `canonical write key has 1 item (got ${JSON.stringify(store[CANON])})`)
ok(store[CANON] && store[CANON][0].ruleId === 'WR001', 'written ruleId WR001')
ok(!(LEGACY in store) || store[LEGACY].length === 0, 'legacy key not freshly written')

// ── A2: legacy migration on read (world-rules list) ────────────────────────
store = {}
store[LEGACY] = [{ ruleId: 'WR777', title: 'Legacy', category: 'mindset', savedAt: 1 }]
const list = load('pages/world-rules/world-rules.js')
const lst = Object.assign({ data: {}, setData(o) { Object.assign(this.data, o) }, _readSet: new Set() }, list)
list._loadFavoritesLocal.call(lst)
ok(Array.isArray(store[CANON]) && store[CANON].length === 1 && store[CANON][0].ruleId === 'WR777', `migration copied legacy -> canonical (${JSON.stringify(store[CANON])})`)
ok(store[LEGACY] && store[LEGACY].length === 1, 'legacy key NOT deleted')

// ── A3: canonical takes precedence when both exist ─────────────────────────
store = {}
store[LEGACY] = [{ ruleId: 'OLD', title: 'x', savedAt: 1 }]
store[CANON] = [{ ruleId: 'NEW', title: 'y', savedAt: 2 }]
const list2 = load('pages/world-rules/world-rules.js')
const lst2 = Object.assign({ data: {}, setData(o) { Object.assign(this.data, o) }, _readSet: new Set() }, list2)
list2._loadFavoritesLocal.call(lst2)
ok(store[CANON].length === 1 && store[CANON][0].ruleId === 'NEW', 'canonical precedence over legacy')

console.log(`\nWORLD_RULE_KEY_TEST pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
