/**
 * engine/worldModel/contractMigrationUtils.js
 *
 * RC8.3 C3-001A — Contract Migration Utilities.
 *
 * Transforms free-text executable rules into structured { humanRule, predicate } format.
 *
 * MIGRATION MAP:
 *   activationRule.description  → activationRule.humanRule
 *   activationRule.modeA/modeB  → activationRule.predicate (OR node)
 *   suppressionRule.description → suppressionRule.humanRule
 *   suppressionRule.triggers[]  → suppressionRule.predicate (OR of AND nodes)
 *   uncertaintyRule.description → uncertaintyRule.humanRule
 *   uncertaintyRule.conditions[] → uncertaintyRule.predicate
 *
 * @version world_model_v3
 * @sprint c3-001a
 */

const {
  and, or, not,
  signalPresent, signalAbsent,
  confidenceGte, confidenceLte,
  evidencePresent, evidenceAbsent,
  sourceTypeIs,
  independentEvidenceCountGte, supportCountGte, contradictionCountGte,
  signalPresentWithConfidenceGte,
  signalAbsentOrBelowThreshold,
  independentSupportCountGte,
} = require('./predicateSchema')

// ═══════════════════════════════════════════════════════════════
// PRESET ACTIVATION PREDICATES
// ═══════════════════════════════════════════════════════════════

/**
 * Standard Mode A activation: 2 independent supporting evidence items.
 */
const MODE_A_TWO_SUPPORTING = independentSupportCountGte(2)

/**
 * Standard Mode B activation: 1 strong + 1 contextual from independent origins.
 */
const MODE_B_STRONG_PLUS_CONTEXT = and([
  supportCountGte(1), // covers contextual match
  supportCountGte(2), // overall: strong + contextual = 2 supporting
  independentEvidenceCountGte(2),
])

/**
 * Combined Mode A OR Mode B activation predicate.
 */
function standardActivation() {
  return or([
    MODE_A_TWO_SUPPORTING,
    MODE_B_STRONG_PLUS_CONTEXT,
  ])
}

// ═══════════════════════════════════════════════════════════════
// EVIDENCE-REFERENCED ACTIVATION
// ═══════════════════════════════════════════════════════════════

/**
 * Mode A: 2 specific evidence items present from independent origins.
 */
function activationTwoEvidence(itemA, itemB) {
  return and([
    evidencePresent(itemA.sourceType, itemA.reference),
    evidencePresent(itemB.sourceType, itemB.reference),
    independentEvidenceCountGte(2),
  ])
}

/**
 * Mode B: 1 strong + 1 contextual from independent origins.
 */
function activationStrongPlusContext(strongItem, contextItem) {
  return and([
    evidencePresent(strongItem.sourceType, strongItem.reference),
    evidencePresent(contextItem.sourceType, contextItem.reference),
    independentEvidenceCountGte(2),
  ])
}

/**
 * Activation Mode A with numbered evidence from a contract.
 *
 * @param {Array} requiredEvidence - contract's requiredEvidence array
 * @param {Array} contextualEvidence - contract's contextualEvidence array
 * @returns {Object} OR predicate: (req0 AND req1) OR (req0 AND ctx0) OR ...
 */
function activationFromEvidence(requiredEvidence, contextualEvidence) {
  var options = []

  // At least 2 required items → (req0 AND req1)
  if (requiredEvidence.length >= 2) {
    options.push(tokenEvidenceAnd(requiredEvidence[0], requiredEvidence[1]))
  }

  // 1 required + 1 contextual combinations
  if (requiredEvidence.length >= 1) {
    contextualEvidence.forEach(function (ctx) {
      options.push(tokenEvidenceAnd(requiredEvidence[0], ctx))
    })
  }

  // 2 contextual combinations
  ctxCombos(contextualEvidence).forEach(function (combo) {
    options.push(tokenEvidenceAnd(combo[0], combo[1]))
  })

  // All require independence
  options = options.map(function (opt) {
    return and([
      opt.conditions ? opt.conditions[0] : opt,
      opt.conditions ? opt.conditions[1] : null,
      independentEvidenceCountGte(2),
    ].filter(Boolean))
  })

  return or(options)
}

function tokenEvidenceAnd(a, b) {
  return and([
    evidencePresent(a.sourceType, a.reference),
    evidencePresent(b.sourceType, b.reference),
  ])
}

function ctxCombos(items) {
  if (items.length < 2) return []
  var combos = []
  for (var i = 0; i < items.length; i++) {
    for (var j = i + 1; j < items.length; j++) {
      combos.push([items[i], items[j]])
    }
  }
  return combos
}

// ═══════════════════════════════════════════════════════════════
// SUPPRESSION PREDICATE PATTERNS
// ═══════════════════════════════════════════════════════════════

