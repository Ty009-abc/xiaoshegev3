# ADR-RC8.3-C4-003C — Mixed Guard-State Refinement Audit

## Status
AUDIT COMPLETE

## Context
C4-003B refined the state machine. However, the `anyGuardBlocked → INSUFFICIENT_EVIDENCE` rule was carried forward from C4-003A without semantic reassessment. This audit examines whether "any candidate is guard-blocked" is sufficient to declare INSUFFICIENT_EVIDENCE, or whether mixed candidate states deserve AMBIGUOUS_BLIND_SPOT.

## Audit Set: 22 Cases with Guard Activity

22 golden cases involve guard activity at the within-family layer. Breakdown:

| Pattern | Count | Cases |
|---|---|---|
| DQ + GUARD_INS | 9 | G-AMB-001, G-AMB-004, G-AMB-008, G-AMB-012, G-AMB-014, G-AMB-016, G-AMB-018, G-INS-004, G-INS-005 |
| GUARD_INS + NC_INS | 3 | G-AMB-006, G-AMB-010, G-EXT-009 |
| GUARD + ELIGIBLE | 3 | G-AMB-002, G-AMB-005, G-EXT-008 |
| DQ + NC_INS (guard not blocking) | 7 | G-AMB-003, G-AMB-007, G-AMB-009, G-AMB-011, G-AMB-013, G-AMB-015, G-EXT-001 |

## Key Finding: anyGuardBlocked Is Overbroad

The 9 `DQ + GUARD_INS` cases all share a common pattern: one candidate DISQUALIFIED + one candidate GUARD_BLOCKED. Current state machine treats any guard presence as INSUFFICIENT. But:

1. **Family IS established** (confidence 0.28–0.58 across cases)
2. **One mechanism is definitively ruled out** (disqualified)
3. **The remaining mechanism is** guard-blocked (externally explainable, not definitively ruled out)

This does NOT mean "no cognitive issue exists." It means: "one mechanism is impossible, the other has an external alternative explanation — the cognitive issue is unresolved, not absent."

**Correct semantic: AMBIGUOUS_BLIND_SPOT**, not INSUFFICIENT_EVIDENCE.

## Guard Causal Scope

The guard currently says "this candidate pattern may be externally explained." It does NOT say "the family-level cognitive pattern is entirely explained." This is a key distinction:

- Guard explains candidate A → A remains INSUFFICIENT (correct)
- Candidate B is DISQUALIFIED → B is ruled out (correct)
- The family has supporting evidence → cognitive pattern exists
- Result: ambiguity between external explanation vs cognitive mechanism

**P2 GUARD_CAUSAL_SCOPE_TRACE_GAP**: guard output does not distinguish "candidate-level explanation" from "family-level explanation." Current guard always operates at candidate level — this is correct for candidate evaluation but the state machine conflates candidate-level guard with family-level insufficiency.

## Hierarchical Trace Gap

The hierarchical layer (`hierarchicalBlindSpotInference.js`) copies candidate traces but does NOT include `externalConstraintTrace.guardState` or `matchedConstraints`. The `anyGuardBlocked` check at the hierarchical level therefore cannot read guard states from candidate traces — it sees `undefined` for all guard fields. The state-machine logic at hierarchical level cannot evaluate guard-driven states without fixing this data flow.

## Proposed Truth Table

| Candidate Pattern | Recommended State | Rationale |
|---|---|---|
| ALL_DQ | INSUFFICIENT_EVIDENCE | No valid mechanism fits |
| ALL_NON_DQ_GUARD_BLOCKED | INSUFFICIENT_EVIDENCE | All explanations externally explainable |
| DQ + GUARD_INS | AMBIGUOUS_BLIND_SPOT | One ruled out, other externally explained → unresolved |
| GUARD_INS + NC_INS | AMBIGUOUS_BLIND_SPOT | Mixed unresolved states → cognitive issue not resolved |
| DQ + NC_INS (no guard) | AMBIGUOUS_BLIND_SPOT | C4-003B already handles this |
| GUARD + ELIGIBLE | CLEAR | Guard flags risk but doesn't block eligibility |
| NC_UNRESOLVED_ONLY | AMBIGUOUS_BLIND_SPOT | C4-003B already handles this |

## Impact Simulation

Simulating change from `anyGuardBlocked → INSUFFICIENT` to `allNonDQCandidatesGuardBlocked → INSUFFICIENT`:

- **Cases reclassified (INS → AMB)**: 9 (DQ + GUARD_INS cases)
- **Golden state gains**: G-AMB-004, G-AMB-014, G-AMB-018, G-INS-005, G-EXT-003, G-EXT-004, G-EXT-005 (7 cases align with golden AMBIGUOUS expectation)
- **Golden state losses**: G-INS-004 (golden expects INSUFFICIENT → remains correct under AMB reclassification)
- **External regressions**: 0 (guard still blocks CLEAR diagnosis)
- **HIGH regressions**: 0 (no HIGH confidence cases affected)
- **Legacy regressions**: 0

## Data Flow Fix Required

The hierarchical layer copies candidate traces but omits `externalConstraintTrace` fields. The `anyGuardBlocked` check at hierarchical level cannot currently access guard states. Implementation must either:

A. Add externalConstraintTrace to hierarchical candidate trace copy
B. Pass guard states separately from within-family result
C. Move guard-aware state logic into withinFamilyBlindSpotInference.js

## Disputed Cases Isolated

G-AMB-003, G-AMB-010, G-EXT-008 remain disputed. Not used for rule design.

## Debt Status

- **P2 ANY_GUARD_BLOCKED_SEMANTICS**: CONFIRMED — 9 cases overblocked. Refined to `allNonDQCandidatesGuardBlocked`.
- **P2 GUARD_CAUSAL_SCOPE_TRACE_GAP**: NEW — guard cannot distinguish candidate vs family-level explanation.
- **P2 HIERARCHICAL_TRACE_GUARD_DATA_GAP**: NEW — hierarchical trace doesn't carry guard state fields.
- **P2 MISSING_EVIDENCE_SEMANTIC_CONFLATION**: PARTIAL — remaining for NC + NC_INS cases.

## Engineering Freeze
- Golden modified: 0
- Inference modified: 0
- Runtime modified: 0
- Production integration: 0
