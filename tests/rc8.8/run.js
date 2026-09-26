#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.8/run.js — RC8.8 maintained regression runner.
 *
 * Runs every versioned RC8.8 regression in a fixed order and exits non-zero on
 * the first failure. Runnable from repo root:  node tests/rc8.8/run.js
 *
 * Covers:
 *   A  world-rule favorite canonical key + migration
 *   B  cognition strike route (home == result, latest experience)
 *   C  cognition strike records page
 *   D  challenge records page + route
 *   E  report history persistence / list / count
 */

const { spawnSync } = require('child_process')
const path = require('path')

const TESTS = [
  'world-rule-favorite.test.js',
  'cognition-strike-records.test.js',
  'challenge-records.test.js',
  'report-history.test.js',
  'cognition-route.test.js',
]

const results = []
for (const t of TESTS) {
  const abs = path.join(__dirname, t)
  const r = spawnSync(process.execPath, [abs], { encoding: 'utf8' })
  const out = (r.stdout || '') + (r.stderr || '')
  const line = out.split('\n').map((l) => l.trim()).filter((l) => /_TEST pass=|_TEST pass=|pass=\d+/.test(l)).pop() || ''
  const ok = r.status === 0
  results.push({ t, ok, line })
  console.log(`${ok ? '✓' : '✗'} ${t}  ${line}`)
}

const failed = results.filter((r) => !r.ok)
console.log(`\nRC8.8 REGRESSION SET: ${failed.length ? 'FAIL' : 'PASS'} (${results.length - failed.length}/${results.length})`)
process.exit(failed.length ? 1 : 0)
