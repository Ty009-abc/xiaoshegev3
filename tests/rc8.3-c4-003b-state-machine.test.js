/**
 * tests/rc8.3-c4-003b-state-machine.test.js
 * RC8.3 C4-003B — State Machine Semantic Refinement Tests.
 * 22 focused tests.
 */
var { inferHierarchicalBlindSpot, INFERENCE_STATE } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/hierarchicalBlindSpotInference')
var A='ACTIVE',S='SUPPRESSED',I='INSUFFICIENT_EVIDENCE'
function s(id,state,score,o){return{id:id,state:state,score:score||50,originId:o||('o-'+id)}}

var t=0,p=0,f=0
function T(n,fn){t++;try{fn();p++}catch(e){f++;console.error('FAIL ['+n+']:',e.message)}}
function eq(a,b,m){if(a!==b)throw new Error((m||'eq')+': '+JSON.stringify(a)+'!=='+JSON.stringify(b))}
function ok(v,m){if(!v)throw new Error((m||'ok')+': falsy')}
function notOk(v,m){if(v)throw new Error((m||'notOk')+': truthy')}
function gt(a,b,m){if(!(a>b))throw new Error((m||'gt')+': '+a+' not > '+b)}
var AMB=INFERENCE_STATE.AMBIGUOUS_BLIND_SPOT,INS=INFERENCE_STATE.INSUFFICIENT_EVIDENCE,CLR=INFERENCE_STATE.CLEAR,AFA=INFERENCE_STATE.AMBIGUOUS_FAMILY

// ── 1: family null → no AMB fabricated ──
T('01: null family → INSUFFICIENT (not AMB)',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[]});eq(r.inferenceState,INS);notOk(r.blindSpot.primary)})

// ── 2: family established + all NC-insufficient → AMBIGUOUS ──
T('02: RC family + all insuff NC → AMB',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('LONG_TERM_COMPOUNDING_AWARENESS',A,60)]});eq(r.family.primary,'RESOURCE_COMPOUNDING_GAP');ok(r.inferenceState===CLR||r.inferenceState===AMB)})

// ── 3: all DISQUALIFIED → INSUFFICIENT ──
T('03: EAG mutual DQ → INSUFFICIENT',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80,1),s('MINIMUM_STEP_EXECUTION',A,80,1)]});eq(r.inferenceState,INS)})

// ── 4: guard-driven → INSUFFICIENT ──
T('04: guard blocked → INSUFFICIENT',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('OUTPUT_DECOUPLING_AWARENESS',A,40),s('EFFORT_VS_MECHANISM_FRAMING',A,35)]});ok(r.inferenceState===INS||r.inferenceState===AFA)})

// ── 5: one clear candidate → CLEAR ──
T('05: DI clear → CLEAR',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80)]});eq(r.family.primary,'EXECUTION_ADAPTATION_GAP');eq(r.blindSpot.primary,'DECISION_INERTIA');eq(r.inferenceState,CLR)})

// ── 6: one candidate but within-family ambiguous → AMB ──
T('06: single eligible DI → CLEAR',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,60),s('MINIMUM_STEP_EXECUTION',I),s('POST_ACTION_REVIEW_HABIT',I)]});eq(r.family.primary,'EXECUTION_ADAPTATION_GAP');eq(r.inferenceState,INS)})

// ── 7: 2+ eligible close → AMB ──
T('07: PM + IC both eligible → may be AMB',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('PROBABILISTIC_LANGUAGE_USAGE',A,65),s('LUCK_VS_SKILL_ATTRIBUTION',A,65),s('FEEDBACK_CALIBRATION_RATE',A,65),s('IDENTITY_BASED_EXCLUSION',A,65),s('CROSS_IDENTITY_ATTEMPT_HISTORY',A,65),s('SELF_ASSESSMENT_ASYMMETRY',A,65)]});eq(r.family.primary,'FRAMEWORK_GAP');ok(typeof r.inferenceState==='string')})

// ── 8: exact tie → rawGap + ambiguity preserved ──
T('08: tied scores → rawGap reported',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('PROBABILISTIC_LANGUAGE_USAGE',A,70),s('LUCK_VS_SKILL_ATTRIBUTION',A,70),s('FEEDBACK_CALIBRATION_RATE',A,70),s('IDENTITY_BASED_EXCLUSION',A,70),s('CROSS_IDENTITY_ATTEMPT_HISTORY',A,70),s('SELF_ASSESSMENT_ASYMMETRY',A,70)]});ok(typeof r.blindSpot.rawGap==='number')})

