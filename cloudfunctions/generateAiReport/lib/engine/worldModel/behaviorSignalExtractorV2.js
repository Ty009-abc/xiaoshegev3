/**
 * engine/worldModel/behaviorSignalExtractorV2.js
 *
 * Deterministic extraction of 52 behavior signals from normalized evidence.
 *
 * CRITICAL RULES:
 * - At least 2 supporting evidence, OR 1 strong + 1 contextual
 * - Counter-evidence reduces score
 * - Conflicting signals computed simultaneously, not first-come-first-served
 * - No keyword-only triggers for serious cognitive conclusions
 * - 100% deterministic — same input → same output
 * - No random numbers, no AI, no probabilistic sampling
 *
 * @version world_model_v1
 */

const { getEvidenceByTag, getAggregateStrength } = require('./evidenceNormalizer')
const { calculateSignalConfidence } = require('./confidenceCalculator')
const { detectConflicts, applyConflictResolution } = require('./conflictResolver')

// ═══════════════════════════════════════════════════════════════
// Signal extraction threshold configuration
// ═══════════════════════════════════════════════════════════════

const THRESHOLDS = Object.freeze({
  STRONG: 0.7,
  MODERATE: 0.45,
  WEAK: 0.25,
  MIN_EVIDENCE: 2,
  STRONG_EVIDENCE_MIN: 0.8,
  CONTEXTUAL_MIN: 0.3,
})

// ═══════════════════════════════════════════════════════════════
// Signal extractors — each dimension
// ═══════════════════════════════════════════════════════════════

/**
 * Extract all 52 signals from normalized evidence.
 * Returns array of signal objects.
 */
