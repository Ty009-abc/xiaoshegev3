/**
 * engine/worldModel/blindSpotFamilyDefinitions.js
 *
 * RC8.3 C3-002A-R1 — Blind Spot Family Definitions (C1-aligned).
 *
 * DERIVES family membership from the authoritative C1 BLIND_SPOT_FAMILIES.
 * Does NOT introduce a second competing family taxonomy.
 *
 * C1 is the source of truth for:
 *   - Family IDs (e.g., EXECUTION_ADAPTATION_GAP)
 *   - Family members (which blind spots belong to which family)
 *
 * C3 ONLY adds inference metadata (signal mappings, weights) around
 * the frozen C1 family structure.
 *
 * MODEL_BOUNDARY REMOVED: was a C3 invention, not a C1 family.
 *
 * @version world_model_v3
 * @sprint c3-002a-r1
 */

var { BLIND_SPOT_FAMILIES: C1_FAMILIES } = require('./blindSpotBoundaryDefinitions')
var { SECONDARY_SIGNALS } = require('./secondarySignalDefinitions')

// ═══════════════════════════════════════════════════════════════
// DERIVED FAMILY DEFINITIONS (from C1 + C2)
// ═══════════════════════════════════════════════════════════════

/**
 * Builds C3 family definitions from C1 authority.
 * Each C3 family mirrors the C1 family ID and members,
 * adding only inference metadata (signal mappings, weights).
 */
function buildFamilyDefinitions() {
  var definitions = {}
  var c1Ids = Object.keys(C1_FAMILIES)

  c1Ids.forEach(function (familyId) {
    var c1Family = C1_FAMILIES[familyId]
    var members = c1Family.members

    // Find secondary signals that differentiate between members of THIS family
    // A signal belongs to a family if EITHER its supports OR weakens blind spot
    // is a member of that family (and it differentiates within the family pair)
    var signalMap = buildSignalMapForFamily(familyId, members)

    definitions[familyId] = {
      id: familyId,
      label: c1Family.label,
      description: c1Family.description,
      distinguishingQuestion: c1Family.distinguishingQuestion,

      // Directly from C1
      candidates: members.slice(),

      // Derived from C2
      secondarySignals: signalMap.signals,
      signalWeights: signalMap.weights,

      minimumSignals: 1,
    }
  })

  return Object.freeze(definitions)
}

/**
 * Maps secondary signals to a C1 family.
 * A signal belongs to a family if BOTH its supports AND weakens
 * blind spots are members of that family (i.e., it differentiates
 * within the family's internal pair), OR if one of its blind spots
 * is a member and the other is not (cross-family differentiator).
 *
 * Cross-family differentiators get reduced weight since they span families.
 */
function buildSignalMapForFamily(familyId, familyMembers) {
  var signalIds = Object.keys(SECONDARY_SIGNALS)
  var signals = []
  var rawWeights = {}

  signalIds.forEach(function (signalId) {
    var sig = SECONDARY_SIGNALS[signalId]
    var diff = sig.differentiates
    var supports = diff.supports
    var weakens = diff.weakens

    var supportsInFamily = familyMembers.indexOf(supports) !== -1
    var weakensInFamily = familyMembers.indexOf(weakens) !== -1

    if (supportsInFamily || weakensInFamily) {
      signals.push(signalId)
      // Equal contribution: each signal gets weight 1.0
      // Normalization happens per-family, so a signal in both PRG and FRG
      // gets the same contribution to each family's total
      rawWeights[signalId] = 1.0
    }
  })

  // Normalize: each signal gets equal share within its family
  var totalRaw = 0
  Object.keys(rawWeights).forEach(function (k) { totalRaw += rawWeights[k] })

  var weights = {}
  if (totalRaw > 0) {
    Object.keys(rawWeights).forEach(function (k) {
      weights[k] = Math.round((1.0 / signals.length) * 10000) / 10000
    })
  }

  return { signals: signals, weights: weights }
}

// ═══════════════════════════════════════════════════════════════
// BUILT DEFINITIONS (frozen at module load)
// ═══════════════════════════════════════════════════════════════

var BLIND_SPOT_FAMILIES = buildFamilyDefinitions()

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

function getAllFamilyIds() {
  return Object.keys(BLIND_SPOT_FAMILIES)
}

function getFamily(familyId) {
  return BLIND_SPOT_FAMILIES[familyId] || null
}

function getCandidates(familyId) {
  var f = BLIND_SPOT_FAMILIES[familyId]
  return f ? f.candidates.slice() : []
}

function getFamilyForCandidate(candidateId) {
  var ids = getAllFamilyIds()
  for (var i = 0; i < ids.length; i++) {
    var f = BLIND_SPOT_FAMILIES[ids[i]]
    if (f.candidates.indexOf(candidateId) !== -1) return f.id
  }
  return null
}

/**
 * Returns all C1 families a secondary signal is associated with.
 * A signal may belong to 1-2 families (cross-family differentiator).
 */
function getFamiliesForSignal(signalId) {
  var ids = getAllFamilyIds()
  var result = []
  ids.forEach(function (familyId) {
    var f = BLIND_SPOT_FAMILIES[familyId]
    if (f.secondarySignals.indexOf(signalId) !== -1) {
      result.push(familyId)
    }
  })
  return result
}

/**
 * Validates that C3 family memberships match C1.
 */
function validateFamilyLineage() {
  var c1Ids = Object.keys(C1_FAMILIES)
  var c3Ids = getAllFamilyIds()
  var errors = []

  // Same set of family IDs
  c1Ids.forEach(function (id) {
    if (c3Ids.indexOf(id) === -1) {
      errors.push('C1 family ' + id + ' missing from C3')
    }
  })
  c3Ids.forEach(function (id) {
    if (c1Ids.indexOf(id) === -1) {
      errors.push('C3 family ' + id + ' not in C1 (unauthorized addition)')
    }
  })

  // Same members per family
  c1Ids.forEach(function (id) {
    if (c3Ids.indexOf(id) === -1) return
    var c1Members = C1_FAMILIES[id].members.slice().sort()
    var c3Members = BLIND_SPOT_FAMILIES[id].candidates.slice().sort()
    if (JSON.stringify(c1Members) !== JSON.stringify(c3Members)) {
      errors.push('Family ' + id + ' membership mismatch: C1=' + c1Members.join(',') + ' C3=' + c3Members.join(','))
    }
  })

  return {
    valid: errors.length === 0,
    errors: errors,
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  BLIND_SPOT_FAMILIES,
  C1_FAMILIES,
  getAllFamilyIds,
  getFamily,
  getCandidates,
  getFamilyForCandidate,
  getFamiliesForSignal,
  validateFamilyLineage,
}
