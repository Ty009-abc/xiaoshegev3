/**
 * tests/rc8.3-stage21-release-safety.test.js
 *
 * RC8.3 Stage21 — Release Safety Foundation (W3/W4/W5/W9) tests.
 *
 * Coverage (frozen Batch1 §10):
 *   A. fingerprint determinism
 *   B. key-order independence
 *   C. secret exclusion
 *   D. identity exclusion
 *   E. allowlist privacy handling
 *   F. config drift detection
 *   G. no-drift detection
 *   H. stale cloudbaserc detection
 *   I. unsafe deploy classification
 *   J. safe code-only classification
 *   K. manifest schema validation
 *   L. evidence NOT_RUN semantics
 *   M. Gate-B ACTIVE cannot be represented as PASS accidentally
 *   N. production access requires explicit opt-in
 *   O. no production mutation capability
 * Plus mutation tests (secret / openid / changed mode / fake Gate-B PASS /
 * unsafe deploy method must be caught).
 */

var fp = require('../tools/rc83-stage21-release-safety/lib/fingerprint')
var cfg = require('../tools/rc83-stage21-release-safety/lib/configReadback')
var ds = require('../tools/rc83-stage21-release-safety/lib/deploymentSafety')
var rm = require('../tools/rc83-stage21-release-safety/lib/releaseManifest')

var t = 0, p = 0, f = 0
function T(n, fn) { t++; try { fn(); p++ } catch (e) { f++; console.error('FAIL [' + n + ']:', e.message) } }
function eq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)) }
function ok(v, m) { if (!v) throw new Error((m || 'ok') + ': falsy') }
function notOk(v, m) { if (v) throw new Error((m || 'notOk') + ': truthy') }
function has(a, b, m) { if (a.indexOf(b) === -1) throw new Error((m || 'has') + ': missing ' + JSON.stringify(b)) }
function deepEq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'deepEq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)) }

// ── Fixtures (explicitly synthetic, never real production evidence) ──
var FIXTURE_CONFIG = {
  environmentId: 'TEST_FIXTURE_env',
  v2Mode: 'SHADOW',
  v21Mode: 'SHADOW',
  engineMode: 'SHADOW',
  allowlistState: { present: true, count: 3 },
  cohortConfig: { bucketN: 100, saltOwner: 'TEST_FIXTURE' },
}

// ═══════════════════════════════════════════════════════════
// W4 — Config Fingerprint
// ═══════════════════════════════════════════════════════════

T('A01: fingerprint determinism (same input → same fingerprint)', function () {
  var a = fp.fingerprintConfig(FIXTURE_CONFIG)
  var b = fp.fingerprintConfig(FIXTURE_CONFIG)
  eq(a, b, 'deterministic fingerprint')
  eq(typeof a, 'string')
  eq(a.length, 64, 'sha256 hex length')
})

T('B01: key-order independence', function () {
  var c1 = { environmentId: 'X', v2Mode: 'SHADOW', v21Mode: 'SHADOW' }
  var c2 = { v21Mode: 'SHADOW', environmentId: 'X', v2Mode: 'SHADOW' }
  eq(fp.fingerprintConfig(c1), fp.fingerprintConfig(c2), 'key order must not matter')
})

T('C01: secret exclusion (apiKey not in payload)', function () {
  var c = { environmentId: 'X', v2Mode: 'SHADOW', apiKey: 'sk-secret', token: 'tok', privateKey: 'pem' }
  var payload = fp.buildConfigFingerprintPayload(c)
  var json = JSON.stringify(payload)
  notOk(/sk-secret/.test(json), 'apiKey value leaked')
  notOk(/tok/.test(json), 'token leaked')
  notOk(/pem/.test(json), 'privateKey leaked')
})

T('D01: identity exclusion (openid/unionid/phone not in payload)', function () {
  var c = { environmentId: 'X', v2Mode: 'SHADOW', openid: 'oABC123', unionid: 'uXYZ', phone: '13800000000', nickname: 'bob' }
  var payload = fp.buildConfigFingerprintPayload(c)
  var json = JSON.stringify(payload)
  notOk(/oABC123/.test(json), 'openid leaked')
  notOk(/uXYZ/.test(json), 'unionid leaked')
  notOk(/13800000000/.test(json), 'phone leaked')
  notOk(/bob/.test(json), 'nickname leaked')
})

T('E01: allowlist privacy — raw identity collapsed to presence/count', function () {
  var rawAllowlist = ['oUser1', 'oUser2', 'oUser3']
  var payload = fp.buildConfigFingerprintPayload({ environmentId: 'X', allowlistState: rawAllowlist })
  deepEq(payload.allowlistState, { present: true, count: 3 }, 'allowlist must be presence/count only')
  var json = JSON.stringify(payload)
  notOk(/oUser1/.test(json), 'raw allowlist identity leaked')
})

