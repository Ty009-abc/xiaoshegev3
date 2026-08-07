/**
 * engine/worldModel/validators.js
 *
 * RC8.3 Ontology Validator.
 *
 * Validates that all definitions are internally consistent and complete.
 * This runs at import time (not runtime) to catch definition errors early.
 *
 * Also provides runtime validators for World Model output objects.
 *
 * @version world_model_v1
 */

// ═══════════════════════════════════════════════════════════════
// ONTOLOGY VALIDATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Validate that the ontology definitions are internally consistent.
 * Returns an array of violations. Empty array = PASS.
 */
function validateOntology() {
  const violations = []

  // 1. Check all required definitions are present
  try {
    const ontology = require('./ontology')
    const signals = require('./signalDefinitions')
    const archetypes = require('./archetypeDefinitions')
    const blindSpots = require('./blindSpotDefinitions')
    const strategies = require('./strategyDefinitions')
    const scenarios = require('./scenarioDefinitions')

    // ── Ontology checks ──
    if (!ontology.DIMENSIONS) {
      violations.push('ONTOLOGY_MISSING_DIMENSIONS')
    } else {
      const dimKeys = Object.keys(ontology.DIMENSIONS)
      if (dimKeys.length !== 8) {
        violations.push('ONTOLOGY_DIMENSION_COUNT_EXPECTED_8_GOT_' + dimKeys.length)
      }
      dimKeys.forEach(function(dimId) {
        const dim = ontology.DIMENSIONS[dimId]
        if (!dim.id || !dim.label || !dim.question || !dim.states) {
          violations.push('ONTOLOGY_DIMENSION_INCOMPLETE_' + dimId)
        }
      })
    }

    // ── Signal checks ──
    const allSignalIds = signals.getSignalIds()
    const categoryNames = ['DECISION_MODEL', 'RISK_MODEL', 'PROBABILITY_MODEL', 'FEEDBACK_MODEL', 'OPPORTUNITY_MODEL', 'LEVERAGE_MODEL', 'IDENTITY_MODEL', 'TIME_MODEL']
    var totalByCategory = 0
    categoryNames.forEach(function(cat) {
      const catSignals = signals.getSignalsByCategory(cat)
      const catCount = Object.keys(catSignals).length
      if (catCount === 0) {
        violations.push('SIGNAL_CATEGORY_EMPTY_' + cat)
      }
      totalByCategory += catCount
    })
    if (totalByCategory !== allSignalIds.length) {
      violations.push('SIGNAL_COUNT_MISMATCH_TOTAL_' + allSignalIds.length + '_BY_CATEGORY_' + totalByCategory)
    }

    // Check each signal has required fields
    allSignalIds.forEach(function(sid) {
      const sig = signals.getSignalById(sid)
      if (!sig) {
        violations.push('SIGNAL_NOT_FOUND_BY_ID_' + sid)
        return
      }
      if (!sig.id) violations.push('SIGNAL_MISSING_ID_' + sid)
      if (!sig.name) violations.push('SIGNAL_MISSING_NAME_' + sid)
      if (!sig.description) violations.push('SIGNAL_MISSING_DESCRIPTION_' + sid)
      if (sig.minConfidence === undefined) violations.push('SIGNAL_MISSING_MIN_CONFIDENCE_' + sid)
      if (!sig.conflictsWith) violations.push('SIGNAL_MISSING_CONFLICTS_' + sid)
      // Check conflict symmetry
      if (sig.conflictsWith) {
        sig.conflictsWith.forEach(function(conflictId) {
          const conflictSig = signals.getSignalById(conflictId)
          if (conflictSig && conflictSig.conflictsWith) {
            if (conflictSig.conflictsWith.indexOf(sid) < 0) {
              violations.push('SIGNAL_CONFLICT_NOT_SYMMETRIC_' + sid + '_vs_' + conflictId)
            }
          }
        })
      }
    })

    // ── Archetype checks ──
    const archetypeIds = archetypes.getArchetypeIds()
    if (archetypeIds.length !== 7) {
      violations.push('ARCHETYPE_COUNT_EXPECTED_7_GOT_' + archetypeIds.length)
    }
    archetypeIds.forEach(function(aid) {
      const arch = archetypes.getArchetypeById(aid)
      if (!arch) {
        violations.push('ARCHETYPE_NOT_FOUND_' + aid)
        return
      }
      if (!arch.id || !arch.label || !arch.description) {
        violations.push('ARCHETYPE_INCOMPLETE_' + aid)
      }
      if (!arch.signalAffinity || !arch.signalAffinity.high || !arch.signalAffinity.low) {
        violations.push('ARCHETYPE_MISSING_SIGNAL_AFFINITY_' + aid)
      }
      if (!arch.contract || !arch.contract.mustNotBeTriggeredBy) {
        violations.push('ARCHETYPE_MISSING_CONTRACT_' + aid)
      }
    })

    // ── Blind Spot checks ──
    const blindSpotIds = blindSpots.getBlindSpotIds()
    if (blindSpotIds.length !== 9) {
      violations.push('BLIND_SPOT_COUNT_EXPECTED_9_GOT_' + blindSpotIds.length)
    }
    blindSpotIds.forEach(function(bid) {
      const bs = blindSpots.getBlindSpotById(bid)
      if (!bs) {
        violations.push('BLIND_SPOT_NOT_FOUND_' + bid)
        return
      }
      if (!bs.id || !bs.label || !bs.mechanism || !bs.cognitiveRoot || !bs.questionAnswered) {
        violations.push('BLIND_SPOT_INCOMPLETE_' + bid)
      }
      if (!bs.signalProfile || !bs.signalProfile.supporting || bs.signalProfile.supporting.length < 2) {
        violations.push('BLIND_SPOT_INSUFFICIENT_SIGNALS_' + bid)
      }
      if (!bs.contract || !bs.contract.isNot) {
        violations.push('BLIND_SPOT_MISSING_CONTRACT_' + bid)
      }
    })

    // Check prohibited blind spots are not in definitions
    const prohibitedBs = blindSpots.PROHIBITED_BLIND_SPOTS
    prohibitedBs.forEach(function(pbid) {
      if (blindSpots.getBlindSpotById(pbid)) {
        violations.push('BLIND_SPOT_PROHIBITED_STILL_DEFINED_' + pbid)
      }
    })

    // ── Strategy checks ──
    const strategyIds = strategies.getStrategyIds()
    if (strategyIds.length !== 9) {
      violations.push('STRATEGY_COUNT_EXPECTED_9_GOT_' + strategyIds.length)
    }
    strategyIds.forEach(function(sid) {
      const strat = strategies.getStrategyById(sid)
      if (!strat) {
        violations.push('STRATEGY_NOT_FOUND_' + sid)
        return
      }
      if (!strat.id || !strat.label || !strat.mechanism) {
        violations.push('STRATEGY_INCOMPLETE_' + sid)
      }
      if (!strat.targetBlindSpot) {
        violations.push('STRATEGY_MISSING_TARGET_BLIND_SPOT_' + sid)
      } else {
        // Verify target blind spot exists
        if (!blindSpots.getBlindSpotById(strat.targetBlindSpot)) {
          violations.push('STRATEGY_TARGET_BLIND_SPOT_INVALID_' + sid + '_targets_' + strat.targetBlindSpot)
        }
      }
      if (!strat.experimentTemplates || strat.experimentTemplates.length < 1) {
        violations.push('STRATEGY_MISSING_EXPERIMENTS_' + sid)
      }
      if (!strat.successSignal || !strat.reviewWindow || !strat.stopCondition) {
        violations.push('STRATEGY_MISSING_SUCCESS_CRITERIA_' + sid)
      }
    })

    // Check prohibited strategies are not in definitions
    const prohibitedStrat = strategies.PROHIBITED_STRATEGIES
    prohibitedStrat.forEach(function(psid) {
      if (strategies.getStrategyById(psid)) {
        violations.push('STRATEGY_PROHIBITED_STILL_DEFINED_' + psid)
      }
    })

    // ── Scenario checks ──
    const framework = scenarios.getScenarioFramework()
    if (!framework.CURRENT_MODEL_CONTINUES || !framework.WORLD_MODEL_UPGRADED) {
      violations.push('SCENARIO_FRAMEWORK_INCOMPLETE')
    }

    const dimPatterns = scenarios.getDimensionScenarioPatterns()
    const dimPatternKeys = Object.keys(dimPatterns)
    if (dimPatternKeys.length !== 8) {
      violations.push('SCENARIO_DIMENSION_PATTERNS_COUNT_EXPECTED_8_GOT_' + dimPatternKeys.length)
    }

    // ── Cross-reference: every archetype signal affinity references valid signals ──
    archetypeIds.forEach(function(aid) {
      const arch = archetypes.getArchetypeById(aid)
      if (arch && arch.signalAffinity) {
        ;(arch.signalAffinity.high || []).forEach(function(sigId) {
          if (!signals.getSignalById(sigId)) {
            violations.push('ARCHETYPE_SIGNAL_REF_INVALID_' + aid + '_HIGH_' + sigId)
          }
        })
        ;(arch.signalAffinity.low || []).forEach(function(sigId) {
          if (!signals.getSignalById(sigId)) {
            violations.push('ARCHETYPE_SIGNAL_REF_INVALID_' + aid + '_LOW_' + sigId)
          }
        })
      }
    })

    return {
      valid: violations.length === 0,
      violations: violations,
      summary: {
        totalSignals: allSignalIds.length,
        totalArchetypes: archetypeIds.length,
        totalBlindSpots: blindSpotIds.length,
        totalStrategies: strategyIds.length,
        totalDimensions: 8,
        totalScenarioPatterns: dimPatternKeys.length,
      },
    }
  } catch (e) {
    violations.push('ONTOLOGY_VALIDATION_EXCEPTION_' + e.message)
    return {
      valid: false,
      violations: violations,
      summary: null,
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// RUNTIME VALIDATORS (for World Model output)
// ═══════════════════════════════════════════════════════════════

/**
 * Validate a complete World Model output object against the contract.
 */
function validateWorldModelOutput(wmOutput) {
  const errors = []

  if (!wmOutput) return { valid: false, errors: ['NULL_OUTPUT'] }
  if (wmOutput.version !== 'world_model_v1') {
    errors.push('INVALID_VERSION')
  }
  if (!wmOutput.behaviorSignals) errors.push('MISSING_BEHAVIOR_SIGNALS')
  if (!wmOutput.worldModel) errors.push('MISSING_WORLD_MODEL')
  if (!wmOutput.cognitiveArchetype) errors.push('MISSING_ARCHETYPE')
  if (!wmOutput.cognitiveBlindSpot) errors.push('MISSING_BLIND_SPOT')
  if (!wmOutput.worldStrategy) errors.push('MISSING_STRATEGY')
  if (!wmOutput.scenarioSimulation) errors.push('MISSING_SCENARIO')
  if (!wmOutput.trace) errors.push('MISSING_TRACE')

  return { valid: errors.length === 0, errors: errors }
}

/**
 * Check a string for prohibited expressions (prediction, fortune-telling, chicken-soup).
 */
function scanForProhibitedExpressions(text) {
  const { PROHIBITED_EXPRESSIONS } = require('./contracts')
  const violations = []

  var categories = ['prediction', 'fortuneTelling', 'chickenSoup', 'commercialDirectionAsDiagnosis']
  categories.forEach(function(cat) {
    var patterns = PROHIBITED_EXPRESSIONS[cat] || []
    patterns.forEach(function(pattern) {
      if (pattern.test(text)) {
        violations.push({
          category: cat,
          matched: pattern.source,
        })
      }
    })
  })

  return { clean: violations.length === 0, violations: violations }
}

/**
 * Validate that evidence meets minimum requirements.
 */
function validateEvidence(evidence, minRequired) {
  minRequired = minRequired || 2
  if (!Array.isArray(evidence)) return { valid: false, reason: 'NO_EVIDENCE_ARRAY' }
  if (evidence.length < minRequired) {
    return { valid: false, reason: 'INSUFFICIENT_EVIDENCE_' + evidence.length + '_NEED_' + minRequired }
  }
  return { valid: true }
}

module.exports = {
  validateOntology,
  validateWorldModelOutput,
  scanForProhibitedExpressions,
  validateEvidence,
}