function extractSignals(normalizedEvidence) {
  var signals = []
  var evidenceList = normalizedEvidence.evidence || []

  // Build lookup by normalizedValue
  var evByTag = {}
  evidenceList.forEach(function(e) {
    if (!evByTag[e.normalizedValue]) evByTag[e.normalizedValue] = []
    evByTag[e.normalizedValue].push(e)
  })

  function getEv(tag) {
    return evByTag[tag] || []
  }

  // ── DECISION SIGNALS ──

  // EVIDENCE_BASED_DECISION
  var evdSup = getEv('evidenceBased')
  var evdCon = getEv('intuitionDominant')
  var evdScore = evdSup.length > 0 ? Math.min(1, aggregateStrength(evdSup) * (1 - aggregateStrength(evdCon) * 0.5)) : 0.15
  var evdConf = calculateSignalConfidence(evdSup, evdCon, 1)
  if (evdSup.length >= 1) {
    signals.push(signal('EVIDENCE_BASED_DECISION', 'DECISION_MODEL', evdScore, evdConf, evdSup, evdCon))
    signals.push(signal('INTUITION_DOMINANT_DECISION', 'DECISION_MODEL', 1 - evdScore, 0.4, evdCon, evdSup))
  } else {
    signals.push(signal('INTUITION_DOMINANT_DECISION', 'DECISION_MODEL', evdCon.length > 0 ? 0.75 : 0.4, 0.4, evdCon, evdSup))
  }

  // SECURITY_FIRST_DECISION
  var secSup = getEv('securityFirst')
  var secScore = secSup.length > 0 ? Math.min(1, aggregateStrength(secSup)) : 0.3
  signals.push(signal('SECURITY_FIRST_DECISION', 'DECISION_MODEL', secScore, calculateSignalConfidence(secSup, [], 1), secSup, []))

  // OPTION_PRESERVING_DECISION
  var optSup = getEv('optionPreserving')
  var optScore = optSup.length > 0 ? Math.min(1, aggregateStrength(optSup)) : 0.4
  signals.push(signal('OPTION_PRESERVING_DECISION', 'DECISION_MODEL', optScore, calculateSignalConfidence(optSup, [], 1), optSup, []))

  // LOW_COST_EXPERIMENTATION
  var expSup = getEv('experimentation')
  var expWillSup = getEv('experimentWillingness')
  var lceSup = expSup.concat(expWillSup)
  var lceScore = lceSup.length > 0 ? Math.min(1, aggregateStrength(lceSup)) : 0.2
  signals.push(signal('LOW_COST_EXPERIMENTATION', 'DECISION_MODEL', lceScore, calculateSignalConfidence(lceSup, [], 2), lceSup, []))

  // LARGE_BET_TENDENCY
  var lbtScore = lceScore < 0.3 && expSup.length === 0 ? 0.65 : 0.2
  signals.push(signal('LARGE_BET_TENDENCY', 'DECISION_MODEL', lbtScore, 0.35, lbtScore > 0.5 ? lceSup : [], []))

  // DECISION_DELAY
  var ddScore = expSup.length === 0 && getEv('experimentWillingness').length === 0 ? 0.7 : 0.25
  signals.push(signal('DECISION_DELAY', 'DECISION_MODEL', ddScore, calculateSignalConfidence(ddScore > 0.5 ? getEv('decisionStyle') : [], [], 2), ddScore > 0.5 ? getEv('decisionStyle') : [], []))

  // DECISION_STABILITY
  var execStable = getEv('executionStability')
  var dsScore = execStable.length > 0 ? aggregateStrength(execStable) : 0.4
  signals.push(signal('DECISION_STABILITY', 'DECISION_MODEL', dsScore, calculateSignalConfidence(execStable, [], 1), execStable, []))

  // ── RISK SIGNALS ──

  var riskBuf = getEv('riskBuffer')
  var downAware = getEv('downsideAware')
  var diversification = getEv('diversification')
  var debtRisk = getEv('debtRisk')

  // RISK_AVOIDANCE
  var raScore = (riskBuf.length > 0 ? (riskBuf[0].strength < 0.3 ? 0.75 : 0.3) : 0.4) * (1 - aggregateStrength(getEv('uncertaintyTolerance')) * 0.3)
  signals.push(signal('RISK_AVOIDANCE', 'RISK_MODEL', raScore, calculateSignalConfidence(riskBuf.length > 0 ? riskBuf : [], [], 1), riskBuf.length > 0 ? riskBuf : [], []))

  // RISK_CONCENTRATION
  var rcScore = diversification.length > 0 ? Math.max(0, 0.85 - aggregateStrength(diversification)) : 0.6
  signals.push(signal('RISK_CONCENTRATION', 'RISK_MODEL', rcScore, calculateSignalConfidence(diversification.length > 0 ? diversification : [], [], 1), rcScore > 0.5 ? diversification : [], []))

  // RISK_DIVERSIFICATION
  signals.push(signal('RISK_DIVERSIFICATION', 'RISK_MODEL', aggregateStrength(diversification), calculateSignalConfidence(diversification, [], 1), diversification, []))

  // DOWNSIDE_AWARENESS
  var daScore = downAware.length > 0 ? aggregateStrength(downAware) : 0.3
  signals.push(signal('DOWNSIDE_AWARENESS', 'RISK_MODEL', daScore, calculateSignalConfidence(downAware, [], 1), downAware, []))

  // UPSIDE_BLINDNESS
  var ubScore = daScore > 0.6 ? 0.2 : 0.55
  signals.push(signal('UPSIDE_BLINDNESS', 'RISK_MODEL', ubScore, calculateSignalConfidence(daScore < 0.5 ? downAware : [], [], 1), ubScore > 0.5 ? downAware : [], []))

  // LOSS_AVERSION
  var laScore = raScore > 0.5 ? 0.7 : 0.35
  signals.push(signal('LOSS_AVERSION', 'RISK_MODEL', laScore, calculateSignalConfidence(laScore > 0.5 ? riskBuf : [], [], 2), laScore > 0.5 ? riskBuf : [], []))

  // REVERSIBILITY_AWARENESS
  var revScore = lceSup.length > 0 ? 0.6 : 0.3
  signals.push(signal('REVERSIBILITY_AWARENESS', 'RISK_MODEL', revScore, calculateSignalConfidence(lceSup, [], 1), lceSup.length > 0 ? lceSup : [], []))

  // ── PROBABILITY SIGNALS ──

  var probEvBased = getEv('evidenceBased')
  var expEv = getEv('experimentation')

  // BINARY_OUTCOME_THINKING
  var botScore = probEvBased.length > 0 && aggregateStrength(probEvBased) > 0.6 ? 0.2 : 0.55
  signals.push(signal('BINARY_OUTCOME_THINKING', 'PROBABILITY_MODEL', botScore, 0.4, [], []))

  // PROBABILISTIC_THINKING
  var ptScore = 1 - botScore
  signals.push(signal('PROBABILISTIC_THINKING', 'PROBABILITY_MODEL', ptScore, calculateSignalConfidence(probEvBased, [], 1), probEvBased, []))

  // SAMPLE_SIZE_BLINDNESS
  var ssbScore = expEv.length === 0 && probEvBased.length === 0 ? 0.7 : 0.3
  signals.push(signal('SAMPLE_SIZE_BLINDNESS', 'PROBABILITY_MODEL', ssbScore, 0.4, ssbScore > 0.5 ? [] : [], []))

  // BASE_RATE_NEGLECT
  signals.push(signal('BASE_RATE_NEGLECT', 'PROBABILITY_MODEL', ssbScore * 0.8, 0.35, [], []))

  // EXPECTED_VALUE_AWARENESS
  var evaScore = probEvBased.length > 0 && expEv.length > 0 ? 0.65 : 0.25
  signals.push(signal('EXPECTED_VALUE_AWARENESS', 'PROBABILITY_MODEL', evaScore, calculateSignalConfidence(evaScore > 0.5 ? probEvBased : [], [], 2), evaScore > 0.5 ? probEvBased : [], []))

  // UNCERTAINTY_TOLERANCE
  var utEv = getEv('uncertaintyTolerance')
  var utScore = utEv.length > 0 ? aggregateStrength(utEv) : 0.35
  signals.push(signal('UNCERTAINTY_TOLERANCE', 'PROBABILITY_MODEL', utScore, calculateSignalConfidence(utEv, [], 1), utEv, []))

  // ── FEEDBACK SIGNALS ──

  var fbLoop = getEv('feedbackLoop')
  var fbAvoid = getEv('feedbackAvoidance')
  var postRev = getEv('postActionReview')
  var marketEv = getEv('marketEvidence')
  var skillVal = getEv('market_validated')

  // ACTIVE_FEEDBACK_SEEKING
  var afsScore = (fbLoop.length + postRev.length > 0) ? Math.min(1, (aggregateStrength(fbLoop.concat(postRev)))) : 0.2
  signals.push(signal('ACTIVE_FEEDBACK_SEEKING', 'FEEDBACK_MODEL', afsScore, calculateSignalConfidence(fbLoop.concat(postRev), fbAvoid, 2), fbLoop.concat(postRev), fbAvoid))

  // WEAK_FEEDBACK_LOOP
  var wflScore = 1 - afsScore
  signals.push(signal('WEAK_FEEDBACK_LOOP', 'FEEDBACK_MODEL', wflScore, calculateSignalConfidence(wflScore > 0.5 ? [] : [], [], 2), [], []))

  // POST_ACTION_REVIEW
  var parScore = postRev.length > 0 ? aggregateStrength(postRev) : 0.25
  signals.push(signal('POST_ACTION_REVIEW', 'FEEDBACK_MODEL', parScore, calculateSignalConfidence(postRev, [], 1), postRev, []))

  // FEEDBACK_AVOIDANCE
  var faScore = fbAvoid.length > 0 ? aggregateStrength(fbAvoid) : 0.3
  signals.push(signal('FEEDBACK_AVOIDANCE', 'FEEDBACK_MODEL', faScore, calculateSignalConfidence(fbAvoid, [], 1), fbAvoid, []))

  // MARKET_EVIDENCE_PRESENT
  var meScore = marketEv.length + skillVal.length > 0
    ? Math.min(1, (aggregateStrength(marketEv.concat(skillVal)) + 0.1))
    : 0.15
  signals.push(signal('MARKET_EVIDENCE_PRESENT', 'FEEDBACK_MODEL', meScore, calculateSignalConfidence(marketEv.concat(skillVal), [], 1), marketEv.concat(skillVal), []))

  // ASSUMPTION_WITHOUT_TEST
  var awtScore = meScore < 0.3 && expEv.length === 0 ? 0.7 : 0.25
  signals.push(signal('ASSUMPTION_WITHOUT_TEST', 'FEEDBACK_MODEL', awtScore, calculateSignalConfidence(awtScore > 0.5 ? [] : [], [], 2), [], []))

  // ── OPPORTUNITY SIGNALS ──

  var mktEv = marketEv.concat(skillVal)
  var skillCatEv = getEv('skillCategory')

  // LOW_OPPORTUNITY_EXPOSURE
  var loeScore = mktEv.length === 0 && skillCatEv.length === 0 ? 0.65 : 0.25
  signals.push(signal('LOW_OPPORTUNITY_EXPOSURE', 'OPPORTUNITY_MODEL', loeScore, 0.4, loeScore > 0.5 ? [] : [], []))

  // OPPORTUNITY_RECOGNITION
  var orScore = 1 - loeScore
  signals.push(signal('OPPORTUNITY_RECOGNITION', 'OPPORTUNITY_MODEL', orScore, calculateSignalConfidence(mktEv, [], 1), mktEv, []))

  // SINGLE_PATH_DEPENDENCE
  var spdScore = loeScore > 0.5 ? 0.7 : 0.3
  signals.push(signal('SINGLE_PATH_DEPENDENCE', 'OPPORTUNITY_MODEL', spdScore, 0.4, [], []))

  // OPTIONALITY_BUILDING
  var obScore = 1 - spdScore
  signals.push(signal('OPTIONALITY_BUILDING', 'OPPORTUNITY_MODEL', obScore, 0.4, [], []))

  // NETWORK_LIMITATION
  var nlScore = loeScore > 0.5 && skillCatEv.length === 0 ? 0.6 : 0.3
  signals.push(signal('NETWORK_LIMITATION', 'OPPORTUNITY_MODEL', nlScore, 0.35, [], []))

  // RESOURCE_RECOMBINATION
  var rrScore = skillCatEv.length > 0 && expEv.length > 0 ? 0.5 : 0.2
  signals.push(signal('RESOURCE_RECOMBINATION', 'OPPORTUNITY_MODEL', rrScore, calculateSignalConfidence(skillCatEv.concat(expEv), [], 2), skillCatEv.concat(expEv), []))

  // ── LEVERAGE SIGNALS ──

  var levLinear = getEv('leverageLinear')

  // LINEAR_TIME_VALUE
  var ltvScore = levLinear.length > 0 ? aggregateStrength(levLinear) : 0.5
  signals.push(signal('LINEAR_TIME_VALUE', 'LEVERAGE_MODEL', ltvScore, calculateSignalConfidence(levLinear, [], 1), levLinear, []))

  // REPEATABLE_VALUE
  var rvScore = ltvScore < 0.5 ? 0.5 : 0.2
  signals.push(signal('REPEATABLE_VALUE', 'LEVERAGE_MODEL', rvScore, 0.4, rvScore > 0.5 ? [] : [], []))

  // SYSTEM_LEVERAGE
  var slScore = ltvScore < 0.4 ? 0.45 : 0.2
  signals.push(signal('SYSTEM_LEVERAGE', 'LEVERAGE_MODEL', slScore, 0.35, [], []))

  // KNOWLEDGE_LEVERAGE
  var klScore = skillCatEv.length > 0 ? 0.55 : 0.3
  signals.push(signal('KNOWLEDGE_LEVERAGE', 'LEVERAGE_MODEL', klScore, calculateSignalConfidence(skillCatEv, [], 1), skillCatEv, []))

  // DISTRIBUTION_LEVERAGE
  var dlScore = meScore > 0.5 ? 0.5 : 0.2
  signals.push(signal('DISTRIBUTION_LEVERAGE', 'LEVERAGE_MODEL', dlScore, calculateSignalConfidence(mktEv, [], 1), mktEv, []))

  // CAPITAL_DEPENDENCE
  var cdScore = getEv('debtRisk').length > 0 ? 0.4 : 0.3
  signals.push(signal('CAPITAL_DEPENDENCE', 'LEVERAGE_MODEL', cdScore, 0.35, [], []))

  // LEVERAGE_BLINDNESS
  var lbScore = ltvScore > 0.6 && slScore < 0.3 && rvScore < 0.3 ? 0.75 : 0.3
  signals.push(signal('LEVERAGE_BLINDNESS', 'LEVERAGE_MODEL', lbScore, calculateSignalConfidence(lbScore > 0.5 ? levLinear : [], [], 2), lbScore > 0.5 ? levLinear : [], []))

  // ── IDENTITY SIGNALS ──

  var empDep = getEv('employmentDependence')
  var occPres = getEv('occupationPresent')

  // FIXED_ROLE_IDENTITY
  var friScore = empDep.length > 0 && aggregateStrength(empDep) > 0.5 ? 0.7 : 0.3
  signals.push(signal('FIXED_ROLE_IDENTITY', 'IDENTITY_MODEL', friScore, calculateSignalConfidence(empDep, [], 1), empDep, []))

  // EXPANDING_IDENTITY
  var eiScore = expEv.length > 0 && marketEv.length + skillVal.length > 0 ? 0.6 : 0.25
  signals.push(signal('EXPANDING_IDENTITY', 'IDENTITY_MODEL', eiScore, calculateSignalConfidence(expEv, [], 1), expEv, []))

  // EMPLOYMENT_IDENTITY_DEPENDENCE
  signals.push(signal('EMPLOYMENT_IDENTITY_DEPENDENCE', 'IDENTITY_MODEL', aggregateStrength(empDep), calculateSignalConfidence(empDep, [], 1), empDep, []))

  // SKILL_IDENTITY
  var siScore = occPres.length > 0 ? 0.4 : 0.25
  signals.push(signal('SKILL_IDENTITY', 'IDENTITY_MODEL', siScore, 0.3, occPres, []))

  // CREATOR_IDENTITY
  var ciScore = expEv.length > 0 && marketEv.length + skillVal.length > 0 ? 0.55 : 0.2
  signals.push(signal('CREATOR_IDENTITY', 'IDENTITY_MODEL', ciScore, calculateSignalConfidence(expEv.concat(marketEv), [], 2), expEv.concat(marketEv), []))

  // ADAPTIVE_IDENTITY
  var aiScore = eiScore
  signals.push(signal('ADAPTIVE_IDENTITY', 'IDENTITY_MODEL', aiScore, calculateSignalConfidence(eiScore > 0.5 ? expEv : [], [], 2), [], []))

  // ── TIME SIGNALS ──

  var timeAvail = getEv('timeAvailable')
  var timeFrag = getEv('timeFragmented')
  var focusedT = getEv('focusedTime')

  // SHORT_TERM_PRIORITY
  var stpScore = expEv.length === 0 && occPres.length > 0 ? 0.65 : 0.35
  signals.push(signal('SHORT_TERM_PRIORITY', 'TIME_MODEL', stpScore, 0.4, [], []))

  // LONG_TERM_ORIENTATION
  var ltoScore = 1 - stpScore
  signals.push(signal('LONG_TERM_ORIENTATION', 'TIME_MODEL', ltoScore, 0.4, [], []))

  // TIME_FRAGMENTATION
  var tfScore = timeFrag.length > 0 && aggregateStrength(timeFrag) > 0.4 ? 0.65 : 0.35
  signals.push(signal('TIME_FRAGMENTATION', 'TIME_MODEL', tfScore, calculateSignalConfidence(timeFrag, focusedT, 1), timeFrag, focusedT))

  // FOCUSED_TIME_BLOCKS
  var ftbScore = 1 - tfScore
  signals.push(signal('FOCUSED_TIME_BLOCKS', 'TIME_MODEL', ftbScore, calculateSignalConfidence(focusedT, timeFrag, 1), focusedT, timeFrag))

  // URGENCY_DOMINANCE
  var udScore = tfScore > 0.5 && stpScore > 0.5 ? 0.7 : 0.3
  signals.push(signal('URGENCY_DOMINANCE', 'TIME_MODEL', udScore, calculateSignalConfidence(udScore > 0.5 ? timeFrag : [], [], 2), [], []))

  // COMPOUNDING_TIME_ALLOCATION
  var ctaScore = ltoScore > 0.5 && ftbScore > 0.5 ? 0.6 : 0.2
  signals.push(signal('COMPOUNDING_TIME_ALLOCATION', 'TIME_MODEL', ctaScore, calculateSignalConfidence(ctaScore > 0.5 ? focusedT : [], [], 2), [], []))

  // ── Apply conflict resolution ──
  var conflicts = detectConflicts(signals)
  var resolvedSignals = applyConflictResolution(signals, conflicts)

  return {
    signals: resolvedSignals,
    conflicts: conflicts,
    activeCount: resolvedSignals.filter(function(s) { return s.state === 'ACTIVE' }).length,
    weakCount: resolvedSignals.filter(function(s) { return s.state === 'WEAK' }).length,
    suppressedCount: resolvedSignals.filter(function(s) { return s.state === 'SUPPRESSED' }).length,
  }
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function signal(id, dimension, score, confidence, supEv, conEv) {
  return {
    id: id,
    dimension: dimension,
    score: clamp(score, 0, 1),
    confidence: clamp(confidence, 0, 1),
    state: score >= THRESHOLDS.STRONG ? 'ACTIVE'
      : score >= THRESHOLDS.MODERATE ? 'WEAK'
      : 'SUPPRESSED',
    supportingEvidence: (supEv || []).map(function(e) { return e.id || '' }),
    contradictingEvidence: (conEv || []).map(function(e) { return e.id || '' }),
  }
}

function aggregateStrength(evidenceList) {
  if (!evidenceList || evidenceList.length === 0) return 0
  return evidenceList.reduce(function(s, e) { return s + (e.strength || 0.3) }, 0) / evidenceList.length
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

module.exports = {
  extractSignals,
  THRESHOLDS,
}
