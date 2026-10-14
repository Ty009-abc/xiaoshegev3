#!/usr/bin/env node
'use strict'
/**
 * rc814-staging/staging-infra/init-staging-deps.js — RC8_14 dependency initializer
 *
 * Brings a STAGING env up to the minimal dependency set required by the 3 challenge
 * business functions (getChallengeEvent / startChallenge / submitChallengeChoice)
 * plus their bundled lib/ + common/ deps, so the real C1–C10 run can execute.
 *
 * WHY: startChallenge L122 does `db.collection('users').where({openid})`; on a
 * fresh staging env that collection does not exist → CloudBase error -502005
 * "Table not exist: users" → surfaced to the client as code 4001 (DB_ERROR).
 *
 * GUARANTEES (fail-closed)
 *   - refuses unless STAGING_ENV_ID is set, != prod, and in STAGING_ALLOWLIST
 *   - every tcb call passes `-e <env>` explicitly (never the implicit default)
 *   - ADDITIVE + IDEMPOTENT: create-if-absent collections / indexes / synthetic users
 *   - NEVER drops or clears a collection, NEVER overwrites existing docs data
 *   - synthetic users are derived from the ACTUAL challenge_records fixtures that
 *     carry a `_fixture` marker (openids are read from the DB, never guessed)
 *   - NEVER copies a production user/order; NEVER grants membership/entitlement
 *
 * Usage:
 *   STAGING_ENV_ID=fanshen002-d9g0rjr3b6e313af5 \
 *   STAGING_ALLOWLIST=fanshen002-d9g0rjr3b6e313af5 \
 *   DEPS_CONFIRM=fanshen002-d9g0rjr3b6e313af5 \
 *   node rc814-staging/staging-infra/init-staging-deps.js
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const PROD = 'fanshex-d2g0adgv7dfbc9bdc'
const ENV = process.env.STAGING_ENV_ID || ''
const ALLOW = (process.env.STAGING_ALLOWLIST || '').split(',').map(s => s.trim()).filter(Boolean)
const CONFIRM = process.env.DEPS_CONFIRM || ''
const TCB = process.env.TCB_BIN || 'tcb'
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, 'STAGING-DEPENDENCY-MANIFEST.json'), 'utf8'))

const created = { collections: [], indexes: [], users: [] }
const skipped = { collections: [], indexes: [], users: [] }

const fail = (m) => { console.error('[init-deps] FAIL: ' + m); process.exit(1) }
const log = (...a) => console.log('[init-deps]', ...a)

// ---- guards (fail-closed) ----
if (!ENV) fail('STAGING_ENV_ID unset (implicit default forbidden)')
if (ENV === PROD || ENV.includes(PROD)) fail('target is/contains PRODUCTION — refused')
if (!ALLOW.length) fail('STAGING_ALLOWLIST unset')
if (!ALLOW.includes(ENV)) fail('target not in allowlist')
if (CONFIRM !== ENV) fail('DEPS_CONFIRM must equal STAGING_ENV_ID')

function tcb (arr) {
  return execFileSync(TCB, arr.concat(['-e', ENV]), { encoding: 'utf8' })
}
function jsonArr (out) {
  const a = out.indexOf('['), b = out.lastIndexOf(']')
  if (a < 0 || b < a) return null
  try { return JSON.parse(out.slice(a, b + 1)) } catch (_) { return null }
}
function nosql (coll, commandObj) {
  const payload = [{ TableName: coll, CommandType: 'COMMAND', Command: JSON.stringify(commandObj) }]
  return tcb(['db', 'nosql', 'execute', '--command', JSON.stringify(payload)])
}
function listCollections () {
  const out = nosql('$cmd', { listCollections: 1, nameOnly: true })
  const arr = jsonArr(out) || []
  return new Set(arr.map(c => c.name))
}
function listIndexNames (coll) {
  let out
  try { out = nosql(coll, { listIndexes: coll }) } catch (_) { return new Set() }
  const arr = jsonArr(out) || []
  return new Set(arr.map(i => i.name))
}
function findDocs (coll, filter, limit) {
  const out = nosql(coll, { find: coll, filter: filter || {}, limit: limit || 100 })
  return jsonArr(out) || []
}

// ---- 1) collections ----
function ensureCollections () {
  const have = listCollections()
  for (const c of MANIFEST.collections) {
    if (have.has(c.name)) { skipped.collections.push(c.name); continue }
    // additive create only — never a drop/clear
    const out = nosql(c.name, { create: c.name })
    if (!/ok|operationTime|"n"/.test(out)) fail('create collection failed for ' + c.name + ': ' + out.slice(-160))
    // verify
    if (!listCollections().has(c.name)) fail('collection ' + c.name + ' not readable after create')
    created.collections.push(c.name)
    log('created collection:', c.name)
  }
}

// ---- 2) indexes ----
function ensureIndexes () {
  for (const idx of MANIFEST.indexes) {
    const names = listIndexNames(idx.collection)
    if (names.has(idx.name)) { skipped.indexes.push(idx.collection + '.' + idx.name); continue }
    const spec = { createIndexes: idx.collection, indexes: [{ key: idx.keys, name: idx.name, unique: !!idx.unique }] }
    const out = nosql(idx.collection, spec)
    if (!/ok|operationTime/.test(out)) fail('createIndex failed ' + idx.collection + '.' + idx.name + ': ' + out.slice(-160))
    created.indexes.push(idx.collection + '.' + idx.name)
    log('created index:', idx.collection + '.' + idx.name)
  }
}

// ---- 3) synthetic users (derived from ACTUAL fixtures) ----
function syntheticDoc (openid, fixture, ts) {
  return {
    openid,
    unionid: '',
    nickname: 'STG ' + fixture,
    avatarUrl: '',
    gender: 0, city: '', province: '', country: '',
    phone: '', email: '',
    cv: 0, level: 1, exp: 0,
    // free tier — NO membership, NO entitlement is granted here
    membershipLevel: 'free',
    membershipExpiredAt: null,
    freeAiCount: 3, dailyAiUsed: 0, dailyInsightRead: false,
    lastLoginAt: ts, lastActiveAt: ts,
    status: 'active',
    createdAt: ts, updatedAt: ts,
    _synthetic: true,
    _source: 'rc8.14 init-staging-deps (derived from challenge_records fixture "' + fixture + '")',
  }
}
function ensureSyntheticUsers () {
  const ts = Date.now()
  // read the fixture docs from the DB — openids are authoritative, never guessed
  const fixtures = findDocs('challenge_records', {}, 200).filter(d => d && d._fixture && d.openid)
  if (!fixtures.length) fail('no challenge_records fixtures with `_fixture` marker found — import first')
  // dedupe by openid (some records may share a synthetic identity)
  const byOpenid = new Map()
  for (const d of fixtures) if (!byOpenid.has(d.openid)) byOpenid.set(d.openid, d._fixture)
  log('derived ' + byOpenid.size + ' synthetic identities from ' + fixtures.length + ' fixture docs')
  for (const [openid, fixture] of byOpenid) {
    const existing = findDocs('users', { openid }, 1)
    if (existing.length) { skipped.users.push(openid); continue }
    const out = nosql('users', { insert: 'users', documents: [syntheticDoc(openid, fixture, ts)] })
    if (!/ok|operationTime|"n"/.test(out)) fail('insert synthetic user failed for ' + openid + ': ' + out.slice(-160))
    created.users.push(openid)
    log('created synthetic free user for fixture "' + fixture + '"')
  }
}

log('target=' + ENV + ' (isolated staging; prod ' + PROD + ' refused)')
ensureCollections()
ensureIndexes()
ensureSyntheticUsers()

log('RESULT: collections +' + created.collections.length + ' / indexes +' + created.indexes.length + ' / users +' + created.users.length +
    ' (skipped ' + skipped.collections.length + '/' + skipped.indexes.length + '/' + skipped.users.length + ')')
// local-only summary (may list synthetic openids) — written to the git-ignored local dir
const localDir = path.join(__dirname, 'test-client', 'local')
fs.mkdirSync(localDir, { recursive: true })
fs.writeFileSync(path.join(localDir, 'init-deps-last.local.json'), JSON.stringify({
  manifestVersion: MANIFEST.manifestVersion, env: ENV, at: new Date().toISOString(), created, skipped,
}, null, 2))
log('DONE (idempotent — re-run creates nothing new)')
process.exit(0)
