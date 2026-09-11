'use strict'
/**
 * tests/v6/_harness.js — minimal dependency-free assert harness for V6 tests.
 * No external test framework. Prints PASS/FAIL and exits non-zero on failure.
 */

let passed = 0
let failed = 0
const failures = []

function reset () { passed = 0; failed = 0; failures.length = 0 }

function ok (cond, msg) {
  if (cond) { passed++; return true }
  failed++
  failures.push(msg)
  return false
}

function eq (actual, expected, msg) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  return ok(a === e, `${msg} — expected ${e}, got ${a}`)
}

function eqAny (actual, expectedSet, msg) {
  const a = JSON.stringify(actual)
  return ok(expectedSet.map(x => JSON.stringify(x)).includes(a), `${msg} — got ${a}, expected one of ${JSON.stringify(expectedSet)}`)
}

function section (name) { console.log(`\n── ${name} ──`) }

function summary (name) {
  console.log(`\n${name}: ${passed} passed, ${failed} failed`)
  if (failed) {
    for (const f of failures) console.log(`  ✗ ${f}`)
    process.exitCode = 1
  }
  return { passed, failed, failures }
}

module.exports = { ok, eq, eqAny, section, summary, reset, get passed () { return passed }, get failed () { return failed } }
