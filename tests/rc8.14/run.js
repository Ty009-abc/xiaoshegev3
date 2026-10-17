#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.14/run.js — RC8.14 maintained regression runner.
 * node tests/rc8.14/run.js
 */
const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ALL = [
  'plan-authority.test.js',
  'delivery.test.js',
  'completion.test.js',
  'insufficient-pool.test.js',
  'legacy-compatibility.test.js',
  'legacy-recovery-wiring.test.js',
  'plan-persistence.test.js',
  'concurrency-resume.test.js',
  'submit-atomicity.test.js',
  'submit-trial-gate.test.js',
  'submit-authority-closure.test.js',
  'permission-expiry-hardening.test.js',
  'entitlement-writer-fail-closed.test.js',
  'trial-resume-atomic.test.js',
  'active-session-authority.test.js',
  'stale-creator-atomicity.test.js',
  'authority-preserving-creation.test.js',
  'start-mode-authority.test.js',
  'batch3-virtual-payment-security.test.js',
  'delivery-30day.test.js',
  'property.test.js',
]
const dir = __dirname
const results = []
for (const t of ALL.filter((t) => fs.existsSync(path.join(dir, t)))) {
  const r = spawnSync(process.execPath, [path.join(dir, t)], { encoding: 'utf8' })
  const out = (r.stdout || '') + (r.stderr || '')
  const line = out.split('\n').map((l) => l.trim()).filter((l) => /_TEST pass=/.test(l))[0] || ''
  results.push({ t, okRun: r.status === 0 })
  console.log(`${r.status === 0 ? '✓' : '✗'} ${t}  ${line}`)
  if (r.status !== 0) process.stdout.write(out + '\n')
}
const failed = results.filter((r) => !r.okRun)
console.log(`\nRC8.14 REGRESSION SET: ${failed.length ? 'FAIL' : 'PASS'} (${results.length - failed.length}/${results.length})`)
process.exit(failed.length ? 1 : 0)
