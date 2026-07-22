# RELEASE PROCESS

> Turnaround OS V6 · Release Procedure
>
> **Current stable:** v6-checkpoint5
> **Test baseline:** 165 pass / 0 fail
>
> This document defines the exact steps to release a new Turnaround OS
> checkpoint. Every release must follow this process exactly. No
> shortcuts. No exceptions.

---

## 1. Release Overview

A release is the act of merging a completed checkpoint into the stable
feature branch, verifying full regression, and cutting a permanent
version tag.

### Release Artifacts

- **Merged commit** on `feature/v6-turnaround-os-core`
- **Annotated tag** `v6-checkpointX` pointing to the merge commit
- **Green test suite**: all checkpoint tests pass (currently 165/0)

---

## 2. Release Sequence

```
┌──────────────────────────────────────────────────┐
│ 1. OpenClaw feature branch                       │
│    agent/openclaw-checkpointX-xxxxx               │
│    → Feature implementation + tests               │
│    → Push to GitHub                               │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│ 2. WorkBuddy hardening branch                    │
│    agent/workbuddy-checkpointX-hardening           │
│    → Code review + hardening                      │
│    → Push to GitHub                               │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│ 3. Merge hardening into OpenClaw branch          │
│    git fetch + git merge --no-ff                  │
│    → Run checkpoint tests                         │
│    → Push OpenClaw branch                         │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│ 4. Merge into feature/v6-turnaround-os-core      │
│    git fetch + git merge --no-ff                  │
│    → Full regression (all checkpoints)            │
│    → Push feature branch                          │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│ 5. Tag the release                               │
│    git tag -a v6-checkpointX -m "..."             │
│    → Push tag to GitHub                           │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│ 6. Cleanup                                       │
│    → Delete merged hardening branch               │
│    → Verify remote is clean                       │
└──────────────────────────────────────────────────┘
```

---

## 3. Step-by-Step Commands

### Step 1: Merge WorkBuddy Hardening into OpenClaw Branch

```bash
cd /home/ubuntu/xiaoshige-v3/xiaoshige-v3

git fetch origin --prune

git checkout agent/openclaw-checkpointX-xxxxx
git pull --ff-only origin agent/openclaw-checkpointX-xxxxx
git merge --no-ff origin/agent/workbuddy-checkpointX-hardening \
  -m "merge: checkpointX workbuddy hardening"

# Run checkpoint tests
node tests/turnaround-os/checkpointX.test.js

# Push merged branch
git push origin agent/openclaw-checkpointX-xxxxx
```

### Step 2: Merge into Feature Baseline

```bash
git checkout feature/v6-turnaround-os-core
git pull --ff-only origin feature/v6-turnaround-os-core
git merge --no-ff agent/openclaw-checkpointX-xxxxx \
  -m "merge: checkpointX <description>"

# Full regression
node tests/turnaround-os/checkpoint2.test.js
node tests/turnaround-os/checkpoint3.test.js
node tests/turnaround-os/checkpoint4a.test.js
node tests/turnaround-os/checkpoint4b.test.js
node tests/turnaround-os/checkpoint5.test.js
# Add checkpointX.test.js if new

# Push feature branch
git push origin feature/v6-turnaround-os-core
```

### Step 3: Tag the Release

```bash
git tag -a v6-checkpointX -m "Turnaround OS V6 Checkpoint X"
git push origin v6-checkpointX
```

### Step 4: Cleanup

```bash
# Delete hardening branch (merged)
git push origin --delete agent/workbuddy-checkpointX-hardening

# Delete any accidental branches
git push origin --delete <accidental-branch>

# Verify clean remote
git ls-remote --heads origin
```

---

## 4. Tag Specification

### Format

```
v6-checkpointX
```

Where `X` is the checkpoint number.

### Examples

```
v6-checkpoint2
v6-checkpoint3
v6-checkpoint4a
v6-checkpoint4b
v6-checkpoint5
```

### Tag Rules

| Rule | Rationale |
|---|---|
| Always annotated (`-a`) | Annotated tags carry creator, date, and message |
| Message describes the checkpoint | `"Turnaround OS V6 Checkpoint 5"` |
| Tag from `feature/v6-turnaround-os-core` only | Ensures tag points to the integration branch |
| Tag after full regression, not before | Prevents tagging a broken release |
| **Never overwrite an existing tag** | Tags are immutable history |
| **Never delete a pushed tag** | Deleted tags cause confusion and broken references |

