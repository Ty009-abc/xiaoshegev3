'use strict'
/**
 * tests/turnaround6q/run.js — RC8.8 6Q test runner.
 * Runs client-contract, validators, runtime suites. Exits non-zero on failure.
 */

const h = require('./_harness.js')

const suite = (name, mod) => {
  h.reset()
  require(mod)
}

suite('client-contract', './rc8.8-6q-client-contract.test.js')
suite('validators', './rc8.8-6q-validators.test.js')
suite('runtime', './rc8.8-6q-runtime.test.js')
suite('runtime-stabilization', './rc8.8-6q-runtime-stabilization.test.js')

console.log('\n══════════════════════════════════════')
console.log(process.exitCode ? 'RC8.8 6Q TEST SUITE: FAIL' : 'RC8.8 6Q TEST SUITE: PASS')
console.log('══════════════════════════════════════')
