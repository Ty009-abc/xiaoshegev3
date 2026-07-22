# CONTRIBUTING.md

> Turnaround OS V6 · Engineering Contribution Rules
>
> **Current stable:** v6-checkpoint5
> **Current baseline:** feature/v6-turnaround-os-core @ f0f9034
> **Test baseline:** 165 pass / 0 fail
>
> This document defines the rules every human developer and AI agent
> MUST follow when modifying this repository.
>
> For the **end-to-end collaboration and release workflow**, see
> [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).

---

## 1. Purpose

`CONTRIBUTING.md` defines **what** you must do when contributing code.
[`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md) defines **how** the
AI collaborative workflow operates end-to-end.

Read both. They are complementary, not redundant.

---

## 2. Required Reading

Before modifying any code, every contributor or AI agent MUST read:

1. `README.md`
2. `DEVELOPMENT_WORKFLOW.md`
3. `CONTRIBUTING.md` (this file)
4. Architecture documents relevant to the module being changed
5. Checkpoint test files relevant to the change

Skipping these is a violation. There are no shortcuts.

---

## 3. Roles

### OpenClaw

- Feature implementation
- Architecture-compatible development
- Unit and checkpoint tests
- Implementation documentation

### WorkBuddy

- Code review
- Hardening
- Edge-case coverage
- Regression verification

### Ubuntu Merge

- Integration
- Full regression
- Feature branch merge
- Tag and release

**Role boundaries must not be bypassed without explicit approval.**
OpenClaw does not review. WorkBuddy does not implement features. Ubuntu
does not skip regression.

---

## 4. Branch Naming

### Allowed Patterns

```
feature/v6-turnaround-os-core
agent/openclaw-checkpointX-<module>
agent/workbuddy-checkpointX-hardening
hotfix/<scope>-<summary>
release/v6.<version>
```

`X` must be the checkpoint number. `<module>` and `<summary>` must be
descriptive.

### Forbidden

```
test        temp        new         final
abc         123         <commit-hash>
```

If the branch name tells you nothing about its purpose, don't create it.

---

## 5. Commit Messages

### Format

```
type(scope): summary
```

### Allowed Types

| Type | Use For |
|---|---|
| `feat` | New capability |
| `fix` | Bug fix |
| `refactor` | Restructure without behavior change |
| `test` | Test addition or update |
| `docs` | Documentation |
| `perf` | Performance improvement |
| `chore` | Maintenance |

### Examples

```
feat(action-engine): add dependency scheduler
fix(state-machine): reject illegal retry transition
test(cp5): add cycle detection regression
docs(workflow): document WorkBuddy hardening flow
```

### Rules

- One logical change per commit
- No vague messages (`fix stuff`, `update`)
- No mixed feature + cleanup in one commit
- Do not rewrite released history

---

## 6. Coding Standards

### Require

- Single responsibility — one function, one purpose
- Small, readable functions
- Explicit inputs and outputs
- Deterministic behavior (same input → same output)
- Meaningful names (`generateMissionPlan`, not `genMP`)
- Structured errors (never silently swallow failures)
- Backward compatibility with released checkpoints
- Comments only where intent is not obvious

### Avoid

- Dead code (commented-out blocks, unreachable paths)
- Duplicated logic (extract it)
- Magic values (use named constants)
- Silent failures
- Hidden side effects
- Deeply nested control flow
- Unnecessary abstraction
- Large unrelated refactors

---

## 7. Architecture Rules

New code MUST:

- Follow the existing Turnaround OS V6 architecture
- Use existing contracts, schemas, validators, engines, and state
  modules where applicable
- Avoid parallel implementations of the same concept
- Preserve public contracts unless a migration is explicitly approved
- Keep business logic out of UI and transport layers
- Add architecture documentation when introducing a new subsystem

If you are unsure whether a change is architecture-compatible, open a
discussion before writing code.

---

## 8. Testing Rules

### Every change must include tests appropriate to its risk.

### Current Baseline

```
checkpoint2:   28 pass / 0 fail
checkpoint3:   22 pass / 0 fail
checkpoint4a:  27 pass / 0 fail
checkpoint4b:  29 pass / 0 fail
checkpoint5:   59 pass / 0 fail
────────────────────────────
Total:        165 pass / 0 fail
```

### Rules

- Bug fixes require regression tests
- New features require success, failure, and edge-case tests
- No skipped or disabled tests without written justification
- No merge when any existing checkpoint regresses
- Test output must be reported before push or merge

---

## 9. Change Scope

Contributors MUST:

- Modify only files necessary for the task
- Report all changed files
- Explain unexpected changes
- Avoid formatting unrelated files
- Avoid dependency upgrades unless required
- Avoid changing generated files manually

Stick to the task. Nothing more, nothing less.

---

## 10. Security and Secrets

### Never Commit

- API keys
- Access tokens
- Private keys
- Passwords
- Production secrets
- Local credential files
- `.env` files containing secrets

Use environment variables or approved secret management.

**If a secret is accidentally committed, stop and report it
immediately.** Do not push. Do not try to fix it silently.

---

## 11. Pull Request and Review Checklist

Before marking a contribution as ready for review or merge:

```
[ ] Branch name follows convention
[ ] Commit messages follow convention
[ ] Change scope is focused
[ ] Tests were added or updated
[ ] Relevant checkpoint tests pass
[ ] No secrets are included
[ ] No dead or duplicated code was introduced
[ ] Documentation was updated where necessary
[ ] Backward compatibility was considered
[ ] WorkBuddy hardening was completed (when required)
[ ] Ubuntu full regression passed (before release)
```

---

## 12. Merge Rules

- Use `--no-ff` for checkpoint integration
- **Never** force-push protected or shared branches
- **Never** rebase released checkpoints
- **Never** merge with failing tests
- **Never** merge WorkBuddy hardening directly into the feature baseline
  without first integrating it into the corresponding OpenClaw branch
- GitHub is the single source of truth

For the detailed sequence, see
[DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).

---

## 13. Documentation Rules

Update documentation when:

- Adding a new subsystem
- Changing public contracts
- Changing branch or release procedures
- Changing test commands
- Adding a checkpoint
- Introducing migration or compatibility requirements

**Do not write documentation that merely repeats code.** Document
intent, constraints, and design rationale — not implementation details
visible in the source.

---

## 14. Repository Hygiene

After a checkpoint release:

- **Keep** the release tag
- **Retain** stable baseline branches
- **Delete** merged temporary and hardening branches (when safe)
- **Delete** accidental branches
- **Do not delete** branches before the release tag and feature merge
  are verified
- **Keep** the working tree clean

---

## 15. Definition of Done

A contribution is complete **only when:**

1. Implementation is complete
2. Tests pass (all checkpoints)
3. Regressions are absent
4. Documentation is updated
5. Branch is pushed to GitHub
6. Review or hardening is complete
7. Integration is verified
8. Git status is clean

Until all eight conditions are met, the contribution is not done.

---

*This document is binding. All agents and human contributors are
expected to follow these rules. Violations should be flagged in code
review.*

*Last updated: 2026-07-22 · OpenClaw 009*
