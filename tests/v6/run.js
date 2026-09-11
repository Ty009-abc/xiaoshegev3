'use strict'
/**
 * tests/v6/run.js — V6 diagnosis kernel test runner.
 * Runs golden, adversarial, integration, mutation, determinism suites.
 * Exits non-zero if any suite fails.
 */

const h = require('./_harness.js')

const suite = (name, mod) => {
  h.reset()
  require(mod)
}

suite('golden', './rc8.4-v6-golden.test.js')
suite('adversarial', './rc8.4-v6-adversarial.test.js')
suite('integration', './rc8.4-v6-integration.test.js')
suite('mutation', './rc8.4-v6-mutation.test.js')
suite('determinism', './rc8.4-v6-determinism.test.js')

console.log('\n══════════════════════════════════════')
if (process.exitCode) {
  console.log('V6 TEST SUITE: FAIL')
} else {
  console.log('V6 TEST SUITE: PASS')
}
console.log('══════════════════════════════════════')
