/**
 * tests/regression/world-rule-fixtures-regression.test.js
 *
 * World Rule Fixture 回归测试。
 */

const NWC = require('../../contracts/world-rule/normalizedWorldRule.contract.js')

let passed = 0; let failed = 0; const failures = []
function test(n, fn) { try { fn(); passed++ } catch(e) { failed++; failures.push(`${n}: ${e.message}`) } }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed') }

// Positive fixtures
const positiveFixtures = [
  '../fixtures/world-rules/season1-standard.json',
  '../fixtures/world-rules/season5-mechanism.json',
  '../fixtures/world-rules/information-network.json',
]

for (const f of positiveFixtures) {
  const fx = require(f)
  const rules = fx.rules || []
  for (const rule of rules) {
    test(`valid world rule: ${rule.id || rule.title}`, () => {
      const r = NWC.validateNormalizedWorldRule(rule)
      assert(r.ok, `${rule.id || rule.title}: ${r.errors.join('; ')}`)
    })
  }
}

// Negative fixtures
const negFixtures = [
  '../fixtures/world-rules/missing-underlying-logic.json',
  '../fixtures/world-rules/missing-reverse-logic.json',
]

for (const f of negFixtures) {
  const fx = require(f)
  const rules = fx.rules || []
  for (const rule of rules) {
    test(`invalid world rule: ${rule.id}`, () => {
      const r = NWC.validateNormalizedWorldRule(rule)
      assert(!r.ok, `${rule.id}: expected failure, got ok with ${r.errors.length} errors`)
    })
  }
}

console.log(`\nWorld Rule Fixture Regression: ${passed} passed, ${failed} failed`)
if (failed > 0) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1) }
else { console.log('ALL WORLD RULE FIXTURE REGRESSION TESTS PASSED'); process.exit(0) }
