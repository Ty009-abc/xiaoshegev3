# TESTING GUIDE

> Turnaround OS V6 · Testing Standards
>
> **Current stable:** v6-checkpoint5
> **Test baseline:** 165 pass / 0 fail
>
> This document defines how tests are structured, run, and maintained
> in Turnaround OS V6. Every contributor and AI agent must follow these
> rules.

---

## 1. Test Directory Structure

```
tests/
└── turnaround-os/
    ├── checkpoint2.test.js      # Identity, WrongGame, Leverage, Strategy, Safety
    ├── checkpoint3.test.js      # Projection, Why Engine, Determinism
    ├── checkpoint4a.test.js     # Mission Contract, Enums, Immutability
    ├── checkpoint4b.test.js     # Mission Plan, Category Codes, Fallback
    ├── checkpoint5.test.js      # Action Plan, State Machine, DAG Cycles
    └── fixtures/                # Test data (currently empty, reserved)
```

### Naming Convention

```
checkpointN.test.js
```

Where `N` is the checkpoint number. No other test files should appear
in this directory. All tests for a checkpoint live in a single file.

---

## 2. Checkpoint Test Inventory

| Test File | Sections | Tests | What It Covers |
|---|---|---|---|
| `checkpoint2.test.js` | 6 | 28 | Identity engine, wrong game detection, leverage determination, strategy generation, persona-specific strategies, safety checks |
| `checkpoint3.test.js` | 6 | 22 | Projection structure (World A/B), determinism & safety, why engine, projection meta, validator, persona differences |
| `checkpoint4a.test.js` | 8 | 27 | Mission contract creation, input interface, enum legality, determinism, undefined/null checks, numeric ranges, boundary checks, regression (CP2, CP3) |
| `checkpoint4b.test.js` | 8 | 29 | Category codes, plan structure, determinism, input contract, fallback validation, immutability, persona coverage, regression (CP4A) |
| `checkpoint5.test.js` | 8 | 59 | Action plan generation, deep freeze & structure, state machine transitions, time/cost/risk rules, DAG cycle detection, fallback chain cycles, validator, regression (CP2-CP4B) |

---

## 3. How to Run Tests

### Run All Tests Individually

```bash
node tests/turnaround-os/checkpoint2.test.js
node tests/turnaround-os/checkpoint3.test.js
node tests/turnaround-os/checkpoint4a.test.js
node tests/turnaround-os/checkpoint4b.test.js
node tests/turnaround-os/checkpoint5.test.js
```

### Run All Tests in Sequence

```bash
for f in tests/turnaround-os/checkpoint*.test.js; do
  echo "=== $f ==="
  node "$f" || exit 1
  echo ""
done
```

Each test file exits with code 0 on success, non-zero on failure.

---

## 4. Expected Output

A passing test file outputs:

```
RESULTS: N pass, 0 fail
```

or:

```
CHECKPOINT_N RESULTS: N pass, 0 fail
```

A failing test file will show the assertion error before the summary.

### Current Expected Baseline

```
checkpoint2:   RESULTS: 28 pass, 0 fail
checkpoint3:   RESULTS: 22 pass, 0 fail
checkpoint4a:  RESULTS: 27 pass, 0 fail
checkpoint4b:  CHECKPOINT_4B RESULTS: 29 pass, 0 fail
checkpoint5:   CHECKPOINT_5 RESULTS: 59 pass, 0 fail
```

---

## 5. Test Structure Pattern

Every checkpoint test file follows this structure:

```
1. Load dependencies (engines, schemas, contracts, validators)
2. Define persona fixtures (worker, freelancer, creator, businessOwner, highIncomePro)
3. Section 1..N: Functional tests grouped by concern
4. Regression section: Spawn child processes to run prior checkpoint tests
5. Summary: Print RESULTS line
```

### Persona Fixture Pattern

Each checkpoint defines five personas as factory functions:

```js
function makeWorker() { return { ... } }
function makeFreelancer() { return { ... } }
function makeCreator() { return { ... } }
function makeBusinessOwner() { return { ... } }
function makeHighIncomePro() { return { ... } }
```

These are used to verify persona diversity — engines must produce
distinct results for different profiles.

---

## 6. Regression Testing

Each checkpoint from CP4A onward includes a regression section that
spawns prior checkpoint tests as child processes:

```js
var cp = require('child_process')
var result = cp.spawnSync('node', ['tests/turnaround-os/checkpoint2.test.js'])
var match = result.stdout.match(/RESULTS: (\d+) pass/)
// verify pass count matches expected baseline
```

