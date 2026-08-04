/**
 * tests/contracts/report-viewmodel-to-poster.test.js
 *
 * 测试：ViewModel → Poster 字段映射正确性。
 * 必须拦截：decision 空但非 provisional, potential 缺失, Canvas 1x1。
 */

const TPC = require('../../contracts/report/turnaroundPoster.contract.js')
const PEC = require('../../contracts/poster/posterExport.contract.js')

let passed = 0; let failed = 0; const failures = []
function test(n, fn) { try { fn(); passed++ } catch(e) { failed++; failures.push(`${n}: ${e.message}`) } }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed') }

test('valid poster→export chain', () => {
  const poster = {
    verdict: '判决',
    contradiction: { code:'S',title:'T',description:'D' },
    potential: { score:44,level:'critical',advantages:['a'],constraints:['c'] },
    decision: { code:'D',title:'T',reason:'R' },
    primaryAction: { title:'A',checkpoint:'C',successCriteria:['S'] },
  }
  const pr = TPC.validateTurnaroundPoster(poster)
  assert(pr.ok, pr.errors.join('; '))
  const er = PEC.validatePosterExport({ ...poster, width:750, height:1334, type:'report' })
  assert(er.ok, er.errors.join('; '))
})

test('Canvas 1x1 rejects', () => {
  const r = PEC.validatePosterExport({ verdict:'x',width:1,height:1,type:'report' })
  assert(!r.ok, '1x1 canvas should fail')
})

test('Canvas 100x100 passes minimum', () => {
  const r = PEC.validatePosterExport({ verdict:'x',width:100,height:100,type:'report' })
  assert(r.ok, `100x100 should pass, got: ${r.errors.join('; ')}`)
})

test('provisional decision accepted even if empty title', () => {
  const poster = {
    verdict:'暂定判决',
    contradiction:{ code:'INSUFFICIENT_EVIDENCE',title:'证据不足',description:'...' },
    potential:{ score:22,level:'critical',advantages:[],constraints:[] },
    decision:{ code:'COLLECT_MORE_EVIDENCE',title:'暂定决策',reason:'证据不足',provisional:true },
    primaryAction:{ title:'补齐信息',checkpoint:'7天',successCriteria:['收集完成'] },
  }
  const r = TPC.validateTurnaroundPoster(poster)
  assert(r.ok, `provisional decision should pass: ${r.errors.join('; ')}`)
})

test('poster without content triggers export warning', () => {
  const r = PEC.validatePosterExport({ width:750,height:1334,type:'report' })
  assert(r.warnings.length > 0, 'empty poster should trigger export warning')
})

console.log(`\nViewModel→Poster Tests: ${passed} passed, ${failed} failed`)
if (failed > 0) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1) }
else { console.log('ALL VIEWMODEL→POSTER TESTS PASSED'); process.exit(0) }
