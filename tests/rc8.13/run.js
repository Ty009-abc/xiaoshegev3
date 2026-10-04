#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.13/run.js — RC8.13 maintained regression runner (virtual payment).
 * node tests/rc8.13/run.js
 */
const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ALL = ['virtual-payment.test.js', 'client-wiring.test.js']
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
console.log(`\nRC8.13 REGRESSION SET: ${failed.length ? 'FAIL' : 'PASS'} (${results.length - failed.length}/${results.length})`)
process.exit(failed.length ? 1 : 0)
