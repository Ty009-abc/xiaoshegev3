/**
 * tests/regression/poster-data-regression.test.js
 *
 * 海报数据回归测试 — 所有海报 fixture 通过 Poster Contract。
 */

const TPC = require('../../contracts/report/turnaroundPoster.contract.js')
const WRP = require('../../contracts/world-rule/worldRulePoster.contract.js')
const PEC = require('../../contracts/poster/posterExport.contract.js')

let passed = 0; let failed = 0; const failures = []
function test(n, fn) { try { fn(); passed++ } catch(e) { failed++; failures.push(`${n}: ${e.message}`) } }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed') }

// Report poster
const rp = require('../fixtures/posters/report-poster-valid.json')
test('report poster contract', () => {
  const r = TPC.validateTurnaroundPoster(rp.poster)
  assert(r.ok, r.errors.join('; '))
})
test('report poster export', () => {
  const r = PEC.validatePosterExport(rp.poster)
  assert(r.ok, r.errors.join('; '))
})

// World rule poster
const wp = require('../fixtures/posters/world-rule-poster-valid.json')
test('world rule poster contract', () => {
  const r = WRP.validateWorldRulePoster(wp.poster)
  assert(r.ok, r.errors.join('; '))
})
test('world rule poster export', () => {
  const r = PEC.validatePosterExport(wp.poster)
  assert(r.ok, r.errors.join('; '))
})

// Cognitive strike poster
const cp = require('../fixtures/posters/cognitive-strike-poster-valid.json')
test('cognitive strike poster export', () => {
  const r = PEC.validatePosterExport(cp.poster)
  assert(r.ok, r.errors.join('; '))
})

// Missing fields in poster
test('missing verdict in poster', () => {
  const r = TPC.validateTurnaroundPoster({ contradiction:{code:'X',title:'T',description:'D'},potential:{score:50,level:'m',advantages:[],constraints:[]},decision:{code:'D',title:'T',reason:'R'},primaryAction:{title:'A',checkpoint:'C',successCriteria:[]} })
  assert(!r.ok, 'missing verdict should fail')
})

console.log(`\nPoster Data Regression: ${passed} passed, ${failed} failed`)
if (failed > 0) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1) }
else { console.log('ALL POSTER DATA REGRESSION TESTS PASSED'); process.exit(0) }
