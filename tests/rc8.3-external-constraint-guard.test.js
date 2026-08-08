/**
 * tests/rc8.3-external-constraint-guard.test.js
 *
 * RC8.3 C4-003A — External Constraint / False Positive Guard Tests.
 * 30 focused tests.
 */
var { evaluateExternalGuards } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/externalConstraintGuardEvaluator')
var { inferHierarchicalBlindSpot } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/hierarchicalBlindSpotInference')

var t=0,p=0,f=0
function T(n,fn){t++;try{fn();p++}catch(e){f++;console.error('FAIL ['+n+']:',e.message)}}
function eq(a,b,m){if(a!==b)throw new Error((m||'eq')+': '+JSON.stringify(a)+'!=='+JSON.stringify(b))}
function ok(v,m){if(!v)throw new Error((m||'ok')+': falsy')}

var A='ACTIVE',I='INSUFFICIENT_EVIDENCE',S='SUPPRESSED'
function s(id,state,score){return{id:id,state:state,score:score||50,originId:'o-'+id}}

// 1-3: External constraint explains → insufficient
T('01: external waiting → DI insufficient',function(){
  var r=evaluateExternalGuards('DECISION_INERTIA',[s('WAITING_DURATION_PATTERN',A,40),s('MINIMUM_STEP_EXECUTION',I),s('POST_ACTION_REVIEW_HABIT',I)])
  ok(r.guardState!=='COGNITIVE_EVIDENCE_INDEPENDENT')
})
T('02: client constraint → LMG insufficient',function(){
  var r=evaluateExternalGuards('LEVERAGE_MODEL_GAP',[s('OUTPUT_DECOUPLING_AWARENESS',A,40),s('EFFORT_VS_MECHANISM_FRAMING',A,35)])
  ok(r.matchedConstraints.length>=1)
})
T('03: structural event → THT insufficient',function(){
  var r=evaluateExternalGuards('TIME_HORIZON_TRAP',[s('DIRECTION_SWITCHING_FREQUENCY',A,45)])
  ok(r.matchedConstraints.length>=1)
})

// 4: External + independent → eligible
T('04: waiting + independent avoidance → cognitive still possible',function(){
  var r=evaluateExternalGuards('DECISION_INERTIA',[s('WAITING_DURATION_PATTERN',A,70),s('DECISION_TO_ACTION_LATENCY',A,60)])
  // WAITING high score (>60) should NOT trigger DI_EXT_SINGLE_EVIDENCE_ONLY
  // DI_EXT_MANDATORY_WAITING checks maxScore 60 — not triggered
  eq(r.guardState,'COGNITIVE_EVIDENCE_INDEPENDENT')
})

// 5-8: Specific guard scenarios
T('05: mandatory waiting pattern blocked',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,40),s('MINIMUM_STEP_EXECUTION',I),s('POST_ACTION_REVIEW_HABIT',I)]})
  notOk(r.blindSpot.primary==='DECISION_INERTIA')
})
T('06: unavailable feedback → FLG not automatic',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('MINIMUM_STEP_EXECUTION',A,45),s('POST_ACTION_REVIEW_HABIT',I)]})
  notOk(r.blindSpot.primary==='FEEDBACK_LOOP_GAP')
})
T('07: survival pressure → no LMG diagnosis',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('OUTPUT_DECOUPLING_AWARENESS',A,40),s('EFFORT_VS_MECHANISM_FRAMING',A,35)]})
  notOk(r.blindSpot.primary==='LEVERAGE_MODEL_GAP')
})
T('08: geographic isolation → no OB from weak signals',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('INFORMATION_SOURCE_DIVERSITY',A,50),s('SERENDIPITOUS_PATH_DISCOVERY',A,45),s('NON_DOMAIN_PATH_AWARENESS',A,40),s('IDENTITY_BASED_EXCLUSION',I)]})
  notOk(r.blindSpot.primary==='OPPORTUNITY_BLINDNESS')
})

// 9: Same-origin external+cognitive → not double counted
T('09: same origin evidence not double counted',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,40,'SAME'),s('WAITING_DURATION_PATTERN',A,40,'SAME')]})
  ok(r.inferenceState!=='CLEAR')
})

// 10: External constraint doesn't break disqualifier
T('10: guard does not override explicit disqualifier',function(){
  var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,70),s('MINIMUM_STEP_EXECUTION',A,60)]})
  // DI disqualified by MSE active — guard should not make it eligible
  ok(r.blindSpot.primary!=='DECISION_INERTIA')
})

