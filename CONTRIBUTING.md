# CONTRIBUTING.md

## 开发流程

1. 阅读 `AGENTS.md` — 所有规则
2. 阅读 `docs/MODULE_OWNERSHIP.md` — 模块职责边界
3. 从 `release/*` 创建分支
4. 创建 `.changes/current-change.json`
5. 遵循 `DEVELOPMENT_WORKFLOW.md`
6. 真机验证通过后才 Merge

## Commit 规范

```
<type>(<scope>): <description>

type: fix | build | docs | test | refactor
scope: report | world-rule | poster | ci | docs
```

## PR 要求

- [ ] `.changes/current-change.json` 已填写
- [ ] `npm run test:guardrails` 全部通过
- [ ] 影响分析非 BLOCKED
- [ ] 真机验证通过
- [ ] 未修改冻结模块（或已提交 FRZ_CHG_REQ）
- [ ] 禁止使用 `git commit --no-verify` 或 `git push --no-verify`
      （紧急绕过需 `EMERGENCY_BYPASS_APPROVAL.md`）

---

*最后更新: 2026-08-04 — Engineering Guardrails 3.0*
