'use strict'
/**
 * tests/v6/runtime/run.js — B2.4 isolated runtime-chain test runner.
 */

const h = require('../_harness.js')

h.reset()
require('./rc8.4-v6-runtime.test.js')

console.log('\n══════════════════════════════════════')
console.log(process.exitCode ? 'B2.4 RUNTIME SUITE: FAIL' : 'B2.4 RUNTIME SUITE: PASS')
console.log('══════════════════════════════════════')
