#!/usr/bin/env node
'use strict'
/**
 * tools/rc814/verify-client-env.js — PROVE env isolation of a client tree.
 *
 *   node tools/rc814/verify-client-env.js            (verify current tree)
 *   node tools/rc814/verify-client-env.js --target staging
 *
 * Checks (all must pass; any failure => exit 1):
 *   1. config/cloudEnv.generated.js declares the expected target and is sealed.
 *   2. The runtime code contains NO hardcoded envId literal as an `env:` value.
 *   3. A staging tree does NOT contain the production envId (except in comments
 *      of this tooling itself).
 *   4. A production tree does NOT advertise staging as the active target.
 *   5. No production credential material appears anywhere in a staging tree.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const PROD_ID = 'fanshex-d2g0adgv7dfbc9bdc'
const STAGING_ID = 'fanshen002-d9g0rjr3b6e313af5'

/** Client source we consider shippable. cloudfunctions/ is server-side, never shipped. */
const SCAN_DIRS = ['config', 'pages', 'services', 'utils', 'components']
const SCAN_FILES = ['app.js', 'app.json', 'app.wxss', 'project.config.json']

const SKIP_DIRS = new Set(['node_modules', '.git', 'cloudfunctions', 'tools', 'tests', 'rc814-staging'])
const CRED_RE = /(APP_?SECRET|APPKEY|APP_?KEY|MCH_?KEY|API_?KEY|PRIVATE_?KEY)\s*[:=]\s*['"][A-Za-z0-9]{12,}/i

let failures = 0
const out = []
function ok (cond, msg) { out.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++ }

function walk (dir, acc) {
  let ents
  try { ents = fs.readdirSync(dir, { withFileTypes: true }) } catch (e) { return acc }
  for (const e of ents) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue
      walk(path.join(dir, e.name), acc)
    } else if (/\.(js|json|wxml|wxss)$/.test(e.name)) {
      acc.push(path.join(dir, e.name))
    }
  }
  return acc
}

function collect () {
  const files = []
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files)
  for (const f of SCAN_FILES) {
    const p = path.join(ROOT, f)
    if (fs.existsSync(p)) files.push(p)
  }
  return files
}

function main () {
  const argv = process.argv.slice(2)
  const wantIdx = argv.indexOf('--target')
  const expected = wantIdx >= 0 ? argv[wantIdx + 1] : null

  // ── 1. generated target ──
  let gen = null
  try { gen = require(path.join(ROOT, 'config', 'cloudEnv.generated.js')) } catch (e) { gen = null }
  ok(!!gen, 'config/cloudEnv.generated.js is readable')
  ok(!!gen && gen.buildTargetSealed === true, 'build target is sealed')
  ok(!!gen && (gen.buildTarget === 'production' || gen.buildTarget === 'staging'), 'build target is allowlisted')
  if (expected) ok(!!gen && gen.buildTarget === expected, `build target == "${expected}" (got "${gen && gen.buildTarget}")`)

  const target = gen && gen.buildTarget
  const activeId = gen && gen.envId

  // ── 2/3. no hardcoded env: literal in runtime code ──
  const files = collect()
  const hardcoded = []
  const stagingLeaks = []
  const prodLeaks = []
  const credHits = []

  for (const f of files) {
    const rel = path.relative(ROOT, f)
    const src = fs.readFileSync(f, 'utf8')

    // the generated file is ALLOWED to carry exactly one envId
    const isGenerated = rel === path.join('config', 'cloudEnv.generated.js')
    if (!isGenerated) {
      // any `env: '<likely-env-id>'` outside the generated file is a hardcode
      const m = src.match(/env\s*:\s*['"]([a-z0-9][a-z0-9-]{5,60})['"]/g) || []
      for (const hit of m) hardcoded.push(rel + ' :: ' + hit.trim())
    }

    if (target === 'staging' && src.includes(PROD_ID)) prodLeaks.push(rel)
    if (target === 'production' && src.includes(STAGING_ID)) stagingLeaks.push(rel)

    if (target === 'staging' && CRED_RE.test(src)) credHits.push(rel)
  }

  ok(hardcoded.length === 0, 'no hardcoded env id literal in runtime client code (' + hardcoded.length + ' found)')
  for (const h of hardcoded.slice(0, 8)) out.push('     -> ' + h)

  if (target === 'staging') {
    ok(prodLeaks.length === 0, 'STAGING tree contains NO production envId (' + prodLeaks.length + ' files)')
    for (const p of prodLeaks.slice(0, 8)) out.push('     -> ' + p)
    ok(credHits.length === 0, 'STAGING tree contains NO production credentials (' + credHits.length + ' files)')
    for (const c of credHits.slice(0, 8)) out.push('     -> ' + c)
    ok(activeId !== PROD_ID, 'active envId is not the production env')
  }

  if (target === 'production') {
    ok(stagingLeaks.length === 0, 'PRODUCTION tree does not reference the staging env (' + stagingLeaks.length + ' files)')
    for (const s of stagingLeaks.slice(0, 8)) out.push('     -> ' + s)
    ok(activeId === PROD_ID, 'active envId is the production env')
  }

  // ── 4. resolver contract is fail-closed ──
  const resolver = fs.readFileSync(path.join(ROOT, 'config', 'cloudEnv.js'), 'utf8')
  ok(/CLOUD_ENV_UNRESOLVED/.test(resolver), 'resolver defines CLOUD_ENV_UNRESOLVED (fail-closed error)')
  ok(/throw _fail\(/.test(resolver), 'resolver throws instead of falling back')
  ok(!new RegExp(PROD_ID).test(resolver) && !new RegExp(STAGING_ID).test(resolver), 'resolver carries no env id literal')

  // ── 5. app.js must not call wx.cloud.init with a literal ──
  const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8')
  const initBlock = appJs.match(/wx\.cloud\.init\s*\(\s*\{[\s\S]{0,200}?\}\s*\)/) || ['<no init block>']
  ok(!/env\s*:\s*['"]/.test(initBlock[0]), 'app.js wx.cloud.init() passes a resolved env, not a literal')
  ok(/resolveCloudEnv/.test(appJs), 'app.js calls the resolver')

  console.log(out.join('\n'))
  console.log('\nTARGET: ' + String(target))
  console.log(failures === 0 ? 'CLIENT_ENV_ISOLATION: PASS' : 'CLIENT_ENV_ISOLATION: FAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}

main()
