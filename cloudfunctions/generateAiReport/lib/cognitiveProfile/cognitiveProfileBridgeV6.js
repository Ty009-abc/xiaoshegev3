'use strict'
/**
 * lib/cognitiveProfile/cognitiveProfileBridgeV6.js
 *
 * RC8.4 V6 R77 §3–§13 — DETERMINISTIC DIAGNOSIS → COGNITIVE PROFILE BRIDGE.
 *
 * Consumes the ALREADY-FROZEN outputs of one successful R75/V4-restored
 * diagnosis (hybridProfile + B1 diagnosis + hybridContext + the final report)
 * and produces a MERGE-SAFE `user_profiles` update patch. It performs NO
 * diagnosis of its own and makes NO model call. It NEVER touches the nine
 * existing cognitive dimensions, membership, challenge-derived data, or tags.
 *
 * FAILURE BEHAVIOR (§11): this module is pure — it cannot throw on a valid
 * diagnosis. The caller wraps DB I/O so a write failure can never fail the
 * report. IDEMPOTENCY (§12): the patch is a deterministic function of the
 * diagnosis (plus the injected ts), so reprocessing a reportId is stable.
 *
 * PROVENANCE (§8/§9): OBSERVED facts (proof ladder position) are kept separate
 * from DERIVED (mechanically computed state) and INFERRED (thesis reading).
 * HYPOTHESIS is reserved for the forward-looking commercial objective.
 */

const {
  COGNITIVE_PROFILE_SCHEMA_VERSION,
  PROVENANCE,
  CONFIDENCE,
  EXISTING_COGNITIVE_DIMENSIONS,
  assertion,
  taggedExpression,
  emptyLearningHistory
} = require('./profileSchemaV1.js')

const { computeAssetStateV6 } = require('../turnaroundStrategy/v6/hybrid/assetAxisV6.js')
const { selectWorldRule } = require('../turnaroundStrategy/v6/report/worldRuleLibraryV6.js')
const { getCrosswalkForLens } = require('./worldRuleCrosswalkV6.js')

// §4 — deterministic diagnosis inputs. These are STRUCTURED and high-confidence.
// primaryBottleneck / assetState / etc. come straight from the frozen kernel.
function buildDiagnosticState (diagnosis, hybridProfile, reportId, ts) {
  const pb = (diagnosis && diagnosis.primaryBottleneck) || null
  // §4: store ONLY deterministic outputs; never infer a missing value.
  const diagnosisState = (diagnosis && diagnosis.diagnosisState) || null
  const asset = computeAssetStateV6(hybridProfile)

  return {
    // OBSERVED: the kernel's own diagnosisState string (deterministic).
    diagnosisState: assertion(diagnosisState, PROVENANCE.DERIVED, CONFIDENCE.HIGH, 'b1_kernel', ts),
    // OBSERVED: the kernel's primaryBottleneck (may legitimately be null).
    primaryBottleneck: assertion(pb, PROVENANCE.DERIVED, pb ? CONFIDENCE.HIGH : CONFIDENCE.LOW, 'b1_kernel', ts),
    // DERIVED: asset ladder position computed from the asset/proof axis.
    assetState: assertion(asset.state, PROVENANCE.DERIVED, CONFIDENCE.HIGH, 'asset_axis', ts),
    // DERIVED: market-validation boolean from the proof ladder (no new judgement).
    marketProof: assertion(asset.marketValidated ? 'MARKET_VALIDATED' : 'NOT_MARKET_VALIDATED',
      PROVENANCE.DERIVED, asset.marketValidated ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM, 'asset_axis', ts),
    // OBSERVED: execution stage from Q6 (deterministic mapping).
    executionStage: assertion((diagnosis && diagnosis.executionStage) || null,
      PROVENANCE.DERIVED, CONFIDENCE.HIGH, 'b1_kernel', ts),
    // OBSERVED: the report id this snapshot was built from.
    lastReportId: assertion(reportId || null, PROVENANCE.OBSERVED, CONFIDENCE.HIGH, 'report_gen', ts),
    diagnosedAt: ts
  }
}

// §5 — INFERRED R70/R75 thesis interpretation. NEVER arbitrary full prose as
// canonical truth: each entry is a stable id (when one exists) + a separately
// stored human-readable expression.
function buildCognitiveState (diagnosis, report, ts) {
  const st = (report && report.strategicThesis) || null
  const cards = (report && report.cards) || null

  // DERIVED: the deterministic lens selection (bottleneck + evidence guards).
  const lens = selectWorldRule(diagnosis)
  const lensId = lens ? lens.id : null

  // INFERRED: blind spot = the thesis coreContradiction (interpretation).
  const blindSpotExpr = (st && st.coreContradiction) || null
  // INFERRED: behavior pattern = the systemTrap mechanism reading.
  const behaviorExpr = (st && st.systemTrap) || (cards && cards.systemLoop && cards.systemLoop.insight) || null
  // INFERRED: current world model = the thesis worldRule line.
  const currentWorldModelExpr = (st && st.worldRule) || null

  return {
    primaryBlindSpot: taggedExpression(null, blindSpotExpr, PROVENANCE.INFERRED,
      blindSpotExpr ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW, 'thesis_core', ts),
    thesisTheme: taggedExpression(null, (st && st.identityInterpretation) || null,
      PROVENANCE.INFERRED, CONFIDENCE.MEDIUM, 'thesis_identity', ts),
    behaviorPattern: taggedExpression(null, behaviorExpr, PROVENANCE.INFERRED,
      behaviorExpr ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW, 'thesis_mechanism', ts),
    // currentWorldModel carries the STABLE lens id where one exists; the free-text
    // AI worldRule is NEVER the canonical id (§15) — kept as `expression` only.
    currentWorldModel: taggedExpression(lensId, currentWorldModelExpr,
      lensId ? PROVENANCE.DERIVED : PROVENANCE.INFERRED,
      lensId ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM, 'world_rule_lens', ts),
    // HYPOTHESIS: a forward-looking commercial objective, NOT an observed fact.
    targetWorldModel: taggedExpression(null,
      (st && st.commercialThesis && st.commercialThesis.objective) || null,
      PROVENANCE.HYPOTHESIS, CONFIDENCE.LOW, 'commercial_thesis', ts)
  }
}

