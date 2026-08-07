# ADR-RC8.3-C3-002A-R2 — Hierarchical Blind Spot Family Inference (Score-Normalized)

## Status
ACCEPTED

## Context
R1 (5aad39e + ff6a2ad) resolved P1 FAMILY_LINEAGE_MISALIGNMENT — C3 now derives family membership from C1 BLIND_SPOT_FAMILIES authority. But R1 carried forward a P2 debt from 9b39220: **FAMILY_SCORE_SCALE_BIAS**.

The per-family weight-budget scoring (Σweights=1.0, weight × score/100) produced:
- EA single-signal weight = 0.40
- FG single-signal weight = 0.15
- 2.67× contribution difference for same evidence

This made family ranking, rawGap, ambiguity thresholds, and family confidence not reliably comparable across families.

## Decision
Replace per-family weight-budget scoring with **Evidence Density** using fidelity weights on a common [0,1] scale.

### Old (R1)
```
familyScore = Σ(weight × sigScore/100), Σweights=1.0 per family
```
Weight=0.40 in EA contributes 2.67× more than weight=0.15 in FG for equivalent evidence.

### New (R2)
```
evidenceDensity = Σ(fidelity × sigScore/100) - Σ(fidelity × 0.5 for suppressed)
saturation = evidenceDensity / totalFidelity  [secondary metric]
```
Fidelity weights use the same [0,1] scale across all families. A signal at fidelity=1.0 contributes the same evidence in ANY family.

### Comparability Proof
Same evidence (1 signal, fidelity=1.0, score=80): **ALL families = 0.800** — identical across EA, RC, PR, FG.

### Fidelity Weight Rationale
Fidelity represents signal diagnosticity on a common scale:
- 1.0 = maximally diagnostic within its family
- 0.5 = moderately diagnostic
- 0.25 = weakly diagnostic

Weights are assigned per-signal based on cognitive diagnosticity, not per-family budget allocation.

### Family Ranking
Ranked by evidenceDensity (comparable). Saturation is available as a secondary metric for confidence calculation only.

### Family Confidence
```
saturationConf = min(saturation × 0.6, 0.45)
gapConf = min(gap × 1.5, 0.30)
contradictionConf = 0.15 × (1 - suppressedRatio)
countConf = min(activeCount × 0.025, 0.10)
confidence = saturationConf + gapConf + contradictionConf + countConf
```
Confidence uses saturation (family-completeness) + gap (density difference, now comparable).

### Ambiguity Thresholds
Updated for density scale:
- gap < 0.1 → strongly ambiguous (less than one weak signal's density)
- gap < 0.2 with top < 0.5 → weakly ambiguous
- top < 0.1 → insufficient signal

These thresholds now have stable semantics across families because gap is in comparable density units.

## Constraints Satisfied
- C1 BLIND_SPOT_FAMILIES is authoritative source of candidate membership
- Family-size-invariant evidence density
- Same evidence → same density → comparable scores
- No family-specific boost factors, hidden offsets, or cap tuning
- 0 flat 9-way competition — family only
- 0 blindSpotId output
- 0 occupation/income/business references
- 100% deterministic
- 55/55 test cases pass (50 from R1 + 5 new comparability)

## Test Coverage
- 2 lineage identity
- 8 EA, 8 RC, 8 PR, 8 FG
- 8 ambiguity/conflict
- 5 determinism + guards
- 3 API consistency
- 5 score comparability (R2 new)
- 100-run determinism PASS

## Related Debts
- P1 FAMILY_LINEAGE_MISALIGNMENT: RESOLVED (R1)
- P2 FAMILY_SCORE_SCALE_BIAS: RESOLVED (R2)
- P2 FAMILY_AMBIGUITY_THRESHOLD_HEURISTIC: RESOLVED (R2 — thresholds now on comparable density scale)
- P2 SERENDIPITOUS_PATH_DISCOVERY contradiction gap: OPEN / NON-BLOCKING

## Related
- `ADR-RC8.3-C3-001B-PREDICATE-EXECUTOR.md`
- `ADR-RC8.3-C2-001-SECONDARY-SIGNAL-VOCABULARY.md`
- `ADR-RC8.3-C1-002-CORE-BOUNDARIES.md`
