# RC8_14 — staging 初始化补齐 + 身份自检 + 测试工程修复（证据）

- 目标（唯一允许写入）环境：`fanshen002-d9g0rjr3b6e313af5`（staging）
- 生产 `fanshex-d2g0adgv7dfbc9bdc`：**未改动**（3 个业务函数源零差异；prod startChallenge 修改时间仍
  `2026-09-30 21:07:30`；prod `users` 存在且有数据）
- 三个业务函数 `getChallengeEvent / startChallenge / submitChallengeChoice` 与鉴权逻辑：**零改动**

## 1. 实际执行环境 / 函数版本 / 错误位置（用调用日志核实）

### 1.1 客户端显示的环境文本 vs 实际 —— 用证据链核实
- 客户端 `wx.cloud.init({ env: 'fanshen002-d9g0rjr3b6e313af5' })`：`test-client/app.js`（**不使用** `DYNAMIC_CURRENT_ENV`，
  不能静默回落到生产）。
- 现场证据（owner 截图）：`startChallenge` 返回 `code=4001`，内部错误 `-502005、Table not exist: users`，无 `recordId`。

### 1.2 错误落在 staging —— 由源码控制流 + 调用日志证明（不靠客户端文本）
`cloudfunctions/startChallenge/index.js`：
```
L113  const openid = wxContext.OPENID
L113  if (!openid) return fail(CODES.AUTH_FAILED)          // 401 早退
...
L122  const userRes = await db.collection('users').where({ openid }).limit(1).get()
L123  if (!userRes.data[0]) return fail(CODES.AUTH_FAILED, '用户不存在')  // 401
...
L258  return fail(CODES.DB_ERROR, err.message)             // DB_ERROR = 4001  ← 仅异常路径可达
```
- `DB_ERROR (4001)` **只能在 `if (!openid)` 之后**、由 `try` 内异常抛出。因此 **code=4001 本身即证明
  `wxContext.OPENID` 非空** —— 真实微信身份**已经到达函数**（第 4 项“可信身份核验”的核心结论），
  失败点唯一为 `db.collection('users')` 触发的 `-502005 Table not exist: users`。
- 该 openid 在 staging `users` 中不存在（集合此前根本不存在）。

### 1.3 函数版本（staging，`tcb fn detail`；服务器权威）
| 函数 | staging fnId | 运行时 | 最后修改(部署) | 本地 index.js sha256 |
|---|---|---|---|---|
| getChallengeEvent | `lam-7urjq6bl` | Nodejs18.15 | 2026-10-14 22:17:12 | `8efb0c54…` |
| startChallenge | `lam-ouedpv7n` | Nodejs18.15 | 2026-10-14 22:17:32 | `3a55ce84…` |
| submitChallengeChoice | `lam-s0d3f231` | Nodejs18.15 | 2026-10-14 22:17:51 | `3d597b81…` |
| **stagingIdentityProbe（本轮新增）** | `lam-mjaelxov` | Nodejs18.15 | 2026-10-15 06:55:29 | `deploy-manifest/stagingIdentityProbe.local.sha256` |

- 与 `deploy-manifest/*.local.sha256` 一致；`git diff origin/feature/rc8.13-virtual-payment -- cloudfunctions/{startChallenge,submitChallengeChoice,getChallengeEvent,common}` = **空**（源未变）。
- `tcb fn invoke startChallenge` → `{"code":401}`（服务器无法携带微信上下文）—— 反证日志路径正常、openid 仅来自 WX 上下文。

## 2. C1–C10 必需依赖（三函数 + common 一次列齐）→ 初始化清单

见 `STAGING-DEPENDENCY-MANIFEST.json`（机读）与 `deps-preflight.js`（只读校验器）。

| 集合 | 用途 | 来源 |
|---|---|---|
| `challenge_events` | 事件库 `_loadBank(status=active)` + 出题 | 已有(34) |
| `challenge_records` | 记录 add/读取/更新 | 已有(9 fixtures) |
| **`users`** | `startChallenge` L122 身份校验（**-502005 根因**） | **本轮创建 + 9 合成用户** |
| `user_profiles` | submit 档案同步 + UCB L1 | 空建 |
| `entitlements` | permissionEngine 权益权威(`challenge_full`) | 空建 |
| `memberships` | 会员快速路径 + 引擎兜底 | 空建 |
| `ai_reports` | UCB L0 报告证据 | 空建 |
| `user_6q_raw` | UCB L0 原始 6Q | 空建 |
| `ai_chats` | contextBuilder 最近会话 | 空建 |
| `ai_cache` / `ai_logs` | aiEngine 缓存/观测（惰性，仅 AI 路径） | 空建 |
| `quota_usage` | permissionEngine.checkQuota（惰性） | 空建 |

**索引**（`users.openid_1` unique、`challenge_records.{openid_recordId_1,openid_createdAt_-1}`、
`challenge_events.{eventId_1,status_day_1}`、`entitlements.openid_1`、`memberships.openid_status_1`、
`user_profiles.openid_1`）→ 已建 7 个（+ 各集合自带 `_id_`）。

