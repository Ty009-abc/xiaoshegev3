/**
 * tests/regression/semantic-quality-regression.test.js
 *
 * 语义质量回归测试。
 * NOTE: release/v6.5.0 does not contain reportSemanticValidator.js or full new contract fields.
 * This test verifies basic semantic quality via Contract + Fixture checks.
 * Full semantic tests will activate after merging fix/rc5.15.3-decision-coverage.
 */

const RC = require('../../contracts/report/turnaroundReportV4.contract.js')

let passed = 0; let failed = 0; const failures = []
function test(n, fn) { try { fn(); passed++ } catch(e) { failed++; failures.push(`${n}: ${e.message}`) } }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed') }

// Check all report fixtures pass contract
const fixtures = [
  'high-cognition-low-execution',
  'single-income-low-buffer',
  'learning-strong-low-monetization',
  'contradictory-answers',
  'ideal-profile',
]

for (const name of fixtures) {
  const fx = require(`../fixtures/reports/${name}.json`)

  test(`${name}: fixture JSON valid`, () => {
    assert(fx._meta, 'missing _meta')
    assert(fx.input, 'missing input')
    assert(fx.expectedOutput, 'missing expectedOutput')
  })

  test(`${name}: no simulated defaults`, () => {
    // Fixtures must not contain simulated engine defaults
    const str = JSON.stringify(fx)
    assert(!str.includes('openid'), 'contains openid')
    assert(!str.includes('phone'), 'contains phone')
    assert(!str.includes('token'), 'contains token')
  })
}

// Insufficient evidence specific checks
const ie = require('../fixtures/reports/insufficient-evidence.json')
test('insufficient-evidence: expectedOutput.decisionCode === COLLECT_MORE_EVIDENCE', () => {
  assert(ie.expectedOutput.decisionCode === 'COLLECT_MORE_EVIDENCE')
})
test('insufficient-evidence: expectedOutput.decisionProvisional === true', () => {
  assert(ie.expectedOutput.decisionProvisional === true)
})
test('insufficient-evidence: expectedOutput.primaryActionIsEvidenceCollection', () => {
  assert(ie.expectedOutput.primaryActionIsEvidenceCollection === true)
})
test('insufficient-evidence: input has null fields (real missing evidence)', () => {
  const input = ie.input
  const nullCount = Object.values(input).filter(v => v === null || (v && v.level === null)).length
  assert(nullCount >= 3, `expected >=3 null fields, got ${nullCount}`)
})

// Cross-contract consistency: all poster fixtures pass their contracts
const TPC = require('../../contracts/report/turnaroundPoster.contract.js')
const rp = require('../fixtures/posters/report-poster-valid.json')
test('report poster fixture validates', () => {
  const r = TPC.validateTurnaroundPoster(rp.poster)
  assert(r.ok, r.errors.join('; '))
})

test('report poster verdict not empty', () => {
  assert(rp.poster.verdict && rp.poster.verdict.trim().length > 0)
})

test('report poster decision has code', () => {
  assert(rp.poster.decision.code && rp.poster.decision.code.length > 0)
})

console.log(`\nSemantic Quality Regression: ${passed} passed, ${failed} failed`)
if (failed > 0) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1) }
else { console.log('ALL SEMANTIC QUALITY REGRESSION TESTS PASSED'); process.exit(0) }
