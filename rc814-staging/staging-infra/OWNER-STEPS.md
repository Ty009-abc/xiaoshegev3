# RC8_14 Part 二.6 — Owner action steps (minimal, exact)

> Only needed to unlock **real mini-program identity** for C1–C10. Everything else is prepared.
> **PAUSE** on any rebind/换绑/销毁重建/新增付费 — report impact first.

## What is already done (no owner action)
- Independent test project created: `rc814-staging/staging-infra/test-client/` (appid `wxd441fbf3b9f10aa3`,
  pinned `wx.cloud.init({env:'fanshen002-d9g0rjr3b6e313af5'})`). Official client env UNCHANGED.
- 3 business functions + auth logic UNCHANGED (payload openid still ignored; no header identity path).
- Staging config + existing test data backed up: `staging-infra/backups/staging-data-<ts>/`.
- C1–C10 runner + identity mapper prepared (run after binding).

## Step 1 — Confirm / create the association (console)
- **Page:** 微信公众平台 `mp.weixin.qq.com` → 开发 → 云开发 → 环境列表.
  - If `fanshen002-d9g0rjr3b6e313af5` is listed → association exists; skip to Step 2.
  - Else → 云开发控制台 → 环境 `fanshen002-…` → **关联小程序** → 选择 `wxd441fbf3b9f10aa3` (体验版).
- **Target env:** `fanshen002-d9g0rjr3b6e313af5`. **Never** touch `fanshex-d2g0adgv7dfbc9bdc`.
- If the console requires **解绑/换绑 / 销毁重建 / 新增付费** → **STOP** and report; the assistant will not proceed.

## Step 2 — (if QR/click needed) owner scan
- A QR/confirm dialog is the only owner-gated step. Provide the exact page above + target env; the owner scans.

## Step 3 — Run the test client (owner or assistant, after binding)
1. 微信开发者工具 → 导入项目 → 目录 `rc814-staging/staging-infra/test-client/`.
2. 打开 `pages/index/index` → 确认 `openid`/`appid` 非空（真实身份已到达）。
3. 把该 openid 提供给助手（本地使用，不提交 Git）：
   `REAL_OPENID=<openid> MAP_CONFIRM=fanshen002-… node rc814-staging/staging-infra/map-identity.js`
4. 打开 `pages/runner/runner` → 运行 C1–C10 → 复制结果。

## Impact if binding is declined
- Real-identity C1–C10 remain **10× BLOCKED**. Server-side invoke cannot supply WeChat context (401).
- Alternative acceptable to owner: (a) accept mock-only evidence for C1–C10 (already produced, logic-level);
  (b) approve an explicit test-only HTTP identity route (NOT proposed here — would be a bypass).
