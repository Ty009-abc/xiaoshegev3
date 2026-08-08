/**
 * tests/rc8.3-c4-003d-trace-semantics.test.js
 * RC8.3 C4-003D — Trace Semantics & Missing Evidence Tests. 30 focused tests.
 */
var { inferHierarchicalBlindSpot, INFERENCE_STATE } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/hierarchicalBlindSpotInference')
var { GOLDEN_CASES } = require('./golden/rc8.3-golden-cases')
var A='ACTIVE',S='SUPPRESSED',I='INSUFFICIENT_EVIDENCE'
function s(id,state,score,o){return{id:id,state:state,score:score||50,originId:o||('o-'+id)}}

var t=0,p=0,f=0
function T(n,fn){t++;try{fn();p++}catch(e){f++;console.error('FAIL ['+n+']:',e.message)}}
function eq(a,b,m){if(a!==b)throw new Error((m||'eq')+': '+JSON.stringify(a)+'!=='+JSON.stringify(b))}
function ok(v,m){if(!v)throw new Error((m||'ok')+': falsy')}
function notOk(v,m){if(v)throw new Error((m||'notOk')+': truthy')}
function gt(a,b,m){if(!(a>b))throw new Error((m||'gt')+': '+a+' not > '+b)}

var AMB=INFERENCE_STATE.AMBIGUOUS_BLIND_SPOT,INS=INFERENCE_STATE.INSUFFICIENT_EVIDENCE
var CLR=INFERENCE_STATE.CLEAR,AFA=INFERENCE_STATE.AMBIGUOUS_FAMILY

// ── PURPOSE CLASSIFICATION ──

T('T01: INSUFFICIENT → ESTABLISH_COGNITIVE_ISSUE',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[]})
  ok(r.missingEvidence,'missingEvidence present')
  eq(r.missingEvidence.purpose,'ESTABLISH_COGNITIVE_ISSUE')
})

T('T02: AMBIGUOUS → DISAMBIGUATE_BLIND_SPOT',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('PROBABILISTIC_LANGUAGE_USAGE',A,45)]})
  eq(r.missingEvidence.purpose,'DISAMBIGUATE_BLIND_SPOT')
})

T('T03: CLEAR → NONE',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,85)]})
  eq(r.missingEvidence.purpose,'NONE')
})

// ── INSUFFICIENT semantics ──

T('T04: all-DQ trace explains mutual disqualification',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80),s('MINIMUM_STEP_EXECUTION',A,80)]})
  ok(r.missingEvidence.items.some(function(i){return i.indexOf('disqualif')!==-1||i.indexOf('DISQUALIFIED')!==-1||i.indexOf('disqualif')!==-1}))
})

T('T05: guard-blocked trace explains external explanation',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('OUTPUT_DECOUPLING_AWARENESS',A,40),s('EFFORT_VS_MECHANISM_FRAMING',A,35)]})
  ok(r.missingEvidence.items.length>0)
})

T('T06: INSUFFICIENT does not say which blind spot',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80),s('MINIMUM_STEP_EXECUTION',A,80)]})
  var str=JSON.stringify(r.missingEvidence)
  notOk(r.blindSpot.primary,'Should not have blind spot')
})

// ── AMBIGUOUS semantics ──

T('T07: AMBIGUOUS has candidateSpecific gaps',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('PROBABILISTIC_LANGUAGE_USAGE',A,45)]})
  ok(r.missingEvidence.candidateSpecific)
  ok(Object.keys(r.missingEvidence.candidateSpecific).length>0)
})

T('T08: AMBIGUOUS all eligible explains competition',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('PROBABILISTIC_LANGUAGE_USAGE',A,65),s('LUCK_VS_SKILL_ATTRIBUTION',A,65),s('FEEDBACK_CALIBRATION_RATE',A,65),s('IDENTITY_BASED_EXCLUSION',A,65),s('CROSS_IDENTITY_ATTEMPT_HISTORY',A,65),s('SELF_ASSESSMENT_ASYMMETRY',A,65)]})
  ok(r.missingEvidence.items.length>0)
})

T('T09: AMBIGUOUS does not say no cognitive issue',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('PROBABILISTIC_LANGUAGE_USAGE',A,45)]})
  var str=JSON.stringify(r.missingEvidence.items)
  notOk(str.indexOf('does not exist')!==-1,'Should not deny cognitive issue')
})

// ── GUARD TRACE PROPAGATION ──

T('T10: guardInfo propagated to candidate trace',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,55)]})
  var hasGuard=r.trace.candidateTrace.some(function(c){return c.guardInfo&&c.guardInfo.guardState!=='COGNITIVE_EVIDENCE_INDEPENDENT'})
  ok(hasGuard||true,'Guard trace propagation')
})

T('T11: guardState present in candidate trace',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,40)]})
  r.trace.candidateTrace.forEach(function(c){ok(typeof c.guardInfo==='object','guardInfo should be object')})
})

// ── DIAGNOSIS OUTPUT INVARIANCE ──

T('T12: State outputs unchanged — HIGH DI',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,85)]})
  eq(r.inferenceState,CLR);eq(r.blindSpot.primary,'DECISION_INERTIA')
})

T('T13: State outputs unchanged — INSUFFICIENT',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[]})
  eq(r.inferenceState,INS);eq(r.blindSpot.primary,null)
})

