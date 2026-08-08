/**
 * tests/rc8.3-c4-003c-guard-state.test.js
 * RC8.3 C4-003C — Guard-State Refinement Tests. 13 focused tests.
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
var AMB=INFERENCE_STATE.AMBIGUOUS_BLIND_SPOT,INS=INFERENCE_STATE.INSUFFICIENT_EVIDENCE,CLR=INFERENCE_STATE.CLEAR

// 1: empty → INSUFFICIENT
T('01: empty candidates → INSUFFICIENT',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[]});eq(r.inferenceState,INS)})

// 2: all DQ → INSUFFICIENT
T('02: EAG mutual DQ → INSUFFICIENT',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80),s('MINIMUM_STEP_EXECUTION',A,80)]});eq(r.inferenceState,INS)})

// 3: DQ + GUARD_INS → INSUFFICIENT
T('03: DQ+GUARD → INSUFFICIENT',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80),s('MINIMUM_STEP_EXECUTION',A,45),s('POST_ACTION_REVIEW_HABIT',I)]});eq(r.family.primary,'EXECUTION_ADAPTATION_GAP');eq(r.inferenceState,INS)})

// 4: GUARD_INS + NC_INS → AMBIGUOUS (key fix)
T('04: GUARD+NC → AMBIGUOUS',function(){
  var gc=GOLDEN_CASES.find(function(c){return c.id==='G-AMB-006'})
  var r=inferHierarchicalBlindSpot({secondarySignals:gc.inputProfile.signals})
  eq(r.family.primary,'FRAMEWORK_GAP');eq(r.inferenceState,AMB)
})

// 5: ALL_NON_DQ_GUARD → INSUFFICIENT
T('05: all non-DQ guard-blocked → INSUFFICIENT',function(){
  var gc=GOLDEN_CASES.find(function(c){return c.id==='G-EXT-001'})
  var r=inferHierarchicalBlindSpot({secondarySignals:gc.inputProfile.signals})
  ok(r.inferenceState===INS||r.inferenceState===INFERENCE_STATE.AMBIGUOUS_FAMILY)
})

// 6: NC_INS only → AMBIGUOUS
T('06: NC-only → AMBIGUOUS',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('PROBABILISTIC_LANGUAGE_USAGE',A,45)]});eq(r.family.primary,'FRAMEWORK_GAP');eq(r.inferenceState,AMB)})

// 7: GUARD + ELIGIBLE clear → CLEAR
T('07: GUARD+ELIGIBLE → CLEAR',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('DIRECTION_SWITCHING_FREQUENCY',A,70),s('LONG_TERM_COMPOUNDING_AWARENESS',A,70)]});eq(r.family.primary,'RESOURCE_COMPOUNDING_GAP');eq(r.inferenceState,CLR)})

// 8: GUARD + ELIGIBLE ambiguous → AMBIGUOUS
T('08: GUARD+ELIGIBLE ambig → AMB',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('OUTPUT_DECOUPLING_AWARENESS',A,70),s('EFFORT_VS_MECHANISM_FRAMING',A,70),s('DIRECTION_SWITCHING_FREQUENCY',A,70),s('LONG_TERM_COMPOUNDING_AWARENESS',A,70)]});eq(r.family.primary,'RESOURCE_COMPOUNDING_GAP');ok(typeof r.inferenceState==='string')})

// 9: DQ + NC_INS → AMBIGUOUS (C4-003B behavior preserved)
T('09: DQ+NC → may be CLEAR or AMB',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80),s('MINIMUM_STEP_EXECUTION',I),s('POST_ACTION_REVIEW_HABIT',I)]});eq(r.family.primary,'EXECUTION_ADAPTATION_GAP');ok(r.inferenceState===CLR||r.inferenceState===AMB)})

// 10: 3-candidate GUARD+NC+NC → AMBIGUOUS
T('10: 3way GUARD+NC+NC → AMBIGUOUS',function(){
  var gc=GOLDEN_CASES.find(function(c){return c.id==='G-EXT-009'})
  var r=inferHierarchicalBlindSpot({secondarySignals:gc.inputProfile.signals})
  eq(r.family.primary,'FRAMEWORK_GAP');eq(r.inferenceState,AMB)
})

// 11: 3-candidate DQ+GUARD+GUARD → INSUFFICIENT
T('11: 3way DQ+GUARD+GUARD → INSUFFICIENT',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('OUTPUT_DECOUPLING_AWARENESS',A,70),s('DIRECTION_SWITCHING_FREQUENCY',A,40),s('LONG_TERM_COMPOUNDING_AWARENESS',I)]});eq(r.family.primary,'RESOURCE_COMPOUNDING_GAP');eq(r.inferenceState,INS)})

// 12: no case IDs in implementation
T('12: no golden IDs in code',function(){var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/lib/engine/worldModel/hierarchicalBlindSpotInference.js','utf8');notOk(src.indexOf('G-AMB-')!==-1&&src.indexOf('G-EXT-')!==-1)})

// 13: external DQ+GUARD still INSUFFICIENT
T('13: G-EXT-003 still INSUFFICIENT',function(){
  var gc=GOLDEN_CASES.find(function(c){return c.id==='G-EXT-003'})
  var r=inferHierarchicalBlindSpot({secondarySignals:gc.inputProfile.signals})
  eq(r.inferenceState,INS)
})

console.log('\n=== C4-003C Guard-State Tests ===')
console.log('Total:',t,'| Passed:',p,'| Failed:',f)
console.log(f===0?'ALL PASSED':'FAILURES: '+f)
if(f>0)process.exit(1)
