#!/usr/bin/env node
'use strict'
/**
 * rc814-staging/staging-infra/map-identity.js
 *
 * RC8_14 Part 三.7 — map SYNTHETIC fixtures to a REAL test identity.
 *
 * STAGING-ONLY. Rewrites ONLY the `openid` field of the 9 synthetic
 * `challenge_records` fixtures (STG-REC-01/02, STG-UNREC-01/02, STG-FIN-01/02, STG-CONC-01/02, STG-EXP-01)
 * from the synthetic `test-openid-N@staging.local` placeholders to the tester's REAL openid obtained from a
 * genuine wx.cloud.callFunction('login') in the test client.
 *
 * GUARANTEES
 *  - refuses unless STAGING_ENV_ID is set, != prod, and in STAGING_ALLOWLIST
 *  - refuses to touch any doc that is NOT one of the enumerated synthetic fixture _ids
 *  - refuses to touch prod (explicit env every command; never implicit default)
 *  - NEVER writes the real openid into Git: output goes to a git-ignored local file
 *  - idempotent; additive; never clears/creates collections; never deletes docs
 *
 * The real openid is supplied via env REAL_OPENID (or a local file path REAL_OPENID_FILE).
 * It is a test identity only. Do NOT commit it.
 *
 * Usage:
 *   STAGING_ENV_ID=fanshen002-d9g0rjr3b6e313af5 \
 *   STAGING_ALLOWLIST=fanshen002-d9g0rjr3b6e313af5 \
 *   REAL_OPENID=<real-openid> \
 *   MAP_CONFIRM=fanshen002-d9g0rjr3b6e313af5 \
 *   node rc814-staging/staging-infra/map-identity.js
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const PROD = 'fanshex-d2g0adgv7dfbc9bdc'
const ENV = process.env.STAGING_ENV_ID
const ALLOW = (process.env.STAGING_ALLOWLIST || '').split(',').map(s => s.trim()).filter(Boolean)
const CONFIRM = process.env.MAP_CONFIRM
const TCB = process.env.TCB_BIN || 'tcb'

const FIXTURE_IDS = [
  'STG-REC-01', 'STG-REC-02',
  'STG-UNREC-01', 'STG-UNREC-02',
  'STG-FIN-01', 'STG-FIN-02',
  'STG-CONC-01', 'STG-CONC-02',
  'STG-EXP-01',
]

function die (msg) { console.error('[map-identity] FAIL: ' + msg); process.exit(1) }

// ---- guards (fail-closed) ----
if (!ENV) die('STAGING_ENV_ID unset (implicit default forbidden)')
if (ENV === PROD) die('target == PRODUCTION')
if (!ALLOW.length) die('STAGING_ALLOWLIST unset')
if (!ALLOW.includes(ENV)) die('target not in allowlist')
if (CONFIRM !== ENV) die('MAP_CONFIRM must equal STAGING_ENV_ID')

let REAL = process.env.REAL_OPENID || ''
if (!REAL && process.env.REAL_OPENID_FILE) {
  try { REAL = fs.readFileSync(process.env.REAL_OPENID_FILE, 'utf8').trim() } catch (e) { die('cannot read REAL_OPENID_FILE: ' + e.message) }
}
if (!REAL) die('REAL_OPENID (or REAL_OPENID_FILE) required')
if (/\s/.test(REAL)) die('REAL_OPENID contains whitespace')

function tcbDb (command) {
  // Build JSON via JSON.stringify to avoid shell-escaping bugs.
  const payload = [{ TableName: 'challenge_records', CommandType: 'COMMAND', Command: JSON.stringify(command) }]
  return execFileSync(TCB, ['db', 'nosql', 'execute', '--command', JSON.stringify(payload), '-e', ENV], { encoding: 'utf8' })
}

function main () {
  console.log('[map-identity] env=', ENV, ' fixtures=', FIXTURE_IDS.length, ' real=', REAL.slice(0, 4) + '…' + REAL.slice(-3))
  let updated = 0
  for (const id of FIXTURE_IDS) {
    const find = { find: 'challenge_records', filter: { _id: id }, limit: 1, projection: { _id: 1, openid: 1, _fixture: 1 } }
    const out = tcbDb(find)
    const m = out.match(/\[[\s\S]*\]/)
    let doc = null
    try { doc = m ? JSON.parse(m[0])[0] : null } catch (e) { die('parse fail for ' + id + ': ' + e.message) }
    if (!doc) { console.warn('[map-identity] skip (not found):', id); continue }
    const prev = doc.openid
    const upd = { update: 'challenge_records', updates: [{ q: { _id: id }, u: { $set: { openid: REAL, _identityMappedAt: new Date().toISOString(), _identityMappedFrom: prev } }, upsert: false }] }
    const res = tcbDb(upd)
    if (/error|错误|失败/i.test(res)) die('update failed for ' + id + ': ' + res.slice(0, 200))
    updated++
    console.log('  ✓', id, ':', prev, '→', REAL.slice(0, 4) + '…')
  }
  // Re-read to verify
  console.log('[map-identity] verifying…')
  let ok = 0
  for (const id of FIXTURE_IDS) {
    const out = tcbDb({ find: 'challenge_records', filter: { _id: id }, limit: 1, projection: { _id: 1, openid: 1 } })
    const m = out.match(/\[[\s\S]*\]/)
    let doc = null
    try { doc = m ? JSON.parse(m[0])[0] : null } catch (e) {}
    if (doc && doc.openid === REAL) ok++
    else console.warn('  ✗ not mapped:', id)
  }
  console.log('[map-identity] RESULT: updated=' + updated + ' verified=' + ok + '/' + FIXTURE_IDS.length)
  // Write a LOCAL git-ignored mapping record (NOT committed).
  const rec = path.join(__dirname, 'test-client', 'local')
  fs.mkdirSync(rec, { recursive: true })
  fs.writeFileSync(path.join(rec, 'identity-map.local.json'), JSON.stringify({
    env: ENV, mappedAt: new Date().toISOString(), fixtureIds: FIXTURE_IDS,
    realOpenidFingerprint: REAL.slice(0, 4) + '…' + REAL.slice(-3), updated, verified: ok,
  }, null, 2))
  console.log('[map-identity] mapping fingerprinted to test-client/local/identity-map.local.json (git-ignored)')
  process.exit(0)
}
main()