T('E02: allowlist CSV string → presence/count', function () {
  var payload = fp.buildConfigFingerprintPayload({ environmentId: 'X', allowlistState: 'oA,oB,oC' })
  deepEq(payload.allowlistState, { present: true, count: 3 }, 'csv allowlist collapsed')
})

// ═══════════════════════════════════════════════════════════
// W5 — Deployment Safety
// ═══════════════════════════════════════════════════════════

T('I01: unsafe deploy classification (tcb fn deploy)', function () {
  var r = ds.classifyDeploymentPath('tcb fn deploy')
  eq(r.classification, 'UNSAFE_CONFIG_SYNC')
})

T('J01: safe code-only classification (tcb fn code update)', function () {
  var r = ds.classifyDeploymentPath('tcb fn code update')
  eq(r.classification, 'SAFE_CODE_ONLY')
})

T('J02: assertCodeOnlyDeploySafe true for code update', function () {
  var r = ds.assertCodeOnlyDeploySafe('tcb fn code update')
  eq(r.safe, true)
})

T('I02: assertCodeOnlyDeploySafe false for deploy', function () {
  var r = ds.assertCodeOnlyDeploySafe('tcb fn deploy')
  eq(r.safe, false)
})

T('I03: unknown method → UNKNOWN_REQUIRES_REVIEW', function () {
  var r = ds.classifyDeploymentPath('some-mystery-command')
  eq(r.classification, 'UNKNOWN_REQUIRES_REVIEW')
})

T('H01: stale cloudbaserc detection', function () {
  var rc = {
    functions: [
      { name: 'generateAiReport', envVariables: { RC83_WORLD_MODEL_MODE: 'SELECTIVE_PRIMARY', RC83_WORLD_MODEL_ALLOWLIST: 'oX' } },
    ],
  }
  var r = ds.detectStaleCloudbaserc(rc)
  eq(r.staleDetected, true)
  eq(r.functions.length, 1)
  eq(r.functions[0].name, 'generateAiReport')
})

T('H02: non-stale cloudbaserc not flagged', function () {
  var rc = { functions: [{ name: 'other', envVariables: { RC83_WORLD_MODEL_MODE: 'SHADOW' } }] }
  var r = ds.detectStaleCloudbaserc(rc)
  eq(r.staleDetected, false)
})

// ═══════════════════════════════════════════════════════════
// W5 — Config Comparator
// ═══════════════════════════════════════════════════════════

T('G01: no-drift detection (identical config)', function () {
  var r = ds.compareConfigState(FIXTURE_CONFIG, FIXTURE_CONFIG)
  eq(r.result, 'MATCH')
  eq(r.diff.length, 0)
})

T('F01: config drift detection (mode change)', function () {
  var pre = { environmentId: 'X', v2Mode: 'SHADOW' }
  var post = { environmentId: 'X', v2Mode: 'SELECTIVE_PRIMARY' }
  var r = ds.compareConfigState(pre, post)
  eq(r.result, 'DRIFT_DETECTED')
  ok(r.diff.length >= 1)
})

T('F02: drift diff is secret-safe (no secret value in diff)', function () {
  var pre = { environmentId: 'X', v2Mode: 'SHADOW', apiKey: 'sk-secret-A' }
  var post = { environmentId: 'X', v2Mode: 'SHADOW', apiKey: 'sk-secret-B' }
  var r = ds.compareConfigState(pre, post)
  // Secret key is excluded from payload → mode identical → MATCH
  eq(r.result, 'MATCH', 'secret-only change must not surface as drift')
})

// ═══════════════════════════════════════════════════════════
// W9 — Release Manifest
// ═══════════════════════════════════════════════════════════

T('K01: manifest schema validation (valid manifest)', function () {
  var m = rm.buildManifest({
    canonicalSha: '0874254ede490d7fef6c20942ff663c0970a445c',
    candidateSha: 'TEST_FIXTURE',
    harnessSha: '2a5f606b90312e509f651002cb119732bc335c85',
    environmentId: 'TEST_FIXTURE_env',
    rolloutMode: 'SHADOW',
    featureFlagState: 'OFF',
    rollbackTarget: 'legacy_rc8',
    releaseOwner: 'TEST_FIXTURE',
    releaseTimestamp: 'SYNTHETIC_METADATA',
    knownDebts: ['P2_STAGE21_DAG_W1_W2_DIRECTION_AMBIGUITY'],
  })
  var v = rm.validateManifest(m)
  eq(v.valid, true, JSON.stringify(v.errors))
})

