/**
 * tests/contracts/poster-export-contract.test.js
 *
 * 测试：海报导出契约 — 尺寸、内容、版本。
 */

const PEC = require('../../contracts/poster/posterExport.contract.js')

let passed = 0; let failed = 0; const failures = []
function test(n, fn) { try { fn(); passed++ } catch(e) { failed++; failures.push(`${n}: ${e.message}`) } }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed') }

test('valid report poster export', () => {
  const r = PEC.validatePosterExport({ verdict:'x', width:750, height:1334, type:'report' })
  assert(r.ok, r.errors.join('; '))
})

test('world rule poster export valid', () => {
  const r = PEC.validatePosterExport({ worldRule:'rule', width:750, height:1334, type:'world-rule' })
  assert(r.ok, r.errors.join('; '))
})

test('1x1 canvas rejected', () => {
  const r = PEC.validatePosterExport({ width:1, height:1, type:'report' })
  assert(!r.ok, '1x1 should fail')
  assert(r.errors.some(e => e.includes('1x1')), 'should mention 1x1')
})

test('10x10 canvas rejected (below minimum)', () => {
  const r = PEC.validatePosterExport({ width:10, height:10, type:'report' })
  assert(!r.ok, '10x10 should fail minimum')
})

test('background-only poster triggers warning', () => {
  const r = PEC.validatePosterExport({ width:750, height:1334, type:'report' })
  assert(r.warnings.length > 0, 'empty poster should warn')
})

test('unknown version triggers warning', () => {
  const r = PEC.validatePosterExport({ verdict:'x', version:'v3', width:750, height:1334, type:'report' })
  assert(r.warnings.some(w => w.includes('version')), 'should warn on old version')
})

console.log(`\nPoster Export Tests: ${passed} passed, ${failed} failed`)
if (failed > 0) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1) }
else { console.log('ALL POSTER EXPORT TESTS PASSED'); process.exit(0) }
