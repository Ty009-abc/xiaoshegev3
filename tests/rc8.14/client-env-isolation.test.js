#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.14/client-env-isolation.test.js — RC814 Phase 1
 *
 * Proves the client env resolver is fail-closed and that a staging build never
 * routes to production. Pure local: no network, no cloud calls, no DB.
 *
 * Covered:
 *   1. generator refuses unknown / missing target without writing
 *   2. resolver throws on: missing file, unknown target, malformed envId, unsealed
 *   3. real app.js onLaunch binds the generated env (not a literal)
 *   4. real app.js onLaunch refuses to init when resolution fails
 *   5. staging tree contains no production envId
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const Module = require('module')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..')
const PROD_ID = 'fanshex-d2g0adgv7dfbc9bdc'
const STAGING_ID = 'fanshen002-d9g0rjr3b6e313af5'

let pass = 0
let fail = 0
function ok (cond, msg) {
  if (cond) { pass++; console.log('  ok   ' + msg) } else { fail++; console.log('  FAIL ' + msg) }
}

/**
 * Load config/cloudEnv.js with a controlled generated module.
 *
 * NOTE: the missing-file simulation must be active while resolveCloudEnv() runs,
 * not only while require() runs — cloudEnv.js defers require('./cloudEnv.generated.js')
 * until resolution. Scoping the hook to require() alone silently disabled the
 * simulation and made two assertions fail for the wrong reason.
 */
let SIMULATE_MISSING_GEN = false
const _origLoad = Module._load
Module._load = function (req, parent, isMain) {
  if (SIMULATE_MISSING_GEN && req === './cloudEnv.generated.js') {
    const e = new Error("Cannot find module './cloudEnv.generated.js'")
    e.code = 'MODULE_NOT_FOUND'
    throw e
  }
  return _origLoad.apply(this, arguments)
}

function loadResolver (gen) {
  const resPath = path.join(ROOT, 'config', 'cloudEnv.js')
  const genPath = path.join(ROOT, 'config', 'cloudEnv.generated.js')
  delete require.cache[resPath]
  delete require.cache[genPath]
  if (gen === null) {
    SIMULATE_MISSING_GEN = true
    try {
      return require(resPath)
    } finally {
      SIMULATE_MISSING_GEN = false
    }
  }
  require.cache[genPath] = {
    id: genPath, filename: genPath, loaded: true, exports: gen,
  }
  return require(resPath)
}

console.log('=== 1. generator fail-closed (no write on bad target) ===')
const genScript = path.join(ROOT, 'tools', 'rc814', 'select-cloud-env.js')
const genFile = path.join(ROOT, 'config', 'cloudEnv.generated.js')
const before = fs.readFileSync(genFile, 'utf8')

let r = spawnSync(process.execPath, [genScript, 'nonsense'], { encoding: 'utf8' })
ok(r.status !== 0, 'unknown target exits non-zero (got ' + r.status + ')')
ok(fs.readFileSync(genFile, 'utf8') === before, 'unknown target writes nothing')

r = spawnSync(process.execPath, [genScript], { encoding: 'utf8' })
ok(r.status !== 0, 'missing target exits non-zero (got ' + r.status + ')')
ok(fs.readFileSync(genFile, 'utf8') === before, 'missing target writes nothing')

r = spawnSync(process.execPath, [genScript, 'PRODUCTION'], { encoding: 'utf8' })
ok(r.status !== 0, 'case-mismatched target rejected (no implicit normalisation)')
ok(fs.readFileSync(genFile, 'utf8') === before, 'case-mismatch writes nothing')

console.log('\n=== 2. resolver fail-closed matrix ===')
function expectThrow (gen, label) {
  const m = loadResolver(gen)
  let threw = null
  // keep the missing-file hook active across the actual resolve() call
  if (gen === null) SIMULATE_MISSING_GEN = true
  try { m.resolveCloudEnv() } catch (e) { threw = e } finally { SIMULATE_MISSING_GEN = false }
  ok(!!threw, label + ' -> throws')
  ok(!!threw && threw.code === 'CLOUD_ENV_UNRESOLVED', label + ' -> code=CLOUD_ENV_UNRESOLVED')
  return threw
}

expectThrow(null, 'missing generated file')
expectThrow({ buildTarget: 'dev', envId: STAGING_ID, buildTargetSealed: true }, 'unknown target "dev"')
expectThrow({ buildTarget: 'staging', envId: 'x', buildTargetSealed: true }, 'malformed envId')
expectThrow({ buildTarget: 'staging', envId: STAGING_ID, buildTargetSealed: false }, 'unsealed target')
expectThrow({ buildTarget: 'staging', envId: '', buildTargetSealed: true }, 'empty envId')
expectThrow({}, 'empty object')
expectThrow({ buildTarget: 123, envId: STAGING_ID, buildTargetSealed: true }, 'non-string target')

// positive cases
for (const [t, id] of [['staging', STAGING_ID], ['production', PROD_ID]]) {
  const m = loadResolver({ buildTarget: t, envId: id, buildTargetSealed: true })
  let out = null
  try { out = m.resolveCloudEnv() } catch (e) { out = null }
  ok(!!out && out.target === t && out.envId === id, 'valid ' + t + ' resolves to its own envId')
}

// inspectCloudEnv must never throw
const mBad = loadResolver({ buildTarget: 'nope', envId: STAGING_ID, buildTargetSealed: true })
let probe = null
try { probe = mBad.inspectCloudEnv() } catch (e) { probe = 'THREW' }
ok(probe && probe.ok === false && typeof probe.reason === 'string', 'inspectCloudEnv reports failure without throwing')

