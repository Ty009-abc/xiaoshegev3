# ADR RC8.3 C4-001 — Golden Dataset Governance

- **Status:** REVIEWED
- **Sprint:** C4-001 → C4-001A (governance patch)
- **Date:** 2026-08-08
- **Base commit:** e5528ee (100-case dataset)

## 1. Purpose

100-case golden dataset for the hierarchical cognitive blind spot inference pipeline (C3). Covers all 4 families × 9 blind spots with clear, ambiguous, insufficient, external-constraint, and legacy-failure cases.

## 2. Governance Rules

### 2.1 Golden Dataset ≠ Engine Regression Snapshot

Golden expected labels are normative human-reviewed labels derived from:

1. C1 World Principles
2. C1 Blind Spot Boundaries
3. Human mechanism judgment

The current inference engine output is measured for agreement but MUST NOT be used to rewrite or derive Golden expected labels.

A current-engine mismatch is NOT automatically a dataset failure.

### 2.2 Structural vs Semantic Validation

```
STRUCTURAL VALIDATION (C4-001A): 100/100 PASS
  - unique IDs
  - required fields
  - valid enums
  - valid rationale shape
  - valid governance metadata

CURRENT ENGINE AGREEMENT (C4-001A): 66/100
  - EXPECTED MISMATCH:  30
  - UNRESOLVED MISMATCH: 4
  - DISPUTED:            4
```

### 2.3 No Accuracy Claim Yet

The 66% engine agreement is NOT accuracy. Actual evaluation metrics belong to C4-002, which should distinguish:

- Clear diagnosis accuracy
- Ambiguity discrimination
- Insufficient-evidence discrimination
- External-constraint false-positive / overdiagnosis rate
- Cross-occupation invariance
- Same-occupation differentiation

## 3. Case Categories

| Category | Count | Purpose |
|----------|-------|---------|
| Clear (per blind spot) | 62 | Normative mechanism diagnosis |
| Ambiguous blind spot | 23 | Boundary between evidence levels |
| Ambiguous family | 8 | Family-level ambiguity probes |
| Insufficient evidence | 7 | Evidence threshold testing |
| External constraint | 10 | Adversarial false-positive probes |
| Cross-occupation | 46 | Occupation-should-not-determine tests |
| Same-occupation | 10 | Same occupation, different evidence |
| Legacy failure | 6 | Old RC8 system failure patterns |

## 4. Governance Metadata

Every Golden Case carries `goldenMeta`:

```
goldenMeta: {
  confidence: 'HIGH' | 'MEDIUM' | 'LOW',
  reviewStatus: 'REVIEWED' | 'NEEDS_REVIEW' | 'DISPUTED',
  labelSource: 'HUMAN_NORMATIVE' | 'ADVERSARIAL' | 'BOUNDARY' | 'ENGINE_CONFIRMED',
  validationRole: 'STANDARD' | 'CROSS_OCCUPATION' | 'SAME_OCCUPATION' |
                 'EXTERNAL_CONSTRAINT' | 'LEGACY_FAILURE' | 'BOUNDARY',
  validationGroup: string | null,
  selfValidationStatus: 'MATCH' | 'EXPECTED_MISMATCH' |
                        'UNRESOLVED_MISMATCH' | 'NOT_APPLICABLE'
}
```

## 5. Distribution (C4-001A)

| Dimension | Values |
|-----------|--------|
| Confidence | HIGH: 62, MEDIUM: 34, LOW: 4 |
| Review | REVIEWED: 96, DISPUTED: 4 |
| Label Source | HUMAN_NORMATIVE: 84, ADVERSARIAL: 16 |
| Validation Role | CROSS_OCCUPATION: 46, BOUNDARY: 18, STANDARD: 10, EXTERNAL_CONSTRAINT: 10, SAME_OCCUPATION: 10, LEGACY_FAILURE: 6 |
| Self-Validation | MATCH: 66, EXPECTED_MISMATCH: 30, UNRESOLVED_MISMATCH: 4 |

## 6. Cross-Occupation Groups (10)

- GROUP_DI_CROSS_OCCUPATION (4 cases)
- GROUP_FLG_CROSS_OCCUPATION (4)
- GROUP_LMG_CROSS_OCCUPATION (4)
- GROUP_THT_CROSS_OCCUPATION (4)
- GROUP_OB_CROSS_OCCUPATION (4)
- GROUP_RMD_CROSS_OCCUPATION (4)
- GROUP_PM_CROSS_OCCUPATION (4)
- GROUP_IC_CROSS_OCCUPATION (4)
- GROUP_STG_CROSS_OCCUPATION (4)
- GROUP_CROSS_OCCUPATION_MIXED (10)

## 7. Disputed Cases (4)

Cases where human normative judgment and engine output disagree in a genuinely unsettled way:

| ID | Expected | Engine | Rationale |
|----|----------|--------|-----------|
| G-AMB-002 | AMBIGUOUS_BLIND_SPOT | CLEAR (THT) | Low evidence, human says ambiguous; engine finds enough for THT |
| G-AMB-003 | AMBIGUOUS_BLIND_SPOT | CLEAR (RMD) | Same pattern — boundary between low-certainty clear and ambiguous |
| G-AMB-005 | AMBIGUOUS_BLIND_SPOT | CLEAR (THT) | Same pattern for RCG family |
| G-AMB-010 | AMBIGUOUS_BLIND_SPOT | CLEAR (STG) | Same pattern for FRG family |

These require human review before being used as pass/fail criteria in C4-002.

## 8. Acceptance Gates

- [x] 100/100 cases contain goldenMeta
- [x] 0 invalid metadata enums
- [x] All CROSS_OCCUPATION cases have validationGroup
- [x] All SAME_OCCUPATION cases have validationGroup
- [x] All EXT cases explicitly classified
- [x] All G-LEG cases explicitly classified
- [x] Expected labels unchanged (0 changes)
- [x] Inference modified = 0
- [x] Runtime modified = 0
- [x] Structural validation = 100%
- [x] Engine agreement reported separately (NOT as "validation rate")
- [x] ADR explicitly states Golden Dataset != Engine Snapshot