/**
 * Single signal suppression trigger: SIGNAL present AND confidence ≥ threshold.
 */
function suppressSignalConf(signalId, threshold) {
  return signalPresentWithConfidenceGte(signalId, threshold)
}

/**
 * Simple signal presence suppression (no confidence threshold).
 */
function suppressSignalDetected(signalId) {
  return signalPresent(signalId)
}

/**
 * Multi-signal AND suppression: all signals must be present at their thresholds.
 */
function suppressSignalAndConf(pairs) {
  return and(pairs.map(function (p) {
    return signalPresentWithConfidenceGte(p[0], p[1])
  }))
}

/**
 * Strong contradiction: 2+ independent contradictory evidence items.
 */
var STRONG_CONTRADICTION = and([
  contradictionCountGte(2),
  independentEvidenceCountGte(2),
])

/**
 * Default suppression: either strong contradiction OR any suppression trigger.
 */
function suppressDefault(triggers) {
  var opts = [STRONG_CONTRADICTION]
  triggers.forEach(function (t) { opts.push(t) })
  return or(opts)
}

// ═══════════════════════════════════════════════════════════════
// UNCERTAINTY PREDICATE PATTERNS
// ═══════════════════════════════════════════════════════════════

/**
 * Evidence below activation threshold: support < 2 OR independent < 2.
 */
var UNCERTAINTY_BELOW_THRESHOLD = or([
  not(supportCountGte(2)),
  not(independentEvidenceCountGte(2)),
])

/**
 * Uncertainty when evidence count is insufficient.
 */
function uncertaintyInsufficient(minRequired) {
  return not(supportCountGte(minRequired))
}

/**
 * Uncertainty: no contradiction but insufficient support.
 */
var UNCERTAINTY_NO_CONTRADICTION_NO_SUPPORT = and([
  not(contradictionCountGte(1)),
  not(supportCountGte(2)),
])

// ═══════════════════════════════════════════════════════════════
// MIGRATION TRANSFORM FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Migrates activationRule from old format to { humanRule, predicate }.
 *
 * @param {Object} oldRule - { description, modeA, modeB, vetoConditions }
 * @param {Array} requiredEvidence
 * @param {Array} contextualEvidence
 * @param {Array} strongEvidence
 * @returns {Object} { humanRule, predicate }
 */
function migrateActivationRule(oldRule, requiredEvidence, contextualEvidence, strongEvidence) {
  if (!oldRule) return null

  var humanRule = oldRule.description || 'Activation rule'

  // Build predicate: Mode A OR Mode B
  var modeAPred = MODE_A_TWO_SUPPORTING
  var modeBPred = MODE_B_STRONG_PLUS_CONTEXT

  // Combine
  var predicate = or([modeAPred, modeBPred])

  return { humanRule: humanRule, predicate: predicate }
}

/**
 * Migrates suppressionRule from old format to { humanRule, predicate }.
 *
 * Parses trigger strings into structured predicates.
 *
 * Known trigger patterns:
 *   "SIGNAL_ID detected with confidence ≥ X"
 *   "SIGNAL_ID detected ≥ X"
 *   "SIGNAL_ID detected — description"
 *   "SIGNAL_A detected ≥ X and SIGNAL_B detected"
 *
 * @param {Object} oldRule - { description, triggers, partialSuppression }
 * @param {Array} contradictoryEvidence
 * @returns {Object} { humanRule, predicate }
 */
function migrateSuppressionRule(oldRule, contradictoryEvidence) {
  if (!oldRule) return null

  var humanRule = oldRule.description || 'Suppression rule'

  var parsedTriggers = []

  // Parse each trigger string
  if (oldRule.triggers && Array.isArray(oldRule.triggers)) {
    oldRule.triggers.forEach(function (trigger) {
      var parsed = parseSuppressionTrigger(trigger)
      if (parsed) parsedTriggers.push(parsed)
    })
  }

  // Default: strong contradiction + all parsed triggers
  var conditions = []

  // Strong contradiction predicate
  conditions.push(STRONG_CONTRADICTION)

  // Each parsed trigger
  parsedTriggers.forEach(function (t) { conditions.push(t) })

  var predicate = conditions.length > 1 ? or(conditions) : conditions[0]

  return { humanRule: humanRule, predicate: predicate }
}

/**
 * Parses a single suppression trigger string into a structured predicate.
 *
 * @param {string} trigger
 * @returns {Object|null}
 */
