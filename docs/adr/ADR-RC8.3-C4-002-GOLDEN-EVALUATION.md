# ADR-RC8.3-C4-002 — Golden Evaluation & Failure Attribution

- **Status:** ACCEPTED (MEASUREMENT PHASE — CORRECTED)
- **Date:** 2026-08-08
- **Evaluation commit:** 9542c10

## 1. Context

The C3 hierarchical inference engine is frozen. The C4-001A Golden Dataset (100 cases, governed) is frozen. C4-002 runs a blind evaluation: every golden case through the real C3 pipeline, comparing actual output against frozen golden expected labels. No tuning. No label modification. No architecture changes.

## 2. Results Summary

| Metric | Overall | Notes |
|---|---|---|
| **Full exact match** | 66/100 (66%) | family + blindSpot + inferenceState |
| **Family — conditional** | 85/85 (100%) | When golden expects a concrete family, engine always returns it |
| **Family — overall** | 89/100 (89%) | 11 mismatches are all golden-expects-null/ambiguous cases, NOT family confusion |
| **Blind Spot exact** | 88/100 (88%) | |
| **State exact** | 75/100 (75%) | |
| **Excl. Disputed (96 cases)** | 66/96 (68.8%) | 4 disputed cases excluded |

**Key insight:** When golden expects a specific family (85 cases), the engine returns it 85/85 = 100%. The 11 "family errors" in the overall count are entirely from cases where golden expects null or ambiguous-family — the engine selects a specific family where golden says "ambiguous." These are overdiagnosis/STATE_ERROR, NOT family confusion.

## 3. Confidence Stratification (also Difficulty Stratification)

Golden confidence strata are intentionally correlated with case difficulty — HIGH cases are clear diagnostic cases, MEDIUM cases are ambiguous/insufficient/external-constraint cases.

| Tier | Cases | Composition | Exact |
|---|---|---|---|
| HIGH | 62 | CLEAR: 62 | **100%** |
| MEDIUM | 34 | AMB_BS: 19, AMB_FAM: 8, INS: 7 + EXT: 10 | **11.8%** |
| LOW | 4 | AMB_BS boundary disputes: 4 | **0%** |

**This is NOT confidence calibration performance.** HIGH cases are deliberately easy clear diagnostic cases (cross-occupation invariance tests). MEDIUM cases are explicitly hard (ambiguous/insufficient/external constraint). The extreme stratification reflects dataset design, not model quality variation.

## 4. Per-Family Accuracy

| Family | Correct/Total | Rate |
|---|---|---|
| EXECUTION_ADAPTATION_GAP | 27/27 | 100% |
| RESOURCE_COMPOUNDING_GAP | 19/19 | 100% |
| PERCEPTION_RISK_GAP | 16/16 | 100% |
| FRAMEWORK_GAP | 23/23 | 100% |

All 4 families achieve 100% when selected. Family inference is not the bottleneck.

## 5. State Confusion Matrix

| Golden Expectation | Engine Actual | Count |
|---|---|---|
| CLEAR → CLEAR | 62 | |
| AMBIGUOUS_BLIND_SPOT → CLEAR | 10 | **Overdiagnosis** |
| AMBIGUOUS_BLIND_SPOT → INSUFFICIENT | 13 | Ambiguity calibration |
| AMBIGUOUS_FAMILY → AMBIGUOUS_FAMILY | 8 | Consensus (differ on which family) |
| INSUFFICIENT → AMBIGUOUS_FAMILY | 2 | Borderline family detection |
| INSUFFICIENT → INSUFFICIENT | 5 | |

## 6. Mismatch Taxonomy

| Type | Count | Interpretation |
|---|---|---|
| FAMILY_ERROR | 0 | 11 reported → 0 true family confusion |
| BLIND_SPOT_ERROR | 12 | 10 overdiagnosis + 2 other |
| STATE_ERROR | 25 | |
| OVERDIAGNOSIS | 10 | AMB_BLIND golden → CLEAR engine |
| AMBIGUITY_ERROR | 10 | Same 10 overdiagnosis cases |
| DISQUALIFIER_ERROR | 0 | No disqualified primary detected |

**Family error reclassification:** 11 reported "family errors" break down as:
- **8 AMBIGUITY_CONSENSUS:** Both golden and engine say AMBIGUOUS_FAMILY, just differ on which family (G-AMB-007/008/009/013/015/016 + G-INS-009 + G-EXT-001). These are intentional boundary tests where the family IS ambiguous and both sides agree — only the selected primary differs.
- **3 NULL_TO_FAMILY_OVERDIAGNOSIS:** Golden expects INSUFFICIENT (no family), engine selects a family (G-INS-003, G-INS-004, G-INS-010).
- **0 true FAMILY_CONFUSION:** No case where golden expects family A and engine returns family B.

## 7. Root-Cause Attribution

Root causes separated from failure manifestations. No double-counting.

| Root Cause | Count | P-Level |
|---|---|---|
| EXTERNAL_CONSTRAINT_GUARD_NOT_EXECUTED | 5 | **P1** |
| AMBIGUITY_CALIBRATION | 13 | **P2** |
| GOLDEN_GOVERNANCE_DISPUTE | 4 | **P3** |
| OTHER_BOUNDARY_OVERDIAGNOSIS | 5 | **P2** |

**Layer ownership** (where the symptom manifests — C3 is the execution layer but root causes trace to C1 contracts):

