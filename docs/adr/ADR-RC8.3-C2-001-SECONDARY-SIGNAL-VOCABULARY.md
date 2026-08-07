# ADR-RC8.3-C2-001 — Secondary Signal Vocabulary

| Field | Value |
|-------|-------|
| **ADR** | RC8.3-C2-001 |
| **Parent** | RC8.3 C1 Architecture Project → C2 Secondary Signals |
| **Status** | COMPLETE (PASS) |
| **Date** | 2026-08-07 |
| **Type** | Architecture Definition |

---

## Objective

Define 23 secondary signals that help distinguish between confusable blind spots when primary evidence is ambiguous.

## Design Principle

Secondary signals are **differentiators, not detectors**. A signal's value alone does NOT trigger a diagnosis — it only shifts confidence between competing hypotheses.

Each signal:
- References at least one C1 Boundary
- Has contradiction patterns
- Does NOT directly determine Archetype, Blind Spot, or Strategy
- Requires ≥ 2 evidence items (or 1 strong + 1 contextual)
- Has minimumEvidence and ambiguityNotes

## Signal Coverage

### By Boundary Pair

| Pair | Signals | Key Distinguishing Question |
|------|---------|---------------------------|
| DECISION_INERTIA vs FEEDBACK_LOOP_GAP | 4 | "不敢动"还是"动了但没学到"？ |
| LEVERAGE_MODEL_GAP vs TIME_HORIZON_TRAP | 5 | "不会放大"还是"不愿等待"？ |
| RISK_MODEL_DISTORTION vs PROBABILITY_MISJUDGMENT | 5 | "判断被扭曲"还是"缺少判断工具"？ |
| SYSTEM_THINKING_GAP vs FEEDBACK_LOOP_GAP | 3 | "不会用反馈概念"还是"有概念但不用"？ |
| OPPORTUNITY_BLINDNESS vs IDENTITY_CONSTRAINT | 6 | "看不到"还是"看到了但被身份过滤"？ |

### By Blind Spot

| Blind Spot | Related Signals |
|-----------|---------------|
| DECISION_INERTIA | 4 |
| FEEDBACK_LOOP_GAP | 7 |
| LEVERAGE_MODEL_GAP | 5 |
| TIME_HORIZON_TRAP | 5 |
| OPPORTUNITY_BLINDNESS | 6 |
| RISK_MODEL_DISTORTION | 5 |
| PROBABILITY_MISJUDGMENT | 5 |
| IDENTITY_CONSTRAINT | 6 |
| SYSTEM_THINKING_GAP | 3 |

### By Dimension

| Dimension | Signals |
|-----------|---------|
| EXECUTION_ADAPTATION_GAP | 4 |
| RESOURCE_COMPOUNDING_GAP | 5 |
| PERCEPTION_RISK_GAP | 5 |
| FRAMEWORK_GAP | 9 |

## Signal Validation

| Check | Result |
|-------|--------|
| Total signals | 23 |
| All required fields present | 23/23 |
| Contamination (7 categories) | **0** |
| Direct-determination violations | **0** |
| Syntax valid | PASS |
| Module requires | PASS |

## Engineering

| Metric | Value |
|--------|-------|
| File created | `cloudfunctions/generateAiReport/lib/engine/worldModel/secondarySignalDefinitions.js` |
| Existing files modified | 0 |
| Runtime files changed | 0 |
| Git staged | No |
| Commit | No |

## Verdict

| Gate | Result |
|------|--------|
| Boundary pairs covered | 5/5 |
| Blind spots covered | 9/9 |
| Contamination | PASS — 0 hits |
| Direct-determination | PASS — 0 violations |
| Ready for C3 (Signal Integration) | Yes |
| **Result** | **PASS** |
