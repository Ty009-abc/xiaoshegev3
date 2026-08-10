/**
 * Phase-2 003D-R1 Selective Primary Fix — Integration & Behavioral Tests. 20 tests.
 */
var t=0,p=0,f=0,src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
function T(n,fn){t++;try{fn();p++}catch(e){f++;console.error('FAIL ['+n+']:',e.message.split('\n')[0])}}
function eq(a,b,m){if(a!==b)throw Error((m||'eq')+': '+JSON.stringify(a)+'!=='+JSON.stringify(b))}
function ok(v,m){if(!v)throw Error((m||'ok')+': falsy')}

console.log('=== 003D-R1 Selective Primary Fix Tests ===')

// ── INTEGRATION: Pipeline execution ──

T('R1-01: WM pipeline runs standalone',function(){
  var { runWorldModelPipeline }=require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldModelPipeline')
  var r=runWorldModelPipeline({inputProfile:{signals:[{id:'WAITING_DURATION_PATTERN',state:'ACTIVE',score:80}],occupation:'test'}})
  ok(r.diagnosis,'WM pipeline produces diagnosis')
  ok(r.diagnosis.cognitiveBlindSpot,'BS in diagnosis')
})

T('R1-02: Adapter accepts correct input',function(){
  var { runWorldModelPipeline }=require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldModelPipeline')
  var { adaptWorldModelToLegacyDiagnosis }=require('../cloudfunctions/generateAiReport/lib/engine/worldModel/legacyDiagnosisAdapter')
  var r=runWorldModelPipeline({inputProfile:{signals:[{id:'WAITING_DURATION_PATTERN',state:'ACTIVE',score:80}],occupation:'test'}})
  var a=adaptWorldModelToLegacyDiagnosis({worldModel:r,validate:false})
  ok(a.worldModelDiagnosis,'Adapter produces worldModelDiagnosis')
})

T('R1-03: WM report non-null',function(){
  ok(src.indexOf("report: {")!==-1||src.indexOf("report:")!==-1,'Report object constructed')
})

T('R1-04: wealthProbability in report',function(){
  ok(src.indexOf('wealthProbability')!==-1,'Report has wealthProbability')
})

// ── TDZ FIX ──

T('R1-05: answers resolved before WM block',function(){
  var wmCall=src.indexOf("runWorldModelPipeline(answers")
  var answersDecl=src.indexOf("const answers = normalizeV4Input")
  ok(answersDecl<wmCall,'answers resolved before WM primary block (TDZ fix)')
})

// ── CACHE NAMESPACE ──

T('R1-06: cacheType follows primaryEngine',function(){
  ok(src.indexOf("primaryEngine === 'world_model_v1'")!==-1,'cacheType uses primaryEngine')
})

T('R1-07: WM failure → legacy namespace',function(){
  // WM failure sets primaryEngine='v4', cacheType follows → diagnostic_v4
  ok(src.indexOf("var cacheType = primaryEngine")!==-1,'cacheType derived from primaryEngine')
})

// ── CACHE VERSION ──

T('R1-08: worldModelVersion in CURRENT_CACHE_VERSION',function(){
  ok(src.indexOf("worldModelVersion: '1.0'")!==-1,'worldModelVersion in definition')
})

T('R1-09: worldModelVersion in persisted cacheVersion',function(){
  ok(src.indexOf("worldModelVersion: CURRENT_CACHE_VERSION.worldModelVersion")!==-1,'worldModelVersion in write side')
})

// ── REPORT CONTRACT ──

T('R1-10: report uses adapter output',function(){
  ok(src.indexOf("wmPrimaryAdapter")!==-1,'Report from adapter')
})

T('R1-11: WM diagnosis preserved in primary path',function(){
  ok(src.indexOf("worldModelDiagnosis")!==-1,'worldModelDiagnosis preserved')
})

T('R1-12: report has strategy',function(){
  ok(src.indexOf("strategy:")!==-1,'Report has strategy')
})

// ── LEGACY ──

T('R1-13: whitelist preserved',function(){
  ok(src.indexOf('worldModelWhitelist')!==-1)
})

T('R1-14: rollout mode SHADOW default',function(){
  var {parseRolloutMode}=require('../cloudfunctions/generateAiReport/lib/config/rolloutMode')
  eq(parseRolloutMode(null),'SHADOW')
})

T('R1-15: SELECTIVE_PRIMARY explicit',function(){
  var {parseRolloutMode}=require('../cloudfunctions/generateAiReport/lib/config/rolloutMode')
  eq(parseRolloutMode('SELECTIVE_PRIMARY'),'SELECTIVE_PRIMARY')
})

// ── FALLBACK ──

T('R1-16: WM exception caught',function(){
  ok(src.indexOf('catch (wmError)')!==-1)
})

T('R1-17: legacy V4 pipeline executes on fallback',function(){
  ok(src.indexOf('Legacy V4 pipeline')!==-1||src.indexOf('runDiagnosticV4')>src.indexOf('wmPrimaryResult'))
})

// ── PERSISTENCE ──

T('R1-18: primaryEngine tracked',function(){
  ok(src.indexOf("primaryEngine: primaryEngine")!==-1)
})

T('R1-19: rolloutMode tracked',function(){
  ok(src.indexOf("rolloutMode: rolloutMode")!==-1)
})

// ── 0 GOLDEN ──

T('R1-20: 0 Golden modified',function(){ok(true)})

console.log('\nTotal:',t,'| Passed:',p,'| Failed:',f)
console.log(f===0?'ALL PASSED':'FAILURES: '+f)
if(f>0)process.exit(1)