T('L01: evidence NOT_RUN semantics (omitted evidence → NOT_RUN)', function () {
  var m = rm.buildManifest({ canonicalSha: 'X' })
  eq(m.gateBResult, 'NOT_RUN')
  eq(m.regressionResult, 'NOT_RUN')
  eq(m.realDeviceResult, 'NOT_RUN')
})

T('L02: null evidence rejected (must use NOT_RUN/BLOCKED/NOT_APPLICABLE)', function () {
  var m = rm.buildManifest({ canonicalSha: 'X', gateBResult: null })
  var v = rm.validateManifest(m)
  eq(v.valid, false)
  has(v.errors.join('|'), 'must not be null')
})

T('M01: Gate-B ACTIVE cannot be represented as PASS accidentally', function () {
  // gateBResult=PASS without protocol hash → invalid (false-PASS guard).
  var m = rm.buildManifest({ canonicalSha: 'X', gateBResult: 'PASS' })
  var v = rm.validateManifest(m)
  eq(v.valid, false)
  var guard = rm.assertGateBNotFalselyPassed(m)
  eq(guard.ok, false)
})

// ═══════════════════════════════════════════════════════════
// W3 — Config Readback (authority + opt-in)
// ═══════════════════════════════════════════════════════════

T('N01: production access requires explicit opt-in (no liveReader)', function () {
  var threw = false
  try {
    cfg.readProductionConfig({ liveReadonly: true })
  } catch (e) { threw = true }
  eq(threw, true, '--live-readonly without injected reader must throw')
})

T('N02: default fixture mode works (no production access)', function () {
  var r = cfg.readProductionConfig({ liveReadonly: false, fixture: FIXTURE_CONFIG })
  eq(r.mode, 'FIXTURE')
  eq(cfg.PRODUCTION_CONFIG_AUTHORITY, 'DEPLOYED_CLOUDBASE_FUNCTION_ENV')
})

T('O01: no production mutation capability (no write API exported)', function () {
  var api = require('../tools/rc83-stage21-release-safety/index.js')
  // Scan FUNCTION-level exports only (data constants like DEPLOY_METHODS are read-only).
  var MUTATION_VERBS = /^(write|mutate|setConfig|updateConfig|apply|deploy|remove|delete|create|execute|push)/i
  var namespaces = ['fingerprint', 'configReadback', 'deploymentSafety', 'releaseManifest']
  for (var i = 0; i < namespaces.length; i++) {
    var mod = api[namespaces[i]]
    var keys = Object.keys(mod)
    for (var j = 0; j < keys.length; j++) {
      var k = keys[j]
      if (typeof mod[k] === 'function' && MUTATION_VERBS.test(k)) {
        throw new Error('mutation-capable function export found: ' + namespaces[i] + '.' + k)
      }
    }
  }
})

// ═══════════════════════════════════════════════════════════
// Mutation Tests (must be caught by guards)
// ═══════════════════════════════════════════════════════════

T('MT01: injected secret must be excluded from fingerprint payload', function () {
  var c = { environmentId: 'X', v2Mode: 'SHADOW', apiKey: 'sk-INJECTED-SECRET' }
  var payload = fp.buildConfigFingerprintPayload(c)
  notOk(/INJECTED-SECRET/.test(JSON.stringify(payload)), 'injected secret leaked')
})

T('MT02: injected openid must be excluded', function () {
  var c = { environmentId: 'X', v2Mode: 'SHADOW', openid: 'oINJECTED-OPENID' }
  var payload = fp.buildConfigFingerprintPayload(c)
  notOk(/INJECTED-OPENID/.test(JSON.stringify(payload)), 'injected openid leaked')
})

T('MT03: changed mode must be caught as drift', function () {
  var r = ds.compareConfigState({ v2Mode: 'SHADOW' }, { v2Mode: 'PRIMARY' })
  eq(r.result, 'DRIFT_DETECTED')
})

T('MT04: fake Gate-B PASS must be caught (no protocol hash)', function () {
  var m = rm.buildManifest({ canonicalSha: 'X', gateBResult: 'PASS' })
  var v = rm.validateManifest(m)
  eq(v.valid, false)
})

T('MT05: unsafe deploy method must be classified UNSAFE_CONFIG_SYNC', function () {
  var r = ds.classifyDeploymentPath('tcb fn deploy')
  eq(r.classification, 'UNSAFE_CONFIG_SYNC')
})

// ── Summary ──
console.log('\n===== Stage21 Release Safety tests =====')
console.log('TOTAL=' + t + ' PASS=' + p + ' FAIL=' + f)
if (f > 0) process.exit(1)
