# ADR-RC8.3-STAGE1C-A: Dimension Governance (8 Canonical + 1 Derived Meta)

**Status**: ACCEPTED (governance freeze — no implementation)

**Date**: 2026-09-09

**Phase**: RC8.3 Stage1C-A

**Parent**: ADR-RC8.3-STAGE1C-A-NORTH-STAR-GOVERNANCE

---

## Decision

The Constitution (Tier1) §5 defines **8 canonical dimensions**. The current V2.1
runtime operates on **9 dimensions** (adds `SYSTEMS`). The reconciliation found
this 8-vs-9 text divergence.

**We do NOT silently rewrite 8 canonical dimensions into 9.**

**Frozen provisional governance model: `8_CANONICAL_PLUS_1_DERIVED_META`.**

### 8 Canonical Dimensions (Tier1 authority, frozen)

| Dimension | Focus (Constitution §5) |
|-----------|--------------------------|
| DECISION_MODEL | How decisions are made |
| RISK_MODEL | How risk is perceived and managed |
| PROBABILITY_MODEL | How probability and uncertainty are understood |
| FEEDBACK_MODEL | How feedback is sought and processed |
| OPPORTUNITY_MODEL | How opportunities are recognized and evaluated |
| LEVERAGE_MODEL | How leverage is understood and deployed |
| IDENTITY_MODEL | How identity constrains or enables action |
| TIME_MODEL | How time is allocated and valued |

### 1 Derived Meta Dimension (provisional classification)

| Dimension | Governance classification |
|-----------|---------------------------|
| SYSTEMS | DERIVED_META_DIMENSION |

`SYSTEMS` is classified as a DERIVED_META_DIMENSION: it is an engine-level
cross-cutting construct (system thinking spans decision/feedback/time/leverage),
not one of the 8 canonical user-facing model dimensions named by the
Constitution.

---

## Constraints (frozen)

- **Current runtime behavior must NOT change.** The engine continues to emit its
  existing dimension set; nothing here alters inference.
- **Do not change inference code.**
- **Do not change Golden labels.**
- **Do not modify output semantics in this stage.**

Resolution of the 8-vs-9 canonical set (e.g., whether to formally re-write the
Constitution §5 to 9, or to formally demote SYSTEMS in the Constitution) is a
Tier1 governance decision deferred to a later explicit owner directive. This
ADR only freezes the provisional classification so Stage1C presentation work
does not drift the canonical set.