function parseSuppressionTrigger(trigger) {
  if (typeof trigger !== 'string') return null

  // Pattern 1: "SIGNAL_ID detected ≥ X" or "SIGNAL_ID detected with confidence ≥ X"
  var confMatch = trigger.match(/^([A-Z_]{3,})\s+detected\s*(?:with\s+confidence\s*)?[≥>=]\s*([\d.]+)/i)
  if (confMatch) {
    return signalPresentWithConfidenceGte(confMatch[1], parseFloat(confMatch[2]))
  }

  // Pattern 2: "SIGNAL_ID detected — ..." (no confidence threshold)
  var signalMatch = trigger.match(/^([A-Z_]{3,})\s+detected\s*[-—–]/i)
  if (signalMatch) {
    return signalPresent(signalMatch[1])
  }

  // Pattern 3: "SIGNAL_A ≥ X and SIGNAL_B" or "SIGNAL_A detected ≥ X and SIGNAL_B detected"
  var multiMatch = trigger.match(/([A-Z_]{3,})\s+(?:detected\s*)?[≥>=]\s*([\d.]+)\s+and\s+([A-Z_]{3,})\s+detected/i)
  if (multiMatch) {
    return and([
      signalPresentWithConfidenceGte(multiMatch[1], parseFloat(multiMatch[2])),
      signalPresent(multiMatch[3]),
    ])
  }

  // Pattern 4: "SIGNAL_A and SIGNAL_B detected"
  var multiSignal = trigger.match(/([A-Z_]{3,})\s+detected\s+and\s+([A-Z_]{3,})\s+detected/i)
  if (multiSignal) {
    return and([
      signalPresent(multiSignal[1]),
      signalPresent(multiSignal[2]),
    ])
  }

  // Non-structural trigger (free-text) — return null (will be excluded from predicate)
  return null
}

/**
 * Migrates uncertaintyRule from old format to { humanRule, predicate }.
 *
 * @param {Object} oldRule - { description, conditions, resolution }
 * @param {number} minEvidence
 * @returns {Object} { humanRule, predicate }
 */
function migrateUncertaintyRule(oldRule, minEvidence) {
  if (!oldRule) return null

  var humanRule = oldRule.description || 'Uncertainty rule'

  // When evidence is insufficient to activate AND no contradiction suppresses
  var predicate = and([
    not(supportCountGte(minEvidence || 2)),
    not(independentEvidenceCountGte(minEvidence || 2)),
  ])

  return { humanRule: humanRule, predicate: predicate }
}

// ═══════════════════════════════════════════════════════════════
// SIGNAL-LEVEL MIGRATION
// ═══════════════════════════════════════════════════════════════

/**
 * Migrates one signal's rules to structured predicate format.
 *
 * @param {Object} contract - the signal's evidence contract
 * @returns {Object} new contract with { humanRule, predicate } rules
 */
function migrateSignalRules(contract) {
  var migrated = Object.assign({}, contract)

  // Migrate activation
  if (contract.activationRule && !contract.activationRule.predicate) {
    migrated.activationRule = migrateActivationRule(
      contract.activationRule,
      contract.requiredEvidence,
      contract.contextualEvidence,
      contract.strongEvidence
    )
  }

  // Migrate suppression
  if (contract.suppressionRule && !contract.suppressionRule.predicate) {
    migrated.suppressionRule = migrateSuppressionRule(
      contract.suppressionRule,
      contract.contradictoryEvidence
    )
  }

  // Migrate uncertainty
  if (contract.uncertaintyRule && !contract.uncertaintyRule.predicate) {
    migrated.uncertaintyRule = migrateUncertaintyRule(
      contract.uncertaintyRule,
      contract.minimumEvidence
    )
  }

  return migrated
}

// ═══════════════════════════════════════════════════════════════
// BULK MIGRATION
// ═══════════════════════════════════════════════════════════════

/**
 * Migrates all signals in a SECONDARY_SIGNAL_EVIDENCE_MAP.
 *
 * @param {Object} evidenceMap - the frozen evidence map
 * @returns {Object} new map with migrated rules
 */
function migrateAllSignals(evidenceMap) {
  var migrated = {}
  Object.keys(evidenceMap).forEach(function (signalId) {
    migrated[signalId] = migrateSignalRules(evidenceMap[signalId])
  })
  return Object.freeze(migrated)
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  // Presets
  MODE_A_TWO_SUPPORTING,
  MODE_B_STRONG_PLUS_CONTEXT,
  STRONG_CONTRADICTION,
  standardActivation,
  activationFromEvidence,
  activationTwoEvidence,
  activationStrongPlusContext,
  suppressSignalConf,
  suppressSignalDetected,
  suppressSignalAndConf,
  suppressDefault,
  UNCERTAINTY_BELOW_THRESHOLD,
  uncertaintyInsufficient,
  UNCERTAINTY_NO_CONTRADICTION_NO_SUPPORT,

  // Migration
  parseSuppressionTrigger,
  migrateActivationRule,
  migrateSuppressionRule,
  migrateUncertaintyRule,
  migrateSignalRules,
  migrateAllSignals,
}
