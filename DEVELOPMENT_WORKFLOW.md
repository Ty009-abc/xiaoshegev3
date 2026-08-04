# DEVELOPMENT_WORKFLOW.md — 开发工作流

> 参考 `docs/RELEASE_PROCESS.md` 获取完整 20 步发布流程。

## 快速开始

```bash
# 1. 从 release 建立分支
git checkout release/v6.5.0
git pull --ff-only origin release/v6.5.0
git checkout -b fix/<description>

# 2. 创建变更清单
cp .changes/current-change.json .changes/archive/$(date +%Y%m%d)-change.json
# 编辑 .changes/current-change.json

# 3. 开发 + 测试
npm run test:contracts
npm run test:guardrails

# 4. 提交
git add -A
git commit -m "<type>(<scope>): <description>"
git push origin <branch>
```

## 分支命名规则

- `fix/<version>-<short-description>` — Bug修复
- `build/<description>` — 基础设施
- `release/<version>` — 发布分支

## 模块职责

见 `docs/MODULE_OWNERSHIP.md`

## 冻结模块

修改冻结模块前提交 `FROZEN_MODULE_CHANGE_REQUEST`。

## 测试门禁

```bash
npm run test:contracts    # Contract Tests
npm run test:fixtures     # Fixture + Regression
npm run test:impact       # Impact Analysis  
npm run test:smoke        # Smoke Tests
npm run test:guardrails   # All of the above
```

---

*最后更新: 2026-08-04 — Engineering Guardrails 3.0*
