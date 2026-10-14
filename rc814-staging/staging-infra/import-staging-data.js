#!/usr/bin/env node
'use strict'
/**
 * rc814-staging/staging-infra/import-staging-data.js — RC8_14 R-2 (staging-only import)
 * Imports the prepared 34-event bank (challenge_events) + synthetic fixtures (challenge_records).
 * Fail-closed: explicit staging envId, allowlist, prod rejection. Additive only (no delete/drop).
 * Idempotent: skips _ids that already exist. Candidates keep _stagingMeta TEST_ONLY marking.
 * Usage: STAGING_ENV_ID=... STAGING_ALLOWLIST=... IMPORT_CONFIRM=<env> node import-staging-data.js
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const PROD = 'fanshex-d2g0adgv7dfbc9bdc'
const ENV = process.env.STAGING_ENV_ID || ''
const ALLOW = process.env.STAGING_ALLOWLIST || ''
const CONFIRM = process.env.IMPORT_CONFIRM || ''
const TCB = process.env.TCB_BIN || 'tcb'
const ROOT = path.join(__dirname, '..', '..')

const fail = (m) => { console.error('[import] FAIL: ' + m); process.exit(1) }
if (!ENV) fail('STAGING_ENV_ID unset')
if (ENV === PROD || ENV.includes(PROD)) fail('target is/contains PRODUCTION — refused')
if (!ALLOW) fail('STAGING_ALLOWLIST unset')
if (!(',' + ALLOW + ',').includes(',' + ENV + ',')) fail('target not in allowlist')
if (CONFIRM !== ENV) fail('IMPORT_CONFIRM != target env — refusing real import')

function tcbCmd (arr) {
  const out = execFileSync(TCB, ['db', 'nosql', 'execute', '--command', JSON.stringify(arr), '-e', ENV], { encoding: 'utf8' })
  return out
}
function findDoc (coll, id) {
  const cmd = [{ TableName: coll, CommandType: 'COMMAND', Command: JSON.stringify({ find: coll, filter: { _id: id }, limit: 1 }) }]
  const out = tcbCmd(cmd)
  const a = out.indexOf('['), b = out.lastIndexOf(']')
  if (a < 0 || b < a) fail('find parse error ' + coll + '/' + id)
  return JSON.parse(out.slice(a, b + 1))
}
function insertDocs (coll, docs, label) {
  if (!docs.length) { console.log('  ' + label + ': 0 to insert'); return { inserted: 0 } }
  const cmd = [{ TableName: coll, CommandType: 'COMMAND', Command: JSON.stringify({ insert: coll, documents: docs }) }]
  const out = tcbCmd(cmd)
  if (!/operationTime|"ok"|"n"/.test(out)) fail('insert result unexpected for ' + label + ': ' + out.slice(-200))
  const n = (out.match(/"n":\s*\{\s*"\$numberInt":\s*"(\d+)"/) || [])[1]
  console.log('  ' + label + ': inserted ' + (n != null ? n : docs.length))
  return { inserted: Number(n != null ? n : docs.length) }
}

// ---- load artifacts ----
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'rc814-staging/rc814-batch1/d3/staging-seed-34.json'), 'utf8'))
const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, 'rc814-staging/rc814-batch1/d3/synthetic-legacy-fixtures.json'), 'utf8'))

console.log('[import] target=' + ENV + ' (isolated staging)')
console.log('=== EVENTS -> challenge_events ===')
const toInsert = []
let skipped = 0
for (const ev of seed.events) {
  const id = ev.eventId || ev._id
  if (!id) fail('event missing eventId')
  const existing = findDoc('challenge_events', id)
  if (existing.length > 0) { skipped++; continue }
  const doc = Object.assign({}, ev, { _id: id })
  toInsert.push(doc)
}
const evRes = insertDocs('challenge_events', toInsert, 'events')
console.log('  existed(skipped)=' + skipped + ' inserted=' + evRes.inserted)

console.log('=== FIXTURES -> challenge_records ===')
const recs = []
for (const k of ['recovery', 'unrecoverable', 'finished', 'concurrency', 'membership']) {
  for (const r of (fixtures[k] || [])) recs.push(Object.assign({ _fixture: k }, r))
}
// aiReport fixture is not a challenge_record; keep out of this collection
let rskip = 0
const rToInsert = []
for (const r of recs) {
  const existing = findDoc('challenge_records', r._id)
  if (existing.length > 0) { rskip++; continue }
  rToInsert.push(r)
}
const rRes = insertDocs('challenge_records', rToInsert, 'records')
console.log('  existed(skipped)=' + rskip + ' inserted=' + rRes.inserted)

console.log('[import] DONE')
