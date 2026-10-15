# RC8_14 D7 — C1–C10 完整性证据（DB/引擎层）

- 任务：`RC8_14_D7_REAL_CLOUDBASE_INTEGRITY_GATE`（OWNER 009，P0，STAGING_SYNTHETIC_TEST_ONLY）
- 基线：`feature/rc8.13-virtual-payment @ d5b8b39`（本文件撰写时复核：HEAD `d5b8b39`，工作区干净，本地=远端 0/0）
- 环境：staging `fanshen002-d9g0rjr3b6e313af5`（唯一允许写入）；生产 `fanshex-d2g0adgv7dfbc9bdc` 未触碰
- 本文件为 **文档固化**；未改业务代码、未部署、未改数据库、未调用支付、未 commit 业务函数。

## 0. 关键分层声明（必须与"真实身份函数级"区分）

D7 的实际执行产生**两个不同层级**的结果，二者不可互相替代：

| 层级 | 含义 | 本回合是否执行 |
|---|---|---|
| **L1 真实身份函数级**（官方 `c1-c10-runner.js`：绑定小程序 → `wx.cloud.callFunction` → 服务端 `getWXContext().OPENID`） | 需要**真实微信身份**的端到端业务函数调用 | **未执行 → BLOCKED**（agent 不得伪造/覆盖 `getWXContext`） |
| **L2 DB/引擎层** | 真实 CloudBase 数据库原子性 + 真实云函数模块代码（纯函数路径），输入为合成数据 | **已执行**（见下） |

> ⚠️ **D7 的 C 编号 ≠ 官方 runner 的 C 编号。** 本回合 L2 使用了一套"以完整性主题命名"的自有 C1–C10 标签，
> 与官方 `c1-c10-runner.js` 的 C1–C10（绑定真实客户端）**不是同一批用例**。官方 runner 的 8 项
> （C1,C2,C3,C4,C5/C6/C7,C8,C9,C10）在本回合**全部未运行 = BLOCKED**。
> 因此 **"L2 C1–C10 有裁决" ≠ "官方 C1–C10 PASS"**，更 **≠ 完整发布验收**。

## 1. 证据可找回性（先声明）

- L2 结果来自本会话中执行的真实脚本 **stdout**（工具输出，非记忆重建）。
- 脚本位于 `/tmp`（`rc814_d7_harness.js`、`rc814_d7_h2.js`、`rc814_d7_verify.js`、`rc814_final.js`、`rc814_dbg.js`）；
  **未纳入 Git**（本批仅文档）。`/tmp` 为临时目录，**可复现但非长期留存**。
- **找不到原始输出的项一律标 UNKNOWN**，不凭记忆重建 PASS。

## 2. L2 执行汇总（真实 CloudBase + 真实模块代码）

- 合成控制文档：`_id = SYN-D7-*`，`openid = d7-*@staging.local`，`_d7test:true` → 用后删除（`leftover=0`）。
- 写入边界：仅 staging；仅上述控制文档；真实用户记录与 9 条 fixture 全程只读、未改。
- 记录集合 before/after 哈希一致：`1cb17254247438ab`。

| 自有编号 | 主题 | 层级 | 环境 | 实际结果 | 局限 |
|---|---|---|---|---|---|
| L2-C1 | 并发条件写 plan 原子性 | DIRECT_DB（真实 CloudBase） | staging | PASS：8 路并发条件写（`planLocked:{$ne:true}`），真实重叠 **4603ms**，恰好 **1 个赢家**（`planLocked=true`，唯一 marker `PLAN_6`），其余 0 影响 | 非官方 C1；未带真实身份 |
| L2-C2 | 并发 get（计划已锁）→ 持久化 no-op + 确定性投递 | DIRECT_DB | staging | PASS：8 路并发，重叠 8452ms；条件写 0 影响、plan 未被触碰；同 index 投递给同一事件 `CE011` | 非官方 C2；未带真实身份 |
| L2-C3a | 并发"相同"提交收敛 | DIRECT_DB | staging | PASS：8 路并发，重叠 9836ms；`choices=1`、index 0→1 仅一次 | 非官方 C3；模拟 submit 的读-改-写，非真实函数 |
| L2-C3b | 并发"不同"提交（丢更新探针） | DIRECT_DB | staging | **FAIL（如实）**：8 路均读到 index=0，最终 index=1、choices=1，**丢失 7/8 更新** | 见 §3 说明层级 |
| L2-C3c | 顺序重复提交幂等 | 真机(owner) + DB 佐证 | staging | PASS：owner 设备 `duplicate:true/idempotent:true`；DB 佐证 index/choices/updatedAt 未二次变化 | 顺序≠并发；非官方 C3 |
| L2-C4 | legacy 恢复保留已答前缀 | 引擎（真实模块代码） | staging | PASS：`status=OK`、`source=legacy_recovery_v1`；前缀 `CE001,CE002,CE003,CE005,CE006` 原样保留；未来题与已答 **0 交叉**；30/30 distinct | 输入为 fixture，非真实身份调用 |
| L2-C5 | 30 题不重复计划 | 引擎 | staging | PASS：`len=30`、`distinct=30`、全部 ∈ 事件库(34)、`planVersion=rc8.14_v1`、`bank_4vidyr` | 非官方 C5（官方经 startChallenge 真机跑满 30 天） |
| L2-C6/C7 | 边界投递（无 Day31） | 引擎 | staging | PASS：`eventIdAtIndex(29)=CE007`、`(30)=null`、`(-1)=null` ⇒ 绝不返回 Day31 | 非官方 C6/C7（官方为真机完成/拒绝） |
| L2-C8 | 事件池增长下 plan 不变 | 引擎 | staging | PASS：既有 plan 有效、引用 id 全部可解析；`eventBankVersion` 冻结在创建时池快照 `bank_4vidyr`，池增长后**不自动改写**（扩展池哈希 `bank_1gbn1hf` 仅用于说明设计，不改写已锁 plan） | 非官方 C8；**勘误**：先前一次 mismatch 系探针脚本传 id 字符串→空哈希 `bank_45h`，已修正 |
| L2-C9 | 免费试用边界（per-record） | DIRECT_DB + 引擎 | staging | PASS（合成）：trial 记录 index 到 3 后 gate=`NEED_PAYMENT`；完整挑战不可达（index 3 < 30）；未调用任何支付函数 | **注意**：此 L2-C9 测的是**试用边界**，**不是**官方 C9 的**过期权益** |
| L2-C10 | 不可恢复 legacy → fail-closed | 引擎 | staging | PASS：重复已答→`LEGACY_PLAN_UNRECOVERABLE(LEGACY_ANSWERED_DUPLICATE)`；溢出(>planTotal)→`LEGACY_PLAN_UNRECOVERABLE(LEGACY_ANSWERED_OVERFLOW)`；畸形(非数组)→**写前抛错**（绝不静默覆盖） | 非官方 C10 |

