#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/run.js — RC8.9 maintained regression runner.
 *
 * Runs every versioned RC8.9 regression in a fixed order and exits non-zero on
 * the first failure. Runnable from repo root:  node tests/rc8.9/run.js
 *
 * Covers:
 *   A  admin console light UI
 *   B  user activity tracking (user_events) + detail + funnel
 *   C  role based access control (server authority, audit, last-super-admin)
 *   D  legacy 6Q report entity persistence + linkage
 */

const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ALL = [
  'admin-ui.test.js',
  'user-tracking.test.js',
  'admin-rbac.test.js',
  'report-entity.test.js',
  'secret-clobber-guard.test.js',
  'ai-telemetry-core.test.js',
  'admin-ai-metrics.test.js',
  'funnel-authority.test.js',
  'payment-signing-foundation.test.js',
  'payment-finalizer.test.js',
  'payment-pem-normalization.test.js',
  'payment-log-resilience.test.js',
  'challenge-report-idempotency.test.js',
  'report-preview-wiring.test.js',
]
// only run tests that exist (so partial batches stay runnable)
const TESTS = ALL.filter((t) => fs.existsSync(path.join(__dirname, t)))

const results = []
for (const t of TESTS) {
  const abs = path.join(__dirname, t)
  const r = spawnSync(process.execPath, [abs], { encoding: 'utf8' })
  const out = (r.stdout || '') + (r.stderr || '')
  const line = out.split('\n').map((l) => l.trim()).filter((l) => /_TEST pass=/.test(l)).pop() || ''
  const ok = r.status === 0
  results.push({ t, ok, line })
  console.log(`${ok ? '✓' : '✗'} ${t}  ${line}`)
  if (!ok) process.stdout.write(out + '\n')
}

const failed = results.filter((r) => !r.ok)
console.log(`\nRC8.9 REGRESSION SET: ${failed.length ? 'FAIL' : 'PASS'} (${results.length - failed.length}/${results.length})`)
process.exit(failed.length ? 1 : 0)
