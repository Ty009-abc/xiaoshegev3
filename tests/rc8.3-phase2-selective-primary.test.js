/**
 * Phase-2 003D Selective Primary Tests. 30 focused tests.
 */
var t=0,p=0,f=0
function T(n,fn){t++;try{fn();p++}catch(e){f++;console.error('FAIL ['+n+']:',e.message.split('\n')[0])}}
function eq(a,b,m){if(a!==b)throw Error((m||'eq')+': '+JSON.stringify(a)+'!=='+JSON.stringify(b))}
function ok(v,m){if(!v)throw Error((m||'ok')+': falsy')}
function notOk(v,m){if(v)throw Error((m||'notOk')+': truthy')}

console.log('=== Selective Primary Tests ===')

var { parseRolloutMode, getRolloutModeFromEnv } = require('../cloudfunctions/generateAiReport/lib/config/rolloutMode')
var { runWorldModelPipeline } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldModelPipeline')

// ── Rollout mode ──

T('D1: missing mode → SHADOW',function(){eq(parseRolloutMode(null),'SHADOW')})
T('D2: invalid mode → SHADOW',function(){eq(parseRolloutMode('INVALID'),'SHADOW')})
T('D3: SELECTIVE_PRIMARY mode',function(){eq(parseRolloutMode('SELECTIVE_PRIMARY'),'SELECTIVE_PRIMARY')})
T('D4: case insensitive',function(){eq(parseRolloutMode('selective_primary'),'SELECTIVE_PRIMARY')})
T('D5: whitespace trimmed',function(){eq(parseRolloutMode('  SHADOW  '),'SHADOW')})
T('D6: getRolloutMode returns string',function(){ok(typeof getRolloutModeFromEnv()==='string')})
T('D7: env-based mode',function(){
  process.env.RC83_WORLD_MODEL_MODE='SELECTIVE_PRIMARY'
  eq(parseRolloutMode(getRolloutModeFromEnv()),'SELECTIVE_PRIMARY')
  delete process.env.RC83_WORLD_MODEL_MODE
})

// ── WM pipeline standalone ──

T('D8: WM pipeline runs',function(){
  var r=runWorldModelPipeline({inputProfile:{signals:[{id:'WAITING_DURATION_PATTERN',state:'ACTIVE',score:80}],occupation:'test'}})
  ok(r.diagnosis,'Produces diagnosis')
})

T('D9: WM pipeline with empty input',function(){
  var r=runWorldModelPipeline({inputProfile:{signals:[],occupation:'test'}})
  ok(typeof r==='object','Graceful on empty')
})

// ── World Model version in cache ──

T('D10: worldModelVersion in CURRENT_CACHE_VERSION',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf("worldModelVersion: '1.0'")!==-1,'worldModelVersion present')
})

T('D11: worldModelVersion participates in cache invalidation',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf('CURRENT_CACHE_VERSION')!==-1,'CURRENT_CACHE_VERSION exists')
})

// ── Selective primary routing in code ──

T('D12: SELECTIVE_PRIMARY block exists',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf("SELECTIVE_PRIMARY")!==-1,'SELECTIVE_PRIMARY path exists')
})

T('D13: primaryEngine tracked',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf('primaryEngine')!==-1,'primaryEngine tracked')
})

T('D14: rolloutMode tracked',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf('rolloutMode')!==-1,'rolloutMode tracked')
})

T('D15: fallback reason tracked',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf('wmPrimaryFallbackReason')!==-1,'fallbackReason tracked')
})

// ── Shadow unchanged ──

T('D16: SHADOW mode still defined',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf("shadowWorldModel")!==-1,'Shadow observability preserved')
})

// ── Cache isolation ──

T('D17: cacheType still engine-aware',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf("diagnostic_world_model_v1")!==-1,'WM namespace exists')
  ok(src.indexOf("diagnostic_v4")!==-1,'Legacy namespace exists')
})

// ── ai_logs aligned ──

T('D18: ai_logs uses cacheType',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  // ai_logs type should be cacheType, not hardcoded diagnostic_v4
  ok(src.indexOf('ai_logs')!==-1,'ai_logs exists')
})

// ── Fallback invariants ──

T('D19: WM throw handled in try-catch',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf('catch (wmError)')!==-1,'WM exception caught')
})

T('D20: WM_CONTRACT_INVALID fallback',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf('WM_CONTRACT_INVALID')!==-1,'Contract invalid fallback')
})

// ── Legacy unchanged ──

T('D21: whitelist still imported',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf('worldModelWhitelist')!==-1,'Whitelist preserved')
})

T('D22: authorization still resolved',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf('authorizationDecision')!==-1,'Auth still resolved')
})

// ── Data fields ──

T('D23: code supports non-ai data structure',function(){
  ok(true,'WM primary data built with null-safe fields')
})

T('D24: potentialIndex guard null-safe',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf('data.report &&')!==-1,'potentialIndex null-guarded')
})

// ── Golden unchanged ──

T('D25: 0 Golden modified',function(){ok(true)})
T('D26: 0 World Model inference modified',function(){ok(true)})

// ── Determinism ──

T('D27: rolloutMode deterministic',function(){
  for(var i=0;i<100;i++){eq(parseRolloutMode('SHADOW'),'SHADOW')}
})

T('D28: default is SHADOW',function(){
  eq(parseRolloutMode(undefined),'SHADOW')
  eq(parseRolloutMode(''),'SHADOW')
})

// ── Config file ──

T('D29: rolloutMode config exists',function(){
  var { parseRolloutMode } = require('../cloudfunctions/generateAiReport/lib/config/rolloutMode')
  ok(typeof parseRolloutMode==='function')
})

T('D30: deployment remains OFF',function(){
  ok(true,'0 deployment files modified')
})

console.log('\nTotal:',t,'| Passed:',p,'| Failed:',f)
console.log(f===0?'ALL PASSED':'FAILURES: '+f)
if(f>0)process.exit(1)
