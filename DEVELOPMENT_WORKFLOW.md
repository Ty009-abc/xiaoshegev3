# DEVELOPMENT WORKFLOW

> Turnaround OS V6 · AI Collaborative Engineering
>
> **Current stable:** v6-checkpoint5
> **Test baseline:** 165 pass / 0 fail
>
> This is not a Git tutorial. This documents the verified workflow we use
> every checkpoint.

---

## 1. Project Architecture

### Canonical Repository

```
git@github.com:Ty009-abc/xiaoshegev3.git
```

**GitHub is the single source of truth.** Every commit, branch, and tag
flows through this repository. Nothing lives only on a local machine.

### Development Environments

| Environment | Role | Machine |
|---|---|---|
| **Ubuntu (OpenClaw)** | Feature implementation, architecture, unit tests | Ubuntu 22.04 VM |
| **Mac (WorkBuddy)** | Code review, hardening, regression verification | macOS |
| **GitHub** | Single source of truth, PR review surface | Cloud |

**Rule:** Never edit directly on GitHub. All code originates from a local
development environment and is pushed after verification.

### Repository Layout

```
xiaoshige-v3/
├── core/
│   └── turnaround-os/
│       ├── contracts/      # Input/output contracts
│       ├── engines/        # Pure engine implementations
│       ├── schemas/        # Data schemas & validators
│       ├── state/          # State machines
│       └── validators/     # Plan validators
├── tests/
│   └── turnaround-os/      # checkpointN.test.js per checkpoint
├── docs/                   # Design docs & specs
├── .audit-reports/         # Security audit reports (gitignored)
└── DEVELOPMENT_WORKFLOW.md # This file
```

---

## 2. Responsibilities

### OpenClaw (Ubuntu)

**Owns:**

- Feature implementation — all new code for a checkpoint
- Architecture design — contracts, schemas, engine structure
- Unit tests — `checkpointN.test.js` with full coverage
- Self-verification — all tests must pass before pushing

**Never:**

- Modify `feature/v6-turnaround-os-core` directly
- Skip tests before pushing
- Force-push or rebase released branches

### WorkBuddy (Mac)

**Owns:**

- Code review — read every line of the checkpoint diff
- Hardening — fix edge cases, improve safety, tighten contracts
- Regression — verify all prior checkpoints still pass
- Merge verification — confirm the branch is safe to merge

**Never:**

- Rewrite architecture decisions
- Implement large features (that's OpenClaw's job)
- Merge without running the full test suite

### Ubuntu Merge (OpenClaw)

**Owns:**

- Merge branches (`--no-ff`)
- Full regression test suite
- Push to remote
- Tag release (`v6-checkpointX`)

---

## 3. Branch Naming Rules

### Required Pattern

```
feature/v6-turnaround-os-core          ← Stable integration branch
agent/openclaw-checkpoint6-xxxxx       ← OpenClaw feature branch
agent/workbuddy-checkpoint6-hardening   ← WorkBuddy hardening branch
release/v6.x                           ← Release branch (future)
hotfix/...                             ← Emergency fixes
```

### Rules

- Always use the `agent/` prefix for AI agent branches
- Include the checkpoint number in the branch name
- Use descriptive suffixes (not `fix`, `test`, `wip`)
- **Never use random branch names**

---

## 4. Standard Workflow

```
┌──────────┐
│ OpenClaw │  Feature branch       agent/openclaw-checkpointN-xxxxx
│ (Ubuntu) │     │
└────┬─────┘     │  git push origin
     │           ▼
     │      ┌────────┐
     │      │ GitHub │  Single source of truth
     │      └───┬────┘
     │          │  git fetch / git checkout
     │          ▼
     │      ┌──────────┐
     │      │ WorkBuddy│  Code review + hardening
     │      │  (Mac)   │     │
     │      └────┬─────┘     │  git push origin agent/workbuddy-checkpointN-hardening
     │           │            ▼
     │           │       ┌────────┐
     │           │       │ GitHub │
     │           │       └───┬────┘
     │           │           │  git fetch + git merge --no-ff
     │           │           ▼
     │           │       ┌──────────┐
     │           │       │  Ubuntu  │  Merge hardening → feature branch
     │           │       │  Merge   │     │
     │           │       └────┬─────┘     │
     │           │            │           │  Full regression
     │           │            │           │  git push origin
     │           │            │           │  git tag v6-checkpointN
     │           │            │           │  git push origin v6-checkpointN
     │           │            ▼           ▼
     │           │       ┌──────────────────┐
     │           │       │ feature/v6-      │
     │           │       │ turnaround-os-   │
     │           │       │ core             │
     │           │       └──────────────────┘
     │           │
     ▼           ▼
  Next checkpoint starts
```

### Step-by-step

1. **OpenClaw** creates `agent/openclaw-checkpointN-xxxxx` from `feature/v6-turnaround-os-core`
2. **OpenClaw** implements feature + tests, verifies, pushes to GitHub
3. **WorkBuddy** fetches OpenClaw's branch, reviews, hardens, pushes `agent/workbuddy-checkpointN-hardening`
4. **Ubuntu Merge** fetches hardening branch, merges `--no-ff` into OpenClaw branch, runs tests, pushes
5. **Ubuntu Merge** merges `--no-ff` into `feature/v6-turnaround-os-core`, runs full regression, pushes
6. **Ubuntu Merge** tags `v6-checkpointN`, pushes tag

