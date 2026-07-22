# ARCHITECTURE.md

> Turnaround OS V6 · System Architecture
>
> **Current stable:** v6-checkpoint5
> **Test baseline:** 165 pass / 0 fail
>
> This is the design blueprint for Turnaround OS V6. It documents the
> system's structure, data flow, module responsibilities, and
> architectural decisions. Read this before modifying any engine.

---

## 1. Overview

Turnaround OS V6 is a **deterministic rule engine** that analyzes a
user's financial and psychological profile, diagnoses their "wrong
game" (trapped behavior patterns), recommends leverage strategies,
projects two possible futures (with/without change), generates mission
plans, and produces executable action plans.

### Design Principles

- **Pure functions** — every engine is a stateless, side-effect-free
  function
- **Deterministic** — same input always produces the same output; no
  `Math.random()`, no `Date()`, no external API calls
- **Layered** — strict separation between contracts, engines,
  simulators, and validators
- **Zero runtime dependencies** — engines run in pure Node.js; no
  database, no network, no AI API calls at the engine layer
- **Backward compatible** — every checkpoint preserves all prior
  checkpoint behavior

---

## 2. System Pipeline

```
User Profile
     │
     ▼
┌─────────────────┐
│ Identity Engine │  wealthStage, readiness, capability/psychology scores
└────────┬────────┘
         │
         ▼
┌────────────────────┐
│ Wrong Game Engine   │  primary wrong game + evidence + rejected games
└────────┬───────────┘
         │
         ▼
┌───────────────────┐
│ Leverage Engine    │  primary lever + secondary + rejected levers
└────────┬──────────┘
         │
         ▼
┌──────────────────┐
│ Strategy Engine   │  headline, strategy, confidence, limiting factors
└────────┬─────────┘
         │
         ▼
┌───────────────────┐
│ Projection Engine  │  World A (no change) / World B (with change)
└────────┬──────────┘
         │
         ▼
┌──────────────────┐
│ Mission Engine    │  7 missions across phases with priorities
└────────┬─────────┘
         │
         ▼
┌───────────────────┐
│ Action Engine      │  Action plan with DAG dependencies + state machine
└───────────────────┘
```

Each engine depends only on the **output of the previous engine**, plus
the original profile. Engines never call each other except through their
documented contracts.

---

## 3. Module Tree

```
core/turnaround-os/
├── index.js                  # Public API entry point
├── constants.js              # All enums, thresholds, labels
│
├── schemas/                  # Data shapes, normalization, defaults
│   ├── identityProfileV6.js
│   ├── strategyContractV6.js
│   ├── futureProjectionV6.js
│   ├── missionContractV6.js
│   └── actionContractV6.js
│
├── contracts/                # Factory functions for validated objects
│   ├── destinyProjectionContractV6.js
│   ├── missionPlanContractV6.js
│   └── actionPlanContractV6.js
│
├── engines/                  # Pure business logic
│   ├── identityEngineV6.js
│   ├── wrongGameEngineV6.js
│   ├── leverageEngineV6.js
│   ├── turnaroundEngineV6.js  (Strategy)
│   ├── whyEngineV6.js
│   ├── destinyProjectionEngineV6.js
│   ├── missionEngineV6.js
│   ├── missionPrioritizerV6.js
│   ├── actionEngineV6.js
│   └── actionSchedulerV6.js
│
├── simulators/               # World A/B projection simulators
│   ├── worldASimulator.js
│   └── worldBSimulator.js
│
├── state/                    # State machines
│   └── actionStateMachineV6.js
│
├── validators/               # Post-generation validation
│   ├── validateIdentityV6.js
│   ├── validateWrongGameV6.js
│   ├── validateLeverageV6.js
│   ├── validateStrategyV6.js
│   ├── validateProjectionV6.js
│   ├── validateMissionPlanV6.js
│   └── validateActionPlanV6.js
│
└── utils/                    # Shared utilities
    ├── deterministic.js
    ├── normalize.js
    └── score.js
```

---

## 4. Layer Descriptions

### 4.1 Schemas (`schemas/`)

