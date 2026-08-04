/**
 * tests/contracts/report-contract-to-viewmodel.test.js
 *
 * 测试：Report Contract → ViewModel → Poster 转换完整性。
 * 必须拦截：Old version masquerade, raw object leakage, field rename loss.
 */

const TPC = require('../../contracts/report/turnaroundPoster.contract.js')

let passed = 0
let failed = 0
const failures = []

function test(name, fn) {
  try { fn(); passed++ } catch (e) { failed++; failures.push(`${name}: ${e.message}`) }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed') }

// ── 正常海报 ──
test('valid poster passes contract', () => {
  const poster = {
    verdict: '你已经站在财富跃迁的起跑线上',
    contradiction: { code: 'SINGLE_INCOME_LOW_BUFFER', title: '收入来源单一', description: '单一收入...' },
    potential: { score: 65, level: 'moderate', advantages: ['技能已验证'], constraints: ['时间不足'] },
    decision: { code: 'BUILD_SECOND_INCOME', title: '启动第二收入线', reason: '单一收入风险' },
    primaryAction: { title: '7天内完成可售卖样本', checkpoint: '7天', successCriteria: ['收到反馈'] },
  }
  const r = TPC.validateTurnaroundPoster(poster)
  assert(r.ok, `expected ok, got: ${r.errors.join('; ')}`)
})

// ── 空 decision ──
test('empty decision triggers warning (not error)', () => {
  const poster = {
    verdict: '判决',
    contradiction: { code: 'FALLBACK', title: '', description: '' },
    potential: { score: 50, level: 'moderate', advantages: [], constraints: [] },
    decision: { code: '', title: '[empty]', reason: '' },
    primaryAction: { title: '行动', checkpoint: '7天', successCriteria: [] },
  }
  const r = TPC.validateTurnaroundPoster(poster)
  assert(r.errors.length === 0, 'empty decision should be warning, not error')
  assert(r.warnings.length > 0, 'expected warning for empty decision')
})

// ── verdict 为 null ──
test('null verdict triggers error', () => {
  const poster = {
    verdict: '',
    contradiction: { code: 'X', title: 'T', description: 'D' },
    potential: { score: 50, level: 'moderate', advantages: ['a'], constraints: ['c'] },
    decision: { code: 'D', title: 'T', reason: 'R' },
    primaryAction: { title: 'A', checkpoint: 'C', successCriteria: [] },
  }
  const r = TPC.validateTurnaroundPoster(poster)
  assert(!r.ok, 'empty verdict should fail')
})

// ── NULL 字面值 ──
test('poster with null values triggers warnings', () => {
  const poster = JSON.parse('{"verdict":"x","contradiction":{"code":"X","title":"T","description":"D"},"potential":{"score":50,"level":"moderate","advantages":["a"],"constraints":["c"]},"decision":{"code":"D","title":"T","reason":"R"},"primaryAction":{"title":"A","checkpoint":"C","successCriteria":[]},"unused":null}')
  const r = TPC.validateTurnaroundPoster(poster)
  assert(r.warnings.length > 0, 'expected null value warning')
})

// ── 旧报告冒充 ──
test('v3 report masquerading as v4', () => {
  const poster = {
    verdict: '判决',
    // v3 fields — missing v4 required
    finalStrike: '旧的最终一击',
    coreProblem: '旧的问题',
  }
  const r = TPC.validateTurnaroundPoster(poster)
  assert(!r.ok, 'v3 poster should fail v4 validation (missing required fields)')
})

console.log(`\nViewModel Contract Tests: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('Failures:')
  failures.forEach(f => console.log('  FAIL:', f))
  process.exit(1)
} else {
  console.log('ALL VIEWMODEL CONTRACT TESTS PASSED')
  process.exit(0)
}
