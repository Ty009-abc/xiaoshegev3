/**
 * cloudfunctions/generateAiReport/lib/config/reportUtils.js
 *
 * Runtime assertion & normalization utilities for report values.
 * Keep here (not engine/) to avoid relative path issues in cloud function runtime.
 *
 * @version RC8.2
 */

const LIMITS = require('./reportLimits')

/**
 * Normalize potentialIndex / wealthProbability object to valid range.
 * Non-destructive: returns new object, does not mutate input.
 */
function normalizePotentialIndex(index) {
  if (!index || typeof index !== 'object') return index

  var clamp = function clamp(v, min, max) {
    var n = Number(v)
    if (isNaN(n)) return min
    return Math.max(min, Math.min(max, n))
  }

  return {
    today: clamp(index.today, LIMITS.MIN_POTENTIAL_INDEX, LIMITS.MAX_POTENTIAL_INDEX),
    after30: clamp(index.after30, LIMITS.MIN_POTENTIAL_INDEX, LIMITS.MAX_POTENTIAL_INDEX),
    after90: clamp(index.after90, LIMITS.MIN_POTENTIAL_INDEX, LIMITS.MAX_POTENTIAL_INDEX),
    after365: clamp(index.after365, LIMITS.MIN_POTENTIAL_INDEX, LIMITS.MAX_POTENTIAL_INDEX),
    metricType: index.metricType || LIMITS.METRIC_TYPE,
    isProbability: index.isProbability !== undefined ? index.isProbability : LIMITS.IS_PROBABILITY,
    maxValue: LIMITS.MAX_POTENTIAL_INDEX,
  }
}

/**
 * Assert that ALL values in a potentialIndex object are within valid range.
 * Returns false (and logs) if any value is out of bounds.
 */
function assertPotentialIndex(index) {
  if (!index || typeof index !== 'object') return true // skip non-object

  var values = [
    index.today,
    index.after30,
    index.after90,
    index.after365,
  ].filter(function (v) { return typeof v === 'number' && isFinite(v) })

  var overflow = values.some(function (v) {
    return v < LIMITS.MIN_POTENTIAL_INDEX || v > LIMITS.MAX_POTENTIAL_INDEX
  })

  if (overflow) {
    console.error(
      '[RC8][POTENTIAL_INDEX_OUT_OF_RANGE]',
      JSON.stringify({
        values: values,
        max: LIMITS.MAX_POTENTIAL_INDEX,
        min: LIMITS.MIN_POTENTIAL_INDEX,
      })
    )
    return false
  }

  return true
}

module.exports = {
  assertPotentialIndex,
  normalizePotentialIndex,
}
