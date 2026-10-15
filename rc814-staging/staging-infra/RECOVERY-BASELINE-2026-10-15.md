# RC8_14 — 恢复基线 + 下一步交接（2026-10-15）

> 触发：上一会话发生 auto-compaction recovery failure。本文档为该时刻的**只读恢复基线**与交接说明。
> 本批仅文档；未改业务代码、未部署、未改数据库。

## 1. 恢复基线（撰写时已复核）

| 项 | 值 |
|---|---|
| 仓库 | `/home/ubuntu/rc88-6q-refoundation`（worktree；gitdir 在主仓 `xiaoshige-v3`） |
| 分支 | `feature/rc8.13-virtual-payment` |
| HEAD | `d5b8b39f7fb0059aaf9ae70ae498e831e756279d` |
| 远端 | `origin/feature/rc8.13-virtual-payment` @ `d5b8b39`（ahead/behind = **0/0**） |
| 工作区 | 干净（`git status --porcelain` 空）；无进行中 rebase/merge |
| staging | `fanshen002-d9g0rjr3b6e313af5`（唯一允许写入） |
| 生产 | `fanshex-d2g0adgv7dfbc9bdc`（未触碰；prod startChallenge mtime `2026-09-30 21:07:30`） |

- 无残留测试进程；最近一次部署 = `2026-10-15 07:01:51`（`login` → staging），此后无新部署。
- 旧 stash（4 个，属 `feat/rc8.3-diagnosis-accuracy` 等旧分支）与本次无关，未触碰。

## 2. 现场结论（已完成 / 有证据 / 未完成）

**已完成且有证据**
- staging `users` 根因修复（依赖初始化：12 集合 / 8 索引 / 合成 users；幂等复跑 +0/+0/+0）。
- `stagingIdentityProbe`（仅 `getWXContext`、无视 payload 身份、无 DB 写、401 无身份）已部署 `lam-mjaelxov`。
- `login` 部署 staging `lam-l4nu6yg5`（代码未改）。
- 真机流程 PASS：身份自检 / startChallenge / getChallengeEvent / submit / 重复提交幂等。
- 首个真实 recordId `CR1792036676732txkcq0`；D7 的 **DB/引擎层** C1–C10 已出裁决（见 `D7-C1-C10-EVIDENCE.md`）。

**尚未完成（有证据标注）**
- 真实身份**函数级**并发/幂等验收 = **BLOCKED**（需绑定真实客户端，agent 不伪造 `getWXContext`）。
- `submitChallengeChoice` 并发"不同提交"**非原子**（实测丢 7/8 更新）。
- per-user 试用配额缺失（**既有**缺陷，早于 RC8_14）。
- 仅 **CONDITIONAL PASS**，不构成完整发布验收。

## 3. 下一步交接（均需单独授权，本批不执行）

1. **D7 结论固化** ← 本批已完成（`D7-C1-C10-EVIDENCE.md`）。
2. **真实身份 C1–C10（L1）**：由 owner 在绑定后的真实客户端运行 `test-client/lib/c1-c10-runner.js`（agent 不代跑）。
3. **submit 原子性硬化**（若授权）：将推进改为条件写（`where {_id, currentEventIndex: readIdx}`）或事务。
4. **per-user 试用配额设计**（若授权）：复用 in-play trial 记录或计数标记。
5. **提交/推送**：本批 `Commit → Push`（文档），**不部署**。

## 4. 写入边界（沿用）

- 仅 `fanshen002-d9g0rjr3b6e313af5` 可写；生产只读、不改。
- 真实 openid / 身份映射 / 密钥 **不入 Git**（`test-client/local/`、`deploy-manifest/*.local.json`、`*.remote.json` 已 git-ignore）。
- 不改三业务函数 / 鉴权；不放开 DB 权限；不跳权益校验；不触发真实支付。

## 5. 未确认项（UNKNOWN）

- `auto-compaction recovery failure` 的**具体受影响范围** = UNKNOWN（当前仓库与文档自洽，未见损坏）。
- D7 任务规格原文是否留档 = UNKNOWN。
- 官方 C9"过期权益"结论 = **完全未测**（staging `entitlements=0`、`memberships=0`）。
