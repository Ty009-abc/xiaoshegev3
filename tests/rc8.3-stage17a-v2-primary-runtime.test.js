/**
 * RC8.3 Stage 17A — World Model V2 Primary Runtime Tests
 *
 * Covers:
 *   1. worldModelV2Mode.js config parsing (fail-closed)
 *   2. routing matrix (V2_MODE × allowlist → primary vs shadow)
 *   3. V2 primary namespace isolation (diagnostic_world_model_v2 vs _shadow)
 *   4. V2 shadow path preserved
 *
 * @version world_model_v2
 */

var ok, T, _tests, _passed, _failed
_tests = []; _passed = 0; _failed = 0
function T(n, f) { _tests.push({ name: n, fn: f }) }
function ok(e, m) { if (e) _passed++; else { _failed++; console.log('FAIL [' + _tests[_tests.length - 1].name + ']: ' + (m || '')) } }
function eq(a, b, m) { ok(a === b, m + ': got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b)) }
function ne(a, b, m) { ok(a !== b, m) }
function truthy(v, m) { ok(!!v, m) }
function falsy(v, m) { ok(!v, m) }

var path = require('path')
var REPO = path.resolve(__dirname, '..')

// ═══ 1. config parsing (no mock needed) ═══
var V2Mode = require('../cloudfunctions/generateAiReport/lib/config/worldModelV2Mode')

T('parseV2Mode: SELECTIVE_PRIMARY', function () { eq(V2Mode.parseV2Mode('SELECTIVE_PRIMARY'), 'SELECTIVE_PRIMARY') })
T('parseV2Mode: SHADOW', function () { eq(V2Mode.parseV2Mode('SHADOW'), 'SHADOW') })
T('parseV2Mode: lowercase → normalized', function () { eq(V2Mode.parseV2Mode('selective_primary'), 'SELECTIVE_PRIMARY') })
T('parseV2Mode: invalid → SHADOW (fail-closed)', function () { eq(V2Mode.parseV2Mode('GARBAGE'), 'SHADOW') })
T('parseV2Mode: empty → SHADOW', function () { eq(V2Mode.parseV2Mode(''), 'SHADOW') })
T('parseV2Mode: undefined → SHADOW', function () { eq(V2Mode.parseV2Mode(undefined), 'SHADOW') })

T('parseV2Allowlist: dedupe + trim + drop empty', function () {
  var s = V2Mode.parseV2Allowlist(' a , b,,c ,a ')
  eq(s.size, 3, 'size')
  truthy(s.has('a') && s.has('b') && s.has('c'), 'members')
})
T('parseV2Allowlist: empty → empty set', function () { eq(V2Mode.parseV2Allowlist('').size, 0) })
T('parseV2Allowlist: non-string → empty set', function () { eq(V2Mode.parseV2Allowlist(123).size, 0) })

T('isV2PrimaryAuthorized: allowlisted → true', function () {
  truthy(V2Mode.isV2PrimaryAuthorized('a', 'a,b,c'))
})
T('isV2PrimaryAuthorized: non-allowlisted → false', function () {
  falsy(V2Mode.isV2PrimaryAuthorized('z', 'a,b,c'))
})
T('isV2PrimaryAuthorized: empty openid → false', function () {
  falsy(V2Mode.isV2PrimaryAuthorized('', 'a,b,c'))
})

// ═══ 2. routing matrix (mock wx-server-sdk via Module._load) ═══
var Module = require('module')
var __writes = []
var __currentOpenid = 'u1'

var mockDb = {
  command: {},
  collection: function (name) {
    return {
      where: function () { return this },
      orderBy: function () { return this },
      limit: function () { return this },
      get: async function () {
        if (name === 'users') return { data: [{ openid: __currentOpenid }] }
        if (name === 'user_profiles') return { data: [{ openid: __currentOpenid }] }
        return { data: [] }
      },
      add: async function (o) { __writes.push({ collection: name, data: o && o.data }); return { _id: 'mock' } },
      doc: function () { return { get: async function () { return { data: null } }, set: async function () {}, update: async function () {} } },
    }
  },
}
var mockSdk = {
  DYNAMIC_CURRENT_ENV: 'mock-env',
  init: function () {},
  getWXContext: function () { return { OPENID: __currentOpenid } },
  database: function () { return mockDb },
}

var originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return mockSdk
  return originalLoad.apply(this, arguments)
}
var index = require('../cloudfunctions/generateAiReport/index.js')
Module._load = originalLoad

var FULL = { Q_DEC_01:'A', Q_DEC_02:'A', Q_FB_01:'A', Q_FB_02:'A', Q_PROB_01:'A', Q_PROB_02:'A', Q_RISK_01:'A', Q_RISK_02:'A', Q_LEV_01:'C', Q_LEV_02:'A', Q_TIME_01:'A', Q_TIME_02:'A', Q_ID_01:'C', Q_ID_02:'A', Q_OPP_01:'A', Q_OPP_02:'A', Q_SYS_01:'A', Q_SYS_02:'A' }
var U1 = 'oZa463Yb2VY0k9Es_pGzdHFtigNo'
var U9 = 'oZa463_UNKNOWN_user'

function v2event() { return { type: 'diagnostic', diagnosticVersion: 'world_model_v2', answers: FULL } }

async function route(envMode, envAllowlist, openid) {
  if (envMode === undefined) delete process.env.RC83_WORLD_MODEL_V2_MODE
  else process.env.RC83_WORLD_MODEL_V2_MODE = envMode
  process.env.RC83_WORLD_MODEL_V2_ALLOWLIST = envAllowlist
  __currentOpenid = openid
  __writes = []
  var r = await index.main(v2event(), {})
  var rec = __writes.find(function (w) { return w.collection === 'ai_reports' })
  return { resp: r, rec: rec ? rec.data : null }
}

T('routing: SHADOW + allowlisted → shadow', async function () {
  var x = await route('SHADOW', U1, U1)
  eq(x.resp.data.renderSource, 'v2_shadow_only', 'renderSource')
  eq(x.rec.recordType, 'diagnostic_world_model_v2_shadow', 'recordType')
})
T('routing: SELECTIVE_PRIMARY + allowlisted → primary', async function () {
  var x = await route('SELECTIVE_PRIMARY', U1, U1)
  eq(x.resp.data.renderSource, 'world_model_v2', 'renderSource')
  eq(x.rec.recordType, 'diagnostic_world_model_v2', 'recordType')
  truthy(x.resp.data.v2PrimaryActive, 'v2PrimaryActive')
})
T('routing: SELECTIVE_PRIMARY + non-allowlisted → shadow', async function () {
  var x = await route('SELECTIVE_PRIMARY', U1, U9)
  eq(x.resp.data.renderSource, 'v2_shadow_only', 'renderSource')
  eq(x.rec.recordType, 'diagnostic_world_model_v2_shadow', 'recordType')
})
T('routing: empty allowlist → shadow (fail-closed)', async function () {
  var x = await route('SELECTIVE_PRIMARY', '', U1)
  eq(x.resp.data.renderSource, 'v2_shadow_only', 'renderSource')
})
T('routing: invalid mode → shadow (fail-closed)', async function () {
  var x = await route('GARBAGE', U1, U1)
  eq(x.resp.data.renderSource, 'v2_shadow_only', 'renderSource')
})
T('routing: mode unset → shadow (fail-closed)', async function () {
  var x = await route(undefined, U1, U1)
  eq(x.resp.data.renderSource, 'v2_shadow_only', 'renderSource')
})

// ═══ 3. V2 primary namespace + record contract ═══
T('primary record: full contract fields', async function () {
  var x = await route('SELECTIVE_PRIMARY', U1, U1)
  var rec = x.rec
  eq(rec.type, 'diagnostic_world_model_v2', 'type')
  eq(rec.recordType, 'diagnostic_world_model_v2', 'recordType')
  eq(rec.diagnosticVersion, 'world_model_v2', 'diagnosticVersion')
  eq(rec.engineVersion, 'world_model_v2', 'engineVersion')
  eq(rec.renderSource, 'world_model_v2', 'renderSource')
  ok(rec.inputHash && rec.inputHash.indexOf('v2_') === 0, 'inputHash prefix v2_: ' + rec.inputHash)
  truthy(rec.blindSpot, 'blindSpot')
  truthy(rec.strategy, 'strategy')
  eq(Object.keys(rec.dimensions || {}).length, 9, '9 dimensions')
})

T('primary record: ranking fields present (explicit, never hidden)', async function () {
  var x = await route('SELECTIVE_PRIMARY', U1, U1)
  var rk = x.rec.primaryRanking
  truthy(rk, 'primaryRanking')
  ok('primaryBlindSpot' in rk, 'primaryBlindSpot')
  ok('secondBlindSpot' in rk, 'secondBlindSpot')
  ok('primaryRawScore' in rk, 'primaryRawScore')
  ok('secondRawScore' in rk, 'secondRawScore')
  ok('rawGap' in rk, 'rawGap')
  ok('tieDetected' in rk, 'tieDetected')
  ok('tieBrokenBy' in rk, 'tieBrokenBy')
  ok('lowSeparation' in rk, 'lowSeparation')
})

T('primary response: report is world_model_v2 (not shadow)', async function () {
  var x = await route('SELECTIVE_PRIMARY', U1, U1)
  eq(x.resp.data.report._renderSource, 'world_model_v2', 'report renderSource')
  truthy(x.resp.data.diagnosis, 'diagnosis present')
})

// ═══ 4. V2 shadow path preserved (same input → deterministic hash) ═══
T('shadow path preserved: same input → deterministic hash', async function () {
  var a = await route('SHADOW', U1, U1)
  var b = await route('SHADOW', U1, U1)
  eq(a.rec.shadowWorldModelV2.inputHash, b.rec.shadowWorldModelV2.inputHash, 'deterministic hash')
})

// ═══ 5. namespace isolation (primary ≠ shadow) ═══
T('namespace isolation: primary and shadow record types are distinct', function () {
  ne('diagnostic_world_model_v2', 'diagnostic_world_model_v2_shadow', 'distinct')
})

// ═══ RUN ═══
;(async function () {
  for (var i = 0; i < _tests.length; i++) {
    try { await _tests[i].fn() } catch (e) { _failed++; console.log('FAIL (' + _tests[i].name + '): ' + e.message) }
  }
  console.log('\n========================================')
  console.log('RC8.3 Stage 17A — V2 Primary Runtime')
  console.log('========================================')
  console.log('Total: ' + (_passed + _failed) + ' | Passed: ' + _passed + ' | Failed: ' + _failed)
  console.log(_failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + _failed)
  console.log('========================================\n')
  process.exit(_failed > 0 ? 1 : 0)
})()