### 计数（区分层级）
- `REAL_CLOUD_FUNCTION_TEST_COUNT = 0`（本门禁未执行任何"带真实身份"的业务函数调用）
- `DIRECT_DB_TEST_COUNT = 4`（L2-C1、L2-C2、L2-C3a、L2-C3b，真实 CloudBase 并发）
- `MOCK_TEST_COUNT = 0`（L2-C4…C10 用**真实引擎模块代码**，仅输入为合成；非 mock）

## 3. 明确保留的四项（本批强制保留）

### 3.1 真实身份函数级并发验收 = BLOCKED
官方 `c1-c10-runner.js` 的全部 C1–C10 需要绑定小程序产生的真实 `getWXContext().OPENID`。
agent **不得伪造/覆盖** `getWXContext` 或注入 payload 身份 ⇒ **未执行、不判 PASS**。
（合成 openid `test-openid-N@staging.local` 无法通过真实 `getWXContext` 认证。）

### 3.2 submit"不同提交"并发非原子
- **层级：DIRECT_DB（真实 CloudBase）+ 真实索引语义**。在合成控制文档上**复刻** `submitChallengeChoice` 的
  "读 index → 写 index+1 / choices 追加" 路径；**非**真实函数调用。
- **实测：8 路并发不同事件 → 丢失 7/8 更新**（均读到 index=0，最终 index=1、choices=1）。
- 结论：`submitChallengeChoice` 的推进为**非原子读改写**；"相同并发"可收敛为一条（幂等守卫），
  但"不同并发"会丢更新。**建议（不实施）**：改为条件写（`where {_id, currentEventIndex: readIdx}` 命中才更新）或事务。

### 3.3 per-user 试用配额缺失
- `getChallengeEvent` 的试用上限是 **per-record**（`trialMode && currentEventIndex>=3 → need_payment`）；
  `startChallenge`/`submitChallengeChoice` **无 per-user 试用计数** ⇒ 可重复创建 trial 记录（D6 已记录，**既有**行为，
  早于 RC8_14）。**当前未修复。**

### 3.4 仅 CONDITIONAL PASS
- RC8_14 挑战完整性在 **DB/引擎层**达标（不可变计划、legacy 安全恢复、fail-closed、试用边界、无 Day31、条件写 plan 原子）。
- **不具备完整发布验收结论**：真实身份 C1–C10 并发（L1）+ submit 原子性硬化 + per-user 试用配额 仍未闭环。

## 4. 生产 / 真实数据边界（只读核对）

- `PRODUCTION_CHANGED = NO`：prod `startChallenge` 修改时间仍 `2026-09-30 21:07:30`（本回合只读抽查）。
- `REAL_USER_RECORDS_CHANGED = NO`：staging 2 条真实用户记录 index 保持 0/0/1；记录集合哈希 `1cb17254247438ab` 前后一致。
- 未部署任何函数；未触发支付；未放开数据库权限；未跳权益校验。

## 5. 未确认项（UNKNOWN）

- **UNKNOWN**：D7 任务规格（TASK_SPEC 原文）是否已在仓库/记忆中留档 —— 未检索到，仅本会话上下文。
- **UNKNOWN**：L2 脚本产物是否需长期留存 —— 当前仅 `/tmp`，未入 Git。
- **UNKNOWN**：官方 C9"过期权益"结论 —— **完全未测**（staging `entitlements=0`、`memberships=0`，且 `STG-EXP-01` 无法真实认证）。

## 6. 复现入口（供后续，需重新授权且遵守写入边界）

- L2 引擎用例：加载真实模块 `getChallengeEvent/lib/challengePlan.js`、`challengePersonalization.js`、`challengeEventCatalog.js`，
  以合成记录 + 只读事件库调用 `buildPlan`/`recoverLegacyPlan`/`validatePlan`/`eventIdAtIndex`。
- L2 DB 并发用例：在 `SYN-D7-*` 合成控制文档上并发执行条件写（真实 `tcb db nosql execute`），用后删除。
- L1 真实身份用例：必须由 owner 在**绑定后的真实客户端**运行 `c1-c10-runner.js`；agent 不代跑、不伪造。
