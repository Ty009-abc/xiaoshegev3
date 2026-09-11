'use strict'
/**
 * tests/v6/shadow/run.js — B2.5 production wiring-prep test runner.
 */

const h = require('../_harness.js')

h.reset()
Promise.resolve(require('./rc8.4-v6-shadow-wiring.test.js').run()).then(() => {
  console.log('\n══════════════════════════════════════')
  console.log(process.exitCode ? 'B2.5 SHADOW WIRING SUITE: FAIL' : 'B2.5 SHADOW WIRING SUITE: PASS')
  console.log('══════════════════════════════════════')
})