### Regression Chain

```
checkpoint2.test.js        ← standalone

checkpoint3.test.js        ← standalone

checkpoint4a.test.js       ← regression: CP2, CP3

checkpoint4b.test.js       ← regression: CP4A

checkpoint5.test.js        ← regression: CP2, CP3, CP4A, CP4B
```

Each new checkpoint adds regression for all prior checkpoints. This
ensures no change breaks existing behavior.

---

## 7. How to Add a New Test

### Adding to an Existing Checkpoint

1. Open `checkpointN.test.js`
2. Add a new test assertion in the relevant section
3. Run the file to verify it passes
4. Run all regression tests to verify nothing broke

Example:
```js
// In checkpoint2.test.js, SECTION 1: Identity Engine
✅ 1.4 readinessScore within valid range
  assert(p.readinessScore >= 0 && p.readinessScore <= 100,
    'readinessScore out of range: ' + p.readinessScore)
```

### Adding a New Checkpoint

1. Create `tests/turnaround-os/checkpointN.test.js`
2. Follow the standard structure (see Section 5)
3. Include regression for all prior checkpoints
4. Verify the full suite passes
5. Document the checkpoint in `CHECKPOINT_HISTORY.md`

---

## 8. Test Categories

### Functional Tests

Verify engine outputs are structurally correct and contain expected
values:

```
✅ 1.1 identity passes validator
✅ 2.1 wrong game has exactly one primary
✅ 3.1 projection contains worldA and worldB
```

### Determinism Tests

Run the same input three times and assert deep equality:

```
✅ 2.3 same input three runs produce identical results
✅ 3.1 same input three runs produce identical results
✅ 5.6 same input 100 runs produce identical results
```

### Safety Tests

Verify engines don't do dangerous things:

```
✅ 5.5 strategy contains no income-guarantee language
✅ 5.6 no payment module references in engine code
✅ 5.7 no database references in engine code
✅ 5.10 no AI API references in engine code
```

### Boundary Tests

Verify engines handle edge cases correctly:

```
✅ 6.1 confidence in range [0, 100]
✅ 6.2 estimatedMinutes in range [1, 1440]
✅ 5.2 SURVIVAL phase risk level never exceeds LOW
```

### Persona Diversity Tests

Verify five different profiles produce five meaningfully different
outputs:

```
✅ 3.7 five personas don't all have the same primary leverage
✅ 6.1 five personas produce different trajectories
✅ 7.2 five personas produce non-identical plans
```

### Immutability Tests

Verify output objects cannot be mutated:

```
✅ 2.1 ActionDefinition is deeply frozen
✅ 2.4 attempting to set a property on ActionDefinition throws
✅ 6.1 createMission returns frozen objects
```

### Regression Tests

Verify prior checkpoints still pass:

```
✅ 8.1 Checkpoint 2: 28 pass, 0 fail
✅ 8.2 Checkpoint 3: 22 pass, 0 fail
✅ 8.3 Checkpoint 4A: 27 pass, 0 fail
✅ 8.4 Checkpoint 4B: 29 pass, 0 fail
```

---

## 9. Pass/Fail Criteria

### A Test File PASSES When

- Every assertion succeeds (no thrown errors, no failed assertions)
- The output ends with `N pass, 0 fail`
- Process exit code is 0

### A Test File FAILS When

- Any assertion throws an error
- The output ends with `N pass, M fail` where M > 0
- The process crashes with an unhandled exception

### A Regression FAILS When

- The child process exits with non-zero code
- The child process output shows any failures
- The expected pass count does not match

### No Merge Is Allowed If

- Any checkpoint test file shows a failure
- Any regression test in any checkpoint shows a deviation from baseline

---

## 10. CI / Local Execution

### Currently

Tests run locally via `node`. There is no CI pipeline configured.

### Recommended Pre-Merge Command

```bash
node tests/turnaround-os/checkpoint2.test.js &&
node tests/turnaround-os/checkpoint3.test.js &&
node tests/turnaround-os/checkpoint4a.test.js &&
node tests/turnaround-os/checkpoint4b.test.js &&
node tests/turnaround-os/checkpoint5.test.js
```

All must exit 0 before any merge or push.

### Future CI (When Configured)

CI should run the above command on every push to:
- `feature/v6-turnaround-os-core`
- Any `agent/openclaw-checkpoint*` branch
- Any `agent/workbuddy-checkpoint*` branch

---

*Last updated: 2026-07-22 · OpenClaw 009*
