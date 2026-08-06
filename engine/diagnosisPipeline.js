/**
 * RC8.1 Diagnosis Pipeline
 *
 * Orchestrates the 4-layer cognitive diagnosis engine:
 *   Layer 1: Behavior Tag Extractor
 *   Layer 2: Wealth Archetype Engine
 *   Layer 3: Core Bottleneck Engine
 *   Layer 4: One Strategy Engine
 *
 * Output: Unified diagnosis result consumed by Card01-06 poster renderer.
 */

var behaviorExtractor = require('./behavior/behaviorTagExtractor')
var wealthEngine = require('./wealth/wealthArchetypeEngine')
var bottleneckEngine = require('./bottleneck/coreBottleneckEngine')
var strategyEngine = require('./strategy/oneStrategyEngine')

/**
 * Run full diagnosis pipeline on raw questionnaire answers.
 *
 * @param {Object} answers - { income: "...", learning: "...", decision: "...", ... }
 * @param {Object} [options]
 * @param {number} [options.minTagWeight=0.3]
 * @param {number} [options.maxTags=50]
 * @returns {Object} diagnosisResult - unified output for poster renderer
 */
function runDiagnosis(answers, options) {
  options = options || {}

  // ─── Layer 1: Behavior Tags ───
  var behaviorResult = behaviorExtractor.extractTags(answers, {
    minWeight: options.minTagWeight || 0.3,
    maxTags: options.maxTags || 50
  })

  // ─── Layer 2: Wealth Archetype ───
  var archetypeResult = wealthEngine.identifyArchetype(behaviorResult.tags)

  // ─── Layer 3: Core Bottleneck ───
  var bottleneckResult = bottleneckEngine.identifyBottleneck(
    behaviorResult.tags,
    archetypeResult
  )

  // ─── Layer 4: One Strategy ───
  var strategyResult = strategyEngine.determineStrategy(
    bottleneckResult,
    archetypeResult,
    behaviorResult.tags
  )

  // ─── Assemble Unified Diagnosis ───
  var diagnosis = {
    // Metadata
    engineVersion: 'RC8.1',
    timestamp: new Date().toISOString(),

    // Layer outputs
    behaviorTags: behaviorResult.tags,
    tagStats: behaviorResult.stats,
    wealthProfile: {
      primary: archetypeResult.primary,
      primaryTitle: archetypeResult.primaryTitle,
      primaryTagline: archetypeResult.primaryTagline,
      primaryTraits: archetypeResult.primaryTraits,
      secondary: archetypeResult.secondary,
      secondaryTitle: archetypeResult.secondaryTitle,
      confidence: archetypeResult.confidence
    },
    bottleneck: {
      id: bottleneckResult.bottleneck,
      label: bottleneckResult.label,
      description: bottleneckResult.description,
      reason: bottleneckResult.reason,
      confidence: bottleneckResult.confidence,
      solution: bottleneckResult.solution,
      candidates: bottleneckResult.candidates
    },
    strategy: {
      id: strategyResult.strategy,
      label: strategyResult.strategyLabel,
      tagline: strategyResult.strategyTagline,
      description: strategyResult.strategyDescription,
      duration: strategyResult.duration,
      milestones: strategyResult.milestones,
      day1Mission: strategyResult.day1Mission,
      confidence: strategyResult.confidence,
      alternatives: strategyResult.alternatives
    },

    // Summary for prompt injection
    summaryText: buildSummary(behaviorResult, archetypeResult, bottleneckResult, strategyResult),

    // Raw results for debugging
    _raw: {
      behavior: behaviorResult,
      archetype: archetypeResult,
      bottleneck: bottleneckResult,
      strategy: strategyResult
    }
  }

  return diagnosis
}

/**
 * Build human-readable diagnosis summary for AI prompt injection.
 */
function buildSummary(behavior, archetype, bottleneck, strategy) {
  var lines = []

  lines.push('═══ RC8.1 COGNITIVE DIAGNOSIS ═══')
  lines.push('')

  lines.push('【行为标签】(' + behavior.stats.totalTags + ' tags)')
  lines.push(behaviorExtractor.formatTagSummary(behavior.tags))
  lines.push('')

  lines.push('【财富人格】')
  lines.push(archetype.summary)
  lines.push('')

  lines.push('【核心瓶颈】')
  lines.push(bottleneck.summary)
  lines.push('')

  lines.push('【唯一战略】')
  lines.push(strategy.summary)
  lines.push('')

  return lines.join('\n')
}

/**
 * Quick validation: ensure diagnosis meets RC8.1 constraints.
 * @returns {Object} { valid, errors, warnings }
 */
function validateDiagnosis(diagnosis) {
  var errors = []
  var warnings = []

  // 1. Tag count 20-50
  if (diagnosis.behaviorTags.length < 10) {
    warnings.push('Behavior tags < 10 — low diagnostic confidence')
  }
  if (diagnosis.behaviorTags.length > 50) {
    errors.push('Behavior tags > 50 — exceeds maximum')
  }

  // 2. Single archetype
  if (!diagnosis.wealthProfile.primary || diagnosis.wealthProfile.primary === 'UNDETERMINED') {
    errors.push('Wealth archetype UNDETERMINED')
  }

  // 3. Single bottleneck
  if (!diagnosis.bottleneck.id || diagnosis.bottleneck.id === 'UNKNOWN') {
    errors.push('Bottleneck UNKNOWN')
  }

  // 4. Single strategy
  if (!diagnosis.strategy.id) {
    errors.push('No strategy selected')
  }

  // 5. Confidence floors
  if (diagnosis.bottleneck.confidence < 0.3) {
    warnings.push('Low bottleneck confidence: ' + diagnosis.bottleneck.confidence)
  }
  if (diagnosis.strategy.confidence < 0.2) {
    warnings.push('Low strategy confidence: ' + diagnosis.strategy.confidence)
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  }
}

module.exports = {
  runDiagnosis: runDiagnosis,
  validateDiagnosis: validateDiagnosis,
  buildSummary: buildSummary
}