| Layer | Count | Role |
|---|---|---|
| C3_FAMILY_INFERENCE | 0 | No genuine family errors |
| C3_WITHIN_FAMILY_INFERENCE | 10 | OVERDIAGNOSIS symptom manifests here |
| C3_INTEGRATION | 0 | Hierarchy/disqualifier/confidence clean |
| C1_FALSE_POSITIVE_GUARD | 5 | Guard defined but not executed downstream |
| C3_AMBIGUITY_CALIBRATION | 13 | Threshold stricter than golden standard |

## 8. External Constraints (P1)

10 adversarial external-constraint cases. 5 produce false-positive cognitive diagnoses:

| Case ID | Engine | Golden | Root |
|---|---|---|---|
| G-EXT-003 | LMG / CLEAR | AMB_BLIND | EFFORT_VS_MECHANISM satisfies LMG NCs |
| G-EXT-004 | DI / CLEAR | AMB_BLIND | WAITING_DURATION_PATTERN triggers DI |
| G-EXT-005 | THT / CLEAR | AMB_BLIND | DIRECTION_SWITCHING_FREQUENCY triggers THT |
| G-EXT-008 | OB / CLEAR | AMB_BLIND | 3 OB signals, 0 contradicting, clean cognitive case |
| G-EXT-009 | STG / CLEAR | AMB_BLIND | 2 STG signals cleanly satisfy NCs |

**Root cause: C1_FALSE_POSITIVE_GUARD_NOT_EXECUTED.** All 9 C1 boundaries define `falsePositivePatterns` and `externalConstraints` with specific patterns. Neither `withinFamilyBlindSpotInference.js` nor `hierarchicalBlindSpotInference.js` reference these fields. The guards exist in the ontology but are never consulted during inference.

## 9. Same-Occupation (CORRECTED)

| Metric | Value |
|---|---|
| Groups | 5 (not 10) |
| Cases | 10 |
| Collapsed groups | 0 |
| Differentiated | 5/5 |
| All exact match | 10/10 |

All 5 pairs (COOK, PROGRAMMER, TEACHER, DESIGNER, STUDENT) are both differentiated AND exact-matched. No collapse. The earlier report's "10 collapsed groups" was a counting bug: grouping by caseId prefix instead of `goldenMeta.validationGroup`.

## 10. Cross-Occupation (CORRECTED)

| Metric | Value |
|---|---|
| Groups | 10 (not 9) |
| Cases | 46 |
| Consistent within group | 9/10 |
| Inconsistent | 1 (GROUP_CROSS_OCCUPATION_MIXED — intentionally different blind spots) |

The earlier report's "9 groups" was missing GROUP_CROSS_OCCUPATION_MIXED because grouping was by `family||blindSpot` key instead of `goldenMeta.validationGroup`.

## 11. Architecture Integrity

| Check | Result |
|---|---|
| Hierarchy violations | 0 |
| Disqualified-as-primary | 0 |
| Confidence inflation | 0 |
| Orphan evidence | 0 |
| Determinism (1000 runs) | 0 violations |
| Cross-family blind spot selection | 0 |

## 12. Disputed Golden Queue (4 cases)

G-AMB-002, G-AMB-003, G-AMB-005, G-AMB-010 — all LOW confidence, all UNRESOLVED_MISMATCH. Engine makes CLEAR diagnosis from 2-3 signals where golden expects AMBIGUOUS_BLIND_SPOT. Both interpretations are defensible — these are genuine boundary disputes, not architecture defects.

## 13. Legacy Pattern Success

| Case | Golden | Engine | Match |
|---|---|---|---|
| G-LEG-001 | DI / CLEAR | DI / CLEAR | ✓ |
| G-LEG-002 | FLG / CLEAR | FLG / CLEAR | ✓ |
| G-LEG-003 | LMG / CLEAR | LMG / CLEAR | ✓ |
| G-LEG-004 | OB / CLEAR | OB / CLEAR | ✓ |
| G-LEG-005 | DI / CLEAR | DI / CLEAR | ✓ |
| G-LEG-006 | LMG / CLEAR | LMG / CLEAR | ✓ |

All 6/6 exact match. Zero regression to old RC8 patterns (SINGLE_INCOME, TRAFFIC, SELLING, BUILD_PRODUCT, freelance, AI). Zero business contamination. ✅

## 14. Debt Severity (Frozen)

**P0:** 0

**P1:** EXTERNAL_CONSTRAINT_GUARD_NOT_EXECUTED
- Reason: C1 defines falsePositivePatterns/externalConstraints in all 9 boundaries. C3 inference never executes them. 5/10 adversarial external-constraint cases become cognitive diagnoses.
- Scope: Execution gap between C1 contracts and C3 inference layer.

**P2:**
- AMBIGUITY_THRESHOLD_CALIBRATION_GAP (13 AMB→INS cases)
- SIGNAL_FIDELITY_HEURISTIC (existing)
- SUPPRESSION_PENALTY_HEURISTIC (existing)
- FAMILY_AMBIGUITY_THRESHOLD_HEURISTIC (existing)
- SERENDIPITOUS_PATH_DISCOVERY (existing)

**P3:**
- GOLDEN_GOVERNANCE_DISPUTES (4 cases)
- C1 PM.NC2 wording ambiguity
- C1 LMG.NC2 wording ambiguity
- EVALUATION_REPORT_COUNTING_BUG (same/cross-occ grouping — RESOLVED in this correction)

## 15. Freeze Verification

- Golden expected labels modified: 0
- Golden governance metadata semantic changes: 0
- Inference files modified: 0
- Runtime modified: 0
- Production integration: 0
- Only evaluation/report/ADR corrections in this patch

## 16. Related

- `ADR-RC8.3-C4-001-GOLDEN-DATASET.md`
- `ADR-RC8.3-C3-003-HIERARCHICAL-INFERENCE.md`
