# ADR-RC8.3-STAGE1C-A: World Principle Mapping Design

**Status**: ACCEPTED (design only — do NOT wire it yet)

**Date**: 2026-09-09

**Phase**: RC8.3 Stage1C-A

**Parent**: ADR-RC8.3-STAGE1C-A-NORTH-STAR-GOVERNANCE

---

## 1. World Principle Authority Location (Audited)

- **File**: `cloudfunctions/generateAiReport/lib/engine/worldModel/worldPrinciples.js`
- **Version**: `world_model_v1`
- **Content**: 9 frozen world operating principles, each with
  `id`, `label`, `statement`, `mechanism`, `consequence`, `relatedBlindSpots`,
  `falsifiable`.
- **Authority**: ADR-RC8.3-C1-001 (World Principles) + the product Constitution
  §9 Q2 ("世界规则").

**Current wiring status: NOT WIRED.** Verified via
`grep -nER "WORLD_RULE|worldRule|世界规则|principle"` over
`cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1` and
`pages/v21-cognitive-report` → ZERO_MATCHES. The world principles are not yet
consumed by the v2_1 report chain. This ADR records the mapping DESIGN only.

---

## 2. Mapping Design (deterministic, all citations frozen source semantics)

Mapping schema:

```
BLIND_SPOT → WORLD_PRINCIPLE → USER_MODEL → MODEL_MISALIGNMENT → UPGRADED_MODEL
```

- `BLIND_SPOT` = `blindSpotDefinitions.js` id + mechanism (the user's current model)
- `WORLD_PRINCIPLE` = `worldPrinciples.js` principle id + statement (how reality operates)
- `USER_MODEL` = blind spot `mechanism` (frozen)
- `MODEL_MISALIGNMENT` = principle `mechanism`/`consequence` (frozen)
- `UPGRADED_MODEL` = strategy `cognitiveUpgrade` (frozen, from `strategyDefinitions.js`)

### Mapping Table (9/9 — no GAP)

| # | BLIND_SPOT | WORLD_PRINCIPLE | STRATEGY (UPGRADED_MODEL) |
|---|-----------|-----------------|---------------------------|
| 1 | OPPORTUNITY_BLINDNESS | OPPORTUNITY_EMERGES_THROUGH_EXPOSURE | EXPAND_OPTIONALITY |
| 2 | FEEDBACK_LOOP_GAP | FEEDBACK_UPDATES_MODELS | BUILD_FEEDBACK_LOOP |
| 3 | DECISION_INERTIA | DECISION_CREATES_INFORMATION | INCREASE_EXPERIMENT_RATE |
| 4 | RISK_MODEL_DISTORTION | RISK_IS_ASYMMETRICAL | REFRAME_RISK_MODEL |
| 5 | PROBABILITY_MISJUDGMENT | PROBABILITY_GOVERNS_OUTCOMES | UPGRADE_PROBABILITY_THINKING |
| 6 | IDENTITY_CONSTRAINT | IDENTITY_CONSTRAINS_CHOICES | EXPAND_IDENTITY_BOUNDARY |
| 7 | LEVERAGE_MODEL_GAP | LEVERAGE_MULTIPLIES_VALUE | BUILD_LEVERAGE_MODEL |
| 8 | SYSTEM_THINKING_GAP | SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR | BUILD_DECISION_SYSTEM |
| 9 | TIME_HORIZON_TRAP | TIME_COMPOUNDS_ADVANTAGE | EXTEND_TIME_HORIZON |

### BlindSpot → Principle citation (frozen `relatedBlindSpots`, authoritative)

Every principle's `relatedBlindSpots` field in `worldPrinciples.js` names exactly
one blind spot, and the pairing is a strict bijection:

| Principle | relatedBlindSpots (verbatim) |
|-----------|------------------------------|
| DECISION_CREATES_INFORMATION | `['DECISION_INERTIA']` |
| FEEDBACK_UPDATES_MODELS | `['FEEDBACK_LOOP_GAP']` |
| PROBABILITY_GOVERNS_OUTCOMES | `['PROBABILITY_MISJUDGMENT']` |
| RISK_IS_ASYMMETRICAL | `['RISK_MODEL_DISTORTION']` |
| LEVERAGE_MULTIPLIES_VALUE | `['LEVERAGE_MODEL_GAP']` |
| TIME_COMPOUNDS_ADVANTAGE | `['TIME_HORIZON_TRAP']` |
| IDENTITY_CONSTRAINS_CHOICES | `['IDENTITY_CONSTRAINT']` |
| OPPORTUNITY_EMERGES_THROUGH_EXPOSURE | `['OPPORTUNITY_BLINDNESS']` |
| SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR | `['SYSTEM_THINKING_GAP']` |

### BlindSpot → Strategy citation (frozen `BLIND_SPOT_TO_STRATEGY_V2`)

`strategyEngineV2.js` `BLIND_SPOT_TO_STRATEGY_V2` is the authoritative 1:1 map
and matches `strategyDefinitions.js` `targetBlindSpot` bidirectionally. 9/9
covered; no GAP.

---

## 3. GAP Audit

**GAP_COUNT = 0.** Every one of the 9 blind spots has:
- a deterministic world principle (`relatedBlindSpots` bijection), and
- a deterministic strategy (`BLIND_SPOT_TO_STRATEGY_V2`), and
- a frozen `USER_MODEL` (blind spot mechanism),
- a frozen `MODEL_MISALIGNMENT` (principle mechanism/consequence),
- a frozen `UPGRADED_MODEL` (strategy cognitiveUpgrade).

No mapping requires AI-generated reasoning. All citations are frozen source
semantics.

---

## 4. Wiring Constraint (frozen)

This ADR is design-only. **Do NOT wire worldPrinciples into the report chain in
Stage1C-A.** Wiring belongs to a later stage (Stage1C-B, the presentation model
implementation), and must obey the Presentation Model Boundary in the master ADR
§8 (derive only, never invent/override).
