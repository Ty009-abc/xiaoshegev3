'use strict'
/**
 * tests/v6/report/run.js — V6 report-builder test runner.
 * Runs the five-card report conformance suite.
 */

const h = require('../_harness.js')

h.reset()
require('./rc8.4-v6-report.test.js')

console.log('\n══════════════════════════════════════')
console.log(process.exitCode ? 'V6 REPORT SUITE: FAIL' : 'V6 REPORT SUITE: PASS')
console.log('══════════════════════════════════════')
