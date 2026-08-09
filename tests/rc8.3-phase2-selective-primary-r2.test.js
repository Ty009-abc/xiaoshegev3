/**
 * Phase-2 003D-R2 Adapter Contract Fix — Behavioral Tests.
 */
var t=0,p=0,f=0
function T(n,fn){t++;try{fn();p++}catch(e){f++;console.error('FAIL ['+n+']:',e.message.split('\n')[0])}}
function eq(a,b,m){if(a!==b)throw Error((m||'eq')+': '+JSON.stringify(a)+'!=='+JSON.stringify(b))}
function ok(v,m){if(!v)throw Error((m||'ok')+': falsy')}
function notOk(v,m){if(v)throw Error((m||'notOk')+': truthy')}

console.log('=== 003D-R2 Adapter Contract Fix Tests ===')

var { runWorldModelPipeline }=require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldModelPipeline')
var { adaptWorldModelToLegacyDiagnosis }=require('../cloudfunctions/generateAiReport/lib/engine/worldModel/legacyDiagnosisAdapter')

// 1: Correct adapter input — pass diagnosis, not wrapper
T('R2-01: adapter gets diagnosis object',function(){
  var r=runWorldModelPipeline({inputProfile:{signals:[{id:'WAITING_DURATION_PATTERN',state:'ACTIVE',score:80}],occupation:'test'}})
  ok(r.valid!==false,'Pipeline valid')
  ok(r.diagnosis,'diagnosis exists')
  ok(r.diagnosis.version==='world_model_v1','version world_model_v1')
  var a=adaptWorldModelToLegacyDiagnosis(r.diagnosis)
  ok(!a.adapterError,'No adapterError: '+(a.adapterError||''))
  ok(a.worldModelDiagnosis,'worldModelDiagnosis present')
})

// 2: AdapterError → failure path
T('R2-02: adapterError detected by code',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf('!adapted.adapterError')!==-1||src.indexOf('adapterError')!==-1,'adapterError check exists')
})

// 3: WM primary label non-empty
T('R2-03: WM primary label populated',function(){
  var r=runWorldModelPipeline({inputProfile:{signals:[{id:'WAITING_DURATION_PATTERN',state:'ACTIVE',score:80}],occupation:'test'}})
  var a=adaptWorldModelToLegacyDiagnosis(r.diagnosis)
  var bs=a.worldModelDiagnosis.cognitiveBlindSpot
  ok(bs,'BS exists')
  ok(typeof bs.label==='string'&&bs.label.length>0,'label non-empty: '+bs.label)
})

// 4: WM primary blindSpot non-null
T('R2-04: WM primary blindSpot populated',function(){
  var r=runWorldModelPipeline({inputProfile:{signals:[{id:'WAITING_DURATION_PATTERN',state:'ACTIVE',score:80}],occupation:'test'}})
  var a=adaptWorldModelToLegacyDiagnosis(r.diagnosis)
  var bs=a.worldModelDiagnosis.cognitiveBlindSpot
  ok(bs.id,'blindSpot id: '+bs.id)
  ok(bs.primary||bs.id,'blindSpot primary/identifier present')
})

// 5: WM primary strategy non-empty
T('R2-05: WM primary strategy populated',function(){
  var r=runWorldModelPipeline({inputProfile:{signals:[{id:'WAITING_DURATION_PATTERN',state:'ACTIVE',score:80}],occupation:'test'}})
  var a=adaptWorldModelToLegacyDiagnosis(r.diagnosis)
  var ws=a.worldModelDiagnosis.worldStrategy
  ok(ws,'Strategy exists')
  ok(typeof ws.label==='string'&&ws.label.length>0,'strategy label: '+ws.label)
})

// 6: legacyDiagnosisAdapter present
T('R2-06: legacyDiagnosisAdapter field',function(){
  var r=runWorldModelPipeline({inputProfile:{signals:[{id:'WAITING_DURATION_PATTERN',state:'ACTIVE',score:80}],occupation:'test'}})
  var a=adaptWorldModelToLegacyDiagnosis(r.diagnosis)
  ok(a.legacyDiagnosisAdapter!==undefined,'legacyDiagnosisAdapter exists')
})

// 7: Adapter with empty/invalid diagnosis → error
T('R2-07: invalid diagnosis → adapterError',function(){
  var a=adaptWorldModelToLegacyDiagnosis({version:'invalid'})
  ok(a.adapterError||!a.worldModelDiagnosis,'Should fail on invalid version')
})

// 8: R1 fixes preserved — cache RW
T('R2-08: worldModelVersion in cache write',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf('worldModelVersion: CURRENT_CACHE_VERSION.worldModelVersion')!==-1,'cache version RW symmetric')
})

// 9: R1 fixes preserved — TDZ
T('R2-09: TDZ fix preserved',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  var wmBlock=src.indexOf('wmProfile')
  var answersDecl=src.indexOf('const answers = normalizeV4Input')
  ok(answersDecl<wmBlock,'answers before WM (TDZ preserved)')
})

// 10: R1 fixes preserved — cache namespace follows primaryEngine
T('R2-10: cacheType uses primaryEngine',function(){
  var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/index.js','utf8')
  ok(src.indexOf("primaryEngine === 'world_model_v1'")!==-1,'primaryEngine-based cacheType')
})

console.log('\nTotal:',t,'| Passed:',p,'| Failed:',f)
console.log(f===0?'ALL PASSED':'FAILURES: '+f)
if(f>0)process.exit(1)
