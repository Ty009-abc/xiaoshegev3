#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.11/run.js — RC8.11 maintained regression runner (membership migration).
 * Runnable from repo root:  node tests/rc8.11/run.js
 */
const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ALL = [
  'access-authority.test.js',
  'stage1b.test.js',
  'stage2a.test.js',
  'stage2bc.test.js',
]

const dir = __dirname
const tests = ALL.filter((t) => fs.existsSync(path.join(dir, t)))
const results = []
for (const t of tests) {
  const r = spawnSync(process.execPath, [path.join(dir, t)], { encoding: 'utf8' })
  const out = (r.stdout || '') + (r.stderr || '')
  const line = out.split('\n').map((l) => l.trim()).filter((l) => /_TEST pass=/.test(l))[0] || ''
  const okRun = r.status === 0
  results.push({ t, okRun, line })
  console.log(`${okRun ? '✓' : '✗'} ${t}  ${line}`)
  if (!okRun) process.stdout.write(out + '\n')
}

const failed = results.filter((r) => !r.okRun)
console.log(`\nRC8.11 REGRESSION SET: ${failed.length ? 'FAIL' : 'PASS'} (${results.length - failed.length}/${results.length})`)
process.exit(failed.length ? 1 : 0)
