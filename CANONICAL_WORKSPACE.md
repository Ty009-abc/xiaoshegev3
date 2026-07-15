# CANONICAL_WORKSPACE.md
<!-- V3_CANONICAL_DEVELOPMENT_GOVERNANCE_V1 — 2026-07-15 23:30 CST -->

## 唯一主仓库

```
CANONICAL_REPO=/home/ubuntu/xiaoshige-v3/xiaoshige-v3
```

禁止在 workspace、/tmp、或任何非 canonical 目录中开发 V3。

## 核心原则

1. **ONE_FEATURE = ONE_PRODUCTION_LINK** — 一个功能只能有一条生产链路
2. **REPLACE ≠ ADD** — "替换/迁移/重构"意味着下线旧实现，不是并存
3. **NO DUPLICATE BUSINESS LOGIC** — 同一逻辑只允许一个 Source of Truth
4. **AUDIT BEFORE CODE** — 修改前先画真实调用链，不凭文件存在推断
5. **COMMIT BEFORE PACKAGE** — 测试包必须来自唯一 commit，禁止未提交代码打包
6. **NEVER CLEAR DATABASE** — 修UI/字段/路由时禁止 initDatabase/clear/delete all
7. **RETIRE OLD ENTRY** — 新实现上线后必须下线旧入口（页面/路由/函数/数据源）

## 开发流程

```
BUILD → CONNECT → CUTOVER → RETIRE OLD → VERIFY → COMMIT → PACKAGE
```

任何一步缺失，任务不算完成。

## 状态分级

| 状态 | 含义 |
|---|---|
| `CODE_WRITTEN` | 代码已写，未验证 |
| `STATIC_VERIFIED` | 静态检查通过 |
| `DEPLOYED` | 已部署，未真机验证 |
| `DEVICE_VERIFIED` | 真机验证通过 |
| `CUTOVER_COMPLETE` | 新链路接管，旧链路已退役 |
| `REGRESSION_VERIFIED` | 核心功能回归测试通过 |

只有达到 `DEVICE_VERIFIED` 才能说"已修复"。
只有达到 `CUTOVER_COMPLETE` 才能说"旧版本已下线"。

## 旧代码下线三级

| Level | 操作 | 触发条件 |
|---|---|---|
| LEVEL 1 | 停止入口 | 新实现上线后立即执行 |
| LEVEL 2 | 强制重定向 | 旧页面可能被历史链接访问时 |
| LEVEL 3 | 物理删除 | 确认无历史兼容需求后 |

默认目标：达到 LEVEL 3。

## 旧链路退役检查清单

每次重构必须逐项确认并标记 `REMOVED / REDIRECTED / MIGRATED / STILL_REQUIRED`：

旧页面 / 旧入口 / 旧路由 / 旧事件处理 / 旧云函数调用 / 旧service / 旧globalData / 旧storage key / 旧数据库读取方式 / 旧本地数据源 / 旧计分逻辑 / 旧报告逻辑 / 旧fallback / 旧WXML / 旧WXSS / app.json旧注册 / cloudbaserc旧注册

## 修改前影响面分析

```
CHANGE_SCOPE
DIRECT_FILES / DIRECT_FUNCTIONS / CALLERS / CALLEES / ROUTES / CLOUD_FUNCTIONS / DATABASE_COLLECTIONS / SHARED_COMPONENTS / POSSIBLE_REGRESSIONS
```

## Daily Baselines

- [DAILY_BASELINE_20260716.md](./DAILY_BASELINE_20260716.md) — TAG: v3-20260716-daily-baseline, HEAD: 14b8a32

## 核心回归矩阵

每次 P0 修改后至少验证受影响模块：

- A. 首页 — 正常加载、无遮罩、280条、认知暴击入口
- B. 认知暴击 — 独立页、海报生成、二维码、返回
- C. 世界规则 — 280条、详情正文、反向推理、行动建议、无遮罩
- D. 翻身策略诊断 — 10题、答案匹配、金额正确、引擎正确、报告正确
- E. 30天认知挑战 — 唯一入口、normalized_v2、rawScores、云端30题、无固定答案、无异常100分、报告生成、报告可重新查看
- F. 支付 — 9.9解锁、会员权限、不重复扣费

## 数据库保护

永久保护集合：world_rules (280) / challenge_events (30) / users / memberships / ai_reports / challenge_records

CURRENT STATUS:
- world_rules: 280 ✅
- challenge_events: 30 ✅
- challenge_records: created, count=0 (空集合，待首次写入)

任何涉及这些集合的修改必须：dryRun → backup → count before → 执行 → count after

## 打包规范

- 测试包必须来自唯一 commit（`git status --short` 必须为空）
- 包名格式：`xiaoshige-v3-YYYYMMDD-HHMM-<SHORT_SHA>.tar.gz`
- 禁止未提交代码打包

## 报告模板

每次任务结束必须输出 `CHANGE_REPORT`，包含 20 项完整字段。

## 相关文件

- [ARCHITECTURE_REGISTRY.md](./ARCHITECTURE_REGISTRY.md)
- [LEGACY_REGISTRY.md](./LEGACY_REGISTRY.md)
