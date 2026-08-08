# ADR-RC8.3-C4-001 — Golden Dataset Design

## Status
ACCEPTED

## Context
RC8.3's hierarchical cognitive inference pipeline is frozen. C4-001 builds the human-reviewable Golden Dataset to test whether the system fulfills its product mission: 帮助普通人理解世界运行规则，发现认知漏洞，模拟决策后果 — without offering business advice, fortune-telling, or motivational platitudes.

## Decision
Build 100 golden cases covering all 4 cognitive families, all 9 blind spots, all inference states (CLEAR, AMBIGUOUS_FAMILY, AMBIGUOUS_BLIND_SPOT, INSUFFICIENT_EVIDENCE), and critical old-RC8 failure patterns.

Each case includes: id, title, inputProfile (signals + occupation metadata), expected (family, blindSpot, inferenceState, ambiguityAllowed, alternateAllowed), rationale (worldPrinciple, mechanism, whyPrimary, whyNotAlternates, falsePositiveRisk), evidenceExpectation, and constitutionChecks.

## Distribution

| Category | Count |
|---|---|
| Clear cognitive cases | 36 (4 per blind spot) |
| Ambiguous cases | 18 |
| Insufficient evidence | 10 |
| External constraint cases | 10 |
| Cross-occupation consistency | 10 |
| Same-occupation differentiation | 10 |
| Legacy failure patterns | 6 |
| **Total** | **100** |

## Coverage
- **Families**: 4/4 (EAG, RCG, PRG, FRG)
- **Blind Spots**: 9/9 (DI, FLG, LMG, THT, OB, RMD, PM, IC, STG)
- **Inference States**: 4/4 (CLEAR, AMBIGUOUS_FAMILY, AMBIGUOUS_BLIND_SPOT, INSUFFICIENT_EVIDENCE)
- **Occupations**: 10 diverse occupations used as metadata only

## Constitution
- 0 occupation-driven inferences
- 0 income-driven inferences
- 0 business-direction advice
- 0 fortune-telling / deterministic predictions
- Every case has human rationale for review

## Legacy Failure Patterns
6 cases explicitly designed to catch old-RC8 misdiagnoses (SINGLE_INCOME, TRAFFIC, SELLING, BUILD_PRODUCT, freelance, AI). Each demonstrates that the cognitive mechanism — not the occupational symptom — is the correct diagnosis.

## Validation
Dataset validates itself: unique IDs, all families, all blind spots, all states, all rationales present, constitution checks on every case.

## No Model Tuning
This sprint does NOT change weights, thresholds, signals, boundaries, or inference. The dataset reveals weaknesses rather than hiding them.

## Related
- `ADR-RC8.3-C3-003-HIERARCHICAL-INFERENCE.md`
