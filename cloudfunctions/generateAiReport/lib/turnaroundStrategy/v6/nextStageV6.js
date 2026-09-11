'use strict'
/**
 * turnaroundStrategy/v6/nextStageV6.js
 *
 * Allowed productive stage transitions. Semantic recommendation only.
 * Never claims the user will achieve it.
 */

const TRANSITIONS = {
  THINKING: ['RESEARCHING', 'STARTED'],
  RESEARCHING: ['STARTED'],
  LEARNING: ['STARTED', 'TESTING'],
  STARTED: ['TESTING'],
  TESTING: ['EARLY_TRACTION'],
  EARLY_TRACTION: ['STABLE_TRACTION'],
  STABLE_TRACTION: ['REPEATABLE_SYSTEM']
}

/**
 * Deterministic pick: first allowed target, refined by bottleneck when it maps
 * cleanly to a single allowed target.
 */
function recommendNextStage (currentStage, primaryBottleneck) {
  const allowed = TRANSITIONS[currentStage] || []
  if (allowed.length === 0) return { currentStage, recommendedNextStage: null, allowed: [] }

  // Bottleneck-informed preference, constrained to allowed targets.
  const prefer = {
    DIRECTION_GAP: 'STARTED',
    ACTION_GAP: 'STARTED',
    CONSISTENCY_GAP: 'TESTING',
    VALIDATION_GAP: 'EARLY_TRACTION',
    REPEATABILITY_GAP: 'STABLE_TRACTION'
  }
  const wanted = prefer[primaryBottleneck]
  const recommended = (wanted && allowed.includes(wanted)) ? wanted : allowed[0]
  return { currentStage, recommendedNextStage: recommended, allowed }
}

module.exports = { TRANSITIONS, recommendNextStage }