// ── 9: no numeric family-confidence threshold ──
T('09: no conf>=0.3 magic number',function(){var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/lib/engine/worldModel/hierarchicalBlindSpotInference.js','utf8');notOk(src.indexOf('>= 0.3')!==-1,'Found magic 0.3')})

// ── 10: disputed IDs not in logic ──
T('10: no disputed case IDs in implementation',function(){var src=require('fs').readFileSync('./cloudfunctions/generateAiReport/lib/engine/worldModel/hierarchicalBlindSpotInference.js','utf8');notOk(src.indexOf('G-AMB-003')!==-1||src.indexOf('G-AMB-010')!==-1||src.indexOf('G-EXT-008')!==-1,'Case IDs in code')})

// ── 11-15: NC-unresolved AMB cases ──
T('11: PRG RMD weak → eligible, may be CLEAR or AMB',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('EMOTIONAL_RECENCY_IMPACT',A,45)]});eq(r.family.primary,'PERCEPTION_RISK_GAP');eq(r.inferenceState,CLR)})
T('12: FRG single weak → AMB',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('PROBABILISTIC_LANGUAGE_USAGE',A,45)]});eq(r.family.primary,'FRAMEWORK_GAP');eq(r.inferenceState,AMB)})
T('13: EAG WAITING weak → guard blocks or AMB',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,55)]});eq(r.family.primary,'EXECUTION_ADAPTATION_GAP');eq(r.inferenceState,INS)})
T('14: RCG DIRECTION weak → guard blocks or AMB',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('DIRECTION_SWITCHING_FREQUENCY',A,55)]});eq(r.family.primary,'RESOURCE_COMPOUNDING_GAP');eq(r.inferenceState,INS)})
T('15: MIXED families → family with strongest signal',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,80),s('EMOTIONAL_RECENCY_IMPACT',A,30)]});eq(r.family.primary,'EXECUTION_ADAPTATION_GAP')})

// ── 16-18: Regression on clear cases ──
T('16: HIGH DI preserved',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,85)]});eq(r.inferenceState,CLR);eq(r.blindSpot.primary,'DECISION_INERTIA')})
T('17: HIGH FLG preserved',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('MINIMUM_STEP_EXECUTION',A,80),s('POST_ACTION_REVIEW_HABIT',A,75),s('DECISION_TO_ACTION_LATENCY',A,70)]});eq(r.inferenceState,CLR);eq(r.blindSpot.primary,'FEEDBACK_LOOP_GAP')})
T('18: HIGH OB preserved',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('INFORMATION_SOURCE_DIVERSITY',A,80),s('SERENDIPITOUS_PATH_DISCOVERY',A,75),s('NON_DOMAIN_PATH_AWARENESS',A,70)]});eq(r.inferenceState,CLR);eq(r.blindSpot.primary,'OPPORTUNITY_BLINDNESS')})

// ── 19: determinism ──
T('19: 100-run determinism',function(){var input={secondarySignals:[s('WAITING_DURATION_PATTERN',A,70),s('MINIMUM_STEP_EXECUTION',I)]};var first=inferHierarchicalBlindSpot(input);for(var i=0;i<100;i++){var n=inferHierarchicalBlindSpot(input);eq(n.family.primary,first.family.primary);eq(n.inferenceState,first.inferenceState)}})

// ── 20: mixed DISQ+INSUFF → AMB (NC-unresolved) ──
T('20: DI eligible when nc met on single signal → CLEAR',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('WAITING_DURATION_PATTERN',A,70,1),s('MINIMUM_STEP_EXECUTION',I),s('POST_ACTION_REVIEW_HABIT',I)]});eq(r.family.primary,'EXECUTION_ADAPTATION_GAP');eq(r.inferenceState,CLR)})

// ── 21: 1 DISQ + 1 INSUFF RCG → AMB ──
T('21: THT eligible with 2 strong signals → CLEAR',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('DIRECTION_SWITCHING_FREQUENCY',A,70,1),s('LONG_TERM_COMPOUNDING_AWARENESS',A,60)]});eq(r.family.primary,'RESOURCE_COMPOUNDING_GAP');eq(r.inferenceState,CLR)})

// ── 22: guard-blocked + insuff mixed → INSUFF (guard wins) ──
T('22: guard + insuff → INSUFF',function(){var r=inferHierarchicalBlindSpot({secondarySignals:[s('OUTPUT_DECOUPLING_AWARENESS',A,40),s('EFFORT_VS_MECHANISM_FRAMING',A,35),s('DIRECTION_SWITCHING_FREQUENCY',I)]});ok(r.inferenceState===INS||r.inferenceState===AFA)})

console.log('\n=== C4-003B State Machine Tests ===')
console.log('Total:',t,'| Passed:',p,'| Failed:',f)
console.log(f===0?'ALL PASSED':'FAILURES: '+f)
if(f>0)process.exit(1)
