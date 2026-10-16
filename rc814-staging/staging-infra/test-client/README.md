# RC8_14 独立测试工程 — 导入说明 (READ ME FIRST)

本工程是 **独立** 测试客户端，仅用于对 **staging** 环境做真实云端验收。它**不是**正式客户端，
不会修改正式客户端的默认环境。

## 固定目标环境 (已硬编码，勿改)
- staging env: **`fanshen002-d9g0rjr3b6e313af5`**
- appid: **`wxd441fbf3b9f10aa3`**（在 `project.config.json` 中固定）
- 代码里 `wx.cloud.init({ env: 'fanshen002-d9g0rjr3b6e313af5' })`——**不使用** DYNAMIC_CURRENT_ENV，
  避免静默回落到正式/生产环境。
- 生产环境 `fanshex-d2g0adgv7dfbc9bdc` **绝不**被本工程引用。

## 导入步骤
1. 微信开发者工具 → **导入项目**
2. 目录：解压后的本文件夹（含 `app.json` / `project.config.json`）
3. AppID：使用 `wxd441fbf3b9f10aa3`（`project.config.json` 已填）
4. 打开前，确保已完成 **OWNER-STEPS.md** 的账号绑定 + 「使用已有腾讯云环境」转换，
   否则 `wx.cloud.callFunction` 会报环境不存在/未绑定。

## 运行入口
| 页面 | 路径 | 作用 |
|---|---|---|
| 身份自检 | `pages/index/index` | 显示 openid / appid（验证真实微信上下文到达）；按钮测 3 个函数 |
| 普通登录 | `pages/index/index`（步骤 1b） | **仅** `login`：创建/更新 `users` 记录。**不**创建挑战、**不**改权益/支付 |
| C1–C10 | `pages/runner/runner` | 逐项运行 C1–C10，输出 PASS/FAIL/BLOCKED + 标识 |
| Day1–Day3 受控验收 | `pages/index/index`（R6D 面板） | OWNER-ASSISTED：取当前题 → **手动**选择 → 单次提交；不自动选择/提交/重试；不调用 startChallenge |

## R6D · Day1–Day3 受控验收面板（OWNER-ASSISTED）
- 固定 `recordId`（默认 `CRmvakykxsq5m5s6zj`）；步骤选择 Day1 `CE012` / Day2 `GAME015` / Day3 `CE011`。
- 每步：**取当前题**（`getChallengeEvent`，只读，显示后端下发的真实 `eventId`/`day`/A·B·C）→ owner **手动点选**一个选项 → **提交所选**（`submitChallengeChoice`，单次、需 `showModal` 确认）。
- 安全：**不**自动选择、**不**自动提交、**不**自动重试；无题时不提交；提交前须可见确认；身份来自 `getWXContext`；固定 staging env；**不**调用 `startChallenge`。
- 第 4 步（idx≥3）期望 `getChallengeEvent` 返回 `needPayment=true / locked=true`（付费边界）。

> 预览二维码：`local/preview-test-client.png`（git-ignored，由 `../preview-test-client.js` 生成，`--preview` 模式，不上传、不发布）。
> 测试身份 onboarding 验收步骤见 `../D12-R5B-IDENTITY-ONBOARDING-EVIDENCE.md`（Phase 2 由 owner 在真机执行）。

## 身份映射（把合成 fixture 归属到真实测试身份）
- 在 `pages/index/index` 读到真实 openid 后，**本地**运行（**不要**把 openid 提交 Git）：
  ```
  REAL_OPENID=<openid> \
  STAGING_ENV_ID=fanshen002-d9g0rjr3b6e313af5 \
  STAGING_ALLOWLIST=fanshen002-d9g0rjr3b6e313af5 \
  MAP_CONFIRM=fanshen002-d9g0rjr3b6e313af5 \
  node staging-infra/map-identity.js
  ```
- 该脚本只改 9 条 STG-* fixture 的 `openid`，幂等、不删除、不清空；真实 openid 仅写入
  git-ignored 的 `test-client/local/identity-map.local.json`（指纹记录）。

## 明确排除
- **不含**任何密钥 / secret / private key。
- **不含** local 身份映射（`test-client/local/` 已被排除）。
- 不新增 payload openid，不新增自填 header 身份入口；3 个业务函数与鉴权逻辑不变。

## 交付边界
- 本包不触发真实支付、不发布生产、不改动生产环境与正式客户端。
- 运行结果请回传助手，由助手逐项登记真实证据（不直接宣告整体完成）。
