# ADR-RC8.3-C3-002B — Within-Family Blind Spot Selection

## Status
ACCEPTED

## Context
C3-002A established hierarchical family inference (Secondary Signals → C1 Family). C3-002B completes the inference chain by selecting the primary Blind Spot within the selected family, using the C1 boundary architecture as authoritative source.

## Decision
Implement boundary-first evaluation: for each candidate blind spot in the selected family, evaluate in strict order:
1. Necessary conditions (C1-derived, mapped to secondary signals)
2. Disqualifiers (hard exclusion, no override)
3. Contradicting evidence (SUPPRESSED signals count as contradiction)
4. Differentiating evidence
5. Ambiguity detection
6. Missing evidence hints

No cross-family competition. The input family determines the ONLY valid candidate set.

## Architecture
- `withinFamilyBlindSpotInference.js` — boundary-first inference engine
- 4 families (EAG, RCG, PRG, FRG) with 2-3 candidates each
- 9 blind spots total, only within-family candidates scored
- C1 `blindSpotBoundaryDefinitions.js` is authoritative for all conditions
- C3 consumes but does NOT redefine boundary conditions

## Output Contract
```
{ family, primaryBlindSpot, alternateBlindSpot, candidateStates[], ambiguous, rawGap, confidence, reasoningTrace }
```

Each candidateState has: `eligibility` (ELIGIBLE|INSUFFICIENT|DISQUALIFIED), `supportStrength`, `confidence`, evidence IDs, trace.

## Key Design Decisions
- **Disqualification is hard**: No amount of positive signal overrides a disqualifier
- **Suppressed = contradiction**: SUPPRESSED secondary signals count as contradiction, not weak support
- **3-candidate FRAMEWORK_GAP**: All 3 candidates evaluated uniformly, no pairwise hardcoding
- **Same-origin deduplication**: `countIndependentSignals()` ensures origin-aware counting
- **Mutual disqualification**: When both candidates in a pair disqualify each other (e.g., EAG: WAITING→FLG, MSE→DI), the system correctly produces null primary + ambiguous

## Test Coverage
86 cases:
- EAG: 8 DI + 8 FLG + 4 ambiguity
- RCG: 8 LMG + 8 THT + 4 ambiguity
- PRG: 6 OB + 6 RMD + 4 ambiguity
- FRG: 6 PM + 6 IC + 6 STG + 6 ambiguity
- 6 determinism + guards

## Constraints
- 0 cross-family leakage
- 0 occupation/income/business/prediction contamination
- 100% deterministic (100-run verified)
- 0 production impact

## Related
- `ADR-RC8.3-C3-002A-BLIND-SPOT-FAMILY-INFERENCE.md`
- `ADR-RC8.3-C1-002-CORE-BOUNDARIES.md`