**Responsibility:** Define data shapes, provide normalization (sanitize
raw user input) and default factories.

- No business logic
- No engine imports
- Only import from `constants.js` and `utils/`

Example:
```js
const profile = normalize(rawInput)  // fill defaults, clamp ranges
```

### 4.2 Contracts (`contracts/`)

**Responsibility:** Factory functions that create fully-formed,
validated data objects. Contracts are the **output format** guarantee.

- Import from schemas for structure
- Objects created by contracts are **frozen** (immutable)
- Engine output always passes through a contract factory

### 4.3 Engines (`engines/`)

**Responsibility:** Pure business logic. Transform input → output.

- Import from schemas, contracts, validators
- Import from simulators (projection engine only)
- **No** side effects, **no** external API calls, **no** randomness
- Each engine exports 1-2 public functions

### 4.4 Simulators (`simulators/`)

**Responsibility:** Simulate World A (status quo trajectory) and World B
(change trajectory) across 90-day, 1-year, and 3-year horizons.

- Used only by `destinyProjectionEngineV6`
- Produce structured snapshots per time period

### 4.5 State (`state/`)

**Responsibility:** Finite state machines for runtime behavior.

- `actionStateMachineV6.js` — 12 states, 17 legal transitions
- Used by Action Engine to validate state transitions at runtime

### 4.6 Validators (`validators/`)

**Responsibility:** Post-generation validation. Every engine has a
corresponding validator that checks structural integrity, range
constraints, and semantic rules.

- Run after engine output is produced (not during)
- Fail loudly — throw or return structured errors
- Used in tests to catch regressions

### 4.7 Utilities (`utils/`)

**Responsibility:** Shared helpers with zero business knowledge.

| Module | Purpose |
|---|---|
| `deterministic.js` | Counter-based ID generation (no Math.random) |
| `normalize.js` | Generic object field normalization |
| `score.js` | Weighted sum, clamping, percentile calculations |

---

## 5. Data Flow (Detailed)

### 5.1 Checkpoint 2 — Core Personality Analysis

```
rawUserInput
    │
    ▼
identityProfileV6.normalize()         → clean profile
    │
    ▼
identityEngineV6.buildIdentity()      → profile + wealthStage + scores
    │
    ├──► wrongGameEngineV6.detectWrongGame()
    │        → wrongGameResult { primary, evidence[], rejected[] }
    │
    └──► leverageEngineV6.determineLeverage()
             → leverageResult { primary, secondary[], rejected[] }
                  │
                  ▼
            turnaroundEngineV6.generateStrategy()
                → strategy { headline, summary, confidence, assumptions }
```

### 5.2 Checkpoint 3 — Projection & Why Engine

```
profile + wrongGameResult + strategy + leverageResult
    │
    ▼
worldASimulator.simulateWorldA()      → World A snapshots
worldBSimulator.simulateWorldB()      → World B snapshots
    │
    ▼
destinyProjectionEngineV6.projectDestiny()
    → projection { worldA, worldB, comparison, decisionNodes }
    │
    ▼
whyEngineV6.explain()                 → why results per snapshot
whyEngineV6.explainComparison()       → comparison narrative
whyEngineV6.explainDecisionNode()     → decision point explanations
```

### 5.3 Checkpoint 4A/B — Mission Planning

```
profile + strategy + projection
    │
    ▼
missionEngineV6.generateMissionPlan()
    → missionPlan {
        theme, principles, phases: [
          { missions: [...], checkpoint }
        ]
      }
    │
    ▼
missionPrioritizerV6.scoreMissionPriority()
    → scored missions with { phase, priorityScore, estimatedMinutes }
```

### 5.4 Checkpoint 5 — Action Planning

```
missionPlan + profile + strategy + projection
    │
    ▼
actionEngineV6.generateActionPlan()
    → actionPlan {
        actions: ActionDefinition[],
        dependencyGraph, dailySchedule[]
      }
    │
    ├──► actionStateMachineV6  (validates transitions)
    │
    └──► validateActionPlanV6  (validates plan structure)
```

---

## 6. Key Design Decisions

