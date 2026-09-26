'use strict'
/**
 * tests/legacy6q/run.js — RC8.8 Stage2 legacy 6Q revival test runner.
 * Exits non-zero on failure.
 */

require('./legacy6q-revival.test.js')

console.log('\n══════════════════════════════════════')
console.log(process.exitCode ? 'RC8.8 Stage2 LEGACY 6Q REVIVAL: FAIL' : 'RC8.8 Stage2 LEGACY 6Q REVIVAL: PASS')
console.log('══════════════════════════════════════')
