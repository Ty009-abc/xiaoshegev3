# ADR-RC8.3-STAGE1C-E — North Star Release Gate & RC Freeze

- Status: Accepted (source-level RC candidate)
- Date: 2026-09-09
- Scope: Stage1C-E2 — final release gate. Tests/fixtures/governance ONLY.
- Baseline: `54164e205837668979bc37d3b4c04bedbe721ece`

## 1. Purpose

Define the durable, executable release gate that freezes Stage1C as a
**source-level RC candidate**. This gate proves, on every run:

1. diagnosis truth is unchanged
2. Presentation Truth is unchanged
3. Report Expression is unchanged
4. UI IA is unchanged
5. Report Golden prevents North Star drift
6. cross-layer authority remains one-way
7. all six diagnosis states remain truthful
8. no schema/prediction/wealth leakage exists

This ADR is a **governance manifest**; the executable evidence lives in
`tests/rc8.3-stage1c-e2-final-release-gate.test.js` and the Report Golden
dataset `tests/fixtures/reportGoldenV21.js`.

## 2. Accepted Lineage (frozen)

| Stage | Commit | Content |
|-------|--------|---------|
| A | `e8a2807b2bb6503a0724374b376b364681298594` | Governance ADRs |
| B | `19e1f60f3b0d13c8b49bcae854fd05e33d38500f` | Presentation Truth |
| C | `f66a4583e83d416cb45f3c0dd9f2c72e67bb6868` | Report Expression |
| D | `54164e205837668979bc37d3b4c04bedbe721ece` | UI IA (baseline) |

All four MUST be ancestors of the RC freeze HEAD.

## 3. North Star Release Contract (frozen obligations)

The gate MUST hold all of the following simultaneously:

- NSR invariants: 10/10
- World principle mapping: 9/9 (blindSpot → principle, strict bijection)
- Strategy mapping: 9/9 (blindSpot → strategy via `BLIND_SPOT_TO_STRATEGY_V2`)
- Unique blind spots: 9/9
- Multi-state: 6/6 (UNIQUE / MULTIPLE / NO_PRIMARY / INSUFFICIENT / CONTRADICTORY / BLOCKED·NOT_EXECUTED)
- Report Golden cases: ≥15 (9 unique-primary + 6 multi-state)
- No fabricated evidence
- No fabricated primary
- No raw schema leak (user-visible render path)
- No visible English library prose
- No unsupported prediction
- No wealth promise
- No report shadow authority
- No UI shadow authority
- No diagnosis output drift
- No Stage1C-B output drift
- No Stage1C-C output drift
- No Stage1C-D semantic drift
- Regression fail = 0

## 4. Authority DAG (frozen, one-way downward)

```
ENGINE → PRESENTATION → REPORT → UI
```

- ENGINE_IMPORTS_{PRESENTATION,REPORT,UI} = 0
- PRESENTATION_IMPORTS_{REPORT,UI} = 0
- REPORT_IMPORTS_UI = 0
- REPORT_REDERIVES_DIAGNOSIS = 0
- REPORT_SHADOW_SEMANTIC_AUTHORITY = 0
- UI_REDERIVES_DIAGNOSIS = 0
- UI_SHADOW_SEMANTIC_AUTHORITY = 0

## 5. Report Golden Governance Validity

Report Golden is **NOT** an inference tuning dataset. It:

- does NOT change engine
- does NOT change thresholds
- does NOT change diagnosis labels
- does NOT reselect primary

It only validates **explanation / product meaning**. It is the anti-drift
authority for report semantics, distinct from Diagnosis Golden (engine truth).

## 6. Known P2 Debt (frozen, non-blocking)

- `P2_CURRENT_MODEL_WORLD_RULE_DUPLICATION = OPEN`
- Origin: Stage1C-C builder double-calls `getBlindSpotCurrentModel`.
- `currentModel.statement === worldRule.userModel`
- Dedicated observation test detects it; `DUPLICATION_GROWTH_COUNT` must be 0.
- Stage1C-C is NOT modified by Stage1C-E.

## 7. RC Freeze Semantics

`STAGE1C_RC_CANDIDATE = YES` is a **SOURCE-LEVEL** declaration only.

It is explicitly NOT:
- production deployment approval
- Primary approval
- Gate-B approval
- real-payment approval

Gate-B remains separate governance. Payment outbound credential remains
separately frozen-blocked.

## 8. Deployment Status (frozen)

- `SAFE_FOR_PRIMARY = NO`
- `SAFE_FOR_REAL_PAYMENT = NO`
- `SAFE_FOR_TEST_PREVIEW_DEPLOYMENT` = subject to the governance exception
  defined in `ADR-RC8.3-STAGE1C-A-NORTH-STAR-GOVERNANCE.md` (§5).
- `TEST_PREVIEW_DEPLOY_EXCEPTION_REQUIRED = YES`

## 9. Publication

`SAFE_TO_PUBLISH_STAGE1C_E = YES` does NOT authorize commit/push. The owner
authorizes publication separately.