### 6.1 Pipeline Architecture

**Decision:** Linear pipeline with explicit handoffs. Each engine
receives the output of the previous engine plus the original profile.

**Rationale:** Easy to test in isolation, easy to swap implementations,
clear dependency graph. Tradeoff: cannot share intermediate results
across non-adjacent engines without passing them through.

### 6.2 Deterministic ID Generation

**Decision:** All IDs are counter-based (`MSN_D1_AIWF_003`) rather than
UUID or random.

**Rationale:** Determinism is required for test reproducibility. Counter
seeds from a hash of input data ensures consistent IDs across runs.

### 6.3 Immutable Outputs

**Decision:** All contract objects are deeply frozen (`Object.freeze`
recursively).

**Rationale:** Prevents accidental mutation during subsequent processing
steps. Enforced in tests (attempt mutation → expect failure).

### 6.4 State Machine for Actions

**Decision:** Action execution uses a formal finite state machine with
explicit transition rules, rather than ad-hoc status fields.

**Rationale:** Prevents impossible states (COMPLETED→IN_PROGRESS), makes
retry logic auditable, and enables DAG-aware scheduling.

### 6.5 Fallback Chains

**Decision:** Every mission has a structured `fallback` object with
`type`, `targetActionId`, and `reason`. No implicit fallbacks.

**Rationale:** Explicit fallbacks prevent silent failures. Cycle
detection ensures no infinite fallback loops.

### 6.6 Five-Persona Coverage

**Decision:** Every engine is tested against five personas (worker,
freelancer, creator, businessOwner, highIncomePro) and must produce
phylogenetically distinct results.

**Rationale:** Prevents engines from producing the same output for
different inputs (homogeneity bug).

---

## 7. Public API (`index.js`)

```
const turnaroundOS = require('./core/turnaround-os')

turnaroundOS.schemas.identityProfileV6
turnaroundOS.schemas.strategyContractV6
turnaroundOS.schemas.futureProjectionV6
turnaroundOS.schemas.missionContractV6

turnaroundOS.contracts.destinyProjectionContractV6
turnaroundOS.contracts.missionPlanContractV6

turnaroundOS.engines.buildIdentity(input)
turnaroundOS.engines.detectWrongGame(profile)
turnaroundOS.engines.determineLeverage(profile, wrongGameResult)
turnaroundOS.engines.generateStrategy(profile, wrongGameResult, leverageResult)
turnaroundOS.engines.projectDestiny(profile, wrongGameResult, strategy, leverageResult)
turnaroundOS.engines.generateMissionPlan({ profile, strategy, projection })
turnaroundOS.engines.scoreMissionPriority({ mission, profile, strategy, projection })
turnaroundOS.engines.why.explain(...)
turnaroundOS.engines.why.explainTrend(...)
turnaroundOS.engines.why.explainComparison(...)

turnaroundOS.simulators.simulateWorldA(...)
turnaroundOS.simulators.simulateWorldB(...)

turnaroundOS.validators.validateIdentityV6(...)
turnaroundOS.validators.validateWrongGameV6(...)
turnaroundOS.validators.validateLeverageV6(...)
turnaroundOS.validators.validateStrategyV6(...)
turnaroundOS.validators.validateProjectionV6(...)
turnaroundOS.validators.validateMissionContractV6(...)
turnaroundOS.validators.validateMissionPlanContractV6(...)

turnaroundOS.utils.score
turnaroundOS.utils.normalize
turnaroundOS.utils.deterministic
```

---

## 8. Extension Points

Future checkpoints should extend, not replace:

| Checkpoint | Expected Extension |
|---|---|
| CP6 | TBD — new engine or subsystem |
| CP7 | TBD |
| CP8 | TBD |

### Rules for Extension

1. New engines go in `engines/`, new schemas in `schemas/`
2. New engine **must** export a pure function with documented inputs
3. New engine **must** have a corresponding validator
4. New engine **must** have a `checkpointN.test.js`
5. Existing regression tests **must** still pass
6. Update `index.js` with the new export

---

*Last updated: 2026-07-22 · OpenClaw 009*
