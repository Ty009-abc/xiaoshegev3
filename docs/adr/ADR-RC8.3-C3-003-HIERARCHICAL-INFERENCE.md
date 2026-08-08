# ADR-RC8.3-C3-003 — Integrated Hierarchical Blind Spot Inference

## Status
ACCEPTED

## Context
C3-002A established family inference. C3-002B-R1 established within-family blind spot selection. C3-003 integrates these frozen layers into a single end-to-end pipeline: Secondary Signal States → Family → Blind Spot → Final Cognitive Inference Object.

## Decision
Build `hierarchicalBlindSpotInference.js` as a pure orchestrator:
1. Validate input
2. Family inference via `inferBlindSpotFamily()`
3. If family insufficient → return INSUFFICIENT_EVIDENCE
4. Within-family blind spot selection via `inferWithinFamilyBlindSpot()`
5. Compose final output with hierarchy and disqualifier hard guarantees

No bypass. No 9-way flat competition. No cross-family rescue.

## Output Contract
```
{
  family: { primary, alternate, ambiguous, rawGap, confidence, scores },
  blindSpot: { primary, alternate, ambiguous, rawGap, confidence, eligibility },
  evidence: { supporting, contradicting, disqualifying, missing },
  trace: { familyTrace, boundaryTrace, candidateTrace, provenanceTrace },
  inferenceState: CLEAR | AMBIGUOUS_FAMILY | AMBIGUOUS_BLIND_SPOT | INSUFFICIENT_EVIDENCE
}
```

## Hard Guarantees
- **Hierarchy**: primaryBlindSpot MUST belong to selected family (throw on violation)
- **Disqualifier**: disqualified candidates can NEVER be primary (throw on violation)
- **Confidence**: final = min(familyConfidence, blindSpotConfidence) — conservative, no inflation
- **Ambiguity propagation**: upstream ambiguity preserved; family and blind-spot ambiguity separately observable
- **Same-origin**: consumed from upstream layers, not re-aggregated

## Test Coverage
66 cases:
- 20 clear family + clear blind spot (all 9 blind spots covered)
- 15 family ambiguity
- 15 blind spot ambiguity
- 10 insufficient evidence
- 10 disqualifier-driven
- 10 provenance/same-origin/guards
- 5 determinism (100-run × 5 scenarios)

## Determinism
100-run exact identity for family, blindSpot, ambiguity, confidence, rawGap, trace, inferenceState.

## Production Isolation
- 0 imports into index.js, diagnosticPipeline, report, prompt, runtime
- 0 feature flag changes
- 0 cloud deployment

## Related
- `ADR-RC8.3-C3-002A-BLIND-SPOT-FAMILY-INFERENCE.md`
- `ADR-RC8.3-C3-002B-WITHIN-FAMILY-BLIND-SPOT-SELECTION.md`
