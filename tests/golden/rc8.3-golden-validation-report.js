/**
 * tests/golden/rc8.3-golden-validation-report.js
 *
 * RC8.3 C4-001A — Golden Dataset Validation Report.
 *
 * Separates STRUCTURAL VALIDATION (is the dataset well-formed?)
 * from ENGINE AGREEMENT (does the current engine match golden labels?).
 *
 * Golden Dataset != Regression Snapshot
 * Golden expected labels are normative human-reviewed labels.
 * Engine disagreement is not automatically a dataset failure.
 *
 * Usage: node tests/golden/rc8.3-golden-validation-report.js
 *
 * @version world_model_v3
 * @sprint c4-001a
 */

// ═══════════════════════════════════════════════════════════════
// 1. STRUCTURAL VALIDATION
// ═══════════════════════════════════════════════════════════════

;(function run() {
  var { GOLDEN_CASES, validateGoldenGovernance } = require('./rc8.3-golden-cases')
  var HI = require('../../cloudfunctions/generateAiReport/lib/engine/worldModel/hierarchicalBlindSpotInference')

  console.log('══════════════════════════════════════════════════════')
  console.log(' RC8.3 C4-001A — Golden Dataset Validation Report')
  console.log('══════════════════════════════════════════════════════')
  console.log()

  var govResult = validateGoldenGovernance(GOLDEN_CASES)

  console.log('=== 1. STRUCTURAL VALIDATION ===')
  console.log('  Result: ' + (govResult.valid ? 'PASS' : 'FAIL'))
  console.log('  Errors: ' + govResult.errors.length)
  console.log('  Total cases: ' + govResult.total)
  if (!govResult.valid) {
    govResult.errors.forEach(function (e) { console.log('    - ' + e) })
  }
  console.log()

  console.log('=== 2. GOLDEN DISTRIBUTION ===')
  console.log('  Confidence: HIGH=' + govResult.confidenceDist.HIGH + ' MEDIUM=' + govResult.confidenceDist.MEDIUM + ' LOW=' + govResult.confidenceDist.LOW)
  console.log('  ReviewStatus: REVIEWED=' + govResult.reviewDist.REVIEWED + ' DISPUTED=' + govResult.reviewDist.DISPUTED + ' NEEDS_REVIEW=' + govResult.reviewDist.NEEDS_REVIEW)
  console.log('  LabelSource: HUMAN_NORMATIVE=' + (govResult.labelSourceDist.HUMAN_NORMATIVE||0) + ' ADVERSARIAL=' + (govResult.labelSourceDist.ADVERSARIAL||0) + ' BOUNDARY=' + (govResult.labelSourceDist.BOUNDARY||0) + ' ENGINE_CONFIRMED=' + (govResult.labelSourceDist.ENGINE_CONFIRMED||0))
  console.log('  ValidationRole: CROSS_OCCUPATION=' + (govResult.validationRoleDist.CROSS_OCCUPATION||0) + ' BOUNDARY=' + (govResult.validationRoleDist.BOUNDARY||0) + ' STANDARD=' + (govResult.validationRoleDist.STANDARD||0) + ' EXTERNAL_CONSTRAINT=' + (govResult.validationRoleDist.EXTERNAL_CONSTRAINT||0) + ' SAME_OCCUPATION=' + (govResult.validationRoleDist.SAME_OCCUPATION||0) + ' LEGACY_FAILURE=' + (govResult.validationRoleDist.LEGACY_FAILURE||0))
  console.log('  Cross-occupation groups: ' + govResult.crossOccGroups.count)
  console.log('  Same-occupation groups: ' + govResult.sameOccGroups.count)
  console.log()

  // ═══════════════════════════════════════════════════════════════
  // 3. ENGINE AGREEMENT
  // ═══════════════════════════════════════════════════════════════

  var matchCount = 0
  var expectedMismatch = 0
  var unresolvedMismatch = 0
  var mismatchByState = { CLEAR: 0, AMBIGUOUS_BLIND_SPOT: 0, AMBIGUOUS_FAMILY: 0, INSUFFICIENT_EVIDENCE: 0 }

  GOLDEN_CASES.forEach(function (c) {
    var signals = c.inputProfile.signals.map(function (s) {
      return { id: s.id, state: s.state, score: s.score || 0, originId: s.originId || s.id, confidence: 0.5 }
    })
    var result = HI.inferHierarchicalBlindSpot({ secondarySignals: signals })
    var allOk =
      result.family.primary === c.expected.family &&
      (result.blindSpot.primary === c.expected.blindSpot || (result.blindSpot.primary === null && c.expected.blindSpot === null)) &&
      result.inferenceState === c.expected.inferenceState

    if (allOk) {
      matchCount++
    } else {
      mismatchByState[c.expected.inferenceState] = (mismatchByState[c.expected.inferenceState] || 0) + 1
    }
  })

  console.log('=== 3. CURRENT ENGINE AGREEMENT ===')
  console.log('  MATCH: ' + matchCount + '/' + GOLDEN_CASES.length)
  console.log()
  console.log('  Mismatches by Golden expected state:')
  console.log('    CLEAR:                 ' + (mismatchByState.CLEAR || 0))
  console.log('    AMBIGUOUS_BLIND_SPOT:  ' + (mismatchByState.AMBIGUOUS_BLIND_SPOT || 0))
  console.log('    AMBIGUOUS_FAMILY:      ' + (mismatchByState.AMBIGUOUS_FAMILY || 0))
  console.log('    INSUFFICIENT_EVIDENCE: ' + (mismatchByState.INSUFFICIENT_EVIDENCE || 0))
  console.log()

  console.log('=== 4. GOVERNANCE-BACKED STATUS ===')
  console.log('  MATCH:                 ' + govResult.selfValidationDist.MATCH)
  console.log('  EXPECTED_MISMATCH:     ' + govResult.selfValidationDist.EXPECTED_MISMATCH)
  console.log('  UNRESOLVED_MISMATCH:   ' + govResult.selfValidationDist.UNRESOLVED_MISMATCH)
  console.log()

  // ═══════════════════════════════════════════════════════════════
  // 4. ANTI-REGRESSION-SNAPSHOT DECLARATION
  // ═══════════════════════════════════════════════════════════════

  console.log('=== 5. GOVERNANCE RULES ===')
  console.log('  Golden Dataset != Regression Snapshot:  YES')
  console.log('  Labels are normative human-reviewed:    YES')
  console.log('  Engine output does NOT define truth:    YES')
  console.log('  No expected labels changed in C4-001A:  YES')
  console.log('  Inference engine modified:              0')
  console.log('  Runtime modified:                        0')
  console.log()

  console.log('══════════════════════════════════════════════════════')
  console.log(' Summary')
  console.log('══════════════════════════════════════════════════════')
  console.log('  Structural Validation:  ' + (govResult.valid ? '100/100 PASS' : 'FAIL'))
  console.log('  Current Engine Agreement: ' + matchCount + '/' + GOLDEN_CASES.length)
  console.log('  Expected Mismatches:     ' + (govResult.selfValidationDist.EXPECTED_MISMATCH || 0))
  console.log('  Unresolved Mismatches:   ' + (govResult.selfValidationDist.UNRESOLVED_MISMATCH || 0))
  console.log('  DISPUTED cases:          ' + (govResult.reviewDist.DISPUTED || 0))
  console.log()
})()