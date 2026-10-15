# RC8.14 D10 — 隔离 CAS 验证面板（test-client-only）

> 归属：`rc814-staging/staging-infra/test-client/`（独立测试工程，**非**生产小程序）。
> 本文件与面板仅供 owner 在**隔离 staging** 环境做 RC8_14_D10 的真实身份 CAS 验收。

## 目的
在**不改动任何业务云函数 / 不新增记录 / 不自动提交**的前提下，让 owner 在真机上用**真实 WeChat 身份**
（服务端 `getWXContext().OPENID`）执行 D10 序列：
同选重提（幂等）→ 异选（409 冲突）→ 只读取当前事件。

## 打开方式
1. 微信开发者工具导入本目录 `test-client/`（AppID `wxd441fbf3b9f10aa3`）；
2. 首页“步骤 1 · 身份自检”用 `stagingIdentityProbe` 完成身份核验（**与 startChallenge 无关**）；
3. 首页新增卡片 **“RC8.14 D10 CAS验证”**。

## 面板字段
| 字段 | 默认 | 说明 |
|---|---|---|
| recordId | `CR17920376443640tylag` | 可编辑；指向已提交 1 题（CE012/A）的真实记录 |
| eventId | `CE012` | 可编辑；历史事件，用于幂等/冲突验证 |
| choiceKey | `A`（可选 A/B） | 提交的选项 |

## 操作
- **提交指定选择（SUBMIT_SPECIFIED_CHOICE）** → `submitChallengeChoice({recordId,eventId,choiceKey})`
  - 提交前弹**确认框**（显示 环境/recordId/eventId/choiceKey + staging-only 警告）。
  - 期望：同选 `A` 重提 → `code=0, duplicate=true, idempotent=true`；异选 `B` → `code=409, data.conflict=true`。
- **查当前事件（GET_CURRENT_EVENT · 只读）** → `getChallengeEvent({recordId})`
  - 期望：`eventId=GAME015`、`displayDay=2`。**只读，不提交。**

## 安全契约（实现约束）
- env 硬固定 `fanshen002-d9g0rjr3b6e313af5`（无 `DYNAMIC_CURRENT_ENV`，无生产回退）。
- 仅用 `wx.cloud.callFunction`；**从不发送权威 openid**；不绕过 `getWXContext`。
- **不自动调用 startChallenge**；**不自动提交**；页面 onLoad **无隐藏写**。
- 提交守卫：请求进行中禁用；空 recordId/eventId 拒绝；非法 choiceKey 拒绝；**提交前可见确认**。
- **409 不自动重试**；响应**原样展示**（code/message/data、duplicate/idempotent/conflict、currentEventIndex、
  t0/t1/dt），**不合成** flag、**不把意外响应转 PASS**。
- 日志脱敏（openid 形态仅留 6 位 + `…`）；不打凭据。

## 本地静态测试
```bash
node rc814-staging/staging-infra/test-client/tests/d10-panel.test.js   # 期望 D10_PANEL_TEST pass=39 fail=0
```
纯静态断言（无 wx 运行时、无网络、无 DB）。

## 边界
- 仅 test-client；**不**触碰 `cloudfunctions/*`、生产页面、支付/会员模块、计分引擎、事件库、DB 迁移。
- 面板提交会**诊断性改写该 recordId 的当日进度**（真实调用业务函数）——这是 D10 验收所必需，owner 知情执行。