### Viewing Tags

```bash
git tag -l "v6-*"           # List all V6 tags
git show v6-checkpoint5      # Show tag details
```

---

## 5. Merge Rules

### Always Use `--no-ff`

Every checkpoint integration must use `git merge --no-ff`:

```bash
git merge --no-ff <branch>
```

This creates an explicit merge commit that documents the integration
point. Fast-forward merges hide the branch structure.

### Merge Order (Strict)

```
WorkBuddy hardening
    │
    ▼
OpenClaw feature branch (merge --no-ff)
    │
    ▼
feature/v6-turnaround-os-core (merge --no-ff)
    │
    ▼
Tag
```

Never skip a step. Never merge WorkBuddy hardening directly into the
feature baseline.

---

## 6. Regression Requirements

### Before Every Tag

```
checkpoint2.test.js   → 28 pass / 0 fail
checkpoint3.test.js   → 22 pass / 0 fail
checkpoint4a.test.js  → 27 pass / 0 fail
checkpoint4b.test.js  → 29 pass / 0 fail
checkpoint5.test.js   → 59 pass / 0 fail
                                            (plus any new checkpoint)
```

### If Any Test Fails

1. Do NOT proceed with the merge
2. Do NOT tag
3. Investigate and fix the failure
4. Restart the release process from Step 1

---

## 7. Rollback Strategy

### If a Release Tag Is Broken

1. **Do NOT delete the tag.** Tags are immutable history.
2. Identify the bad commit on `feature/v6-turnaround-os-core`
3. Create a `hotfix/` branch from the last known-good checkpoint
4. Fix the issue on the hotfix branch
5. Follow the full release process for the hotfix

### Reverting a Feature Branch Merge

```bash
git checkout feature/v6-turnaround-os-core
git revert -m 1 <merge-commit-hash>
git push origin feature/v6-turnaround-os-core
```

The `-m 1` flag tells Git to keep the first parent (the existing feature
branch) and revert the changes from the merged branch.

### Rolling Back to a Previous Checkpoint

```bash
# Check out the known-good tag
git checkout v6-checkpoint5

# Create a hotfix branch from it
git checkout -b hotfix/rollback-to-cp5

# (Optionally) reset the feature branch
# git checkout feature/v6-turnaround-os-core
# git reset --hard v6-checkpoint5
# git push --force origin feature/v6-turnaround-os-core  ← ONLY with explicit approval
```

**Force push is a last resort.** Prefer `git revert` over `git reset
--hard` for shared branches.

---

## 8. Release Checklist

Before starting any release, verify:

```
[ ] All prior checkpoint tags exist (v6-checkpoint2 through v6-checkpoint5)
[ ] WorkBuddy hardening branch exists on GitHub
[ ] OpenClaw feature branch exists on GitHub
[ ] No uncommitted changes in local workspace
[ ] Local is in sync with GitHub (git fetch --prune completed)
```

Before pushing to `feature/v6-turnaround-os-core`:

```
[ ] OpenClaw branch merged with WorkBuddy hardening (--no-ff)
[ ] OpenClaw branch tests pass
[ ] Merge into feature branch used --no-ff
[ ] Full regression: all checkpoint tests pass
[ ] No regression deviations from baseline
```

Before creating the tag:

```
[ ] Feature branch is pushed to GitHub
[ ] Full regression output is captured
[ ] Tag message is descriptive
[ ] Tag name follows v6-checkpointX format
[ ] Tag points to the correct merge commit
```

After release:

```
[ ] Tag is pushed to GitHub
[ ] Hardening branch is deleted from remote
[ ] Accidental branches are deleted from remote
[ ] git ls-remote --heads origin shows clean branch list
[ ] CHECKPOINT_HISTORY.md is updated
```

---

## 9. Release History

| Tag | Date | Checkpoint | Commit |
|---|---|---|---|
| `v6-checkpoint2` | 2026-07-21 | Identity → Strategy | `045187c` |
| `v6-checkpoint3` | 2026-07-21 | Projection + Why Engine | `045187c` |
| `v6-checkpoint4a` | 2026-07-21 | Mission Contract | `045187c` |
| `v6-checkpoint4b` | 2026-07-22 | Mission Plan + Fallback | `19d941c` |
| `v6-checkpoint5` | 2026-07-22 | Action Engine + State Machine | `f0f9034` |

---

*Last updated: 2026-07-22 · OpenClaw 009*