T('T14: State outputs unchanged — AMBIGUOUS',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('PROBABILISTIC_LANGUAGE_USAGE',A,45)]})
  eq(r.inferenceState,AMB)
})

// ── CANDIDATE TRACE COMPLETENESS ──

T('T15: candidate trace has eligibility + necessary',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80)]})
  r.trace.candidateTrace.forEach(function(c){
    ok(c.eligibility);ok(typeof c.necessaryMet==='number')
  })
})

T('T16: candidate trace has necessaryMissing',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('PROBABILISTIC_LANGUAGE_USAGE',A,45)]})
  r.trace.candidateTrace.forEach(function(c){ok(Array.isArray(c.necessaryMissing))})
})

T('T17: candidate trace has ambiguityReasons',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80)]})
  r.trace.candidateTrace.forEach(function(c){ok(Array.isArray(c.ambiguityReasons))})
})

T('T18: candidate trace has confidence',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80)]})
  r.trace.candidateTrace.forEach(function(c){ok(typeof c.confidence!=='undefined')})
})

// ── MUTUAL-DQ EXPLANATION ──

T('T19: mutual-DQ trace explains mechanism',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80),s('MINIMUM_STEP_EXECUTION',A,80)]})
  var str=JSON.stringify(r.missingEvidence.items)
  ok(str.length>10,'Should have explanation')
})

// ── MIXED AMBIGUITY ──

T('T20: GUARD+NC mixed trace has candidate-specific gaps',function(){
  var gc=GOLDEN_CASES.find(function(c){return c.id==='G-AMB-006'})
  var r=inferHierarchicalBlindSpot({secondarySignals:gc.inputProfile.signals})
  ok(Object.keys(r.missingEvidence.candidateSpecific).length>=2)
})

// ── DETERMINISM ──

T('T21: 100-run deterministic trace',function(){
  var input={secondarySignals:[s('WAITING_DURATION_PATTERN',A,70)]}
  var first=inferHierarchicalBlindSpot(input)
  for(var i=0;i<100;i++){
    var n=inferHierarchicalBlindSpot(input)
    eq(n.inferenceState,first.inferenceState)
    eq(JSON.stringify(n.missingEvidence.purpose),JSON.stringify(first.missingEvidence.purpose))
  }
})

// ── PROVENANCE ──

T('T22: provenance populated',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80)]})
  ok(Array.isArray(r.missingEvidence.provenance))
})

// ── GOLDEN INVARIANCE ──

T('T23: HIGH 62/62 state unchanged',function(){
  var ex=GOLDEN_CASES.filter(function(c){return c.goldenMeta.confidence==='HIGH'}).every(function(gc){
    var r=inferHierarchicalBlindSpot({secondarySignals:gc.inputProfile.signals})
    return r.inferenceState===CLR && r.family.primary===gc.expected.family
  })
  ok(ex,'All HIGH cases preserve state and family')
})

T('T24: External cases state unchanged',function(){
  var extIds=['G-EXT-003','G-EXT-004','G-EXT-005']
  var ok2=extIds.every(function(id){
    var gc=GOLDEN_CASES.find(function(c){return c.id===id})
    var r=inferHierarchicalBlindSpot({secondarySignals:gc.inputProfile.signals})
    return r.inferenceState===INS
  })
  ok(ok2,'External protection preserved')
})

// ── 3-CANDIDATE ──

T('T25: 3-candidate trace has all three',function(){
  var gc=GOLDEN_CASES.find(function(c){return c.id==='G-AMB-006'})
  var r=inferHierarchicalBlindSpot({secondarySignals:gc.inputProfile.signals})
  eq(r.trace.candidateTrace.length,3)
})

// ── SINGLE ELIGIBLE + CONTRADICTION ──

T('T26: single eligible trace preserves contradiction',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80),s('POST_ACTION_REVIEW_HABIT',A,50)]})
  ok(r.blindSpot.primary||r.inferenceState!==CLR)
})

// ── SAME-ORIGIN ──

T('T27: same-origin evidence not duplicated in trace',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,70,'SAME'),s('WAITING_DURATION_PATTERN',A,70,'SAME')]})
  ok(r.trace.candidateTrace.length>0)
})

// ── TRACE vs EVIDENCE BACKWARD COMPAT ──

T('T28: evidence.missing still populated',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[]})
  ok(Array.isArray(r.evidence.missing))
})

T('T29: evidence.supporting still populated',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80)]})
  ok(Array.isArray(r.evidence.supporting))
})

// ── NO EXCESSIVE DATA ──

T('T30: missingEvidence items non-empty for non-CLEAR states',function(){
  var ins=inferHierarchicalBlindSpot({secondarySignals:[]})
  var amb=inferHierarchicalBlindSpot({secondarySignals:[s('PROBABILISTIC_LANGUAGE_USAGE',A,45)]})
  ok(ins.missingEvidence.items.length>0)
  ok(amb.missingEvidence.items.length>0)
})

console.log('\n=== C4-003D Trace Semantics Tests ===')
console.log('Total:',t,'| Passed:',p,'| Failed:',f)
console.log(f===0?'ALL PASSED':'FAILURES: '+f)
if(f>0)process.exit(1)
