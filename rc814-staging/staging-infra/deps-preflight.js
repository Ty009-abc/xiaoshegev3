#!/usr/bin/env node
'use strict'
/**
 * rc814-staging/staging-infra/deps-preflight.js — RC8_14 dependency preflight (READ-ONLY)
 *
 * Asserts (never writes) that the STAGING env satisfies the minimal dependency
 * set the 3 challenge functions need, per STAGING-DEPENDENCY-MANIFEST.json:
 *   - every required collection exists
 *   - every required index exists
 *   - every challenge_records fixture has a matching synthetic `users` doc
 *
 * Fail-closed: refuses unless STAGING_ENV_ID is set, != prod, in allowlist.
 * Read-only: only listCollections / listIndexes / find. No create/insert/update.
 *
 * Exit 0 = dependencies ready. Non-zero = missing dependency (blocks C1–C10).
 *
 * Usage:
 *   STAGING_ENV_ID=fanshen002-d9g0rjr3b6e313af5 \
 *   STAGING_ALLOWLIST=fanshen002-d9g0rjr3b6e313af5 \
 *   node rc814-staging/staging-infra/deps-preflight.js
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const PROD = 'fanshex-d2g0adgv7dfbc9bdc'
const ENV = process.env.STAGING_ENV_ID || ''
const ALLOW = (process.env.STAGING_ALLOWLIST || '').split(',').map(s => s.trim()).filter(Boolean)
const TCB = process.env.TCB_BIN || 'tcb'
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, 'STAGING-DEPENDENCY-MANIFEST.json'), 'utf8'))

const fail = (m) => { console.error('[deps-preflight] FAIL: ' + m); process.exit(1) }

if (!ENV) fail('STAGING_ENV_ID unset (implicit default forbidden)')
if (ENV === PROD || ENV.includes(PROD)) fail('target is/contains PRODUCTION — refused')
if (!ALLOW.length) fail('STAGING_ALLOWLIST unset')
if (!ALLOW.includes(ENV)) fail('target not in allowlist')

function nosql (coll, commandObj) {
  const payload = [{ TableName: coll, CommandType: 'COMMAND', Command: JSON.stringify(commandObj) }]
  return execFileSync(TCB, ['db', 'nosql', 'execute', '--command', JSON.stringify(payload), '-e', ENV], { encoding: 'utf8' })
}
function jsonArr (out) {
  const a = out.indexOf('['), b = out.lastIndexOf(']')
  if (a < 0 || b < a) return null
  try { return JSON.parse(out.slice(a, b + 1)) } catch (_) { return null }
}

const missing = []

// 1) collections
const cols = new Set(((jsonArr(nosql('$cmd', { listCollections: 1, nameOnly: true })) || [])).map(c => c.name))
for (const c of MANIFEST.collections) if (!cols.has(c.name)) missing.push('collection:' + c.name)

// 2) indexes
for (const idx of MANIFEST.indexes) {
  const names = new Set(((jsonArr(nosql(idx.collection, { listIndexes: idx.collection })) || [])).map(i => i.name))
  if (!names.has(idx.name)) missing.push('index:' + idx.collection + '.' + idx.name)
}

// 3) synthetic users for every fixture openid (if fixtures exist)
try {
  const fixtures = (jsonArr(nosql('challenge_records', { find: 'challenge_records', filter: {}, limit: 200 })) || [])
    .filter(d => d && d._fixture && d.openid)
  const need = new Set(fixtures.map(d => d.openid))
  const users = (jsonArr(nosql('users', { find: 'users', filter: {}, limit: 500 })) || [])
  const have = new Set(users.map(u => u.openid))
  for (const o of need) if (!have.has(o)) missing.push('synthetic-user:' + o)
} catch (e) {
  missing.push('fixture/user scan error: ' + e.message)
}

if (missing.length) fail('missing dependencies → ' + missing.join(', '))
console.log('[deps-preflight] OK: ' + ENV + ' has all ' + MANIFEST.collections.length +
  ' collections, ' + MANIFEST.indexes.length + ' indexes, and synthetic users for every fixture')