// §6 — CURRENT FOCUS. Exists ONLY for later personalization; NO consumer in R77.
function buildCurrentFocus (diagnosis, hybridProfile, report, ts) {
  const lens = selectWorldRule(diagnosis)
  const lensIds = lens ? [lens.id] : []
  const goalText = (hybridProfile && hybridProfile.desiredChange && hybridProfile.desiredChange.primaryGoal) || null
  const problemId = (hybridProfile && hybridProfile.desiredChange && hybridProfile.desiredChange.primaryProblem) || null

  return {
    worldRuleLensIds: lensIds,
    priorityTopicIds: problemId ? [problemId] : [],
    // DERIVED: the kernel action type (deterministic downstream of the diagnosis).
    experimentType: (diagnosis && diagnosis.firstActionType) || null,
    // OBSERVED: the user's stated goal (literal option id, never invented).
    goalText: assertion(goalText, PROVENANCE.OBSERVED, goalText ? CONFIDENCE.HIGH : CONFIDENCE.LOW, 'hybrid_goal', ts)
  }
}

/**
 * Build the full Cognitive Profile patch for a successful diagnosis.
 *
 * @param {Object} args { diagnosis, hybridProfile, hybridContext, report, reportId, ts }
 * @returns {{profileSchemaVersion, diagnosticState, cognitiveState, currentFocus, learningHistory}}
 */
function buildCognitiveProfilePatch (args) {
  const a = args || {}
  const ts = a.ts != null ? a.ts : Date.now()
  const reportId = a.reportId || null

  const patch = {
    profileSchemaVersion: COGNITIVE_PROFILE_SCHEMA_VERSION,
    diagnosticState: buildDiagnosticState(a.diagnosis, a.hybridProfile, reportId, ts),
    cognitiveState: buildCognitiveState(a.diagnosis, a.report, ts),
    currentFocus: buildCurrentFocus(a.diagnosis, a.hybridProfile, a.report, ts),
    // §7 — initialize append-only history without destroying existing data.
    learningHistory: emptyLearningHistory(ts),
    // Provenance for the patch shell itself.
    _profileMeta: {
      schemaVersion: COGNITIVE_PROFILE_SCHEMA_VERSION,
      lastBuiltFromReportId: reportId,
      updatedAt: ts,
      builder: 'cognitiveProfileBridgeV6'
    }
  }
  return patch
}

/**
 * §13 — MERGE AUTHORITY. Merge a freshly built patch onto an EXISTING profile
 * doc, applying frozen precedence:
 *   - newer direct diagnosis evidence MAY update diagnosticState
 *   - INFERRED fields update ONLY when produced from a successful current
 *     diagnosis (guaranteed by the caller; here we require a valid patch)
 *   - learningHistory MERGES (union), never resets
 *   - the nine existing dimensions / membership / tags are NEVER touched
 *
 * @returns {Object} a DEEP-MERGE-SAFE update object (only owned keys)
 */
function mergeProfilePatch (existingProfile, patch) {
  const existing = existingProfile && typeof existingProfile === 'object' ? existingProfile : {}
  const p = patch && typeof patch === 'object' ? patch : {}
  if (!p.profileSchemaVersion) return {}

  const out = { profileSchemaVersion: p.profileSchemaVersion }

  // diagnosticState — newer diagnosis overwrites the diagnostic section wholly.
  if (p.diagnosticState) out.diagnosticState = p.diagnosticState
  // cognitiveState — INFERRED; replaced only from the current successful diag.
  if (p.cognitiveState) out.cognitiveState = p.cognitiveState
  // currentFocus — replaced from the current diagnosis.
  if (p.currentFocus) out.currentFocus = p.currentFocus

  // learningHistory — UNION merge, never reset (§7/§12/§13).
  const prev = existing.learningHistory || {}
  const nextHist = p.learningHistory || {}
  const union = (a, b) => {
    const set = new Set()
    for (const x of (Array.isArray(a) ? a : [])) if (x) set.add(x)
    for (const x of (Array.isArray(b) ? b : [])) if (x) set.add(x)
    return Array.from(set)
  }
  out.learningHistory = {
    seenRuleIds: union(prev.seenRuleIds, nextHist.seenRuleIds),
    seenInsightIds: union(prev.seenInsightIds, nextHist.seenInsightIds),
    seenStrikeIds: union(prev.seenStrikeIds, nextHist.seenStrikeIds),
    provenance: PROVENANCE.OBSERVED,
    confidence: CONFIDENCE.HIGH,
    source: 'learning_history_merge',
    updatedAt: (nextHist.updatedAt != null ? nextHist.updatedAt : Date.now())
  }

  if (p._profileMeta) out._profileMeta = p._profileMeta

  // §13 GUARD: strip any owned-dimension key that could leak in (defensive).
  for (const dim of EXISTING_COGNITIVE_DIMENSIONS) delete out[dim]

  return out
}

module.exports = {
  buildCognitiveProfilePatch,
  mergeProfilePatch,
  buildDiagnosticState,
  buildCognitiveState,
  buildCurrentFocus
}
