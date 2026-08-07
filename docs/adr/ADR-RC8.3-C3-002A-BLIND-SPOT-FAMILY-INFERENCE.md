# ADR-RC8.3-C3-002A-R1 — Hierarchical Blind Spot Family Inference (Lineage Corrected)

## Status
ACCEPTED

## Context
C3-001B completed the predicate executor, making secondary signal states fully deterministic. Before proceeding to final Blind Spot selection, a hierarchical intermediate layer is needed: Secondary Signals → Family. This prevents flat 9-way Blind Spot competition and provides a structured, auditable intermediate state.

### R1 Correction
Initial C3-002A (9b39220) defined its own family membership taxonomy, which diverged from C1's authoritative `BLIND_SPOT_FAMILIES` in `blindSpotBoundaryDefinitions.js`:
- Moved OPPORTUNITY_BLINDNESS from PERCEPTION_RISK_GAP → FRAMEWORK_GAP (renamed MODEL_BOUNDARY)
- Moved PROBABILITY_MISJUDGMENT from FRAMEWORK_GAP → PERCEPTION_RISK_GAP (renamed UNCERTAINTY_JUDGMENT)

R1 corrects this by making C3 a consumer of C1's family architecture rather than an independent taxonomy.

## Decision
Implement a two-stage architecture:
1. **Family Inference (C3-002A)**: Secondary Signals → Family (this ADR)
2. **Blind Spot Selection (C3-002B, future)**: Family + dimensions → final Blind Spot

### Source of Truth
C1 `BLIND_SPOT_FAMILIES` (in `blindSpotBoundaryDefinitions.js`) is the authoritative source for family membership. C3 ADDS inference metadata (signal mappings, weights, display labels) but does NOT redefine which Blind Spots belong to which family.

Four cognitive families (C1 architecture IDs):

| Architecture ID | Display ID | C1 Members |
|---|---|---|
| EXECUTION_ADAPTATION_GAP | DECISION_ADAPTATION | DECISION_INERTIA, FEEDBACK_LOOP_GAP |
| RESOURCE_COMPOUNDING_GAP | RESOURCE_COMPOUNDING | LEVERAGE_MODEL_GAP, TIME_HORIZON_TRAP |
| PERCEPTION_RISK_GAP | UNCERTAINTY_JUDGMENT | OPPORTUNITY_BLINDNESS, RISK_MODEL_DISTORTION |
| FRAMEWORK_GAP | MODEL_BOUNDARY | PROBABILITY_MISJUDGMENT, IDENTITY_CONSTRAINT, SYSTEM_THINKING_GAP |

### Inference Metadata (C3 layer)
C3 maps secondary signals to C1 families and defines scoring weights:

| C1 Family | Signals | Weighted |
|---|---|---|
| EXECUTION_ADAPTATION_GAP | WAITING_DURATION_PATTERN, MINIMUM_STEP_EXECUTION, POST_ACTION_REVIEW_HABIT, DECISION_TO_ACTION_LATENCY | 4 signals |
| RESOURCE_COMPOUNDING_GAP | OUTPUT_DECOUPLING_AWARENESS, EFFORT_VS_MECHANISM_FRAMING, DIRECTION_SWITCHING_FREQUENCY, LONG_TERM_COMPOUNDING_AWARENESS, ALTERNATIVE_PATH_COST_AWARENESS | 5 signals |
| PERCEPTION_RISK_GAP | INFORMATION_SOURCE_DIVERSITY, SERENDIPITOUS_PATH_DISCOVERY, NON_DOMAIN_PATH_AWARENESS, EMOTIONAL_RECENCY_IMPACT, ABSTRACT_VS_EMBODIED_RISK_JUDGMENT | 5 signals |
| FRAMEWORK_GAP | PROBABILISTIC_LANGUAGE_USAGE, LUCK_VS_SKILL_ATTRIBUTION, FEEDBACK_CALIBRATION_RATE, IDENTITY_BASED_EXCLUSION, CROSS_IDENTITY_ATTEMPT_HISTORY, SELF_ASSESSMENT_ASYMMETRY, FEEDBACK_LOOP_CONCEPT_AWARENESS, CROSS_DOMAIN_FEEDBACK_THINKING, LINEARTY_VS_COMPLEXITY_DEFAULT | 9 signals |

### Lineage Identity Test
`verifyLineageIdentity()` ensures C3 family membership exactly matches C1 `BLIND_SPOT_FAMILIES.members`. Any divergence fails the test.

## Inference Algorithm
1. Score each family based on active/suppressed secondary signals (weighted contributions)
2. Rank families by score
3. Detect ambiguity (small gap, low top score, conflicting signals)
4. Return family (C1 architecture ID), familyScores, confidence, supporting/contradicting signals, trace

Suppressed signals actively reduce family support (contradiction-first carries through from C2). Insufficient signals contribute nothing.

## Ambiguity Rules
- Gap < 0.1 → strongly ambiguous
- Gap < 0.2 with top score < 0.3 → weakly ambiguous
- Top score < 0.05 → too little signal
- When ambiguous: alternateFamily returned, rawGap measured, missingEvidenceNeeded populated

## Constraints Satisfied
- C1 BLIND_SPOT_FAMILIES is authoritative source of candidate membership
- 0 flat 9-way competition — family only
- 0 blindSpotId output
- 0 direct Blind Spot, Archetype, or Strategy determination
- 0 occupation/income/business references
- 100% deterministic (100-run verified)
- 49/49 test cases pass (48 inference + 1 lineage identity)

## Test Coverage
- 1 lineage identity case (C3 matches C1)
- 8 EXECUTION_ADAPTATION_GAP cases
- 8 RESOURCE_COMPOUNDING_GAP cases
- 8 PERCEPTION_RISK_GAP cases
- 8 FRAMEWORK_GAP cases
- 8 ambiguity/conflict cases
- 5 determinism + guard cases
- 3 API consistency cases
- Cross-occupation consistency verified
- Same-occupation differentiation verified

## Runtime Impact
- 0 production imports
- 0 runtime call chain changes
- 0 feature flag changes
- No cloud deployment required

## Known Debt (not addressed in this ADR)
- P2 FAMILY_AMBIGUITY_THRESHOLD_HEURISTIC — magic numbers for gap/score thresholds
- P2 FRAMEWORK_GAP_WEIGHT_DILUTION — 9 signals share 1.0 total weight, individual contributions small
- P2 SERENDIPITOUS_PATH_DISCOVERY_CONTRADICTION_GAP — preserved from C2

## Related
- `ADR-RC8.3-C3-001A-PREDICATE-SCHEMA.md`
- `ADR-RC8.3-C3-001B-PREDICATE-EXECUTOR.md`
- `ADR-RC8.3-C2-001-SECONDARY-SIGNAL-VOCABULARY.md`
- `ADR-RC8.3-C1-002-CORE-BOUNDARIES.md`
