#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/memory-runtime-wiring.test.js
 *
 * RC8_9_MEMORY_ENGINE_RUNTIME_WIRING — 记忆开关 actually gates the deployed
 * read/write path; CLEAR is memory-domain only; privacy-safe observability.
 *
 *  A  enabled=true  → getRelevantMemories returns durable items
 *  B  enabled=false → getRelevantMemories returns [] (no read)
 *  C  disable with existing memory → memory retained (no delete)
 *  D  re-enable → retained memory available again
 *  F  cross-user → only current openid read
 *  G  retrieval failure → [] empty fallback (no throw)
 *  I  write policy → non-durable (small talk) not persisted
 *  J  duplicate memory → not added twice (dedup)
 *  E/clear → returns deleted counts; only memory collections targeted
 *  S  source invariants (coaching read/write gate ordering + telemetry)
 *
 * Logic + source-asset only. No network / device claim.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const LIB = path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib')
const INDEX = path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'index.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_9_MEMORY_ENGINE_RUNTIME_WIRING')

// ── in-memory fake DB ──
function makeStore () { return {} }
function makeFakeDb (store, opts) {
  const o = opts || {}
  function col (name) {
    store[name] = store[name] || []
    const docs = store[name]
    const q = {
      _w: null,
      where (w) { q._w = w; return q },
      orderBy () { return q },
      limit () { return q },
      async get () {
        if (o.failOn && name === o.failOn) throw new Error('simulated read failure')
        const w = q._w || {}
        return { data: docs.filter((d) => Object.keys(w).every((k) => d[k] === w[k])) }
      },
      doc (id) {
        return { async update ({ data }) { const d = docs.find((x) => x._id === id); if (d) Object.assign(d, data); return { stats: { updated: d ? 1 : 0 } } } }
      },
      async add ({ data }) { const _id = name + '_' + (docs.length + 1); docs.push(Object.assign({ _id }, data)); return { _id } },
      async remove () {
        if (o.failOn && name === o.failOn) throw new Error('simulated remove failure')
        const w = q._w || {}
        const before = docs.length
        for (let i = docs.length - 1; i >= 0; i--) { if (Object.keys(w).every((k) => docs[i][k] === w[k])) docs.splice(i, 1) }
        return { stats: { removed: before - docs.length } }
      },
    }
    return q
  }
  return { collection: col }
}

function loadEngine (store, opts) {
  const fakeSdk = { init () {}, DYNAMIC_CURRENT_ENV: 'test', database: () => makeFakeDb(store, opts), getWXContext: () => ({ OPENID: 'x' }) }
  const code = fs.readFileSync(path.join(LIB, 'memoryEngine.js'), 'utf8')
  const mod = { exports: {} }
  const sandbox = {
    require: (id) => {
      if (id === 'wx-server-sdk') return fakeSdk
      if (id.startsWith('.')) return require(path.resolve(LIB, id))
      return require(id)
    },
    module: mod, exports: mod.exports,
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise, Set, isNaN,
    setTimeout: () => 0, clearTimeout: () => {},
  }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox, { filename: path.join(LIB, 'memoryEngine.js') })
  return mod.exports
}

const OPENID = 'oZa463Yb2VY0k9Es_pGzdHFtigNo'

