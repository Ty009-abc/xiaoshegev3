# BUG_ESCALATION.md — 同类Bug处理流程

> 同类 Bug 第 3 次出现时：停止打补丁，提交重构方案。

## 升级规则

| 出现次数 | 动作 |
|---------|------|
| 第 1 次 | 标准 fix 分支 + 根因 Commit |
| 第 2 次 | fix 分支 + 增加 regression test |
| 第 3 次 | **停止** → 提交重构方案 → 批准后统一修复 |

## 重构方案格式

```
REFACTOR_PROPOSAL
- Bug ID: <ids>
- 根因: <root cause>
- 为什么打补丁不够: <reasoning>
- 建议方案: <proposal>
- 影响范围: <affected modules>
- 风险: <risks>
```

## 已知重复Bug记录

（在此记录已有的重复Bug模式）

---

*最后更新: 2026-08-04 — Engineering Guardrails 3.0*