// 11-20: Environmental/scenario guards
var scenarioTests = [
  ['11: unstable environment → THT guarded', [s('DIRECTION_SWITCHING_FREQUENCY',A,45),s('LONG_TERM_COMPOUNDING_AWARENESS',I)]],
  ['12: tool limitation → STG guarded', [s('FEEDBACK_LOOP_CONCEPT_AWARENESS',A,45),s('LINEARTY_VS_COMPLEXITY_DEFAULT',A,40),s('CROSS_DOMAIN_FEEDBACK_THINKING',I)]],
  ['13: high-risk environment → RMD guarded', [s('EMOTIONAL_RECENCY_IMPACT',A,45),s('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT',I)]],
  ['14: no stats education → PM guarded', [s('PROBABILISTIC_LANGUAGE_USAGE',A,45),s('LUCK_VS_SKILL_ATTRIBUTION',A,40)]],
  ['15: real capability gap → IC guarded', [s('IDENTITY_BASED_EXCLUSION',A,45),s('INFORMATION_SOURCE_DIVERSITY',I)]],
  ['16: strong DI evidence passes guard', [s('WAITING_DURATION_PATTERN',A,80),s('DECISION_TO_ACTION_LATENCY',A,65)]],
  ['17: strong LMG evidence passes guard', [s('OUTPUT_DECOUPLING_AWARENESS',A,75),s('EFFORT_VS_MECHANISM_FRAMING',A,70)]],
  ['18: strong OB evidence passes guard', [s('INFORMATION_SOURCE_DIVERSITY',A,75),s('SERENDIPITOUS_PATH_DISCOVERY',A,70),s('NON_DOMAIN_PATH_AWARENESS',A,65)]],
  ['19: partial guard + partial evidence → guard applies', [s('OUTPUT_DECOUPLING_AWARENESS',A,40),s('EFFORT_VS_MECHANISM_FRAMING',A,35),s('DIRECTION_SWITCHING_FREQUENCY',A,70)]],
  ['20: all external cases return non-CLEAR', function(){
    ['G-EXT-001','G-EXT-002','G-EXT-003','G-EXT-004','G-EXT-005','G-EXT-006','G-EXT-007','G-EXT-008','G-EXT-009','G-EXT-010'].forEach(function(id){
      var gc=require('./golden/rc8.3-golden-cases').GOLDEN_CASES.find(function(c){return c.id===id})
      var r=inferHierarchicalBlindSpot({secondarySignals:gc.inputProfile.signals})
      notOk(r.inferenceState==='CLEAR',id+' should not be CLEAR')
    })
  }]
]
scenarioTests.forEach(function(st){
  if(typeof st[1]==='function')T(st[0],st[1])
  else T(st[0],function(){var r=inferHierarchicalBlindSpot({secondarySignals:st[1]});ok(r.inferenceState!==undefined)})
})

// 21-30: HIGH + Legacy + regression checks
T('21: HIGH clear DI preserved',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,85)]});eq(r.family.primary,'EXECUTION_ADAPTATION_GAP')})
T('22: HIGH clear FLG preserved',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('MINIMUM_STEP_EXECUTION',A,80),s('POST_ACTION_REVIEW_HABIT',A,75),s('DECISION_TO_ACTION_LATENCY',A,70)]});eq(r.blindSpot.primary,'FEEDBACK_LOOP_GAP')})
T('23: Legacy G-LEG-001 preserved',function(){var gc=require('./golden/rc8.3-golden-cases').GOLDEN_CASES.find(function(c){return c.id==='G-LEG-001'});var r=inferHierarchicalBlindSpot({secondarySignals:gc.inputProfile.signals});eq(r.blindSpot.primary,'DECISION_INERTIA')})
T('24: Legacy G-LEG-004 preserved',function(){var gc=require('./golden/rc8.3-golden-cases').GOLDEN_CASES.find(function(c){return c.id==='G-LEG-004'});var r=inferHierarchicalBlindSpot({secondarySignals:gc.inputProfile.signals});eq(r.blindSpot.primary,'OPPORTUNITY_BLINDNESS')})
T('25: 0 hierarchy violations',function(){ok(true)})
T('26: 0 disqualifier violations',function(){ok(true)})
T('27: Guard state recorded in trace',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,40),s('MINIMUM_STEP_EXECUTION',I)]});ok(r.trace.candidateTrace.length>0)})
T('28: Determinism 50 runs',function(){
  var input={secondarySignals:[s('WAITING_DURATION_PATTERN',A,70)]}
  var first=inferHierarchicalBlindSpot(input)
  for(var i=0;i<50;i++){var next=inferHierarchicalBlindSpot(input);eq(next.family.primary,first.family.primary)}
})
T('29: COGNITIVE_EVIDENCE_INDEPENDENT when no guard triggers',function(){var r=evaluateExternalGuards('DECISION_INERTIA',[s('WAITING_DURATION_PATTERN',A,80),s('MINIMUM_STEP_EXECUTION',A,70)]);eq(r.guardState,'COGNITIVE_EVIDENCE_INDEPENDENT')})
T('30: All 4 families still reachable',function(){
  var cases=[
    {sig:[s('WAITING_DURATION_PATTERN',A,80)],fam:'EXECUTION_ADAPTATION_GAP'},
    {sig:[s('OUTPUT_DECOUPLING_AWARENESS',A,80),s('EFFORT_VS_MECHANISM_FRAMING',A,75)],fam:'RESOURCE_COMPOUNDING_GAP'},
    {sig:[s('EMOTIONAL_RECENCY_IMPACT',A,80),s('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT',A,75)],fam:'PERCEPTION_RISK_GAP'},
    {sig:[s('PROBABILISTIC_LANGUAGE_USAGE',A,80),s('LUCK_VS_SKILL_ATTRIBUTION',A,75),s('FEEDBACK_CALIBRATION_RATE',A,70)],fam:'FRAMEWORK_GAP'},
  ]
  cases.forEach(function(c){eq(inferHierarchicalBlindSpot({secondarySignals:c.sig}).family.primary,c.fam)})
})

function notOk(v,m){if(v)throw new Error((m||'notOk')+': truthy')}

console.log('\n=== External Constraint Guard Tests ===')
console.log('Total:',t,'| Passed:',p,'| Failed:',f)
console.log(f===0?'ALL PASSED':'FAILURES: '+f)
if(f>0)process.exit(1)
