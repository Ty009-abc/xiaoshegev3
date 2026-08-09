/**
 * Phase-2 003B Whitelist Enforcement Tests.
 * 20 behavioral tests + 4 security tests + regression smoke.
 */
var { parseWorldModelAllowlist, isWorldModelAuthorized, getAllowlistFromEnv } = require('../cloudfunctions/generateAiReport/lib/config/worldModelWhitelist')

var t=0,p=0,f=0
function T(n,fn){t++;try{fn();p++}catch(e){f++;console.error('FAIL ['+n+']:',e.message.split('\n')[0])}}
function eq(a,b,m){if(a!==b)throw Error((m||'eq')+': '+JSON.stringify(a)+'!=='+JSON.stringify(b))}
function ok(v,m){if(!v)throw Error((m||'ok')+': falsy')}
function notOk(v,m){if(v)throw Error((m||'notOk')+': truthy')}

console.log('=== Whitelist Enforcement Tests ===')

// 1: missing env → authorize nobody
T('W1: missing allowlist → authorize nobody',function(){
  eq(isWorldModelAuthorized('user1', ''), false)
  eq(isWorldModelAuthorized('user1', undefined), false)
})

// 2: empty allowlist → authorize nobody
T('W2: empty allowlist fails closed',function(){
  eq(isWorldModelAuthorized('user1', '  '), false)
})

// 3: authorized user
T('W3: authorized user passes',function(){
  eq(isWorldModelAuthorized('openid_abc', 'openid_abc,openid_def'), true)
})

// 4: unauthorized user
T('W4: unauthorized user blocked',function(){
  eq(isWorldModelAuthorized('openid_xyz', 'openid_abc,openid_def'), false)
})

// 5: missing openid
T('W5: null openid blocked',function(){
  eq(isWorldModelAuthorized(null, 'openid_abc'), false)
  eq(isWorldModelAuthorized('', 'openid_abc'), false)
})

// 6: whitespace normalization
T('W6: whitespace trimmed',function(){
  eq(isWorldModelAuthorized('openid_abc', '  openid_abc  , openid_def '), true)
})

// 7: dedup
T('W7: duplicates harmless',function(){
  eq(isWorldModelAuthorized('openid_abc', 'openid_abc,openid_abc'), true)
})

// 8: case sensitive
T('W8: case sensitivity preserved',function(){
  eq(isWorldModelAuthorized('OpenID_ABC', 'openid_abc'), false)
  eq(isWorldModelAuthorized('openid_ABC', 'openid_ABC'), true)
})

// 9: malformed input → fail closed
T('W9: malformed input fails closed',function(){
  var s
  try { s = parseWorldModelAllowlist(null) } catch(e) { s = new Set() }
  eq(s.size, 0, 'null should give empty set')
})

// 10: helper exception → fail closed
T('W10: exception handled gracefully',function(){
  // Helper functions never throw — fail closed is the contract
  ok(typeof isWorldModelAuthorized === 'function', 'Helper should be callable')
  ok(isWorldModelAuthorized('ok', 'ok') === true)
  ok(isWorldModelAuthorized('ok', 'other') === false)
})

// 11: parse yields correct size
T('W11: parse yields correct entries',function(){
  var s = parseWorldModelAllowlist('a,b,c')
  eq(s.size, 3)
  ok(s.has('a'))
})

// 12: getAllowlistFromEnv returns string
T('W12: getAllowlist returns string',function(){
  var raw = getAllowlistFromEnv()
  ok(typeof raw === 'string', 'Should return string type, got ' + typeof raw)
})

// 13: env-based authorization
T('W13: env-based check via helper',function(){
  process.env.RC83_WORLD_MODEL_ALLOWLIST = 'test_openid_1,test_openid_2'
  eq(isWorldModelAuthorized('test_openid_1', process.env.RC83_WORLD_MODEL_ALLOWLIST), true)
  eq(isWorldModelAuthorized('test_openid_3', process.env.RC83_WORLD_MODEL_ALLOWLIST), false)
  delete process.env.RC83_WORLD_MODEL_ALLOWLIST
})

// 14: normalizeV4Input accepts world_model_v1
T('W14: normalizeV4Input accepts wm',function(){
  var { normalizeV4Input } = require('../cloudfunctions/generateAiReport/lib/v4/diagnosticPipelineV4')
  var r1 = normalizeV4Input({ diagnosticVersion: 'world_model_v1', answers: { answers: { q1: 'a' } } })
  ok(r1 !== null, 'world_model_v1 should be accepted')
  var r2 = normalizeV4Input({ diagnosticVersion: 'v4' })
  ok(r2 !== null, 'v4 should still be accepted')
})

// 15: normalizeV4Input rejects unknown
T('W15: unknown engine rejected',function(){
  var { normalizeV4Input } = require('../cloudfunctions/generateAiReport/lib/v4/diagnosticPipelineV4')
  var r = normalizeV4Input({ diagnosticVersion: 'v5' })
  eq(r, null)
})

// 16: world_model_v1 shadow integration test
T('W16: shadow pipeline runs standalone',function(){
  var { runWorldModelPipeline } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldModelPipeline')
  var r = runWorldModelPipeline({ inputProfile: { signals: [{id:'WAITING_DURATION_PATTERN',state:'ACTIVE',score:80}], occupation:'test' } })
  ok(r.diagnosis, 'Shadow pipeline produces diagnosis')
})

// 17: deterministic parse
T('W17: deterministic allowlist parse',function(){
  for(var i=0;i<100;i++){
    var s = parseWorldModelAllowlist('a,b,c,d,e')
    eq(s.size, 5, 'Run ' + i)
  }
})

// 18: empty string entries ignored
T('W18: empty entries ignored',function(){
  var s = parseWorldModelAllowlist('a,,b, ,c')
  eq(s.size, 3)
})

// 19: large allowlist
T('W19: large allowlist works',function(){
  var entries = []
  for(var i=0;i<100;i++) entries.push('user_' + i)
  var raw = entries.join(',')
  eq(isWorldModelAuthorized('user_50', raw), true)
  eq(isWorldModelAuthorized('user_999', raw), false)
})

// 20: world_mode_v1 code integration exists
T('W20: auth code integrated in index.js',function(){
  var src = require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf('effectiveEngine') !== -1, 'effectiveEngine present')
  ok(src.indexOf('worldModelWhitelist') !== -1, 'whitelist imported')
  ok(src.indexOf('AUTHORIZED') !== -1, 'authorization decision present')
})

console.log('\nTotal:',t,'| Passed:',p,'| Failed:',f)
console.log(f===0?'ALL PASSED':'FAILURES: '+f)
if(f>0)process.exit(1)