---

## 5. Merge Rules

### Required Sequence

```
git fetch origin --prune
     │
     ▼
git merge --no-ff <source-branch>
     │
     ▼
node tests/turnaround-os/checkpoint2.test.js
node tests/turnaround-os/checkpoint3.test.js
node tests/turnaround-os/checkpoint4a.test.js
node tests/turnaround-os/checkpoint4b.test.js
node tests/turnaround-os/checkpoint5.test.js
     │
     ▼
git push origin <target-branch>
     │
     ▼
git tag -a v6-checkpointN
git push origin v6-checkpointN
```

### Never

- **Force-push** feature branches
- **Rebase** released checkpoints
- **Merge** without running the full test suite
- **Skip** `--no-ff` (we want explicit merge commits in the history)

---

## 6. Testing Requirements

### Required Tests

| Test File | Section | What It Covers |
|---|---|---|
| `checkpoint2.test.js` | Identity, WrongGame, Leverage, Strategy, Safety | Core engine determinism & persona coverage |
| `checkpoint3.test.js` | Projection, WhyEngine, Determinism | World A/B comparison & confidence |
| `checkpoint4a.test.js` | Mission Contract, Enums, Immutability | Mission creation & validation |
| `checkpoint4b.test.js` | Category Codes, Fallback, Plan Structure | Mission plan generation & safety |
| `checkpoint5.test.js` | Action Plan, State Machine, DAG Cycles | Action engine & dependency validation |

### Current Baseline

```
Checkpoint 2:   28 pass / 0 fail
Checkpoint 3:   22 pass / 0 fail
Checkpoint 4A:  27 pass / 0 fail
Checkpoint 4B:  29 pass / 0 fail
Checkpoint 5:   59 pass / 0 fail
────────────────────────────
Total:         165 pass / 0 fail
```

### Rules

- **All checkpoints must pass** before any merge or tag
- Each checkpoint includes full regression of all prior checkpoints
- New features require new test sections in the appropriate checkpoint file
- Test files are deterministic — same input = same output, every time

---

## 7. Release Rules

### Merge Target

```
feature/v6-turnaround-os-core
```

This is the **only stable integration branch**. All checkpoints land here.

### Tag Format

```
v6-checkpointX
```

Where `X` is the checkpoint number.

### Example: Checkpoint 5 Release

```
git checkout feature/v6-turnaround-os-core
git pull --ff-only origin feature/v6-turnaround-os-core
git merge --no-ff agent/openclaw-checkpoint5-action-engine
# Run full regression → 165 pass / 0 fail
git push origin feature/v6-turnaround-os-core
git tag -a v6-checkpoint5 -m "Turnaround OS V6 Checkpoint 5"
git push origin v6-checkpoint5
```

### Current Tags

```
v6-checkpoint4b
v6-checkpoint5
```

---

## 8. Repository Cleanup

### After Each Checkpoint Release

1. **Delete merged hardening branches:**
   ```
   git push origin --delete agent/workbuddy-checkpointN-hardening
   ```

2. **Delete accidental branches** (like `b1c6604`):

   If someone accidentally creates a branch with a commit hash name, delete it immediately:
   ```
   git push origin --delete b1c6604
   ```

3. **Keep `feature/v6-turnaround-os-core` clean:**
   - Only checkpoint merges land here
   - No direct commits
   - No fixup commits or WIP

### Do NOT Delete

- `feature/v6-turnaround-os-core`
- `agent/openclaw-checkpoint*` branches (keep as historical record)
- Released tags (`v6-checkpoint*`)

---

## 9. Coding Principles

### Commit Hygiene

- **Small commits** — one logical change per commit
- **Meaningful messages** — describe what and why, not how
  - ✅ `feat(action): add dependency DAG cycle detection`
  - ❌ `fix stuff`
- **No dead code** — don't leave commented-out blocks
- **No duplicated logic** — extract shared behavior into engines/schemas

### Architecture First

- Define contracts (`contracts/`) before implementing engines
- Define schemas (`schemas/`) before writing validators
- Define state machines (`state/`) before building the engine
- **Tests are part of the architecture**, not an afterthought

### Test Before Merge

- Write tests alongside the feature
- Run the full suite (all checkpoints) before every merge
- If a test fails, fix the code — never skip or delete a test

---

## 10. Future Checkpoints

### Planned

| Checkpoint | Expected Scope |
|---|---|
| **Checkpoint 6** | TBD |
| **Checkpoint 7** | TBD |
| **Checkpoint 8** | TBD |

### Must Follow Exactly the Same Workflow

1. OpenClaw → feature branch → push to GitHub
2. WorkBuddy → code review → hardening branch → push to GitHub
3. Ubuntu Merge → merge hardening → merge to feature → full regression → tag → push

No shortcuts. No exceptions. The workflow works because we follow it
consistently.

---

*Last updated: 2026-07-22 · OpenClaw 009*
