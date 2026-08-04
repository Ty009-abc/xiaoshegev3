# AGENTS.md — Engineering Guardrails 3.0

> 本文档定义本仓库所有 Agent / AI 助手的强制性开发规则。
> 任何人类或 AI 在此仓库内的修改必须遵守以下约束。

## 核心原则

### 1. 先读后改

每次修改前，必须先读取：
- 相关模块的架构文档（`docs/MODULE_OWNERSHIP.md`）
- 对应契约文件（`contracts/`）
- 相关测试文件（`tests/contracts/`, `tests/fixtures/`, `tests/regression/`）
- 发布流程文档（`docs/RELEASE_PROCESS.md`, `DEVELOPMENT_WORKFLOW.md`）

### 2. 分支规则

- 禁止直接在 `release/*` 分支上开发
- 所有修改从 `release/*` 建立 `fix/*` 或 `build/*` 分支
- 一个 Bug 一个分支，一个根因一个 Commit
- 分支命名：`fix/<version>-<short-description>` 或 `build/<description>`

### 3. 模块职责边界

- **Report Engine** — 只生成结构化结论，不画 UI，不生成 Canvas
- **Report Contract** — 只定义数据结构，不包含业务逻辑
- **Report Mapper** — 只做确定性字段转换，不创造新事实，不生成文案
- **Renderer / Poster Service** — 只绘图，不推理，不补造内容
- **Normalizer** — 只做字段兼容转换，不重算结论
- **Page** — 只负责展示和交互，不修改业务逻辑

详见 `docs/MODULE_OWNERSHIP.md`

### 4. 冻结模块保护

以下路径为冻结区，修改前必须输出变更请求：

```
share/PosterPrimitives.js
share/PosterService.js
core/turnaround-intelligence/**
core/turnaround-os/**
ci/**
```

变更请求格式（`FROZEN_MODULE_CHANGE_REQUEST`）：
- 修改原因
- 调用方影响
- 替代方案
- 测试计划
- 回滚方案

未经批准不得修改冻结模块。

### 5. 同类Bug处理

同类 Bug 第 3 次出现时：
- 停止打补丁
- 提交重构方案
- 方案批准后再统一修复

### 6. 真机验证

- 真机未通过，禁止 Merge 到 release
- Fix 分支禁止 Upload
- 必须扫码真机验证后才能合并

### 7. 测试纪律

- 禁止通过修改测试来掩盖失败
- Contract Tests 先行（修改契约后不更新测试 → BLOCKED）
- 所有强制门禁失败必须 exit code = 1

### 8. 变更清单

每次任务从 `.changes/current-change.json` 模板创建变更清单，填写：
- taskId, baseCommit, branch
- problem, rootCause
- allowedFiles, forbiddenFiles
- contractsAffected, requiredFixtures, requiredTests
- rollbackPlan

修改超出 `allowedFiles` 时自动阻止。

## 强制门禁（Preview 前）

1. 工作区干净（无未提交变更）
2. 分支门禁通过（非 release 直接开发）
3. Commit 已 Push 且与远程一致
4. 自动影响分析通过
5. Contract Tests 全部通过
6. Fixture Regression 全部通过
7. Semantic Tests 全部通过
8. Smoke Tests 全部通过

任何一步失败，禁止生成 Preview。

## 禁止事项

- 禁止 `raw` 对象直接传给 Renderer（必须先过 Contract）
- 禁止 `null`/`undefined` 出现在产品 UI 中
- 禁止空值 Decision 进入报告
- 禁止通过修改测试掩盖失败
- 禁止 Canvas 尺寸为 1×1
- 禁止仅背景的空海报导出
- 禁止 `finalStrike` 映射为 `decision`
- 禁止旧报告冒充新版报告
- 禁止 `git commit --no-verify` 和 `git push --no-verify`

## Git Hook 规则

禁止使用以下命令绕过 Git Hook：
- `git commit --no-verify`
- `git push --no-verify`

紧急事故必须绕过时，需创建 `EMERGENCY_BYPASS_APPROVAL.md`，包含：
- 原因
- 批准人
- 时间
- 补偿测试
- 后续修复 Issue

---

*最后更新: 2026-08-04 — Engineering Guardrails 3.0*
