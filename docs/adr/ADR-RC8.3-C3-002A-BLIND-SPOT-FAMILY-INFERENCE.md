# ADR-RC8.3-C3-002A — Hierarchical Blind Spot Family Inference

## Status
ACCEPTED

## Context
C3-001B completed the predicate executor, making secondary signal states fully deterministic. Before proceeding to final Blind Spot selection, a hierarchical intermediate layer is needed: Secondary Signals → Family. This prevents flat 9-way Blind Spot competition and provides a structured, auditable intermediate state.

## Decision
Implement a two-stage architecture:
1. **Family Inference (C3-002A)**: Secondary Signals → Family (this ADR)
2. **Blind Spot Selection (C3-002B, future)**: Family + dimensions → final Blind Spot

Four cognitive families are defined, each grouping confusable Blind Spots by their underlying cognitive mechanism:

| Family | Candidates | C1 Boundary |
|---|---|---|
| DECISION_ADAPTATION | DECISION_INERTIA, FEEDBACK_LOOP_GAP | EXECUTION_ADAPTATION_GAP |
| RESOURCE_COMPOUNDING | LEVERAGE_MODEL_GAP, TIME_HORIZON_TRAP | RESOURCE_COMPOUNDING_GAP |
| UNCERTAINTY_JUDGMENT | RISK_MODEL_DISTORTION, PROBABILITY_MISJUDGMENT | PERCEPTION_RISK_GAP |
| MODEL_BOUNDARY | OPPORTUNITY_BLINDNESS, IDENTITY_CONSTRAINT, SYSTEM_THINKING_GAP | FRAMEWORK_GAP |

## Inference Algorithm
1. Score each family based on active/suppressed secondary signals (weighted contributions)
2. Rank families by score
3. Detect ambiguity (small gap, low top score, conflicting signals)
4. Return family, scores, confidence, supporting/contradicting signals, trace

Suppressed signals actively reduce family support (contradiction-first carries through from C2). Insufficient signals contribute nothing.

## Ambiguity Rules
- Gap < 0.1 → strongly ambiguous
- Gap < 0.2 with top score < 0.3 → weakly ambiguous
- Top score < 0.05 → too little signal
- When ambiguous: alternateFamily returned, rawGap measured, missingEvidenceNeeded populated

## Constraints Satisfied
- 0 flat 9-way competition — family only
- 0 blindSpotId output
- 0 direct Blind Spot, Archetype, or Strategy determination
- 0 occupation/income/business references
- 100% deterministic (100-run verified)
- 48/48 test cases pass

## Test Coverage
- 8 DECISION_ADAPTATION cases
- 8 RESOURCE_COMPOUNDING cases
- 8 UNCERTAINTY_JUDGMENT cases
- 8 MODEL_BOUNDARY cases
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

## Related
- `ADR-RC8.3-C3-001A-PREDICATE-SCHEMA.md` (implied)
- `ADR-RC8.3-C3-001B-PREDICATE-EXECUTOR.md` (implied)
- `ADR-RC8.3-C2-001-SECONDARY-SIGNAL-VOCABULARY.md`
- `ADR-RC8.3-C1-002-CORE-BOUNDARIES.md`