**合成 fixture（users）**：**从 DB 中实际带 `_fixture` 标记的 `challenge_records` 派生 openid**（不猜字段、
不复制生产用户/订单），字段与 `login` 的 `newUser` 形态一致，**全部 `membershipLevel:'free'`，未授予任何会员/权益**。
9 个 openid ↔ 9 条 fixture 一一对应。

## 3. 实际写入（仅 staging）

`init-staging-deps.js`（带守卫：显式 env + allowlist + 拒生产 + `DEPS_CONFIRM`）：
- 第一次：`collections +9 / indexes +7 / users +9`
- 再跑一次：`collections +0 / indexes +0 / users +0 (skipped 12/8/9)` → **幂等，不重复造数据**
- 现状（只读复核）：collections=13（含原 3 + `staging` 标记）、`challenge_records=9`、`challenge_events=34`、
  `users=9`；`STG-REC-01.currentEventIndex=5` 未变（**原有数据保留**）。
- **未清空/未删除任何集合或文档**；未放开任何数据库权限。

## 4. 可信微信身份（stagingIdentityProbe，仅部署 staging）

- 函数 `cloudfunctions/stagingIdentityProbe/index.js`：**只从 `cloud.getWXContext()` 读取调用者身份**；
  **不读** `event`/payload/header 身份；**不写数据库**；无身份 → `401`；运行时环境 ≠ staging（或 = 生产）→ 拒绝。
- 部署：`deploy-probe-staging.sh`（走 `preflight.sh`，仅 staging，禁生产/禁支付函数）→ `lam-mjaelxov`，部署成功。
- 服务器端反证：`tcb fn invoke stagingIdentityProbe` → `{"code":401}`（无 WX 上下文即拒绝，符合预期）。
- 身份未知/已脱敏：当前**无法在服务器端获得真实 openid**（仅绑定的小程序客户端可产生）；未写入 Git。

## 5. 测试工程修复（test-client v2）

- **身份自检独立**：新增 `stagingIdentityProbe` 步骤（`pages/index` 与 `pages/runner`），**不依赖 startChallenge 是否成功**；
  `envVerified` 校验返回环境是否为 staging。
- **失败原因可见**：startChallenge 失败时明确显示 `code / message / data`（不再只报“失败”）。
- **空 recordId 禁用后续**：`getChallengeEvent`、`submitChallengeChoice`、进入 Runner 按钮在无 `recordId`
  （或无可用题目/未通过身份自检）时 `disabled`。
- **submit 按钮文字溢出**：`.btn` 固定高 `84rpx`、`white-space:nowrap`、`text-overflow:ellipsis`、
  `overflow:hidden`，长标签加 `btn-wide` 略缩字号 → 不再溢出。
- **日志带时区**：每行日志前缀 `YYYY-MM-DD HH:mm:ss UTC±HH:MM`（本地偏移），Runner 另显示 `Intl…timeZone`。

## 6. preflight 纳入依赖清单

- `preflight.sh` 增 `DEPS_PREFLIGHT=1` 分支 → 调 `deps-preflight.js`（只读：listCollections / listIndexes / find）。
- `guard-selftest.sh` 新增 3 场景（deps ok / deps missing / deps prod）→ **pass=17 fail=0**。
- 真实 staging：`DEPS_PREFLIGHT=1 bash preflight.sh` → `OK … deps-verified`。

## 7. C1–C10 现状

- 依赖已就绪（第 3 节）；`c1-c10-runner.js` 未改（仍真实调用 3 函数，无 mock）。
- **C1–C10 尚需真实客户端操作**（见 `OWNER-STEPS.md`）：在微信开发者工具用绑定后的测试工程依次
  “身份自检 → start → get → submit”，通过后再跑 C1–C10。
- **无 mock 替代**；未跳过任何权益校验；未触发任何真实支付。

## 8. 最小客户端步骤（给 owner）

1. 微信开发者工具导入 `rc814-staging/staging-infra/test-client/`（AppID `wxd441fbf3b9f10aa3`）。
2. 确认 staging 已作为小程序环境关联；`wx.cloud.init({env:'fanshen002-…'})` 已固定。
   - 若打开即报“环境不存在/未绑定”：按 `OWNER-STEPS.md` 的**官方路径**在腾讯云控制台「关联」+ 开发者工具
     「使用已有腾讯云环境」转换（可能需扫码）。
3. 首页点「身份自检」→ 成功（显示脱敏 openid + `✅ 匹配 staging`）。
4. 点「startChallenge」→ 得到 `recordId`（本轮修复后应不再 4001）。
5. 点「getChallengeEvent」→ 显示当前题目；点「submitChallengeChoice」→ 提交成功。
6. 进入「C1–C10 Runner」→ 先身份自检再 Run，逐项返回所缺证据。

## 9. 边界

- 真实身份与密钥**不入 Git**（`test-client/local/`、`deploy-manifest/*.local.json|*.remote.json` 已 git-ignore）。
- 不改三函数/鉴权；不放开数据库权限；不跳权益校验；不触发真实支付；生产不变。
