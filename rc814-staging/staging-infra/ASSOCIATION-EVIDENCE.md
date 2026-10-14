# RC8_14 Part 二 — AppID / 腾讯云账号 / 关联 evidence (READ-ONLY)

- date 2026-10-14 · staging `fanshen002-d9g0rjr3b6e313af5` · production `fanshex-d2g0adgv7dfbc9bdc`

## Actual AppID / account
| item | value | source |
|---|---|---|
| Mini-program AppID (official client) | `wxd441fbf3b9f10aa3` | `project.config.json:141`, `upload-ci.js:50` |
| Tencent Cloud account (tcb login) | single account owning BOTH envs | `tcb api tcb DescribeEnvs` (both listed) |
| Production env | `fanshex-d2g0adgv7dfbc9bdc` · Source=**miniapp** · EnvChannel=`ide` · 个人版 | DescribeEnvs / env detail |
| Staging env | `fanshen002-d9g0rjr3b6e313af5` · Source=**qcloud** · EnvChannel=`qc_console` · 体验版 | DescribeEnvs / env detail |
| Staging created | 2026-10-14 20:55:57 (ap-shanghai, prepayment, expiry 2027-04-14) | env detail |

## Existing associations
- **Prod** is a **miniapp-source** CloudBase env → it IS the mini-program's 云开发环境 (bound to `wxd441fbf3b9f10aa3` at creation, EnvChannel `ide`).
- **Staging** is a **qcloud-source** (独立开通的体验版) env → **NOT** bound to any mini-program. It has
  no WeChat AppID association (Storages `AppId:""`, no login bindings, `tcb env login get` = plain config).
- `tcb env login get` (both envs): only `UserNameLogin:true`; no 微信 binding entry.
- No API Key present (`tcb env apikey list` → 暂无).

## Can staging be converted to a 小程序环境 (mini-program env)?
- **Association/binding is a 微信公众平台/腾讯云控制台 operation.** The `tcb` CLI 3.5.9 exposes
  **no** bind/associate action (`DescribeEnvChannels`, `DescribeMiniappBindings`, `DescribeEnvBindInfo`,
  `DescribeAppIdInfo` all → "action invalid or not found"). `tcb env login` manages only platform login
  policy, not AppID binding.
- ⇒ Binding **cannot** be done by the assistant via CLI/API and would require the **owner** to perform a
  console action (and possibly a QR/confirmation). Per owner rule: **PAUSE** before any rebind/destroy/paid step.
- **Preconditions verified / prepared:**
  - Config recorded: `staging-infra/backups/staging-data-<ts>/env-config.txt` + full env detail snapshot.
  - Existing test data backed up: `staging-infra/backups/staging-data-<ts>/{staging,challenge_events,challenge_records}.txt`.
  - AppID matches the official client (`wxd441fbf3b9f10aa3`) → if the owner chooses to bind, the staging env
    would become a second (体验版) 云开发环境 under the same mini-program, WITHOUT unbinding prod.
- **MUST NOT:** unbind/replace the existing prod association; touch production; create new paid resources.

## Owner console path (if binding is desired) — PAUSE point
1. 微信公众平台 (mp.weixin.qq.com) → 开发 → 云开发 → 环境列表：确认是否显示 `fanshen002-…`（体验版）。
   - If shown → the association already exists at the mp layer; the CLI "qcloud source" is only its creation channel.
   - If not shown → 云开发控制台 (console.cloud.google/tcb) → 环境 → 关联小程序（需 owner 扫码/确认）。
2. 关联后，小程序开发者工具里 **另建一个测试工程**（已就绪：`staging-infra/test-client/`），把 `wx.cloud.init({env})`
   指向 `fanshen002-d9g0rjr3b6e313af5`（本工程已固定），即可用真实 openid 调用 3 个函数。
3. 若提示需 **解绑/换绑 / 销毁重建 / 新增付费** → **暂停**并回报影响，不自动执行。

> Note: binding is NOT required for the server-side C1–C10 to be *attempted*; it IS required for real
> mini-program-driven calls (the client can only call an env it is bound to). See `R3-CONTINUATION.md`.