;(async () => {
  // ── A: enabled → returns items ──
  {
    const store = makeStore()
    store.user_memory = [{ _id: 'um1', openid: OPENID, memoryEnabled: true, coreGoals: ['搞副业月入过万'], stableTraits: ['概率思维'] }]
    const eng = loadEngine(store)
    const items = await eng.getRelevantMemories(OPENID, OPENID, 'coaching', { limit: 10 })
    ok(items.length >= 2, 'A: returns durable memory items')
    ok(items.some((i) => i.type === 'goal' && /副业/.test(i.content)), 'A: goal present')
  }
  // ── B: disabled → [] ──
  {
    const store = makeStore()
    store.user_memory = [{ _id: 'um1', openid: OPENID, memoryEnabled: false, coreGoals: ['搞副业月入过万'] }]
    const eng = loadEngine(store)
    const items = await eng.getRelevantMemories(OPENID, OPENID, 'coaching', { limit: 10 })
    eq(items.length, 0, 'B: memoryEnabled=false → no read (empty)')
  }
  // ── C/D: disable retains; re-enable restores ──
  {
    const store = makeStore()
    store.user_memory = [{ _id: 'um1', openid: OPENID, memoryEnabled: true, coreGoals: ['长期目标A'] }]
    const eng = loadEngine(store)
    await eng.toggleMemory(OPENID, false)
    eq(store.user_memory[0].memoryEnabled, false, 'C: toggled off')
    ok((store.user_memory[0].coreGoals || []).length === 1, 'C: existing memory retained on off')
    const off = await eng.getRelevantMemories(OPENID, OPENID, 'coaching', {})
    eq(off.length, 0, 'C: off → no read')
    await eng.toggleMemory(OPENID, true)
    const on = await eng.getRelevantMemories(OPENID, OPENID, 'coaching', {})
    ok(on.length === 1, 'D: re-enable → retained memory available again')
  }
  // ── F: cross-user ──
  {
    const store = makeStore()
    store.user_memory = [
      { _id: 'a', openid: 'USER_A', memoryEnabled: true, coreGoals: ['A目标'] },
      { _id: 'b', openid: 'USER_B', memoryEnabled: true, coreGoals: ['B目标'] },
    ]
    const eng = loadEngine(store)
    const a = await eng.getRelevantMemories('USER_A', 'USER_A', 'coaching', {})
    ok(a.every((i) => i.content !== 'B目标'), 'F: no cross-user read (A cannot see B)')
    ok(a.some((i) => i.content === 'A目标'), 'F: own memory visible')
  }
  // ── G: retrieval failure → empty ──
  {
    const store = makeStore()
    store.user_memory = [{ _id: 'um1', openid: OPENID, memoryEnabled: true, coreGoals: ['X'] }]
    const eng = loadEngine(store, { failOn: 'user_memory' })
    let threw = false, items
    try { items = await eng.getRelevantMemories(OPENID, OPENID, 'coaching', {}) } catch (e) { threw = true }
    ok(!threw, 'G: no throw on retrieval failure')
    eq(items.length, 0, 'G: empty fallback on failure')
  }
  // ── I/J: write policy + dedup ──
  {
    const store = makeStore()
    store.user_memory = [{ _id: 'um1', openid: OPENID, memoryEnabled: true, coreGoals: ['搞副业月入过万'] }]
    const eng = loadEngine(store)
    // dedup: adding same goal again does not duplicate
    await eng.updateUserMemory(OPENID, { collection: 'user_memory', coreGoals: ['搞副业月入过万'] })
    eq(store.user_memory[0].coreGoals.length, 1, 'J: duplicate goal not added')
    // new distinct goal appended (bounded)
    await eng.updateUserMemory(OPENID, { collection: 'user_memory', coreGoals: ['学一门技能'] })
    eq(store.user_memory[0].coreGoals.length, 2, 'J: distinct goal added')
    // policy rejects small talk (source-level via extractor)
    const { extractFromMessage } = require(path.join(LIB, 'memoryExtractor.js'))
    eq(extractFromMessage(OPENID, { role: 'user', content: '你好' }), null, 'I: small talk rejected by policy')
  }
  // ── E: clear returns deleted counts; memory collections only ──
  {
    const store = makeStore()
    store.user_memory = [{ _id: 'um1', openid: OPENID, memoryEnabled: true }]
    store.conversation_memory = [{ _id: 'cm1', openid: OPENID, recentMessages: [] }]
    store.challenge_records = [{ _id: 'cr1', openid: OPENID }]
    store.ai_reports = [{ _id: 'ar1', openid: OPENID }]
    const eng = loadEngine(store)
    const r = await eng.clearUserMemory(OPENID)
    eq(r.code, 0, 'E: clear ok')
    ok(r.data && typeof r.data.total === 'number', 'E: returns deleted counts')
    eq((store.challenge_records || []).length, 1, 'E: challenge_records preserved')
    eq((store.ai_reports || []).length, 1, 'E: ai_reports preserved')
    eq((store.user_memory || []).length, 0, 'E: user_memory cleared')
  }

  // ── S: source invariants ──
  {
    const idx = fs.readFileSync(INDEX, 'utf8')
    // RC8_10A — the read gate is CENTRAL: index checks memoryEngine.isMemoryEnabled
    // BEFORE the grounded turn; the retrieval gate lives in getRelevantMemories.
    const engSrc = fs.readFileSync(path.join(LIB, 'memoryEngine.js'), 'utf8')
    const readGateFn = (engSrc.split('async function getRelevantMemories')[1] || '').split('// ──')[0]
    ok(/memoryEngine\.isMemoryEnabled\(openid\)/.test(idx), 'S1: index checks memoryEngine.isMemoryEnabled')
    ok(readGateFn.indexOf('isMemoryEnabled') < readGateFn.indexOf('getUserMemory'), 'S2: retrieval read gate BEFORE load')
    ok(/memory_read_skipped_disabled/.test(idx), 'S3: read skip telemetry')
    const writeFn = (idx.split('async function _writeLongTermMemory')[1] || '').split('exports.main')[0]
    ok(/isMemoryEnabled\(openid\)/.test(writeFn), 'S4: write path checks isMemoryEnabled')
    ok(/extractFromMessage/.test(writeFn), 'S5: write path applies extractor policy')
    ok(/updateUserMemory/.test(writeFn), 'S6: write path persists approved memory')
    ok(/memory_write_skipped_disabled/.test(writeFn), 'S7: write skip telemetry')
    // write happens only AFTER successful AI call
    const afterSuccess = idx.indexOf('_writeLongTermMemory(openid, promptInput)')
    const successGuard = idx.indexOf('if (!turn.ok || !aiResult || !aiResult.success) return fail')
    ok(successGuard >= 0 && afterSuccess > successGuard, 'S8: write called only after AI success')
    // observability events
    for (const ev of ['memory_read_attempt', 'memory_read_skipped_disabled', 'memory_read_success', 'memory_write_attempt', 'memory_write_skipped_disabled', 'memory_write_success', 'memory_operation_fail']) {
      ok(idx.indexOf(ev) >= 0, 'S9: telemetry event present: ' + ev)
    }
    // privacy: telemetry never logs memory content
    ok(!/_memTelemetry\([^)]*content/i.test(idx), 'S10: telemetry does not log memory content')
    // clearMemory returns deleted counts
    const eng = fs.readFileSync(path.join(LIB, 'memoryEngine.js'), 'utf8')
    ok(/deleted\[col\] = n/.test(eng), 'S11: clear tracks per-collection deleted counts')
    ok(/getRelevantMemories/.test(eng), 'S12: getRelevantMemories implemented')
  }

  console.log(`  _TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
