# RC8_14 Part 二.6 — Owner action steps (CORRECTED, official path)

> Goal: make mini-program `wxd441fbf3b9f10aa3` able to call the staging env
> `fanshen002-d9g0rjr3b6e313af5` from 微信开发者工具, WITHOUT touching the official client's
> default env or production `fanshex-d2g0adgv7dfbc9bdc`.
> **PAUSE** on anything that would 解绑/换绑 the existing production association, 销毁重建 the env,
> or 新增付费 — report impact first (do not proceed).

> **Correction (2026-10-15):** the earlier draft pointed at 微信公众平台 → 云开发 as the entry. The
> **official** entry is the Tencent-Cloud-console 账号绑定 + the 微信开发者工具「使用已有腾讯云环境」
> conversion (steps below). Source: CloudBase docs “创建云开发环境 → 在微信小程序中使用已有腾讯云账号的云开发环境”.

## Pre-check (no action yet)
- Prod env `fanshex-d2g0adgv7dfbc9bdc` has `Source=miniapp` and is already in the SAME Tencent Cloud
  account that owns staging (`Source=qcloud`). ⇒ the 微信公众平台↔腾讯云-账号 **binding may already exist**.
  - In 腾讯云控制台 账号中心 → 登录方式, if **微信公众平台** already shows 已关联 → **skip Step 1–3**, go to Step 4.
  - If it shows 关联 (not yet bound) → do Step 1–3.

## Step 1 — 登录腾讯云控制台（主账号）
- 打开 [CloudBase 云开发控制台](https://tcb.cloud.tencent.com/dev) → 右上角用户名下拉 → **账号信息** → 账号中心.
- ⚠️ 若当前是**子账号**登录，需切换到**主账号**再操作。

## Step 2 — 绑定微信公众平台账号
- 在 **登录方式** 中，单击 **微信公众平台** 右侧的 **关联**。

## Step 3 — 授权绑定
- 用弹出的**二维码**微信扫码登录 → 在账号关联窗口单击 **去授权** → 按提示完成授权。
- ⇒ 微信公众平台账号 与 腾讯云账号 建立绑定。（**不涉及解绑/替换现有生产关联**。）

## Step 4 — 微信开发者工具 → 使用已有腾讯云环境（转换）
- 打开 **微信开发者工具** → 进入 **云开发控制台**。
- 进入 **设置** → 下拉 **环境名称** 列表 → 单击 **管理我的环境**。
- 在 **「微信开发者工具 > 环境管理」** 侧边栏 → 单击 **「使用已有腾讯云环境」**。
- 选择腾讯云侧环境 **`fanshen002-d9g0rjr3b6e313af5`** → **确认环境转换** → 按提示**扫码**完成验证。
- **目标环境：`fanshen002-d9g0rjr3b6e313af5`**。**绝不**选择/改动 `fanshex-d2g0adgv7dfbc9bdc`。

## Step 5 — 运行独立测试工程（转换后）
1. 微信开发者工具 → **导入项目** → 目录：解压后的 `test-client/`（appid 已在 `project.config.json` 固定为 `wxd441fbf3b9f10aa3`）。
2. 打开 `pages/index/index` → 确认 **openid / appid 非空**（说明真实微信上下文已到达）。
3. 把该 openid 提供给助手（仅本地使用，不提交 Git）→ 运行身份映射：
   `REAL_OPENID=<openid> MAP_CONFIRM=fanshen002-… node staging-infra/map-identity.js`
4. 打开 `pages/runner/runner` → 运行 **C1–C10** → 复制结果回传助手。

## If the console requires 解绑/换绑 / 销毁重建 / 新增付费
- **STOP** and report immediately. The assistant will NOT perform any rebind/rebuild/paid action.

## Impact if binding is declined
- Real-identity C1–C10 stay **10× BLOCKED** (server-side invoke cannot supply WeChat context).
- Owner may instead accept mock-only evidence (not preferred; owner explicitly does not accept it).
