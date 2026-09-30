#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.10/run.js — RC8.10 maintained regression runner.
 *
 * Covers:
 *   A  userContextBuilder authority (latest 6Q, priority ladder)
 *   B  six scenarios + askXiaoshige share ONE context authority
 *   C  memory switch gates read/write but NOT 6Q personalization
 *   D  grounding validator (occupation / skill / capital / generic)
 */

const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ALL = [
  'context-authority.test.js',
  'golden-cases.test.js',
  'ask-xiaoshige.test.js',
  'personalized-challenge.test.js',
  'raw6q-authority.test.js',
]
const TESTS = ALL.filter((t) => fs.existsSync(path.join(__dirname, t)))

const results = []
for (const t of TESTS) {
  const abs = path.join(__dirname, t)
  const r = spawnSync(process.execPath, [abs], { encoding: 'utf8' })
  const out = (r.stdout || '') + (r.stderr || '')
  const line = out.split('\n').map((l) => l.trim()).filter((l) => /_TEST pass=|fail=/.test(l)).pop() || ''
  const ok = r.status === 0
  results.push({ t, ok, line })
  console.log(`${ok ? '✓' : '✗'} ${t}  ${line}`)
  if (!ok) process.stdout.write(out + '\n')
}

const failed = results.filter((r) => !r.ok)
console.log(`\nRC8.10 REGRESSION SET: ${failed.length ? 'FAIL' : 'PASS'} (${results.length - failed.length}/${results.length})`)
process.exit(failed.length ? 1 : 0)