console.log('\n=== 3/4. real app.js onLaunch binding ===')
/** Run app.js onLaunch with a stubbed wx runtime, capturing cloud init. */
function bootApp (gen) {
  const appPath = path.join(ROOT, 'app.js')
  const genPath = path.join(ROOT, 'config', 'cloudEnv.generated.js')
  const resPath = path.join(ROOT, 'config', 'cloudEnv.js')
  const trackPath = path.join(ROOT, 'utils', 'userTrack.js')

  delete require.cache[appPath]
  delete require.cache[resPath]
  delete require.cache[genPath]
  delete require.cache[trackPath]
  require.cache[trackPath] = { id: trackPath, filename: trackPath, loaded: true, exports: { event () {} } }
  require.cache[genPath] = { id: genPath, filename: genPath, loaded: true, exports: gen }

  const calls = { init: [], callFunction: [], showModal: [] }
  const wx = {
    cloud: {
      init (o) { calls.init.push(o) },
      callFunction (o) { calls.callFunction.push(o); return Promise.resolve({ result: { code: 0, data: { user: {}, profile: {}, isNewUser: false, openid: 'x' } } }) },
    },
    showModal (o) { calls.showModal.push(o) },
    setEnableDebug () {},
    getStorageSync () { return null },
    setStorageSync () {},
  }

  const origWx = global.wx
  const origApp = global.App
  const origConfig = global.__wxConfig
  let appObj = null
  global.wx = wx
  global.__wxConfig = { envVersion: 'develop' }
  global.App = function (o) { appObj = o }
  try {
    require(appPath)
    if (appObj && typeof appObj.onLaunch === 'function') appObj.onLaunch.call(appObj)
  } finally {
    global.wx = origWx
    global.App = origApp
    global.__wxConfig = origConfig
    delete require.cache[appPath]
    delete require.cache[resPath]
  }
  return { calls, app: appObj }
}

const stg = bootApp({ buildTarget: 'staging', envId: STAGING_ID, buildTargetSealed: true })
ok(stg.calls.init.length === 1, 'staging build: wx.cloud.init called exactly once')
ok(stg.calls.init[0] && stg.calls.init[0].env === STAGING_ID, 'staging build: init env IS staging')
ok(stg.calls.init[0] && stg.calls.init[0].env !== PROD_ID, 'staging build: init env is NOT production')
ok(stg.app.globalData.cloudEnvTarget === 'staging', 'staging build: globalData records target')
ok(stg.calls.callFunction.every(c => !c.env), 'staging build: no per-call env override leaks')

const prd = bootApp({ buildTarget: 'production', envId: PROD_ID, buildTargetSealed: true })
ok(prd.calls.init.length === 1 && prd.calls.init[0].env === PROD_ID, 'production build: init env IS production')

const bad = bootApp({ buildTarget: 'staging', envId: STAGING_ID, buildTargetSealed: false })
ok(bad.calls.init.length === 0, 'unsealed build: wx.cloud.init NOT called (fail closed)')
ok(bad.calls.showModal.length === 1, 'unsealed build: user shown an error modal')
ok(bad.calls.callFunction.length === 0, 'unsealed build: ZERO cloud calls attempted')
ok(!!bad.app.globalData.envError, 'unsealed build: envError recorded for diagnostics')

const bad2 = bootApp({ buildTarget: 'weird', envId: PROD_ID, buildTargetSealed: true })
ok(bad2.calls.init.length === 0, 'unknown target: wx.cloud.init NOT called')
ok(bad2.calls.callFunction.length === 0, 'unknown target: ZERO cloud calls (cannot reach prod)')

console.log('\n=== 5. tree scan (current checked-out target) ===')
let cur = null
try { cur = require(path.join(ROOT, 'config', 'cloudEnv.generated.js')).buildTarget } catch (e) {}
const scanDirs = ['config', 'pages', 'services', 'utils']
let hardcodes = 0
let prodHits = 0
function scan (d) {
  let ents = []
  try { ents = fs.readdirSync(d, { withFileTypes: true }) } catch (e) { return }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name === '.git') continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) { scan(p); continue }
    if (!/\.(js|json)$/.test(e.name)) continue
    const rel = path.relative(ROOT, p)
    if (rel === path.join('config', 'cloudEnv.generated.js')) continue
    const src = fs.readFileSync(p, 'utf8')
    const m = src.match(/env\s*:\s*['"][a-z0-9][a-z0-9-]{5,60}['"]/g) || []
    if (m.length) { hardcodes += m.length; console.log('     hardcode: ' + rel + ' :: ' + m[0]) }
    if (cur === 'staging' && src.includes(PROD_ID)) { prodHits++; console.log('     prod leak: ' + rel) }
  }
}
for (const d of scanDirs) scan(path.join(ROOT, d))
const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8')
if (/env\s*:\s*['"][a-z0-9][a-z0-9-]{5,60}['"]/.test(appSrc)) { hardcodes++; console.log('     hardcode: app.js') }
if (cur === 'staging' && appSrc.includes(PROD_ID)) prodHits++

ok(hardcodes === 0, 'no hardcoded env literal in client source (' + hardcodes + ')')
ok(cur !== 'staging' || prodHits === 0, 'staging tree has no production envId (' + prodHits + ')')

console.log('\nCLIENT_ENV_ISOLATION_TEST pass=' + pass + ' fail=' + fail)
process.exit(fail === 0 ? 0 : 1)
