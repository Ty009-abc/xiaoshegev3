# ADR-RC8.4-V6-PRODUCT-FIRST-GOVERNANCE

- **Status:** ACCEPTED (design governance)
- **Date:** 2026-09-11
- **Deciders:** 吕剑方 (owner) · 009 (RC8.4 design line)
- **Supersedes (as primary product authority):** `RC8.3_WORLD_MODEL_PRIMARY_PLAN`
- **Context branch:** `design/rc8.4-v6-9q-refoundation`

---

## 1. Context

RC8.3 built a large, high-quality **World Model v2.1** engine: 18 questions, 9
constructs, 48 atomic evidence, a North Star cognitive report. The engine is
technically sound but the primary consumer product must answer a different
question:

> **"为什么这个人一直卡在这里？"**
> not **"这个人属于什么认知模型？"**

The RC8.3 North Star path optimizes ontology correctness. Consumers need personal
relevance, impact, mechanism clarity, actionability, and traceability — in a short
reading. The primary-product plan is therefore terminated; the engine is preserved
as secondary evidence.

## 2. Decision

1. **Terminate** the World Model v2.1 **primary-product plan**.
   - `RC8.3_WORLD_MODEL_PRIMARY_PLAN = TERMINATED`
   - `WORLD_MODEL_PRIMARY_AUTHORITY = NO`
2. **Preserve** the engine code and its runtime role.
   - `WORLD_MODEL_ENGINE = PRESERVE` · `WORLD_MODEL_CODE_DELETE = NO`
   - Future role: `SECONDARY_EVIDENCE / OPTIONAL_DEEP_TEST / RESEARCH_SHADOW`
   - It must **not** become V6 primary authority by accident.
3. **New primary product:** `TURNAROUND_STRATEGY_V6`, **9 questions**, five-card
   report.
4. **Product-first development order is mandatory** (see §4).
5. This branch is the **RC8.4 design production line only** (see §3).

## 3. Branch role freeze

```
BRANCH_ROLE = RC8.4_DESIGN_PRODUCTION_LINE
```

Allowed on `design/rc8.4-v6-9q-refoundation`:

- product specification
- 9Q questionnaire design
- rule-table design
- Golden product fixtures
- ADRs
- acceptance gates

FORBIDDEN on this branch:

- runtime code
- cloudfunctions production changes
- page implementation
- V2.1 modification
- deploy
- env
- Primary
- Gate-B
- payment

Future runtime implementation must **branch from the final accepted RC8.4 design
tip**, not from this working branch.

## 4. Mandatory development order (no engine-first failure)

```
1. 9Q final copy
2. deterministic rule table        (derived FROM goldens)
3. 10–20 human-readable fixture reports
4. human product review
5. only then code engine
6. only then UI
7. only then automation tests
```

**Do NOT start from rules.** Do not build ontology before report quality is proven.
The deterministic rule table is derived only after Golden quality passes.

## 5. Scope of the primary product

- 5 primary bottlenecks only: `DIRECTION_GAP, ACTION_GAP, CONSISTENCY_GAP,
  VALIDATION_GAP, REPEATABILITY_GAP`.
- 2 modifiers only: `REALITY_CONSTRAINT`, `BELIEF_REALITY_GAP` (never primary).
- No new large ontology. No percentages. No probability. No scores for appearance.

## 6. Anti-overclaim (constitutional)

Never infer or state: personality, destiny, income potential, future wealth,
success probability. Forbidden tokens: **你一定 / 你注定 / 只要就能 / 成功率 /
翻身概率**. Certainty language only about *current observed state*.

## 7. Consequences

- Positive: consumer-relevant, short, actionable reports; engine work becomes
  optional enrichment.
- Cost: RC8.3 18Q/North Star becomes secondary; some prior primary-product effort
  is repurposed rather than shipped.
- Risk: rule table over-fit to 15 Goldens → mitigated by keeping the table
  **not frozen** until design acceptance and by requiring Golden provenance per rule.

## 8. Compliance

- `WORLD_MODEL_V21_CHANGED = NO`
- `RUNTIME_CODE_CHANGED = NO`
- This ADR and the accompanying design docs are the only artifacts added.

## 9. References

- `docs/RC8.4_TURNAROUND_STRATEGY_V6_9Q_REFOUNDATION_DESIGN.md`
- `docs/RC8.4_V6_PRODUCT_GOLDEN_15_CASES.md`
- `docs/RC8.4_V6_PRIMARY_BOTTLENECK_RULE_TABLE.md`
- Frozen engine: `cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/`
  and `.../lib/presentation/worldModel/v2_1/`
